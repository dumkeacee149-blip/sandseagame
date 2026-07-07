import type { GameState } from "../game/data";
import { subscribe, getState, setState } from "../game/store";
import { postChat } from "./chat";
import { t, onLangChange } from "../core/i18n";

// 任务链：起始金币为 0，任务奖励是玩家的第一桶金（自动发放）。
// 完成条件全部由 GameState 派生；已领奖记录在 state.claimedQuests（随存档持久化）。
// 任务文案在 i18n 里以 quest.<id> 为键（中英双语）。
type Quest = {
  readonly id: string;
  readonly reward: number;
  readonly done: (state: GameState) => boolean;
};

const QUESTS: readonly Quest[] = [
  { id: "ashore", reward: 15, done: (s) => s.visited.length >= 1 },
  { id: "crate", reward: 10, done: (s) => s.cratesBroken >= 1 },
  { id: "first-buy", reward: 20, done: (s) => s.trades >= 1 },
  { id: "first-sale", reward: 25, done: (s) => s.completedAwaySale },
  { id: "nest-egg", reward: 30, done: (s) => s.gold >= 150 },
  {
    id: "upgrade",
    reward: 40,
    done: (s) => s.upgrades.sail + s.upgrades.cargo + s.upgrades.hull >= 1,
  },
  { id: "saltcrest", reward: 20, done: (s) => s.visited.includes("saltcrest") },
  { id: "survive", reward: 25, done: (s) => s.bitesSurvived >= 1 },
  { id: "duneskull", reward: 50, done: (s) => s.visited.includes("duneskull") },
  { id: "sail2", reward: 60, done: (s) => s.upgrades.sail >= 2 },
  { id: "harpoon", reward: 40, done: (s) => s.harpoon },
  { id: "slay", reward: 80, done: (s) => s.wormKills >= 1 },
  { id: "map", reward: 100, done: (s) => s.mapPurchased },
  { id: "chest", reward: 200, done: (s) => s.completed },
] as const;

let panelEl: HTMLDivElement | null = null;
let claiming = false;

// 严格链式发奖：只有"当前环"可以完成——后面环的条件即使提前满足也不计，
// 直到轮到它（届时条件已满足则立即完成）。连锁达成循环处理直至稳定。
function claimDueRewards() {
  if (claiming) return;
  claiming = true;
  try {
    for (let guard = 0; guard < QUESTS.length + 1; guard += 1) {
      const state = getState();
      const next = QUESTS.find((quest) => !state.claimedQuests.includes(quest.id));
      if (!next || !next.done(state)) break;
      setState({
        ...state,
        gold: state.gold + next.reward,
        claimedQuests: [...state.claimedQuests, next.id],
      });
      postChat(t("npc.quartermaster"), t("quest.complete", { text: t(`quest.${next.id}`), reward: next.reward }));
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
    return `<li class="${cls}"><span class="quest-mark">${mark}</span><span>${t(`quest.${quest.id}`)}<em class="quest-reward">+${quest.reward}g</em></span></li>`;
  }).join("");

  const title = `<p class="quest-title">${t("quest.title")} <span class="quest-count">${claimedCount}/${QUESTS.length}</span></p>`;
  panelEl.innerHTML = state.completed
    ? `${title}<ul>${items}</ul><p class="quest-complete">${t("quest.allDone")}</p>`
    : `${title}<ul>${items}</ul>`;
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
  // 切换语言时任务列表立即重绘
  onLangChange(() => render(getState()));
}
