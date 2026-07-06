// Solana 钱包登录：注入式 provider（Phantom/Solflare/Backpack）连接做身份绑定。
// 说明：当前为客户端身份绑定（publicKey 即玩家 ID，存档按钱包隔离）。
// 真正的防伪登录（Sign-in-with-Solana 签名验证）需要后端配合，接服务器时升级。

type SolanaProvider = {
  isPhantom?: boolean;
  publicKey: { toString(): string } | null;
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
};

declare global {
  interface Window {
    solana?: SolanaProvider;
    solflare?: SolanaProvider;
    backpack?: SolanaProvider;
  }
}

const REMEMBER_KEY = "sandsea-wallet";
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

function buildGate(onResolve: () => void) {
  const gate = document.createElement("div");
  gate.id = "wallet-gate";
  gate.className = "wallet-gate";
  const provider = findProvider();
  gate.innerHTML = `
    <div class="wallet-card">
      <p class="trade-eyebrow">Sandsea Privateers</p>
      <p class="wallet-title">Link your wallet to sail</p>
      <p class="wallet-line">Your Solana wallet is your captain's identity — progress is saved per wallet, and in-game $SAND ledger binds to it.</p>
      <button class="modal-button" id="wallet-connect">${provider ? "Connect Wallet" : "Install Phantom"}</button>
      <p class="wallet-line wallet-guest-line"><a href="#" id="wallet-guest">Enter as guest</a> — progress stays on this device only</p>
    </div>`;
  document.body.appendChild(gate);

  const finish = (id: string) => {
    identity = id;
    gate.remove();
    onResolve();
  };

  gate.querySelector("#wallet-connect")?.addEventListener("click", async () => {
    const current = findProvider();
    if (!current) {
      window.open("https://phantom.com/", "_blank", "noopener");
      return;
    }
    try {
      const result = await current.connect();
      const key = result.publicKey.toString();
      localStorage.setItem(REMEMBER_KEY, key);
      finish(key);
    } catch (error) {
      console.error("钱包连接被拒绝", error);
    }
  });

  gate.querySelector("#wallet-guest")?.addEventListener("click", (event) => {
    event.preventDefault();
    finish("guest");
  });
}

// 启动身份解析：开发环境自动访客（?wallet=1 强制真流程）；
// 已授权过的钱包静默重连，否则弹登录门。
export async function resolveIdentity(): Promise<string> {
  const params = new URLSearchParams(location.search);
  const forceWallet = params.get("wallet") === "1";
  if (import.meta.env.DEV && !forceWallet) {
    identity = "guest";
    return identity;
  }

  const provider = findProvider();
  const remembered = localStorage.getItem(REMEMBER_KEY);
  if (provider && remembered) {
    try {
      const result = await provider.connect({ onlyIfTrusted: true });
      identity = result.publicKey.toString();
      return identity;
    } catch {
      // 静默重连失败 → 走登录门
    }
  }

  return new Promise((resolve) => {
    buildGate(() => resolve(identity));
  });
}
