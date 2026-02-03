"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";

type RoomState = {
  room: { id: string; code: string; status: string };
  me: { playerId: string; isHost: boolean };
  players: Array<{ id: string; name: string; is_host: boolean; is_alive: boolean }>;
};

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = useMemo(
    () => (params.code ?? "").toUpperCase(),
    [params.code]
  );

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function load() {
    setError(null);
    const res = await fetch(`/api/room/state?code=${encodeURIComponent(code)}`, {
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      const err = json?.error ?? "LOAD_FAILED";
      if (err === "GUEST_REQUIRED" || err === "NOT_IN_ROOM") {
        router.replace("/");
        return;
      }
      setError(err);
      setState(null);
      setLoading(false);
      return;
    }

    setState(json as RoomState);
    setLoading(false);

    if ((json as RoomState).room.status === "in_game") {
      router.replace(`/game/${code}`);
    }
  }

  async function resetGame() {
    setResetting(true);
    setError(null);
    const res = await fetch("/api/game/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      setResetting(false);
      setError(json?.error ?? "RESET_FAILED");
      return;
    }
    setResetting(false);
    await load();
  }

  async function leaveRoom() {
    setLeaving(true);
    await fetch(`/api/room/leave?code=${encodeURIComponent(code)}`, {
      method: "POST",
    });
    router.replace("/");
  }

  async function endRoom() {
    setLeaving(true);
    await fetch(`/api/room/end?code=${encodeURIComponent(code)}`, {
      method: "POST",
    });
    router.replace("/");
  }

  useEffect(() => {
    let alive = true;
    void load();

    const t = setInterval(() => {
      if (!alive) return;
      void load();
    }, 1200);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [code]);

  useEffect(() => {
    if (!code) return;
    const t = setInterval(() => {
      void fetch("/api/heartbeat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
    }, 10000);
    return () => clearInterval(t);
  }, [code]);

  async function startGame() {
    setStarting(true);
    setError(null);

    const res = await fetch("/api/game/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });

    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      setStarting(false);
      setError(json?.error ?? "START_FAILED");
      return;
    }

    router.replace(`/game/${code}`);
  }

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
          className="mb-6"
        >
          <div className="text-sm text-zinc-400">ROOM</div>
          <div className="text-4xl font-semibold tracking-widest text-zinc-50">
            {code}
          </div>
          <div className="mt-2 text-zinc-400">
            Waiting for players. Minimum 3 to start.
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              variant="bordered"
              className="border-white/15 text-zinc-200"
              isLoading={leaving}
              onPress={leaveRoom}
            >
              Leave
            </Button>
            {state?.me?.isHost ? (
              <Button
                size="sm"
                color="danger"
                variant="bordered"
                isLoading={leaving}
                onPress={endRoom}
              >
                End Room
              </Button>
            ) : null}
          </div>
        </motion.div>

        <Card className="bg-white/5 backdrop-blur-md border border-white/10">
          <CardHeader className="flex items-center justify-between">
            <div className="text-zinc-50 font-medium">Players</div>
            {loading ? <Spinner size="sm" /> : null}
          </CardHeader>
          <CardBody className="space-y-3">
            {error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            {state?.players?.length ? (
              <div className="grid grid-cols-1 gap-3">
                {state.players.map((p) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <div className="text-zinc-100">{p.name}</div>
                    {p.is_host ? (
                      <div className="rounded-full bg-purple-500/20 px-3 py-1 text-xs text-purple-200">
                        HOST
                      </div>
                    ) : null}
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-zinc-400 text-sm">No players yet.</div>
            )}

            <div className="pt-2">
              {state?.me?.isHost ? (
                state?.room.status?.startsWith("ended_") ? (
                  <Button
                    color="primary"
                    className="w-full"
                    isLoading={resetting}
                    onPress={resetGame}
                  >
                    New Game
                  </Button>
                ) : (
                  <Button
                    color="primary"
                    className="w-full"
                    isDisabled={(state?.players?.length ?? 0) < 3}
                    isLoading={starting}
                    onPress={startGame}
                  >
                    Start Game
                  </Button>
                )
              ) : (
                <div className="mt-2 text-center text-xs text-zinc-500">
                  Only host can start.
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
