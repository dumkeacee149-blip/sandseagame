import type { GameState } from "./data";
import {
  EQUIP_SLOTS,
  GOODS,
  ITEMS,
  OUTFIT_COLORS,
  PORTS,
  OUTFIT_DEFAULT,
  SKILLS,
  UPGRADES,
  createInitialState,
  findItem,
  findSkill,
  maxHull,
  type EnemyDeathRecord,
  type ItemId,
  type OutfitState,
  type PortId,
  type SkillId,
  type UpgradeId,
} from "./data";
import { skillPointsEarned } from "./economy";
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

function clampNumber(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function clampInt(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return Math.floor(clampNumber(value, fallback, min, max));
}

const GOOD_IDS = GOODS.map((good) => good.id);
const PORT_IDS = PORTS.map((port) => port.id);
const UPGRADE_IDS = Object.keys(UPGRADES) as readonly UpgradeId[];
const OUTFIT_SLOTS = Object.keys(OUTFIT_DEFAULT) as readonly (keyof OutfitState)[];
const LEGACY_CRATE_IDS = [
  ...Array.from({ length: 8 }, (_, index) => `oasis-${index}`),
  ...Array.from({ length: 4 }, (_, index) => `duneskull-${index}`),
  ...Array.from({ length: 5 }, (_, index) => `saltcrest-${index}`),
];

function isPortId(value: unknown): value is PortId {
  return typeof value === "string" && PORT_IDS.includes(value as PortId);
}

function sanitizeStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string"))];
}

function sanitizeVisited(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isPortId))];
}

function sanitizeEnemyDeaths(value: unknown): readonly EnemyDeathRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((record) => {
      const candidate = record as Partial<EnemyDeathRecord>;
      return {
        kind: candidate.kind === "crab" ? ("crab" as const) : ("worm" as const),
        id: clampInt(candidate.id, -1, 0, 99),
        deadUntil: clampNumber(candidate.deadUntil, 0),
      };
    })
    .filter((record) => record.deadUntil > Date.now());
}

const ITEM_IDS = ITEMS.map((item) => item.id);
const SKILL_IDS = SKILLS.map((skill) => skill.id);

function isItemId(value: unknown): value is ItemId {
  return typeof value === "string" && ITEM_IDS.includes(value as ItemId);
}

function sanitizeOwnedItems(value: unknown): readonly ItemId[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isItemId))];
}

// 技能清洗：只留合法 ID，且逐层校验（同分支前置层缺失的直接丢弃）
function sanitizeSkills(value: unknown): SkillId[] {
  if (!Array.isArray(value)) return [];
  const candidates = [...new Set(value.filter((id): id is SkillId => typeof id === "string" && SKILL_IDS.includes(id as SkillId)))];
  const kept: SkillId[] = [];
  // 按层序反复收敛，直到没有新技能可保留（乱序存档也能正确重建链）
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of candidates) {
      if (kept.includes(id)) continue;
      const skill = findSkill(id);
      const prevOk =
        skill.tier === 1 ||
        kept.some((k) => findSkill(k).branch === skill.branch && findSkill(k).tier === skill.tier - 1);
      if (prevOk) {
        kept.push(id);
        changed = true;
      }
    }
  }
  return kept;
}

function sanitizeBrokenCrateIds(value: unknown, cratesBroken: number) {
  const ids = sanitizeStringList(value);
  if (ids.length > 0 || cratesBroken <= 0) return ids;
  return LEGACY_CRATE_IDS.slice(0, Math.min(cratesBroken, LEGACY_CRATE_IDS.length));
}

