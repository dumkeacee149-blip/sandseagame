import * as THREE from "three";
import { isDown } from "../core/input";
import { surfaceHeight, islandLift } from "../world/sand";
import { SEA_OBSTACLES } from "../world/landmarks";
import { sailSpeed } from "./data";
import { getState } from "./store";

export type ShipState = {
  position: THREE.Vector3;
  heading: number;
  speed: number;
  targetSpeed: number;
};

export const shipState: ShipState = {
  position: new THREE.Vector3(0, 0, 0),
  heading: 0.55,
  speed: 0,
  targetSpeed: 0,
};

const tempVec = new THREE.Vector3();

function hitsSeaRock(x: number, z: number) {
  for (const rock of SEA_OBSTACLES) {
    const dx = x - rock.x;
    const dz = z - rock.z;
    if (dx * dx + dz * dz < rock.r * rock.r) return true;
  }
  return false;
}

export function updateShip(ship: THREE.Object3D, delta: number, elapsed: number) {
  const forwardInput = Number(isDown("KeyW") || isDown("ArrowUp"));
  const backInput = Number(isDown("KeyS") || isDown("ArrowDown"));
  const leftInput = Number(isDown("KeyA") || isDown("ArrowLeft"));
  const rightInput = Number(isDown("KeyD") || isDown("ArrowRight"));

  const thrust = forwardInput - backInput * 0.62;
  // 最高速由帆等级决定（92/106/122/140）——L2 起正面跑赢沙虫(110)
  shipState.targetSpeed = thrust * sailSpeed(getState());
  shipState.speed = THREE.MathUtils.damp(shipState.speed, shipState.targetSpeed, 2.5, delta);

  const turn = (leftInput - rightInput) * Math.max(Math.abs(shipState.speed), 28) * 0.0065;
  shipState.heading += turn * delta;

  const forward = tempVec.set(Math.sin(shipState.heading), 0, Math.cos(shipState.heading));
  const nextX = shipState.position.x + forward.x * shipState.speed * delta;
  const nextZ = shipState.position.z + forward.z * shipState.speed * delta;
  // 岛屿与礁岩都是实体：撞上则停船（后续接耐久扣血）
  if (islandLift(nextX, nextZ) > 6 || hitsSeaRock(nextX, nextZ)) {
    shipState.speed *= 0.2;
  } else {
    shipState.position.x = nextX;
    shipState.position.z = nextZ;
  }
  shipState.position.x = THREE.MathUtils.clamp(shipState.position.x, -1420, 1420);
  shipState.position.z = THREE.MathUtils.clamp(shipState.position.z, -1420, 1420);
  shipState.position.y =
    surfaceHeight(shipState.position.x, shipState.position.z) + 1.2 + Math.sin(elapsed * 4) * 0.9;

  ship.position.copy(shipState.position);
  ship.rotation.y = shipState.heading;
  ship.rotation.z = THREE.MathUtils.damp(ship.rotation.z, -turn * 0.8, 5, delta);
  ship.rotation.x = Math.sin(elapsed * 2.6) * 0.025 + shipState.speed * 0.0007;
}

export type CameraOrbit = { yaw: number; pitch: number };

export function updateCamera(
  camera: THREE.PerspectiveCamera,
  ship: THREE.Object3D,
  delta: number,
  orbit: CameraOrbit,
) {
  const angle = shipState.heading + orbit.yaw;
  const back = new THREE.Vector3(
    -Math.sin(angle) * 165,
    58 + orbit.pitch * 190,
    -Math.cos(angle) * 165,
  );
  const side = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle)).multiplyScalar(28);
  const desired = ship.position.clone().add(back).add(side);
  camera.position.lerp(desired, 1 - Math.exp(-delta * 3.8));
  camera.lookAt(ship.position.x, ship.position.y + 46, ship.position.z);
}
