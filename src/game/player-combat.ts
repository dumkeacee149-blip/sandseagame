import { PLAYER_MAX_HP, PLAYER_REGEN_DELAY, PLAYER_REGEN_RATE } from "./data";

// 步行战斗的玩家 HP：运行时状态，不入存档。
// 脱战回血机制下持久化没有意义（刷新≈等 5 秒），也避免回血 tick 刷写 localStorage。
type PlayerCombatState = {
  hp: number;
  sinceLastHit: number;
};

const combat: PlayerCombatState = { hp: PLAYER_MAX_HP, sinceLastHit: PLAYER_REGEN_DELAY };

export function getPlayerHp() {
  return Math.ceil(combat.hp);
}

// 受击：返回剩余 HP（归零由调用方处理重生）
export function damagePlayer(amount: number): number {
  combat.hp = Math.max(0, combat.hp - amount);
  combat.sinceLastHit = 0;
  return combat.hp;
}

export function resetPlayerHp() {
  combat.hp = PLAYER_MAX_HP;
  combat.sinceLastHit = PLAYER_REGEN_DELAY;
}

// 每帧驱动：脱战 PLAYER_REGEN_DELAY 秒后按 PLAYER_REGEN_RATE 回血
export function updatePlayerCombat(delta: number) {
  combat.sinceLastHit += delta;
  if (combat.sinceLastHit >= PLAYER_REGEN_DELAY && combat.hp > 0 && combat.hp < PLAYER_MAX_HP) {
    combat.hp = Math.min(PLAYER_MAX_HP, combat.hp + PLAYER_REGEN_RATE * delta);
  }
}
