// 全部玩法数值的唯一落点（经过平衡演算，见 plan §2）：改数值只改这里

export type GoodId = "dates" | "salt" | "glassware" | "spice";
export type PortId = "oasis" | "saltcrest" | "duneskull";
export type UpgradeId = "sail" | "cargo" | "hull";

export interface GoodDef {
  readonly id: GoodId;
  readonly name: string;
}

export const GOODS: readonly GoodDef[] = [
  { id: "dates", name: "Dates" },
  { id: "salt", name: "Salt" },
  { id: "glassware", name: "Glassware" },
  { id: "spice", name: "Spice" },
] as const;

export interface PortDef {
  readonly id: PortId;
  readonly name: string;
  readonly x: number;
  readonly z: number;
  // 集市帐篷的世界坐标：小人走到这里按 E 交易
  readonly marketX: number;
  readonly marketZ: number;
  // 产地卖给玩家的价格；缺省 = 本港不出售此货
  readonly buy: Readonly<Partial<Record<GoodId, number>>>;
  // 本港回收价；缺省 = 本港不回收（产地不回购自产货）
  readonly sell: Readonly<Partial<Record<GoodId, number>>>;
}

// 价差设计：近线薄利（A↔B 单件+3），险线厚利（C 线香料 +14）
export const PORTS: readonly PortDef[] = [
  {
    id: "oasis",
    name: "Oasis Harbor",
    x: -520,
    z: -380,
    marketX: -644,
    marketZ: -408,
    buy: { dates: 4, glassware: 10 },
    sell: { salt: 8, spice: 26 },
  },
  {
    id: "saltcrest",
    name: "Saltcrest",
    x: 340,
    z: 700,
    marketX: 300,
    marketZ: 670,
    buy: { salt: 5 },
    sell: { dates: 7, glassware: 13, spice: 22 },
  },
  {
    id: "duneskull",
    name: "Duneskull Outpost",
    x: 1150,
    z: -1150,
    marketX: 1150,
    marketZ: -1150,
    buy: { spice: 12 },
    sell: { dates: 10, salt: 9, glassware: 19 },
  },
] as const;

export const PROMPT_RADIUS = 200;
export const DOCK_RADIUS = 130;
export const START_GOLD = 0;
// 金币兑换代币汇率（预发布记账；$SAND 上线后接链上结算）
export const TOKEN_RATE = 1000;

// 升级查表（不用公式派生：帆速 92/106/122/140 是沙虫追速 110 的分水岭设计）
export interface UpgradeTier {
  readonly value: number;
  readonly cost: number; // L0 的 cost 恒为 0
}

export const UPGRADES: Readonly<Record<UpgradeId, readonly UpgradeTier[]>> = {
  sail: [
    { value: 92, cost: 0 },
    { value: 106, cost: 150 },
    { value: 122, cost: 400 },
    { value: 140, cost: 900 },
  ],
  cargo: [
    { value: 8, cost: 0 },
    { value: 12, cost: 120 },
    { value: 18, cost: 350 },
    { value: 26, cost: 800 },
  ],
  hull: [
    { value: 100, cost: 0 },
    { value: 140, cost: 100 },
    { value: 190, cost: 300 },
    { value: 250, cost: 700 },
  ],
} as const;

export interface UpgradeLevels {
  readonly sail: number;
  readonly cargo: number;
  readonly hull: number;
}

export type DockingStatus =
  | { readonly kind: "sailing" }
  | { readonly kind: "docked"; readonly portId: PortId };

export interface GameState {
  readonly gold: number;
  readonly cargo: Readonly<Record<GoodId, number>>;
  readonly hull: number;
  readonly upgrades: UpgradeLevels;
  readonly docking: DockingStatus;
  // 最后交易过的港口：搁浅重生点
  readonly lastPort: PortId;
  // 藏宝图与通关标记
  readonly mapPurchased: boolean;
  readonly completed: boolean;
  // 累计成交笔数（买+卖各算一笔）：任务链的进度依据
  readonly trades: number;
  // 预发布代币记账（$SAND on Solana，TGE 后接链上）
  readonly tokens: number;
  // 任务系统的进度统计
  readonly visited: readonly PortId[];
  readonly cratesBroken: number;
  readonly bitesSurvived: number;
  readonly claimedQuests: readonly string[];
}

export const TREASURE_MAP_COST = 1500;
export const TREASURE_REWARD = 5000;
// 宝箱世界坐标（遗迹岛上的 A08）
export const TREASURE_X = 702;
export const TREASURE_Z = 314;
export const STRAND_TOW_FEE = 25;

export const EMPTY_CARGO: Readonly<Record<GoodId, number>> = {
  dates: 0,
  salt: 0,
  glassware: 0,
  spice: 0,
};

export function createInitialState(): GameState {
  return {
    gold: START_GOLD,
    cargo: EMPTY_CARGO,
    hull: UPGRADES.hull[0].value,
    upgrades: { sail: 0, cargo: 0, hull: 0 },
    docking: { kind: "sailing" },
    lastPort: "oasis",
    mapPurchased: false,
    completed: false,
    trades: 0,
    tokens: 0,
    visited: [],
    cratesBroken: 0,
    bitesSurvived: 0,
    claimedQuests: [],
  };
}

// 派生值：查表纯函数，不缓存进 state
export function cargoCapacity(state: GameState): number {
  return UPGRADES.cargo[state.upgrades.cargo].value;
}

export function maxHull(state: GameState): number {
  return UPGRADES.hull[state.upgrades.hull].value;
}

export function sailSpeed(state: GameState): number {
  return UPGRADES.sail[state.upgrades.sail].value;
}

export function cargoCount(state: GameState): number {
  return Object.values(state.cargo).reduce((sum, n) => sum + n, 0);
}
