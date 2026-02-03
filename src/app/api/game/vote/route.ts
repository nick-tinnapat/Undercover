import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GUEST_ID_COOKIE } from "@/lib/cookies";

type VoteBody = {
  code?: string;
  targetPlayerId?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as VoteBody;
  const code = (body.code ?? "").trim().toUpperCase();
  const targetPlayerId = (body.targetPlayerId ?? "").trim();

  const cookieStore = await cookies();
  const guestId = cookieStore.get(GUEST_ID_COOKIE)?.value ?? "";

  if (!code || code.length !== 6) {
    return NextResponse.json({ error: "CODE_INVALID" }, { status: 400 });
  }
  if (!guestId) {
    return NextResponse.json({ error: "GUEST_REQUIRED" }, { status: 401 });
  }
  if (!targetPlayerId) {
    return NextResponse.json({ error: "TARGET_REQUIRED" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, status")
    .eq("code", code)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "ROOM_NOT_FOUND" }, { status: 404 });
  }

  if (room.status !== "in_game") {
    return NextResponse.json({ error: "ROOM_NOT_IN_GAME" }, { status: 409 });
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

  if (round.phase !== "describe") {
    return NextResponse.json({ error: "NOT_IN_DESCRIBE" }, { status: 409 });
  }

  const { data: me } = await supabase
    .from("players")
    .select("id, is_alive")
    .eq("room_id", room.id)
    .eq("guest_id", guestId)
    .single();

  if (!me) {
    return NextResponse.json({ error: "NOT_IN_ROOM" }, { status: 403 });
  }

  if (!me.is_alive) {
    return NextResponse.json({ error: "ELIMINATED" }, { status: 403 });
  }

  if (me.id === targetPlayerId) {
    return NextResponse.json({ error: "CANNOT_VOTE_SELF" }, { status: 400 });
  }

  const { data: target } = await supabase
    .from("players")
    .select("id, is_alive")
    .eq("room_id", room.id)
    .eq("id", targetPlayerId)
    .single();

  if (!target) {
    return NextResponse.json({ error: "TARGET_NOT_FOUND" }, { status: 404 });
  }

  if (!target.is_alive) {
    return NextResponse.json({ error: "TARGET_ELIMINATED" }, { status: 409 });
  }

  const { error: voteError } = await supabase.from("votes").upsert(
    {
      room_id: room.id,
      round_id: round.id,
      voter_guest_id: guestId,
      target_player_id: targetPlayerId,
    },
    { onConflict: "round_id,voter_guest_id" }
  );

  if (voteError) {
    return NextResponse.json({ error: "VOTE_FAILED" }, { status: 500 });
  }

  const { count: aliveCount } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id)
    .eq("is_alive", true);

  const { count: voteCount } = await supabase
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id)
    .eq("round_id", round.id);

  if ((aliveCount ?? 0) > 0 && (voteCount ?? 0) >= (aliveCount ?? 0)) {
    const { data: votes } = await supabase
      .from("votes")
      .select("target_player_id")
      .eq("room_id", room.id)
      .eq("round_id", round.id);

    const counts = new Map<string, number>();
    for (const v of votes ?? []) {
      counts.set(v.target_player_id, (counts.get(v.target_player_id) ?? 0) + 1);
    }

    let winnerId: string | null = null;
    let winnerCount = -1;
    const sortedKeys = Array.from(counts.keys()).sort();
    for (const k of sortedKeys) {
      const c = counts.get(k) ?? 0;
      if (c > winnerCount) {
        winnerCount = c;
        winnerId = k;
      }
    }

    if (winnerId) {
      const { data: eliminatedPlayer } = await supabase
        .from("players")
        .select("id, role")
        .eq("room_id", room.id)
        .eq("id", winnerId)
        .single();

      await supabase
        .from("players")
        .update({ is_alive: false })
        .eq("room_id", room.id)
        .eq("id", winnerId);

      const { data: aliveRoles } = await supabase
        .from("players")
        .select("role")
        .eq("room_id", room.id)
        .eq("is_alive", true);

      const undercoverAlive = (aliveRoles ?? []).filter(
        (p) => p.role === "undercover"
      ).length;
      const civilianAlive = (aliveRoles ?? []).filter(
        (p) => p.role === "civilian"
      ).length;
      const mrwhiteAlive = (aliveRoles ?? []).filter(
        (p) => p.role === "mrwhite"
      ).length;

      if (civilianAlive === 0 && undercoverAlive > 0 && mrwhiteAlive > 0) {
        await supabase
          .from("rooms")
          .update({ status: "ended_undercover_mrwhite" })
          .eq("id", room.id);
        await supabase
          .from("rounds")
          .update({ phase: "result", eliminated_player_id: winnerId })
          .eq("id", round.id);
        return NextResponse.json({ ok: true });
      }

      if (undercoverAlive === 0 && civilianAlive === 1 && mrwhiteAlive === 1) {
        const { data: mrwhitePlayer } = await supabase
          .from("players")
          .select("id")
          .eq("room_id", room.id)
          .eq("is_alive", true)
          .eq("role", "mrwhite")
          .limit(1)
          .maybeSingle();

        const mrwhiteId = mrwhitePlayer?.id;
        if (mrwhiteId) {
          await supabase
            .from("rounds")
            .update({ phase: "mrwhite_guess", eliminated_player_id: mrwhiteId })
            .eq("id", round.id);
          return NextResponse.json({ ok: true });
        }
      }

      if (undercoverAlive > 0 && civilianAlive === undercoverAlive) {
        await supabase
          .from("rooms")
          .update({ status: "ended_undercover" })
          .eq("id", room.id);
        await supabase
          .from("rounds")
          .update({ phase: "result", eliminated_player_id: winnerId })
          .eq("id", round.id);
        return NextResponse.json({ ok: true });
      }

      if (eliminatedPlayer?.role === "mrwhite") {
        await supabase
          .from("rounds")
          .update({ phase: "mrwhite_guess", eliminated_player_id: winnerId })
          .eq("id", round.id);
        return NextResponse.json({ ok: true });
      }

      if (undercoverAlive === 0 && mrwhiteAlive === 0) {
        await supabase
          .from("rooms")
          .update({ status: "ended_civilian" })
          .eq("id", room.id);
        await supabase
          .from("rounds")
          .update({ phase: "result", eliminated_player_id: winnerId })
          .eq("id", round.id);
        return NextResponse.json({ ok: true });
      }

      await supabase
        .from("rounds")
        .update({ phase: "result", eliminated_player_id: winnerId })
        .eq("id", round.id);
    } else {
      await supabase.from("rounds").update({ phase: "result" }).eq("id", round.id);
    }
  }

  return NextResponse.json({ ok: true });
}
