import * as THREE from "three";
import { createTerrain, surfaceHeight } from "./world/sand";
import {
  createSkyDome,
  createSunAndMoons,
  createCloudBank,
  createSandLines,
  createWindParticles,
} from "./world/sky";
import { createVoxelAsset } from "./voxel-assets";
import { hunyuanSlot } from "./core/models";

// 官网 hero 实时场景：复用游戏本体的天空/云/地形/沙船模块，
// 沙船绕开阔沙海缓航一圈，镜头慢速环绕——官网首屏即游戏实景。
const canvas = document.getElementById("hero-canvas") as HTMLCanvasElement | null;

if (canvas) {
  initHero(canvas);
}

function initHero(heroCanvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas: heroCanvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog("#e5d5ae", 950, 2700);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.5, 6000);

  scene.add(new THREE.HemisphereLight("#eaf4ff", "#8a6440", 2.1));
  const sunLight = new THREE.DirectionalLight("#ffedc4", 4.6);
  sunLight.position.set(-680, 850, -320);
  scene.add(sunLight);
  const rimLight = new THREE.DirectionalLight("#70f0e4", 1.45);
  rimLight.position.set(460, 270, 700);
  scene.add(rimLight);

  const { terrain } = createTerrain();
  scene.add(terrain);
  scene.add(createSkyDome());
  scene.add(createSunAndMoons());
  const cloudBank = createCloudBank();
  scene.add(cloudBank);
  scene.add(createSandLines());
  const windParticles = createWindParticles();
  scene.add(windParticles);

  const shipPlaceholder = createVoxelAsset("A01");
  shipPlaceholder.scale.setScalar(9);
  const ship = hunyuanSlot(shipPlaceholder, "/models/skiff.glb", Math.PI / 2);
  scene.add(ship);

  // 航线：开阔沙海中心的慢速环线（避开四座岛屿台地）
  const ROUTE_RADIUS = 300;
  const ROUTE_SPEED = 0.05; // 弧度/秒

  // 鼠标视差：轻微偏转镜头朝向，落地页常见的"活"感
  const parallax = { x: 0, y: 0 };
  window.addEventListener("pointermove", (event) => {
    parallax.x = (event.clientX / window.innerWidth - 0.5) * 2;
    parallax.y = (event.clientY / window.innerHeight - 0.5) * 2;
  });

  const resize = () => {
    const { clientWidth, clientHeight } = heroCanvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize);
  resize();

  // 首屏滚出视口或标签页隐藏时暂停渲染，省电省 GPU
  let heroVisible = true;
  new IntersectionObserver((entries) => {
    heroVisible = entries[0]?.isIntersecting ?? true;
  }).observe(heroCanvas);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // three 0.183 已弃用 Clock（每帧刷警告），手动记时间戳
  let lastTime = performance.now();
  let elapsed = 0;
  let revealed = false;

  const renderFrame = () => {
    const angle = elapsed * ROUTE_SPEED;
    const shipX = Math.cos(angle) * ROUTE_RADIUS;
    const shipZ = Math.sin(angle) * ROUTE_RADIUS;
    // 航向与圆周切线一致（游戏前进方向约定：forward = (cos h, -sin h)）
    const heading = -angle - Math.PI / 2;

    ship.position.set(
      shipX,
      surfaceHeight(shipX, shipZ) + 1.2 + Math.sin(elapsed * 4) * 0.9,
      shipZ,
    );
    ship.rotation.y = heading;
    ship.rotation.x = Math.sin(elapsed * 2.6) * 0.025;
    ship.rotation.z = Math.sin(elapsed * 1.7) * 0.03;

    cloudBank.position.x = Math.sin(elapsed * 0.03) * 30;
    windParticles.position.x = ((elapsed * 48) % 900) - 450;
    windParticles.position.z = Math.sin(elapsed * 0.4) * 18;

    // 镜头：船侧后方高机位缓慢跟随 + 鼠标视差微偏
    const camAngle = heading + Math.PI + Math.sin(elapsed * 0.07) * 0.35 + parallax.x * 0.12;
    camera.position.set(
      ship.position.x + Math.cos(camAngle) * 260,
      ship.position.y + 92 + parallax.y * -14,
      ship.position.z + Math.sin(camAngle) * 260,
    );
    // 注视点抬高：船落在画面下三分之一，别顶着标题
    camera.lookAt(ship.position.x, ship.position.y + 88, ship.position.z);

    renderer.render(scene, camera);

    if (!revealed) {
      revealed = true;
      heroCanvas.classList.add("is-live");
    }
  };

  if (reducedMotion) {
    // 尊重减少动效偏好：出一帧静态实景即可
    elapsed = 12;
    renderFrame();
    return;
  }

  // 首帧无条件渲出（标签页后台预加载时 document.hidden=true，不能让海报永远不被接管）
  renderFrame();

  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const delta = (now - lastTime) / 1000;
    lastTime = now;
    if (document.hidden || !heroVisible) return;
    elapsed += Math.min(delta, 0.1);
    renderFrame();
  });
}
