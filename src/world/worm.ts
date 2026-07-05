import * as THREE from "three";
import { hunyuanSlot } from "../core/models";
import { mat } from "../core/materials";
import { sandHeight } from "./sand";
import { createVoxelAsset } from "../voxel-assets";
import { wormAi } from "../game/worm-ai";

// 沙虫 = 混元静态模型 + 钻沙表演，位置/朝向/下潜由 game/worm-ai 状态机驱动。
// 骨骼版 H02 等混元重新生成后接回（AnimationMixer 实现见 git e400f08 的 worm.ts）。
const DUST_COUNT = 10;

export function createWorm() {
  const rig = new THREE.Group();

  const placeholder = createVoxelAsset("A07");
  placeholder.scale.setScalar(16);
  const body = hunyuanSlot(placeholder, "/models/leviathan.glb");
  body.name = "worm-body";
  rig.add(body);

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

  rig.position.copy(wormAi.position);
  rig.position.y = sandHeight(wormAi.position.x, wormAi.position.z);
  return rig;
}

export function updateWorm(rig: THREE.Group, elapsed: number) {
  rig.position.x = wormAi.position.x;
  rig.position.z = wormAi.position.z;
  rig.rotation.y = wormAi.heading;

  // 下潜量按 AI 状态：dive 全潜（逃跑窗口），chase 半露冲刺，patrol/return 浮游
  const targetSink =
    wormAi.mode === "dive" ? 30 : wormAi.mode === "chase" ? 6 : 3;
  const bob = Math.sin(elapsed * (wormAi.mode === "chase" ? 3.2 : 1.6)) * 3;
  rig.position.y = sandHeight(rig.position.x, rig.position.z) + bob - targetSink;

  // 游动的波浪姿态：追击时更凶
  const intensity = wormAi.mode === "chase" ? 2 : 1;
  rig.rotation.x = Math.sin(elapsed * 2.1 * intensity) * 0.1 * intensity;
  rig.rotation.z = Math.sin(elapsed * 1.3) * 0.06;

  // 沙尘环：贴着沙面翻滚；追击/下潜时更剧烈（土里有东西在动）
  const dust = rig.getObjectByName("worm-dust");
  if (dust) {
    const lively = wormAi.mode === "chase" ? 2.2 : wormAi.mode === "dive" ? 2.6 : 1;
    dust.rotation.y = -rig.rotation.y + elapsed * 0.7 * lively;
    dust.position.y = -rig.position.y + sandHeight(rig.position.x, rig.position.z) + 2;
    dust.children.forEach((chunk, index) => {
      chunk.position.y = Math.abs(Math.sin(elapsed * 3 + index * 1.7)) * 5 * lively;
      chunk.rotation.x += 0.05 * lively;
      chunk.rotation.z += 0.04 * lively;
      chunk.scale.setScalar(0.7 + Math.sin(elapsed * 2.2 + index) * 0.25);
    });
  }
}
