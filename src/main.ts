import * as THREE from "three";
import "./styles.css";

const canvas = document.querySelector<HTMLCanvasElement>("#game");

if (!canvas) {
  throw new Error("Game canvas was not found.");
}

const palette = {
  skyTop: new THREE.Color("#202746"),
  skyHorizon: new THREE.Color("#e6ad69"),
  sandLow: new THREE.Color("#c98a4a"),
  sandMid: new THREE.Color("#e3b56a"),
  sandHigh: new THREE.Color("#f2d79a"),
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
scene.fog = new THREE.Fog("#d8a15f", 620, 2350);

const camera = new THREE.PerspectiveCamera(
  58,
  window.innerWidth / window.innerHeight,
  0.1,
  3600,
);
camera.position.set(0, 120, 220);

const clock = new THREE.Clock();
const tempColor = new THREE.Color();
const tempVec = new THREE.Vector3();

const hemi = new THREE.HemisphereLight("#fff1cf", "#4c2f31", 2.35);
scene.add(hemi);

const sunLight = new THREE.DirectionalLight("#ffe0a7", 4.8);
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

function cyl(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  radialSegments: number,
  material: THREE.Material,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments),
    material,
  );
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

function createTerrain() {
  const size = 3600;
  const segments = 150;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const colors: number[] = [];
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const y = sandHeight(x, z, 0);
    positions.setY(i, y);
    const dune = THREE.MathUtils.clamp((y + 32) / 76, 0, 1);
    tempColor.copy(palette.sandLow).lerp(palette.sandHigh, dune);
    if ((x + z) % 560 > 440) tempColor.lerp(palette.salt, 0.28);
    colors.push(tempColor.r, tempColor.g, tempColor.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const terrain = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
    }),
  );

  return { terrain, geometry };
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
    new THREE.SphereGeometry(44, 24, 12),
    basicMat("sun", "#ffe0a7"),
  );
  sun.position.set(-760, 560, -840);
  group.add(sun);

  const moon = new THREE.Mesh(
    new THREE.IcosahedronGeometry(26, 1),
    basicMat("moon", "#dff8ff", { transparent: true, opacity: 0.86 }),
  );
  moon.position.set(620, 440, -980);
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
        new THREE.IcosahedronGeometry(26 + Math.random() * 28, 1),
        cloudMaterial,
      );
      puff.scale.set(1.7 + Math.random() * 1.5, 0.36 + Math.random() * 0.2, 0.72);
      puff.position.set(j * 42, Math.random() * 12, Math.random() * 26);
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

function createSailShape(width: number, height: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-width * 0.48, -height * 0.48);
  shape.lineTo(width * 0.42, -height * 0.35);
  shape.lineTo(width * 0.12, height * 0.52);
  shape.lineTo(-width * 0.48, -height * 0.48);
  return new THREE.ShapeGeometry(shape);
}

function createSandSkiff() {
  const group = new THREE.Group();
  const wood = mat("skiff-wood", palette.wood);
  const darkWood = mat("skiff-dark-wood", palette.darkWood);
  const brass = mat("skiff-brass", palette.brass);
  const cloth = mat("skiff-cloth", palette.cloth, { side: THREE.DoubleSide });
  const teal = mat("skiff-teal", palette.teal, {
    emissive: palette.teal,
    emissiveIntensity: 0.15,
  });

  group.add(box(74, 13, 28, wood, [0, 12, 0]));
  group.add(box(56, 9, 22, darkWood, [-7, 22, 0]));
  group.add(box(34, 7, 20, wood, [36, 14, 0], [0, 0, -0.22]));
  group.add(box(25, 6, 18, wood, [-45, 13, 0], [0, 0, 0.28]));
  group.add(cyl(2.4, 2.4, 104, 8, darkWood, [0, 4, -20], [0, 0, Math.PI / 2]));
  group.add(cyl(2.4, 2.4, 104, 8, darkWood, [0, 4, 20], [0, 0, Math.PI / 2]));
  group.add(cyl(1.6, 1.6, 56, 8, brass, [-18, 12, -27], [Math.PI / 2, 0, 0]));
  group.add(cyl(1.6, 1.6, 56, 8, brass, [-18, 12, 27], [Math.PI / 2, 0, 0]));
  group.add(cyl(3.1, 3.5, 84, 8, darkWood, [2, 56, 0]));
  group.add(cyl(1.6, 1.6, 70, 8, darkWood, [0, 62, 0], [0, 0, Math.PI / 2]));

  const mainSail = new THREE.Mesh(createSailShape(70, 78), cloth);
  mainSail.position.set(2, 61, 0);
  mainSail.rotation.set(0.06, Math.PI / 2, -0.05);
  group.add(mainSail);

  const frontSail = new THREE.Mesh(createSailShape(38, 42), cloth);
  frontSail.position.set(43, 42, 0);
  frontSail.rotation.set(-0.04, Math.PI / 2, 0.15);
  group.add(frontSail);

  group.add(box(13, 10, 12, teal, [-16, 29, -2]));
  group.add(box(10, 8, 10, brass, [18, 29, 10]));
  group.add(box(8, 8, 8, darkWood, [17, 28, -13]));

  const flag = new THREE.Mesh(createSailShape(18, 16), cloth);
  flag.position.set(-6, 104, 0);
  flag.rotation.set(0, Math.PI / 2, 0.4);
  group.add(flag);

  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = false;
      object.receiveShadow = false;
    }
  });

  return group;
}

