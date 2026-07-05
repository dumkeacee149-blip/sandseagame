import { setKeyCapture, isKeyCaptured } from "../core/input";

// 港湾频道：UI 与消息流已就绪，当前为本地模式（NPC 闲聊 + 系统播报 + 玩家发言）。
// W3 部署时接 Cloudflare Worker WebSocket 即升级为真全服频道——只需替换 transport。

type ChatKind = "player" | "npc" | "system";

const MAX_MESSAGES = 9;

// NPC 闲聊（原创台词，给单机世界一点人气）
const NPC_CHATTER: Array<[string, string]> = [
  ["Mirza the Trader", "Spice is fetching mad prices out at Duneskull, if you dare the worm."],
  ["Old Salt Beshir", "Saw the leviathan breach at dusk. Bigger than last season, I swear."],
  ["Mirza the Trader", "Dates buy low here, sell sweet at Saltcrest. Easy run for a new sail."],
  ["Dockhand Nur", "Keep your hull patched, Captain. The sandsea forgives nothing."],
  ["Old Salt Beshir", "They say a relic vault sleeps under the Sunken Ruins. Maps cost a fortune."],
  ["Dockhand Nur", "Wind's turning. Good day to run the near route twice."],
  ["Mirza the Trader", "A cargo hold upgrade pays itself back in three runs. Just saying."],
];

let logEl: HTMLUListElement | null = null;
let inputEl: HTMLInputElement | null = null;

function appendMessage(author: string, text: string, kind: ChatKind) {
  if (!logEl) return;
  const item = document.createElement("li");
  item.className = `chat-line chat-${kind}`;
  const who = document.createElement("b");
  who.textContent = author;
  item.appendChild(who);
  item.appendChild(document.createTextNode(` ${text}`));
  logEl.appendChild(item);
  while (logEl.children.length > MAX_MESSAGES) logEl.removeChild(logEl.children[0]);
}

export function postChat(author: string, text: string, kind: ChatKind = "system") {
  appendMessage(author, text, kind);
}

export function isChatOpen() {
  return Boolean(inputEl && !inputEl.hidden);
}

function openChatInput() {
  if (!inputEl) return;
  inputEl.hidden = false;
  inputEl.value = "";
  setKeyCapture(true);
  inputEl.focus();
}

function closeChatInput() {
  if (!inputEl) return;
  inputEl.hidden = true;
  inputEl.blur();
  setKeyCapture(false);
}

function sendCurrent() {
  if (!inputEl) return;
  const text = inputEl.value.trim();
  if (text) {
    // 本地模式：直接回显；接入 WebSocket 后改为 transport.send(text)
    appendMessage("Captain (you)", text, "player");
  }
  closeChatInput();
}

export function initChat() {
  logEl = document.querySelector<HTMLUListElement>("#chat-log");
  inputEl = document.querySelector<HTMLInputElement>("#chat-input");
  if (!inputEl) return;

  window.addEventListener("keydown", (event) => {
    if (event.code !== "Enter") return;
    if (!isChatOpen() && !isKeyCaptured()) {
      event.preventDefault();
      openChatInput();
    }
  });

  inputEl.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.code === "Enter") sendCurrent();
    if (event.code === "Escape") closeChatInput();
  });
  // 点走焦点视为放弃输入
  inputEl.addEventListener("blur", () => {
    if (isChatOpen()) closeChatInput();
  });

  appendMessage("Harbormaster", "Welcome to the Sandsea, Captain. Markets are marked overhead.", "npc");

  // 环境闲聊：25-45 秒一条，60% 概率发声，避免刷屏
  const scheduleChatter = () => {
    const delay = 25000 + Math.random() * 20000;
    setTimeout(() => {
      if (Math.random() < 0.6) {
        const [author, line] = NPC_CHATTER[Math.floor(Math.random() * NPC_CHATTER.length)];
        appendMessage(author, line, "npc");
      }
      scheduleChatter();
    }, delay);
  };
  scheduleChatter();
}
