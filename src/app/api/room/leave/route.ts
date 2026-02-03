import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GUEST_ID_COOKIE, ROOM_CODE_COOKIE } from "@/lib/cookies";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const code = (url.searchParams.get("code") ?? "").trim().toUpperCase();

  const cookieStore = await cookies();
  const guestId = cookieStore.get(GUEST_ID_COOKIE)?.value ?? "";
  const roomCookie = cookieStore.get(ROOM_CODE_COOKIE)?.value ?? "";

  if (!guestId) {
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(GUEST_ID_COOKIE);
    res.cookies.delete(ROOM_CODE_COOKIE);
    return res;
  }

  if (!code || code.length !== 6) {
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(GUEST_ID_COOKIE);
    res.cookies.delete(ROOM_CODE_COOKIE);
    return res;
  }

  const supabase = createSupabaseAdminClient();

  const { data: room } = await supabase
    .from("rooms")
    .select("id, host_guest_id")
    .eq("code", code)
    .maybeSingle();

  if (room) {
    await supabase
      .from("players")
      .delete()
      .eq("room_id", room.id)
      .eq("guest_id", guestId);

    const { count: remaining } = await supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id);

    if ((remaining ?? 0) === 0) {
      await supabase.from("rooms").delete().eq("id", room.id);
    }
  }

  const res = NextResponse.json({ ok: true, cleared: true, previousRoom: roomCookie });
  res.cookies.delete(GUEST_ID_COOKIE);
  res.cookies.delete(ROOM_CODE_COOKIE);
  return res;
}
