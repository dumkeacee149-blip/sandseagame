import type { GameState } from "../game/data";
import { subscribe, getState, setState } from "../game/store";
import { postChat } from "./chat";

// 任务链：起始金币为 0，任务奖励是玩家的第一桶金（自动发放）。
// 完成条件全部由 GameState 派生；已领奖记录在 state.claimedQuests（随存档持久化）。
type Quest = {
  readonly id: string;
  readonly text: string;
  readonly reward: number;
  readonly done: (state: GameState) => boolean;
};

const QUESTS: readonly Quest[] = [
  { id: "ashore", text: "Dock at Oasis Harbor and go ashore", reward: 15, done: (s) => s.visited.length >= 1 },
  { id: "crate", text: "Crack open a supply crate", reward: 10, done: (s) => s.cratesBroken >= 1 },
  { id: "first-buy", text: "Buy trade goods at a market", reward: 20, done: (s) => s.trades >= 1 },
  { id: "first-sale", text: "Sell cargo at another port", reward: 25, done: (s) => s.trades >= 2 },
  { id: "nest-egg", text: "Hold 150 gold at once", reward: 30, done: (s) => s.gold >= 150 },
  {
    id: "upgrade",
    text: "Buy your first shipwright upgrade",
    reward: 40,
    done: (s) => s.upgrades.sail + s.upgrades.cargo + s.upgrades.hull >= 1,
  },
  { id: "saltcrest", text: "Set foot in Saltcrest", reward: 20, done: (s) => s.visited.includes("saltcrest") },
  { id: "survive", text: "Survive a leviathan bite", reward: 25, done: (s) => s.bitesSurvived >= 1 },
  { id: "duneskull", text: "Reach Duneskull Outpost", reward: 50, done: (s) => s.visited.includes("duneskull") },
  { id: "sail2", text: "Upgrade sails to L2 — outrun the leviathan", reward: 60, done: (s) => s.upgrades.sail >= 2 },
  { id: "map", text: "Buy the treasure map at Duneskull", reward: 100, done: (s) => s.mapPurchased },
  { id: "chest", text: "Open the relic chest in the Sunken Ruins", reward: 200, done: (s) => s.completed },
] as const;

let panelEl: HTMLDivElement | null = null;
let claiming = false;

// 自动发奖：达成即领；连锁达成（奖励让金币达标下一个任务）循环处理直至稳定
function claimDueRewards() {
  if (claiming) return;
  claiming = true;
  try {
    for (let guard = 0; guard < QUESTS.length + 1; guard += 1) {
      const state = getState();
      const due = QUESTS.filter((quest) => quest.done(state) && !state.claimedQuests.includes(quest.id));
      if (due.length === 0) break;
      const total = due.reduce((sum, quest) => sum + quest.reward, 0);
      setState({
        ...state,
        gold: state.gold + total,
        claimedQuests: [...state.claimedQuests, ...due.map((quest) => quest.id)],
      });
      for (const quest of due) {
        postChat("Quartermaster", `Quest complete: ${quest.text} (+${quest.reward}g)`);
      }
    }
  } finally {
    claiming = false;
  }
}

function render(state: GameState) {
  if (!panelEl) return;
  const claimedCount = state.claimedQuests.length;
  const firstOpen = QUESTS.findIndex((quest) => !state.claimedQuests.includes(quest.id));
  const items = QUESTS.map((quest, index) => {
    const claimed = state.claimedQuests.includes(quest.id);
    // 已完成全部显示；未完成只露当前一个，后续保持神秘
    if (!claimed && index > firstOpen) return "";
    const cls = claimed ? "quest-item quest-done" : "quest-item quest-active";
    const mark = claimed ? "✓" : "►";
    return `<li class="${cls}"><span class="quest-mark">${mark}</span><span>${quest.text}<em class="quest-reward">+${quest.reward}g</em></span></li>`;
  }).join("");

  panelEl.innerHTML = state.completed
    ? `<p class="quest-title">Voyage Log <span class="quest-count">${claimedCount}/${QUESTS.length}</span></p><ul>${items}</ul><p class="quest-complete">All legends fulfilled 🏴‍☠️</p>`
    : `<p class="quest-title">Voyage Log <span class="quest-count">${claimedCount}/${QUESTS.length}</span></p><ul>${items}</ul>`;
}

export function initQuests() {
  panelEl = document.createElement("div");
  panelEl.id = "quest-panel";
  panelEl.className = "quest-panel";
  document.body.appendChild(panelEl);
  render(getState());
  subscribe(() => {
    claimDueRewards();
    // 发奖可能已再次更新 store，渲染必须读最新状态而不是回调参数
    render(getState());
  });
}
