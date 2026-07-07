// Solana 钱包身份（可选）：注入式 provider（Phantom/Solflare/Backpack）连接做身份绑定。
// 试玩期不设登录门：默认访客直接开玩；曾授权过的钱包静默重连沿用其独立存档。
// presence 联机握手对已连接钱包仍要求签名，防止冒名顶号。

type SolanaProvider = {
  isPhantom?: boolean;
  publicKey: { toString(): string } | null;
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  signMessage?(message: Uint8Array, display?: "utf8" | "hex"): Promise<{ signature: Uint8Array }>;
};

declare global {
  interface Window {
    solana?: SolanaProvider;
    solflare?: SolanaProvider;
    backpack?: SolanaProvider;
  }
}

const REMEMBER_KEY = "sandsea-wallet";
export const PRESENCE_AUTH_AUDIENCE = "sandsea-privateers-presence-v1";
let identity = "guest";

export function getIdentity() {
  return identity;
}

export function isWalletLinked() {
  return identity !== "guest";
}

export function shortIdentity() {
  if (identity === "guest") return "GUEST";
  return `${identity.slice(0, 4)}…${identity.slice(-4)}`;
}

function findProvider(): SolanaProvider | null {
  return window.solana ?? window.solflare ?? window.backpack ?? null;
}

export type PresenceAuth = {
  readonly audience: string;
  readonly timestamp: number;
  readonly nonce: string;
  readonly signature: string;
};

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.slice(i, i + 0x8000));
  }
  return btoa(binary);
}

function encodeBase64Url(bytes: Uint8Array) {
  return encodeBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createNonce() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

export function buildPresenceAuthMessage(wallet: string, timestamp: number, nonce: string) {
  return [
    "Sandsea Privateers Presence",
    `wallet=${wallet}`,
    `audience=${PRESENCE_AUTH_AUDIENCE}`,
    `timestamp=${timestamp}`,
    `nonce=${nonce}`,
  ].join("\n");
}

export async function createPresenceAuth(): Promise<PresenceAuth | null> {
  if (!isWalletLinked()) return null;
  const provider = findProvider();
  if (!provider?.signMessage) return null;
  const timestamp = Date.now();
  const nonce = createNonce();
  const message = buildPresenceAuthMessage(identity, timestamp, nonce);
  const result = await provider.signMessage(new TextEncoder().encode(message), "utf8");
  return {
    audience: PRESENCE_AUTH_AUDIENCE,
    timestamp,
    nonce,
    signature: encodeBase64(result.signature),
  };
}

// 显式连接（官网导航等场景复用）：连上即记忆，游戏侧走静默重连免弹窗。
// 无 provider 时引导装 Phantom，返回 null。
export async function connectWallet(): Promise<string | null> {
  const provider = findProvider();
  if (!provider) {
    window.open("https://phantom.com/", "_blank", "noopener");
    return null;
  }
  const result = await provider.connect();
  const key = result.publicKey.toString();
  localStorage.setItem(REMEMBER_KEY, key);
  identity = key;
  return key;
}

// 静默重连：仅在曾授权过时成功，失败不打扰用户
export async function silentReconnect(): Promise<string | null> {
  const provider = findProvider();
  if (!provider || !localStorage.getItem(REMEMBER_KEY)) return null;
  try {
    const result = await provider.connect({ onlyIfTrusted: true });
    identity = result.publicKey.toString();
    return identity;
  } catch {
    return null;
  }
}

// 启动身份解析：不设登录门。已授权过的钱包静默重连（沿用其独立存档），
// 其余情况一律访客身份直接进游戏。
export async function resolveIdentity(): Promise<string> {
  identity = "guest";
  const provider = findProvider();
  const remembered = localStorage.getItem(REMEMBER_KEY);
  if (provider && remembered) {
    try {
      const result = await provider.connect({ onlyIfTrusted: true });
      identity = result.publicKey.toString();
    } catch {
      // 静默重连失败 → 访客直接进
    }
  }
  return identity;
}
