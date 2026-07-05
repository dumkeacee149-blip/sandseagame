import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ASSET_DEFINITIONS } from "./voxel-assets";
import "./asset-viewer.css";

const canvasElement = document.querySelector<HTMLCanvasElement>("#asset-canvas");
const titleElement = document.querySelector<HTMLElement>("#asset-title");
const roleElement = document.querySelector<HTMLElement>("#asset-role");
const tabsElement = document.querySelector<HTMLElement>("#asset-tabs");
const clipTabsElement = document.querySelector<HTMLElement>("#clip-tabs");

if (!canvasElement || !titleElement || !roleElement || !tabsElement || !clipTabsElement) {
  throw new Error("Asset viewer DOM is incomplete.");
}

const canvas = canvasElement;
const title = titleElement;
const role = roleElement;
const tabs = tabsElement;
const clipTabs = clipTabsElement;

const query = new URLSearchParams(window.location.search);
const sheetMode = query.get("sheet") === "1";
const compareMode = query.get("compare") === "A01";
const preferHunyuanAssets = query.get("source") !== "local";
const hunyuanAssetPaths = {
  A01: "/assets/hunyuan/raw/A01_hunyuan_pixel_skiff_v2.glb",
  A02: "/assets/hunyuan/raw/A02_hunyuan_privateer_v1.glb",
  A03: "/assets/hunyuan/raw/A03_hunyuan_oasis_tent_v1.glb",
  A04: "/assets/hunyuan/raw/A04_hunyuan_oasis_palm_v1.glb",
  A05: "/assets/hunyuan/raw/A05_hunyuan_rune_gate_v1.glb",
  A06: "/assets/hunyuan/raw/A06_hunyuan_obelisk_v1.glb",
  A07: "/assets/hunyuan/raw/A07_hunyuan_leviathan_v1.glb",
  A08: "/assets/hunyuan/raw/A08_hunyuan_relic_chest_v1.glb",
  A09: "/assets/hunyuan/raw/A09_hunyuan_harpoon_cannon_v1.glb",
  A10: "/assets/hunyuan/raw/A10_hunyuan_caravan_cart_v1.glb",
  H01: "/assets/hunyuan/raw/H01_hero_rigged_v1.glb",
} as const;
let selectedIndex = Math.max(
  0,
  ASSET_DEFINITIONS.findIndex((asset) => asset.id === query.get("asset")),
);
if (selectedIndex < 0) selectedIndex = 0;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  alpha: false,
  preserveDrawingBuffer: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#202746");
scene.fog = new THREE.Fog("#d9a65d", 34, 82);

const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 120);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 5;
controls.maxDistance = 48;
controls.autoRotate = !sheetMode && !compareMode;
controls.autoRotateSpeed = 0.85;

const stage = new THREE.Group();
scene.add(stage);

const hemi = new THREE.HemisphereLight("#fff2cd", "#4a2c32", 2.6);
scene.add(hemi);

