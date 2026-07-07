// 全部玩法数值的唯一落点（经过平衡演算，见 plan §2）：改数值只改这里

export type GoodId = "dates" | "salt" | "glassware" | "spice" | "chitin" | "wormscale";
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
  // 战利品材料：只有回收价没有进货价（经济铁律：战斗产出必须经贸易管道变现）
  { id: "chitin", name: "Chitin" },
  { id: "wormscale", name: "Wormscale" },
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
    sell: { salt: 8, spice: 26, chitin: 5, wormscale: 16 },
  },
  {
    id: "saltcrest",
    name: "Saltcrest",
    x: 340,
    z: 700,
    marketX: 300,
    marketZ: 670,
    buy: { salt: 5 },
    sell: { dates: 7, glassware: 13, spice: 22, chitin: 7, wormscale: 22 },
  },
  {
    id: "duneskull",
    name: "Duneskull Outpost",
    x: 1150,
    z: -1150,
    marketX: 1150,
    marketZ: -1150,
    buy: { spice: 12 },
    sell: { dates: 10, salt: 9, glassware: 19, chitin: 4, wormscale: 12 },
  },
] as const;

export const PROMPT_RADIUS = 200;
export const DOCK_RADIUS = 130;
export const START_GOLD = 0;

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

// 敌人死亡持久化（沙虫/沙蟹通用）：刷新页面后死亡倒计时继续，不能重复领赏
export type EnemyKind = "worm" | "crab";

export interface EnemyDeathRecord {
  readonly kind: EnemyKind;
  readonly id: number;
  readonly deadUntil: number;
}

// ===== 装备栏（纯数据，不渲染到人物模型）=====
export type EquipSlotId = "weapon" | "harpoonMod" | "charm";
export type ItemId =
  | "iron-cutlass"
  | "wormscale-cleaver"
  | "quick-winch"
  | "piercing-head"
  | "cargo-net"
  | "sailor-charm";

// 装备/技能共用的加成条目：加法项直接相加，乘法项相乘，比率项做减点
export interface StatBonus {
  readonly meleeDamage?: number;
  readonly harpoonDamage?: number;
  readonly harpoonCooldownMul?: number;
  readonly harpoonCritChance?: number;
  readonly biteCargoLossDelta?: number;
  readonly strandCargoLossDelta?: number;
  readonly towFeeWaived?: boolean;
  readonly sellPriceMul?: number;
  readonly buyPriceMul?: number;
  readonly cargoBonus?: number;
  readonly sailSpeedMul?: number;
}

export interface ItemDef {
  readonly id: ItemId;
  readonly slot: EquipSlotId;
  readonly name: string;
  readonly desc: string;
  readonly bonus: StatBonus;
  // 铁匠售价；0 = 非卖品（打造或任务获得），可半价回售的只有 cost>0 的商店货
  readonly cost: number;
  readonly craft?: Readonly<Partial<Record<GoodId, number>>>;
}

// 敌人不直接掉装备：掉材料，材料打造装备（战斗产出必须过一道加工/贸易手续）
export const ITEMS: readonly ItemDef[] = [
  { id: "iron-cutlass", slot: "weapon", name: "Iron Cutlass", desc: "Melee +6", bonus: { meleeDamage: 6 }, cost: 200 },
  {
    id: "wormscale-cleaver",
    slot: "weapon",
    name: "Wormscale Cleaver",
    desc: "Melee +14",
    bonus: { meleeDamage: 14 },
    cost: 0,
    craft: { wormscale: 6, chitin: 4 },
  },
  {
    id: "quick-winch",
    slot: "harpoonMod",
    name: "Quick Winch",
    desc: "Harpoon cooldown -25%",
    bonus: { harpoonCooldownMul: 0.75 },
    cost: 450,
  },
  {
    id: "piercing-head",
    slot: "harpoonMod",
    name: "Piercing Head",
    desc: "Harpoon +10",
    bonus: { harpoonDamage: 10 },
    cost: 0,
    craft: { wormscale: 10 },
  },
  {
    id: "cargo-net",
    slot: "charm",
    name: "Cargo Net",
    desc: "Bite cargo loss 25% → 15%",
    bonus: { biteCargoLossDelta: -0.1 },
    cost: 350,
  },
  {
    id: "sailor-charm",
    slot: "charm",
    name: "Old Sailor's Charm",
    desc: "Towing fee waived",
    bonus: { towFeeWaived: true },
    cost: 0,
  },
] as const;

