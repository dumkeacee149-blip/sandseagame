import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

const modelCache = new Map<string, Promise<THREE.Group>>();

export function loadModel(url: string) {
  let cached = modelCache.get(url);
  if (!cached) {
    cached = new Promise<THREE.Group>((resolve, reject) => {
      gltfLoader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    });
    modelCache.set(url, cached);
  }
  return cached.then((scene) => scene.clone(true));
}

// 占位组：先显示代码体素资产，混元模型加载完按占位脚印自动缩放换入；失败保留占位
export function hunyuanSlot(placeholder: THREE.Object3D, url: string, rotateY = 0) {
  const slot = new THREE.Group();
  slot.add(placeholder);
  const pBounds = new THREE.Box3().setFromObject(placeholder);
  const pSize = pBounds.getSize(new THREE.Vector3());
  const target = Math.max(pSize.x, pSize.z);
  loadModel(url)
    .then((model) => {
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      model.scale.setScalar(target / Math.max(size.x, size.z));
      model.rotation.y = rotateY;
      bounds.setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      model.position.set(-center.x, -bounds.min.y, -center.z);
      slot.clear();
      slot.add(model);
    })
    .catch((error) => {
      console.error(`混元模型加载失败，保留体素占位: ${url}`, error);
    });
  return slot;
}
