import * as THREE from "three";
import { palette } from "../core/palette";
import { mat, box } from "../core/materials";
import { hunyuanSlot } from "../core/models";
import { surfaceHeight } from "./sand";
import { createVoxelAsset } from "../voxel-assets";

// 可劈碎的货箱：攻击系统的打击目标，劈碎掉战利品
export type BreakableCrate = THREE.Mesh & { userData: { crateId?: string } };
export const breakableCrates: BreakableCrate[] = [];

function addBreakableCrate(group: THREE.Group, crate: THREE.Mesh, crateId: string) {
  const breakable = crate as BreakableCrate;
  breakable.userData.crateId = crateId;
  breakableCrates.push(breakable);
  group.add(breakable);
}

// 沙海礁岩：船的碰撞障碍（x/z/半径），visual 由 createSeaScatter 生成
export const SEA_OBSTACLES: ReadonlyArray<{ x: number; z: number; r: number; model: string; fp: number; rot: number }> = [
  { x: -150, z: 300, r: 30, model: "rock_a", fp: 55, rot: 0.4 },
  { x: 200, z: -250, r: 33, model: "rock_b", fp: 60, rot: 1.7 },
  { x: -900, z: 200, r: 26, model: "rock_c", fp: 48, rot: 2.8 },
  { x: -250, z: 900, r: 28, model: "rock_a", fp: 50, rot: 3.9 },
  { x: 800, z: 800, r: 34, model: "rock_b", fp: 62, rot: 0.9 },
  { x: 1100, z: 100, r: 29, model: "rock_c", fp: 52, rot: 5.1 },
  { x: -1100, z: -700, r: 32, model: "rock_a", fp: 58, rot: 2.2 },
  { x: 100, z: -900, r: 30, model: "rock_b", fp: 55, rot: 4.4 },
  { x: -700, z: -900, r: 25, model: "rock_c", fp: 45, rot: 1.1 },
  { x: 500, z: -300, r: 22, model: "rock_a", fp: 40, rot: 3.3 },
];

// 环境素材占位：素色方块盒，混元模型加载后按脚印换入
function envSlot(url: string, footprint: number, height = footprint) {
  const placeholder = box(
    footprint,
    height,
    footprint,
    mat("env-placeholder", "#c9a25e"),
    [0, height / 2, 0],
  );
  return hunyuanSlot(placeholder, url, 0, { liteOnTouch: true });
}

function placeEnv(
  group: THREE.Group,
  url: string,
  footprint: number,
  x: number,
  z: number,
  rotY = 0,
  height = footprint,
) {
  const slot = envSlot(url, footprint, height);
  slot.position.set(x, 0, z);
  slot.rotation.y = rotY;
  group.add(slot);
  return slot;
}

// 只按顶层子节点贴地，避免拆散体素资产的内部结构。
// 必须用 surfaceHeight（渲染网格的实际表面），用平滑公式会差出半个台阶=穿模
function groundChildren(group: THREE.Group) {
  group.children.forEach((child) => {
    child.position.y += surfaceHeight(
      group.position.x + child.position.x,
      group.position.z + child.position.z,
    );
  });
}

export function createPalm(position: THREE.Vector3, scale = 1) {
  // palm.glb 是瘦高型：脚印缩放会放大高度，占位取 7 让树冠回到玩家 2-3 倍身高
  const placeholder = createVoxelAsset("A04");
  placeholder.scale.setScalar(7 * scale);
  const palm = hunyuanSlot(placeholder, "/models/palm.glb", 0, { liteOnTouch: true });
  palm.position.copy(position);
  palm.rotation.y = Math.random() * Math.PI * 2;
  return palm;
}

