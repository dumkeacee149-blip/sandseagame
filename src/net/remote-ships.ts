// 同世界在线：其他玩家船只的渲染层。
// 数据来自 net/presence 的快照缓冲；这里做 150ms 延迟插值让 10Hz 数据在
// 60fps 下顺滑。远端船是"幽灵船"：无碰撞、不参与经济，只做视觉与名牌。

import * as THREE from "three";
import { hunyuanSlot } from "../core/models";
import { createVoxelAsset } from "../voxel-assets";
import { surfaceHeight } from "../world/sand";
import { getRemotePlayers } from "./presence";
import type { RemotePlayer } from "./presence";

const INTERP_DELAY_MS = 150;
const TAG_HEIGHT = 46;

interface RemoteShipEntity {
  readonly group: THREE.Group;
  readonly bobPhase: number;
}

const entities = new Map<string, RemoteShipEntity>();
let worldScene: THREE.Scene | null = null;

export function initRemoteShips(scene: THREE.Scene) {
  worldScene = scene;
}

// 每帧调用：对齐实体集合 + 插值定位
export function updateRemoteShips(elapsed: number) {
  if (!worldScene) return;
  const players = getRemotePlayers();

  for (const [id, player] of players) {
    if (!entities.has(id)) spawnEntity(id, player);
  }
  for (const [id, entity] of entities) {
    const player = players.get(id);
    if (!player) {
      worldScene.remove(entity.group);
      entities.delete(id);
      continue;
    }
    placeEntity(entity, player, elapsed);
  }
}

function spawnEntity(id: string, player: RemotePlayer) {
  if (!worldScene) return;
  // 与玩家自己的船同一套管线：体素占位 → skiff.glb 载入后按脚印换入
  const placeholder = createVoxelAsset("A01");
  placeholder.scale.setScalar(9);
  const ship = hunyuanSlot(placeholder, "/models/skiff.glb", Math.PI / 2);

  const group = new THREE.Group();
  group.add(ship);
  group.add(buildNameTag(player.name));
  worldScene.add(group);

  // 各船 bob 相位错开，避免全场同步摇晃
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  entities.set(id, { group, bobPhase: (hash / 997) * Math.PI * 2 });
}

function placeEntity(entity: RemoteShipEntity, player: RemotePlayer, elapsed: number) {
  const pose = samplePose(player);
  if (!pose) return;
  const y = surfaceHeight(pose.x, pose.z) + 1.2 + Math.sin(elapsed * 4 + entity.bobPhase) * 0.9;
  entity.group.position.set(pose.x, y, pose.z);
  entity.group.rotation.y = pose.h;
}

// 以"当前时间 - 150ms"为渲染时刻，在缓冲的两帧快照间线性插值；
// 快照不足或已过期时钳制到最新一帧（船原地锚定，不外推防抖）
function samplePose(player: RemotePlayer): { x: number; z: number; h: number } | null {
  const samples = player.samples;
  if (samples.length === 0) return null;
  const renderTime = performance.now() - INTERP_DELAY_MS;

  const latest = samples[samples.length - 1];
  if (samples.length === 1 || renderTime >= latest.time) return latest;

  for (let i = samples.length - 2; i >= 0; i--) {
    const a = samples[i];
    const b = samples[i + 1];
    if (renderTime >= a.time) {
      const t = (renderTime - a.time) / Math.max(b.time - a.time, 1);
      return {
        x: THREE.MathUtils.lerp(a.x, b.x, t),
        z: THREE.MathUtils.lerp(a.z, b.z, t),
        h: lerpAngle(a.h, b.h, t),
      };
    }
  }
  return samples[0];
}

function lerpAngle(from: number, to: number, t: number) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * t;
}

function buildNameTag(name: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(12, 18, 26, 0.62)";
    ctx.beginPath();
    ctx.roundRect(8, 10, 240, 44, 10);
    ctx.fill();
    ctx.font = "bold 26px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e7debd";
    ctx.fillText(name, 128, 33, 224);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  sprite.scale.set(56, 14, 1);
  sprite.position.y = TAG_HEIGHT;
  return sprite;
}
