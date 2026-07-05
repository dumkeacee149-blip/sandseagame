import * as THREE from "three";
import { isDown } from "../core/input";
import { worldHeight } from "../world/sand";
import { hunyuanSlot } from "../core/models";
import { createVoxelAsset } from "../voxel-assets";

export type PlayerState = {
  position: THREE.Vector3;
  heading: number;
  speed: number;
};

export const playerState: PlayerState = {
  position: new THREE.Vector3(0, 0, 0),
  heading: 0,
  speed: 0,
};

const WALK_SPEED = 36;
const TURN_SPEED = 2.6;
const tempVec = new THREE.Vector3();

export function createPlayerAvatar() {
  const placeholder = createVoxelAsset("A02");
  placeholder.scale.setScalar(4.2);
  return hunyuanSlot(placeholder, "/models/hero.glb");
}

export function updatePlayer(avatar: THREE.Object3D, delta: number, elapsed: number) {
  const forwardInput = Number(isDown("KeyW") || isDown("ArrowUp"));
  const backInput = Number(isDown("KeyS") || isDown("ArrowDown"));
  const leftInput = Number(isDown("KeyA") || isDown("ArrowLeft"));
  const rightInput = Number(isDown("KeyD") || isDown("ArrowRight"));

  playerState.heading += (leftInput - rightInput) * TURN_SPEED * delta;

  const thrust = forwardInput - backInput * 0.7;
  const targetSpeed = thrust * WALK_SPEED;
  playerState.speed = THREE.MathUtils.damp(playerState.speed, targetSpeed, 8, delta);

  const forward = tempVec.set(Math.sin(playerState.heading), 0, Math.cos(playerState.heading));
  playerState.position.addScaledVector(forward, playerState.speed * delta);
  playerState.position.x = THREE.MathUtils.clamp(playerState.position.x, -1420, 1420);
  playerState.position.z = THREE.MathUtils.clamp(playerState.position.z, -1420, 1420);
  playerState.position.y = worldHeight(playerState.position.x, playerState.position.z);

  avatar.position.copy(playerState.position);
  if (Math.abs(playerState.speed) > 2) {
    avatar.position.y += Math.abs(Math.sin(elapsed * 9)) * 1.1;
  }
  avatar.rotation.y = playerState.heading;
}

export function updateWalkCamera(camera: THREE.PerspectiveCamera, avatar: THREE.Object3D, delta: number) {
  const back = new THREE.Vector3(
    -Math.sin(playerState.heading) * 72,
    36,
    -Math.cos(playerState.heading) * 72,
  );
  const desired = avatar.position.clone().add(back);
  camera.position.lerp(desired, 1 - Math.exp(-delta * 4.5));
  camera.lookAt(avatar.position.x, avatar.position.y + 18, avatar.position.z);
}