const ship = createSandSkiff();
scene.add(ship);

function createPalm(position: THREE.Vector3, scale = 1) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.scale.setScalar(scale);
  group.add(cyl(4, 5.6, 58, 7, mat("palm-trunk", "#7a4c2e"), [0, 29, 0], [0.1, 0.05, -0.15]));

  const leafMaterial = mat("palm-leaf", "#2d8f6a");
  for (let i = 0; i < 8; i += 1) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(6, 46, 4), leafMaterial);
    leaf.position.set(0, 61, 0);
    leaf.rotation.set(Math.PI / 2.4, (i / 8) * Math.PI * 2, 0.18);
    leaf.translateY(18);
    group.add(leaf);
  }
  return group;
}

function createOasisPort() {
  const group = new THREE.Group();
  group.position.set(-520, 0, -380);

  const water = new THREE.Mesh(
    new THREE.CircleGeometry(96, 28),
    new THREE.MeshBasicMaterial({
      color: palette.oasis,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = sandHeight(group.position.x, group.position.z) + 1.2;
  group.add(water);

  const dockMat = mat("dock", "#5f3724");
  group.add(box(190, 9, 24, dockMat, [18, 12, 108], [0, -0.16, 0]));
  group.add(box(90, 8, 26, dockMat, [-88, 13, 54], [0, 0.72, 0]));

  const tentMat = mat("tent-red", "#b23b35");
  const tentRoof = new THREE.Mesh(new THREE.ConeGeometry(38, 28, 4), tentMat);
  tentRoof.position.set(-124, 31, -28);
  tentRoof.rotation.y = Math.PI / 4;
  group.add(tentRoof);
  group.add(box(58, 20, 42, mat("tent-base", "#d0b07c"), [-124, 14, -28]));

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

  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.position.y += sandHeight(group.position.x + object.position.x, group.position.z + object.position.z);
    }
  });

  return group;
}

scene.add(createOasisPort());

function createRuins() {
  const group = new THREE.Group();
  group.position.set(650, 0, 280);
  const stone = mat("ruin-stone", "#9b9075");
  const darkStone = mat("ruin-dark", palette.basalt);
  const glow = mat("rune-glow", palette.glow, {
    emissive: palette.glow,
    emissiveIntensity: 0.8,
  });

  for (let i = 0; i < 6; i += 1) {
    const x = -120 + i * 48;
    const h = 78 + (i % 3) * 22;
    group.add(cyl(10, 12, h, 6, stone, [x, h / 2, -40], [0, 0, (i - 2) * 0.04]));
  }

  group.add(box(250, 28, 32, stone, [0, 112, -42], [0, 0, -0.05]));
  group.add(box(58, 130, 36, darkStone, [-160, 72, 58], [0, 0.12, 0.1]));
  group.add(box(58, 130, 36, darkStone, [160, 72, 58], [0, -0.1, -0.08]));
  group.add(box(250, 26, 36, darkStone, [0, 146, 58], [0, 0, 0.04]));

  for (let i = 0; i < 9; i += 1) {
    group.add(box(5, 18, 4, glow, [-115 + i * 28, 72 + (i % 2) * 18, 37]));
  }

  const obelisk = new THREE.Mesh(new THREE.ConeGeometry(24, 148, 4), stone);
  obelisk.position.set(80, 80, -148);
  obelisk.rotation.set(0.12, Math.PI / 4, -0.08);
  group.add(obelisk);

  const light = new THREE.PointLight("#69f1df", 2.8, 360);
  light.position.set(0, 78, 24);
  group.add(light);

  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.position.y += sandHeight(group.position.x + object.position.x, group.position.z + object.position.z) - 26;
    }
  });

  return group;
}

scene.add(createRuins());

