// 同一世界的玩家在线房间——纯协议逻辑，零运行时依赖。
// 两个宿主复用同一份代码：Cloudflare Durable Object（worker.js）
// 与本地测试服务器（scripts/presence-test-server.mjs），保证测试覆盖的就是线上逻辑。
//
// 设计铁律：船舶每个玩家一艘。同一身份重复连接时，旧会话被踢（close 4000）。

export const MAX_PLAYERS = 32;
export const WORLD_LIMIT = 1470; // 略宽于客户端世界边界 ±1420
export const MAX_SPEED = 200; // 最高帆速 140，留裕量
export const MIN_POS_INTERVAL_MS = 45; // 超过约 22Hz 的上报直接丢弃
export const IDLE_TIMEOUT_MS = 15000;
export const TICK_MS = 100; // 10Hz 聚合广播

export const CLOSE_REPLACED = 4000; // 同一身份新连接顶替
export const CLOSE_IDLE = 4001;
export const CLOSE_FULL = 4002;
export const CLOSE_BAD_HELLO = 4003;

const MODES = new Set(["sailing", "walking", "docked"]);
const ID_PATTERN = /^[\w.-]{3,64}$/;
const PRESENCE_AUTH_AUDIENCE = "sandsea-privateers-presence-v1";
const AUTH_WINDOW_MS = 2 * 60 * 1000;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((char, index) => [char, index]));

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function sanitizeName(raw) {
  const text = String(raw ?? "Captain")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .trim()
    .slice(0, 24);
  return text || "Captain";
}

function decodeBase64(text) {
  if (typeof text !== "string" || !BASE64_PATTERN.test(text)) return null;
  try {
    if (typeof atob === "function") {
      const binary = atob(text);
      return Uint8Array.from(binary, (char) => char.charCodeAt(0));
    }
    return Uint8Array.from(Buffer.from(text, "base64"));
  } catch {
    return null;
  }
}

