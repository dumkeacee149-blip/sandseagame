import * as THREE from "three";
import { playerState } from "./player";
import { CRAB_MAX_HP, CRAB_RESPAWN_SECONDS, type EnemyDeathRecord } from "./data";

// 沙蟹 AI（陆地近战，worm-ai 的 walker 版）：只袭击步行中的船长。
// 巡逻速度远低于步速（36），追击 42 略快于走路——不冲刺就会被追上，
// 冲刺（61）稳跑赢：新手永远有退路。刻意不放在货箱区（新手区安全）。
export type CrabAiMode = "patrol" | "chase" | "attack" | "dead";

export type CrabTerritory = {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly leash: number;
};

export type CrabAgent = {
  readonly id: number;
  readonly territory: CrabTerritory;
  mode: CrabAiMode;
  position: THREE.Vector3;
  heading: number;
  hp: number;
  patrolTargetX: number;
  patrolTargetZ: number;
  patrolTimer: number;
  attackTimer: number;
  respawnTimer: number;
};

const AGGRO_RANGE = 130;
const PATROL_SPEED = 12;
const CHASE_SPEED = 42;
const ATTACK_RANGE = 16;
const ATTACK_COOLDOWN = 1.2;

// 四块领地：绿洲港外围、遗迹岛两处、Saltcrest 外围（都避开货箱区与集市）
const TERRITORIES: readonly CrabTerritory[] = [
  { x: -700, z: -120, radius: 130, leash: 200 },
  { x: 640, z: 250, radius: 150, leash: 230 },
  { x: 790, z: 390, radius: 140, leash: 210 },
  { x: 170, z: 510, radius: 130, leash: 200 },
];

export const crabAgents: CrabAgent[] = TERRITORIES.map((territory, id) => ({
  id,
  territory,
  mode: "patrol",
  position: new THREE.Vector3(territory.x, 0, territory.z),
  heading: 0,
  hp: CRAB_MAX_HP,
  patrolTargetX: territory.x,
  patrolTargetZ: territory.z,
  patrolTimer: 0,
  attackTimer: 0,
  respawnTimer: 0,
}));

function wrapAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function moveToward(agent: CrabAgent, targetX: number, targetZ: number, speed: number, delta: number) {
  const desired = Math.atan2(targetX - agent.position.x, targetZ - agent.position.z);
  agent.heading += THREE.MathUtils.clamp(wrapAngle(desired - agent.heading), -3 * delta, 3 * delta);
  agent.position.x += Math.sin(agent.heading) * speed * delta;
  agent.position.z += Math.cos(agent.heading) * speed * delta;
}

function pickPatrolTarget(agent: CrabAgent) {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * agent.territory.radius * 0.8;
  agent.patrolTargetX = agent.territory.x + Math.cos(angle) * radius;
  agent.patrolTargetZ = agent.territory.z + Math.sin(angle) * radius;
  agent.patrolTimer = 5;
}

function playerDistance(agent: CrabAgent) {
  return Math.hypot(playerState.position.x - agent.position.x, playerState.position.z - agent.position.z);
}

function homeDistance(agent: CrabAgent) {
  return Math.hypot(agent.position.x - agent.territory.x, agent.position.z - agent.territory.z);
}

// 挥砍命中：掉血；打死返回 true（掉落与记账由调用方结算）
export function damageCrab(agent: CrabAgent, damage: number): boolean {
  if (agent.mode === "dead") return false;
  agent.hp = Math.max(0, agent.hp - damage);
  if (agent.hp <= 0) {
    agent.mode = "dead";
    agent.respawnTimer = CRAB_RESPAWN_SECONDS;
    return true;
  }
  agent.mode = "chase";
  return false;
}

export function applySavedCrabDeaths(records: readonly EnemyDeathRecord[]) {
  const now = Date.now();
  for (const agent of crabAgents) {
    const record = records.find((entry) => entry.kind === "crab" && entry.id === agent.id);
    if (record && Number.isFinite(record.deadUntil) && record.deadUntil > now) {
      agent.mode = "dead";
      agent.hp = 0;
      agent.respawnTimer = Math.max(0.1, (record.deadUntil - now) / 1000);
    }
  }
}

function updateAgent(agent: CrabAgent, delta: number, walking: boolean): number {
  let damageDealt = 0;

  switch (agent.mode) {
    case "dead": {
      agent.respawnTimer -= delta;
      if (agent.respawnTimer <= 0) {
        agent.hp = CRAB_MAX_HP;
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
      if (agent.patrolTimer <= 0 || Math.hypot(dx, dz) < 8) pickPatrolTarget(agent);
      moveToward(agent, agent.patrolTargetX, agent.patrolTargetZ, PATROL_SPEED, delta);
      if (walking && playerDistance(agent) < AGGRO_RANGE) agent.mode = "chase";
      break;
    }
    case "chase": {
      if (!walking || playerDistance(agent) > AGGRO_RANGE || homeDistance(agent) > agent.territory.leash) {
        agent.mode = "patrol";
        pickPatrolTarget(agent);
        break;
      }
      moveToward(agent, playerState.position.x, playerState.position.z, CHASE_SPEED, delta);
      if (playerDistance(agent) < ATTACK_RANGE) {
        agent.mode = "attack";
        agent.attackTimer = 0;
      }
      break;
    }
    case "attack": {
      if (!walking || playerDistance(agent) > ATTACK_RANGE * 1.6) {
        agent.mode = walking ? "chase" : "patrol";
        break;
      }
      agent.attackTimer -= delta;
      if (agent.attackTimer <= 0) {
        agent.attackTimer = ATTACK_COOLDOWN;
        damageDealt += 1; // 每次命中记 1 击（伤害值由 main 用 CRAB_DAMAGE 结算）
      }
      break;
    }
  }

  return damageDealt;
}

// 每帧驱动全部沙蟹；返回本帧命中玩家的次数（main 结算扣血与反馈）
export function updateCrabAi(delta: number, walking: boolean): number {
  let hits = 0;
  for (const agent of crabAgents) {
    hits += updateAgent(agent, delta, walking);
  }
  return hits;
}
