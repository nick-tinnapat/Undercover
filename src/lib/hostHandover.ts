import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_TIMEOUT_SECONDS = 30;

export async function maybeHandoverHost(params: {
  supabase: SupabaseClient;
  roomId: string;
  currentHostGuestId: string;
  timeoutSeconds?: number;
}) {
  const timeoutSeconds =
    params.timeoutSeconds ??
    (process.env.HOST_TIMEOUT_SECONDS
      ? Number(process.env.HOST_TIMEOUT_SECONDS)
      : DEFAULT_TIMEOUT_SECONDS);

  const { data: hostPlayer } = await params.supabase
    .from("players")
    .select("id, guest_id, last_seen_at, is_alive")
    .eq("room_id", params.roomId)
    .eq("guest_id", params.currentHostGuestId)
    .maybeSingle();

  const now = Date.now();
  const hostLastSeen = hostPlayer?.last_seen_at
    ? new Date(hostPlayer.last_seen_at).getTime()
    : 0;

  const hostIsStale =
    !hostPlayer ||
    !hostPlayer.is_alive ||
    !hostLastSeen ||
    now - hostLastSeen > timeoutSeconds * 1000;

  if (!hostIsStale) {
    return { changed: false } as const;
  }

  const { data: candidate } = await params.supabase
    .from("players")
    .select("guest_id")
    .eq("room_id", params.roomId)
    .eq("is_alive", true)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const newHostGuestId = candidate?.guest_id;
  if (!newHostGuestId) {
    return { changed: false } as const;
  }

  if (newHostGuestId === params.currentHostGuestId) {
    return { changed: false } as const;
  }

  await params.supabase
    .from("rooms")
    .update({ host_guest_id: newHostGuestId })
    .eq("id", params.roomId);

  await params.supabase.from("players").update({ is_host: false }).eq("room_id", params.roomId);

  await params.supabase
    .from("players")
    .update({ is_host: true })
    .eq("room_id", params.roomId)
    .eq("guest_id", newHostGuestId);

  return { changed: true, newHostGuestId } as const;
}
