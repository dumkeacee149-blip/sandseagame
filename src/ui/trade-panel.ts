import type { GameState, GoodId, PortId, UpgradeId, OutfitState } from "../game/data";
import {
  GOODS,
  UPGRADES,
  TREASURE_MAP_COST,
  TOKEN_RATE,
  HARPOON_COST,
  OUTFIT_COLORS,
  cargoCapacity,
  cargoCount,
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
} from "../game/economy";
import { getState, setState, subscribe } from "../game/store";
import { applyOutfit } from "../game/player";

const UPGRADE_LABELS: Record<UpgradeId, { name: string; unit: string }> = {
  sail: { name: "Sail", unit: "speed" },
  cargo: { name: "Cargo Hold", unit: "slots" },
  hull: { name: "Hull", unit: "HP" },
};

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
    const good = button.dataset.good as GoodId;
    const qty = Number(button.dataset.qty ?? 1);
    if (action === "buy") setState(buyGood(getState(), currentPort, good, qty));
    if (action === "sell") setState(sellGood(getState(), currentPort, good, qty));
  });

  subscribe((state) => {
    if (currentPort) render(state);
  });
}

function render(state: GameState) {
  if (!panelEl || !currentPort) return;
  const port = findPort(currentPort);
  const capacity = cargoCapacity(state);
  const held = cargoCount(state);

  const rows = GOODS.map((good) => {
    const buyPrice = port.buy[good.id];
    const sellPrice = port.sell[good.id];
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
                `<button data-action="buy" data-good="${good.id}" data-qty="${qty}" ${canBuy(qty) ? "" : "disabled"}>Buy ${qty} · ${buyPrice * qty}g</button>`,
            )
            .join("");
    const sellButtons =
      sellPrice === undefined
        ? `<span class="trade-na">—</span>`
        : [1, 5]
            .map(
              (qty) =>
                `<button data-action="sell" data-good="${good.id}" data-qty="${qty}" ${canSell(qty) ? "" : "disabled"}>Sell ${qty} · ${sellPrice * qty}g</button>`,
            )
            .join("");

    return `
      <div class="trade-row">
        <div class="trade-good"><b>${good.name}</b><span>held ${owned}</span></div>
        <div class="trade-actions">${buyButtons}</div>
        <div class="trade-actions">${sellButtons}</div>
      </div>`;
  }).join("");

  const upgradeRows = (Object.keys(UPGRADE_LABELS) as UpgradeId[])
    .map((id) => {
      const label = UPGRADE_LABELS[id];
      const level = state.upgrades[id];
      const tiers = UPGRADES[id];
      const current = tiers[level];
      const next = tiers[level + 1];
      const action = next
        ? `<button data-action="upgrade" data-upgrade="${id}" ${state.gold >= next.cost ? "" : "disabled"}>L${level + 1} · ${next.value} ${label.unit} · ${next.cost}g</button>`
        : `<span class="trade-na">MAX</span>`;
      return `
      <div class="trade-row">
        <div class="trade-good"><b>${label.name}</b><span>L${level} · ${current.value} ${label.unit}</span></div>
        <div class="trade-actions trade-upgrade">${action}</div>
      </div>`;
    })
    .join("");

  // 鱼叉炮：猎杀沙虫的门槛（Shipwright 追加行）
  const harpoonRow = `
      <div class="trade-row">
        <div class="trade-good"><b>Harpoon Cannon</b><span>${state.harpoon ? "mounted · left-click while sailing" : "hunt the leviathan · 20 dmg per bolt"}</span></div>
        <div class="trade-actions trade-upgrade">${
          state.harpoon
            ? `<span class="trade-na">MOUNTED</span>`
            : `<button data-action="harpoon" ${state.gold >= HARPOON_COST ? "" : "disabled"}>Mount · ${HARPOON_COST}g</button>`
        }</div>
      </div>`;

  // 更衣室：三槽六色
  const outfitSlots: Array<{ slot: keyof OutfitState; label: string }> = [
    { slot: "bandana", label: "Bandana" },
    { slot: "cloth", label: "Cloak" },
    { slot: "leather", label: "Leathers" },
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
      <p class="trade-eyebrow trade-section">Rumors</p>
      <div class="trade-row">
        <div class="trade-good"><b>Treasure Map</b><span>${state.mapPurchased ? "purchased — head to the Sunken Ruins" : "leads to the relic vault"}</span></div>
        <div class="trade-actions trade-upgrade">${
          state.mapPurchased
            ? `<span class="trade-na">OWNED</span>`
            : `<button data-action="treasure-map" ${state.gold >= TREASURE_MAP_COST ? "" : "disabled"}>Buy · ${TREASURE_MAP_COST}g</button>`
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
        <p class="trade-eyebrow">${port.name} Market</p>
        <p class="trade-stats"><b>${state.gold}</b> gold · cargo <b>${held}/${capacity}</b> · <b>${state.tokens}</b> $SAND</p>
      </div>
      <button data-action="close" class="trade-close" aria-label="Close">✕</button>
    </div>
    ${rows}
    <p class="trade-eyebrow trade-section">Shipwright Upgrades</p>
    ${upgradeRows}
    ${harpoonRow}
    <p class="trade-eyebrow trade-section">Dressing Room</p>
    ${outfitRows}
    ${treasureRow}
    ${exchangeRow}
    <p class="trade-hint">E / Esc to leave</p>`;
}
