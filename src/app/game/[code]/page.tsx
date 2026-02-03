"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";

type GameState = {
  room: {
    id: string;
    code: string;
    status: string;
    config?: { undercover: number; mrwhite: number; civilian: number };
  };
  me: {
    playerId: string;
    guestId: string;
    name: string;
    isHost: boolean;
    isAlive: boolean;
  };
  round: {
    id: string;
    roundNumber: number;
    phase: string;
    eliminatedPlayerId?: string | null;
  };
  counts: { alive: number; ready: number };
  flags?: { meReady?: boolean };
  voting?: {
    votes: number;
    meVoted: boolean;
    eliminated:
      | null
      | {
          id: string;
          name: string;
          role?: string | null;
          isHost: boolean;
          isAlive: boolean;
          isReady: boolean;
          guestId: string;
        };
    tied?: boolean;
  };
  players?: Array<{
    id: string;
    guestId: string;
    name: string;
    isHost: boolean;
    isAlive: boolean;
    isReady: boolean;
  }>;
};

type Secret = {
  playerId: string;
  role: string;
  word: string;
};

export default function GamePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = useMemo(
    () => (params.code ?? "").toUpperCase(),
    [params.code]
  );

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<GameState | null>(null);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [assigning, setAssigning] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [votingFor, setVotingFor] = useState<string>("");
  const [voting, setVoting] = useState(false);
  const [mrwhiteGuess, setMrwhiteGuess] = useState("");
  const [guessing, setGuessing] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [showWinner, setShowWinner] = useState(false);

  async function loadState() {
    const res = await fetch(`/api/game/state?code=${encodeURIComponent(code)}`, {
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

    setState(json as GameState);
    setLoading(false);
    setError(null);

    if ((json as GameState).room.status === "lobby") {
      router.replace(`/room/${code}`);
    }
  }

  useEffect(() => {
    let alive = true;
    void loadState();
    const t = setInterval(() => {
      if (!alive) return;
      void loadState();
    }, 1200);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [code]);

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

  async function assignRoles() {
    setAssigning(true);
    setError(null);
    const res = await fetch("/api/game/assign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });

    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      setAssigning(false);
      setError(json?.error ?? "ASSIGN_FAILED");
      return;
    }

    setAssigning(false);
    await loadState();
  }

  async function submitVote() {
    if (!votingFor) return;
    setVoting(true);
    setError(null);
    const res = await fetch("/api/game/vote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, targetPlayerId: votingFor }),
    });
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      setVoting(false);
      setError(json?.error ?? "VOTE_FAILED");
      return;
    }
    setVoting(false);
    await loadState();
  }

  function RoleIcon({ kind }: { kind: "civilian" | "undercover" | "mrwhite" }) {
    if (kind === "civilian") {
      return (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-emerald-200"
        >
          <path
            d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5Z"
            fill="currentColor"
          />
        </svg>
      );
    }
    if (kind === "undercover") {
      return (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-purple-200"
        >
          <path
            d="M3 11.5c2.6-4.2 6.3-6.3 9-6.3s6.4 2.1 9 6.3c-2.6 4.2-6.3 6.3-9 6.3s-6.4-2.1-9-6.3Zm9 4.2a4.2 4.2 0 1 0-4.2-4.2 4.2 4.2 0 0 0 4.2 4.2Z"
            fill="currentColor"
          />
        </svg>
      );
    }
    return (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-zinc-200"
      >
        <path
          d="M12 2a7 7 0 0 0-7 7v3.6l-1.3 2.6A1.5 1.5 0 0 0 5 18h14a1.5 1.5 0 0 0 1.3-2.2L19 12.6V9a7 7 0 0 0-7-7Zm0 20a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  function CountTile(params: {
    title: string;
    subtitle: string;
    kind: "civilian" | "undercover" | "mrwhite";
    value: number;
    right?: React.ReactNode;
  }) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30">
              <RoleIcon kind={params.kind} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-zinc-50">
                {params.title}
              </div>
              <div className="truncate text-xs text-zinc-500">
                {params.subtitle}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <div className="text-2xl font-semibold text-zinc-50 tabular-nums">
              {params.value}
            </div>
            <div className="shrink-0">{params.right ?? null}</div>
          </div>
        </div>
      </div>
    );
  }

  async function revealSecret() {
    if (secret) {
      setShowHint((v) => !v);
      return;
    }

    setRevealing(true);
    setError(null);
    const res = await fetch(`/api/game/secret?code=${encodeURIComponent(code)}`);
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      setRevealing(false);
      setError(json?.error ?? "REVEAL_FAILED");
      return;
    }
    setSecret(json as Secret);
    setShowHint(true);
    setRevealing(false);
  }

  const phase = state?.round.phase ?? "unknown";
  const alive = state?.counts.alive ?? 0;
  const players = state?.players ?? [];
  const alivePlayers = players.filter((p) => p.isAlive);
  const myName = state?.me.name ?? "";
  const myGuestId = state?.me.guestId ?? "";

  const votesCast = state?.voting?.votes ?? 0;
  const meVoted = Boolean(state?.voting?.meVoted);
  const eliminated = state?.voting?.eliminated ?? null;
  const voteEligibleCount =
    phase === "result" && eliminated ? alive + 1 : alive;

  const roomStatus = state?.room.status ?? "";
  const gameEnded = roomStatus.startsWith("ended_");
  const hintAvailable = phase !== "assign";

  const lastConfettiKeyRef = useRef<string>("");
  const starterByRoundRef = useRef<Record<string, string>>({});
  const tieAdvanceKeyRef = useRef<string>("");
  const tiePopupDismissedKeyRef = useRef<string>("");
  const [activeTiePopupKey, setActiveTiePopupKey] = useState<string>("");

  const handleConfetti = () => {
    confetti({
      particleCount: 120,
      spread: 70,
      startVelocity: 35,
      ticks: 260,
      gravity: 0.9,
      scalar: 1,
      origin: { y: 0.65 },
      colors: ["#a78bfa", "#34d399", "#ffffff", "#fbbf24"],
    });

    confetti({
      particleCount: 70,
      spread: 120,
      startVelocity: 45,
      ticks: 200,
      gravity: 1.1,
      scalar: 0.9,
      origin: { y: 0.6 },
      colors: ["#a78bfa", "#34d399", "#ffffff"],
    });
  };

  useEffect(() => {
    if (gameEnded) setShowWinner(true);
  }, [gameEnded]);

  useEffect(() => {
    if (!gameEnded) {
      lastConfettiKeyRef.current = "";
      return;
    }

    const key = `${state?.round.id ?? ""}:${roomStatus}`;
    if (!key || lastConfettiKeyRef.current === key) return;
    lastConfettiKeyRef.current = key;
    handleConfetti();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameEnded, roomStatus, state?.round.id]);

  useEffect(() => {
    const roundId = state?.round.id ?? "";
    if (!roundId) return;
    if (starterByRoundRef.current[roundId]) return;
    if (!alivePlayers.length) return;
    const idx = Math.floor(Math.random() * alivePlayers.length);
    starterByRoundRef.current[roundId] = alivePlayers[idx]?.name ?? "";
  }, [alivePlayers, state?.round.id]);

  const starterName =
    state?.round.id ? starterByRoundRef.current[state.round.id] ?? "" : "";

  const tieVote = Boolean(state?.voting?.tied);
  const currentTieKey = `${state?.round.id ?? ""}:tie`;
  const showTiePopup =
    Boolean(activeTiePopupKey) &&
    tiePopupDismissedKeyRef.current !== activeTiePopupKey;

  const dismissTiePopup = async () => {
    tiePopupDismissedKeyRef.current = activeTiePopupKey;
    setActiveTiePopupKey("");
    if (state?.me.isHost) {
      await nextVote();
    }
  };

  useEffect(() => {
    if (!tieVote) {
      tieAdvanceKeyRef.current = "";
      return;
    }
  }, [tieVote]);

  useEffect(() => {
    if (!tieVote) return;
    if (activeTiePopupKey) return;
    if (!state?.round.id) return;
    setActiveTiePopupKey(currentTieKey);
  }, [activeTiePopupKey, currentTieKey, state?.round.id, tieVote]);

  const winnerText =
    roomStatus === "ended_undercover"
      ? "Undercover wins"
      : roomStatus === "ended_undercover_mrwhite"
        ? "Undercover & Mr.White win"
      : roomStatus === "ended_civilian"
        ? "Civilian wins"
        : roomStatus === "ended_mrwhite"
          ? "Mr.White wins"
          : "Game ended";

  async function backToRoom() {
    if (state?.me.isHost) {
      await fetch("/api/game/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
    }
    router.replace(`/room/${code}`);
  }

  async function submitMrwhiteGuess() {
    if (!mrwhiteGuess) return;
    setGuessing(true);
    setError(null);
    const res = await fetch("/api/game/mrwhite-guess", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, guess: mrwhiteGuess }),
    });
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      setGuessing(false);
      setError(json?.error ?? "GUESS_FAILED");
      return;
    }
    setGuessing(false);
    await loadState();
  }

  async function nextVote() {
    setContinuing(true);
    setError(null);
    const res = await fetch("/api/game/nextvote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      setContinuing(false);
      setError(json?.error ?? "NEXT_VOTE_FAILED");
      return;
    }
    setContinuing(false);
    setVotingFor("");
    await loadState();
  }

  const configUndercover = state?.room.config?.undercover ?? 0;
  const configMrwhite = state?.room.config?.mrwhite ?? 0;
  const configCivilian = state?.room.config?.civilian ?? 0;

  const [undercoverDraft, setUndercoverDraft] = useState(0);
  const [mrwhiteDraft, setMrwhiteDraft] = useState(0);

  useEffect(() => {
    setUndercoverDraft(configUndercover);
    setMrwhiteDraft(configMrwhite);
  }, [configUndercover, configMrwhite]);

  const draftCivilian = Math.max(0, alive - undercoverDraft - mrwhiteDraft);
  const draftInvalid = undercoverDraft + mrwhiteDraft >= alive;
  const hasUnsavedConfig =
    undercoverDraft !== configUndercover || mrwhiteDraft !== configMrwhite;

  const canIncUndercover = undercoverDraft + 1 + mrwhiteDraft <= alive - 1;
  const canIncMrwhite = mrwhiteDraft + 1 + undercoverDraft <= alive - 1;

  async function saveConfig() {
    setSavingConfig(true);
    setError(null);
    const res = await fetch("/api/room/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code,
        undercoverCount: undercoverDraft,
        mrwhiteCount: mrwhiteDraft,
      }),
    });
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      setSavingConfig(false);
      setError(json?.error ?? "CONFIG_UPDATE_FAILED");
      return;
    }
    setSavingConfig(false);
    await loadState();
  }

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        {showTiePopup ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4"
          >
            <motion.div
              initial={{ scale: 0.96, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 140, damping: 16 }}
              className="w-full max-w-sm rounded-3xl border border-white/10 bg-black/60 p-5 backdrop-blur-md"
            >
              <div className="text-xs text-zinc-400">VOTE RESULT</div>
              <div className="mt-1 text-2xl font-semibold text-zinc-50">
                It&apos;s a tie
              </div>
              <div className="mt-2 text-sm text-zinc-300">
                Everyone received the same number of votes. No one was
                eliminated.
              </div>
              <div className="mt-4 text-xs text-zinc-500">
                {state?.me.isHost
                  ? "Close to advance to the next round."
                  : "Waiting for the host to advance to the next round."}
              </div>

              <div className="mt-4">
                <Button
                  color="primary"
                  className="w-full"
                  isLoading={continuing}
                  onPress={dismissTiePopup}
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}

        {gameEnded && showWinner ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          >
            <motion.div
              initial={{ scale: 0.96, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 140, damping: 16 }}
              className="w-full max-w-sm rounded-3xl border border-white/10 bg-black/60 p-5 backdrop-blur-md"
            >
              <div className="text-xs text-zinc-400">WINNER</div>
              <div className="mt-1 text-3xl font-semibold text-zinc-50">
                {winnerText}
              </div>
              <div className="mt-4">
                <Button color="primary" className="w-full" onPress={backToRoom}>
                  Back to room
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
          className="mb-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-zinc-400">GAME</div>
              <div className="mt-1 text-xl font-semibold text-zinc-50">
                {code}
              </div>
              <div className="mt-2 truncate whitespace-nowrap text-zinc-400">
                Round {state?.round.roundNumber ?? "-"} · Phase {phase}
                {starterName ? (
                  <>
                    <span className="mx-2 text-zinc-600">|</span>
                    <motion.span
                      initial={{ opacity: 0, y: 6, filter: "blur(6px)" }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        filter: "blur(0px)",
                        backgroundPositionX: ["0%", "200%"],
                      }}
                      transition={{
                        opacity: { duration: 0.35, ease: "easeOut" },
                        y: { duration: 0.35, ease: "easeOut" },
                        filter: { duration: 0.35 },
                        backgroundPositionX: {
                          duration: 3,
                          ease: "linear",
                          repeat: Infinity,
                        },
                      }}
                      className="inline-block bg-gradient-to-r from-purple-300 via-white to-emerald-300 bg-[length:300%_100%] bg-clip-text text-transparent font-semibold"
                    >
                      Starting with {starterName}.
                    </motion.span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                variant="bordered"
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
          </div>
        </motion.div>

        <Card className="bg-white/5 backdrop-blur-md border border-white/10">
          <CardHeader className="flex items-center justify-between">
            <div className="text-zinc-50 font-medium">Your Secret</div>
            {loading ? <Spinner size="sm" /> : null}
          </CardHeader>
          <CardBody className="space-y-4">
            {error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            {hintAvailable ? (
              <div className="rounded-3xl border border-white/10 bg-black/20 px-4 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-zinc-500">Your hint</div>
                    <div className="text-[11px] text-zinc-600">
                      You can hide/show your hint anytime.
                    </div>
                  </div>
                  <Button
                    size="sm"
                    color="primary"
                    variant={secret ? "bordered" : "solid"}
                    isLoading={revealing}
                    isDisabled={revealing}
                    onPress={revealSecret}
                  >
                    {secret ? (showHint ? "Hide" : "Reveal") : "Reveal"}
                  </Button>
                </div>

                {secret && showHint ? (
                  <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-4">
                    {secret.role === "mrwhite" ? (
                      <>
                        <div className="text-xs text-zinc-400">STATUS</div>
                        <div className="mt-1 text-xl font-semibold text-zinc-50">
                          You are MR.WHITE
                        </div>
                        <div className="mt-2 text-sm text-zinc-300">
                          You have no word.
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xs text-zinc-400">HINT</div>
                        <div className="mt-2 text-3xl font-semibold text-zinc-50">
                          {secret.word}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-400">
                    {secret ? "Hint is hidden." : "Tap Reveal to fetch your hint."}
                  </div>
                )}
              </div>
            ) : null}

            {phase === "assign" ? (
              <div className="space-y-2">

                {state?.me.isHost ? (
                  <>
                    <div className="rounded-3xl border border-white/10 bg-black/20 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs text-zinc-500">Role setup</div>
                          <div className="mt-1 text-sm text-zinc-300">
                            Total players: <span className="text-zinc-50">{alive}</span>
                          </div>
                        </div>
                        <div className="text-xs text-purple-200">HOST</div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3">
                        <CountTile
                          kind="civilian"
                          title="Civilian"
                          subtitle="Gets the common word"
                          value={draftCivilian}
                        />

                        <CountTile
                          kind="undercover"
                          title="Undercover"
                          subtitle="Gets a different word"
                          value={undercoverDraft}
                          right={
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="bordered"
                                isDisabled={undercoverDraft <= 0 || savingConfig}
                                onPress={() =>
                                  setUndercoverDraft((v) => Math.max(0, v - 1))
                                }
                              >
                                -
                              </Button>
                              <Button
                                size="sm"
                                variant="bordered"
                                isDisabled={!canIncUndercover || savingConfig}
                                onPress={() => setUndercoverDraft((v) => v + 1)}
                              >
                                +
                              </Button>
                            </div>
                          }
                        />

                        <CountTile
                          kind="mrwhite"
                          title="Mr.White"
                          subtitle="No word"
                          value={mrwhiteDraft}
                          right={
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="bordered"
                                isDisabled={mrwhiteDraft <= 0 || savingConfig}
                                onPress={() =>
                                  setMrwhiteDraft((v) => Math.max(0, v - 1))
                                }
                              >
                                -
                              </Button>
                              <Button
                                size="sm"
                                variant="bordered"
                                isDisabled={!canIncMrwhite || savingConfig}
                                onPress={() => setMrwhiteDraft((v) => v + 1)}
                              >
                                +
                              </Button>
                            </div>
                          }
                        />
                      </div>

                      <div className="mt-4 space-y-3">
                        {draftInvalid ? (
                          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                            Undercover + Mr.White must be less than total players.
                          </div>
                        ) : null}

                        {draftCivilian < 1 ? (
                          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                            Must have at least 1 Civilian.
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                            Rule: at least 1 Civilian.
                          </div>
                        )}
 
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-zinc-500">
                            Saved: {configUndercover}/{configMrwhite}/{configCivilian}
                          </div>
                          <div
                            className={
                              hasUnsavedConfig
                                ? "text-xs text-amber-200"
                                : "text-xs text-zinc-500"
                            }
                          >
                            {hasUnsavedConfig ? "Unsaved changes" : "Up to date"}
                          </div>
                        </div>

                        <Button
                          color="primary"
                          className="w-full"
                          isDisabled={
                            draftInvalid ||
                            savingConfig ||
                            !hasUnsavedConfig
                          }
                          isLoading={savingConfig}
                          onPress={saveConfig}
                        >
                          Save role setup
                        </Button>
                      </div>
                    </div>

                    <Button
                      color="primary"
                      className="w-full"
                      isDisabled={draftInvalid || hasUnsavedConfig}
                      isLoading={assigning}
                      onPress={assignRoles}
                    >
                      Assign Roles
                    </Button>
                    {hasUnsavedConfig ? (
                      <div className="text-xs text-amber-200">
                        Save role setup before assigning.
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-400">
                    Waiting for host to configure and assign roles.
                  </div>
                )}
              </div>
            ) : null}


            {phase === "describe" ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-xs text-zinc-500">Vote</div>
                  <div className="mt-1 text-sm text-zinc-300">
                    Choose 1 player to eliminate.
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    Votes: {votesCast}/{alive}
                  </div>
                </div>

                <div className="space-y-2">
                  {alivePlayers
                    .filter((p) => p.id !== state?.me.playerId)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={meVoted || voting}
                        onClick={() => setVotingFor(p.id)}
                        className={
                          votingFor === p.id
                            ? "w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-left"
                            : "w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left"
                        }
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-zinc-100 font-medium">
                            {p.name}
                            {p.isHost ? (
                              <span className="ml-2 text-xs text-purple-200">HOST</span>
                            ) : null}
                          </div>
                          {votingFor === p.id ? (
                            <div className="text-xs text-emerald-200">Selected</div>
                          ) : null}
                        </div>
                      </button>
                    ))}
                </div>

                <Button
                  color="primary"
                  className="w-full"
                  isDisabled={!votingFor || meVoted}
                  isLoading={voting}
                  onPress={submitVote}
                >
                  {meVoted ? "Voted" : "Submit vote"}
                </Button>
              </div>
            ) : null}

            {phase === "mrwhite_guess" ? (
              <div className="space-y-3">
                {state?.round.eliminatedPlayerId === state?.me.playerId ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <div className="text-xs text-zinc-500">Mr.White guess</div>
                    <div className="mt-1 text-sm text-zinc-300">
                      Guess the Civilian word to win instantly.
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-300">
                    <motion.span
                      initial={{
                        opacity: 0,
                        y: 10,
                        scale: 0.96,
                        filter: "blur(8px)",
                        textShadow: "0px 0px 0px rgba(255,255,255,0)",
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        filter: "blur(0px)",
                        backgroundPositionX: ["0%", "200%"],
                        textShadow: [
                          "0px 0px 8px rgba(255,255,255,0.15)",
                          "0px 0px 14px rgba(255,255,255,0.35)",
                          "0px 0px 8px rgba(255,255,255,0.15)",
                        ],
                      }}
                      transition={{
                        opacity: { duration: 0.4, ease: "easeOut" },
                        y: { duration: 0.4, ease: "easeOut" },
                        scale: { duration: 0.4, ease: "easeOut" },
                        filter: { duration: 0.35 },
                        backgroundPositionX: {
                          duration: 3,
                          ease: "linear",
                          repeat: Infinity,
                        },
                        textShadow: {
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        },
                      }}
                      className="inline-block bg-gradient-to-r from-purple-300 via-white to-emerald-300 bg-[length:300%_100%] bg-clip-text text-transparent font-semibold"
                    >
                    <span className="mr-2">🔔</span>
                    <span>MrWhite (</span>
                      {eliminated?.name ?? "?"}
                    <span>) was voted out and is waiting to guess the word.</span>
                    </motion.span>
                  </div>
                )}

                {state?.round.eliminatedPlayerId === state?.me.playerId ? (
                  <div className="space-y-2">
                    <input
                      value={mrwhiteGuess}
                      onChange={(e) => setMrwhiteGuess(e.target.value)}
                      placeholder="Type the civilian word"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-zinc-100 outline-none"
                    />
                    <Button
                      color="primary"
                      className="w-full"
                      isDisabled={!mrwhiteGuess}
                      isLoading={guessing}
                      onPress={submitMrwhiteGuess}
                    >
                      Submit guess
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {phase === "result" ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="text-xs text-zinc-500">Result</div>
                  {eliminated ? (
                    <div className="mt-1 text-lg font-semibold text-zinc-50">
                      Eliminated: {eliminated.name}
                      {eliminated.role ? (
                        <span className="ml-2 rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-xs font-medium text-zinc-200">
                          {eliminated.role}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-1 text-sm text-zinc-300">No elimination.</div>
                  )}
                  <div className="mt-2 text-xs text-zinc-500">
                    Votes: {votesCast}/{voteEligibleCount}
                  </div>
                </div>

                {!gameEnded && state?.me.isHost ? (
                  <Button
                    color="primary"
                    className="w-full"
                    isLoading={continuing}
                    onPress={nextVote}
                  >
                    Next vote
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
