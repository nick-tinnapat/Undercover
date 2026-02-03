import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GUEST_ID_COOKIE } from "@/lib/cookies";

type UnreadyBody = {
  code?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as UnreadyBody;
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
    .select("id")
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

  const { error: delError } = await supabase
    .from("readies")
    .delete()
    .eq("room_id", room.id)
    .eq("round_id", round.id)
    .eq("guest_id", guestId);

  if (delError) {
    return NextResponse.json({ error: "UNREADY_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
