import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

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

const riggedCache = new Map<string, Promise<GLTF>>();

// 骨骼模型加载：SkinnedMesh 不能用普通 clone，必须 SkeletonUtils；动画 clip 随载返回
export function loadRiggedModel(url: string) {
  let cached = riggedCache.get(url);
  if (!cached) {
    cached = new Promise<GLTF>((resolve, reject) => {
      gltfLoader.load(url, resolve, undefined, reject);
    });
    riggedCache.set(url, cached);
  }
  return cached.then((gltf) => ({
    scene: cloneSkeleton(gltf.scene) as THREE.Group,
    animations: gltf.animations,
  }));
}

// 按占位脚印缩放并贴地对齐（与 hunyuanSlot 同规则），供骨骼模型换装复用
export function fitToPlaceholder(model: THREE.Object3D, placeholder: THREE.Object3D, rotateY = 0) {
  const pBounds = new THREE.Box3().setFromObject(placeholder);
  const pSize = pBounds.getSize(new THREE.Vector3());
  const target = Math.max(pSize.x, pSize.z);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  model.scale.setScalar(target / Math.max(size.x, size.z));
  model.rotation.y = rotateY;
  bounds.setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -bounds.min.y, -center.z);
}

// 占位组：先显示代码体素资产，混元模型加载完按占位脚印自动缩放换入；失败保留占位
export function hunyuanSlot(placeholder: THREE.Object3D, url: string, rotateY = 0) {
  const slot = new THREE.Group();
  slot.add(placeholder);
  loadModel(url)
    .then((model) => {
      fitToPlaceholder(model, placeholder, rotateY);
      slot.clear();
      slot.add(model);
    })
    .catch((error) => {
      console.error(`混元模型加载失败，保留体素占位: ${url}`, error);
    });
  return slot;
}
