import * as THREE from "three";

const materialCache = new Map<string, THREE.Material>();

export function mat(
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

export function basicMat(
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

export function box(
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
