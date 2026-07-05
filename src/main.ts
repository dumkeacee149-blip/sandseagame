import * as THREE from "three";
import "./styles.css";
import { palette } from "./core/palette";
import { initInput } from "./core/input";
import { hunyuanSlot } from "./core/models";
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
  createDistantCaravans,
} from "./world/landmarks";
import { createWorm, updateWorm } from "./world/worm";
import { shipState, updateShip, updateCamera } from "./game/ship-controller";
import { updateHud } from "./ui/hud";
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
const worm = createWorm();
scene.add(worm);
scene.add(createDistantCaravans());
const windParticles = createWindParticles();
scene.add(windParticles);

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

window.addEventListener("resize", onResize);
initInput();

// 开发调试钩子：Playwright 冒烟测试与人工验收用，生产构建被 tree-shake
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__game = {
    teleport(x: number, z: number, heading?: number) {
      shipState.position.set(x, 0, z);
      if (heading !== undefined) shipState.heading = heading;
      shipState.speed = 0;
      shipState.targetSpeed = 0;
    },
  };
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  updateShip(ship, delta, elapsed);
  updateCamera(camera, ship, delta);
  updateWorm(worm, elapsed);
  cloudBank.position.x = Math.sin(elapsed * 0.03) * 30;
  windParticles.position.x = ((elapsed * 48) % 900) - 450;
  windParticles.position.z = Math.sin(elapsed * 0.4) * 18;
  updateHud(shipState.speed, elapsed, ship.position);
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
