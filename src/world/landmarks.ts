import * as THREE from "three";
import { palette } from "../core/palette";
import { mat, box } from "../core/materials";
import { hunyuanSlot } from "../core/models";
import { sandHeight, worldHeight } from "./sand";
import { createVoxelAsset } from "../voxel-assets";

// 可劈碎的货箱：攻击系统的打击目标，劈碎掉战利品
export const breakableCrates: THREE.Mesh[] = [];

// 只按顶层子节点贴地，避免拆散体素资产的内部结构
function groundChildren(group: THREE.Group) {
  group.children.forEach((child) => {
    child.position.y += worldHeight(
      group.position.x + child.position.x,
      group.position.z + child.position.z,
    );
  });
}

export function createPalm(position: THREE.Vector3, scale = 1) {
  const placeholder = createVoxelAsset("A04");
  placeholder.scale.setScalar(11 * scale);
  const palm = hunyuanSlot(placeholder, "/models/palm.glb");
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
  const tent = hunyuanSlot(tentPlaceholder, "/models/tent.glb");
  tent.position.set(-124, 0, -28);
  tent.rotation.y = Math.PI / 5;
  group.add(tent);

  const heroPlaceholder = createVoxelAsset("A02");
  heroPlaceholder.scale.setScalar(4.5);
  const hero = hunyuanSlot(heroPlaceholder, "/models/hero.glb");
  hero.position.set(-28, 0, 74);
  hero.rotation.y = Math.PI * 0.85;
  group.add(hero);

  const cannonPlaceholder = createVoxelAsset("A09");
  cannonPlaceholder.scale.setScalar(5);
  const cannon = hunyuanSlot(cannonPlaceholder, "/models/cannon.glb");
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
    breakableCrates.push(crate);
    group.add(crate);
  }

  groundChildren(group);

  return group;
}

export function createRuins() {
  const group = new THREE.Group();
  group.position.set(650, 0, 280);

  const gatePlaceholder = createVoxelAsset("A05");
  gatePlaceholder.scale.setScalar(18);
  const gate = hunyuanSlot(gatePlaceholder, "/models/gate.glb");
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
    const obelisk = hunyuanSlot(placeholder, "/models/obelisk.glb");
    obelisk.position.set(x, 0, z);
    obelisk.rotation.y = rotY;
    group.add(obelisk);
  });

  const chestPlaceholder = createVoxelAsset("A08");
  chestPlaceholder.scale.setScalar(7);
  const chest = hunyuanSlot(chestPlaceholder, "/models/chest.glb");
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
    const shard = new THREE.Mesh(new THREE.BoxGeometry(64, 8, 52), saltMat);
    const x = 180 + THREE.MathUtils.randFloatSpread(350);
    const z = 680 + THREE.MathUtils.randFloatSpread(240);
    shard.position.set(x, worldHeight(x, z) + 1, z);
    shard.rotation.y = (Math.floor(Math.random() * 4) * Math.PI) / 4;
    group.add(shard);
  }
  return group;
}

// Saltcrest 盐滩镇（第二港口的先行营地，正式交易点随经济系统上线）
export function createSaltcrestCamp() {
  const group = new THREE.Group();
  group.position.set(340, 0, 700);

  const tentPlaceholder = createVoxelAsset("A03");
  tentPlaceholder.scale.setScalar(10);
  const tent = hunyuanSlot(tentPlaceholder, "/models/tent.glb");
  tent.position.set(-40, 0, -30);
  tent.rotation.y = -Math.PI / 6;
  group.add(tent);

  const heroPlaceholder = createVoxelAsset("A02");
  heroPlaceholder.scale.setScalar(4.5);
  const keeper = hunyuanSlot(heroPlaceholder, "/models/hero.glb");
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
    breakableCrates.push(crate);
    group.add(crate);
  }

  groundChildren(group);

  return group;
}

export function createDistantCaravans() {
  const group = new THREE.Group();

  for (let i = 0; i < 7; i += 1) {
    const placeholder = createVoxelAsset("A10");
    placeholder.scale.setScalar(8);
    const caravan = hunyuanSlot(placeholder, "/models/cart.glb");
    const x = -780 + i * 108;
    const z = 560 + Math.sin(i) * 34;
    caravan.position.set(x, sandHeight(x, z), z);
    caravan.rotation.y = -0.58;
    group.add(caravan);
  }

  return group;
}
