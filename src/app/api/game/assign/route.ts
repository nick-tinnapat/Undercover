import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GUEST_ID_COOKIE } from "@/lib/cookies";
import { pickWordPair } from "@/lib/words";
import { shuffleInPlace } from "@/lib/shuffle";
import { maybeHandoverHost } from "@/lib/hostHandover";

type AssignBody = {
  code?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as AssignBody;
    const code = (body.code ?? "").trim().toUpperCase();
    const cookieStore = await cookies();
    const guestId = cookieStore.get(GUEST_ID_COOKIE)?.value ?? "";

    if (!code || code.length !== 6) {
      return NextResponse.json({ error: "CODE_INVALID" }, { status: 400 });
    }
    if (!guestId) {
      return NextResponse.json({ error: "GUEST_REQUIRED" }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, status, host_guest_id, undercover_count, mrwhite_count")
      .eq("code", code)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ error: "ROOM_NOT_FOUND" }, { status: 404 });
    }

    if (room.status !== "in_game") {
      return NextResponse.json({ error: "ROOM_NOT_IN_GAME" }, { status: 409 });
    }

    const handover = await maybeHandoverHost({
      supabase,
      roomId: room.id,
      currentHostGuestId: room.host_guest_id,
    });

    const hostGuestId = handover.changed
      ? handover.newHostGuestId
      : room.host_guest_id;

    if (hostGuestId !== guestId) {
      return NextResponse.json({ error: "HOST_ONLY" }, { status: 403 });
    }

    const { data: round, error: roundError } = await supabase
      .from("rounds")
      .select("id, phase")
      .eq("room_id", room.id)
      .order("round_number", { ascending: false })
      .limit(1)
      .single();

    if (roundError || !round) {
      return NextResponse.json({ error: "ROUND_NOT_FOUND" }, { status: 404 });
    }

    if (round.phase !== "assign") {
      return NextResponse.json({ error: "ALREADY_ASSIGNED" }, { status: 409 });
    }

    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id, room_id, guest_id, name, is_host, is_alive")
      .eq("room_id", room.id)
      .eq("is_alive", true);

    if (playersError || !players) {
      return NextResponse.json(
        {
          error: "PLAYERS_LOAD_FAILED",
          detail: playersError?.message,
          supabaseCode: playersError?.code,
        },
        { status: 500 }
      );
    }

    if (players.length < 3) {
      return NextResponse.json({ error: "MIN_PLAYERS_3" }, { status: 400 });
    }

    const undercoverTarget = Math.max(0, Number(room.undercover_count ?? 0));
    const mrwhiteTarget = Math.max(0, Number(room.mrwhite_count ?? 0));
    const specialTotal = undercoverTarget + mrwhiteTarget;

    if (specialTotal >= players.length) {
      return NextResponse.json({ error: "ROLE_COUNTS_TOO_HIGH" }, { status: 400 });
    }

    const pair = pickWordPair();
    const ids = shuffleInPlace(players.map((p) => p.id));

    const undercoverIds = new Set(ids.slice(0, undercoverTarget));
    const mrwhiteIds = new Set(
      ids.slice(undercoverTarget, undercoverTarget + mrwhiteTarget)
    );

    const byId = new Map(players.map((p) => [p.id, p] as const));

    const updates = ids.map((id) => {
      const p = byId.get(id);
      if (!p) {
        throw new Error("PLAYER_NOT_FOUND_IN_SET");
      }
      const isUndercover = undercoverIds.has(id);
      const isMrwhite = mrwhiteIds.has(id);
      return {
        id: p.id,
        room_id: p.room_id,
        guest_id: p.guest_id,
        name: p.name,
        is_host: p.is_host,
        is_alive: p.is_alive,
        role: isMrwhite ? "mrwhite" : isUndercover ? "undercover" : "civilian",
        word: isMrwhite ? null : isUndercover ? pair.undercover : pair.common,
      };
    });

    const { error: upsertError } = await supabase
      .from("players")
      .upsert(updates, { onConflict: "id" });

    if (upsertError) {
      return NextResponse.json(
        {
          error: "ASSIGN_FAILED",
          detail: upsertError.message,
          supabaseCode: upsertError.code,
        },
        { status: 500 }
      );
    }

    const { error: roundUpdateError } = await supabase
      .from("rounds")
      .update({ phase: "describe" })
      .eq("id", round.id);

    if (roundUpdateError) {
      return NextResponse.json(
        {
          error: "ROUND_UPDATE_FAILED",
          detail: roundUpdateError.message,
          supabaseCode: roundUpdateError.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { error: "ASSIGN_CRASHED", detail: message },
      { status: 500 }
    );
  }
}
