import * as THREE from "three";

export type VoxelAssetId =
  | "A01"
  | "A02"
  | "A03"
  | "A04"
  | "A05"
  | "A06"
  | "A07"
  | "A08"
  | "A09"
  | "A10"
  | "H01";

export type VoxelAssetDefinition = {
  id: VoxelAssetId;
  name: string;
  zhName: string;
  role: string;
  create: () => THREE.Group;
};

type Vec3 = [number, number, number];

const palette = {
  outline: "#211716",
  sand: "#d9a65d",
  sandLight: "#efd08c",
  salt: "#e7debd",
  wood: "#724728",
  darkWood: "#3c2519",
  brass: "#c89335",
  iron: "#232631",
  cloth: "#ab3430",
  clothDark: "#76262d",
  indigo: "#33465d",
  teal: "#4fe0cf",
  tealDark: "#188f8b",
  stone: "#9d9277",
  stoneLight: "#c2b593",
  basalt: "#24232b",
  palm: "#2d8b65",
  palmDark: "#1d5f4b",
  leather: "#8a5431",
  skin: "#c58b5a",
  bone: "#d8c9a3",
  shell: "#873735",
  shellDark: "#592529",
  shadow: "#5b3b2b",
} as const;

type PaletteKey = keyof typeof palette;

const materialCache = new Map<string, THREE.Material>();
const outlineMaterial = new THREE.LineBasicMaterial({
  color: palette.outline,
  transparent: true,
  opacity: 0.34,
});

function lambert(key: PaletteKey, options: Partial<THREE.MeshLambertMaterialParameters> = {}) {
  const cacheKey = `lambert:${key}:${options.emissive ? "emissive" : "flat"}`;
  const cached = materialCache.get(cacheKey);
  if (cached) return cached;

  const material = new THREE.MeshLambertMaterial({
    color: palette[key],
    flatShading: true,
    ...options,
  });
  materialCache.set(cacheKey, material);
  return material;
}

function basic(key: PaletteKey, options: Partial<THREE.MeshBasicMaterialParameters> = {}) {
  const cacheKey = `basic:${key}:${options.transparent ? "alpha" : "solid"}`;
  const cached = materialCache.get(cacheKey);
  if (cached) return cached;

  const material = new THREE.MeshBasicMaterial({
    color: palette[key],
    ...options,
  });
  materialCache.set(cacheKey, material);
  return material;
}

function addOutline(mesh: THREE.Mesh) {
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), outlineMaterial);
  edges.name = `${mesh.name}-edge`;
  mesh.add(edges);
}

function addBox(
  group: THREE.Group,
  name: string,
  size: Vec3,
  position: Vec3,
  materialKey: PaletteKey,
  rotation: Vec3 = [0, 0, 0],
  material: THREE.Material = lambert(materialKey),
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  addOutline(mesh);
  group.add(mesh);
  return mesh;
}

function addGlowBox(
  group: THREE.Group,
  name: string,
  size: Vec3,
  position: Vec3,
  rotation: Vec3 = [0, 0, 0],
) {
  return addBox(group, name, size, position, "teal", rotation, basic("teal"));
}

function addSteppedSail(
  group: THREE.Group,
  name: string,
  rowWidths: number[],
  origin: Vec3,
  rowHeight: number,
  thickness: number,
  rotation: Vec3 = [0, 0, 0],
) {
  const widest = rowWidths[0] ?? 1;
  rowWidths.forEach((width, index) => {
    const xOffset = (widest - width) * 0.34;
    const y = origin[1] + index * rowHeight;
    addBox(
      group,
      `${name}-row-${index + 1}`,
      [width, rowHeight * 0.92, thickness],
      [origin[0] + xOffset, y, origin[2]],
      index % 3 === 1 ? "clothDark" : "cloth",
      rotation,
    );
  });
}

function finishAsset(id: VoxelAssetId, group: THREE.Group) {
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const wrapper = new THREE.Group();
  wrapper.name = id;
  wrapper.userData.assetId = id;
  group.position.set(-center.x, -box.min.y, -center.z);
  wrapper.add(group);
  return wrapper;
}

