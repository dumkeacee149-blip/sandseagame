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

let lastMessageKey = "";

function appendMessage(author: string, text: string, kind: ChatKind) {
  if (!logEl) return;
  // 连续重复消息去重（防刷屏）
  const key = `${author}|${text}`;
  if (key === lastMessageKey) return;
  lastMessageKey = key;
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

// 全服 transport：配置 VITE_CHAT_WS_URL 后走 WebSocket；否则本地回显模式
let socket: WebSocket | null = null;
let socketReady = false;

function connectGlobalChat() {
  const url = import.meta.env.VITE_CHAT_WS_URL as string | undefined;
  if (!url) return;
  try {
    socket = new WebSocket(url);
    socket.addEventListener("open", () => {
      socketReady = true;
      const badge = document.querySelector(".chat-local");
      if (badge) badge.textContent = "GLOBAL";
      appendMessage("Harbormaster", "Connected to the global Harbor Band.", "npc");
    });
    socket.addEventListener("message", (event) => {
      try {
        const { author, text } = JSON.parse(event.data);
        if (typeof author === "string" && typeof text === "string") {
          appendMessage(author, text, "player");
        }
      } catch {
        // 忽略无法解析的帧
      }
    });
    const fallback = () => {
      socketReady = false;
      socket = null;
    };
    socket.addEventListener("close", fallback);
    socket.addEventListener("error", fallback);
  } catch (error) {
    console.error("全服聊天连接失败，回退本地模式", error);
  }
}

function sendCurrent() {
  if (!inputEl) return;
  const text = inputEl.value.trim();
  if (text) {
    if (socket && socketReady) {
      socket.send(JSON.stringify({ author: "Captain", text }));
    } else {
      // 本地模式：直接回显
      appendMessage("Captain (you)", text, "player");
    }
  }
  closeChatInput();
}

let initialized = false;

export function initChat() {
  if (initialized) return;
  initialized = true;
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
  connectGlobalChat();

  // 环境闲聊：40-75 秒一条，顺序轮播不重复
  let chatterIndex = Math.floor(Math.random() * NPC_CHATTER.length);
  const scheduleChatter = () => {
    const delay = 40000 + Math.random() * 35000;
    setTimeout(() => {
      const [author, line] = NPC_CHATTER[chatterIndex % NPC_CHATTER.length];
      chatterIndex += 1;
      appendMessage(author, line, "npc");
      scheduleChatter();
    }, delay);
  };
  scheduleChatter();
}
