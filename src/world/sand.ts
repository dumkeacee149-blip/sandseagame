import * as THREE from "three";
import { palette } from "../core/palette";

// 全项目唯一的地形高度真理源——禁止在别处出现第二份高度公式
export function sandHeight(x: number, z: number, time = 0) {
  const sweep = time * 0.035;
  const broad =
    Math.sin(x * 0.006 + z * 0.002 + sweep) * 16 +
    Math.cos(z * 0.007 - x * 0.002 - sweep * 0.8) * 13;
  const ripple =
    Math.sin((x + z) * 0.035 + time * 0.22) * 2.8 +
    Math.cos((x - z) * 0.026 - time * 0.16) * 2.2;
  const basin = Math.sin(Math.hypot(x + 180, z - 210) * 0.005) * 7;
  return broad + ripple + basin;
}

const TERRAIN_SIZE = 3600;
const TERRAIN_CELL = 24;
const TERRAIN_STEP = 8;

function quantizedHeight(ix: number, iz: number) {
  const half = TERRAIN_SIZE / 2;
  const x = -half + (ix + 0.5) * TERRAIN_CELL;
  const z = -half + (iz + 0.5) * TERRAIN_CELL;
  return Math.round(sandHeight(x, z) / TERRAIN_STEP) * TERRAIN_STEP;
}

// Minecraft 式阶梯方块沙丘：每格一个平顶 + 相邻落差处的垂直壁面
export function createTerrain() {
  const half = TERRAIN_SIZE / 2;
  const cells = TERRAIN_SIZE / TERRAIN_CELL;
  const positions: number[] = [];
  const colors: number[] = [];
  const topColor = new THREE.Color();
  const wallColor = new THREE.Color();

  type P = [number, number, number];
  const pushQuad = (a: P, b: P, c: P, d: P, color: THREE.Color) => {
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < 6; i += 1) colors.push(color.r, color.g, color.b);
  };

  const cellColor = (ix: number, iz: number, h: number, target: THREE.Color) => {
    const x = -half + (ix + 0.5) * TERRAIN_CELL;
    const z = -half + (iz + 0.5) * TERRAIN_CELL;
    const dune = THREE.MathUtils.clamp((h + 32) / 76, 0, 1);
    target.copy(palette.sandLow).lerp(palette.sandHigh, dune);
    if ((x + z) % 560 > 440) target.lerp(palette.salt, 0.28);
    return target;
  };

  for (let ix = 0; ix < cells; ix += 1) {
    for (let iz = 0; iz < cells; iz += 1) {
      const h = quantizedHeight(ix, iz);
      const x0 = -half + ix * TERRAIN_CELL;
      const x1 = x0 + TERRAIN_CELL;
      const z0 = -half + iz * TERRAIN_CELL;
      const z1 = z0 + TERRAIN_CELL;

      cellColor(ix, iz, h, topColor);
      pushQuad([x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0], topColor);
      wallColor.copy(topColor).multiplyScalar(0.6);

      if (ix + 1 < cells) {
        const hn = quantizedHeight(ix + 1, iz);
        if (hn !== h) {
          const lo = Math.min(h, hn);
          const hi = Math.max(h, hn);
          if (h > hn) {
            pushQuad([x1, hi, z0], [x1, hi, z1], [x1, lo, z1], [x1, lo, z0], wallColor);
          } else {
            pushQuad([x1, hi, z1], [x1, hi, z0], [x1, lo, z0], [x1, lo, z1], wallColor);
          }
        }
      }
      if (iz + 1 < cells) {
        const hn = quantizedHeight(ix, iz + 1);
        if (hn !== h) {
          const lo = Math.min(h, hn);
          const hi = Math.max(h, hn);
          if (h > hn) {
            pushQuad([x1, hi, z1], [x0, hi, z1], [x0, lo, z1], [x1, lo, z1], wallColor);
          } else {
            pushQuad([x0, hi, z1], [x1, hi, z1], [x1, lo, z1], [x0, lo, z1], wallColor);
          }
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const terrain = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
    }),
  );

  return { terrain };
}