const sun = new THREE.DirectionalLight("#ffe1a6", 4.2);
sun.position.set(-7, 12, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 34;
sun.shadow.camera.left = -14;
sun.shadow.camera.right = 14;
sun.shadow.camera.top = 14;
sun.shadow.camera.bottom = -14;
scene.add(sun);

const rim = new THREE.DirectionalLight("#67e6d8", 1.5);
rim.position.set(7, 5, -8);
scene.add(rim);

const clock = new THREE.Clock();
let activeAsset: THREE.Group | null = null;
let narrowSheet = window.innerWidth < 760;
let compareReady = false;
const gltfLoader = new GLTFLoader();

type AnimationPlayer = {
  mixer: THREE.AnimationMixer;
  clips: THREE.AnimationClip[];
  activeIndex: number;
  elapsed: number;
  action: THREE.AnimationAction | null;
  lockedClipIndex: number | null;
};

const animationPlayers: AnimationPlayer[] = [];
let focusedAnimationPlayer: AnimationPlayer | null = null;
let elapsedTime = 0;

const stageMaterials = {
  sand: new THREE.MeshLambertMaterial({ color: "#d9a65d", flatShading: true }),
  sandLight: new THREE.MeshLambertMaterial({ color: "#efd08c", flatShading: true }),
  basalt: new THREE.MeshLambertMaterial({ color: "#24232b", flatShading: true }),
  brass: new THREE.MeshLambertMaterial({ color: "#c89335", flatShading: true }),
};

function makeStageBox(
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  rotation: [number, number, number] = [0, 0, 0],
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.receiveShadow = true;
  return mesh;
}

function clearStage() {
  animationPlayers.length = 0;
  focusedAnimationPlayer = null;
  rebuildClipTabs(null);
  while (stage.children.length > 0) {
    const child = stage.children.pop();
    if (child) stage.remove(child);
  }
  activeAsset = null;
}

function startClip(player: AnimationPlayer, index: number) {
  const nextClip = player.clips[index];
  if (!nextClip) return;

  if (player.action) {
    player.action.stop();
  }
  player.action = player.mixer.clipAction(nextClip);
  player.action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
  player.activeIndex = index;
  player.elapsed = 0;
  if (player === focusedAnimationPlayer) {
    updateClipTabsState();
  }
}

function setClipLock(player: AnimationPlayer, clipIndex: number | null) {
  player.lockedClipIndex = clipIndex;
  startClip(player, clipIndex ?? 0);
  updateClipTabsState();
}

function updateClipTabsState() {
  const player = focusedAnimationPlayer;
  const buttons = clipTabs.querySelectorAll<HTMLButtonElement>(".clip-tab");
  buttons.forEach((button) => {
    const clipIndex = button.dataset.clipIndex === "auto" ? null : Number(button.dataset.clipIndex);
    const active =
      player &&
      ((clipIndex === null && player.lockedClipIndex === null) ||
        (clipIndex !== null && player.lockedClipIndex === clipIndex));
    button.setAttribute("aria-current", active ? "true" : "false");
  });
}

function rebuildClipTabs(player: AnimationPlayer | null) {
  clipTabs.replaceChildren();
  focusedAnimationPlayer = player;
  clipTabs.hidden = !player || sheetMode || compareMode;
  if (!player || clipTabs.hidden) return;

  const buttons = [
    { label: "Auto", index: null },
    ...player.clips.map((clip, index) => ({ label: clip.name, index })),
  ];
  buttons.forEach(({ label, index }) => {
    const button = document.createElement("button");
    button.className = "clip-tab";
    button.type = "button";
    button.textContent = label;
    button.dataset.clipIndex = index === null ? "auto" : String(index);
    button.addEventListener("click", () => setClipLock(player, index));
    clipTabs.append(button);
  });
  updateClipTabsState();
}

function fitAsset(asset: THREE.Group, targetExtent: number) {
  const box = new THREE.Box3().setFromObject(asset);
  const size = box.getSize(new THREE.Vector3());
  const maxExtent = Math.max(size.x, size.y, size.z) || 1;
  asset.scale.setScalar(targetExtent / maxExtent);
  const fittedBox = new THREE.Box3().setFromObject(asset);
  asset.position.y += -fittedBox.min.y + 0.2;
}

function getPreferredHunyuanPath(index: number) {
  const assetId = ASSET_DEFINITIONS[index]?.id;
  if (!preferHunyuanAssets || !assetId) return null;
  return hunyuanAssetPaths[assetId] ?? null;
}

async function loadHunyuanAsset(path: string, id: string) {
  const gltf = await gltfLoader.loadAsync(path);
  const asset = new THREE.Group();
  asset.name = `hunyuan-${id.toLowerCase()}`;
  asset.userData.assetId = id;
  asset.userData.source = "hunyuan";
  asset.add(gltf.scene);
  asset.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        material.needsUpdate = true;
      });
    }
  });
  if (gltf.animations.length > 0) {
    const preferredClipNames = ["Idle", "Walk", "Run", "Attack"];
    const preferredClips = preferredClipNames
      .map((name) => gltf.animations.find((clip) => clip.name === name))
      .filter((clip): clip is THREE.AnimationClip => Boolean(clip));
    const remainingClips = gltf.animations.filter((clip) => !preferredClipNames.includes(clip.name));
    const player: AnimationPlayer = {
      mixer: new THREE.AnimationMixer(gltf.scene),
      clips: [...preferredClips, ...remainingClips],
      activeIndex: 0,
      elapsed: 0,
      action: null,
      lockedClipIndex: null,
    };
    startClip(player, 0);
    asset.userData.animationPlayer = player;
    animationPlayers.push(player);
  }
  return asset;
}

async function createPreferredAsset(index: number) {
  const definition = ASSET_DEFINITIONS[index];
  const hunyuanPath = getPreferredHunyuanPath(index);
  if (hunyuanPath) {
    try {
      return await loadHunyuanAsset(hunyuanPath, definition.id);
    } catch (error) {
      console.warn(`Falling back to local voxel asset for ${definition.id}`, error);
    }
  }
  return definition.create();
}

