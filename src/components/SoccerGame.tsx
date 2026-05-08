"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

type Phase = "idle" | "playing" | "shot" | "saved" | "cleared" | "goal" | "reveal";

interface Player {
  name: string;
  team: "A" | "B";
  role: "gk" | "def" | "mid" | "fwd";
  baseX: number;
  baseY: number;
  isRobot: boolean;
}

interface BallState {
  x: number;
  y: number;
  transitionMs: number;
  easing: string;
  carrier: string | null;
}

interface Waypoint {
  x: number;
  y: number;
  duration: number;
  easing?: string;
  carrier: string | null;
}

// ── Formations ────────────────────────────────────────────────────────────

const FORMATIONS: { role: Player["role"]; xA: number; y: number }[][] = [
  /* 1 */ [{ role: "fwd", xA: 60, y: 50 }],
  /* 2 */ [{ role: "def", xA: 23, y: 50 }, { role: "fwd", xA: 60, y: 50 }],
  /* 3 */ [
    { role: "def", xA: 23, y: 50 }, { role: "mid", xA: 42, y: 50 },
    { role: "fwd", xA: 60, y: 50 },
  ],
  /* 4 */ [
    { role: "def", xA: 23, y: 33 }, { role: "def", xA: 23, y: 67 },
    { role: "mid", xA: 42, y: 50 }, { role: "fwd", xA: 60, y: 50 },
  ],
  /* 5 */ [
    { role: "def", xA: 23, y: 33 }, { role: "def", xA: 23, y: 67 },
    { role: "mid", xA: 42, y: 35 }, { role: "mid", xA: 42, y: 65 },
    { role: "fwd", xA: 60, y: 50 },
  ],
  /* 6 */ [
    { role: "def", xA: 21, y: 23 }, { role: "def", xA: 21, y: 50 }, { role: "def", xA: 21, y: 77 },
    { role: "mid", xA: 41, y: 35 }, { role: "mid", xA: 41, y: 65 },
    { role: "fwd", xA: 60, y: 50 },
  ],
  /* 7 */ [
    { role: "def", xA: 21, y: 23 }, { role: "def", xA: 21, y: 50 }, { role: "def", xA: 21, y: 77 },
    { role: "mid", xA: 41, y: 35 }, { role: "mid", xA: 41, y: 65 },
    { role: "fwd", xA: 60, y: 33 }, { role: "fwd", xA: 60, y: 67 },
  ],
  /* 8 */ [
    { role: "def", xA: 19, y: 20 }, { role: "def", xA: 19, y: 45 }, { role: "def", xA: 19, y: 70 },
    { role: "mid", xA: 38, y: 28 }, { role: "mid", xA: 38, y: 55 }, { role: "mid", xA: 38, y: 78 },
    { role: "fwd", xA: 60, y: 35 }, { role: "fwd", xA: 60, y: 65 },
  ],
];

function buildTeams(names: string[]): Player[] {
  const half = Math.ceil(names.length / 2);
  const aNamed = names.slice(0, half);
  const bNamed = names.slice(half);
  const players: Player[] = [];

  function addTeam(teamNames: string[], team: "A" | "B") {
    const gkX = team === "A" ? 4 : 96;
    players.push({ name: "GK", team, role: "gk", baseX: gkX, baseY: 50, isRobot: true });

    const layout = FORMATIONS[Math.min(teamNames.length, FORMATIONS.length) - 1];
    teamNames.forEach((name, i) => {
      const slot = layout[i % layout.length];
      const yExtra = i >= layout.length ? Math.floor(i / layout.length) * 6 : 0;
      const x = team === "A" ? slot.xA : 100 - slot.xA;
      players.push({ name, team, role: slot.role, baseX: x, baseY: slot.y + yExtra, isRobot: false });
    });
  }

  addTeam(aNamed, "A");
  addTeam(bNamed, "B");
  return players;
}

// ── Ball path builder ──────────────────────────────────────────────────────

function buildBallPath(scorer: Player, players: Player[]): Waypoint[] {
  const teammates = players.filter(
    (p) => p.team === scorer.team && !p.isRobot && p.name !== scorer.name
  );
  const defs = teammates.filter((p) => p.role === "def");
  const mids = teammates.filter((p) => p.role === "mid");

  const path: Waypoint[] = [{ x: 50, y: 50, duration: 0, carrier: null }];

  if (defs.length > 0) {
    const def = defs[Math.floor(Math.random() * defs.length)];
    path.push({ x: def.baseX, y: def.baseY, duration: 1500, carrier: def.name });
  }
  if (mids.length > 0) {
    const mid = mids[Math.floor(Math.random() * mids.length)];
    path.push({ x: mid.baseX, y: mid.baseY, duration: 1300, carrier: mid.name });
    const otherMids = mids.filter((m) => m.name !== mid.name);
    if (otherMids.length > 0) {
      path.push({ x: otherMids[0].baseX, y: otherMids[0].baseY, duration: 1100, carrier: otherMids[0].name });
    }
  }

  path.push({ x: scorer.baseX, y: scorer.baseY, duration: 1400, carrier: scorer.name });
  const dribX = scorer.team === "A" ? scorer.baseX + 5 : scorer.baseX - 5;
  path.push({ x: dribX, y: scorer.baseY, duration: 1000, carrier: scorer.name });

  return path;
}

