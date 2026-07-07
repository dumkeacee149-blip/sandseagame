import type { GameState, GoodId, ItemId, PortId, SkillId, UpgradeId, OutfitState, EquipSlotId } from "../game/data";
import {
  GOODS,
  ITEMS,
  SKILLS,
  SKILL_BRANCHES,
  UPGRADES,
  TREASURE_MAP_COST,
  TOKEN_RATE,
  HARPOON_COST,
  OUTFIT_COLORS,
  cargoCapacity,
  cargoCount,
  findItem,
} from "../game/data";
import {
  findPort,
  buyGood,
  sellGood,
  buyUpgrade,
  buyTreasureMap,
  buyHarpoon,
  setOutfit,
  exchangeTokens,
  unitBuyPrice,
  unitSellPrice,
  buyItem,
  craftItem,
  sellItemBack,
  equipItem,
  unequipSlot,
  unlockSkill,
  skillPointsAvailable,
} from "../game/economy";
import { getState, setState, subscribe } from "../game/store";
import { applyOutfit } from "../game/player";
import { t, onLangChange } from "../core/i18n";

const UPGRADE_IDS: readonly UpgradeId[] = ["sail", "cargo", "hull"];

// 兑换代币功能暂不显示，等待后面迭代开放
const SHOW_TOKEN_EXCHANGE = false;

let panelEl: HTMLDivElement | null = null;
let currentPort: PortId | null = null;

export function isTradePanelOpen() {
  return currentPort !== null;
}

export function openTradePanel(portId: PortId) {
  currentPort = portId;
  ensurePanel();
  render(getState());
  if (panelEl) panelEl.hidden = false;
}

export function closeTradePanel() {
  currentPort = null;
  if (panelEl) panelEl.hidden = true;
}

function ensurePanel() {
  if (panelEl) return;
  panelEl = document.createElement("div");
  panelEl.id = "trade-panel";
  panelEl.className = "trade-panel";
  panelEl.hidden = true;
  document.body.appendChild(panelEl);

  // 事件委托：按钮携带 data-action/data-good/data-qty
  panelEl.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
    if (!button || !currentPort) return;
    const action = button.dataset.action;
    if (action === "close") {
      closeTradePanel();
      return;
    }
    if (action === "upgrade") {
      setState(buyUpgrade(getState(), button.dataset.upgrade as UpgradeId));
      return;
    }
    if (action === "treasure-map") {
      setState(buyTreasureMap(getState()));
      return;
    }
    if (action === "harpoon") {
      setState(buyHarpoon(getState()));
      return;
    }
    if (action === "outfit") {
      const slot = button.dataset.slot as keyof OutfitState;
      const color = button.dataset.color ?? "";
      const next = setOutfit(getState(), slot, color);
      setState(next);
      applyOutfit(next.outfit);
      return;
    }
    if (action === "exchange") {
      setState(exchangeTokens(getState(), 1));
      return;
    }
    if (action === "item-buy") {
      setState(buyItem(getState(), button.dataset.item as ItemId));
      return;
    }
    if (action === "item-craft") {
      setState(craftItem(getState(), button.dataset.item as ItemId));
      return;
    }
    if (action === "item-sell") {
      setState(sellItemBack(getState(), button.dataset.item as ItemId));
      return;
    }
    if (action === "item-equip") {
      setState(equipItem(getState(), button.dataset.item as ItemId));
      return;
    }
    if (action === "item-unequip") {
      setState(unequipSlot(getState(), button.dataset.slot as EquipSlotId));
      return;
    }
    if (action === "skill") {
      setState(unlockSkill(getState(), button.dataset.skill as SkillId));
      return;
    }
    const good = button.dataset.good as GoodId;
    const qty = Number(button.dataset.qty ?? 1);
    if (action === "buy") setState(buyGood(getState(), currentPort, good, qty));
    if (action === "sell") setState(sellGood(getState(), currentPort, good, qty));
  });

  subscribe((state) => {
    if (currentPort) render(state);
  });
  // 切换语言时面板若开着立即重绘
  onLangChange(() => {
    if (currentPort) render(getState());
  });
}

