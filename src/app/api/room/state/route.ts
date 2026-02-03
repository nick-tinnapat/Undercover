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
    .select("id, code, status, host_guest_id")
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
    .select("id, is_host")
    .eq("room_id", room.id)
    .eq("guest_id", guestId)
    .single();

  if (!me) {
    return NextResponse.json({ error: "NOT_IN_ROOM" }, { status: 403 });
  }

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, name, is_host, is_alive")
    .eq("room_id", room.id)
    .order("created_at", { ascending: true });

  if (playersError || !players) {
    return NextResponse.json({ error: "PLAYERS_LOAD_FAILED" }, { status: 500 });
  }

  return NextResponse.json({
    room: {
      id: room.id,
      code: room.code,
      status: room.status,
    },
    me: {
      playerId: me.id,
      isHost: me.is_host,
    },
    players,
  });
}
