import * as THREE from "three";
import { isDown, consumePressed } from "../core/input";
import { surfaceHeight } from "../world/sand";
import { loadRiggedModel, fitRiggedToPlaceholder } from "../core/models";
import { createVoxelAsset } from "../voxel-assets";

export type PlayerState = {
  position: THREE.Vector3;
  heading: number;
  speed: number;
  verticalVelocity: number;
  grounded: boolean;
  attackTimer: number;
};

export const playerState: PlayerState = {
  position: new THREE.Vector3(0, 0, 0),
  heading: 0,
  speed: 0,
  verticalVelocity: 0,
  grounded: true,
  attackTimer: 0,
};

const WALK_SPEED = 36;
const SPRINT_MULTIPLIER = 1.7;
const TURN_SPEED = 2.6;
const JUMP_VELOCITY = 56;
const GRAVITY = 150;
// 0.6s 让混元 Attack 挥刀动作能被看清（0.32s 时快到只剩残影）
const ATTACK_DURATION = 0.6;

const tempVec = new THREE.Vector3();
const SHIP_COLLIDER_RADIUS = 34;

// 混元骨骼主角（H01 v1 正版）：AnimationMixer 四态状态机；加载失败回退体素占位
let mixer: THREE.AnimationMixer | null = null;
const actions: Record<string, THREE.AnimationAction> = {};
let currentAction = "";
let riggedModel: THREE.Object3D | null = null;
let needsReground = false;

// 绑定姿态与动画姿态的脚底高度不同——首帧动画应用后按"实际姿态"包围盒重新贴地
function regroundRigged() {
  if (!riggedModel) return;
  let posedBox: THREE.Box3 | null = null;
  riggedModel.traverse((child) => {
    const mesh = child as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh) {
      mesh.computeBoundingBox();
      if (mesh.boundingBox) {
        posedBox = posedBox ? posedBox.union(mesh.boundingBox) : mesh.boundingBox.clone();
      }
    }
  });
  if (posedBox) {
    const box = posedBox as THREE.Box3;
    riggedModel.position.y = -box.min.y * riggedModel.scale.y;
  }
}

function playAction(name: string, fade = 0.18) {
  if (!mixer || currentAction === name) return;
  const next = actions[name];
  if (!next) return;
  const prev = actions[currentAction];
  next.reset().fadeIn(fade).play();
  if (prev) prev.fadeOut(fade);
  currentAction = name;
}

export function createPlayerAvatar() {
  const rig = new THREE.Group();

  const placeholder = createVoxelAsset("A02");
  placeholder.scale.setScalar(4.2);
  rig.add(placeholder);

  loadRiggedModel("/models/hero_rigged.glb?v=blender-h01-v2")
    .then(({ scene: model, animations }) => {
      // 朝向已实测核对：模型面朝 +Z 与游戏前进方向一致，无需旋转
      fitRiggedToPlaceholder(model, placeholder);
      rig.remove(placeholder);
      rig.add(model);
      riggedModel = model;
      needsReground = true;
      mixer = new THREE.AnimationMixer(model);
      for (const clip of animations) {
        actions[clip.name] = mixer.clipAction(clip);
      }
      const attackClip = animations.find((clip) => clip.name === "Attack");
      if (actions.Attack && attackClip) {
        actions.Attack.setLoop(THREE.LoopOnce, 1);
        // 完整挥刀动作压进出手时长
        actions.Attack.timeScale = attackClip.duration / ATTACK_DURATION;
      }
      playAction("Idle");
    })
    .catch((error) => {
      console.error("骨骼主角加载失败，保留体素占位", error);
    });

  return rig;
}

// 攻击冷却：挥刀期间不可再次出手
export function startAttack() {
  if (playerState.attackTimer > 0) return false;
  playerState.attackTimer = ATTACK_DURATION;
  return true;
}

