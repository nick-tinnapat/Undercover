import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GUEST_ID_COOKIE } from "@/lib/cookies";
import { maybeHandoverHost } from "@/lib/hostHandover";

type ResetBody = {
  code?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as ResetBody;
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
    .select("id, host_guest_id")
    .eq("code", code)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "ROOM_NOT_FOUND" }, { status: 404 });
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

  await supabase.from("votes").delete().eq("room_id", room.id);
  await supabase.from("readies").delete().eq("room_id", room.id);
  await supabase.from("rounds").delete().eq("room_id", room.id);

  await supabase
    .from("players")
    .update({ is_alive: true, role: null, word: null })
    .eq("room_id", room.id);

  await supabase.from("rooms").update({ status: "lobby" }).eq("id", room.id);

  return NextResponse.json({ ok: true });
}
