import * as THREE from "three";
import "./styles.css";
import { createVoxelAsset } from "./voxel-assets";

const canvas = document.querySelector<HTMLCanvasElement>("#game");

if (!canvas) {
  throw new Error("Game canvas was not found.");
}

const palette = {
  skyTop: new THREE.Color("#3f8ee0"),
  skyHorizon: new THREE.Color("#e9ddbc"),
  sandLow: new THREE.Color("#b06f35"),
  sandMid: new THREE.Color("#d99c52"),
  sandHigh: new THREE.Color("#eec87e"),
  salt: new THREE.Color("#e9e2c9"),
  basalt: new THREE.Color("#1c1b22"),
  wood: new THREE.Color("#6e4026"),
  darkWood: new THREE.Color("#3d2418"),
  brass: new THREE.Color("#c9973e"),
  cloth: new THREE.Color("#a72f32"),
  teal: new THREE.Color("#52d0c6"),
  oasis: new THREE.Color("#2da7a1"),
  glow: new THREE.Color("#69f1df"),
  bone: new THREE.Color("#d6c7a5"),
};

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
const tempVec = new THREE.Vector3();

const hemi = new THREE.HemisphereLight("#eaf4ff", "#8a6440", 2.1);
scene.add(hemi);

const sunLight = new THREE.DirectionalLight("#ffedc4", 4.6);
sunLight.position.set(-680, 850, -320);
scene.add(sunLight);

const rimLight = new THREE.DirectionalLight("#70f0e4", 1.45);
rimLight.position.set(460, 270, 700);
scene.add(rimLight);

type ShipState = {
  position: THREE.Vector3;
  heading: number;
  speed: number;
  targetSpeed: number;
};

const keys = new Set<string>();
const shipState: ShipState = {
  position: new THREE.Vector3(0, 0, 0),
  heading: 0.55,
  speed: 0,
  targetSpeed: 0,
};

const materialCache = new Map<string, THREE.Material>();

function mat(
  key: string,
  color: THREE.ColorRepresentation,
  options: Partial<THREE.MeshLambertMaterialParameters> = {},
) {
  const cached = materialCache.get(key);
  if (cached) return cached;

  const material = new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
    ...options,
  });
  materialCache.set(key, material);
  return material;
}

function basicMat(
  key: string,
  color: THREE.ColorRepresentation,
  options: Partial<THREE.MeshBasicMaterialParameters> = {},
) {
  const cached = materialCache.get(key);
  if (cached) return cached;

  const material = new THREE.MeshBasicMaterial({
    color,
    ...options,
  });
  materialCache.set(key, material);
  return material;
}

function box(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  return mesh;
}

