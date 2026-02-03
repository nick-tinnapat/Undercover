import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { setGuestCookies } from "@/lib/cookies";

type JoinRoomBody = {
  name?: string;
  code?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as JoinRoomBody;
  const name = (body.name ?? "").trim();
  const code = (body.code ?? "").trim().toUpperCase();

  if (!name) {
    return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });
  }
  if (!code || code.length !== 6) {
    return NextResponse.json({ error: "CODE_INVALID" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, code, status")
    .eq("code", code)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "ROOM_NOT_FOUND" }, { status: 404 });
  }

  if (room.status !== "lobby") {
    return NextResponse.json({ error: "ROOM_NOT_JOINABLE" }, { status: 409 });
  }

  const guestId = randomUUID();

  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert({
      room_id: room.id,
      guest_id: guestId,
      name,
      is_host: false,
      is_alive: true,
    })
    .select("id")
    .single();

  if (playerError || !player) {
    return NextResponse.json({ error: "JOIN_FAILED" }, { status: 500 });
  }

  const res = NextResponse.json({
    roomCode: room.code,
    roomId: room.id,
    guestId,
    playerId: player.id,
  });

  setGuestCookies(res, { roomCode: room.code, guestId });

  return res;
}