function sanitizeState(rawState: Partial<GameState>, options: { legacyCompletedAwaySale?: boolean } = {}): GameState {
  const defaults = createInitialState();
  const cargo = { ...defaults.cargo };
  for (const good of GOOD_IDS) {
    cargo[good] = clampInt(rawState.cargo?.[good], defaults.cargo[good], 0, 999);
  }

  const upgrades = { ...defaults.upgrades };
  for (const upgrade of UPGRADE_IDS) {
    upgrades[upgrade] = clampInt(rawState.upgrades?.[upgrade], defaults.upgrades[upgrade], 0, UPGRADES[upgrade].length - 1);
  }

  const outfit = { ...defaults.outfit };
  for (const slot of OUTFIT_SLOTS) {
    const color = rawState.outfit?.[slot];
    outfit[slot] =
      typeof color === "string" && OUTFIT_COLORS.includes(color as (typeof OUTFIT_COLORS)[number])
        ? color
        : defaults.outfit[slot];
  }

  const trades = clampInt(rawState.trades, defaults.trades);
  const cratesBroken = clampInt(rawState.cratesBroken, defaults.cratesBroken);

  // 装备：先清洗背包，再校验槽位（未拥有/槽位不符的引用清空）
  const ownedItems = sanitizeOwnedItems(rawState.ownedItems);
  const equipment = { ...defaults.equipment };
  for (const slot of EQUIP_SLOTS) {
    const itemId = rawState.equipment?.[slot];
    equipment[slot] =
      isItemId(itemId) && ownedItems.includes(itemId) && findItem(itemId).slot === slot ? itemId : null;
  }

  // 老档迁移：wormDeaths（无 kind 字段）提升为 enemyDeaths
  const legacyState = rawState as Partial<GameState> & { wormDeaths?: unknown };
  const rawDeaths = rawState.enemyDeaths ?? legacyState.wormDeaths;

  const merged: GameState = {
    ...defaults,
    gold: clampInt(rawState.gold, defaults.gold),
    cargo,
    hull: clampNumber(rawState.hull, defaults.hull),
    upgrades,
    docking: { kind: "sailing" },
    lastPort: isPortId(rawState.lastPort) ? rawState.lastPort : defaults.lastPort,
    mapPurchased: rawState.mapPurchased === true,
    completed: rawState.completed === true,
    trades,
    lastBuyPort: isPortId(rawState.lastBuyPort) ? rawState.lastBuyPort : null,
    completedAwaySale: rawState.completedAwaySale === true || Boolean(options.legacyCompletedAwaySale && trades >= 2),
    tradeGold: clampInt(rawState.tradeGold, defaults.tradeGold),
    tokens: clampInt(rawState.tokens, defaults.tokens),
    visited: sanitizeVisited(rawState.visited),
    cratesBroken,
    brokenCrateIds: sanitizeBrokenCrateIds(rawState.brokenCrateIds, cratesBroken),
    bitesSurvived: clampInt(rawState.bitesSurvived, defaults.bitesSurvived),
    claimedQuests: sanitizeStringList(rawState.claimedQuests),
    harpoon: rawState.harpoon === true,
    wormKills: clampInt(rawState.wormKills, defaults.wormKills),
    crabKills: clampInt(rawState.crabKills, defaults.crabKills),
    enemyDeaths: sanitizeEnemyDeaths(rawDeaths),
    equipment,
    ownedItems,
    skills: sanitizeSkills(rawState.skills),
    outfit,
  };

  // 技能数不能超过实际挣到的点数（防手改存档白嫖）；超出部分按解锁顺序截断
  const trimmed =
    merged.skills.length > skillPointsEarned(merged)
      ? { ...merged, skills: merged.skills.slice(0, skillPointsEarned(merged)) }
      : merged;

  return { ...trimmed, hull: Math.min(trimmed.hull, maxHull(trimmed)) };
}

function sanitizeShip(rawShip: Partial<SaveFileV1["ship"]>) {
  return {
    x: clampNumber(rawShip.x, 0, -2500, 2500),
    z: clampNumber(rawShip.z, 0, -2500, 2500),
    heading: clampNumber(rawShip.heading, 0, -Math.PI * 2, Math.PI * 2),
  };
}

// version 不匹配直接弃档重开（原型期合法），缺字段用初始值兜底
export function load(): SaveFileV1 | null {
  try {
    const raw = localStorage.getItem(saveKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SaveFileV1>;
    if (parsed?.version !== SAVE_VERSION || !parsed.state || !parsed.ship) return null;
    const legacyCompletedAwaySale = !Object.prototype.hasOwnProperty.call(parsed.state, "completedAwaySale");
    return {
      version: SAVE_VERSION,
      state: sanitizeState(parsed.state, { legacyCompletedAwaySale }),
      ship: sanitizeShip(parsed.ship),
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