function createWindSailSandSkiff() {
  const group = new THREE.Group();
  group.name = "wind-sail-sand-skiff";

  addBox(group, "keel", [2.4, 0.5, 7.8], [0, 0.7, 0], "darkWood");
  addBox(group, "deck", [3.2, 0.45, 6.4], [0, 1.12, -0.1], "wood");
  addBox(group, "left-plank", [0.5, 1.0, 6.6], [-1.85, 1.25, -0.05], "wood");
  addBox(group, "right-plank", [0.5, 1.0, 6.6], [1.85, 1.25, -0.05], "wood");
  addBox(group, "bow-step", [2.4, 0.75, 0.85], [0, 1.35, 3.85], "wood");
  addBox(group, "stern-step", [2.8, 0.72, 0.95], [0, 1.35, -3.85], "darkWood");
  addBox(group, "left-runner", [0.34, 0.32, 8.3], [-2.24, 0.22, 0], "brass");
  addBox(group, "right-runner", [0.34, 0.32, 8.3], [2.24, 0.22, 0], "brass");
  addBox(group, "left-runner-nose", [0.34, 0.36, 0.9], [-2.24, 0.52, 4.35], "brass", [0.35, 0, 0]);
  addBox(group, "right-runner-nose", [0.34, 0.36, 0.9], [2.24, 0.52, 4.35], "brass", [0.35, 0, 0]);
  addBox(group, "mast", [0.34, 4.9, 0.34], [0, 3.65, -0.25], "darkWood");
  addBox(group, "yard", [4.6, 0.24, 0.24], [0.45, 4.15, -0.25], "darkWood", [0, 0, -0.08]);
  addSteppedSail(group, "main-sail", [3.8, 3.4, 2.8, 2.2, 1.5, 0.9], [-1.4, 2.25, -0.35], 0.48, 0.2);
  addSteppedSail(group, "jib-sail", [1.7, 1.35, 0.95, 0.55], [1.3, 2.0, 2.5], 0.38, 0.18, [0, 0.08, -0.08]);
  addGlowBox(group, "engine-core", [0.85, 0.7, 0.85], [0, 1.55, -4.55]);
  addBox(group, "brass-engine-ring", [1.25, 0.32, 1.25], [0, 1.52, -4.62], "brass");
  addBox(group, "cargo-crate", [0.75, 0.62, 0.75], [-0.78, 1.73, -1.65], "darkWood");
  addBox(group, "water-cube", [0.52, 0.52, 0.52], [0.95, 1.72, -1.25], "tealDark");
  addBox(group, "privateer-flag", [0.2, 0.75, 0.08], [0.35, 6.15, -0.36], "clothDark", [0, 0, -0.2]);
  return finishAsset("A01", group);
}

function createDesertPrivateerHero() {
  const group = new THREE.Group();
  group.name = "desert-privateer-hero";

  addBox(group, "left-boot", [0.46, 0.35, 0.5], [-0.32, 0.18, 0], "darkWood");
  addBox(group, "right-boot", [0.46, 0.35, 0.5], [0.32, 0.18, 0], "darkWood");
  addBox(group, "left-leg", [0.42, 0.9, 0.42], [-0.32, 0.78, 0], "leather");
  addBox(group, "right-leg", [0.42, 0.9, 0.42], [0.32, 0.78, 0], "leather");
  addBox(group, "belt", [1.25, 0.24, 0.52], [0, 1.28, -0.02], "brass");
  addBox(group, "torso", [1.16, 1.24, 0.56], [0, 1.86, 0], "leather");
  addBox(group, "vest", [0.98, 0.78, 0.62], [0, 1.97, -0.04], "darkWood");
  addBox(group, "left-arm", [0.32, 1.18, 0.34], [-0.82, 1.8, 0.02], "skin", [0, 0, -0.1]);
  addBox(group, "right-arm", [0.32, 1.18, 0.34], [0.86, 1.78, 0.02], "skin", [0, 0, 0.18]);
  addBox(group, "head", [0.92, 0.92, 0.92], [0, 2.84, 0], "skin");
  addBox(group, "headscarf", [1.04, 0.28, 1.02], [0, 3.34, 0], "cloth");
  addBox(group, "scarf-tail", [0.25, 0.9, 0.22], [-0.58, 2.9, -0.48], "clothDark", [0.28, 0.1, 0.12]);
  addBox(group, "left-goggle", [0.32, 0.2, 0.08], [-0.24, 2.9, -0.48], "teal");
  addBox(group, "right-goggle", [0.32, 0.2, 0.08], [0.24, 2.9, -0.48], "teal");
  addBox(group, "goggle-strap", [1.05, 0.16, 0.08], [0, 2.9, 0.48], "iron");
  addBox(group, "short-cloak", [1.22, 1.35, 0.18], [0, 1.82, 0.46], "indigo", [0.08, 0, 0]);
  addBox(group, "cutlass-grip", [0.18, 0.5, 0.18], [1.08, 1.25, -0.25], "darkWood", [0, 0, -0.55]);
  addBox(group, "cutlass-blade", [0.16, 1.25, 0.12], [1.38, 1.78, -0.28], "brass", [0, 0, -0.55]);
  return finishAsset("A02", group);
}

