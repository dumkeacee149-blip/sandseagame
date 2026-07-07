// 同世界在线：客户端传输层。
// 配置 VITE_PRESENCE_WS_URL（或 DEV 下 ?presence=ws://…）后启用；否则完全静默，
// 游戏保持单机行为。协议见 workers/presence/presence-core.js。

import { shipState } from "../game/ship-controller";
import { createPresenceAuth, getIdentity, isWalletLinked, shortIdentity } from "../core/wallet";
import { postChat } from "../ui/chat";

export type RemoteMode = "sailing" | "walking" | "docked";

export interface RemoteSample {
  readonly time: number; // 本地接收时刻（performance.now()）
  readonly x: number;
  readonly z: number;
  readonly h: number;
  readonly s: number;
  readonly m: RemoteMode;
}

export interface RemotePlayer {
  readonly id: string;
  readonly name: string;
  samples: RemoteSample[];
}

const SEND_INTERVAL_MS = 125; // 8Hz
const KEEPALIVE_MS = 4000; // 静止时的保活上报
const MAX_SAMPLES = 20;
const CLOSE_REPLACED = 4000;
const CLOSE_BAD_HELLO = 4003;

const remotePlayers = new Map<string, RemotePlayer>();

let socket: WebSocket | null = null;
let selfId: string | null = null;
let sendTimer: number | null = null;
let reconnectAttempts = 0;
let stopped = false;
let getMode: () => RemoteMode = () => "sailing";

export function getRemotePlayers(): ReadonlyMap<string, RemotePlayer> {
  return remotePlayers;
}

export function isPresenceConnected() {
  return selfId !== null && socket !== null && socket.readyState === WebSocket.OPEN;
}

// Playwright 与人工验收用的调试快照（取各玩家最新原始样本，不含插值）
export function presenceDebug() {
  return {
    connected: isPresenceConnected(),
    selfId,
    players: [...remotePlayers.values()].map((player) => {
      const latest = player.samples[player.samples.length - 1];
      return { id: player.id, name: player.name, x: latest?.x ?? 0, z: latest?.z ?? 0 };
    }),
  };
}

function resolveUrl(): string | null {
  const configured = import.meta.env.VITE_PRESENCE_WS_URL as string | undefined;
  if (configured) return configured;
  if (import.meta.env.DEV) {
    return new URLSearchParams(location.search).get("presence");
  }
  return null;
}

function resolveWallet(): string {
  if (import.meta.env.DEV) {
    const pid = new URLSearchParams(location.search).get("pid");
    if (pid) return pid;
  }
  const identity = getIdentity();
  return identity === "guest" ? "" : identity;
}

function displayName(): string {
  return isWalletLinked() ? `Captain ${shortIdentity()}` : "Captain";
}

export function initPresence(modeGetter: () => RemoteMode) {
  getMode = modeGetter;
  const url = resolveUrl();
  if (!url) return;
  connect(url);
}

function connect(url: string) {
  try {
    socket = new WebSocket(url);
  } catch (error) {
    console.error("同世界连接失败", error);
    scheduleReconnect(url);
    return;
  }

  socket.addEventListener("open", () => {
    reconnectAttempts = 0;
    void sendHello();
  });

  socket.addEventListener("message", (event) => {
    handleServerMessage(String(event.data));
  });

  const onGone = (event: CloseEvent | Event) => {
    const code = event instanceof CloseEvent ? event.code : 0;
    teardown();
    if (code === CLOSE_REPLACED) {
      stopped = true;
      postChat("Harbormaster", "Your captain set sail from another port — this session is ashore now.");
      return;
    }
    if (code === CLOSE_BAD_HELLO) {
      stopped = true;
      postChat("Harbormaster", "Shared sandsea sign-in failed. Reconnect your wallet and try again.");
      return;
    }
    scheduleReconnect(url);
  };
  socket.addEventListener("close", onGone);
  socket.addEventListener("error", () => {
    // close 事件随后必到，这里不重复处理
  });
}