export function updatePlayer(
  avatar: THREE.Object3D,
  delta: number,
  elapsed: number,
  shipPosition: THREE.Vector3,
) {
  const forwardInput = Number(isDown("KeyW") || isDown("ArrowUp"));
  const backInput = Number(isDown("KeyS") || isDown("ArrowDown"));
  const leftInput = Number(isDown("KeyA") || isDown("ArrowLeft"));
  const rightInput = Number(isDown("KeyD") || isDown("ArrowRight"));
  const sprinting = isDown("ShiftLeft") || isDown("ShiftRight");

  playerState.heading += (leftInput - rightInput) * TURN_SPEED * delta;

  const thrust = forwardInput - backInput * 0.7;
  const targetSpeed = thrust * WALK_SPEED * (sprinting ? SPRINT_MULTIPLIER : 1);
  playerState.speed = THREE.MathUtils.damp(playerState.speed, targetSpeed, 8, delta);

  const forward = tempVec.set(Math.sin(playerState.heading), 0, Math.cos(playerState.heading));
  const prevX = playerState.position.x;
  const prevZ = playerState.position.z;
  playerState.position.addScaledVector(forward, playerState.speed * delta);
  playerState.position.x = THREE.MathUtils.clamp(playerState.position.x, -1420, 1420);
  playerState.position.z = THREE.MathUtils.clamp(playerState.position.z, -1420, 1420);

  // 船体圆形碰撞：只拦"靠得更近"，离开方向放行（不会把人卡在船边）
  const shipDistNext = Math.hypot(
    playerState.position.x - shipPosition.x,
    playerState.position.z - shipPosition.z,
  );
  if (shipDistNext < SHIP_COLLIDER_RADIUS) {
    const shipDistPrev = Math.hypot(prevX - shipPosition.x, prevZ - shipPosition.z);
    if (shipDistNext <= shipDistPrev) {
      playerState.position.x = prevX;
      playerState.position.z = prevZ;
    }
  }

  // 跳跃与重力：落回网格表面高度；走上更高台阶时自动登阶
  if (playerState.grounded && consumePressed("Space")) {
    playerState.verticalVelocity = JUMP_VELOCITY;
    playerState.grounded = false;
  }
  playerState.verticalVelocity -= GRAVITY * delta;
  let nextY = playerState.position.y + playerState.verticalVelocity * delta;
  const ground = surfaceHeight(playerState.position.x, playerState.position.z);
  if (nextY <= ground) {
    nextY = ground;
    playerState.verticalVelocity = 0;
    playerState.grounded = true;
  } else {
    playerState.grounded = false;
  }
  playerState.position.y = nextY;

  avatar.position.copy(playerState.position);
  if (mixer) {
    // 骨骼动画状态机：攻击 > 跑 > 走 > 待机；程序化起伏让位给动画
    mixer.update(delta);
    if (needsReground) {
      // 首帧动画姿态生效后，按实际姿态重新贴地（修复绑定姿态偏移导致的悬空）
      needsReground = false;
      regroundRigged();
    }
    if (playerState.attackTimer > 0) playAction("Attack", 0.06);
    else if (Math.abs(playerState.speed) > 2) playAction(sprinting ? "Run" : "Walk");
    else playAction("Idle");
  } else if (playerState.grounded && Math.abs(playerState.speed) > 2) {
    const bobSpeed = sprinting ? 12 : 9;
    avatar.position.y += Math.abs(Math.sin(elapsed * bobSpeed)) * 1.1;
  }
  avatar.rotation.y = playerState.heading;

  // 挥刀：动作由混元 Attack clip 承担，这里只保留身体微前倾的重量感
  if (playerState.attackTimer > 0) {
    playerState.attackTimer = Math.max(0, playerState.attackTimer - delta);
    const progress = 1 - playerState.attackTimer / ATTACK_DURATION;
    avatar.rotation.x = Math.sin(progress * Math.PI) * 0.1;
  } else {
    avatar.rotation.x = 0;
  }
}

export function updateWalkCamera(
  camera: THREE.PerspectiveCamera,
  avatar: THREE.Object3D,
  delta: number,
  orbit: { yaw: number; pitch: number },
) {
  const angle = playerState.heading + orbit.yaw;
  const back = new THREE.Vector3(
    -Math.sin(angle) * 72,
    38 + orbit.pitch * 100,
    -Math.cos(angle) * 72,
  );
  const desired = avatar.position.clone().add(back);
  camera.position.lerp(desired, 1 - Math.exp(-delta * 4.5));
  camera.lookAt(avatar.position.x, avatar.position.y + 18, avatar.position.z);
}
