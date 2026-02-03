import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GUEST_ID_COOKIE } from "@/lib/cookies";

type ReadyBody = {
  code?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as ReadyBody;
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
    .select("id, status")
    .eq("code", code)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: "ROOM_NOT_FOUND" }, { status: 404 });
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

  if (round.phase !== "reveal") {
    return NextResponse.json({ error: "NOT_IN_REVEAL" }, { status: 409 });
  }

  const { data: player } = await supabase
    .from("players")
    .select("id, is_alive")
    .eq("room_id", room.id)
    .eq("guest_id", guestId)
    .single();

  if (!player) {
    return NextResponse.json({ error: "NOT_IN_ROOM" }, { status: 403 });
  }

  if (!player.is_alive) {
    return NextResponse.json({ error: "ELIMINATED" }, { status: 403 });
  }

  const { error: readyError } = await supabase.from("readies").insert({
    room_id: room.id,
    round_id: round.id,
    guest_id: guestId,
  });

  if (readyError && readyError.code !== "23505") {
    return NextResponse.json({ error: "READY_FAILED" }, { status: 500 });
  }

  const { count: aliveCount } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id)
    .eq("is_alive", true);

  const { count: readyCount } = await supabase
    .from("readies")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id)
    .eq("round_id", round.id);

  if ((aliveCount ?? 0) > 0 && (readyCount ?? 0) >= (aliveCount ?? 0)) {
    await supabase
      .from("rounds")
      .update({ phase: "describe" })
      .eq("id", round.id);
  }

  return NextResponse.json({ ok: true });
}
