import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GUEST_ID_COOKIE, ROOM_CODE_COOKIE } from "@/lib/cookies";

export async function POST(req: Request) {
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
    .select("id, host_guest_id")
    .eq("code", code)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "ROOM_NOT_FOUND" }, { status: 404 });
  }

  if (room.host_guest_id !== guestId) {
    return NextResponse.json({ error: "HOST_ONLY" }, { status: 403 });
  }

  await supabase.from("rooms").delete().eq("id", room.id);

  const res = NextResponse.json({ ok: true, ended: true });
  res.cookies.delete(GUEST_ID_COOKIE);
  res.cookies.delete(ROOM_CODE_COOKIE);
  return res;
}