async function sendHello() {
  const wallet = resolveWallet();
  let auth = null;
  try {
    auth = await createPresenceAuth();
  } catch (error) {
    console.error("同世界钱包签名失败", error);
    stopped = true;
    postChat("Harbormaster", "Wallet signature was declined, so shared sandsea is offline for this session.");
    socket?.close();
    return;
  }
  if (wallet && !auth && !import.meta.env.DEV) {
    stopped = true;
    postChat("Harbormaster", "This wallet cannot sign presence messages, so shared sandsea is offline.");
    socket?.close();
    return;
  }
  if (socket?.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ t: "hello", name: displayName(), wallet, auth }));
}

function handleServerMessage(raw: string) {
  let msg: { t?: string; id?: string; players?: unknown; p?: unknown };
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  if (msg.t === "welcome" && typeof msg.id === "string") {
    selfId = msg.id;
    applySnapshot(Array.isArray(msg.players) ? msg.players : []);
    postChat("Harbormaster", "You've entered the shared sandsea. Other captains' sails are on the horizon.");
    startSendLoop();
    return;
  }
  if (msg.t === "snap") {
    applySnapshot(Array.isArray(msg.p) ? msg.p : []);
    return;
  }
  if (msg.t === "leave" && typeof msg.id === "string") {
    remotePlayers.delete(msg.id);
  }
}

type WirePlayer = { id?: string; n?: string; x?: number; z?: number; h?: number; s?: number; m?: string };

function applySnapshot(players: unknown[]) {
  const now = performance.now();
  const seen = new Set<string>();
  for (const raw of players) {
    const p = raw as WirePlayer;
    if (typeof p?.id !== "string" || p.id === selfId) continue;
    if (![p.x, p.z, p.h, p.s].every((v) => typeof v === "number" && Number.isFinite(v))) continue;
    seen.add(p.id);
    const mode: RemoteMode = p.m === "walking" || p.m === "docked" ? p.m : "sailing";
    const sample: RemoteSample = { time: now, x: p.x!, z: p.z!, h: p.h!, s: p.s!, m: mode };
    const existing = remotePlayers.get(p.id);
    if (existing) {
      existing.samples = [...existing.samples.slice(-(MAX_SAMPLES - 1)), sample];
    } else {
      remotePlayers.set(p.id, { id: p.id, name: String(p.n ?? "Captain").slice(0, 24), samples: [sample] });
    }
  }
  // 快照是全量权威：不在快照里的玩家已离线
  for (const id of remotePlayers.keys()) {
    if (!seen.has(id)) remotePlayers.delete(id);
  }
}

let lastSent = { x: Number.NaN, z: Number.NaN, h: Number.NaN, at: 0 };

function startSendLoop() {
  if (sendTimer !== null) return;
  sendTimer = window.setInterval(() => {
    if (!isPresenceConnected()) return;
    const now = performance.now();
    const moved =
      Math.hypot(shipState.position.x - lastSent.x, shipState.position.z - lastSent.z) > 0.5 ||
      Math.abs(shipState.heading - lastSent.h) > 0.01;
    if (!moved && now - lastSent.at < KEEPALIVE_MS) return;
    lastSent = { x: shipState.position.x, z: shipState.position.z, h: shipState.heading, at: now };
    socket?.send(
      JSON.stringify({
        t: "pos",
        x: shipState.position.x,
        z: shipState.position.z,
        h: shipState.heading,
        s: shipState.speed,
        m: getMode(),
      }),
    );
  }, SEND_INTERVAL_MS);
}

function teardown() {
  selfId = null;
  socket = null;
  remotePlayers.clear();
  if (sendTimer !== null) {
    window.clearInterval(sendTimer);
    sendTimer = null;
  }
  lastSent = { x: Number.NaN, z: Number.NaN, h: Number.NaN, at: 0 };
}

function scheduleReconnect(url: string) {
  if (stopped) return;
  reconnectAttempts += 1;
  const delay = Math.min(2000 * reconnectAttempts, 30000);
  window.setTimeout(() => {
    if (!stopped && socket === null) connect(url);
  }, delay);
}
