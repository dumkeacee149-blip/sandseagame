import * as THREE from "three";
import "./styles.css";
import { palette } from "./core/palette";
import {
  initInput,
  initMouse,
  initPointerLock,
  isPointerLocked,
  exitPointerLock,
  isKeyCaptured,
  consumePressed,
  consumeClick,
  consumeDrag,
  clearFramePresses,
} from "./core/input";
import { initTouchControls } from "./core/touch";
import { getStick } from "./core/input";
import { hunyuanSlot } from "./core/models";
import { mat } from "./core/materials";
import { createTerrain } from "./world/sand";
import {
  createSkyDome,
  createSunAndMoons,
  createCloudBank,
  createSandLines,
  createWindParticles,
} from "./world/sky";
import {
  createOasisPort,
  createRuins,
  createSaltFlats,
  createSaltcrestCamp,
  createDistantCaravans,
  createSeaScatter,
  createDuneskullCamp,
  breakableCrates,
} from "./world/landmarks";
import { createWorm, updateWorm } from "./world/worm";
import { createMarketMarkers, updateMarkers } from "./world/markers";
import { shipState, updateShip, updateCamera, syncShipVisual } from "./game/ship-controller";
import {
  playerState,
  createPlayerAvatar,
  updatePlayer,
  updateWalkCamera,
  startAttack,
  applyOutfit,
} from "./game/player";
import { updateHud, updatePlayerHpChip } from "./ui/hud";
import { initControlsHint, updateControlsHint } from "./ui/controls-hint";
import { initQuests } from "./ui/quests";
import { initChat, postChatT } from "./ui/chat";
import { openTradePanel, closeTradePanel, isTradePanelOpen } from "./ui/trade-panel";
import { initMinimap, updateMinimap } from "./ui/minimap";
import { showModal, isModalOpen } from "./ui/modal";
import { showHeroSelect } from "./ui/hero-select";
import { hasChosenHero } from "./game/heroes";
import { getState, setState, subscribe, resetState } from "./game/store";
import * as economy from "./game/economy";
import { applyStranding, recordVisit, recordCrateBreak, openTreasure, findPort, dockAt, undock } from "./game/economy";
import { updateWormAi, wormAi, wormAgents, damageWorm, applySavedWormDeaths } from "./game/worm-ai";
import type { WormAgent } from "./game/worm-ai";
import { crabAgents, updateCrabAi, damageCrab, applySavedCrabDeaths } from "./game/crab-ai";
import { createCrab, updateCrab } from "./world/crab";
import { getPlayerHp, damagePlayer, resetPlayerHp, updatePlayerCombat } from "./game/player-combat";
import { save, load, clearSave } from "./game/save";
import { resolveIdentity } from "./core/wallet";
import { t, getLang, toggleLang, onLangChange, applyStaticI18n } from "./core/i18n";
import { gameAudio } from "./core/audio";
import { initPresence, presenceDebug } from "./net/presence";
import { initRemoteShips, updateRemoteShips } from "./net/remote-ships";
import {
  PORTS,
  TREASURE_X,
  TREASURE_Z,
  TREASURE_REWARD,
  STRAND_TOW_FEE,
  DOCK_RADIUS,
  HARPOON_RANGE,
  HARPOON_COOLDOWN,
  HARPOON_COST,
  WORM_BOUNTY,
  WORM_RESPAWN_SECONDS,
  WORM_SCALE_DROP_MIN,
  WORM_SCALE_DROP_MAX,
  CRAB_DAMAGE,
  WORM_PLAYER_DAMAGE,
  CRAB_BOUNTY,
  CRAB_RESPAWN_SECONDS,
  CRAB_CHITIN_DROP_MIN,
  CRAB_CHITIN_DROP_MAX,
  MELEE_RANGE,
  PLAYER_MAX_HP,
  getDerivedStats,
} from "./game/data";
import { createVoxelAsset } from "./voxel-assets";

const canvas = document.querySelector<HTMLCanvasElement>("#game");

