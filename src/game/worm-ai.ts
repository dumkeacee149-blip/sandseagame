import * as THREE from "three";
import { shipState } from "./ship-controller";
import { getState, setState } from "./store";
import { applyWormBite } from "./economy";

// 沙虫 AI 状态机（数值来自 plan §2 的分水岭设计）：
// 追速 110 卡在帆 L1(106) 与 L2(122) 之间——L1 逃不掉，L2 起正面跑赢；
// 转向上限 0.55 rad/s 低于船的 0.60，蛇形走位可甩位。
export type WormAiMode = "patrol" | "chase" | "dive" | "return";

const TERRITORY_X = 760;
const TERRITORY_Z = -680;
const TERRITORY_RADIUS = 420;
const LEASH_RADIUS = 540;
const AGGRO_RANGE = 500;
const DROP_RANGE = 450;
const PATROL_SPEED = 40;
const CHASE_SPEED = 110;
const RETURN_SPEED = 60;
const CHASE_TURN_RATE = 0.55;
const BITE_RANGE = 40;
const BITE_DAMAGE = 35;
const DIVE_DURATION = 3;

export const wormAi = {
  mode: "patrol" as WormAiMode,
  position: new THREE.Vector3(TERRITORY_X, 0, TERRITORY_Z),
  heading: 0,
  patrolTargetX: TERRITORY_X,
  patrolTargetZ: TERRITORY_Z,
  patrolTimer: 0,
  diveTimer: 0,
};

function wrapAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function moveToward(targetX: number, targetZ: number, speed: number, turnRate: number, delta: number) {
  const desired = Math.atan2(targetX - wormAi.position.x, targetZ - wormAi.position.z);
  const diff = wrapAngle(desired - wormAi.heading);
  wormAi.heading += THREE.MathUtils.clamp(diff, -turnRate * delta, turnRate * delta);
  wormAi.position.x += Math.sin(wormAi.heading) * speed * delta;
  wormAi.position.z += Math.cos(wormAi.heading) * speed * delta;
}

function pickPatrolTarget() {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * 300;
  wormAi.patrolTargetX = TERRITORY_X + Math.cos(angle) * radius;
  wormAi.patrolTargetZ = TERRITORY_Z + Math.sin(angle) * radius;
  wormAi.patrolTimer = 6;
}

function shipDistanceToCenter() {
  return Math.hypot(shipState.position.x - TERRITORY_X, shipState.position.z - TERRITORY_Z);
}

function shipDistanceToWorm() {
  return Math.hypot(shipState.position.x - wormAi.position.x, shipState.position.z - wormAi.position.z);
}

// 每帧驱动；sailing=false（玩家下船）时沙虫不追人只巡逻。
// 返回本帧是否发生咬击（main 用来做受击反馈）。
export function updateWormAi(delta: number, sailing: boolean): boolean {
  let bit = false;

  switch (wormAi.mode) {
    case "patrol": {
      wormAi.patrolTimer -= delta;
      const dx = wormAi.patrolTargetX - wormAi.position.x;
      const dz = wormAi.patrolTargetZ - wormAi.position.z;
      if (wormAi.patrolTimer <= 0 || Math.hypot(dx, dz) < 30) pickPatrolTarget();
      moveToward(wormAi.patrolTargetX, wormAi.patrolTargetZ, PATROL_SPEED, 1.2, delta);
      if (sailing && shipDistanceToCenter() < TERRITORY_RADIUS && shipDistanceToWorm() < AGGRO_RANGE) {
        wormAi.mode = "chase";
      }
      break;
    }
    case "chase": {
      if (!sailing || shipDistanceToCenter() > LEASH_RADIUS || shipDistanceToWorm() > DROP_RANGE) {
        wormAi.mode = "return";
        break;
      }
      moveToward(shipState.position.x, shipState.position.z, CHASE_SPEED, CHASE_TURN_RATE, delta);
      if (shipDistanceToWorm() < BITE_RANGE) {
        setState(applyWormBite(getState(), BITE_DAMAGE));
        bit = true;
        wormAi.mode = "dive";
        wormAi.diveTimer = DIVE_DURATION;
      }
      break;
    }
    case "dive": {
      // 沉沙 3 秒：不移动不攻击，玩家的逃跑窗口
      wormAi.diveTimer -= delta;
      if (wormAi.diveTimer <= 0) {
        wormAi.mode =
          sailing && shipDistanceToCenter() < TERRITORY_RADIUS ? "chase" : "return";
      }
      break;
    }
    case "return": {
      moveToward(TERRITORY_X, TERRITORY_Z, RETURN_SPEED, 1.2, delta);
      if (Math.hypot(wormAi.position.x - TERRITORY_X, wormAi.position.z - TERRITORY_Z) < 200) {
        wormAi.mode = "patrol";
        pickPatrolTarget();
      }
      break;
    }
  }

  return bit;
}