// Short build-up ending at the long-shot taker (1-2 passes max)
function buildLongShotPath(scorer: Player, players: Player[]): Waypoint[] {
  const teammates = players.filter(
    (p) => p.team === scorer.team && !p.isRobot && p.name !== scorer.name
  );
  const path: Waypoint[] = [{ x: 50, y: 50, duration: 0, carrier: null }];

  // One quick bridge pass (optional)
  const bridge = teammates.find((p) => p.role === "mid") ?? teammates[0];
  if (bridge && Math.random() < 0.55) {
    path.push({ x: bridge.baseX, y: bridge.baseY, duration: 1000, carrier: bridge.name });
  }

  // Ball arrives at long-shot taker, they take one touch
  path.push({ x: scorer.baseX, y: scorer.baseY, duration: 900, carrier: scorer.name });

  return path;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T | null {
  return arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null;
}

// Mini pass-chain the scorer does after winning a rebound
function buildReboundPath(scorer: Player, miniPasser: Player | null): Waypoint[] {
  const bounceX = scorer.team === "A" ? 65 + randBetween(-8, 8) : 35 + randBetween(-8, 8);
  const bounceY = 50 + randBetween(-12, 12);
  const path: Waypoint[] = [{ x: bounceX, y: bounceY, duration: 1000, carrier: scorer.name }];
  if (miniPasser) {
    path.push({ x: miniPasser.baseX, y: miniPasser.baseY, duration: 1100, carrier: miniPasser.name });
    path.push({ x: scorer.baseX, y: scorer.baseY, duration: 950, carrier: scorer.name });
  }
  return path;
}

// ── Player position snapshots for scramble ─────────────────────────────────

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function randBetween(lo: number, hi: number) { return lo + Math.random() * (hi - lo); }

function snapshotPositions(
  ballX: number,
  ballY: number,
  carrier: string | null,
  players: Player[]
): Record<string, { x: number; y: number }> {
  const carryingTeam = carrier ? players.find((p) => p.name === carrier)?.team : null;
  const snap: Record<string, { x: number; y: number }> = {};

  players.forEach((p) => {
    const key = `${p.team}-${p.name}`;
    if (p.isRobot) {
      // GK tracks ball vertically, stays on goal line
      snap[key] = { x: p.baseX, y: clamp(p.baseY + (ballY - 50) * 0.45, 20, 80) };
      return;
    }
    if (p.team === carryingTeam) {
      // Attackers converge toward ball
      snap[key] = {
        x: clamp(lerp(p.baseX, ballX, 0.5) + randBetween(-7, 7), 5, 95),
        y: clamp(lerp(p.baseY, ballY, 0.45) + randBetween(-10, 10), 5, 95),
      };
    } else {
      // Defenders try to intercept between ball and their own goal
      const goalX = p.team === "A" ? 4 : 96;
      const ix = lerp(goalX, ballX, 0.52);
      const lo = p.team === "A" ? 5 : 50;
      const hi = p.team === "A" ? 50 : 95;
      snap[key] = {
        x: clamp(ix + randBetween(-6, 6), lo, hi),
        y: clamp(lerp(p.baseY, ballY, 0.38) + randBetween(-9, 9), 5, 95),
      };
    }
  });

  return snap;
}

// ── Leaderboard ───────────────────────────────────────────────────────────

const LEADERBOARD_KEY = "mini-soccer-leaderboard";

interface LeaderboardEntry { name: string; goals: number; }

function useLeaderboard() {
  const [board, setBoard] = useState<LeaderboardEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(LEADERBOARD_KEY) ?? "[]"); }
    catch { return []; }
  });

  function recordGoal(name: string) {
    setBoard((prev) => {
      const next = prev.map((e) => ({ ...e }));
      const entry = next.find((e) => e.name === name);
      if (entry) { entry.goals++; } else { next.push({ name, goals: 1 }); }
      next.sort((a, b) => b.goals - a.goals);
      localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(next));
      return next;
    });
  }

  function clearBoard() {
    localStorage.removeItem(LEADERBOARD_KEY);
    setBoard([]);
  }

  return { board, recordGoal, clearBoard };
}

