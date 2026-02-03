import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GUEST_ID_COOKIE } from "@/lib/cookies";

type GuessBody = {
  code?: string;
  guess?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as GuessBody;
  const code = (body.code ?? "").trim().toUpperCase();
  const guess = (body.guess ?? "").trim();

  const cookieStore = await cookies();
  const guestId = cookieStore.get(GUEST_ID_COOKIE)?.value ?? "";

  if (!code || code.length !== 6) {
    return NextResponse.json({ error: "CODE_INVALID" }, { status: 400 });
  }
  if (!guestId) {
    return NextResponse.json({ error: "GUEST_REQUIRED" }, { status: 401 });
  }
  if (!guess) {
    return NextResponse.json({ error: "GUESS_REQUIRED" }, { status: 400 });
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

  if (room.status !== "in_game") {
    return NextResponse.json({ error: "ROOM_NOT_IN_GAME" }, { status: 409 });
  }

  const { data: round, error: roundError } = await supabase
    .from("rounds")
    .select("id, phase, eliminated_player_id")
    .eq("room_id", room.id)
    .order("round_number", { ascending: false })
    .limit(1)
    .single();

  if (roundError || !round) {
    return NextResponse.json({ error: "ROUND_NOT_FOUND" }, { status: 404 });
  }

  if (round.phase !== "mrwhite_guess") {
    return NextResponse.json({ error: "NOT_IN_MRWHITE_GUESS" }, { status: 409 });
  }

  const eliminatedId = ((round as any).eliminated_player_id as string | null | undefined) ?? null;
  if (!eliminatedId) {
    return NextResponse.json({ error: "NO_ELIMINATED" }, { status: 409 });
  }

  const { data: me } = await supabase
    .from("players")
    .select("id, role")
    .eq("room_id", room.id)
    .eq("guest_id", guestId)
    .single();

  if (!me) {
    return NextResponse.json({ error: "NOT_IN_ROOM" }, { status: 403 });
  }

  if (me.id !== eliminatedId) {
    return NextResponse.json({ error: "ELIMINATED_MRWHITE_ONLY" }, { status: 403 });
  }

  if (me.role !== "mrwhite") {
    return NextResponse.json({ error: "NOT_MRWHITE" }, { status: 403 });
  }

  const { data: anyCivilian } = await supabase
    .from("players")
    .select("word")
    .eq("room_id", room.id)
    .eq("is_alive", true)
    .eq("role", "civilian")
    .limit(1)
    .maybeSingle();

  const correctWord = (anyCivilian?.word ?? "").trim();
  if (!correctWord) {
    return NextResponse.json({ error: "CIVILIAN_WORD_NOT_FOUND" }, { status: 409 });
  }

  const normalize = (s: string) => s.trim().toLowerCase();
  const isCorrect = normalize(guess) === normalize(correctWord);

  if (isCorrect) {
    await supabase.from("rooms").update({ status: "ended_mrwhite" }).eq("id", room.id);
    await supabase
      .from("rounds")
      .update({ phase: "result" })
      .eq("id", round.id);
    return NextResponse.json({ ok: true, correct: true });
  }

  const { data: aliveRoles } = await supabase
    .from("players")
    .select("role")
    .eq("room_id", room.id)
    .eq("is_alive", true);

  const undercoverAlive = (aliveRoles ?? []).filter(
    (p) => p.role === "undercover"
  ).length;
  if (undercoverAlive === 0) {
    await supabase.from("rooms").update({ status: "ended_civilian" }).eq("id", room.id);
    return NextResponse.json({ ok: true, correct: false });
  }

  await supabase.from("rounds").update({ phase: "result" }).eq("id", round.id);
  return NextResponse.json({ ok: true, correct: false });
}
