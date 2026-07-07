import * as THREE from "three";
import { mat } from "../core/materials";
import { surfaceHeight } from "./sand";
import { CRAB_MAX_HP } from "../game/data";
import type { CrabAgent } from "../game/crab-ai";

// 沙蟹渲染：纯方块拼装（方块构造铁律），位置/朝向由 CrabAgent 驱动。
// 腿部横移蟹步用相位差 sin 摆动，死亡时瘪扁沉沙等待重生。

type CrabRigData = {
  legs: THREE.Mesh[];
  claws: THREE.Mesh[];
  hpCtx: CanvasRenderingContext2D | null;
  hpTexture: THREE.CanvasTexture | null;
  hpSprite: THREE.Sprite | null;
  lastHp: number;
};

function buildHpBar(rig: THREE.Group, data: CrabRigData) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 20;
  data.hpCtx = canvas.getContext("2d");
  data.hpTexture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: data.hpTexture, transparent: true, depthWrite: false }),
  );
  sprite.scale.set(28, 4.5, 1);
  sprite.position.y = 20;
  sprite.visible = false;
  data.hpSprite = sprite;
  rig.add(sprite);
}

function drawHpBar(data: CrabRigData, hp: number) {
  const ctx = data.hpCtx;
  if (!ctx || !data.hpTexture) return;
  ctx.clearRect(0, 0, 128, 20);
  ctx.fillStyle = "rgba(24, 14, 5, 0.82)";
  ctx.beginPath();
  ctx.roundRect(0, 0, 128, 20, 9);
  ctx.fill();
  const ratio = Math.max(0, hp / CRAB_MAX_HP);
  ctx.fillStyle = ratio > 0.5 ? "#c8442f" : "#ff6a3d";
  ctx.beginPath();
  ctx.roundRect(3, 3, 122 * ratio, 14, 6);
  ctx.fill();
  data.hpTexture.needsUpdate = true;
}

export function createCrab() {
  const rig = new THREE.Group();
  const data: CrabRigData = {
    legs: [],
    claws: [],
    hpCtx: null,
    hpTexture: null,
    hpSprite: null,
    lastHp: CRAB_MAX_HP,
  };
  rig.userData.crab = data;

  const shellMat = mat("crab-shell", "#b0512f");
  const limbMat = mat("crab-limb", "#8a3c22");
  const eyeMat = mat("crab-eye", "#1d1410");

  const body = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 10), shellMat);
  body.position.y = 6;
  rig.add(body);

  const back = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 7), shellMat);
  back.position.set(0, 9.5, -0.5);
  rig.add(back);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 1.6), eyeMat);
    eye.position.set(side * 3, 10, 5);
    rig.add(eye);

    const claw = new THREE.Mesh(new THREE.BoxGeometry(4, 3.4, 5), limbMat);
    claw.position.set(side * 9, 5, 5);
    rig.add(claw);
    data.claws.push(claw);

    for (let i = 0; i < 3; i += 1) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(6, 1.6, 1.6), limbMat);
      leg.position.set(side * 9.5, 3.2, 2.5 - i * 3.4);
      rig.add(leg);
      data.legs.push(leg);
    }
  }

  buildHpBar(rig, data);
  return rig;
}

export function updateCrab(rig: THREE.Group, agent: CrabAgent, elapsed: number) {
  const data = rig.userData.crab as CrabRigData;
  const dead = agent.mode === "dead";

  rig.position.x = agent.position.x;
  rig.position.z = agent.position.z;
  rig.rotation.y = agent.heading;

  const ground = surfaceHeight(agent.position.x, agent.position.z);
  const scuttle = agent.mode === "chase" ? 14 : agent.mode === "patrol" ? 7 : 0;
  rig.position.y = dead ? ground - 5 : ground + Math.abs(Math.sin(elapsed * scuttle)) * 1.2;
  // 死亡不隐藏：瘪扁半埋在沙里等待重生，玩家能看到"尸壳"
  rig.scale.y = dead ? 0.35 : 1;

  // 蟹步：六腿相位差摆动，攻击时双钳快速开合
  data.legs.forEach((leg, index) => {
    leg.rotation.z = dead ? 0 : Math.sin(elapsed * scuttle + index * 1.3) * 0.5;
  });
  const snip = agent.mode === "attack" ? Math.abs(Math.sin(elapsed * 16)) * 0.7 : 0;
  data.claws.forEach((claw, index) => {
    claw.rotation.x = dead ? 0.6 : -snip * (index === 0 ? 1 : 1.15);
  });

  if (data.hpSprite) {
    data.hpSprite.visible = !dead && agent.hp < CRAB_MAX_HP;
    if (agent.hp !== data.lastHp) {
      data.lastHp = agent.hp;
      drawHpBar(data, agent.hp);
    }
  }
}
