import type { GameState, GoodId, PortId } from "../game/data";
import { GOODS, cargoCapacity, cargoCount } from "../game/data";
import { findPort, buyGood, sellGood } from "../game/economy";
import { getState, setState, subscribe } from "../game/store";

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

  panelEl.innerHTML = `
    <div class="trade-head">
      <div>
        <p class="trade-eyebrow">${port.name} Market</p>
        <p class="trade-stats"><b>${state.gold}</b> gold · cargo <b>${held}/${capacity}</b></p>
      </div>
      <button data-action="close" class="trade-close" aria-label="Close">✕</button>
    </div>
    ${rows}
    <p class="trade-hint">E / Esc to leave</p>`;
}