function createPedestal(width: number, depth = width) {
  const group = new THREE.Group();
  group.add(makeStageBox([width, 0.32, depth], [0, 0, 0], stageMaterials.sand));
  group.add(makeStageBox([width * 0.82, 0.12, depth * 0.82], [0, 0.22, 0], stageMaterials.sandLight));
  for (let i = 0; i < 6; i += 1) {
    group.add(
      makeStageBox(
        [0.48, 0.12, 0.38],
        [-width * 0.38 + i * (width * 0.15), 0.34, depth * 0.46],
        i % 2 ? stageMaterials.sand : stageMaterials.brass,
        [0, i * 0.4, 0],
      ),
    );
  }
  return group;
}

function createSandFloor() {
  const group = new THREE.Group();
  group.add(makeStageBox([42, 0.24, 32], [0, -0.22, 0], stageMaterials.sand));
  for (let x = -18; x <= 18; x += 4) {
    for (let z = -14; z <= 14; z += 4) {
      if ((x + z) % 8 === 0) {
        group.add(
          makeStageBox(
            [2.8, 0.08, 0.5],
            [x, -0.06, z],
            stageMaterials.sandLight,
            [0, ((x - z) * Math.PI) / 32, 0],
          ),
        );
      }
    }
  }
  return group;
}

function createLabelSprite(text: string) {
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 320;
  labelCanvas.height = 96;
  const context = labelCanvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create label canvas.");
  }

  context.fillStyle = "rgba(18, 15, 20, 0.68)";
  context.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
  context.fillStyle = "#5ee6d5";
  context.font = "800 25px system-ui, sans-serif";
  context.fillText(text.split(" ")[0] ?? text, 18, 36);
  context.fillStyle = "#fff2d1";
  context.font = "700 20px system-ui, sans-serif";
  context.fillText(text.replace(/^A\d\d\s/, ""), 18, 70);

  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
    }),
  );
  sprite.scale.set(1.9, 0.57, 1);
  return sprite;
}

function updateHeader(index: number) {
  const asset = ASSET_DEFINITIONS[index];
  if (compareMode) {
    title.textContent = "A01 方块版 / 混元版对照";
    role.textContent = compareReady
      ? "Left: voxel baseline / Right: Hunyuan GLB reference"
      : "Loading Hunyuan GLB reference...";
    return;
  }

  if (sheetMode) {
    title.textContent = preferHunyuanAssets ? "混元候选 + 方块备份资产板" : "A/H 方块体素资产板";
    role.textContent = preferHunyuanAssets
      ? "Available Hunyuan GLBs are used first; missing assets fall back to local voxel baselines"
      : "Minecraft-like pixel/block baseline for approval";
    return;
  }

  if (getPreferredHunyuanPath(index)) {
    title.textContent = `${asset.id} 混元候选`;
    role.textContent = `${asset.name} / Hunyuan GLB if available`;
    return;
  }

  title.textContent = `${asset.id} ${asset.zhName}`;
  role.textContent = `${asset.name} / ${asset.role}`;
}

function rebuildTabs() {
  tabs.replaceChildren();

  ASSET_DEFINITIONS.forEach((asset, index) => {
    const button = document.createElement("button");
    button.className = "asset-tab";
    button.type = "button";
    button.textContent = asset.id;
    button.title = `${asset.zhName} / ${asset.name}`;
    button.setAttribute("aria-label", `${asset.id} ${asset.zhName}`);
    button.setAttribute(
      "aria-current",
      !sheetMode && !compareMode && index === selectedIndex ? "true" : "false",
    );
    button.addEventListener("click", () => {
      if (sheetMode) {
        window.location.href = `/asset-viewer.html?asset=${asset.id}`;
        return;
      }
      showAsset(index);
    });
    tabs.append(button);
  });
}

function setFocusCamera() {
  if (window.innerWidth < 760) {
    camera.position.set(5.8, 4.2, 10.4);
    controls.target.set(0, 1.55, 0);
  } else {
    camera.position.set(6.2, 4.7, 8.2);
    controls.target.set(0, 1.85, 0);
  }
  controls.minDistance = 4.2;
  controls.maxDistance = 16;
  controls.update();
}

function setSheetCamera(columns: number, rows: number) {
  const spanX = columns * 5.2;
  const spanZ = rows * 4.9;
  const distance = Math.max(spanX * 0.94, spanZ * 1.05, 16);
  camera.position.set(0, distance * 0.66, distance);
  controls.target.set(0, 0.9, 0);
  controls.minDistance = 10;
  controls.maxDistance = 48;
  controls.update();
}

function setCompareCamera() {
  camera.position.set(0, 6.4, 12.8);
  controls.target.set(0, 1.95, 0);
  controls.minDistance = 7;
  controls.maxDistance = 24;
  controls.update();
}

