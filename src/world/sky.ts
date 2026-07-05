import * as THREE from "three";
import { palette } from "../core/palette";
import { basicMat } from "../core/materials";
import { sandHeight } from "./sand";

export function createSkyDome() {
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

export function createSunAndMoons() {
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

export function createCloudBank() {
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

export function createSandLines() {
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

export function createWindParticles() {
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
