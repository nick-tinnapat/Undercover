import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GUEST_ID_COOKIE } from "@/lib/cookies";
import { maybeHandoverHost } from "@/lib/hostHandover";

type StartBody = {
  code?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as StartBody;
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
    .select("id, code, status, host_guest_id")
    .eq("code", code)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "ROOM_NOT_FOUND" }, { status: 404 });
  }

  if (room.status !== "lobby") {
    return NextResponse.json({ error: "ROOM_NOT_STARTABLE" }, { status: 409 });
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

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id")
    .eq("room_id", room.id);

  if (playersError || !players) {
    return NextResponse.json({ error: "PLAYERS_LOAD_FAILED" }, { status: 500 });
  }

  if (players.length < 3) {
    return NextResponse.json({ error: "MIN_PLAYERS_3" }, { status: 400 });
  }

  const { error: roomUpdateError } = await supabase
    .from("rooms")
    .update({ status: "in_game" })
    .eq("id", room.id);

  if (roomUpdateError) {
    return NextResponse.json({ error: "START_FAILED" }, { status: 500 });
  }

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .insert({ room_id: room.id, round_number: 1, phase: "assign" })
    .select("id")
    .single();

  if (roundError || !round) {
    return NextResponse.json({ error: "ROUND_CREATE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, roomCode: room.code, roundId: round.id });
}
