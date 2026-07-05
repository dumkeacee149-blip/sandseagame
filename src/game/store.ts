import type { GameState } from "./data";
import { createInitialState } from "./data";

// 单一 store，零框架：UI 用 subscribe 重绘，游戏循环每帧 getState() 只读引用
let state: GameState = createInitialState();
const listeners = new Set<(s: GameState) => void>();

export function getState(): GameState {
  return state;
}

export function setState(next: GameState): void {
  if (next === state) return;
  state = next;
  listeners.forEach((listener) => listener(state));
}

export function subscribe(listener: (s: GameState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetState(next: GameState): void {
  state = next;
  listeners.forEach((listener) => listener(state));
}
