import type { EnemyKind, EquipSlotId, GameState, GoodId, ItemId, PortId, SkillId, UpgradeId } from "./data";
import type { OutfitState } from "./data";
import {
  PORTS,
  UPGRADES,
  HARPOON_COST,
  WORM_BOUNTY,
  CRAB_BOUNTY,
  STRAND_TOW_FEE,
  TREASURE_MAP_COST,
  TREASURE_REWARD,
  TOKEN_RATE,
  cargoCapacity,
  cargoCount,
  maxHull,
  getDerivedStats,
  findItem,
  findSkill,
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

// 商贾技能调价：按单价取整（至少 1g），买卖双向共用
export function unitBuyPrice(state: GameState, portId: PortId, good: GoodId): number | undefined {
  const price = findPort(portId).buy[good];
  if (price === undefined) return undefined;
  return Math.max(1, Math.round(price * getDerivedStats(state).buyPriceMul));
}

export function unitSellPrice(state: GameState, portId: PortId, good: GoodId): number | undefined {
  const price = findPort(portId).sell[good];
  if (price === undefined) return undefined;
  return Math.max(1, Math.round(price * getDerivedStats(state).sellPriceMul));
}

export function buyGood(state: GameState, portId: PortId, good: GoodId, qty: number): GameState {
  const price = unitBuyPrice(state, portId, good);
  if (price === undefined || qty <= 0) return state;
  const cost = price * qty;
  if (state.gold < cost) return state;
  if (cargoCount(state) + qty > cargoCapacity(state)) return state;
  return {
    ...state,
    gold: state.gold - cost,
    cargo: { ...state.cargo, [good]: state.cargo[good] + qty },
    trades: state.trades + 1,
    lastBuyPort: portId,
  };
}

export function sellGood(state: GameState, portId: PortId, good: GoodId, qty: number): GameState {
  const price = unitSellPrice(state, portId, good);
  if (price === undefined || qty <= 0) return state;
  if (state.cargo[good] < qty) return state;
  const soldAway = state.lastBuyPort !== null && state.lastBuyPort !== portId;
  const earned = price * qty;
  return {
    ...state,
    gold: state.gold + earned,
    cargo: { ...state.cargo, [good]: state.cargo[good] - qty },
    trades: state.trades + 1,
    completedAwaySale: state.completedAwaySale || soldAway,
    tradeGold: state.tradeGold + earned,
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

// 沙虫咬击：扣船壳 + 掉货（基准 25%，护货装备/技能可减）+ 幸存计数
export function applyWormBite(state: GameState, damage: number): GameState {
  const bitten = loseCargo(applyHullDamage(state, damage), getDerivedStats(state).biteCargoLossRatio);
  return { ...bitten, bitesSurvived: bitten.hull > 0 ? bitten.bitesSurvived + 1 : bitten.bitesSurvived };
}

// 搁浅：掉货（基准 50%）+ 拖船费（护符/技能可免），满耐久在最后交易港重生
export function applyStranding(state: GameState): GameState {
  const stats = getDerivedStats(state);
  const penalized = loseCargo(state, stats.strandCargoLossRatio);
  return {
    ...penalized,
    gold: Math.max(0, penalized.gold - (stats.towFeeWaived ? 0 : STRAND_TOW_FEE)),
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

// 劈碎货箱：每个固定货箱只结算一次，防止刷新页面重复刷金/任务。
export function recordCrateBreak(state: GameState, crateId: string): GameState {
  if (state.brokenCrateIds.includes(crateId)) return state;
  return {
    ...state,
    gold: state.gold + 2,
    cratesBroken: state.cratesBroken + 1,
    brokenCrateIds: [...state.brokenCrateIds, crateId],
  };
}

// 金币→$SAND 兑换（预发布记账）
export function exchangeTokens(state: GameState, count: number): GameState {
  const cost = count * TOKEN_RATE;
  if (count <= 0 || state.gold < cost) return state;
  return { ...state, gold: state.gold - cost, tokens: state.tokens + count };
}

// 船坞购置鱼叉炮：猎杀沙虫的门槛
export function buyHarpoon(state: GameState): GameState {
  if (state.harpoon || state.gold < HARPOON_COST) return state;
  return { ...state, gold: state.gold - HARPOON_COST, harpoon: true };
}

// 战利品入舱：受货舱上限约束，装不下的部分丢弃（返回实际入舱数供 UI 提示）
export function addLoot(state: GameState, good: GoodId, qty: number): { state: GameState; added: number } {
  const space = Math.max(0, cargoCapacity(state) - cargoCount(state));
  const added = Math.min(qty, space);
  if (added <= 0) return { state, added: 0 };
  return {
    state: { ...state, cargo: { ...state.cargo, [good]: state.cargo[good] + added } },
    added,
  };
}

function recordEnemyDeath(state: GameState, kind: EnemyKind, enemyId: number, deadUntil: number): GameState {
  const enemyDeaths = [
    ...state.enemyDeaths.filter((record) => !(record.kind === kind && record.id === enemyId)),
    { kind, id: enemyId, deadUntil },
  ];
  return { ...state, enemyDeaths };
}

// 击杀沙虫：极少赏金（经济铁律）+ 虫鳞掉落入舱 + 死亡倒计时入档防刷新重刷。
// 掉落数量由调用方掷（纯函数不掷随机数）。
export function recordWormKill(
  state: GameState,
  wormId: number,
  deadUntil: number,
  scaleQty: number,
): { state: GameState; looted: number } {
  const dead = recordEnemyDeath(state, "worm", wormId, deadUntil);
  const { state: looted, added } = addLoot(dead, "wormscale", Math.max(0, scaleQty));
  return {
    state: { ...looted, gold: looted.gold + WORM_BOUNTY, wormKills: looted.wormKills + 1 },
    looted: added,
  };
}

// 击杀沙蟹：同一套规则（极少金币 + 甲壳掉落）
export function recordCrabKill(
  state: GameState,
  crabId: number,
  deadUntil: number,
  chitinQty: number,
): { state: GameState; looted: number } {
  const dead = recordEnemyDeath(state, "crab", crabId, deadUntil);
  const { state: looted, added } = addLoot(dead, "chitin", Math.max(0, chitinQty));
  return {
    state: { ...looted, gold: looted.gold + CRAB_BOUNTY, crabKills: looted.crabKills + 1 },
    looted: added,
  };
}

// ===== 装备栏：铁匠购买 / 材料打造 / 穿脱 / 半价回售 =====

export function buyItem(state: GameState, itemId: ItemId): GameState {
  const item = findItem(itemId);
  if (item.cost <= 0 || state.ownedItems.includes(itemId) || state.gold < item.cost) return state;
  return { ...state, gold: state.gold - item.cost, ownedItems: [...state.ownedItems, itemId] };
}

export function craftItem(state: GameState, itemId: ItemId): GameState {
  const item = findItem(itemId);
  if (!item.craft || state.ownedItems.includes(itemId)) return state;
  const cargo = { ...state.cargo };
  for (const [good, need] of Object.entries(item.craft) as [GoodId, number][]) {
    if (cargo[good] < need) return state;
    cargo[good] -= need;
  }
  return { ...state, cargo, ownedItems: [...state.ownedItems, itemId] };
}

export function equipItem(state: GameState, itemId: ItemId): GameState {
  if (!state.ownedItems.includes(itemId)) return state;
  const item = findItem(itemId);
  if (state.equipment[item.slot] === itemId) return state;
  return { ...state, equipment: { ...state.equipment, [item.slot]: itemId } };
}

export function unequipSlot(state: GameState, slot: EquipSlotId): GameState {
  if (state.equipment[slot] === null) return state;
  return { ...state, equipment: { ...state.equipment, [slot]: null } };
}

// 只有商店货（cost>0）可半价回售；已装备的先自动卸下。金币出口，不产生新金币。
export function sellItemBack(state: GameState, itemId: ItemId): GameState {
  const item = findItem(itemId);
  if (item.cost <= 0 || !state.ownedItems.includes(itemId)) return state;
  const unequipped = state.equipment[item.slot] === itemId ? unequipSlot(state, item.slot) : state;
  return {
    ...unequipped,
    gold: unequipped.gold + Math.floor(item.cost / 2),
    ownedItems: unequipped.ownedItems.filter((owned) => owned !== itemId),
  };
}

// ===== 技能树：点数只来自任务与里程碑（不来自击杀计数——防刷）=====

export function skillPointsEarned(state: GameState): number {
  let points = Math.floor(state.claimedQuests.length / 2);
  if (state.visited.length >= 3) points += 1;
  if (state.completed) points += 2;
  if (state.tradeGold >= 500) points += 1;
  return points;
}

export function skillPointsAvailable(state: GameState): number {
  return Math.max(0, skillPointsEarned(state) - state.skills.length);
}

export function unlockSkill(state: GameState, skillId: SkillId): GameState {
  if (state.skills.includes(skillId)) return state;
  if (skillPointsAvailable(state) <= 0) return state;
  const skill = findSkill(skillId);
  // 同分支前置层未解锁不可点（tier 1 无前置）
  if (skill.tier > 1) {
    const hasPrev = state.skills.some(
      (id) => findSkill(id).branch === skill.branch && findSkill(id).tier === skill.tier - 1,
    );
    if (!hasPrev) return state;
  }
  return { ...state, skills: [...state.skills, skillId] };
}

// 更衣室换色
export function setOutfit(state: GameState, slot: keyof OutfitState, color: string): GameState {
  if (state.outfit[slot] === color) return state;
  return { ...state, outfit: { ...state.outfit, [slot]: color } };
}

export function buyTreasureMap(state: GameState): GameState {
  if (state.mapPurchased || state.gold < TREASURE_MAP_COST) return state;
  return { ...state, gold: state.gold - TREASURE_MAP_COST, mapPurchased: true };
}

export function openTreasure(state: GameState): GameState {
  if (!state.mapPurchased || state.completed) return state;
  return { ...state, gold: state.gold + TREASURE_REWARD, completed: true };
}
