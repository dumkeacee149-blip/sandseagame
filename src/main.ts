import * as THREE from "three";
import "./styles.css";
import { palette } from "./core/palette";
import { initInput, initMouse, consumePressed, consumeClick, clearFramePresses } from "./core/input";
import { hunyuanSlot } from "./core/models";
import { mat } from "./core/materials";
import { createTerrain } from "./world/sand";
import {
  createSkyDome,
  createSunAndMoons,
  createCloudBank,
  createSandLines,
  createWindParticles,
} from "./world/sky";
import {
  createOasisPort,
  createRuins,
  createSaltFlats,
  createSaltcrestCamp,
  createDistantCaravans,
  createSeaScatter,
  breakableCrates,
} from "./world/landmarks";
import { createWorm, updateWorm } from "./world/worm";
import { shipState, updateShip, updateCamera } from "./game/ship-controller";
import {
  playerState,
  createPlayerAvatar,
  updatePlayer,
  updateWalkCamera,
  startAttack,
} from "./game/player";
import { updateHud } from "./ui/hud";
import { openTradePanel, closeTradePanel, isTradePanelOpen } from "./ui/trade-panel";
import { initMinimap, updateMinimap } from "./ui/minimap";
import { getState, setState } from "./game/store";
import { addGold } from "./game/economy";
import { PORTS } from "./game/data";
import { createVoxelAsset } from "./voxel-assets";

const canvas = document.querySelector<HTMLCanvasElement>("#game");

if (!canvas) {
  throw new Error("Game canvas was not found.");
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;

const scene = new THREE.Scene();
scene.background = palette.skyTop;
scene.fog = new THREE.Fog("#e5d5ae", 950, 2700);

const camera = new THREE.PerspectiveCamera(
  58,
  window.innerWidth / window.innerHeight,
  0.1,
  3600,
);
camera.position.set(0, 120, 220);

const clock = new THREE.Clock();

const hemi = new THREE.HemisphereLight("#eaf4ff", "#8a6440", 2.1);
scene.add(hemi);

const sunLight = new THREE.DirectionalLight("#ffedc4", 4.6);
sunLight.position.set(-680, 850, -320);
scene.add(sunLight);

const rimLight = new THREE.DirectionalLight("#70f0e4", 1.45);
rimLight.position.set(460, 270, 700);
scene.add(rimLight);

// 世界构建：保持与拆分前完全一致的调用顺序（随机数序列不变，画面不变）
const { terrain } = createTerrain();
scene.add(terrain);
scene.add(createSkyDome());
scene.add(createSunAndMoons());
const cloudBank = createCloudBank();
scene.add(cloudBank);
scene.add(createSandLines());

const shipPlaceholder = createVoxelAsset("A01");
shipPlaceholder.scale.setScalar(9);
const ship = hunyuanSlot(shipPlaceholder, "/models/skiff.glb", Math.PI / 2);
scene.add(ship);

scene.add(createOasisPort());
scene.add(createRuins());
scene.add(createSaltFlats());
scene.add(createSaltcrestCamp());
scene.add(createSeaScatter());
const worm = createWorm();
scene.add(worm);
scene.add(createDistantCaravans());
const windParticles = createWindParticles();
scene.add(windParticles);

// 玩家小人：航行时隐藏，下船后现身（贴近 ARRR 的上岸/上船切换）
const player = createPlayerAvatar();
player.visible = false;
scene.add(player);

type PlayMode = "sailing" | "walking";
let mode: PlayMode = "sailing";

const actionEl = document.querySelector("#action");

function setAction(text: string | null) {
  if (!actionEl) return;
  if (text) {
    actionEl.textContent = text;
    actionEl.classList.add("visible");
  } else {
    actionEl.classList.remove("visible");
  }
}

function goAshore() {
  mode = "walking";
  playerState.position.set(
    shipState.position.x + Math.cos(shipState.heading) * 36,
    0,
    shipState.position.z - Math.sin(shipState.heading) * 36,
  );
  playerState.heading = shipState.heading;
  playerState.speed = 0;
  player.visible = true;
}

function boardShip() {
  mode = "sailing";
  player.visible = false;
}

// 劈碎货箱的战利品直接进金库（+2 gold/箱）

type Splinter = { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number };
const splinters: Splinter[] = [];
const splinterGeometry = new THREE.BoxGeometry(3.4, 3.4, 3.4);

function spawnSplinters(origin: THREE.Vector3) {
  for (let i = 0; i < 6; i += 1) {
    const mesh = new THREE.Mesh(splinterGeometry, mat("crate", "#8a5a35"));
    mesh.position.copy(origin);
    scene.add(mesh);
    splinters.push({
      mesh,
      velocity: new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(50),
        THREE.MathUtils.randFloat(40, 90),
        THREE.MathUtils.randFloatSpread(50),
      ),
      life: 0.9,
    });
  }
}

