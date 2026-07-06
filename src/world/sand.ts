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

// 群洲：绿洲=凸起的方块台地岛，沙海=平滑起伏的可航行沙面（参照 ARRR 的海洋群岛结构）
export type IslandDef = {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly plateauRadius: number;
  readonly falloff: number;
  readonly height: number;
};

export const ISLANDS: readonly IslandDef[] = [
  { id: "oasis", x: -520, z: -380, plateauRadius: 210, falloff: 130, height: 26 },
  { id: "saltcrest", x: 340, z: 700, plateauRadius: 170, falloff: 110, height: 22 },
  { id: "ruins", x: 650, z: 280, plateauRadius: 160, falloff: 100, height: 12 },
  { id: "duneskull", x: 1150, z: -1150, plateauRadius: 170, falloff: 110, height: 24 },
] as const;

// 岛屿抬升量：台地内全高，坡带 smoothstep 过渡到沙海
export function islandLift(x: number, z: number) {
  let lift = 0;
  for (const isle of ISLANDS) {
    const d = Math.hypot(x - isle.x, z - isle.z);
    if (d >= isle.plateauRadius + isle.falloff) continue;
    const t = d <= isle.plateauRadius ? 1 : 1 - (d - isle.plateauRadius) / isle.falloff;
    const smooth = t * t * (3 - 2 * t);
    lift = Math.max(lift, isle.height * smooth);
  }
  return lift;
}

// 平滑地表高度 = 沙海起伏 + 岛屿抬升
export function worldHeight(x: number, z: number) {
  return sandHeight(x, z) + islandLift(x, z);
}

const TERRAIN_SIZE = 3600;
const TERRAIN_CELL = 24;
const TERRAIN_STEP = 8;
const ISLAND_LIFT_THRESHOLD = 2; // 抬升超过此值的格子走方块阶梯，其余平滑

function cellIndex(v: number) {
  return Math.floor((v + TERRAIN_SIZE / 2) / TERRAIN_CELL);
}

function cellCenter(i: number) {
  return -TERRAIN_SIZE / 2 + (i + 0.5) * TERRAIN_CELL;
}

function quantizedHeight(ix: number, iz: number) {
  return Math.round(worldHeight(cellCenter(ix), cellCenter(iz)) / TERRAIN_STEP) * TERRAIN_STEP;
}

function isIslandCell(ix: number, iz: number) {
  return islandLift(cellCenter(ix), cellCenter(iz)) > ISLAND_LIFT_THRESHOLD;
}

// 实际渲染网格的表面高度：岛上=量化台阶（整格平顶），沙海=按网格三角面片
// 精确插值（解析公式与三角面在格子中部差 1-2 单位，会造成悬空/陷入）。
// 所有贴地（道具/行走/船）必须用它，和渲染网格逐点一致。
export function surfaceHeight(x: number, z: number) {
  const ix = cellIndex(x);
  const iz = cellIndex(z);
  if (isIslandCell(ix, iz)) return quantizedHeight(ix, iz);

  const x0 = -TERRAIN_SIZE / 2 + ix * TERRAIN_CELL;
  const z0 = -TERRAIN_SIZE / 2 + iz * TERRAIN_CELL;
  const u = (x - x0) / TERRAIN_CELL;
  const v = (z - z0) / TERRAIN_CELL;
  const h00 = worldHeight(x0, z0);
  const h01 = worldHeight(x0, z0 + TERRAIN_CELL);
  const h11 = worldHeight(x0 + TERRAIN_CELL, z0 + TERRAIN_CELL);
  const h10 = worldHeight(x0 + TERRAIN_CELL, z0);
  // 与建网格相同的三角剖分：对角线 (0,0)-(1,1)
  if (v >= u) return h00 + (h01 - h00) * v + (h11 - h01) * u;
  return h00 + (h10 - h00) * u + (h11 - h10) * v;
}