async function showAsset(index: number) {
  selectedIndex = index;
  clearStage();
  stage.add(createSandFloor());

  const pedestal = createPedestal(7.2, 6.4);
  pedestal.position.y = 0.02;
  stage.add(pedestal);

  updateHeader(index);
  rebuildTabs();

  const asset = await createPreferredAsset(index);
  fitAsset(asset, window.innerWidth < 760 ? 4.25 : 5.2);
  asset.position.y += 0.1;
  activeAsset = asset;
  stage.add(asset);
  rebuildClipTabs((asset.userData.animationPlayer as AnimationPlayer | undefined) ?? null);

  setFocusCamera();
}

async function showSheet() {
  clearStage();
  stage.add(createSandFloor());

  const columns = window.innerWidth < 760 ? 2 : 5;
  const rows = Math.ceil(ASSET_DEFINITIONS.length / columns);
  const spacingX = 5.3;
  const spacingZ = 4.9;
  const offsetX = ((columns - 1) * spacingX) / 2;
  const offsetZ = ((rows - 1) * spacingZ) / 2;

  await Promise.all(
    ASSET_DEFINITIONS.map(async (definition, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const cell = new THREE.Group();
      cell.position.set(col * spacingX - offsetX, 0, row * spacingZ - offsetZ);
      cell.add(createPedestal(4.35, 3.75));

      const hasHunyuanPath = Boolean(getPreferredHunyuanPath(index));
      const asset = await createPreferredAsset(index);
      fitAsset(asset, 2.9);
      asset.position.y += 0.12;
      cell.add(asset);

      const label = createLabelSprite(
        hasHunyuanPath ? `${definition.id} 混元候选` : `${definition.id} ${definition.zhName}`,
      );
      label.position.set(0, 2.85, 1.78);
      cell.add(label);
      stage.add(cell);
    }),
  );

  setSheetCamera(columns, rows);
  updateHeader(0);
  rebuildTabs();
}

async function showHunyuanComparison() {
  compareReady = false;
  clearStage();
  stage.add(createSandFloor());

  const leftPedestal = createPedestal(6.4, 5.4);
  leftPedestal.position.set(-3.9, 0.02, 0);
  stage.add(leftPedestal);

  const rightPedestal = createPedestal(6.4, 5.4);
  rightPedestal.position.set(3.9, 0.02, 0);
  stage.add(rightPedestal);

  const localAsset = ASSET_DEFINITIONS[0].create();
  fitAsset(localAsset, 4.2);
  localAsset.position.set(-3.9, localAsset.position.y + 0.12, 0);
  stage.add(localAsset);

  const leftLabel = createLabelSprite("LOCAL 方块基准");
  leftLabel.position.set(-3.9, 4.1, 2.2);
  stage.add(leftLabel);

  const rightLabel = createLabelSprite("HUNYUAN 混元GLB");
  rightLabel.position.set(3.9, 4.1, 2.2);
  stage.add(rightLabel);

  setCompareCamera();
  updateHeader(0);
  rebuildTabs();

  const hunyuanAsset = await loadHunyuanAsset(hunyuanAssetPaths.A01, "A01");
  fitAsset(hunyuanAsset, 4.4);
  hunyuanAsset.position.set(3.9, hunyuanAsset.position.y + 0.12, 0);
  stage.add(hunyuanAsset);
  compareReady = true;
  updateHeader(0);
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  if (compareMode) {
    setCompareCamera();
  } else if (sheetMode) {
    const isNarrow = width < 760;
    if (isNarrow !== narrowSheet) {
      narrowSheet = isNarrow;
      void showSheet();
    } else {
      const columns = isNarrow ? 2 : 5;
      setSheetCamera(columns, Math.ceil(ASSET_DEFINITIONS.length / columns));
    }
  } else {
    setFocusCamera();
  }
}

window.addEventListener("resize", onResize);

if (compareMode) {
  void showHunyuanComparison();
} else if (sheetMode) {
  void showSheet();
} else {
  void showAsset(selectedIndex);
}

function animate() {
  const delta = clock.getDelta();
  elapsedTime += delta;
  for (const player of animationPlayers) {
    player.mixer.update(delta);
    player.elapsed += delta;
    const activeClip = player.clips[player.activeIndex];
    const holdSeconds = Math.max(activeClip?.duration ?? 0, 1.8) + 0.45;
    if (player.lockedClipIndex === null && player.clips.length > 1 && player.elapsed > holdSeconds) {
      startClip(player, (player.activeIndex + 1) % player.clips.length);
    }
  }
  if (activeAsset) {
    activeAsset.position.y = 0.3 + Math.sin(elapsedTime * 1.3) * 0.035;
  }
  controls.update();
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
