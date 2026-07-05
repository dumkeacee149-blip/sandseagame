import * as THREE from "three";
import { isDown, consumePressed } from "../core/input";
import { worldHeight } from "../world/sand";
import { loadRiggedModel, fitToPlaceholder } from "../core/models";
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
const ATTACK_DURATION = 0.32;

const tempVec = new THREE.Vector3();
let slashPivot: THREE.Group | null = null;

// 骨骼动画：加载完成后接管姿态，占位/加载失败时回退程序化起伏
let mixer: THREE.AnimationMixer | null = null;
const actions: Record<string, THREE.AnimationAction> = {};
let currentAction = "";

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

  loadRiggedModel("/models/hero_rigged.glb")
    .then(({ scene: model, animations }) => {
      fitToPlaceholder(model, placeholder);
      rig.remove(placeholder);
      rig.add(model);
      mixer = new THREE.AnimationMixer(model);
      for (const clip of animations) {
        actions[clip.name] = mixer.clipAction(clip);
      }
      if (actions.Attack) {
        actions.Attack.setLoop(THREE.LoopOnce, 1);
        // Attack clip 长 1s，压到游戏内 0.32s 的出手节奏
        actions.Attack.timeScale = 3;
      }
      playAction("Idle");
    })
    .catch((error) => {
      console.error("骨骼主角加载失败，保留体素占位", error);
    });

  // 挥刀轨迹：攻击时绕玩家扫过的发光刀光
  slashPivot = new THREE.Group();
  slashPivot.position.y = 9;
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(3, 1.8, 17),
    new THREE.MeshBasicMaterial({ color: "#d8fff4", transparent: true, opacity: 0.85 }),
  );
  blade.position.z = 13;
  slashPivot.add(blade);
  slashPivot.visible = false;
  rig.add(slashPivot);

  return rig;
}

// 攻击冷却：挥刀期间不可再次出手
export function startAttack() {
  if (playerState.attackTimer > 0) return false;
  playerState.attackTimer = ATTACK_DURATION;
  return true;
}

export function updatePlayer(avatar: THREE.Object3D, delta: number, elapsed: number) {
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
  playerState.position.addScaledVector(forward, playerState.speed * delta);
  playerState.position.x = THREE.MathUtils.clamp(playerState.position.x, -1420, 1420);
  playerState.position.z = THREE.MathUtils.clamp(playerState.position.z, -1420, 1420);

  // 跳跃与重力：落回 worldHeight；走上更高台阶时自动登阶
  if (playerState.grounded && consumePressed("Space")) {
    playerState.verticalVelocity = JUMP_VELOCITY;
    playerState.grounded = false;
  }
  playerState.verticalVelocity -= GRAVITY * delta;
  let nextY = playerState.position.y + playerState.verticalVelocity * delta;
  const ground = worldHeight(playerState.position.x, playerState.position.z);
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
    // 骨骼动画状态机：攻击 > 跑 > 走 > 待机
    mixer.update(delta);
    if (playerState.attackTimer > 0) playAction("Attack", 0.06);
    else if (Math.abs(playerState.speed) > 2) playAction(sprinting ? "Run" : "Walk");
    else playAction("Idle");
  } else if (playerState.grounded && Math.abs(playerState.speed) > 2) {
    const bobSpeed = sprinting ? 12 : 9;
    avatar.position.y += Math.abs(Math.sin(elapsed * bobSpeed)) * 1.1;
  }
  avatar.rotation.y = playerState.heading;

  // 挥刀动画：刀光从右向左扫 120°，身体微前倾
  if (playerState.attackTimer > 0) {
    playerState.attackTimer = Math.max(0, playerState.attackTimer - delta);
    const progress = 1 - playerState.attackTimer / ATTACK_DURATION;
    if (slashPivot) {
      slashPivot.visible = playerState.attackTimer > 0;
      slashPivot.rotation.y = 1.1 - 2.2 * progress;
    }
    avatar.rotation.x = Math.sin(progress * Math.PI) * 0.14;
  } else {
    if (slashPivot) slashPivot.visible = false;
    avatar.rotation.x = 0;
  }
}

export function updateWalkCamera(camera: THREE.PerspectiveCamera, avatar: THREE.Object3D, delta: number) {
  const back = new THREE.Vector3(
    -Math.sin(playerState.heading) * 72,
    38,
    -Math.cos(playerState.heading) * 72,
  );
  const desired = avatar.position.clone().add(back);
  camera.position.lerp(desired, 1 - Math.exp(-delta * 4.5));
  camera.lookAt(avatar.position.x, avatar.position.y + 18, avatar.position.z);
}
