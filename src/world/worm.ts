import * as THREE from "three";
import { loadRiggedModel, fitRiggedToPlaceholder } from "../core/models";
import { mat } from "../core/materials";
import { sandHeight } from "./sand";
import { createVoxelAsset } from "../voxel-assets";
import { WORM_MAX_HP } from "../game/data";
import type { WormAgent } from "../game/worm-ai";

// 沙虫渲染（多实例）：每只 rig 携带自己的 mixer/动作/血条（存 userData），
// 位置/朝向/下潜由对应 WormAgent 驱动，动画 clip 跟随 AI 状态切换。
const DUST_COUNT = 10;

type WormRigData = {
  mixer: THREE.AnimationMixer | null;
  actions: Record<string, THREE.AnimationAction>;
  current: string;
  hpCtx: CanvasRenderingContext2D | null;
  hpTexture: THREE.CanvasTexture | null;
  hpSprite: THREE.Sprite | null;
  lastHp: number;
};

function playRigAction(data: WormRigData, name: string, fade = 0.3) {
  if (!data.mixer || data.current === name) return;
  const next = data.actions[name];
  if (!next) return;
  const prev = data.actions[data.current];
  next.reset().fadeIn(fade).play();
  if (prev) prev.fadeOut(fade);
  data.current = name;
}

function buildHpBar(rig: THREE.Group, data: WormRigData) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 20;
  data.hpCtx = canvas.getContext("2d");
  data.hpTexture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: data.hpTexture, transparent: true, depthWrite: false }),
  );
  sprite.scale.set(56, 9, 1);
  sprite.position.y = 46;
  sprite.visible = false;
  data.hpSprite = sprite;
  rig.add(sprite);
}

function drawHpBar(data: WormRigData, hp: number) {
  const ctx = data.hpCtx;
  if (!ctx || !data.hpTexture) return;
  ctx.clearRect(0, 0, 128, 20);
  ctx.fillStyle = "rgba(24, 14, 5, 0.82)";
  ctx.beginPath();
  ctx.roundRect(0, 0, 128, 20, 9);
  ctx.fill();
  const ratio = Math.max(0, hp / WORM_MAX_HP);
  ctx.fillStyle = ratio > 0.5 ? "#c8442f" : "#ff6a3d";
  ctx.beginPath();
  ctx.roundRect(3, 3, 122 * ratio, 14, 6);
  ctx.fill();
  data.hpTexture.needsUpdate = true;
}

export function createWorm() {
  const rig = new THREE.Group();
  const data: WormRigData = {
    mixer: null,
    actions: {},
    current: "",
    hpCtx: null,
    hpTexture: null,
    hpSprite: null,
    lastHp: WORM_MAX_HP,
  };
  rig.userData.worm = data;

  const placeholder = createVoxelAsset("A07");
  placeholder.scale.setScalar(16);
  rig.add(placeholder);

  loadRiggedModel("/models/leviathan_rigged.glb?v=blender-h02-v3")
    .then(({ scene: model, animations }) => {
      fitRiggedToPlaceholder(model, placeholder);
      rig.remove(placeholder);
      model.name = "worm-body";
      rig.add(model);
      data.mixer = new THREE.AnimationMixer(model);
      for (const clip of animations) {
        data.actions[clip.name] = data.mixer.clipAction(clip);
      }
      if (data.actions.Bite) {
        data.actions.Bite.setLoop(THREE.LoopOnce, 1);
        data.actions.Bite.clampWhenFinished = true;
      }
      playRigAction(data, "Swim");
    })
    .catch((error) => {
      console.error("骨骼沙虫加载失败，保留体素占位", error);
    });

  const dust = new THREE.Group();
  dust.name = "worm-dust";
  const dustMat = mat("worm-dust-sand", "#d9a65d");
  for (let i = 0; i < DUST_COUNT; i += 1) {
    const angle = (i / DUST_COUNT) * Math.PI * 2;
    const chunk = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 7), dustMat);
    chunk.position.set(Math.cos(angle) * 52, 0, Math.sin(angle) * 68);
    dust.add(chunk);
  }
  rig.add(dust);

  buildHpBar(rig, data);
  return rig;
}

export function updateWorm(rig: THREE.Group, agent: WormAgent, elapsed: number, delta: number) {
  const data = rig.userData.worm as WormRigData;

  rig.position.x = agent.position.x;
  rig.position.z = agent.position.z;
  rig.rotation.y = agent.heading;

  // 死亡：沉入沙下等待重生（血条隐藏、沙尘平息）
  const dead = agent.mode === "dead";

  if (data.mixer) {
    data.mixer.update(delta);
    playRigAction(
      data,
      agent.mode === "bite" ? "Bite" : agent.mode === "dive" || dead ? "Burrow" : "Swim",
    );
  }

  const aggressive = agent.mode === "chase" || agent.mode === "bite";
  const targetSink = dead ? 60 : agent.mode === "dive" ? 30 : aggressive ? 6 : 3;
  const bob = dead ? 0 : Math.sin(elapsed * (aggressive ? 3.2 : 1.6)) * 3;
  rig.position.y = sandHeight(rig.position.x, rig.position.z) + bob - targetSink;

  rig.rotation.x = dead ? 0.4 : Math.sin(elapsed * 2.1 * (aggressive ? 2 : 1)) * 0.1 * (aggressive ? 2 : 1);
  rig.rotation.z = dead ? 0 : Math.sin(elapsed * 1.3) * 0.06;

  // 血条：受过伤且存活才显示；数值变化时重绘
  if (data.hpSprite) {
    data.hpSprite.visible = !dead && agent.hp < WORM_MAX_HP;
    if (agent.hp !== data.lastHp) {
      data.lastHp = agent.hp;
      drawHpBar(data, agent.hp);
    }
  }

  const dust = rig.getObjectByName("worm-dust");
  if (dust) {
    dust.visible = !dead;
    const lively = aggressive ? 2.2 : agent.mode === "dive" ? 2.6 : 1;
    dust.rotation.y = -rig.rotation.y + elapsed * 0.7 * lively;
    dust.position.y = -rig.position.y + sandHeight(rig.position.x, rig.position.z) + 2;
    dust.children.forEach((chunk, index) => {
      chunk.position.y = Math.abs(Math.sin(elapsed * 3 + index * 1.7)) * 5 * lively;
      chunk.rotation.x += 0.05 * lively;
      chunk.rotation.z += 0.04 * lively;
      chunk.scale.setScalar(0.7 + Math.sin(elapsed * 2.2 + index) * 0.25);
    });
  }
}