function updateSplinters(delta: number) {
  for (let i = splinters.length - 1; i >= 0; i -= 1) {
    const splinter = splinters[i];
    splinter.life -= delta;
    splinter.velocity.y -= 220 * delta;
    splinter.mesh.position.addScaledVector(splinter.velocity, delta);
    splinter.mesh.rotation.x += delta * 6;
    splinter.mesh.rotation.z += delta * 5;
    splinter.mesh.scale.setScalar(Math.max(splinter.life / 0.9, 0.01));
    if (splinter.life <= 0) {
      scene.remove(splinter.mesh);
      splinters.splice(i, 1);
    }
  }
}

const hitProbe = new THREE.Vector3();
const crateWorldPos = new THREE.Vector3();
const marketProbe = new THREE.Vector3();

// 步行时最近的可交易集市（帐篷前 48 单位内）
function findNearbyMarket() {
  for (const port of PORTS) {
    marketProbe.set(port.marketX, player.position.y, port.marketZ);
    if (player.position.distanceTo(marketProbe) < 48) return port;
  }
  return null;
}

function tryBreakCrates() {
  hitProbe
    .set(Math.sin(playerState.heading), 0, Math.cos(playerState.heading))
    .multiplyScalar(18)
    .add(player.position);
  for (const crate of breakableCrates) {
    if (!crate.visible) continue;
    crate.getWorldPosition(crateWorldPos);
    if (crateWorldPos.distanceTo(hitProbe) < 24) {
      crate.visible = false;
      spawnSplinters(crateWorldPos);
      setState(addGold(getState(), 2));
    }
  }
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

window.addEventListener("resize", onResize);
initInput();
initMouse();
initMinimap();

// 开发调试钩子：Playwright 冒烟测试与人工验收用，生产构建被 tree-shake
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__game = {
    teleport(x: number, z: number, heading?: number) {
      shipState.position.set(x, 0, z);
      if (heading !== undefined) shipState.heading = heading;
      shipState.speed = 0;
      shipState.targetSpeed = 0;
    },
    teleportPlayer(x: number, z: number, heading?: number) {
      playerState.position.set(x, 0, z);
      if (heading !== undefined) playerState.heading = heading;
      playerState.speed = 0;
    },
    getMode: () => mode,
    getPlayerY: () => playerState.position.y,
    getState,
    goAshore,
    boardShip,
  };
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  if (mode === "sailing") {
    updateShip(ship, delta, elapsed);
    updateCamera(camera, ship, delta);
    const canGoAshore = Math.abs(shipState.speed) < 8;
    setAction(canGoAshore ? "Press E to go ashore" : null);
    if (canGoAshore && consumePressed("KeyE")) goAshore();
  } else if (isTradePanelOpen()) {
    // 交易中：世界暂停接收输入，E/Esc 离开集市
    updateWalkCamera(camera, player, delta);
    if (consumePressed("KeyE") || consumePressed("Escape")) closeTradePanel();
  } else {
    updatePlayer(player, delta, elapsed);
    updateWalkCamera(camera, player, delta);
    if (consumeClick() && startAttack()) tryBreakCrates();
    const market = findNearbyMarket();
    const nearShip = player.position.distanceTo(ship.position) < 60;
    setAction(
      market
        ? `Press E to trade at ${market.name}`
        : nearShip
          ? "Press E to board the skiff"
          : null,
    );
    if (market && consumePressed("KeyE")) {
      playerState.speed = 0;
      setAction(null);
      openTradePanel(market.id);
    } else if (nearShip && consumePressed("KeyE")) {
      boardShip();
    }
  }
  clearFramePresses();

  updateSplinters(delta);
  updateWorm(worm, elapsed);
  cloudBank.position.x = Math.sin(elapsed * 0.03) * 30;
  windParticles.position.x = ((elapsed * 48) % 900) - 450;
  windParticles.position.z = Math.sin(elapsed * 0.4) * 18;
  updateHud(getState(), shipState.speed, ship.position);
  updateMinimap(ship.position, shipState.heading, player.position, mode === "walking", worm.position, elapsed);
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