export function findItem(itemId: ItemId): ItemDef {
  const item = ITEMS.find((entry) => entry.id === itemId);
  if (!item) throw new Error(`未知物品: ${itemId}`);
  return item;
}

export const EQUIP_SLOTS: readonly EquipSlotId[] = ["weapon", "harpoonMod", "charm"];

export type EquipmentState = Readonly<Record<EquipSlotId, ItemId | null>>;

export const EQUIPMENT_DEFAULT: EquipmentState = { weapon: null, harpoonMod: null, charm: null };

// ===== 技能树：三分支 × 5 层，线性解锁 =====
// 技能点只来自任务与里程碑（见 economy.skillPointsEarned），不来自击杀计数——防刷。
export type SkillBranch = "seafaring" | "combat" | "merchant";
export type SkillId =
  | "sea1" | "sea2" | "sea3" | "sea4" | "sea5"
  | "war1" | "war2" | "war3" | "war4" | "war5"
  | "mer1" | "mer2" | "mer3" | "mer4" | "mer5";

export interface SkillDef {
  readonly id: SkillId;
  readonly branch: SkillBranch;
  readonly tier: number; // 1..5，需先解锁同分支 tier-1
  readonly name: string;
  readonly desc: string;
  readonly bonus: StatBonus;
}

export const SKILLS: readonly SkillDef[] = [
  { id: "sea1", branch: "seafaring", tier: 1, name: "Trimmed Sails", desc: "Sail speed +4%", bonus: { sailSpeedMul: 1.04 } },
  { id: "sea2", branch: "seafaring", tier: 2, name: "Salvage Drill", desc: "Stranding cargo loss -10pt", bonus: { strandCargoLossDelta: -0.1 } },
  { id: "sea3", branch: "seafaring", tier: 3, name: "Lash the Hold", desc: "Bite cargo loss -5pt", bonus: { biteCargoLossDelta: -0.05 } },
  { id: "sea4", branch: "seafaring", tier: 4, name: "Stormcloth", desc: "Sail speed +6%", bonus: { sailSpeedMul: 1.06 } },
  { id: "sea5", branch: "seafaring", tier: 5, name: "Harbor Kin", desc: "Towing fee waived", bonus: { towFeeWaived: true } },
  { id: "war1", branch: "combat", tier: 1, name: "Keen Edge", desc: "Melee +3", bonus: { meleeDamage: 3 } },
  { id: "war2", branch: "combat", tier: 2, name: "Barbed Bolts", desc: "Harpoon +4", bonus: { harpoonDamage: 4 } },
  { id: "war3", branch: "combat", tier: 3, name: "Fast Hands", desc: "Harpoon cooldown -10%", bonus: { harpoonCooldownMul: 0.9 } },
  { id: "war4", branch: "combat", tier: 4, name: "Butcher's Arc", desc: "Melee +5", bonus: { meleeDamage: 5 } },
  { id: "war5", branch: "combat", tier: 5, name: "Deadeye", desc: "Harpoon crit 10% ×2", bonus: { harpoonCritChance: 0.1 } },
  { id: "mer1", branch: "merchant", tier: 1, name: "Haggler", desc: "Sell price +2%", bonus: { sellPriceMul: 1.02 } },
  { id: "mer2", branch: "merchant", tier: 2, name: "Tight Stowage", desc: "Cargo +2", bonus: { cargoBonus: 2 } },
  { id: "mer3", branch: "merchant", tier: 3, name: "Bulk Buyer", desc: "Buy price -2%", bonus: { buyPriceMul: 0.98 } },
  { id: "mer4", branch: "merchant", tier: 4, name: "Silver Tongue", desc: "Sell price +3%", bonus: { sellPriceMul: 1.03 } },
  { id: "mer5", branch: "merchant", tier: 5, name: "Deep Hold", desc: "Cargo +4", bonus: { cargoBonus: 4 } },
] as const;

