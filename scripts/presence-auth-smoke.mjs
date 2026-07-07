// presence 签名握手冒烟：对本地 wrangler dev（workerd，与生产同 runtime）验证
// Ed25519 签名校验的正/反路径。生产 Worker 部署前跑一次，防止 WebCrypto 差异
// 导致钱包玩家集体被 4003 踢下线。
// 用法：npx wrangler dev workers/presence/worker.js --port 8791 &
//       node scripts/presence-auth-smoke.mjs
import { generateKeyPairSync, sign as edSign } from "node:crypto";
import { WebSocket } from "ws";

const WS_URL = process.env.PRESENCE_SMOKE_URL ?? "ws://127.0.0.1:8791/presence";
const AUDIENCE = "sandsea-privateers-presence-v1";
const CLOSE_BAD_HELLO = 4003;
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function encodeBase58(bytes) {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      const value = digits[i] * 256 + carry;
      digits[i] = value % 58;
      carry = Math.floor(value / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    digits.push(0);
  }
  return digits.reverse().map((digit) => BASE58_ALPHABET[digit]).join("");
}

function buildMessage(wallet, timestamp, nonce) {
  return [
    "Sandsea Privateers Presence",
    `wallet=${wallet}`,
    `audience=${AUDIENCE}`,
    `timestamp=${timestamp}`,
    `nonce=${nonce}`,
  ].join("\n");
}

// 模拟 Phantom：Ed25519 keypair，公钥 base58 即钱包地址
function createWallet() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ type: "spki", format: "der" }).subarray(-32);
  return { wallet: encodeBase58(raw), privateKey };
}

function helloWith(auth, wallet) {
  return JSON.stringify({ t: "hello", name: "SmokeCaptain", wallet, auth });
}

// 单次连接：发送 hello 后等 welcome 或 close，返回结果
function attempt(payload) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(WS_URL);
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error("超时：5s 内未收到 welcome 或 close"));
    }, 5000);
    socket.on("open", () => socket.send(payload));
    socket.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.t === "welcome") {
        clearTimeout(timer);
        socket.close();
        resolve({ outcome: "welcome", id: msg.id });
      }
    });
    socket.on("close", (code) => {
      clearTimeout(timer);
      resolve({ outcome: "close", code });
    });
    socket.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function assert(label, ok, detail) {
  const mark = ok ? "✅" : "❌";
  console.log(`${mark} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

const { wallet, privateKey } = createWallet();

// 用例 1：合法签名 → welcome，且 id 是钱包地址
{
  const timestamp = Date.now();
  const nonce = encodeBase58(crypto.getRandomValues(new Uint8Array(18))).padEnd(16, "1");
  const signature = edSign(null, Buffer.from(buildMessage(wallet, timestamp, nonce)), privateKey);
  const auth = { audience: AUDIENCE, timestamp, nonce, signature: signature.toString("base64") };
  const result = await attempt(helloWith(auth, wallet));
  assert("合法 Ed25519 签名可入场", result.outcome === "welcome" && result.id === wallet, JSON.stringify(result));

  // 用例 2：重放同一份 auth → 4003（nonce 防重放）
  const replay = await attempt(helloWith(auth, wallet));
  assert("重放同一签名被拒（nonce）", replay.outcome === "close" && replay.code === CLOSE_BAD_HELLO, JSON.stringify(replay));
}

// 用例 3：伪造签名 → 4003
{
  const timestamp = Date.now();
  const nonce = encodeBase58(crypto.getRandomValues(new Uint8Array(18))).padEnd(16, "1");
  const forged = Buffer.alloc(64, 7).toString("base64");
  const auth = { audience: AUDIENCE, timestamp, nonce, signature: forged };
  const result = await attempt(helloWith(auth, wallet));
  assert("伪造签名被拒", result.outcome === "close" && result.code === CLOSE_BAD_HELLO, JSON.stringify(result));
}

// 用例 4：过期时间戳 → 4003（±2 分钟窗）
{
  const timestamp = Date.now() - 10 * 60 * 1000;
  const nonce = encodeBase58(crypto.getRandomValues(new Uint8Array(18))).padEnd(16, "1");
  const signature = edSign(null, Buffer.from(buildMessage(wallet, timestamp, nonce)), privateKey);
  const auth = { audience: AUDIENCE, timestamp, nonce, signature: signature.toString("base64") };
  const result = await attempt(helloWith(auth, wallet));
  assert("过期时间戳被拒", result.outcome === "close" && result.code === CLOSE_BAD_HELLO, JSON.stringify(result));
}

// 用例 5：无签名的钱包 hello → 4003；访客（无钱包）不受影响 → welcome
{
  const result = await attempt(helloWith(null, wallet));
  assert("无签名钱包被拒", result.outcome === "close" && result.code === CLOSE_BAD_HELLO, JSON.stringify(result));
  const guest = await attempt(helloWith(null, ""));
  assert("访客免签可入场", guest.outcome === "welcome" && String(guest.id).startsWith("guest-"), JSON.stringify(guest));
}

process.exit(process.exitCode ?? 0);