// 混合地形网格：平滑贴图沙海 + Minecraft 式阶梯台地岛（平顶+垂直壁面）
export function createTerrain() {
  const cells = TERRAIN_SIZE / TERRAIN_CELL;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const topColor = new THREE.Color();
  const wallColor = new THREE.Color();
  const UV_SCALE = 150; // 贴图每 150 世界单位平铺一次

  type P = [number, number, number];
  const pushQuad = (a: P, b: P, c: P, d: P, color: THREE.Color) => {
    for (const p of [a, b, c, a, c, d]) {
      positions.push(...p);
      colors.push(color.r, color.g, color.b);
      uvs.push(p[0] / UV_SCALE, p[2] / UV_SCALE);
    }
  };

  const rockColor = new THREE.Color("#9a835a");
  const cellColor = (ix: number, iz: number, h: number, target: THREE.Color) => {
    const x = cellCenter(ix);
    const z = cellCenter(iz);
    const dune = THREE.MathUtils.clamp((h + 32) / 76, 0, 1);
    target.copy(palette.sandLow).lerp(palette.sandHigh, dune);
    if ((x + z) % 560 > 440) target.lerp(palette.salt, 0.28);
    const lift = islandLift(x, z);
    if (lift > ISLAND_LIFT_THRESHOLD) {
      target.lerp(rockColor, THREE.MathUtils.clamp(lift / 26, 0, 1) * 0.4);
    }
    // 顶点色要与贴图相乘：整体提亮避免画面发闷
    target.lerp(new THREE.Color("#ffffff"), 0.42);
    return target;
  };

  for (let ix = 0; ix < cells; ix += 1) {
    for (let iz = 0; iz < cells; iz += 1) {
      const x0 = -TERRAIN_SIZE / 2 + ix * TERRAIN_CELL;
      const x1 = x0 + TERRAIN_CELL;
      const z0 = -TERRAIN_SIZE / 2 + iz * TERRAIN_CELL;
      const z1 = z0 + TERRAIN_CELL;
      const island = isIslandCell(ix, iz);

      if (island) {
        const h = quantizedHeight(ix, iz);
        cellColor(ix, iz, h, topColor);
        pushQuad([x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0], topColor);
        wallColor.copy(topColor).multiplyScalar(0.74);

        // +x 方向壁面
        if (ix + 1 < cells) {
          if (isIslandCell(ix + 1, iz)) {
            const hn = quantizedHeight(ix + 1, iz);
            if (hn !== h) {
              const lo = Math.min(h, hn);
              const hi = Math.max(h, hn);
              if (h > hn) pushQuad([x1, hi, z0], [x1, hi, z1], [x1, lo, z1], [x1, lo, z0], wallColor);
              else pushQuad([x1, hi, z1], [x1, hi, z0], [x1, lo, z0], [x1, lo, z1], wallColor);
            }
          } else {
            const s0 = worldHeight(x1, z0);
            const s1 = worldHeight(x1, z1);
            if (h > Math.min(s0, s1)) {
              pushQuad([x1, h, z0], [x1, h, z1], [x1, s1, z1], [x1, s0, z0], wallColor);
            }
          }
        }
        // +z 方向壁面
        if (iz + 1 < cells) {
          if (isIslandCell(ix, iz + 1)) {
            const hn = quantizedHeight(ix, iz + 1);
            if (hn !== h) {
              const lo = Math.min(h, hn);
              const hi = Math.max(h, hn);
              if (h > hn) pushQuad([x1, hi, z1], [x0, hi, z1], [x0, lo, z1], [x1, lo, z1], wallColor);
              else pushQuad([x0, hi, z1], [x1, hi, z1], [x1, lo, z1], [x0, lo, z1], wallColor);
            }
          } else {
            const s0 = worldHeight(x0, z1);
            const s1 = worldHeight(x1, z1);
            if (h > Math.min(s0, s1)) {
              pushQuad([x1, h, z1], [x0, h, z1], [x0, s0, z1], [x1, s1, z1], wallColor);
            }
          }
        }
      } else {
        // 平滑沙海格：四角取平滑高度，相邻格共享角点高度=连续无缝
        const h00 = worldHeight(x0, z0);
        const h01 = worldHeight(x0, z1);
        const h11 = worldHeight(x1, z1);
        const h10 = worldHeight(x1, z0);
        cellColor(ix, iz, (h00 + h11) / 2, topColor);
        pushQuad([x0, h00, z0], [x0, h01, z1], [x1, h11, z1], [x1, h10, z0], topColor);

        // 沙海格紧挨岛格时，从岛壁底部兜住缝隙（岛侧已出壁面，这里补朝向岛的反面）
        if (ix + 1 < cells && isIslandCell(ix + 1, iz)) {
          const hn = quantizedHeight(ix + 1, iz);
          if (hn > Math.min(h10, h11)) {
            wallColor.copy(topColor).multiplyScalar(0.74);
            pushQuad([x1, hn, z1], [x1, hn, z0], [x1, h10, z0], [x1, h11, z1], wallColor);
          }
        }
        if (iz + 1 < cells && isIslandCell(ix, iz + 1)) {
          const hn = quantizedHeight(ix, iz + 1);
          if (hn > Math.min(h01, h11)) {
            wallColor.copy(topColor).multiplyScalar(0.74);
            pushQuad([x0, hn, z1], [x1, hn, z1], [x1, h11, z1], [x0, h01, z1], wallColor);
          }
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();

  // 沙面纹理：Poly Haven aerial_beach_01（CC0），与顶点色相乘
  const sandTexture = new THREE.TextureLoader().load("/textures/sand_diff_1k.jpg");
  sandTexture.wrapS = THREE.RepeatWrapping;
  sandTexture.wrapT = THREE.RepeatWrapping;
  sandTexture.colorSpace = THREE.SRGBColorSpace;

  const terrain = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
      map: sandTexture,
    }),
  );

  return { terrain };
}