if (!canvas) {
  throw new Error("Game canvas was not found.");
}

const searchParams = new URLSearchParams(window.location.search);
const captureMode = searchParams.has("capture");

// 画质默认全开；?lite=1 是卡顿设备的手动兜底（同时降渲染质量并保留体素占位模型）
const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
const liteMode = searchParams.get("lite") === "1";

// WebGL 创建失败兜底：老设备/被禁用 WebGL 时给出明确提示而不是白屏
function createRenderer(target: HTMLCanvasElement) {
  try {
    return new THREE.WebGLRenderer({
      canvas: target,
      antialias: !liteMode,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch (error) {
    const overlay = document.querySelector("#boot-overlay");
    if (overlay) {
      overlay.innerHTML = `<h2>Sandsea Privateers</h2><p style='animation:none;opacity:0.85'>${t("webgl.error")}</p>`;
    }
    throw error;
  }
}

const renderer = createRenderer(canvas);
// 触屏设备用较低渲染分辨率（填充率是移动端瓶颈）；lite 模式进一步降到 1x
renderer.setPixelRatio(liteMode ? 1 : Math.min(window.devicePixelRatio, coarsePointer ? 1.5 : 2));
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

const hemi = new THREE.HemisphereLight("#eaf4ff", "#8a6440", 2.1);
scene.add(hemi);

const sunLight = new THREE.DirectionalLight("#ffedc4", 4.6);
sunLight.position.set(-680, 850, -320);
scene.add(sunLight);

const rimLight = new THREE.DirectionalLight("#70f0e4", 1.45);
rimLight.position.set(460, 270, 700);
scene.add(rimLight);

// 世界构建：保持与拆分前完全一致的调用顺序（随机数序列不变，画面不变）
const { terrain } = createTerrain();
scene.add(terrain);
scene.add(createSkyDome());
scene.add(createSunAndMoons());
const cloudBank = createCloudBank();
scene.add(cloudBank);
scene.add(createSandLines());

const shipPlaceholder = createVoxelAsset("A01");
shipPlaceholder.scale.setScalar(9);
const ship = hunyuanSlot(shipPlaceholder, "/models/skiff.glb", Math.PI / 2, { liteOnTouch: true });
scene.add(ship);

scene.add(createOasisPort());
scene.add(createRuins());
scene.add(createSaltFlats());
scene.add(createSaltcrestCamp());
scene.add(createDuneskullCamp());
scene.add(createSeaScatter());
scene.add(createMarketMarkers());
// 三只沙虫：各守一块领地（worm-ai 的 wormAgents 一一对应）
const worms = wormAgents.map(() => {
  const rig = createWorm();
  scene.add(rig);
  return rig;
});
// 四只沙蟹：陆地近战，港口外围与遗迹岛（crab-ai 的 crabAgents 一一对应）
const crabs = crabAgents.map(() => {
  const rig = createCrab();
  scene.add(rig);
  return rig;
});
scene.add(createDistantCaravans());
const windParticles = createWindParticles();
scene.add(windParticles);

// 鱼叉炮视觉挂载：购置后出现在艉甲板（独立于船的换装槽，跟随船位与朝向）
const harpoonPlaceholder = createVoxelAsset("A09");
harpoonPlaceholder.scale.setScalar(4.6);
const harpoonMount = hunyuanSlot(harpoonPlaceholder, "/models/cannon.glb", 0, { liteOnTouch: true });
harpoonMount.visible = false;
scene.add(harpoonMount);

const harpoonOffset = new THREE.Vector3();

function syncHarpoonMount() {
  harpoonMount.visible = getState().harpoon;
  if (!harpoonMount.visible) return;
  const heading = shipState.heading;
  // 艉甲板局部偏移 (0, 15, -16) 旋转到世界系
  harpoonOffset.set(Math.sin(heading) * -14, 16, Math.cos(heading) * -14);
  harpoonMount.position.copy(ship.position).add(harpoonOffset);
  harpoonMount.rotation.y = heading;
}

// 玩家小人：航行时隐藏，下船后现身（贴近 ARRR 的上岸/上船切换）
const player = createPlayerAvatar();
player.visible = false;
scene.add(player);

type PlayMode = "sailing" | "walking";
let mode: PlayMode = "sailing";

const actionEl = document.querySelector("#action");

function setAction(text: string | null) {
  if (!actionEl) return;
  if (text) {
    actionEl.textContent = text;
    actionEl.classList.add("visible");
  } else {
    actionEl.classList.remove("visible");
  }
}

const dockProbe = new THREE.Vector3();

function findDockedPort() {
  for (const port of PORTS) {
    dockProbe.set(port.x, shipState.position.y, port.z);
    if (shipState.position.distanceTo(dockProbe) < DOCK_RADIUS) return port;
  }
  return null;
}

function goAshore() {
  const dock = findDockedPort();
  if (dock) {
    const beforeHull = getState().hull;
    setState(recordVisit(dockAt(getState(), dock.id), dock.id));
    if (getState().hull > beforeHull) {
      const portName = t(`port.${dock.id}`);
      showToast(t("toast.hullRepaired", { port: portName }));
      postChatT("npc.shipwright", "chat.hullRepaired", { port: { key: `port.${dock.id}` } });
    }
  }
  mode = "walking";
  playerState.position.set(
    shipState.position.x + Math.cos(shipState.heading) * 36,
    0,
    shipState.position.z - Math.sin(shipState.heading) * 36,
  );
  playerState.heading = shipState.heading;
  playerState.speed = 0;
  player.visible = true;
  gameAudio.play("dock");
}

function boardShip() {
  mode = "sailing";
  player.visible = false;
  setState(undock(getState()));
  save(getState(), shipSnapshot());
  gameAudio.play("board");
}

// 劈碎货箱的战利品直接进金库（+2 gold/箱）

function syncBrokenCrates() {
  const broken = new Set(getState().brokenCrateIds);
  for (const crate of breakableCrates) {
    const crateId = crate.userData.crateId;
    crate.visible = !crateId || !broken.has(crateId);
  }
}

type Splinter = { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number };
const splinters: Splinter[] = [];
const splinterGeometry = new THREE.BoxGeometry(3.4, 3.4, 3.4);

function spawnSplinters(origin: THREE.Vector3) {
  for (let i = 0; i < 6; i += 1) {
    const mesh = new THREE.Mesh(splinterGeometry, mat("crate", "#8a5a35"));
    mesh.position.copy(origin);
    scene.add(mesh);
    splinters.push({
      mesh,
      velocity: new THREE.Vector3(
        THREE.MathUtils.randFloatSpread(50),
        THREE.MathUtils.randFloat(40, 90),
        THREE.MathUtils.randFloatSpread(50),
      ),
      life: 0.9,
    });
  }
}

function updateSplinters(delta: number) {
  for (let i = splinters.length - 1; i >= 0; i -= 1) {
    const splinter = splinters[i];
    splinter.life -= delta;
    splinter.velocity.y -= 220 * delta;
    splinter.mesh.position.addScaledVector(splinter.velocity, delta);
    splinter.mesh.rotation.x += delta * 6;
    splinter.mesh.rotation.z += delta * 5;
    splinter.mesh.scale.setScalar(Math.max(splinter.life / 0.9, 0.01));
    if (splinter.life <= 0) {
      scene.remove(splinter.mesh);
      splinters.splice(i, 1);
    }
  }
}

// 受击提示（红色 toast，1.6s 自动消失）
const toastEl = document.createElement("div");
toastEl.className = "toast";
document.body.appendChild(toastEl);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(text: string) {
  toastEl.textContent = text;
  toastEl.classList.add("visible");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("visible"), 1600);
}

// 搁浅：结算惩罚 → 弹窗 → 在最后交易港重生
function strand() {
  const before = getState();
  setState(applyStranding(before));
  const port = findPort(before.lastPort);
  shipState.position.set(port.x, 0, port.z + 280);
  shipState.heading = Math.PI;
  shipState.speed = 0;
  shipState.targetSpeed = 0;
  mode = "sailing";
  player.visible = false;
  gameAudio.play("hurt", { volume: 1.2, rate: 0.82 });
  postChatT("npc.harbormaster", "strand.chat", { fee: STRAND_TOW_FEE });
  showModal({
    eyebrow: t("strand.eyebrow"),
    title: t("strand.title"),
    lines: [
      t("strand.l1"),
      t("strand.l2", { fee: STRAND_TOW_FEE }),
      t("strand.l3", { port: t(`port.${port.id}`) }),
    ],
    buttonText: t("strand.btn"),
  });
}

// ===== 鱼叉炮：航行模式的猎虫武器（门槛=船坞购置）=====
type HarpoonBolt = { mesh: THREE.Mesh; target: WormAgent };
const bolts: HarpoonBolt[] = [];
const boltGeometry = new THREE.BoxGeometry(2.2, 2.2, 15);
let harpoonCooldown = 0;
let noWeaponHintAt = -Infinity;

function fireHarpoon() {
  if (harpoonCooldown > 0) return;
  // 锁定射程内最近的存活沙虫
  let target: WormAgent | null = null;
  let best = HARPOON_RANGE;
  for (const agent of wormAgents) {
    if (agent.mode === "dead") continue;
    const d = Math.hypot(agent.position.x - shipState.position.x, agent.position.z - shipState.position.z);
    if (d < best) {
      best = d;
      target = agent;
    }
  }
  if (!target) {
    showToast(t("harpoon.noTarget"));
    gameAudio.play("uiError");
    harpoonCooldown = 0.3;
    return;
  }
  harpoonCooldown = HARPOON_COOLDOWN * getDerivedStats(getState()).harpoonCooldownMul;
  const mesh = new THREE.Mesh(boltGeometry, mat("harpoon-bolt", "#ecc06a"));
  mesh.position.copy(ship.position);
  mesh.position.y += 16;
  scene.add(mesh);
  bolts.push({ mesh, target });
  gameAudio.play("harpoon");
}

function updateBolts(delta: number) {
  for (let i = bolts.length - 1; i >= 0; i -= 1) {
    const bolt = bolts[i];
    const targetPos = bolt.target.position;
    const aim = new THREE.Vector3(targetPos.x, bolt.mesh.position.y, targetPos.z);
    const distance = bolt.mesh.position.distanceTo(aim);
    if (distance < 18 || bolt.target.mode === "dead") {
      scene.remove(bolt.mesh);
      bolts.splice(i, 1);
      if (bolt.target.mode !== "dead") {
        // 伤害/暴击走派生属性（装备与技能加成统一现算）
        const stats = getDerivedStats(getState());
        const crit = stats.harpoonCritChance > 0 && Math.random() < stats.harpoonCritChance;
        const died = damageWorm(bolt.target, stats.harpoonDamage * (crit ? 2 : 1));
        spawnSplinters(new THREE.Vector3(targetPos.x, bolt.mesh.position.y, targetPos.z));
        gameAudio.play("metalHit", { volume: crit ? 1.3 : 1, rate: crit ? 0.82 : 1 });
        if (died) {
          // 经济铁律：赏金极少，主产出是虫鳞（材料入舱，经贸易变现）
          const scaleQty = randInt(WORM_SCALE_DROP_MIN, WORM_SCALE_DROP_MAX);
          const { state: next, looted } = economy.recordWormKill(
            getState(),
            bolt.target.id,
            Date.now() + WORM_RESPAWN_SECONDS * 1000,
            scaleQty,
          );
          setState(next);
          const lootNote = looted < scaleQty ? t("worm.lootLost", { n: scaleQty - looted }) : "";
          showToast(t("worm.slain", { gold: WORM_BOUNTY, scales: looted, note: lootNote }));
          postChatT("npc.lookout", "worm.slainChat", { gold: WORM_BOUNTY, scales: looted });
          gameAudio.play("victory");
        } else {
          showToast(`${crit ? t("worm.crit") : ""}${t("worm.hit", { hp: bolt.target.hp })}`);
        }
      }
      continue;
    }
    bolt.mesh.lookAt(aim);
    bolt.mesh.position.addScaledVector(aim.sub(bolt.mesh.position).normalize(), Math.min(340 * delta, distance));
  }
}

function randInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

const hitProbe = new THREE.Vector3();
const crateWorldPos = new THREE.Vector3();
const marketProbe = new THREE.Vector3();
const treasureProbe = new THREE.Vector3(TREASURE_X, 0, TREASURE_Z);
let nextFootstepAt = 0;

function updateFootsteps(elapsed: number) {
  const speed = Math.abs(playerState.speed);
  if (!playerState.grounded || speed < 8) {
    nextFootstepAt = elapsed;
    return;
  }
  if (elapsed < nextFootstepAt) return;
  const stride = THREE.MathUtils.lerp(0.46, 0.28, THREE.MathUtils.clamp(speed / 62, 0, 1));
  nextFootstepAt = elapsed + stride;
  gameAudio.play("sandStep");
}

// 步行时最近的可交易集市（帐篷前 48 单位内）
function findNearbyMarket() {
  for (const port of PORTS) {
    marketProbe.set(port.marketX, player.position.y, port.marketZ);
    if (player.position.distanceTo(marketProbe) < 48) return port;
  }
  return null;
}

function tryBreakCrates() {
  hitProbe
    .set(Math.sin(playerState.heading), 0, Math.cos(playerState.heading))
    .multiplyScalar(18)
    .add(player.position);
  for (const crate of breakableCrates) {
    if (!crate.visible) continue;
    crate.getWorldPosition(crateWorldPos);
    if (crateWorldPos.distanceTo(hitProbe) < 24) {
      const crateId = crate.userData.crateId;
      if (!crateId) continue;
      const state = getState();
      const next = recordCrateBreak(state, crateId);
      if (next === state) {
        crate.visible = false;
        continue;
      }
      crate.visible = false;
      spawnSplinters(crateWorldPos);
      setState(next);
      gameAudio.play("crateBreak");
    }
  }
}

// 挥砍打蟹：与劈箱共用一次挥砍判定（同一刀既能劈箱也能砍蟹）
function tryHitCrabs() {
  hitProbe
    .set(Math.sin(playerState.heading), 0, Math.cos(playerState.heading))
    .multiplyScalar(18)
    .add(player.position);
  for (const agent of crabAgents) {
    if (agent.mode === "dead") continue;
    const distance = Math.hypot(agent.position.x - hitProbe.x, agent.position.z - hitProbe.z);
    if (distance > MELEE_RANGE) continue;
    const died = damageCrab(agent, getDerivedStats(getState()).meleeDamage);
    spawnSplinters(agent.position.clone().setY(8));
    gameAudio.play("metalHit", { volume: died ? 1.15 : 0.9 });
    if (died) {
      const chitinQty = randInt(CRAB_CHITIN_DROP_MIN, CRAB_CHITIN_DROP_MAX);
      const { state: next, looted } = economy.recordCrabKill(
        getState(),
        agent.id,
        Date.now() + CRAB_RESPAWN_SECONDS * 1000,
        chitinQty,
      );
      setState(next);
      showToast(t("crab.slain", { gold: CRAB_BOUNTY, loot: looted }));
      gameAudio.play("victory", { volume: 0.75 });
    } else {
      showToast(t("crab.hit", { hp: agent.hp }));
    }
  }
}

// 步行 HP 归零：拖回最后交易港的集市旁重生（材料不掉——岸战容错高于海战）
function playerDown() {
  const port = findPort(getState().lastPort);
  playerState.position.set(port.marketX + 24, 0, port.marketZ + 24);
  playerState.speed = 0;
  resetPlayerHp();
  gameAudio.play("hurt", { volume: 1.1, rate: 0.86 });
  postChatT("npc.harbormaster", "player.downChat");
  showToast(t("player.downToast"));
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

window.addEventListener("resize", onResize);
initInput();
initMouse();
initTouchControls();
initMinimap();
initQuests();
initChat();
initControlsHint();
// 指针锁定：点击画布/首个 WASD 键锁定（鼠标隐藏、移动即转镜头），Esc 释放。
// 触屏不适用；交易/弹窗/聊天占用时不允许锁定。锁定态提示由快捷键条每帧读取。
initPointerLock(
  canvas,
  () => !coarsePointer && !isModalOpen() && !isTradePanelOpen() && !isKeyCaptured(),
  () => {},
);
gameAudio.init();

// 鼠标拖拽旋转镜头（yaw 环绕 / pitch 俯仰），航行与步行共用
const cameraOrbit = { yaw: 0, pitch: 0 };

function updateCameraOrbit() {
  const drag = consumeDrag();
  cameraOrbit.yaw -= drag.dx * 0.006;
  cameraOrbit.pitch = THREE.MathUtils.clamp(cameraOrbit.pitch + drag.dy * 0.004, -0.18, 0.6);
}

function shipSnapshot() {
  return { x: shipState.position.x, z: shipState.position.z, heading: shipState.heading };
}

// ===== 双语 UI：静态文案套用 + 右上角语言切换按钮 =====
const langButton = document.querySelector<HTMLButtonElement>("#lang-toggle");

function syncLangButton() {
  // 按钮显示"目标语言"：英文界面上写"中文"，中文界面上写"EN"
  if (langButton) langButton.textContent = getLang() === "en" ? "中文" : "EN";
}

applyStaticI18n();
syncLangButton();
langButton?.addEventListener("click", () => {
  gameAudio.play("uiSelect");
  toggleLang();
});
onLangChange(syncLangButton);

// 启动流程：解析钱包身份（无登录门，访客直接玩）→ 载入该身份的存档 → 起引擎。
// 存档按身份隔离；之后每次状态变更（交易/任务奖励等离散事件）自动写入。
function startGame() {
  const savedGame = load();
  if (savedGame) {
    resetState(savedGame.state);
    shipState.position.set(savedGame.ship.x, 0, savedGame.ship.z);
    shipState.heading = savedGame.ship.heading;
  }
  syncBrokenCrates();
  applySavedWormDeaths(getState().enemyDeaths);
  applySavedCrabDeaths(getState().enemyDeaths);
  applyOutfit(getState().outfit);
  subscribe((state) => save(state, shipSnapshot()));

  // 试玩删档提示：常驻横幅（index.html）之外，开局在频道里再播报一次
  postChatT("npc.harbormaster", "trial.chat");

  initPresence(() => (mode === "walking" ? "walking" : "sailing"));

  // 同世界在线（可选叠加层）：未配置 presence 地址时是空操作
  initRemoteShips(scene);

  if (!captureMode) {
    renderer.setAnimationLoop(() => {
      animate();
      removeBootOverlay();
    });
  }
}

// 开发调试钩子：Playwright 冒烟测试与人工验收用，生产构建被 tree-shake
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__game = {
    teleport(x: number, z: number, heading?: number) {
      shipState.position.set(x, 0, z);
      if (heading !== undefined) shipState.heading = heading;
      shipState.speed = 0;
      shipState.targetSpeed = 0;
    },
    teleportPlayer(x: number, z: number, heading?: number) {
      playerState.position.set(x, 0, z);
      if (heading !== undefined) playerState.heading = heading;
      playerState.speed = 0;
    },
    getMode: () => mode,
    getPlayerY: () => playerState.position.y,
    getPlayerPos: () => ({ x: playerState.position.x, y: playerState.position.y, z: playerState.position.z }),
    getShipPos: () => ({ x: shipState.position.x, z: shipState.position.z }),
    getHarpoonCooldown: () => harpoonCooldown,
    getStick,
    getState,
    setState,
    goAshore,
    boardShip,
    clearSave,
    scene,
    economy,
    wormAi,
    crabAgents,
    damageCrab,
    getPlayerHp,
    getDerivedStats,
    presenceDebug,
    captureStep(delta = 1 / 60) {
      animate(delta);
      removeBootOverlay();
    },
  };
}

let captureElapsed = 0;

function animate(forcedDelta?: number) {
  const isCaptureStep = forcedDelta !== undefined;
  const delta = isCaptureStep ? forcedDelta : Math.min(clock.getDelta(), 0.05);
  const elapsed = isCaptureStep ? (captureElapsed += delta) : clock.elapsedTime;

  if (isModalOpen()) {
    // 结算弹窗期间世界暂停接收输入，只维持渲染（敌人 AI 也暂停，防背刺）
    clearFramePresses();
    worms.forEach((rig, index) => updateWorm(rig, wormAgents[index], elapsed, delta));
    crabs.forEach((rig, index) => updateCrab(rig, crabAgents[index], elapsed));
    gameAudio.update(delta, { mode, speed: shipState.speed, inMenu: true });
    updateHud(getState(), shipState.speed, ship.position);
    renderer.render(scene, camera);
    return;
  }

  // 沙虫 AI：攻击圈内的船与步行角色都会被持续追咬；
  // 咬中船→扣船壳掉货，耐久归零搁浅；咬中步行角色→扣角色 HP，归零倒地
  const bitten = updateWormAi(delta, mode === "sailing");
  if (bitten === "ship") {
    const remaining = getState().hull;
    gameAudio.play("hurt", { volume: 1.15, rate: 0.78 });
    showToast(t("worm.bite", { hull: remaining }));
    postChatT("npc.lookout", "worm.biteChat", { hull: remaining });
    if (remaining <= 0) strand();
  } else if (bitten === "player") {
    const remaining = damagePlayer(WORM_PLAYER_DAMAGE);
    gameAudio.play("hurt", { volume: 1.15, rate: 0.78 });
    showToast(t("worm.bitePlayer", { hp: remaining }));
    if (remaining <= 0) playerDown();
  }

  // 沙蟹 AI：只袭击步行中的船长（交易面板打开时视为在集市安全区）
  const crabWalking = mode === "walking" && !isTradePanelOpen();
  const pinches = updateCrabAi(delta, crabWalking);
  updatePlayerCombat(delta);
  if (pinches > 0) {
    const remaining = damagePlayer(CRAB_DAMAGE * pinches);
    gameAudio.play("hurt", { volume: Math.min(1.25, 0.8 + pinches * 0.2) });
    showToast(t("crab.pinch", { hp: remaining }));
    if (remaining <= 0) playerDown();
  }

  if (mode === "sailing") {
    updateShip(ship, delta, elapsed);
    updateCameraOrbit();
    updateCamera(camera, ship, delta, cameraOrbit);
    // 鱼叉炮：装备后航行中左键发射
    harpoonCooldown = Math.max(0, harpoonCooldown - delta);
    if (consumeClick()) {
      if (getState().harpoon) {
        fireHarpoon();
      } else if (elapsed - noWeaponHintAt > 4) {
        // 未装备武器时点击：指引去船坞购置（4s 节流防刷屏）
        noWeaponHintAt = elapsed;
        gameAudio.play("uiError");
        showToast(t("harpoon.notMounted", { cost: HARPOON_COST }));
      }
    }
    const canGoAshore = Math.abs(shipState.speed) < 8;
    setAction(canGoAshore ? t("action.ashore") : null);
    if (canGoAshore && consumePressed("KeyE")) goAshore();
  } else if (isTradePanelOpen()) {
    // 交易中：世界暂停接收输入，E/Esc 离开集市
    updateWalkCamera(camera, player, delta, cameraOrbit);
    if (consumePressed("KeyE") || consumePressed("Escape")) closeTradePanel();
  } else {
    updatePlayer(player, delta, elapsed, ship.position);
    updateFootsteps(elapsed);
    updateCameraOrbit();
    updateWalkCamera(camera, player, delta, cameraOrbit);
    if (consumeClick() && startAttack()) {
      gameAudio.play("attack");
      tryBreakCrates();
      tryHitCrabs();
    }
    const market = findNearbyMarket();
    const nearShip = player.position.distanceTo(ship.position) < 60;
    const state = getState();
    const nearTreasure =
      state.mapPurchased &&
      !state.completed &&
      player.position.distanceTo(treasureProbe) < 45;
    setAction(
      nearTreasure
        ? t("action.chest")
        : market
          ? t("action.trade", { port: t(`port.${market.id}`) })
          : nearShip
            ? t("action.board")
            : null,
    );
    if (nearTreasure && consumePressed("KeyE")) {
      setState(openTreasure(state));
      gameAudio.play("treasure");
      postChatT("npc.harbormaster", "treasure.chat");
      showModal({
        eyebrow: t("treasure.eyebrow"),
        title: t("treasure.title"),
        lines: [t("treasure.l1"), t("treasure.l2", { gold: TREASURE_REWARD }), t("treasure.l3")],
        buttonText: t("treasure.btn"),
      });
    } else if (market && consumePressed("KeyE")) {
      playerState.speed = 0;
      setAction(null);
      setState(recordVisit(getState(), market.id));
      openTradePanel(market.id);
    } else if (nearShip && consumePressed("KeyE")) {
      boardShip();
    }
  }
  clearFramePresses();

  // 步行/交易模式下船不受控但仍要贴地并停在逻辑位置（航行模式下等价于重复赋值）
  syncShipVisual(ship, elapsed);
  updateRemoteShips(elapsed);
  syncHarpoonMount();
  updateSplinters(delta);
  updateBolts(delta);
  worms.forEach((rig, index) => updateWorm(rig, wormAgents[index], elapsed, delta));
  crabs.forEach((rig, index) => updateCrab(rig, crabAgents[index], elapsed));
  updateMarkers(elapsed);
  cloudBank.position.x = Math.sin(elapsed * 0.03) * 30;
  windParticles.position.x = ((elapsed * 48) % 900) - 450;
  windParticles.position.z = Math.sin(elapsed * 0.4) * 18;
  updateHud(getState(), shipState.speed, ship.position);
  updatePlayerHpChip(getPlayerHp(), PLAYER_MAX_HP, mode === "walking");
  // UI 面板打开时释放指针锁定（玩家需要光标点按钮）
  if (isPointerLocked() && (isModalOpen() || isTradePanelOpen() || isKeyCaptured())) {
    exitPointerLock();
  }
  updateControlsHint(mode, getState().harpoon, coarsePointer ? "none" : isPointerLocked() ? "locked" : "free");
  updateMinimap(ship.position, shipState.heading, player.position, mode === "walking", wormAgents, elapsed);
  gameAudio.update(delta, {
    mode,
    speed: shipState.speed,
    inMenu: isTradePanelOpen(),
    danger:
      bitten !== null ||
      pinches > 0 ||
      wormAgents.some((agent) => agent.mode === "chase" || agent.mode === "bite") ||
      crabAgents.some((agent) => agent.mode === "chase" || agent.mode === "attack"),
  });
  renderer.render(scene, camera);
}

// 首帧渲染完成后移除 Loading 覆盖层
let bootOverlayRemoved = false;
function removeBootOverlay() {
  if (bootOverlayRemoved) return;
  bootOverlayRemoved = true;
  const overlay = document.querySelector<HTMLElement>("#boot-overlay");
  if (overlay) {
    overlay.style.opacity = "0";
    setTimeout(() => overlay.remove(), 420);
  }
  // 首次进游戏先选船长；Playwright（webdriver）下跳过以免挡住自动化用例
  if (!hasChosenHero() && !navigator.webdriver) {
    showHeroSelect();
  }
}

resolveIdentity().then(startGame);