function sandHeight(x: number, z: number, time = 0) {
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
function createTerrain() {
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

const { terrain } = createTerrain();
scene.add(terrain);

function createSkyDome() {
  const geometry = new THREE.SphereGeometry(2600, 32, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: palette.skyTop },
      horizonColor: { value: palette.skyHorizon },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        float mixValue = smoothstep(-0.12, 0.72, h);
        vec3 color = mix(horizonColor, topColor, mixValue);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geometry, material);
}

scene.add(createSkyDome());

function createSunAndMoons() {
  const group = new THREE.Group();
  const sun = new THREE.Mesh(
    new THREE.BoxGeometry(88, 88, 8),
    basicMat("sun", "#ffe0a7"),
  );
  sun.position.set(-760, 560, -840);
  sun.lookAt(0, 120, 0);
  group.add(sun);

  const moon = new THREE.Mesh(
    new THREE.BoxGeometry(52, 52, 6),
    basicMat("moon", "#dff8ff", { transparent: true, opacity: 0.86 }),
  );
  moon.position.set(620, 440, -980);
  moon.lookAt(0, 120, 0);
  group.add(moon);
  return group;
}

scene.add(createSunAndMoons());

function createCloudBank() {
  const group = new THREE.Group();
  const cloudMaterial = basicMat("cloud", "#fff3d4", {
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });

  for (let i = 0; i < 34; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(Math.random() * 4);
    for (let j = 0; j < puffs; j += 1) {
      const puff = new THREE.Mesh(
        new THREE.BoxGeometry(64 + Math.random() * 56, 10, 40 + Math.random() * 26),
        cloudMaterial,
      );
      puff.position.set(j * 52, Math.floor(Math.random() * 2) * 10, Math.random() * 26);
      cloud.add(puff);
    }
    cloud.position.set(
      THREE.MathUtils.randFloatSpread(2500),
      THREE.MathUtils.randFloat(260, 460),
      THREE.MathUtils.randFloatSpread(2300),
    );
    cloud.rotation.y = Math.random() * Math.PI;
    group.add(cloud);
  }

  return group;
}

const cloudBank = createCloudBank();
scene.add(cloudBank);

function createSandLines() {
  const group = new THREE.Group();
  const lineMaterial = new THREE.LineBasicMaterial({
    color: "#fff0bd",
    transparent: true,
    opacity: 0.24,
  });

  for (let i = 0; i < 130; i += 1) {
    const points: THREE.Vector3[] = [];
    const baseX = THREE.MathUtils.randFloatSpread(3000);
    const baseZ = THREE.MathUtils.randFloatSpread(3000);
    for (let j = 0; j < 7; j += 1) {
      const x = baseX + j * 24;
      const z = baseZ + Math.sin(j * 0.8 + i) * 8;
      points.push(new THREE.Vector3(x, sandHeight(x, z) + 1.4, z));
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial);
    line.rotation.y = -0.28;
    group.add(line);
  }

  return group;
}

scene.add(createSandLines());

const ship = createVoxelAsset("A01");
ship.scale.setScalar(9);
scene.add(ship);

function createPalm(position: THREE.Vector3, scale = 1) {
  const palm = createVoxelAsset("A04");
  palm.position.copy(position);
  palm.scale.setScalar(11 * scale);
  palm.rotation.y = Math.random() * Math.PI * 2;
  return palm;
}

function createOasisPort() {
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

  const tent = createVoxelAsset("A03");
  tent.scale.setScalar(11);
  tent.position.set(-124, 0, -28);
  tent.rotation.y = Math.PI / 5;
  group.add(tent);

  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2;
    const radius = 108 + Math.sin(i) * 22;
    group.add(
      createPalm(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius), 0.8 + Math.random() * 0.34),
    );
  }

  for (let i = 0; i < 8; i += 1) {
    group.add(box(14, 12, 14, mat("crate", "#8a5a35"), [-82 + i * 22, 17, 92 + (i % 2) * 20]));
  }

  groundChildren(group);

  return group;
}

// 只按顶层子节点贴地，避免拆散体素资产的内部结构
function groundChildren(group: THREE.Group) {
  group.children.forEach((child) => {
    child.position.y += sandHeight(
      group.position.x + child.position.x,
      group.position.z + child.position.z,
    );
  });
}

scene.add(createOasisPort());

function createRuins() {
  const group = new THREE.Group();
  group.position.set(650, 0, 280);

  const gate = createVoxelAsset("A05");
  gate.scale.setScalar(18);
  gate.position.set(0, 0, -30);
  group.add(gate);

  const obeliskSpots: Array<[number, number, number, number]> = [
    [-150, 90, 13, 0.6],
    [150, 60, 10, 2.1],
    [60, -160, 15, 3.6],
  ];
  obeliskSpots.forEach(([x, z, scale, rotY]) => {
    const obelisk = createVoxelAsset("A06");
    obelisk.scale.setScalar(scale);
    obelisk.position.set(x, 0, z);
    obelisk.rotation.y = rotY;
    group.add(obelisk);
  });

  const light = new THREE.PointLight("#69f1df", 2.8, 360);
  light.position.set(0, 78, 24);
  group.add(light);

  groundChildren(group);

  return group;
}

scene.add(createRuins());

function createSaltFlats() {
  const group = new THREE.Group();
  const saltMat = mat("salt-flat", palette.salt);
  for (let i = 0; i < 9; i += 1) {
    const shard = new THREE.Mesh(new THREE.BoxGeometry(64, 8, 52), saltMat);
    const x = 180 + THREE.MathUtils.randFloatSpread(350);
    const z = 680 + THREE.MathUtils.randFloatSpread(240);
    shard.position.set(x, sandHeight(x, z) + 1, z);
    shard.rotation.y = (Math.floor(Math.random() * 4) * Math.PI) / 4;
    group.add(shard);
  }
  return group;
}

scene.add(createSaltFlats());

function createWorm() {
  const worm = createVoxelAsset("A07");
  worm.scale.setScalar(16);
  worm.position.set(760, sandHeight(760, -680), -680);
  return worm;
}

const worm = createWorm();
scene.add(worm);

function createDistantCaravans() {
  const group = new THREE.Group();

  for (let i = 0; i < 7; i += 1) {
    const caravan = createVoxelAsset("A10");
    caravan.scale.setScalar(8);
    const x = -780 + i * 108;
    const z = 560 + Math.sin(i) * 34;
    caravan.position.set(x, sandHeight(x, z), z);
    caravan.rotation.y = -0.58;
    group.add(caravan);
  }

  return group;
}