function render(state: GameState) {
  if (!panelEl || !currentPort) return;
  const port = findPort(currentPort);
  const capacity = cargoCapacity(state);
  const held = cargoCount(state);

  const rows = GOODS.map((good) => {
    // 展示价与结算价同源（含商贾技能调价），避免 UI 与实扣不一致
    const buyPrice = unitBuyPrice(state, port.id, good.id);
    const sellPrice = unitSellPrice(state, port.id, good.id);
    const owned = state.cargo[good.id];
    const canBuy = (qty: number) =>
      buyPrice !== undefined && state.gold >= buyPrice * qty && held + qty <= capacity;
    const canSell = (qty: number) => sellPrice !== undefined && owned >= qty;

    const buyButtons =
      buyPrice === undefined
        ? `<span class="trade-na">—</span>`
        : [1, 5]
            .map(
              (qty) =>
                `<button data-action="buy" data-good="${good.id}" data-qty="${qty}" ${canBuy(qty) ? "" : "disabled"}>${t("trade.buy", { qty, price: buyPrice * qty })}</button>`,
            )
            .join("");
    const sellButtons =
      sellPrice === undefined
        ? `<span class="trade-na">—</span>`
        : [1, 5]
            .map(
              (qty) =>
                `<button data-action="sell" data-good="${good.id}" data-qty="${qty}" ${canSell(qty) ? "" : "disabled"}>${t("trade.sell", { qty, price: sellPrice * qty })}</button>`,
            )
            .join("");

    return `
      <div class="trade-row">
        <div class="trade-good"><b>${t(`good.${good.id}`)}</b><span>${t("trade.held", { n: owned })}</span></div>
        <div class="trade-actions">${buyButtons}</div>
        <div class="trade-actions">${sellButtons}</div>
      </div>`;
  }).join("");

  const upgradeRows = UPGRADE_IDS
    .map((id) => {
      const unit = t(`upgrade.${id}.unit`);
      const level = state.upgrades[id];
      const tiers = UPGRADES[id];
      const current = tiers[level];
      const next = tiers[level + 1];
      const action = next
        ? `<button data-action="upgrade" data-upgrade="${id}" ${state.gold >= next.cost ? "" : "disabled"}>${t("trade.upgradeBtn", { level: level + 1, value: next.value, unit, cost: next.cost })}</button>`
        : `<span class="trade-na">${t("trade.max")}</span>`;
      return `
      <div class="trade-row">
        <div class="trade-good"><b>${t(`upgrade.${id}`)}</b><span>L${level} · ${current.value} ${unit}</span></div>
        <div class="trade-actions trade-upgrade">${action}</div>
      </div>`;
    })
    .join("");

  // 鱼叉炮：猎杀沙虫的门槛（Shipwright 追加行）
  const harpoonRow = `
      <div class="trade-row">
        <div class="trade-good"><b>${t("harpoon.name")}</b><span>${state.harpoon ? t("harpoon.mounted") : t("harpoon.pitch")}</span></div>
        <div class="trade-actions trade-upgrade">${
          state.harpoon
            ? `<span class="trade-na">${t("harpoon.mountedTag")}</span>`
            : `<button data-action="harpoon" ${state.gold >= HARPOON_COST ? "" : "disabled"}>${t("harpoon.buy", { cost: HARPOON_COST })}</button>`
        }</div>
      </div>`;

  // 铁匠：购买/打造/装备/回售。敌人不掉装备——材料打造是战斗产出的变现口之一。
  const craftLabel = (item: (typeof ITEMS)[number]) =>
    Object.entries(item.craft ?? {})
      .map(([good, need]) => `${need} ${t(`good.${good}`)}`)
      .join(" + ");
  const canCraft = (item: (typeof ITEMS)[number]) =>
    Object.entries(item.craft ?? {}).every(([good, need]) => state.cargo[good as GoodId] >= need);

  const itemRows = ITEMS.map((item) => {
    const owned = state.ownedItems.includes(item.id);
    const equipped = state.equipment[item.slot] === item.id;
    let actions: string;
    if (!owned) {
      if (item.cost > 0) {
        actions = `<button data-action="item-buy" data-item="${item.id}" ${state.gold >= item.cost ? "" : "disabled"}>${t("item.buy", { cost: item.cost })}</button>`;
      } else if (item.craft) {
        actions = `<button data-action="item-craft" data-item="${item.id}" ${canCraft(item) ? "" : "disabled"}>${t("item.craft", { mats: craftLabel(item) })}</button>`;
      } else {
        actions = `<span class="trade-na">${t("item.questReward")}</span>`;
      }
    } else {
      const equipBtn = equipped
        ? `<button data-action="item-unequip" data-slot="${item.slot}">${t("item.unequip")}</button>`
        : `<button data-action="item-equip" data-item="${item.id}">${t("item.equip")}</button>`;
      const sellBtn =
        item.cost > 0
          ? `<button data-action="item-sell" data-item="${item.id}">${t("item.sell", { gold: Math.floor(item.cost / 2) })}</button>`
          : "";
      actions = equipBtn + sellBtn;
    }
    return `
      <div class="trade-row">
        <div class="trade-good"><b>${equipped ? "⚔ " : ""}${t(`item.${item.id}`)}</b><span>${t(`slot.${item.slot}`)} · ${t(`item.${item.id}.desc`)}</span></div>
        <div class="trade-actions trade-upgrade">${actions}</div>
      </div>`;
  }).join("");

  // 技能树：三分支线性解锁；点数只来自任务与里程碑（防击杀刷点）
  const points = skillPointsAvailable(state);
  const skillRows = SKILL_BRANCHES.map((branch) => {
    const tiers = SKILLS.filter((skill) => skill.branch === branch);
    const cells = tiers
      .map((skill) => {
        const unlocked = state.skills.includes(skill.id);
        const prevOk =
          skill.tier === 1 ||
          state.skills.some((id) => {
            const owned = SKILLS.find((entry) => entry.id === id);
            return owned?.branch === skill.branch && owned.tier === skill.tier - 1;
          });
        const name = t(`skill.${skill.id}`);
        const desc = t(`skill.${skill.id}.desc`);
        if (unlocked) return `<span class="skill-cell skill-owned" title="${desc}">✓ ${name}</span>`;
        if (prevOk)
          return `<button class="skill-cell" data-action="skill" data-skill="${skill.id}" title="${desc}" ${points > 0 ? "" : "disabled"}>${name}</button>`;
        return `<span class="skill-cell skill-locked" title="${desc}">🔒 ${name}</span>`;
      })
      .join("");
    return `
      <div class="trade-row">
        <div class="trade-good"><b>${t(`branch.${branch}`)}</b></div>
        <div class="trade-actions skill-track">${cells}</div>
      </div>`;
  }).join("");

  // 更衣室：三槽六色
  const outfitSlots: Array<{ slot: keyof OutfitState; label: string }> = [
    { slot: "bandana", label: t("outfit.bandana") },
    { slot: "cloth", label: t("outfit.cloth") },
    { slot: "leather", label: t("outfit.leather") },
  ];
  const outfitRows = outfitSlots
    .map(({ slot, label }) => {
      const swatches = OUTFIT_COLORS.map(
        (color) =>
          `<button class="swatch ${state.outfit[slot] === color ? "swatch-active" : ""}" data-action="outfit" data-slot="${slot}" data-color="${color}" style="background:${color}" aria-label="${label} ${color}"></button>`,
      ).join("");
      return `
      <div class="trade-row">
        <div class="trade-good"><b>${label}</b></div>
        <div class="trade-actions trade-upgrade">${swatches}</div>
      </div>`;
    })
    .join("");

  // 藏宝图只在危险远港 Duneskull 出售（主题自洽：越险的地方越接近传说）
  const treasureRow =
    port.id === "duneskull" && !state.completed
      ? `
      <p class="trade-eyebrow trade-section">${t("rumors.title")}</p>
      <div class="trade-row">
        <div class="trade-good"><b>${t("map.name")}</b><span>${state.mapPurchased ? t("map.owned") : t("map.pitch")}</span></div>
        <div class="trade-actions trade-upgrade">${
          state.mapPurchased
            ? `<span class="trade-na">${t("map.ownedTag")}</span>`
            : `<button data-action="treasure-map" ${state.gold >= TREASURE_MAP_COST ? "" : "disabled"}>${t("map.buy", { cost: TREASURE_MAP_COST })}</button>`
        }</div>
      </div>`
      : "";

  // 金库兑换：金币 → $SAND（预发布记账，TGE 后接链上结算）
  const exchangeRow = !SHOW_TOKEN_EXCHANGE
    ? ""
    : `
      <p class="trade-eyebrow trade-section">Token Vault</p>
      <div class="trade-row">
        <div class="trade-good"><b>$SAND Ledger</b><span>holding ${state.tokens} · pre-launch ledger, settles on-chain at token launch</span></div>
        <div class="trade-actions trade-upgrade">
          <button data-action="exchange" ${state.gold >= TOKEN_RATE ? "" : "disabled"}>Exchange · ${TOKEN_RATE}g → 1 $SAND</button>
        </div>
      </div>`;

  panelEl.innerHTML = `
    <div class="trade-head">
      <div>
        <p class="trade-eyebrow">${t("trade.market", { port: t(`port.${port.id}`) })}</p>
        <p class="trade-stats">${t("trade.stats", { gold: state.gold, held, cap: capacity, tokens: state.tokens })}</p>
      </div>
      <button data-action="close" class="trade-close" aria-label="Close">✕</button>
    </div>
    ${rows}
    <p class="trade-eyebrow trade-section">${t("trade.upgrades")}</p>
    ${upgradeRows}
    ${harpoonRow}
    <p class="trade-eyebrow trade-section">${t("gear.title")}</p>
    ${itemRows}
    <p class="trade-eyebrow trade-section">${t(points === 1 ? "skills.title.one" : "skills.title.many", { points })}</p>
    ${skillRows}
    <p class="trade-eyebrow trade-section">${t("outfit.title")}</p>
    ${outfitRows}
    ${treasureRow}
    ${exchangeRow}
    <p class="trade-hint">${t("trade.leave")}</p>`;
}
