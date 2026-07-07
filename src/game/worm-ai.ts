import * as THREE from "three";
import { shipState } from "./ship-controller";
import { playerState } from "./player";
import { getState, setState } from "./store";
import { applyWormBite } from "./economy";
import { WORM_MAX_HP, WORM_RESPAWN_SECONDS, type EnemyDeathRecord } from "./data";

// 沙虫 AI（多实例）：每只有自己的领地与状态机。
// 攻击判定以沙虫自身为圆心：目标（航行中的船或步行角色）进入 ATTACK_RANGE
// 就持续循环 追击→咬→潜沙→再追，跑出 ATTACK_RANGE 才收手回巢。
// 追速 110 卡在帆 L1(106) 与 L2(122) 之间——L1 逃不掉，L2 起正面跑赢；
// 转向上限 0.55 rad/s 低于船的 0.60，蛇形走位可甩位。
export type WormAiMode = "patrol" | "chase" | "bite" | "dive" | "return" | "dead";

export type WormTerritory = {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly leash: number;
};

export type WormAgent = {
  readonly id: number;
  readonly territory: WormTerritory;
  mode: WormAiMode;
  position: THREE.Vector3;
  heading: number;
  hp: number;
  patrolTargetX: number;
  patrolTargetZ: number;
  patrolTimer: number;
  biteTimer: number;
  diveTimer: number;
  respawnTimer: number;
};

const ATTACK_RANGE = 450;
const PATROL_SPEED = 40;
const CHASE_SPEED = 110;
const RETURN_SPEED = 60;
const CHASE_TURN_RATE = 0.55;
const BITE_RANGE = 40;
const BITE_DAMAGE = 35;
const BITE_DURATION = 0.55;
const DIVE_DURATION = 3;

// 三块领地：原巢 + 西南深沙 + 南航道旁（都避开港口停靠区）
const TERRITORIES: readonly WormTerritory[] = [
  { x: 760, z: -680, radius: 420, leash: 540 },
  { x: -950, z: 850, radius: 360, leash: 470 },
  { x: -60, z: -1080, radius: 360, leash: 470 },
];

export const wormAgents: WormAgent[] = TERRITORIES.map((territory, id) => ({
  id,
  territory,
  mode: "patrol",
  position: new THREE.Vector3(territory.x, 0, territory.z),
  heading: 0,
  hp: WORM_MAX_HP,
  patrolTargetX: territory.x,
  patrolTargetZ: territory.z,
  patrolTimer: 0,
  biteTimer: 0,
  diveTimer: 0,
  respawnTimer: 0,
}));

// 兼容旧调试钩子与既有测试：wormAi 指向 0 号（原巢）沙虫
export const wormAi = wormAgents[0];

function wrapAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function moveToward(agent: WormAgent, targetX: number, targetZ: number, speed: number, turnRate: number, delta: number) {
  const desired = Math.atan2(targetX - agent.position.x, targetZ - agent.position.z);
  const diff = wrapAngle(desired - agent.heading);
  agent.heading += THREE.MathUtils.clamp(diff, -turnRate * delta, turnRate * delta);
  agent.position.x += Math.sin(agent.heading) * speed * delta;
  agent.position.z += Math.cos(agent.heading) * speed * delta;
}

function pickPatrolTarget(agent: WormAgent) {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * agent.territory.radius * 0.72;
  agent.patrolTargetX = agent.territory.x + Math.cos(angle) * radius;
  agent.patrolTargetZ = agent.territory.z + Math.sin(angle) * radius;
  agent.patrolTimer = 6;
}

// 目标位置：航行时是船，上岸后是步行角色
function targetPosition(sailing: boolean) {
  return sailing ? shipState.position : playerState.position;
}

function targetDistanceToWorm(agent: WormAgent, sailing: boolean) {
  const target = targetPosition(sailing);
  return Math.hypot(target.x - agent.position.x, target.z - agent.position.z);
}

function wormDistanceToHome(agent: WormAgent) {
  return Math.hypot(agent.position.x - agent.territory.x, agent.position.z - agent.territory.z);
}

// 被鱼叉命中：掉血、激怒（巡逻/返巢中也转追击）；打死返回 true
export function damageWorm(agent: WormAgent, damage: number): boolean {
  if (agent.mode === "dead") return false;
  agent.hp = Math.max(0, agent.hp - damage);
  if (agent.hp <= 0) {
    agent.mode = "dead";
    agent.respawnTimer = WORM_RESPAWN_SECONDS;
    return true;
  }
  if (agent.mode === "patrol" || agent.mode === "return") {
    agent.mode = "chase";
  }
  return false;
}