export function findSkill(skillId: SkillId): SkillDef {
  const skill = SKILLS.find((entry) => entry.id === skillId);
  if (!skill) throw new Error(`未知技能: ${skillId}`);
  return skill;
}

export const SKILL_BRANCHES: readonly SkillBranch[] = ["seafaring", "combat", "merchant"];

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
  // 最近一次进货港；完成异港售卖后解锁贸易任务，避免原港刷两笔买卖。
  readonly lastBuyPort: PortId | null;
  readonly completedAwaySale: boolean;
  // 累计卖货所得（技能点里程碑依据）
  readonly tradeGold: number;
  // 历史代币记账（兑换功能已下线；字段保留以兼容老存档数据）
  readonly tokens: number;
  // 任务系统的进度统计
  readonly visited: readonly PortId[];
  readonly cratesBroken: number;
  readonly brokenCrateIds: readonly string[];
  readonly bitesSurvived: number;
  readonly claimedQuests: readonly string[];
  // 鱼叉炮（击杀沙虫的门槛）与猎杀战绩
  readonly harpoon: boolean;
  readonly wormKills: number;
  readonly crabKills: number;
  readonly enemyDeaths: readonly EnemyDeathRecord[];
  // 装备栏与技能树（纯数据；加成一律 getDerivedStats 现算，严禁存派生值）
  readonly equipment: EquipmentState;
  readonly ownedItems: readonly ItemId[];
  readonly skills: readonly SkillId[];
  // 船长外观（更衣室）
  readonly outfit: OutfitState;
}

// 鱼叉炮与猎杀沙虫（击杀门槛=先在船坞购置鱼叉炮）
export const HARPOON_COST = 600;
export const HARPOON_DAMAGE = 20;
export const HARPOON_RANGE = 230;
export const HARPOON_COOLDOWN = 1.1;
export const WORM_MAX_HP = 120;
// 经济铁律：击杀只给极少金币，主产出是材料（经贸易变现）。
// 满掉落全变现 ≈ 10 + 4×22 = 98g < 香料线一趟 112g，猎杀是副业不是金矿。
export const WORM_BOUNTY = 10;
export const WORM_RESPAWN_SECONDS = 90;
export const WORM_SCALE_DROP_MIN = 2;
export const WORM_SCALE_DROP_MAX = 4;

// ===== 步行战斗：玩家 HP 与沙蟹（陆地敌人）=====
export const MELEE_DAMAGE = 12;
export const MELEE_RANGE = 30;
export const PLAYER_MAX_HP = 60;
// 脱战 5 秒后开始回血（8 HP/s）；HP 运行时不入存档（回血机制下持久化无意义）
export const PLAYER_REGEN_DELAY = 5;
export const PLAYER_REGEN_RATE = 8;
export const CRAB_MAX_HP = 36;
export const CRAB_DAMAGE = 8;
export const CRAB_BOUNTY = 2;
export const CRAB_RESPAWN_SECONDS = 120;
export const CRAB_CHITIN_DROP_MIN = 1;
export const CRAB_CHITIN_DROP_MAX = 2;

// 更衣室：三个可染色槽位，颜色为 hex（存档持久化）
export interface OutfitState {
  readonly bandana: string;
  readonly cloth: string;
  readonly leather: string;
}

export const OUTFIT_DEFAULT: OutfitState = {
  bandana: "#a72f32",
  cloth: "#3fa8a0",
  leather: "#8a5431",
};

// 更衣室色板（三槽共用六色）
export const OUTFIT_COLORS: readonly string[] = [
  "#a72f32", // 私掠红
  "#3fa8a0", // 风化青
  "#33465d", // 沙暴靛
  "#c9973e", // 黄铜金
  "#5b4a38", // 旧皮棕
  "#e7debd", // 盐白
];

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
  chitin: 0,
  wormscale: 0,
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
    lastBuyPort: null,
    completedAwaySale: false,
    tradeGold: 0,
    tokens: 0,
    visited: [],
    cratesBroken: 0,
    brokenCrateIds: [],
    bitesSurvived: 0,
    claimedQuests: [],
    harpoon: false,
    wormKills: 0,
    crabKills: 0,
    enemyDeaths: [],
    equipment: EQUIPMENT_DEFAULT,
    ownedItems: [],
    skills: [],
    outfit: OUTFIT_DEFAULT,
  };
}

