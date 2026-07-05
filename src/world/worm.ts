import * as THREE from "three";
import { loadRiggedModel, fitToPlaceholder } from "../core/models";
import { mat } from "../core/materials";
import { sandHeight } from "./sand";
import { createVoxelAsset } from "../voxel-assets";

// 沙虫 = 骨骼动画(Swim/Burrow/Bite) + 钻沙表演(位移/朝向/下潜/沙尘)。
// W2 的 AI 状态机驱动这两层；骨骼加载失败时体素占位 + 表演层依然成立。
const DUST_COUNT = 10;

let wormMixer: THREE.AnimationMixer | null = null;
const wormActions: Record<string, THREE.AnimationAction> = {};
let currentWormAction = "";

function playWormAction(name: string, fade = 0.3) {
  if (!wormMixer || currentWormAction === name) return;
  const next = wormActions[name];
  if (!next) return;
  const prev = wormActions[currentWormAction];
  next.reset().fadeIn(fade).play();
  if (prev) prev.fadeOut(fade);
  currentWormAction = name;
}

export function createWorm() {
  const rig = new THREE.Group();

  const placeholder = createVoxelAsset("A07");
  placeholder.scale.setScalar(16);
  rig.add(placeholder);

  loadRiggedModel("/models/leviathan_rigged.glb")
    .then(({ scene: model, animations }) => {
      fitToPlaceholder(model, placeholder);
      rig.remove(placeholder);
      model.name = "worm-body";
      rig.add(model);
      wormMixer = new THREE.AnimationMixer(model);
      for (const clip of animations) {
        wormActions[clip.name] = wormMixer.clipAction(clip);
      }
      playWormAction("Swim");
    })
    .catch((error) => {
      console.error("骨骼沙虫加载失败，保留体素占位", error);
    });

  const dust = new THREE.Group();
  dust.name = "worm-dust";
  const dustMat = mat("worm-dust-sand", "#d9a65d");
  for (let i = 0; i < DUST_COUNT; i += 1) {
    const angle = (i / DUST_COUNT) * Math.PI * 2;
    const chunk = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 7), dustMat);
    chunk.position.set(Math.cos(angle) * 52, 0, Math.sin(angle) * 68);
    dust.add(chunk);
  }
  rig.add(dust);

  rig.position.set(760, sandHeight(760, -680), -680);
  return rig;
}

export function updateWorm(rig: THREE.Group, elapsed: number, delta: number) {
  rig.position.x = 760 + Math.sin(elapsed * 0.16) * 92;
  rig.position.z = -680 + Math.cos(elapsed * 0.12) * 68;

  // 面朝行进方向（路径的解析导数），而不是原地摇摆
  const dx = Math.cos(elapsed * 0.16) * 0.16 * 92;
  const dz = -Math.sin(elapsed * 0.12) * 0.12 * 68;
  rig.rotation.y = Math.atan2(dx, dz);

  // 钻沙循环：大部分时间浮出，周期性沉入沙下再钻出
  const burrowCycle = (Math.sin(elapsed * 0.3) + 1) / 2;
  const submerged = THREE.MathUtils.smoothstep(burrowCycle, 0.72, 0.95);

  // 骨骼动画：下潜段切 Burrow，其余 Swim；Bite 留给 W2 的 AI 状态机
  if (wormMixer) {
    wormMixer.update(delta);
    playWormAction(submerged > 0.4 ? "Burrow" : "Swim");
  }
  const bob = Math.sin(elapsed * 1.6) * 3;
  rig.position.y =
    sandHeight(rig.position.x, rig.position.z) + bob - 3 - submerged * 26;

  // 游动的波浪姿态
  rig.rotation.x = Math.sin(elapsed * 2.1) * 0.1 + submerged * 0.35;
  rig.rotation.z = Math.sin(elapsed * 1.3) * 0.06;

  // 沙尘环：贴着沙面翻滚，下潜时更剧烈（土里在动的感觉）
  const dust = rig.getObjectByName("worm-dust");
  if (dust) {
    dust.rotation.y = -rig.rotation.y + elapsed * 0.7;
    dust.position.y = -rig.position.y + sandHeight(rig.position.x, rig.position.z) + 2;
    dust.children.forEach((chunk, index) => {
      const lively = 1 + submerged * 1.6;
      chunk.position.y = Math.abs(Math.sin(elapsed * 3 + index * 1.7)) * 5 * lively;
      chunk.rotation.x += 0.05 * lively;
      chunk.rotation.z += 0.04 * lively;
      chunk.scale.setScalar(0.7 + Math.sin(elapsed * 2.2 + index) * 0.25);
    });
  }
}