// ── Confetti ──────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ["#facc15", "#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f97316"];

interface ConfettiPiece { id: number; x: number; color: string; delay: number; size: number; shape: "circle" | "rect"; }

function useConfetti(active: boolean): ConfettiPiece[] {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  useEffect(() => {
    if (!active) { setPieces([]); return; }
    setPieces(Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: Math.random() * 0.8,
      size: 5 + Math.random() * 9,
      shape: i % 3 === 0 ? "circle" : "rect",
    })));
  }, [active]);
  return pieces;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

const ROLE_WOBBLE: Record<Player["role"], string> = {
  gk:  "animate-wobble-gk",
  def: "animate-wobble-def",
  mid: "animate-wobble-mid",
  fwd: "animate-wobble-fwd",
};

const ROLE_LABEL: Record<Player["role"], string> = {
  gk: "GK", def: "DEF", mid: "MID", fwd: "FWD",
};

const NET_PATTERN =
  "repeating-linear-gradient(0deg,rgba(255,255,255,0.28) 0,rgba(255,255,255,0.28) 1px,transparent 1px,transparent 7px)," +
  "repeating-linear-gradient(90deg,rgba(255,255,255,0.28) 0,rgba(255,255,255,0.28) 1px,transparent 1px,transparent 7px)";

// ── Component ─────────────────────────────────────────────────────────────

interface Props {
  names: string[];
}

