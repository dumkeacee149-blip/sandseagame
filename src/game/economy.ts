import type { GameState, GoodId, PortId, UpgradeId } from "./data";
import {
  PORTS,
  UPGRADES,
  STRAND_TOW_FEE,
  TREASURE_MAP_COST,
  TREASURE_REWARD,
  TOKEN_RATE,
  cargoCapacity,
  cargoCount,
  maxHull,
} from "./data";

// 随机丢弃 ratio 比例的载货（向上取整），咬击/搁浅共用
function loseCargo(state: GameState, ratio: number): GameState {
  const held = cargoCount(state);
  if (held === 0) return state;
  let toLose = Math.ceil(held * ratio);
  const cargo = { ...state.cargo };
  const ids = Object.keys(cargo) as GoodId[];
  while (toLose > 0) {
    const owned = ids.filter((good) => cargo[good] > 0);
    if (owned.length === 0) break;
    const pick = owned[Math.floor(Math.random() * owned.length)];
    cargo[pick] -= 1;
    toLose -= 1;
  }
  return { ...state, cargo };
}

// 所有状态变更都是纯函数：失败返回原 state 引用，setState 短路，UI 不闪

export function findPort(portId: PortId) {
  const port = PORTS.find((p) => p.id === portId);
  if (!port) throw new Error(`未知港口: ${portId}`);
  return port;
}

export function buyGood(state: GameState, portId: PortId, good: GoodId, qty: number): GameState {
  const price = findPort(portId).buy[good];
  if (price === undefined || qty <= 0) return state;
  const cost = price * qty;
  if (state.gold < cost) return state;
  if (cargoCount(state) + qty > cargoCapacity(state)) return state;
  return {
    ...state,
    gold: state.gold - cost,
    cargo: { ...state.cargo, [good]: state.cargo[good] + qty },
    trades: state.trades + 1,
  };
}

export function sellGood(state: GameState, portId: PortId, good: GoodId, qty: number): GameState {
  const price = findPort(portId).sell[good];
  if (price === undefined || qty <= 0) return state;
  if (state.cargo[good] < qty) return state;
  return {
    ...state,
    gold: state.gold + price * qty,
    cargo: { ...state.cargo, [good]: state.cargo[good] - qty },
    trades: state.trades + 1,
  };
}

export function dockAt(state: GameState, portId: PortId): GameState {
  if (state.docking.kind === "docked") return state;
  // 停靠免费修满耐久（防死亡螺旋）
  return { ...state, docking: { kind: "docked", portId }, hull: maxHull(state) };
}

export function undock(state: GameState): GameState {
  if (state.docking.kind === "sailing") return state;
  return { ...state, docking: { kind: "sailing" } };
}

export function buyUpgrade(state: GameState, upgrade: UpgradeId): GameState {
  const level = state.upgrades[upgrade];
  const nextTier = UPGRADES[upgrade][level + 1];
  if (!nextTier || state.gold < nextTier.cost) return state;
  const upgraded = {
    ...state,
    gold: state.gold - nextTier.cost,
    upgrades: { ...state.upgrades, [upgrade]: level + 1 },
  };
  // 船壳升级立即补满新增上限的差额（当前耐久同步提升，避免"买了更肉但还是残血"）
  if (upgrade === "hull") {
    return { ...upgraded, hull: upgraded.hull + (maxHull(upgraded) - maxHull(state)) };
  }
  return upgraded;
}

export function addGold(state: GameState, amount: number): GameState {
  if (amount === 0) return state;
  return { ...state, gold: Math.max(0, state.gold + amount) };
}

export function applyHullDamage(state: GameState, damage: number): GameState {
  if (damage <= 0) return state;
  return { ...state, hull: Math.max(0, state.hull - damage) };
}

// 沙虫咬击：扣船壳 + 掉 25% 载货 + 幸存计数
export function applyWormBite(state: GameState, damage: number): GameState {
  const bitten = loseCargo(applyHullDamage(state, damage), 0.25);
  return { ...bitten, bitesSurvived: bitten.bitesSurvived + 1 };
}

// 搁浅：掉 50% 货 + 拖船费，满耐久在最后交易港重生（金币只扣到 0 不为负）
export function applyStranding(state: GameState): GameState {
  const penalized = loseCargo(state, 0.5);
  return {
    ...penalized,
    gold: Math.max(0, penalized.gold - STRAND_TOW_FEE),
    hull: maxHull(penalized),
    docking: { kind: "sailing" },
  };
}

export function recordVisit(state: GameState, portId: PortId): GameState {
  const seen = state.visited.includes(portId);
  if (state.lastPort === portId && seen) return state;
  return {
    ...state,
    lastPort: portId,
    visited: seen ? state.visited : [...state.visited, portId],
  };
}

// 劈碎货箱：+2 金并计数（任务进度）
export function recordCrateBreak(state: GameState): GameState {
  return { ...state, gold: state.gold + 2, cratesBroken: state.cratesBroken + 1 };
}

// 金币→$SAND 兑换（预发布记账）
export function exchangeTokens(state: GameState, count: number): GameState {
  const cost = count * TOKEN_RATE;
  if (count <= 0 || state.gold < cost) return state;
  return { ...state, gold: state.gold - cost, tokens: state.tokens + count };
}

export function buyTreasureMap(state: GameState): GameState {
  if (state.mapPurchased || state.gold < TREASURE_MAP_COST) return state;
  return { ...state, gold: state.gold - TREASURE_MAP_COST, mapPurchased: true };
}

export function openTreasure(state: GameState): GameState {
  if (!state.mapPurchased || state.completed) return state;
  return { ...state, gold: state.gold + TREASURE_REWARD, completed: true };
}
