import { hunyuanSlot } from "../core/models";
import { sandHeight } from "./sand";
import { createVoxelAsset } from "../voxel-assets";
import type * as THREE from "three";

export function createWorm() {
  const placeholder = createVoxelAsset("A07");
  placeholder.scale.setScalar(16);
  const worm = hunyuanSlot(placeholder, "/models/leviathan.glb");
  worm.position.set(760, sandHeight(760, -680), -680);
  return worm;
}

export function updateWorm(worm: THREE.Group, elapsed: number) {
  worm.position.x = 760 + Math.sin(elapsed * 0.16) * 92;
  worm.position.z = -680 + Math.cos(elapsed * 0.12) * 68;
  worm.rotation.y = Math.sin(elapsed * 0.18) * 0.3;
  worm.position.y =
    sandHeight(worm.position.x, worm.position.z) + Math.sin(elapsed * 1.4) * 3 - 2;
}