function createSaltFlats() {
  const group = new THREE.Group();
  const saltMat = mat("salt-flat", palette.salt);
  for (let i = 0; i < 9; i += 1) {
    const shard = new THREE.Mesh(new THREE.CylinderGeometry(34, 44, 7, 6), saltMat);
    const x = 180 + THREE.MathUtils.randFloatSpread(350);
    const z = 680 + THREE.MathUtils.randFloatSpread(240);
    shard.position.set(x, sandHeight(x, z) + 1, z);
    shard.rotation.y = Math.random() * Math.PI;
    group.add(shard);
  }
  return group;
}

scene.add(createSaltFlats());

function createWorm() {
  const group = new THREE.Group();
  group.position.set(760, 0, -680);
  const bodyMat = mat("worm-body", "#7a2d2f");
  const bellyMat = mat("worm-belly", "#d7b47b");

  for (let i = 0; i < 16; i += 1) {
    const segment = new THREE.Mesh(new THREE.IcosahedronGeometry(22 - i * 0.55, 1), bodyMat);
    segment.position.set(-i * 24, 18 + Math.sin(i * 0.7) * 14, Math.sin(i * 0.4) * 18);
    segment.scale.set(1.35, 0.74, 0.9);
    segment.name = `worm-segment-${i}`;
    group.add(segment);
  }

  const head = new THREE.Mesh(new THREE.ConeGeometry(32, 60, 7), bodyMat);
  head.position.set(28, 34, 0);
  head.rotation.z = -Math.PI / 2;
  group.add(head);

  const jaw = new THREE.Mesh(new THREE.ConeGeometry(18, 34, 5), bellyMat);
  jaw.position.set(52, 28, 0);
  jaw.rotation.z = -Math.PI / 2;
  group.add(jaw);

  const dust = new THREE.Mesh(
    new THREE.TorusGeometry(52, 7, 6, 28),
    basicMat("worm-dust", "#d8a15f", { transparent: true, opacity: 0.36 }),
  );
  dust.position.set(-58, 4, 0);
  dust.rotation.x = Math.PI / 2;
  group.add(dust);

  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.position.y += sandHeight(group.position.x + object.position.x, group.position.z + object.position.z);
    }
  });

  return group;
}

const worm = createWorm();
scene.add(worm);

function createDistantCaravans() {
  const group = new THREE.Group();
  const cloth = mat("caravan-cloth", "#294c5b");
  const wood = mat("caravan-wood", "#634127");

  for (let i = 0; i < 9; i += 1) {
    const caravan = new THREE.Group();
    caravan.add(box(38, 10, 18, wood, [0, 9, 0]));
    const sail = new THREE.Mesh(createSailShape(22, 36), cloth);
    sail.position.set(2, 31, 0);
    sail.rotation.y = Math.PI / 2;
    caravan.add(sail);
    const x = -780 + i * 84;
    const z = 560 + Math.sin(i) * 34;
    caravan.position.set(x, sandHeight(x, z) + 2, z);
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
    sandHeight(shipState.position.x, shipState.position.z) + 18 + Math.sin(elapsed * 4) * 0.9;

  ship.position.copy(shipState.position);
  ship.rotation.y = shipState.heading;
  ship.rotation.z = THREE.MathUtils.damp(ship.rotation.z, -turn * 0.8, 5, delta);
  ship.rotation.x = Math.sin(elapsed * 2.6) * 0.025 + shipState.speed * 0.0007;
}

function updateCamera(delta: number) {
  const back = new THREE.Vector3(
    -Math.sin(shipState.heading) * 170,
    92,
    -Math.cos(shipState.heading) * 170,
  );
  const side = new THREE.Vector3(Math.cos(shipState.heading), 0, -Math.sin(shipState.heading)).multiplyScalar(32);
  const desired = ship.position.clone().add(back).add(side);
  camera.position.lerp(desired, 1 - Math.exp(-delta * 3.8));
  camera.lookAt(ship.position.x, ship.position.y + 34, ship.position.z);
}

function updateWorm(elapsed: number) {
  worm.position.x = 760 + Math.sin(elapsed * 0.16) * 92;
  worm.position.z = -680 + Math.cos(elapsed * 0.12) * 68;
  worm.rotation.y = Math.sin(elapsed * 0.18) * 0.3;
  worm.children.forEach((child, index) => {
    if (child.name.startsWith("worm-segment")) {
      child.position.y += Math.sin(elapsed * 1.8 + index * 0.72) * 0.07;
      child.rotation.z = Math.sin(elapsed * 1.4 + index) * 0.08;
    }
  });
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
