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
import {
  createOasisPort,
  createRuins,
  createSaltFlats,
  createSeaScatter,
  createDistantCaravans,
  createSaltcrestCamp,
} from "./world/landmarks";

// 官网 hero 实时场景：复用游戏本体的天空/云/地形/沙船与各地标模块，
// 沙船沿"绿洲港→商队→盐滩→遗迹"的巡航线环游，镜头跟随——官网首屏即游戏实景。
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

  // 游戏本体的地标：港口小镇/遗迹/盐滩/商队/礁岩，让首屏看到的就是玩家会去的地方
  scene.add(createOasisPort());
  scene.add(createRuins());
  scene.add(createSaltFlats());
  scene.add(createSaltcrestCamp());
  scene.add(createSeaScatter());
  scene.add(createDistantCaravans());

  // 航线：贴着各地标的环游巡航线（顺序：绿洲港→商队→盐滩→盐脊营→遗迹→回程），
  // 航点都留在沙海开阔带，避开台地与礁岩碰撞半径
  const route = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(60, 0, -420),
      new THREE.Vector3(-420, 0, -140),
      new THREE.Vector3(-380, 0, 320),
      new THREE.Vector3(-100, 0, 520),
      new THREE.Vector3(250, 0, 560),
      new THREE.Vector3(520, 0, 260),
      new THREE.Vector3(420, 0, -160),
    ],
    true,
    "centripetal",
  );
  const ROUTE_LENGTH = route.getLength();
  const ROUTE_SPEED = 24; // 世界单位/秒，跑完全程约 100s，每 ~15s 换一处景

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
  // 起点定在驶过绿洲港的一段：首帧即见港口小镇，而非空旷启程段
  let elapsed = 20;
  let revealed = false;

  const renderFrame = () => {
    const t = ((elapsed * ROUTE_SPEED) / ROUTE_LENGTH) % 1;
    const point = route.getPointAt(t);
    const tangent = route.getTangentAt(t);
    // 航向与航线切线一致（游戏前进方向约定：forward = (cos h, -sin h)）
    const heading = Math.atan2(-tangent.z, tangent.x);

    ship.position.set(
      point.x,
      surfaceHeight(point.x, point.z) + 1.2 + Math.sin(elapsed * 4) * 0.9,
      point.z,
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
    renderFrame();
    return;
  }

  // 首帧无条件渲出（标签页后台预加载时 document.hidden=true，不能让海报永远不被接管）
  renderFrame();

  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const delta = (now - lastTime) / 1000;
    lastTime = now;
    // 隐藏标签页浏览器本身会暂停 rAF，这里只需管首屏滚出视口的情况
    if (!heroVisible) return;
    elapsed += Math.min(delta, 0.1);
    renderFrame();
  });
}
