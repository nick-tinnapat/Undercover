import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GUEST_ID_COOKIE } from "@/lib/cookies";
import { maybeHandoverHost } from "@/lib/hostHandover";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = (url.searchParams.get("code") ?? "").trim().toUpperCase();
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
    .select("id, code, status, host_guest_id, undercover_count, mrwhite_count")
    .eq("code", code)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "ROOM_NOT_FOUND" }, { status: 404 });
  }

  await supabase
    .from("players")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("room_id", room.id)
    .eq("guest_id", guestId);

  await maybeHandoverHost({
    supabase,
    roomId: room.id,
    currentHostGuestId: room.host_guest_id,
  });

  const { data: me } = await supabase
    .from("players")
    .select("id, is_host, is_alive, name, guest_id")
    .eq("room_id", room.id)
    .eq("guest_id", guestId)
    .single();

  if (!me) {
    return NextResponse.json({ error: "NOT_IN_ROOM" }, { status: 403 });
  }

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .select("*")
    .eq("room_id", room.id)
    .order("round_number", { ascending: false })
    .limit(1)
    .single();

  if (roundError || !round) {
    if (room.status === "lobby") {
      const { data: players } = await supabase
        .from("players")
        .select("id, name, is_host, is_alive, guest_id")
        .eq("room_id", room.id)
        .order("created_at", { ascending: true });

      const playerList = (players ?? []).map((p) => ({
        id: p.id,
        guestId: p.guest_id,
        name: p.name,
        isHost: p.is_host,
        isAlive: p.is_alive,
        isReady: false,
      }));

      const { count: aliveCount } = await supabase
        .from("players")
        .select("id", { count: "exact", head: true })
        .eq("room_id", room.id)
        .eq("is_alive", true);

      return NextResponse.json({
        room: {
          id: room.id,
          code: room.code,
          status: room.status,
          config: {
            undercover: Number(room.undercover_count ?? 0),
            mrwhite: Number(room.mrwhite_count ?? 0),
            civilian: Math.max(
              0,
              (aliveCount ?? 0) -
                Number(room.undercover_count ?? 0) -
                Number(room.mrwhite_count ?? 0)
            ),
          },
        },
        me: {
          playerId: me.id,
          guestId: me.guest_id,
          name: me.name,
          isHost: me.is_host,
          isAlive: me.is_alive,
        },
        round: { id: "", roundNumber: 0, phase: "assign", eliminatedPlayerId: null },
        counts: { alive: aliveCount ?? 0, ready: 0 },
        flags: { meReady: false },
        voting: { votes: 0, meVoted: false, eliminated: null },
        players: playerList,
      });
    }

    return NextResponse.json({ error: "ROUND_NOT_FOUND" }, { status: 404 });
  }

  if (round.phase === "reveal") {
    await supabase.from("rounds").update({ phase: "describe" }).eq("id", round.id);
    (round as any).phase = "describe";
  }

  const { count: aliveCount } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id)
    .eq("is_alive", true);

  const { data: readyRows } = await supabase
    .from("readies")
    .select("guest_id")
    .eq("room_id", room.id)
    .eq("round_id", round.id);

  const readyGuestIds = new Set((readyRows ?? []).map((r) => r.guest_id));

  const { data: players } = await supabase
    .from("players")
    .select("id, name, is_host, is_alive, guest_id")
    .eq("room_id", room.id)
    .order("created_at", { ascending: true });

  const playerList = (players ?? []).map((p) => ({
      id: p.id,
      guestId: p.guest_id,
      name: p.name,
      isHost: p.is_host,
      isAlive: p.is_alive,
      isReady: readyGuestIds.has(p.guest_id),
    }));

  const { data: meReadyRow } = await supabase
    .from("readies")
    .select("id")
    .eq("room_id", room.id)
    .eq("round_id", round.id)
    .eq("guest_id", guestId)
    .maybeSingle();

  const { count: voteCount } = await supabase
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id)
    .eq("round_id", round.id);

  const { data: myVote } = await supabase
    .from("votes")
    .select("id")
    .eq("room_id", room.id)
    .eq("round_id", round.id)
    .eq("voter_guest_id", guestId)
    .maybeSingle();

  const eliminatedId =
    ((round as any).eliminated_player_id as string | null | undefined) ?? null;
  const eliminated = eliminatedId
    ? playerList.find((p) => p.id === eliminatedId) ?? null
    : null;

  const readyAliveCount = playerList.filter(
    (p) => p.isAlive && readyGuestIds.has(p.guestId)
  ).length;

  return NextResponse.json({
    room: {
      id: room.id,
      code: room.code,
      status: room.status,
      config: {
        undercover: Number(room.undercover_count ?? 0),
        mrwhite: Number(room.mrwhite_count ?? 0),
        civilian: Math.max(
          0,
          (aliveCount ?? 0) -
            Number(room.undercover_count ?? 0) -
            Number(room.mrwhite_count ?? 0)
        ),
      },
    },
    me: {
      playerId: me.id,
      guestId: me.guest_id,
      name: me.name,
      isHost: me.is_host,
      isAlive: me.is_alive,
    },
    round: {
      id: round.id,
      roundNumber: round.round_number,
      phase: round.phase,
      eliminatedPlayerId: eliminatedId,
    },
    counts: { alive: aliveCount ?? 0, ready: readyAliveCount },
    flags: { meReady: Boolean(meReadyRow) },
    voting: {
      votes: voteCount ?? 0,
      meVoted: Boolean(myVote),
      eliminated,
    },
    players: playerList,
  });
}
