import { setKeyCapture, isKeyCaptured } from "../core/input";
import { t, onLangChange } from "../core/i18n";

// 港湾频道：UI 与消息流已就绪，当前为本地模式（NPC 闲聊 + 系统播报 + 玩家发言）。
// W3 部署时接 Cloudflare Worker WebSocket 即升级为真全服频道——只需替换 transport。

type ChatKind = "player" | "npc" | "system";

const MAX_MESSAGES = 9;

// NPC 闲聊（i18n 键值对，发送时按当前语言取文案）
const NPC_CHATTER: Array<[string, string]> = [
  ["npc.mirza", "chatter.1"],
  ["npc.beshir", "chatter.2"],
  ["npc.mirza", "chatter.3"],
  ["npc.nur", "chatter.4"],
  ["npc.beshir", "chatter.5"],
  ["npc.nur", "chatter.6"],
  ["npc.mirza", "chatter.7"],
];

let logEl: HTMLUListElement | null = null;
let inputEl: HTMLInputElement | null = null;

let lastMessageKey = "";

// 消息存"键"不存译文：切换语言时整条日志按当前语言重渲染。
// 玩家发言与远端消息是原始字符串，不参与翻译。
type I18nRef = { readonly key: string; readonly params?: Readonly<Record<string, string | number | { key: string }>> };
type Part = string | I18nRef;
type StoredMessage = { readonly kind: ChatKind; readonly author: Part; readonly text: Part };

const messages: StoredMessage[] = [];

function resolvePart(part: Part): string {
  if (typeof part === "string") return part;
  if (!part.params) return t(part.key);
  // 参数值本身也可以是 i18n 键（如任务名/港口名），渲染时一并按当前语言解析
  const params: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(part.params)) {
    params[name] = typeof value === "object" ? t(value.key) : value;
  }
  return t(part.key, params);
}

function renderLog() {
  if (!logEl) return;
  logEl.innerHTML = "";
  for (const message of messages) {
    const item = document.createElement("li");
    item.className = `chat-line chat-${message.kind}`;
    const who = document.createElement("b");
    who.textContent = resolvePart(message.author);
    item.appendChild(who);
    item.appendChild(document.createTextNode(` ${resolvePart(message.text)}`));
    logEl.appendChild(item);
  }
}

function appendMessage(author: Part, text: Part, kind: ChatKind) {
  // 连续重复消息去重（防刷屏）：按键/原文比较，与语言无关
  const key = JSON.stringify([author, text]);
  if (key === lastMessageKey) return;
  lastMessageKey = key;
  messages.push({ kind, author, text });
  while (messages.length > MAX_MESSAGES) messages.shift();
  renderLog();
}

// 原始字符串消息（玩家发言/远端转发；不翻译）
export function postChat(author: string, text: string, kind: ChatKind = "system") {
  appendMessage(author, text, kind);
}

// 系统/NPC 消息按 i18n 键投递，切语言时随日志重译
export function postChatT(
  authorKey: string,
  textKey: string,
  params?: Readonly<Record<string, string | number | { key: string }>>,
  kind: ChatKind = "system",
) {
  appendMessage({ key: authorKey }, { key: textKey, params }, kind);
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
      const badge = document.querySelector<HTMLElement>(".chat-local");
      if (badge) {
        // 改写 data-i18n 键，语言切换时 applyStaticI18n 能保持"全服"标记
        badge.dataset.i18n = "chat.global";
        badge.textContent = t("chat.global");
      }
      postChatT("npc.harbormaster", "chat.globalConnected", undefined, "npc");
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
      // 本地模式：直接回显（名号随语言重译，正文保持玩家原文）
      appendMessage({ key: "chat.you" }, text, "player");
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
  const stopPointerInput = (event: Event) => event.stopPropagation();
  for (const eventName of ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "touchstart", "touchend"]) {
    inputEl.addEventListener(eventName, stopPointerInput);
  }
  // 点走焦点视为放弃输入
  inputEl.addEventListener("blur", () => {
    if (isChatOpen()) closeChatInput();
  });

  postChatT("npc.harbormaster", "chat.welcome", undefined, "npc");
  connectGlobalChat();

  // 切换语言：日志按当前语言整体重译（键值消息重译，玩家原文不动）
  onLangChange(renderLog);

  // 环境闲聊：40-75 秒一条，顺序轮播不重复
  let chatterIndex = Math.floor(Math.random() * NPC_CHATTER.length);
  const scheduleChatter = () => {
    const delay = 40000 + Math.random() * 35000;
    setTimeout(() => {
      const [authorKey, lineKey] = NPC_CHATTER[chatterIndex % NPC_CHATTER.length];
      chatterIndex += 1;
      postChatT(authorKey, lineKey, undefined, "npc");
      scheduleChatter();
    }, delay);
  };
  scheduleChatter();
}
