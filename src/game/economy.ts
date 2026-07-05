import type { GameState, GoodId, PortId } from "./data";
import { PORTS, cargoCapacity, cargoCount, maxHull } from "./data";

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

export function addGold(state: GameState, amount: number): GameState {
  if (amount === 0) return state;
  return { ...state, gold: Math.max(0, state.gold + amount) };
}

export function applyHullDamage(state: GameState, damage: number): GameState {
  if (damage <= 0) return state;
  return { ...state, hull: Math.max(0, state.hull - damage) };
}
