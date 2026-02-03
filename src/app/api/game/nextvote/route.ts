import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GUEST_ID_COOKIE } from "@/lib/cookies";
import { maybeHandoverHost } from "@/lib/hostHandover";

type NextVoteBody = {
  code?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as NextVoteBody;
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
    .select("id, status, host_guest_id")
    .eq("code", code)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "ROOM_NOT_FOUND" }, { status: 404 });
  }

  if (room.status !== "in_game") {
    return NextResponse.json({ error: "ROOM_NOT_IN_GAME" }, { status: 409 });
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

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .select("id, phase")
    .eq("room_id", room.id)
    .order("round_number", { ascending: false })
    .limit(1)
    .single();

  if (roundError || !round) {
    return NextResponse.json({ error: "ROUND_NOT_FOUND" }, { status: 404 });
  }

  if (round.phase !== "result") {
    return NextResponse.json({ error: "NOT_IN_RESULT" }, { status: 409 });
  }

  await supabase.from("votes").delete().eq("room_id", room.id).eq("round_id", round.id);

  await supabase.from("rounds").update({ phase: "describe", eliminated_player_id: null }).eq("id", round.id);

  return NextResponse.json({ ok: true });
}