function createOasisMarketTent() {
  const group = new THREE.Group();
  group.name = "oasis-market-tent";

  addBox(group, "stone-floor", [4.6, 0.35, 3.8], [0, 0.18, 0], "stoneLight");
  addBox(group, "back-wall", [4.2, 1.1, 0.32], [0, 0.9, 1.64], "stone");
  addBox(group, "left-post", [0.26, 2.2, 0.26], [-1.92, 1.28, -1.3], "darkWood");
  addBox(group, "right-post", [0.26, 2.2, 0.26], [1.92, 1.28, -1.3], "darkWood");
  addBox(group, "back-left-post", [0.26, 1.8, 0.26], [-1.92, 1.1, 1.3], "darkWood");
  addBox(group, "back-right-post", [0.26, 1.8, 0.26], [1.92, 1.1, 1.3], "darkWood");
  addBox(group, "canopy-low", [4.6, 0.28, 3.65], [0, 2.35, 0], "cloth");
  addBox(group, "canopy-mid", [3.6, 0.3, 2.75], [0, 2.7, 0.05], "clothDark");
  addBox(group, "canopy-top", [2.25, 0.34, 1.55], [0, 3.08, 0.1], "cloth");
  addBox(group, "front-awning", [4.15, 0.22, 0.65], [0, 2.18, -1.9], "cloth", [-0.2, 0, 0]);
  addBox(group, "left-crate", [0.72, 0.68, 0.72], [-1.2, 0.72, -1.1], "wood");
  addBox(group, "right-crate", [0.86, 0.58, 0.62], [1.18, 0.66, -1.08], "darkWood");
  addGlowBox(group, "teal-lamp", [0.35, 0.42, 0.35], [0.02, 1.14, -1.22]);
  addBox(group, "water-jar", [0.45, 0.65, 0.45], [1.65, 0.78, 0.55], "tealDark");
  addBox(group, "cloth-roll", [1.1, 0.26, 0.46], [-0.3, 0.6, -1.45], "indigo");
  return finishAsset("A03", group);
}

function createOasisPalm() {
  const group = new THREE.Group();
  group.name = "oasis-palm";

  const trunkBlocks: Vec3[] = [
    [0, 0.35, 0],
    [0.1, 0.9, -0.05],
    [0.18, 1.45, -0.08],
    [0.3, 2.0, -0.02],
    [0.42, 2.55, 0.06],
  ];
  trunkBlocks.forEach((position, index) => {
    addBox(group, `trunk-${index + 1}`, [0.62, 0.7, 0.62], position, index % 2 ? "leather" : "wood", [0, 0, index * -0.06]);
  });

  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const x = Math.cos(angle);
    const z = Math.sin(angle);
    addBox(
      group,
      `frond-${i + 1}`,
      [0.5, 0.25, 2.35],
      [0.46 + x * 0.82, 3.08 - (i % 2) * 0.12, z * 0.82],
      i % 2 ? "palmDark" : "palm",
      [0.22, angle, i % 2 ? 0.12 : -0.1],
    );
  }
  addBox(group, "date-cluster", [0.44, 0.38, 0.44], [0.18, 2.68, -0.12], "brass");
  addBox(group, "red-rag", [0.18, 0.52, 0.16], [0.62, 2.1, -0.28], "cloth", [0.2, 0.2, -0.1]);
  return finishAsset("A04", group);
}