scene.add(createDistantCaravans());

function createWindParticles() {
  const count = 900;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = THREE.MathUtils.randFloatSpread(1800);
    positions[i * 3 + 1] = THREE.MathUtils.randFloat(6, 115);
    positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(1400);
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: "#ffe2a6",
      size: 2.1,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
    }),
  );
  return points;
}

const windParticles = createWindParticles();
scene.add(windParticles);

function updateShip(delta: number, elapsed: number) {
  const forwardInput = Number(keys.has("KeyW") || keys.has("ArrowUp"));
  const backInput = Number(keys.has("KeyS") || keys.has("ArrowDown"));
  const leftInput = Number(keys.has("KeyA") || keys.has("ArrowLeft"));
  const rightInput = Number(keys.has("KeyD") || keys.has("ArrowRight"));

  const thrust = forwardInput - backInput * 0.62;
  shipState.targetSpeed = thrust * 92;
  shipState.speed = THREE.MathUtils.damp(shipState.speed, shipState.targetSpeed, 2.5, delta);

  const turn = (leftInput - rightInput) * Math.max(Math.abs(shipState.speed), 28) * 0.0065;
  shipState.heading += turn * delta;

  const forward = tempVec.set(Math.sin(shipState.heading), 0, Math.cos(shipState.heading));
  shipState.position.addScaledVector(forward, shipState.speed * delta);
  shipState.position.x = THREE.MathUtils.clamp(shipState.position.x, -1420, 1420);
  shipState.position.z = THREE.MathUtils.clamp(shipState.position.z, -1420, 1420);
  shipState.position.y =
    sandHeight(shipState.position.x, shipState.position.z) + 1.2 + Math.sin(elapsed * 4) * 0.9;

  ship.position.copy(shipState.position);
  ship.rotation.y = shipState.heading;
  ship.rotation.z = THREE.MathUtils.damp(ship.rotation.z, -turn * 0.8, 5, delta);
  ship.rotation.x = Math.sin(elapsed * 2.6) * 0.025 + shipState.speed * 0.0007;
}

function updateCamera(delta: number) {
  const back = new THREE.Vector3(
    -Math.sin(shipState.heading) * 165,
    58,
    -Math.cos(shipState.heading) * 165,
  );
  const side = new THREE.Vector3(Math.cos(shipState.heading), 0, -Math.sin(shipState.heading)).multiplyScalar(28);
  const desired = ship.position.clone().add(back).add(side);
  camera.position.lerp(desired, 1 - Math.exp(-delta * 3.8));
  camera.lookAt(ship.position.x, ship.position.y + 46, ship.position.z);
}

function updateWorm(elapsed: number) {
  worm.position.x = 760 + Math.sin(elapsed * 0.16) * 92;
  worm.position.z = -680 + Math.cos(elapsed * 0.12) * 68;
  worm.rotation.y = Math.sin(elapsed * 0.18) * 0.3;
  worm.position.y =
    sandHeight(worm.position.x, worm.position.z) + Math.sin(elapsed * 1.4) * 3 - 2;
}

function updateHud() {
  const speed = document.querySelector("#speed");
  const cargo = document.querySelector("#cargo");
  const wind = document.querySelector("#wind");
  const route = document.querySelector("#route");
  if (speed) speed.textContent = Math.round(Math.abs(shipState.speed) * 0.44).toString();
  if (cargo) cargo.textContent = `${12 + Math.round(Math.sin(clock.elapsedTime * 0.3) * 2)}`;
  if (wind) wind.textContent = clock.elapsedTime % 18 > 9 ? "SE" : "NE";

  if (route) {
    const nearOasis = ship.position.distanceTo(new THREE.Vector3(-520, ship.position.y, -380)) < 340;
    const nearRuins = ship.position.distanceTo(new THREE.Vector3(650, ship.position.y, 280)) < 360;
    route.textContent = nearOasis
      ? "Oasis Port / Brass Market / Palm Quay"
      : nearRuins
        ? "Sunken Gate / Obsidian Columns / Rune Vault"
        : "Glass Dunes / Salt Flats / Wind Road";
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
window.addEventListener("keydown", (event) => keys.add(event.code));
window.addEventListener("keyup", (event) => keys.delete(event.code));

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  updateShip(delta, elapsed);
  updateCamera(delta);
  updateWorm(elapsed);
  cloudBank.position.x = Math.sin(elapsed * 0.03) * 30;
  windParticles.position.x = ((elapsed * 48) % 900) - 450;
  windParticles.position.z = Math.sin(elapsed * 0.4) * 18;
  updateHud();
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
