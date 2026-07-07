import { connectWallet, silentReconnect, shortIdentity } from "./core/wallet";

// 官网导航钱包按钮：连接后显示短地址并变身"进游戏"入口；
// 与游戏共用记忆键，这里连过、进游戏即静默登录。
const button = document.getElementById("nav-wallet") as HTMLAnchorElement | null;

if (button) {
  initNavWallet(button);
}

function markLinked(anchor: HTMLAnchorElement) {
  anchor.textContent = `⚓ ${shortIdentity()}`;
  anchor.href = "/?play=1";
  anchor.dataset.linked = "1";
}

function initNavWallet(anchor: HTMLAnchorElement) {
  silentReconnect().then((key) => {
    if (key) markLinked(anchor);
  });

  anchor.addEventListener("click", async (event) => {
    if (anchor.dataset.linked) return; // 已连接：作为普通链接进游戏
    event.preventDefault();
    try {
      const key = await connectWallet();
      if (key) markLinked(anchor);
    } catch (error) {
      // 用户在钱包弹窗里点了拒绝：保持按钮原样即可
      console.error("钱包连接被拒绝", error);
    }
  });
}