function createSunkenRuneGate() {
  const group = new THREE.Group();
  group.name = "sunken-rune-gate";

  addBox(group, "buried-sand", [5.8, 0.45, 2.8], [0, 0.22, 0.28], "sandLight");
  for (let i = 0; i < 4; i += 1) {
    const y = 0.78 + i * 0.72;
    addBox(group, `left-column-${i}`, [0.78, 0.78, 0.88], [-1.92 + (i % 2) * 0.08, y, 0], i % 2 ? "basalt" : "stone", [0, 0.04 * i, 0.04]);
    addBox(group, `right-column-${i}`, [0.78, 0.78, 0.88], [1.92 - (i % 2) * 0.08, y, 0], i % 2 ? "stone" : "basalt", [0, -0.04 * i, -0.04]);
  }
  addBox(group, "lintel-left", [1.55, 0.62, 0.86], [-1.12, 3.65, 0], "basalt", [0, 0, -0.08]);
  addBox(group, "lintel-center", [1.55, 0.62, 0.86], [0, 3.86, 0], "stone", [0, 0, 0.02]);
  addBox(group, "lintel-right", [1.55, 0.62, 0.86], [1.12, 3.65, 0], "basalt", [0, 0, 0.08]);
  addGlowBox(group, "left-rune-1", [0.12, 0.48, 0.08], [-1.92, 2.02, -0.48]);
  addGlowBox(group, "left-rune-2", [0.4, 0.12, 0.08], [-1.92, 2.4, -0.48]);
  addGlowBox(group, "right-rune-1", [0.12, 0.48, 0.08], [1.92, 1.55, -0.48]);
  addGlowBox(group, "right-rune-2", [0.42, 0.12, 0.08], [1.92, 1.95, -0.48]);
  addGlowBox(group, "top-rune", [0.65, 0.14, 0.08], [0, 3.88, -0.48]);
  addBox(group, "broken-stone-a", [0.6, 0.34, 0.5], [-2.55, 0.52, -0.8], "stone");
  addBox(group, "broken-stone-b", [0.46, 0.32, 0.5], [2.52, 0.5, 0.85], "basalt", [0, 0.4, 0]);
  return finishAsset("A05", group);
}

function createRuneObelisk() {
  const group = new THREE.Group();
  group.name = "rune-obelisk";

  addBox(group, "sand-mound", [2.25, 0.45, 2.25], [0, 0.22, 0], "sand");
  addBox(group, "base", [1.35, 0.62, 1.35], [0, 0.78, 0], "stone");
  addBox(group, "lower-shaft", [1.05, 1.2, 1.05], [0, 1.65, 0], "stoneLight", [0, 0.05, 0]);
  addBox(group, "mid-shaft", [0.82, 1.18, 0.82], [0, 2.78, 0], "stone");
  addBox(group, "upper-shaft", [0.58, 0.9, 0.58], [0, 3.8, 0], "basalt", [0, 0.08, 0]);
  addBox(group, "cap", [0.28, 0.55, 0.28], [0, 4.5, 0], "basalt", [0, 0.78, 0]);
  addGlowBox(group, "rune-vertical", [0.12, 0.72, 0.08], [0, 2.72, -0.54]);
  addGlowBox(group, "rune-cross", [0.48, 0.12, 0.08], [0, 3.02, -0.54]);
  addGlowBox(group, "rune-dot", [0.18, 0.18, 0.08], [0, 3.45, -0.45]);
  return finishAsset("A06", group);
}

