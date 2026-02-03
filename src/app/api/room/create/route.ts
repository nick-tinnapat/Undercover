import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateRoomCode } from "@/lib/roomCode";
import { setGuestCookies } from "@/lib/cookies";

type CreateRoomBody = {
  name?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as CreateRoomBody;
  const name = (body.name ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const guestId = randomUUID();

  // Generate unique room code (retry a few times on collisions)
  let code = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    code = generateRoomCode(6);

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({ code, host_guest_id: guestId, status: "lobby" })
      .select("id, code")
      .single();

    if (!roomError && room) {
      const { data: player, error: playerError } = await supabase
        .from("players")
        .insert({
          room_id: room.id,
          guest_id: guestId,
          name,
          is_host: true,
          is_alive: true,
        })
        .select("id")
        .single();

      if (playerError || !player) {
        return NextResponse.json(
          { error: "PLAYER_CREATE_FAILED" },
          { status: 500 }
        );
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

    // If code collision, retry. Otherwise fail.
    if (roomError && roomError.code === "23505") {
      continue;
    }

    return NextResponse.json({ error: "ROOM_CREATE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ error: "ROOM_CODE_EXHAUSTED" }, { status: 500 });
}