// ===== 派生属性：装备 + 技能加成统一现算（查表纯函数，不缓存进 state）=====
export interface DerivedStats {
  readonly meleeDamage: number;
  readonly harpoonDamage: number;
  readonly harpoonCooldownMul: number;
  readonly harpoonCritChance: number;
  readonly biteCargoLossRatio: number;
  readonly strandCargoLossRatio: number;
  readonly towFeeWaived: boolean;
  readonly sellPriceMul: number;
  readonly buyPriceMul: number;
  readonly cargoBonus: number;
  readonly sailSpeedMul: number;
}

// 未知 ID 静默跳过（而非 throw）：本函数在渲染循环每帧执行，
// 坏数据只该由存档清洗层拦截，不该让一条脏记录压死主循环。
function activeBonuses(state: GameState): StatBonus[] {
  const bonuses: StatBonus[] = [];
  for (const slot of EQUIP_SLOTS) {
    const itemId = state.equipment[slot];
    const item = itemId ? ITEMS.find((entry) => entry.id === itemId) : undefined;
    if (item) bonuses.push(item.bonus);
  }
  for (const skillId of state.skills) {
    const skill = SKILLS.find((entry) => entry.id === skillId);
    if (skill) bonuses.push(skill.bonus);
  }
  return bonuses;
}

export function getDerivedStats(state: GameState): DerivedStats {
  let meleeDamage = MELEE_DAMAGE;
  let harpoonDamage = HARPOON_DAMAGE;
  let harpoonCooldownMul = 1;
  let harpoonCritChance = 0;
  let biteCargoLossRatio = 0.25;
  let strandCargoLossRatio = 0.5;
  let towFeeWaived = false;
  let sellPriceMul = 1;
  let buyPriceMul = 1;
  let cargoBonus = 0;
  let sailSpeedMul = 1;
  for (const bonus of activeBonuses(state)) {
    meleeDamage += bonus.meleeDamage ?? 0;
    harpoonDamage += bonus.harpoonDamage ?? 0;
    harpoonCooldownMul *= bonus.harpoonCooldownMul ?? 1;
    harpoonCritChance += bonus.harpoonCritChance ?? 0;
    biteCargoLossRatio += bonus.biteCargoLossDelta ?? 0;
    strandCargoLossRatio += bonus.strandCargoLossDelta ?? 0;
    towFeeWaived = towFeeWaived || bonus.towFeeWaived === true;
    sellPriceMul *= bonus.sellPriceMul ?? 1;
    buyPriceMul *= bonus.buyPriceMul ?? 1;
    cargoBonus += bonus.cargoBonus ?? 0;
    sailSpeedMul *= bonus.sailSpeedMul ?? 1;
  }
  return {
    meleeDamage,
    harpoonDamage,
    harpoonCooldownMul,
    harpoonCritChance,
    biteCargoLossRatio: Math.max(0.05, biteCargoLossRatio),
    strandCargoLossRatio: Math.max(0.1, strandCargoLossRatio),
    towFeeWaived,
    sellPriceMul,
    buyPriceMul,
    cargoBonus,
    sailSpeedMul,
  };
}

export function cargoCapacity(state: GameState): number {
  return UPGRADES.cargo[state.upgrades.cargo].value + getDerivedStats(state).cargoBonus;
}

export function maxHull(state: GameState): number {
  return UPGRADES.hull[state.upgrades.hull].value;
}

export function sailSpeed(state: GameState): number {
  return Math.round(UPGRADES.sail[state.upgrades.sail].value * getDerivedStats(state).sailSpeedMul);
}

export function cargoCount(state: GameState): number {
  return Object.values(state.cargo).reduce((sum, n) => sum + n, 0);
}