function createSandseaLeviathan() {
  const group = new THREE.Group();
  group.name = "sandsea-leviathan";

  for (let i = 0; i < 8; i += 1) {
    const y = 0.8 + Math.sin(i * 0.65) * 0.45 + i * 0.08;
    const z = i * -0.86;
    const scale = 1 - i * 0.045;
    addBox(group, `body-${i + 1}`, [1.85 * scale, 1.25 * scale, 1.0], [Math.sin(i * 0.8) * 0.35, y, z], i % 2 ? "shellDark" : "shell", [0.05, i * 0.04, Math.sin(i) * 0.08]);
    addBox(group, `back-plate-${i + 1}`, [1.25 * scale, 0.32, 0.82], [Math.sin(i * 0.8) * 0.35, y + 0.78 * scale, z], "shellDark");
  }
  addBox(group, "head", [2.1, 1.45, 1.25], [0.2, 1.35, 0.85], "shell", [0, -0.18, 0.04]);
  addBox(group, "upper-jaw", [1.4, 0.38, 0.8], [0.18, 1.58, 1.64], "bone", [-0.18, 0, 0]);
  addBox(group, "lower-jaw", [1.28, 0.34, 0.72], [0.18, 0.96, 1.66], "bone", [0.18, 0, 0]);
  addGlowBox(group, "left-eye", [0.2, 0.2, 0.08], [-0.55, 1.58, 1.48]);
  addGlowBox(group, "right-eye", [0.2, 0.2, 0.08], [0.84, 1.58, 1.38]);
  for (let i = 0; i < 10; i += 1) {
    addBox(
      group,
      `sand-burst-${i + 1}`,
      [0.55 + (i % 3) * 0.14, 0.22, 0.5],
      [-2.4 + i * 0.55, 0.12, -2.4 + Math.sin(i) * 0.7],
      i % 2 ? "sand" : "sandLight",
      [0, i * 0.45, 0],
    );
  }
  return finishAsset("A07", group);
}

function createRelicChest() {
  const group = new THREE.Group();
  group.name = "relic-chest";

  addBox(group, "box-base", [1.85, 0.85, 1.1], [0, 0.55, 0], "wood");
  addBox(group, "box-lid", [1.95, 0.48, 1.18], [0, 1.18, 0], "darkWood");
  addBox(group, "front-band", [2.08, 0.18, 0.12], [0, 0.85, -0.62], "brass");
  addBox(group, "left-band", [0.16, 1.25, 1.26], [-0.78, 0.86, 0], "brass");
  addBox(group, "right-band", [0.16, 1.25, 1.26], [0.78, 0.86, 0], "brass");
  addGlowBox(group, "relic-core", [0.42, 0.38, 0.12], [0, 0.86, -0.68]);
  addBox(group, "red-wrap", [2.06, 0.16, 0.16], [0, 1.24, -0.05], "cloth");
  return finishAsset("A08", group);
}

function createSandHarpoonCannon() {
  const group = new THREE.Group();
  group.name = "sand-harpoon-cannon";

  addBox(group, "left-skid", [0.28, 0.24, 2.7], [-0.7, 0.2, 0], "darkWood");
  addBox(group, "right-skid", [0.28, 0.24, 2.7], [0.7, 0.2, 0], "darkWood");
  addBox(group, "rear-brace", [1.65, 0.34, 0.28], [0, 0.58, -0.72], "wood");
  addBox(group, "front-brace", [1.48, 0.34, 0.28], [0, 0.82, 0.76], "wood");
  addBox(group, "pitch-block", [0.85, 0.76, 0.55], [0, 1.08, 0.12], "brass", [-0.25, 0, 0]);
  addBox(group, "barrel", [0.54, 0.54, 2.75], [0, 1.42, 0.72], "iron", [-0.25, 0, 0]);
  addBox(group, "barrel-mouth", [0.78, 0.72, 0.22], [0, 1.75, 2.08], "iron", [-0.25, 0, 0]);
  addBox(group, "harpoon-shaft", [0.16, 0.16, 2.55], [0, 1.78, 2.2], "bone", [-0.25, 0, 0]);
  addBox(group, "harpoon-tip", [0.38, 0.28, 0.38], [0, 2.12, 3.4], "brass", [-0.25, 0, 0]);
  addBox(group, "red-marker", [0.18, 0.58, 0.12], [-0.54, 1.48, 0.2], "cloth", [0, 0, 0.2]);
  return finishAsset("A09", group);
}

