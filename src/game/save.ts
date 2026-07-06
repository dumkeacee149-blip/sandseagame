import type { GameState } from "./data";
import { createInitialState } from "./data";
import { getIdentity } from "../core/wallet";

// 存档按钱包身份隔离：每个钱包一份进度，访客用本机 guest 档
function saveKey() {
  return `sandsea-save:${getIdentity()}`;
}
const SAVE_VERSION = 1;

export interface SaveFileV1 {
  readonly version: number;
  readonly state: GameState;
  readonly ship: { x: number; z: number; heading: number };
  readonly savedAt: string;
}

// 离散事件触发保存（交易后/上下船），绝不每帧写
export function save(state: GameState, ship: { x: number; z: number; heading: number }) {
  try {
    const file: SaveFileV1 = {
      version: SAVE_VERSION,
      state,
      ship,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(saveKey(), JSON.stringify(file));
  } catch (error) {
    console.error("存档写入失败", error);
  }
}

// version 不匹配直接弃档重开（原型期合法），缺字段用初始值兜底
export function load(): SaveFileV1 | null {
  try {
    const raw = localStorage.getItem(saveKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SaveFileV1>;
    if (parsed?.version !== SAVE_VERSION || !parsed.state || !parsed.ship) return null;
    const defaults = createInitialState();
    return {
      version: SAVE_VERSION,
      state: {
        ...defaults,
        ...parsed.state,
        cargo: { ...defaults.cargo, ...parsed.state.cargo },
        upgrades: { ...defaults.upgrades, ...parsed.state.upgrades },
        docking: { kind: "sailing" },
      },
      ship: parsed.ship,
      savedAt: parsed.savedAt ?? "",
    };
  } catch (error) {
    console.error("存档读取失败，弃档重开", error);
    return null;
  }
}

export function clearSave() {
  localStorage.removeItem(saveKey());
}