export function applySavedWormDeaths(records: readonly EnemyDeathRecord[]) {
  const now = Date.now();
  for (const agent of wormAgents) {
    const record = records.find((entry) => entry.kind === "worm" && entry.id === agent.id);
    if (record && Number.isFinite(record.deadUntil) && record.deadUntil > now) {
      agent.mode = "dead";
      agent.hp = 0;
      agent.respawnTimer = Math.max(0.1, (record.deadUntil - now) / 1000);
      continue;
    }
    if (agent.mode === "dead") {
      agent.hp = WORM_MAX_HP;
      agent.position.set(agent.territory.x, 0, agent.territory.z);
      agent.mode = "patrol";
      agent.respawnTimer = 0;
      pickPatrolTarget(agent);
    }
  }
}

// 咬击结果：击中船（扣船壳掉货）或击中步行角色（扣角色 HP，由 main 结算）
export type WormBiteTarget = "ship" | "player";

function updateAgent(agent: WormAgent, delta: number, sailing: boolean): WormBiteTarget | null {
  let bit: WormBiteTarget | null = null;

  switch (agent.mode) {
    case "dead": {
      agent.respawnTimer -= delta;
      if (agent.respawnTimer <= 0) {
        agent.hp = WORM_MAX_HP;
        agent.position.set(agent.territory.x, 0, agent.territory.z);
        agent.mode = "patrol";
        pickPatrolTarget(agent);
      }
      break;
    }
    case "patrol": {
      agent.patrolTimer -= delta;
      const dx = agent.patrolTargetX - agent.position.x;
      const dz = agent.patrolTargetZ - agent.position.z;
      if (agent.patrolTimer <= 0 || Math.hypot(dx, dz) < 30) pickPatrolTarget(agent);
      moveToward(agent, agent.patrolTargetX, agent.patrolTargetZ, PATROL_SPEED, 1.2, delta);
      if (targetDistanceToWorm(agent, sailing) < ATTACK_RANGE) {
        agent.mode = "chase";
      }
      break;
    }
    case "chase": {
      // 目标跑出攻击圈、或沙虫被拖离领地太远（拴绳）才收手
      if (targetDistanceToWorm(agent, sailing) > ATTACK_RANGE || wormDistanceToHome(agent) > agent.territory.leash) {
        agent.mode = "return";
        break;
      }
      const target = targetPosition(sailing);
      // 近身自适应转向：保证转弯半径 ≤ 0.45×目标距离，否则绕着站定目标
      // （如步行角色）打转永远咬不到；攻击圈边缘仍是 0.55 上限，可蛇形甩位
      const distance = targetDistanceToWorm(agent, sailing);
      const turnRate = Math.max(CHASE_TURN_RATE, CHASE_SPEED / Math.max(distance * 0.45, 12));
      moveToward(agent, target.x, target.z, CHASE_SPEED, turnRate, delta);
      if (targetDistanceToWorm(agent, sailing) < BITE_RANGE) {
        // 船上：咬船壳并掉货；步行：咬的是角色本人，船壳无损，HP 结算交给 main
        if (sailing) setState(applyWormBite(getState(), BITE_DAMAGE));
        bit = sailing ? "ship" : "player";
        agent.mode = "bite";
        agent.biteTimer = BITE_DURATION;
      }
      break;
    }
    case "bite": {
      agent.biteTimer -= delta;
      if (agent.biteTimer <= 0) {
        agent.mode = "dive";
        agent.diveTimer = DIVE_DURATION;
      }
      break;
    }
    case "dive": {
      // 沉沙 3 秒：不移动不攻击，玩家的逃跑窗口；结束时目标仍在攻击圈内就继续追
      agent.diveTimer -= delta;
      if (agent.diveTimer <= 0) {
        agent.mode = targetDistanceToWorm(agent, sailing) < ATTACK_RANGE ? "chase" : "return";
      }
      break;
    }
    case "return": {
      moveToward(agent, agent.territory.x, agent.territory.z, RETURN_SPEED, 1.2, delta);
      const homeDistance = wormDistanceToHome(agent);
      // 归途中撞见圈内目标（且已回到领地内）就重新开咬
      if (homeDistance < agent.territory.radius && targetDistanceToWorm(agent, sailing) < ATTACK_RANGE) {
        agent.mode = "chase";
        break;
      }
      if (homeDistance < 200) {
        agent.mode = "patrol";
        pickPatrolTarget(agent);
      }
      break;
    }
  }

  return bit;
}

// 每帧驱动全部沙虫；返回本帧咬中的目标类型（main 做受击反馈），无命中为 null
export function updateWormAi(delta: number, sailing: boolean): WormBiteTarget | null {
  let bit: WormBiteTarget | null = null;
  for (const agent of wormAgents) {
    const hit = updateAgent(agent, delta, sailing);
    if (hit) bit = hit;
  }
  return bit;
}
