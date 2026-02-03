import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GUEST_ID_COOKIE } from "@/lib/cookies";

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
    .select("id, status")
    .eq("code", code)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "ROOM_NOT_FOUND" }, { status: 404 });
  }

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id, role, word, is_alive")
    .eq("room_id", room.id)
    .eq("guest_id", guestId)
    .single();

  if (playerError || !player) {
    return NextResponse.json({ error: "NOT_IN_ROOM" }, { status: 403 });
  }

  if (!player.is_alive) {
    return NextResponse.json({ error: "ELIMINATED" }, { status: 403 });
  }

  if (!player.role) {
    return NextResponse.json({ error: "NOT_ASSIGNED" }, { status: 409 });
  }

  if (player.role !== "mrwhite" && !player.word) {
    return NextResponse.json({ error: "NOT_ASSIGNED" }, { status: 409 });
  }

  return NextResponse.json({
    playerId: player.id,
    role: player.role,
    word: player.word,
  });
}