export function createOasisPort() {
  const group = new THREE.Group();
  group.position.set(-520, 0, -380);

  const water = new THREE.Mesh(
    new THREE.BoxGeometry(168, 3, 132),
    new THREE.MeshBasicMaterial({
      color: palette.oasis,
      transparent: true,
      opacity: 0.72,
    }),
  );
  water.position.y = 1.4;
  group.add(water);

  const dockMat = mat("dock", "#5f3724");
  group.add(box(190, 9, 24, dockMat, [18, 12, 108], [0, -0.16, 0]));
  group.add(box(90, 8, 26, dockMat, [-88, 13, 54], [0, 0.72, 0]));

  const tentPlaceholder = createVoxelAsset("A03");
  tentPlaceholder.scale.setScalar(11);
  const tent = hunyuanSlot(tentPlaceholder, "/models/tent.glb", 0, { liteOnTouch: true });
  tent.position.set(-124, 0, -28);
  tent.rotation.y = Math.PI / 5;
  group.add(tent);

  const heroPlaceholder = createVoxelAsset("A02");
  heroPlaceholder.scale.setScalar(4.5);
  const hero = hunyuanSlot(heroPlaceholder, "/models/hero.glb", 0, { liteOnTouch: true });
  hero.position.set(-28, 0, 74);
  hero.rotation.y = Math.PI * 0.85;
  group.add(hero);

  const cannonPlaceholder = createVoxelAsset("A09");
  cannonPlaceholder.scale.setScalar(5);
  const cannon = hunyuanSlot(cannonPlaceholder, "/models/cannon.glb", 0, { liteOnTouch: true });
  cannon.position.set(38, 0, 62);
  cannon.rotation.y = -Math.PI / 3;
  group.add(cannon);

  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2;
    const radius = 108 + Math.sin(i) * 22;
    group.add(
      createPalm(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius), 0.8 + Math.random() * 0.34),
    );
  }

  for (let i = 0; i < 8; i += 1) {
    const crate = box(14, 12, 14, mat("crate", "#8a5a35"), [-82 + i * 22, 17, 92 + (i % 2) * 20]);
    addBreakableCrate(group, crate, `oasis-${i}`);
  }

  // E 系列环境素材：民居/水井/货摊/瞭望塔/栈桥，把港口做出小镇密度
  placeEnv(group, "/models/house_a.glb", 60, -38, -150, 0.4);
  placeEnv(group, "/models/house_b.glb", 55, 72, -128, -0.6);
  placeEnv(group, "/models/house_c.glb", 55, -205, 30, 1.2);
  placeEnv(group, "/models/well.glb", 26, 95, -30, 0);
  placeEnv(group, "/models/stall_a.glb", 34, -92, 8, 0.9);
  placeEnv(group, "/models/stall_b.glb", 34, -155, 52, 0.3);
  placeEnv(group, "/models/tower.glb", 34, 150, -150, 0, 90);
  placeEnv(group, "/models/jetty.glb", 52, 30, 215, 0, 14);

  groundChildren(group);

  return group;
}

export function createRuins() {
  const group = new THREE.Group();
  group.position.set(650, 0, 280);

  const gatePlaceholder = createVoxelAsset("A05");
  gatePlaceholder.scale.setScalar(18);
  const gate = hunyuanSlot(gatePlaceholder, "/models/gate.glb", 0, { liteOnTouch: true });
  gate.position.set(0, 0, -30);
  group.add(gate);

  const obeliskSpots: Array<[number, number, number, number]> = [
    [-150, 90, 13, 0.6],
    [150, 60, 10, 2.1],
    [60, -160, 15, 3.6],
  ];
  obeliskSpots.forEach(([x, z, scale, rotY]) => {
    const placeholder = createVoxelAsset("A06");
    placeholder.scale.setScalar(scale);
    const obelisk = hunyuanSlot(placeholder, "/models/obelisk.glb", 0, { liteOnTouch: true });
    obelisk.position.set(x, 0, z);
    obelisk.rotation.y = rotY;
    group.add(obelisk);
  });

  const chestPlaceholder = createVoxelAsset("A08");
  chestPlaceholder.scale.setScalar(7);
  const chest = hunyuanSlot(chestPlaceholder, "/models/chest.glb", 0, { liteOnTouch: true });
  chest.position.set(52, 0, 34);
  chest.rotation.y = -0.5;
  group.add(chest);

  const light = new THREE.PointLight("#69f1df", 2.8, 360);
  light.position.set(0, 78, 24);
  group.add(light);

  groundChildren(group);

  return group;
}

export function createSaltFlats() {
  const group = new THREE.Group();
  const saltMat = mat("salt-flat", palette.salt);
  for (let i = 0; i < 9; i += 1) {
    const x = 180 + THREE.MathUtils.randFloatSpread(350);
    const z = 680 + THREE.MathUtils.randFloatSpread(240);
    if (i % 3 === 0) {
      // 每三块换一簇混元盐晶，占位仍是原方块盐板
      const placeholder = new THREE.Mesh(new THREE.BoxGeometry(64, 8, 52), saltMat);
      placeholder.position.y = 4;
      const cluster = hunyuanSlot(placeholder, i % 2 === 0 ? "/models/salt_a.glb" : "/models/salt_b.glb", 0, {
        liteOnTouch: true,
      });
      cluster.position.set(x, surfaceHeight(x, z), z);
      cluster.rotation.y = (Math.floor(Math.random() * 4) * Math.PI) / 4;
      group.add(cluster);
    } else {
      const shard = new THREE.Mesh(new THREE.BoxGeometry(64, 8, 52), saltMat);
      shard.position.set(x, surfaceHeight(x, z) + 1, z);
      shard.rotation.y = (Math.floor(Math.random() * 4) * Math.PI) / 4;
      group.add(shard);
    }
  }
  return group;
}

