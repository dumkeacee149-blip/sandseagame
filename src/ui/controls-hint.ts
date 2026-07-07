import { t, onLangChange } from "../core/i18n";

// 模式化快捷键条：底部常驻，按 航行/步行 切换内容；键帽 <kbd> + 内联鼠标图标。
// 触屏与窄屏由既有 CSS 规则隐藏（.touch-mode / @media max-width:900px）。

// 鼠标图标：左键高亮 / 拖拽箭头（纯内联 SVG，无外部资源）
const MOUSE_LEFT_SVG = `<svg viewBox="0 0 14 20" fill="none" aria-hidden="true"><rect x="1" y="1" width="12" height="18" rx="6" stroke="currentColor" stroke-width="1.4"/><path d="M7 1 H3.5 A2.5 2.5 0 0 0 1 3.5 V8 H7 Z" fill="currentColor"/><line x1="7" y1="1" x2="7" y2="8" stroke="currentColor" stroke-width="1.2"/></svg>`;
const MOUSE_DRAG_SVG = `<svg viewBox="0 0 22 20" fill="none" aria-hidden="true"><rect x="5" y="1" width="12" height="18" rx="6" stroke="currentColor" stroke-width="1.4"/><path d="M3.5 7 L1 10 L3.5 13" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M18.5 7 L21 10 L18.5 13" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>`;

type HintMode = "sailing" | "walking";

let hintEl: HTMLElement | null = null;
let lastKey = "";

function chip(icon: string, label: string, warn = false) {
  return `<span class="hint-chip${warn ? " hint-warn" : ""}">${icon}<span>${label}</span></span>`;
}

function kbd(keys: string) {
  return `<kbd>${keys}</kbd>`;
}

function render(mode: HintMode, harpoon: boolean) {
  if (!hintEl) return;
  const chips =
    mode === "sailing"
      ? [
          chip(kbd("WASD"), t("hint.sail")),
          harpoon
            ? chip(MOUSE_LEFT_SVG, t("hint.fire"))
            : chip(MOUSE_LEFT_SVG, t("hint.noWeapon"), true),
          chip(kbd("E"), t("hint.ashore")),
          chip(MOUSE_DRAG_SVG, t("hint.rotate")),
          chip(kbd("Enter"), t("hint.chat")),
        ]
      : [
          chip(kbd("WASD"), t("hint.move")),
          chip(kbd("Shift"), t("hint.sprint")),
          chip(kbd("Space"), t("hint.jump")),
          chip(MOUSE_LEFT_SVG, t("hint.attack")),
          chip(kbd("E"), t("hint.interact")),
          chip(MOUSE_DRAG_SVG, t("hint.rotate")),
        ];
  hintEl.innerHTML = chips.join("");
}

export function initControlsHint() {
  hintEl = document.querySelector<HTMLElement>("#controls-hint");
  onLangChange(() => {
    // 语言切换强制重绘（下一帧 updateControlsHint 会带最新 mode 进来）
    lastKey = "";
  });
}

// 每帧调用；内容只在 模式/鱼叉/语言 变化时重绘
export function updateControlsHint(mode: HintMode, harpoon: boolean) {
  const key = `${mode}:${harpoon}`;
  if (key === lastKey) return;
  lastKey = key;
  render(mode, harpoon);
}