function decodeBase58(text) {
  if (typeof text !== "string" || text.length === 0) return null;
  const bytes = [0];
  for (const char of text) {
    const value = BASE58_INDEX.get(char);
    if (value === undefined) return null;
    let carry = value;
    for (let i = 0; i < bytes.length; i += 1) {
      const next = bytes[i] * 58 + carry;
      bytes[i] = next & 0xff;
      carry = next >> 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of text) {
    if (char !== "1") break;
    bytes.push(0);
  }
  return Uint8Array.from(bytes.reverse());
}

function buildPresenceAuthMessage(wallet, timestamp, nonce) {
  return [
    "Sandsea Privateers Presence",
    `wallet=${wallet}`,
    `audience=${PRESENCE_AUTH_AUDIENCE}`,
    `timestamp=${timestamp}`,
    `nonce=${nonce}`,
  ].join("\n");
}

// transport: { send(text), close(code, reason) } —— 宿主适配 WebSocket
export class PresenceCore {
  constructor(options = {}) {
    if (typeof options === "function") {
      this.now = options;
      this.requireSignedWallets = false;
    } else {
      this.now = options.now ?? (() => Date.now());
      this.requireSignedWallets = options.requireSignedWallets === true;
    }
    this.sessions = new Map(); // id -> session
    this.authNonces = new Map(); // wallet:nonce -> expiresAt
    this.guestSerial = 0;
  }

  // 每个连接调用一次；返回该连接的事件处理句柄
  connect(transport) {
    const conn = { id: null, transport, helloPending: false };
    return {
      onMessage: (raw) => {
        void this.handleMessage(conn, raw);
      },
      onClose: () => this.handleClose(conn),
    };
  }

  async handleMessage(conn, raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg?.t === "hello" && conn.id === null && !conn.helloPending) {
      conn.helloPending = true;
      await this.handleHello(conn, msg);
      conn.helloPending = false;
      return;
    }
    if (msg?.t === "pos" && conn.id !== null) {
      this.handlePos(conn.id, msg);
    }
  }

  async handleHello(conn, msg) {
    const wallet = typeof msg.wallet === "string" ? msg.wallet : "";
    const hasWallet = ID_PATTERN.test(wallet) && wallet !== "guest";
    if (hasWallet && this.requireSignedWallets) {
      const ok = await this.verifyPresenceAuth(wallet, msg.auth);
      if (!ok) {
        conn.transport.close(CLOSE_BAD_HELLO, "bad wallet signature");
        return;
      }
    }
    const id = hasWallet ? wallet : `guest-${++this.guestSerial}-${Math.floor(this.now() % 100000)}`;

    const existing = this.sessions.get(id);
    if (!existing && this.sessions.size >= MAX_PLAYERS) {
      conn.transport.close(CLOSE_FULL, "world full");
      return;
    }
    // 一钱包一船：新连接顶替旧会话
    if (existing) {
      this.sessions.delete(id);
      try {
        existing.transport.close(CLOSE_REPLACED, "replaced by new session");
      } catch {
        // 旧连接可能已断
      }
    }

    conn.id = id;
    this.sessions.set(id, {
      transport: conn.transport,
      name: sanitizeName(msg.name),
      x: 0,
      z: 0,
      h: 0,
      s: 0,
      m: "sailing",
      hasPos: false,
      lastSeen: this.now(),
      lastPosAt: 0,
    });
    this.safeSend(id, JSON.stringify({ t: "welcome", id, players: this.snapshotPlayers() }));
  }

  cleanupAuthNonces(now) {
    for (const [key, expiresAt] of this.authNonces) {
      if (expiresAt <= now) this.authNonces.delete(key);
    }
  }

  async verifyPresenceAuth(wallet, auth) {
    const now = this.now();
    this.cleanupAuthNonces(now);
    if (!auth || auth.audience !== PRESENCE_AUTH_AUDIENCE) return false;
    const timestamp = Number(auth.timestamp);
    if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > AUTH_WINDOW_MS) return false;
    if (typeof auth.nonce !== "string" || !NONCE_PATTERN.test(auth.nonce)) return false;
    const nonceKey = `${wallet}:${auth.nonce}`;
    if (this.authNonces.has(nonceKey)) return false;

    const publicKey = decodeBase58(wallet);
    const signature = decodeBase64(auth.signature);
    if (!publicKey || publicKey.length !== 32 || !signature || signature.length !== 64) return false;
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return false;

    try {
      const key = await subtle.importKey("raw", publicKey, { name: "Ed25519" }, false, ["verify"]);
      const message = new TextEncoder().encode(buildPresenceAuthMessage(wallet, timestamp, auth.nonce));
      const ok = await subtle.verify({ name: "Ed25519" }, key, signature, message);
      if (ok) this.authNonces.set(nonceKey, now + AUTH_WINDOW_MS);
      return ok;
    } catch {
      return false;
    }
  }

  handlePos(id, msg) {
    const session = this.sessions.get(id);
    if (!session) return;
    const now = this.now();
    session.lastSeen = now;
    if (now - session.lastPosAt < MIN_POS_INTERVAL_MS) return;

    const x = clampNumber(msg.x, -WORLD_LIMIT, WORLD_LIMIT);
    const z = clampNumber(msg.z, -WORLD_LIMIT, WORLD_LIMIT);
    const h = clampNumber(msg.h, -Math.PI * 2, Math.PI * 2);
    const s = clampNumber(msg.s, -MAX_SPEED, MAX_SPEED);
    if (x === null || z === null || h === null || s === null) return;

    session.lastPosAt = now;
    session.x = x;
    session.z = z;
    session.h = h;
    session.s = s;
    session.m = MODES.has(msg.m) ? msg.m : "sailing";
    session.hasPos = true;
  }

  handleClose(conn) {
    if (conn.id === null) return;
    // 只移除仍属于这条连接的会话（被顶替时新会话不能被旧连接的 close 误删）
    const session = this.sessions.get(conn.id);
    if (session && session.transport === conn.transport) {
      this.sessions.delete(conn.id);
      this.broadcast(JSON.stringify({ t: "leave", id: conn.id }));
    }
    conn.id = null;
  }

  // 10Hz：踢闲置 + 全员快照广播
  tick() {
    const now = this.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastSeen > IDLE_TIMEOUT_MS) {
        this.sessions.delete(id);
        try {
          session.transport.close(CLOSE_IDLE, "idle timeout");
        } catch {
          // 已断开
        }
        this.broadcast(JSON.stringify({ t: "leave", id }));
      }
    }
    if (this.sessions.size === 0) return;
    this.broadcast(JSON.stringify({ t: "snap", p: this.snapshotPlayers() }));
  }

  snapshotPlayers() {
    const players = [];
    for (const [id, session] of this.sessions) {
      if (!session.hasPos) continue;
      players.push({
        id,
        n: session.name,
        x: session.x,
        z: session.z,
        h: session.h,
        s: session.s,
        m: session.m,
      });
    }
    return players;
  }

  broadcast(payload) {
    for (const id of this.sessions.keys()) this.safeSend(id, payload);
  }

  safeSend(id, payload) {
    const session = this.sessions.get(id);
    if (!session) return;
    try {
      session.transport.send(payload);
    } catch {
      this.sessions.delete(id);
    }
  }
}