// Duneskull 前哨：最危险的远港——巨兽遗骨拱门当门面，干燥无水，账篷集市贴着骨架扎营
export function createDuneskullCamp() {
  const group = new THREE.Group();
  group.position.set(1150, 0, -1150);

  // 门面：D01 巨兽颅骨拱门替换旧肋骨拱，双眼窝朝南迎客。
  placeEnv(group, "/models/skull_gate.glb?v=d01-v1", 72, 6, -92, 0.35, 50);

  const tentPlaceholder = createVoxelAsset("A03");
  tentPlaceholder.scale.setScalar(10);
  const tent = hunyuanSlot(tentPlaceholder, "/models/tent.glb", 0, { liteOnTouch: true });
  tent.position.set(0, 0, -4);
  tent.rotation.y = -Math.PI / 6;
  group.add(tent);

  placeEnv(group, "/models/stall_b.glb", 32, 40, 24, 0.8);
  placeEnv(group, "/models/tower.glb", 30, -66, -34, 0.4, 82);
  placeEnv(group, "/models/deadwood.glb", 28, 72, -58, 1.9, 38);
  placeEnv(group, "/models/deadwood.glb", 24, -88, 38, 4.4, 34);
  placeEnv(group, "/models/rock_c.glb", 42, 92, 66, 2.6, 34);
  placeEnv(group, "/models/jetty.glb", 50, 0, 205, 0, 14);

  for (let i = 0; i < 4; i += 1) {
    const crate = box(13, 11, 13, mat("crate", "#8a5a35"), [-38 + i * 20, 16, 52]);
    addBreakableCrate(group, crate, `duneskull-${i}`);
  }

  groundChildren(group);
  return group;
}

// 沙海散布：礁岩(带船碰撞)/枯木/巨兽遗骨
export function createSeaScatter() {
  const group = new THREE.Group();

  for (const rock of SEA_OBSTACLES) {
    const slot = envSlot(`/models/${rock.model}.glb`, rock.fp, rock.fp * 0.8);
    slot.position.set(rock.x, surfaceHeight(rock.x, rock.z) - 2, rock.z);
    slot.rotation.y = rock.rot;
    group.add(slot);
  }

  const deadwoodSpots: Array<[number, number, number]> = [
    [-300, -700, 0.8],
    [900, 400, 2.3],
    [-800, 600, 4.1],
    [300, 300, 5.6],
  ];
  deadwoodSpots.forEach(([x, z, rot]) => {
    const slot = envSlot("/models/deadwood.glb", 30, 40);
    slot.position.set(x, surfaceHeight(x, z) - 1, z);
    slot.rotation.y = rot;
    group.add(slot);
  });

  // 巨兽遗骨落在沙虫领地边缘：无声的警告牌
  const ribSpots: Array<[number, number, number, number]> = [
    [560, -540, 0.7, 80],
    [930, -830, 2.4, 70],
  ];
  ribSpots.forEach(([x, z, rot, fp]) => {
    const slot = envSlot("/models/ribs.glb", fp, fp * 0.5);
    slot.position.set(x, surfaceHeight(x, z) - 1.5, z);
    slot.rotation.y = rot;
    group.add(slot);
  });

  return group;
}

// Saltcrest 盐滩镇（第二港口的先行营地，正式交易点随经济系统上线）
export function createSaltcrestCamp() {
  const group = new THREE.Group();
  group.position.set(340, 0, 700);

  const tentPlaceholder = createVoxelAsset("A03");
  tentPlaceholder.scale.setScalar(10);
  const tent = hunyuanSlot(tentPlaceholder, "/models/tent.glb", 0, { liteOnTouch: true });
  tent.position.set(-40, 0, -30);
  tent.rotation.y = -Math.PI / 6;
  group.add(tent);

  const heroPlaceholder = createVoxelAsset("A02");
  heroPlaceholder.scale.setScalar(4.5);
  const keeper = hunyuanSlot(heroPlaceholder, "/models/hero.glb", 0, { liteOnTouch: true });
  keeper.position.set(-8, 0, 12);
  keeper.rotation.y = Math.PI * 0.3;
  group.add(keeper);

  for (let i = 0; i < 4; i += 1) {
    const angle = 0.8 + (i / 4) * Math.PI * 1.4;
    group.add(
      createPalm(
        new THREE.Vector3(Math.cos(angle) * 92, 0, Math.sin(angle) * 92),
        0.75 + (i % 2) * 0.3,
      ),
    );
  }

  for (let i = 0; i < 5; i += 1) {
    const crate = box(13, 11, 13, mat("crate", "#8a5a35"), [42 + (i % 3) * 20, 16, 48 + Math.floor(i / 3) * 22]);
    addBreakableCrate(group, crate, `saltcrest-${i}`);
  }

  placeEnv(group, "/models/house_b.glb", 52, 75, -62, 2.2);
  placeEnv(group, "/models/stall_a.glb", 32, 36, -18, -0.5);
  placeEnv(group, "/models/tower.glb", 30, -92, 58, 0.6, 82);
  placeEnv(group, "/models/jetty.glb", 50, 0, 172, 0, 14);

  groundChildren(group);

  return group;
}

export function createDistantCaravans() {
  const group = new THREE.Group();

  for (let i = 0; i < 7; i += 1) {
    const placeholder = createVoxelAsset("A10");
    placeholder.scale.setScalar(8);
    const caravan = hunyuanSlot(placeholder, "/models/cart.glb", 0, { liteOnTouch: true });
    const x = -780 + i * 108;
    const z = 560 + Math.sin(i) * 34;
    caravan.position.set(x, surfaceHeight(x, z), z);
    caravan.rotation.y = -0.58;
    group.add(caravan);
  }

  return group;
}