export default function SoccerGame({ names }: Props) {
  const players = useMemo(() => buildTeams(names), [names]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [scorer, setScorer] = useState<Player | null>(null);
  const [ball, setBall] = useState<BallState>({ x: 50, y: 50, transitionMs: 0, easing: "ease-in-out", carrier: null });
  const [shakingGoal, setShakingGoal] = useState<"left" | "right" | null>(null);
  const [divingGk, setDivingGk] = useState<"A" | "B" | null>(null);
  const [livePositions, setLivePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [playerTransitionMs, setPlayerTransitionMs] = useState(350);
  const [isLongShot, setIsLongShot] = useState(false);
  const [tackleText, setTackleText] = useState<string | null>(null);
  const [recorded, setRecorded] = useState(false);

  const { board, recordGoal, clearBoard } = useLeaderboard();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const confetti = useConfetti(phase === "goal" || phase === "reveal");

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function schedule(fn: () => void, ms: number) {
    timers.current.push(setTimeout(fn, ms));
  }

  function kickOff() {
    if (phase !== "idle") return;

    const eligible = players.filter((p) => !p.isRobot);
    const longShot = Math.random() < 0.25;
    setIsLongShot(longShot);

    let sc: Player;
    if (longShot) {
      const longPool = eligible.filter((p) => p.role === "mid" || p.role === "def");
      const pool = longPool.length > 0 ? longPool : eligible;
      sc = pool[Math.floor(Math.random() * pool.length)];
    } else {
      sc = eligible[Math.floor(Math.random() * eligible.length)];
    }

    let path = longShot ? buildLongShotPath(sc, players) : buildBallPath(sc, players);

    // ── Possible tackle / interception during build-up (30%, not on long shots) ──
    let tackleFireTime = -1;
    let originalCarrierName: string | null = null;
    let tacklePosX = 50, tacklePosY = 50;
    let tackleBuildIdx = -1;
    if (!longShot && path.length > 2 && Math.random() < 0.30) {
      // Pick a waypoint in the middle of the path (not the opening center dot or the last step)
      const tackleIdx = 1 + Math.floor(Math.random() * (path.length - 2));
      const tackleWp = path[tackleIdx];
      const oppTeam: "A" | "B" = sc.team === "A" ? "B" : "A";
      const tackler = pickRandom(
        players.filter((p) => p.team === oppTeam && !p.isRobot && (p.role === "def" || p.role === "mid"))
      );

      if (tackler) {
        // Time when ball arrives at the tackle point
        tackleFireTime = 0;
        for (let i = 0; i < tackleIdx; i++) tackleFireTime += path[i].duration;
        // Save original carrier info so we can pin them at the clash point
        originalCarrierName = tackleWp.carrier;
        tacklePosX = tackleWp.x;
        tacklePosY = tackleWp.y;
        tackleBuildIdx = tackleIdx;

        const newScorer = pickRandom(players.filter((p) => p.team === oppTeam && !p.isRobot)) ?? tackler;

        // Keep path up to tackle point; last entry: tackler now has the ball
        const newPath: Waypoint[] = path.slice(0, tackleIdx);
        newPath.push({ ...tackleWp, carrier: tackler.name });
        // Tackler dribbles away in their attack direction
        const dribX = oppTeam === "A" ? Math.min(tackleWp.x + 12, 72) : Math.max(tackleWp.x - 12, 28);
        newPath.push({ x: dribX, y: tackleWp.y + randBetween(-5, 5), duration: 900, carrier: tackler.name });
        // Pass to new scorer (if different)
        if (newScorer.name !== tackler.name) {
          newPath.push({ x: newScorer.baseX, y: newScorer.baseY, duration: 1100, carrier: newScorer.name });
        }
        // Scorer touch toward goal
        const touchX = oppTeam === "A" ? Math.min(newScorer.baseX + 5, 82) : Math.max(newScorer.baseX - 5, 18);
        newPath.push({ x: touchX, y: newScorer.baseY, duration: 850, carrier: newScorer.name });

        path = newPath;
        sc = newScorer;
      }
    }

    setScorer(sc);
    const shooterX = longShot
      ? sc.baseX
      : (sc.team === "A" ? Math.min(sc.baseX + 5, 88) : Math.max(sc.baseX - 5, 12));

    setPhase("playing");
    setBall({ x: 50, y: 50, transitionMs: 0, easing: "ease-in-out", carrier: null });
    const basePos: Record<string, { x: number; y: number }> = {};
    players.forEach((p) => { basePos[`${p.team}-${p.name}`] = { x: p.baseX, y: p.baseY }; });
    setLivePositions(basePos);

    // ── Process a waypoint sequence, returning the time after the last waypoint ──
    const processWaypoints = (
      wps: Waypoint[],
      startAt: number,
      snapHook?: (snap: Record<string, { x: number; y: number }>, idx: number) => void
    ): number => {
      let t = startAt;
      for (let i = 0; i < wps.length; i++) {
        const wp = wps[i];
        const snap = snapshotPositions(wp.x, wp.y, wp.carrier, players);
        if (wp.carrier) {
          const cp = players.find((p) => p.name === wp.carrier);
          if (cp) snap[`${cp.team}-${cp.name}`] = { x: wp.x, y: wp.y };
        }
        if (snapHook) snapHook(snap, i);
        const tCap = t; const wpCap = wp; const snapCap = snap;
        schedule(() => {
          setBall({ x: wpCap.x, y: wpCap.y, transitionMs: wpCap.duration, easing: "ease-in-out", carrier: wpCap.carrier });
          if (wpCap.duration > 0) { setPlayerTransitionMs(wpCap.duration); setLivePositions(snapCap); }
        }, tCap);
        t += wp.duration;
      }
      return t;
    };

    // When a tackle happened, pin the original carrier at the tackle point so both
    // players visually converge to the same spot, creating a clash effect.
    const tackleSnapHook = tackleBuildIdx >= 0
      ? (snap: Record<string, { x: number; y: number }>, idx: number) => {
          if (idx === tackleBuildIdx && originalCarrierName) {
            const oc = players.find((p) => p.name === originalCarrierName);
            if (oc) snap[`${oc.team}-${oc.name}`] = { x: tacklePosX, y: tacklePosY };
          }
        }
      : undefined;

    const elapsed = processWaypoints(path, 0, tackleSnapHook);

    // Show stolen text when ball arrives at tackle point
    if (tackleFireTime >= 0) {
      schedule(() => {
        setTackleText("STOLEN! 🦶");
        schedule(() => setTackleText(null), 1600);
      }, tackleFireTime);
    }

    // ── Pre-compute all randomness synchronously ──────────────────────────
    const goalX    = sc.team === "A" ? 95.5 : 4.5;
    const gkCatchX = sc.team === "A" ? 93 : 7;
    const gkTeam: "A" | "B" = sc.team === "A" ? "B" : "A";
    const side: "left" | "right" = sc.team === "A" ? "right" : "left";
    const shotY = 46 + randBetween(-6, 6);

    // First shot outcome: 35% save, 30% clear, 35% goal
    const roll1 = Math.random();
    const willSave1  = roll1 < 0.35;
    const willClear1 = !willSave1 && roll1 < 0.65;
    const cdef1 = pickRandom(players.filter((p) => p.team === gkTeam && !p.isRobot && (p.role === "def" || p.role === "mid")));
    const cX1 = sc.team === "A" ? 85 + randBetween(-3, 3) : 15 + randBetween(-3, 3);
    const cY1 = shotY + randBetween(-6, 6);

    // Rebound 1 — who gets the ball after first interception
    const r1team: "A" | "B" = Math.random() < 0.5 ? gkTeam : sc.team;
    const r1scorer = pickRandom(players.filter((p) => p.team === r1team && !p.isRobot)) ?? sc;
    const r1goalX = r1team === "A" ? 95.5 : 4.5;
    const r1side: "left" | "right" = r1team === "A" ? "right" : "left";
    const r1gkTeam: "A" | "B" = r1team === "A" ? "B" : "A";
    const r1catchX = r1team === "A" ? 93 : 7;
    const r1shotY = 46 + randBetween(-6, 6);
    const r1shootX = r1team === "A" ? Math.min(r1scorer.baseX + 5, 85) : Math.max(r1scorer.baseX - 5, 15);
    const r1mini = pickRandom(players.filter((p) => p.team === r1team && !p.isRobot && p.name !== r1scorer.name));
    const r1path = buildReboundPath(r1scorer, r1mini);

    // Second shot outcome: 30% save, 25% clear, 45% goal
    const roll2 = Math.random();
    const willSave2  = roll2 < 0.30;
    const willClear2 = !willSave2 && roll2 < 0.55;
    const cdef2 = pickRandom(players.filter((p) => p.team === r1gkTeam && !p.isRobot && (p.role === "def" || p.role === "mid")));
    const cX2 = r1team === "A" ? 85 + randBetween(-3, 3) : 15 + randBetween(-3, 3);
    const cY2 = r1shotY + randBetween(-6, 6);

    // Rebound 2 — always scores (third attempt)
    const r2team: "A" | "B" = Math.random() < 0.5 ? r1gkTeam : r1team;
    const r2scorer = pickRandom(players.filter((p) => p.team === r2team && !p.isRobot)) ?? sc;
    const r2goalX = r2team === "A" ? 95.5 : 4.5;
    const r2side: "left" | "right" = r2team === "A" ? "right" : "left";
    const r2gkTeam: "A" | "B" = r2team === "A" ? "B" : "A";
    const r2shotY = 46 + randBetween(-6, 6);
    const r2shootX = r2team === "A" ? Math.min(r2scorer.baseX + 5, 85) : Math.max(r2scorer.baseX - 5, 15);
    const r2mini = pickRandom(players.filter((p) => p.team === r2team && !p.isRobot && p.name !== r2scorer.name));
    const r2path = buildReboundPath(r2scorer, r2mini);

    // ── Guaranteed goal sequence ──────────────────────────────────────────
    const scheduleGoalSequence = (tShot: number, sc_: Player, gX: number, sY: number, sX: number, goalSide: "left" | "right", gkT: "A" | "B") => {
      const snap = snapshotPositions(gX, sY, sc_.name, players);
      snap[`${sc_.team}-${sc_.name}`] = { x: sX, y: sY };
      schedule(() => {
        setPhase("shot");
        setScorer(sc_);
        setBall({ x: gX, y: sY, transitionMs: 600, easing: "cubic-bezier(0.2,0,0.8,1)", carrier: sc_.name });
        setPlayerTransitionMs(600);
        setLivePositions(snap);
        setDivingGk(gkT);
        schedule(() => setDivingGk(null), 800);
      }, tShot);
      schedule(() => {
        setPhase("goal");
        setShakingGoal(goalSide);
        schedule(() => setShakingGoal(null), 800);
      }, tShot + 750);
      schedule(() => setPhase("reveal"), tShot + 2200);
    };

    // ── Second shot (may itself be intercepted once more) ─────────────────
    const scheduleSecondShot = (tShot: number) => {
      if (willSave2) {
        const snap = snapshotPositions(r1catchX, r1shotY, r1scorer.name, players);
        snap[`${r1scorer.team}-${r1scorer.name}`] = { x: r1shootX, y: r1shotY };
        schedule(() => {
          setPhase("shot"); setScorer(r1scorer);
          setBall({ x: r1catchX, y: r1shotY, transitionMs: 650, easing: "cubic-bezier(0.2,0,0.8,1)", carrier: r1scorer.name });
          setPlayerTransitionMs(650); setLivePositions(snap); setDivingGk(r1gkTeam);
        }, tShot);
        schedule(() => { setPhase("saved"); setIsLongShot(false); setDivingGk(null); }, tShot + 850);
        const tR2 = processWaypoints(r2path, tShot + 1200);
        scheduleGoalSequence(tR2, r2scorer, r2goalX, r2shotY, r2shootX, r2side, r2gkTeam);

      } else if (willClear2 && cdef2) {
        const snap = snapshotPositions(cX2, cY2, r1scorer.name, players);
        snap[`${r1scorer.team}-${r1scorer.name}`] = { x: r1shootX, y: r1shotY };
        snap[`${cdef2.team}-${cdef2.name}`] = { x: cX2, y: cY2 };
        schedule(() => {
          setPhase("shot"); setScorer(r1scorer);
          setBall({ x: cX2, y: cY2, transitionMs: 650, easing: "cubic-bezier(0.2,0,0.8,1)", carrier: r1scorer.name });
          setPlayerTransitionMs(650); setLivePositions(snap);
          setDivingGk(r1gkTeam); schedule(() => setDivingGk(null), 900);
        }, tShot);
        schedule(() => { setPhase("cleared"); setIsLongShot(false); }, tShot + 820);
        const tR2 = processWaypoints(r2path, tShot + 1200);
        scheduleGoalSequence(tR2, r2scorer, r2goalX, r2shotY, r2shootX, r2side, r2gkTeam);

      } else {
        scheduleGoalSequence(tShot, r1scorer, r1goalX, r1shotY, r1shootX, r1side, r1gkTeam);
      }
    };

    // ── First shot ────────────────────────────────────────────────────────
    if (willSave1) {
      const snap = snapshotPositions(gkCatchX, shotY, sc.name, players);
      snap[`${sc.team}-${sc.name}`] = { x: shooterX, y: shotY };
      schedule(() => {
        setPhase("shot");
        setBall({ x: gkCatchX, y: shotY, transitionMs: 700, easing: "cubic-bezier(0.2,0,0.8,1)", carrier: sc.name });
        setPlayerTransitionMs(700); setLivePositions(snap); setDivingGk(gkTeam);
      }, elapsed);
      schedule(() => { setPhase("saved"); setIsLongShot(false); setDivingGk(null); }, elapsed + 850);
      const tR1 = processWaypoints(r1path, elapsed + 1200);
      scheduleSecondShot(tR1);

    } else if (willClear1 && cdef1) {
      const snap = snapshotPositions(cX1, cY1, sc.name, players);
      snap[`${sc.team}-${sc.name}`] = { x: shooterX, y: shotY };
      snap[`${cdef1.team}-${cdef1.name}`] = { x: cX1, y: cY1 };
      schedule(() => {
        setPhase("shot");
        setBall({ x: cX1, y: cY1, transitionMs: 700, easing: "cubic-bezier(0.2,0,0.8,1)", carrier: sc.name });
        setPlayerTransitionMs(700); setLivePositions(snap);
        setDivingGk(gkTeam); schedule(() => setDivingGk(null), 950);
      }, elapsed);
      schedule(() => { setPhase("cleared"); setIsLongShot(false); }, elapsed + 830);
      const tR1 = processWaypoints(r1path, elapsed + 1200);
      scheduleSecondShot(tR1);

    } else {
      scheduleGoalSequence(elapsed, sc, goalX, shotY, shooterX, side, gkTeam);
    }
  }

  function reset() {
    clearTimers();
    setPhase("idle");
    setScorer(null);
    setBall({ x: 50, y: 50, transitionMs: 0, easing: "ease-in-out", carrier: null });
    setShakingGoal(null);
    setDivingGk(null);
    setLivePositions({});
    setIsLongShot(false);
    setTackleText(null);
    setRecorded(false);
  }

  useEffect(() => () => clearTimers(), []);

  const isActive = phase === "playing" || phase === "shot" || phase === "saved" || phase === "cleared";
  const half = Math.ceil(names.length / 2);

  // Leaderboard sidebar (shared JSX used inside the layout)
  const leaderboardPanel = (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <h2 className="text-xs font-bold text-slate-200 uppercase tracking-widest">Top Scorers</h2>
        {board.length > 0 && (
          <button onClick={clearBoard} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Clear
          </button>
        )}
      </div>
      {board.length === 0 ? (
        <p className="px-4 py-6 text-xs text-slate-500 text-center">No goals recorded yet</p>
      ) : (
        <div className="divide-y divide-slate-700/60">
          {board.map((entry, i) => {
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
            return (
              <div key={entry.name} className="flex items-center gap-2 px-4 py-2.5">
                <span className="w-5 text-center text-sm shrink-0">
                  {medal ?? <span className="text-slate-500 text-xs font-mono">{i + 1}</span>}
                </span>
                <span className="flex-1 text-sm font-semibold text-slate-200 truncate">{entry.name}</span>
                <span className="text-sm font-bold text-yellow-400 shrink-0">{entry.goals}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-5 w-full">

      {/* ── Main row: field + leaderboard sidebar ── */}
      <div className="flex gap-4 w-full max-w-7xl items-start">

        {/* Field column */}
        <div className="flex flex-col gap-4 flex-1 min-w-0">

      {/* ── Field ── */}
      <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
        <div className="absolute inset-0 rounded-2xl overflow-hidden bg-green-800 border-2 border-green-700 shadow-2xl">

          {/* Grass stripes */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="absolute top-0 bottom-0" style={{
              left: `${i * 12.5}%`, width: "12.5%",
              background: i % 2 === 0 ? "rgba(0,0,0,0.07)" : "transparent",
            }} />
          ))}

          {/* Field markings */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-white/20" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/30" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 border border-l-0 border-white/15 rounded-r-md" style={{ width: "18%", height: "62%" }} />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 border border-r-0 border-white/15 rounded-l-md" style={{ width: "18%", height: "62%" }} />
          </div>

          {/* Left goal */}
          <div
            className={`absolute left-0 top-1/2 -translate-y-1/2 rounded-r-md overflow-hidden border-2 border-l-0 border-white/50 ${shakingGoal === "left" ? "animate-net-shake" : ""}`}
            style={{ width: 16, height: "28%" }}
          >
            <div className="absolute inset-0" style={{ backgroundImage: NET_PATTERN }} />
          </div>

          {/* Right goal */}
          <div
            className={`absolute right-0 top-1/2 -translate-y-1/2 rounded-l-md overflow-hidden border-2 border-r-0 border-white/50 ${shakingGoal === "right" ? "animate-net-shake" : ""}`}
            style={{ width: 16, height: "28%" }}
          >
            <div className="absolute inset-0" style={{ backgroundImage: NET_PATTERN }} />
          </div>

          {/* Team labels */}
          <div className="absolute top-2 left-3 text-blue-300 text-xs font-bold opacity-50 select-none">A</div>
          <div className="absolute top-2 right-3 text-red-300 text-xs font-bold opacity-50 select-none">B</div>

          {/* Players */}
          {players.map((p) => {
            const key = `${p.team}-${p.name}`;
            const pos = livePositions[key] ?? { x: p.baseX, y: p.baseY };
            const isA = p.team === "A";
            const isCarrier = ball.carrier === p.name && !p.isRobot;
            const isDiving = divingGk !== null && p.isRobot && p.team === divingGk;
            const wobble = isActive ? ROLE_WOBBLE[p.role] : "";
            const diveClass = isDiving ? (p.team === "B" ? "animate-gk-dive-right" : "animate-gk-dive-left") : "";
            const isScorer = scorer?.name === p.name && (phase === "goal" || phase === "reveal");

            return (
              <div
                key={key}
                style={{
                  position: "absolute",
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transition: isActive ? `left ${playerTransitionMs}ms ease-in-out, top ${playerTransitionMs}ms ease-in-out` : "none",
                }}
              >
                <div style={{ transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div className={`relative ${wobble} ${diveClass}`}>
                    {isCarrier && <div className="animate-carrier-ring" />}
                    <div
                      className={`flex items-center justify-center rounded-full font-bold shadow-lg border-2 ${
                        p.isRobot
                          ? "bg-slate-600 border-slate-400 text-white"
                          : isA
                          ? "bg-blue-500 border-blue-300 text-white"
                          : "bg-red-500 border-red-300 text-white"
                      } ${isScorer ? "ring-2 ring-yellow-300 ring-offset-1 ring-offset-green-800" : ""}`}
                      style={{ width: 32, height: 32, fontSize: p.isRobot ? 14 : 11 }}
                    >
                      {p.isRobot ? "🤖" : initials(p.name)}
                    </div>
                  </div>
                  <div
                    className={`font-semibold leading-none mt-0.5 select-none text-center whitespace-nowrap ${p.isRobot ? "text-slate-300/70" : isA ? "text-blue-200/80" : "text-red-200/80"}`}
                    style={{ fontSize: 7, maxWidth: 52, overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {p.isRobot ? ROLE_LABEL[p.role] : p.name}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Ball */}
          {phase !== "goal" && phase !== "reveal" && (
            <div
              style={{
                position: "absolute",
                left: `${ball.x}%`,
                top: `${ball.y}%`,
                transform: "translate(-50%, -50%)",
                fontSize: 18,
                lineHeight: 1,
                zIndex: 10,
                transition: ball.transitionMs > 0
                  ? `left ${ball.transitionMs}ms ${ball.easing}, top ${ball.transitionMs}ms ${ball.easing}`
                  : "none",
                filter: phase === "shot" ? "drop-shadow(0 0 8px rgba(255,220,0,0.9))" : "",
              }}
            >
              ⚽
            </div>
          )}

          {/* Ball in net after goal */}
          {(phase === "goal" || phase === "reveal") && (
            <div style={{
              position: "absolute",
              left: scorer?.team === "A" ? "96%" : "4%",
              top: "48%",
              transform: "translate(-50%, -50%)",
              fontSize: 13,
              lineHeight: 1,
              zIndex: 10,
            }}>
              ⚽
            </div>
          )}

          {/* GOAL! text */}
          {(phase === "goal" || phase === "reveal") && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 20 }}>
              <span
                className="font-black text-yellow-300 animate-goal-pop"
                style={{ fontSize: "clamp(2rem,8vw,3.5rem)", textShadow: "0 0 30px #facc15, 0 3px 0 #000" }}
              >
                GOAL!
              </span>
            </div>
          )}

          {/* STOLEN! flash during build-up tackle */}
          {phase === "playing" && tackleText && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 20 }}>
              <span
                className="font-black text-amber-300 animate-goal-pop"
                style={{ fontSize: "clamp(1.4rem,5vw,2.4rem)", textShadow: "0 0 24px #fcd34d, 0 2px 0 #000" }}
              >
                {tackleText}
              </span>
            </div>
          )}

          {/* LONG SHOT! label */}
          {phase === "shot" && isLongShot && (
            <div className="absolute inset-x-0 top-3 flex justify-center pointer-events-none" style={{ zIndex: 20 }}>
              <span
                className="font-black text-orange-300 animate-goal-pop"
                style={{ fontSize: "clamp(1rem,4vw,1.6rem)", textShadow: "0 0 20px #fb923c, 0 2px 0 #000" }}
              >
                LONG SHOT! 🚀
              </span>
            </div>
          )}

          {/* SAVED! text */}
          {phase === "saved" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 20 }}>
              <span
                className="font-black text-cyan-300 animate-goal-pop"
                style={{ fontSize: "clamp(1.6rem,6vw,2.8rem)", textShadow: "0 0 30px #67e8f9, 0 3px 0 #000" }}
              >
                SAVED! 🧤
              </span>
            </div>
          )}

          {/* CLEARED! text */}
          {phase === "cleared" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 20 }}>
              <span
                className="font-black text-green-300 animate-goal-pop"
                style={{ fontSize: "clamp(1.6rem,6vw,2.8rem)", textShadow: "0 0 30px #86efac, 0 3px 0 #000" }}
              >
                CLEARED! 🦵
              </span>
            </div>
          )}
        </div>

        {/* Confetti (outside field overflow) */}
        {confetti.map((p) => (
          <div
            key={p.id}
            className="absolute top-0 pointer-events-none"
            style={{
              left: `${p.x}%`,
              width: p.size,
              height: p.size,
              background: p.color,
              borderRadius: p.shape === "circle" ? "50%" : "2px",
              animation: `confetti-fall 1.6s ease-in ${p.delay}s forwards`,
              zIndex: 30,
            }}
          />
        ))}
      </div>

      {/* Team legend (idle only) */}
      {phase === "idle" && (
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-1 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
            <span><span className="text-blue-300 font-semibold">A:</span> {names.slice(0, half).join(", ")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
            <span><span className="text-red-300 font-semibold">B:</span> {names.slice(half).join(", ")}</span>
          </div>
        </div>
      )}

      {/* Scorer reveal card */}
      {phase === "reveal" && scorer && (
        <div className="animate-slide-up animate-pulse-glow bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl px-8 py-5 text-center shadow-2xl">
          <p className="text-xs font-semibold text-yellow-900 uppercase tracking-widest mb-1">
            Today&apos;s Standup Host
          </p>
          <p className="text-3xl font-black text-white drop-shadow">{scorer.name}</p>
          <p className="text-yellow-900 text-sm mt-1">
            ⚽ scored for Team {scorer.team}!
          </p>
          <button
            onClick={() => { if (!recorded) { recordGoal(scorer.name); setRecorded(true); } }}
            disabled={recorded}
            className="mt-3 px-5 py-1.5 rounded-lg text-sm font-semibold transition-all active:scale-95 disabled:cursor-default
              bg-yellow-900/30 hover:bg-yellow-900/50 disabled:bg-yellow-900/20 text-yellow-100 disabled:text-yellow-200/60"
          >
            {recorded ? "Recorded!" : "Record Goal"}
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3 justify-center">
        {phase === "idle" && (
          <button
            onClick={kickOff}
            className="px-8 py-3 bg-green-500 hover:bg-green-400 active:scale-95 text-white font-bold rounded-xl text-lg shadow-lg transition-all"
          >
            ⚽ Kick Off!
          </button>
        )}
        {(phase === "goal" || phase === "reveal") && (
          <button
            onClick={reset}
            className="px-6 py-3 bg-slate-600 hover:bg-slate-500 active:scale-95 text-white font-semibold rounded-xl shadow-lg transition-all"
          >
            Play Again
          </button>
        )}
      </div>

        </div>{/* end field column */}

        {/* Leaderboard sidebar */}
        <div className="w-52 shrink-0 sticky top-4">
          {leaderboardPanel}
        </div>

      </div>{/* end main row */}
    </div>
  );
}