"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";

export default function Home() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const normalizedCode = useMemo(() => code.trim().toUpperCase(), [code]);

  async function createRoom() {
    setError(null);
    setLoading("create");

    const res = await fetch("/api/room/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });

    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      setLoading(null);
      setError(json?.error ?? "CREATE_FAILED");
      return;
    }

    router.push(`/room/${json.roomCode}`);
  }

  async function joinRoom() {
    setError(null);
    setLoading("join");

    const res = await fetch("/api/room/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, code: normalizedCode }),
    });

    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      setLoading(null);
      setError(json?.error ?? "JOIN_FAILED");
      return;
    }

    router.push(`/room/${json.roomCode}`);
  }

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="mx-auto w-full max-w-xl">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
          className="mb-8"
        >
          <div className="text-sm text-zinc-400">UNDERCOVER</div>
          <div className="mt-1 text-5xl font-semibold tracking-tight text-zinc-50">
            Find the liar.
          </div>
          <div className="mt-3 text-zinc-400">
            Premium party game. No login. Server-driven secrets.
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 140, damping: 16 }}
        >
          <Card className="bg-white/5 backdrop-blur-md border border-white/10">
            <CardHeader>
              <div className="text-zinc-50 font-medium">Create / Join Room</div>
            </CardHeader>
            <CardBody className="space-y-4">
              {error ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <Input
                label="Player name"
                value={name}
                onValueChange={setName}
                isRequired
                variant="bordered"
              />

              <Input
                label="Room code (for join)"
                value={code}
                onValueChange={setCode}
                variant="bordered"
                maxLength={6}
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button
                  color="primary"
                  className="w-full"
                  isLoading={loading === "create"}
                  onPress={createRoom}
                  isDisabled={!name.trim() || loading !== null}
                >
                  Create Room
                </Button>
                <Button
                  className="w-full"
                  variant="bordered"
                  isLoading={loading === "join"}
                  onPress={joinRoom}
                  isDisabled={!name.trim() || normalizedCode.length !== 6 || loading !== null}
                >
                  Join Room
                </Button>
              </div>

              <div className="text-xs text-zinc-500">
                Minimum 3 players.
              </div>
            </CardBody>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
