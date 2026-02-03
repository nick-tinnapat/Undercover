import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GUEST_ID_COOKIE } from "@/lib/cookies";

type ConfigBody = {
  code?: string;
  undercoverCount?: number;
  mrwhiteCount?: number;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as ConfigBody;
  const code = (body.code ?? "").trim().toUpperCase();
  const undercoverCount = Number(body.undercoverCount ?? 0);
  const mrwhiteCount = Number(body.mrwhiteCount ?? 0);

  const cookieStore = await cookies();
  const guestId = cookieStore.get(GUEST_ID_COOKIE)?.value ?? "";

  if (!code || code.length !== 6) {
    return NextResponse.json({ error: "CODE_INVALID" }, { status: 400 });
  }
  if (!guestId) {
    return NextResponse.json({ error: "GUEST_REQUIRED" }, { status: 401 });
  }

  if (!Number.isFinite(undercoverCount) || undercoverCount < 0) {
    return NextResponse.json({ error: "UNDERCOVER_COUNT_INVALID" }, { status: 400 });
  }
  if (!Number.isFinite(mrwhiteCount) || mrwhiteCount < 0) {
    return NextResponse.json({ error: "MRWHITE_COUNT_INVALID" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, host_guest_id, status")
    .eq("code", code)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "ROOM_NOT_FOUND" }, { status: 404 });
  }

  if (room.host_guest_id !== guestId) {
    return NextResponse.json({ error: "HOST_ONLY" }, { status: 403 });
  }

  if (room.status !== "lobby" && room.status !== "in_game") {
    return NextResponse.json({ error: "ROOM_NOT_CONFIGURABLE" }, { status: 409 });
  }

  const { count: playerCount } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id)
    .eq("is_alive", true);

  const total = undercoverCount + mrwhiteCount;
  if ((playerCount ?? 0) <= 0) {
    return NextResponse.json({ error: "NO_PLAYERS" }, { status: 400 });
  }

  if (total >= (playerCount ?? 0)) {
    return NextResponse.json({ error: "ROLE_COUNTS_TOO_HIGH" }, { status: 400 });
  }

  const { error: updError } = await supabase
    .from("rooms")
    .update({ undercover_count: undercoverCount, mrwhite_count: mrwhiteCount })
    .eq("id", room.id);

  if (updError) {
    return NextResponse.json({ error: "CONFIG_UPDATE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
