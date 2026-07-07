// 可选船长角色（KayKit Adventurers，CC0：kaylousberg.itch.io/kaykit-adventurers）
// 选择持久化到 localStorage（纯外观，与 GameState 存档解耦，同语言偏好一个待遇）

export type HeroId = "rogue_hooded" | "knight" | "barbarian" | "mage" | "rogue";

export const HERO_IDS: readonly HeroId[] = ["rogue_hooded", "knight", "barbarian", "mage", "rogue"];

export const HERO_DEFAULT: HeroId = "rogue_hooded";

const HERO_KEY = "sandsea-hero";
const MODEL_VERSION = "kaykit-adventurers-1";

export function heroModelUrl(hero: HeroId): string {
  return `/models/hero_kaykit_${hero}.glb?v=${MODEL_VERSION}`;
}

// GLB 里挂满备用道具（副手武器/盾/弩/法书……），各角色只留一件标志性主手武器；
// 摘掉的节点不参与包围盒计算，避免贴地和缩放被带偏
export const HERO_STRIP_NODES: Record<HeroId, readonly string[]> = {
  rogue_hooded: ["Knife_Offhand", "1H_Crossbow", "2H_Crossbow", "Throwable"],
  rogue: ["Knife_Offhand", "1H_Crossbow", "2H_Crossbow", "Throwable"],
  knight: ["1H_Sword_Offhand", "Badge_Shield", "Rectangle_Shield", "Round_Shield", "Spike_Shield", "2H_Sword"],
  barbarian: ["1H_Axe_Offhand", "Barbarian_Round_Shield", "2H_Axe", "Mug"],
  mage: ["Spellbook", "Spellbook_open", "2H_Staff"],
};

function isHeroId(value: string | null): value is HeroId {
  return value !== null && (HERO_IDS as readonly string[]).includes(value);
}

// 是否已做过选择（首次进游戏据此弹出选人面板）
export function hasChosenHero(): boolean {
  try {
    return isHeroId(localStorage.getItem(HERO_KEY));
  } catch {
    return true; // 无 localStorage 的环境不反复骚扰玩家
  }
}

export function getSelectedHero(): HeroId {
  try {
    const saved = localStorage.getItem(HERO_KEY);
    return isHeroId(saved) ? saved : HERO_DEFAULT;
  } catch {
    return HERO_DEFAULT;
  }
}

export function setSelectedHero(hero: HeroId) {
  try {
    localStorage.setItem(HERO_KEY, hero);
  } catch {
    // 隐私模式等场景写不进就算了，本局内存中的选择仍生效
  }
}
