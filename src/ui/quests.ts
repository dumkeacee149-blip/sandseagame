import type { GameState } from "../game/data";
import { subscribe, getState } from "../game/store";

// 任务链：全部由 GameState 派生（无独立任务状态=永不失步），按顺序解锁显示
type Quest = {
  readonly id: string;
  readonly text: string;
  readonly done: (state: GameState) => boolean;
};

const QUESTS: readonly Quest[] = [
  { id: "buy", text: "Buy trade goods at the Oasis market", done: (s) => s.trades >= 1 },
  { id: "sell", text: "Sail to another port and sell for profit", done: (s) => s.trades >= 2 },
  {
    id: "upgrade",
    text: "Buy your first upgrade at the shipwright",
    done: (s) => s.upgrades.sail + s.upgrades.cargo + s.upgrades.hull >= 1,
  },
  { id: "sail2", text: "Upgrade sails to L2 — outrun the leviathan", done: (s) => s.upgrades.sail >= 2 },
  { id: "map", text: "Buy the treasure map at Duneskull Outpost", done: (s) => s.mapPurchased },
  { id: "chest", text: "Open the relic chest in the Sunken Ruins", done: (s) => s.completed },
] as const;

let panelEl: HTMLDivElement | null = null;

function render(state: GameState) {
  if (!panelEl) return;
  const firstOpen = QUESTS.findIndex((quest) => !quest.done(state));
  const items = QUESTS.map((quest, index) => {
    const done = quest.done(state);
    // 只显示已完成的和当前的下一步，未来任务保持神秘
    if (!done && index > firstOpen) return "";
    const cls = done ? "quest-item quest-done" : "quest-item quest-active";
    const mark = done ? "✓" : "►";
    return `<li class="${cls}"><span class="quest-mark">${mark}</span>${quest.text}</li>`;
  }).join("");

  panelEl.innerHTML = state.completed
    ? `<p class="quest-title">Voyage Log</p><ul>${items}</ul><p class="quest-complete">All legends fulfilled 🏴‍☠️</p>`
    : `<p class="quest-title">Voyage Log</p><ul>${items}</ul>`;
}

export function initQuests() {
  panelEl = document.createElement("div");
  panelEl.id = "quest-panel";
  panelEl.className = "quest-panel";
  document.body.appendChild(panelEl);
  render(getState());
  subscribe(render);
}