function createCaravanSandCart() {
  const group = new THREE.Group();
  group.name = "caravan-sand-cart";

  addBox(group, "left-runner", [0.32, 0.28, 3.65], [-1.0, 0.2, 0], "brass");
  addBox(group, "right-runner", [0.32, 0.28, 3.65], [1.0, 0.2, 0], "brass");
  addBox(group, "cart-bed", [2.3, 0.52, 2.3], [0, 0.66, 0], "wood");
  addBox(group, "left-wall", [0.28, 0.92, 2.25], [-1.18, 1.1, 0], "darkWood");
  addBox(group, "right-wall", [0.28, 0.92, 2.25], [1.18, 1.1, 0], "darkWood");
  addBox(group, "front-wall", [2.2, 0.75, 0.28], [0, 1.02, 1.16], "wood");
  addBox(group, "cargo-1", [0.78, 0.62, 0.72], [-0.45, 1.36, -0.35], "shadow");
  addBox(group, "cargo-2", [0.7, 0.7, 0.62], [0.42, 1.42, -0.28], "stoneLight");
  addBox(group, "water-cask", [0.48, 0.7, 0.48], [0.55, 1.32, 0.55], "tealDark");
  addBox(group, "mast", [0.22, 2.45, 0.22], [-0.18, 2.2, 0.18], "darkWood");
  addSteppedSail(group, "small-sail", [1.45, 1.08, 0.7], [-0.62, 2.28, 0.12], 0.34, 0.16);
  addBox(group, "red-flag", [0.52, 0.32, 0.1], [0.22, 3.55, 0.12], "clothDark");
  return finishAsset("A10", group);
}

function createRiggedHeroFallback() {
  const group = createDesertPrivateerHero();
  group.name = "rigged-privateer-fallback";
  group.userData.assetId = "H01";
  return group;
}

export const ASSET_DEFINITIONS: VoxelAssetDefinition[] = [
  {
    id: "A01",
    name: "Wind-Sail Sand Skiff",
    zhName: "风帆沙舟",
    role: "Main player vehicle",
    create: createWindSailSandSkiff,
  },
  {
    id: "A02",
    name: "Desert Privateer Hero",
    zhName: "沙海私掠者",
    role: "Player avatar baseline",
    create: createDesertPrivateerHero,
  },
  {
    id: "A03",
    name: "Oasis Market Tent",
    zhName: "绿洲集市帐篷",
    role: "Town trading module",
    create: createOasisMarketTent,
  },
  {
    id: "A04",
    name: "Oasis Palm",
    zhName: "绿洲棕榈树",
    role: "Repeatable oasis prop",
    create: createOasisPalm,
  },
  {
    id: "A05",
    name: "Sunken Rune Gate",
    zhName: "沉沙符文门",
    role: "Ancient ruin landmark",
    create: createSunkenRuneGate,
  },
  {
    id: "A06",
    name: "Rune Obelisk",
    zhName: "符文方尖碑",
    role: "Repeatable relic marker",
    create: createRuneObelisk,
  },
  {
    id: "A07",
    name: "Sandsea Leviathan",
    zhName: "沙海巨兽",
    role: "Boss creature silhouette",
    create: createSandseaLeviathan,
  },
  {
    id: "A08",
    name: "Relic Chest",
    zhName: "遗物宝箱",
    role: "Loot reward object",
    create: createRelicChest,
  },
  {
    id: "A09",
    name: "Sand Harpoon Cannon",
    zhName: "沙舟鱼叉炮",
    role: "Ship weapon prop",
    create: createSandHarpoonCannon,
  },
  {
    id: "A10",
    name: "Caravan Sand Cart",
    zhName: "商队沙车",
    role: "Trader transport prop",
    create: createCaravanSandCart,
  },
  {
    id: "H01",
    name: "Rigged Sandsea Privateer",
    zhName: "绑骨沙海私掠者",
    role: "Player avatar rig with gameplay animation clips",
    create: createRiggedHeroFallback,
  },
];

export function createVoxelAsset(id: VoxelAssetId) {
  const definition = ASSET_DEFINITIONS.find((asset) => asset.id === id);
  if (!definition) {
    throw new Error(`Unknown voxel asset: ${id}`);
  }
  return definition.create();
}
