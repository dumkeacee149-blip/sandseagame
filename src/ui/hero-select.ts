// 选船长面板：首次进游戏弹出，实时 3D 转台预览（Idle 动画），选定持久化。
// 更衣室内换人走同一套 setHero，本面板只负责"第一次的仪式感"。
import * as THREE from "three";
import { loadRiggedModel } from "../core/models";
import { HERO_IDS, type HeroId, heroModelUrl, getSelectedHero, setSelectedHero } from "../game/heroes";
import { setHero, stripHeroProps } from "../game/player";
import { t, onLangChange } from "../core/i18n";

const PREVIEW_WIDTH = 250;
const PREVIEW_HEIGHT = 280;
const PREVIEW_MODEL_HEIGHT = 2;
const TURNTABLE_SPEED = 0.7;

export function showHeroSelect(onDone?: (hero: HeroId) => void) {
  const overlay = document.createElement("div");
  overlay.className = "hero-select-overlay";
  overlay.innerHTML = `
    <div class="trade-panel hero-select-panel">
      <p class="trade-eyebrow">Sandsea Privateers</p>
      <p class="modal-title">${t("hero.title")}</p>
      <canvas class="hero-select-canvas" width="${PREVIEW_WIDTH}" height="${PREVIEW_HEIGHT}"></canvas>
      <div class="hero-select-chips">
        ${HERO_IDS.map(
          (hero) =>
            `<button class="hero-chip" data-hero="${hero}">${t(`hero.${hero}`)}</button>`,
        ).join("")}
      </div>
      <p class="modal-line">${t("hero.hint")}</p>
      <button class="modal-button hero-select-confirm">${t("hero.confirm")}</button>
    </div>`;
  // 面板下的世界还在跑，别让点击漏到 window 的攻击/镜头监听上
  for (const type of ["mousedown", "mouseup", "click", "pointerdown", "pointerup"]) {
    overlay.addEventListener(type, (event) => event.stopPropagation());
  }
  document.body.appendChild(overlay);

  const canvas = overlay.querySelector<HTMLCanvasElement>(".hero-select-canvas");
  if (!canvas) return;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(PREVIEW_WIDTH, PREVIEW_HEIGHT, false);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, PREVIEW_WIDTH / PREVIEW_HEIGHT, 0.1, 20);
  camera.position.set(0, 1.05, 3.6);
  camera.lookAt(0, 0.95, 0);
  scene.add(new THREE.HemisphereLight(0xfff2d8, 0x6b5433, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const stage = new THREE.Group();
  scene.add(stage);

  let previewMixer: THREE.AnimationMixer | null = null;
  let previewToken = 0;
  let selected: HeroId = getSelectedHero();

  // 预览用独立小 fit：按绑定姿态几何包围盒归一到固定身高、脚底贴 y=0
  function fitPreview(model: THREE.Object3D) {
    let box: THREE.Box3 | null = null;
    model.traverse((child) => {
      const mesh = child as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh) {
        mesh.geometry.computeBoundingBox();
        const bounds = mesh.geometry.boundingBox;
        if (bounds) box = box ? box.union(bounds) : bounds.clone();
      }
    });
    if (!box) return;
    const bounds = box as THREE.Box3;
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = PREVIEW_MODEL_HEIGHT / size.y;
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  }

  function loadPreview(hero: HeroId) {
    const token = ++previewToken;
    loadRiggedModel(heroModelUrl(hero))
      .then(({ scene: model, animations }) => {
        if (token !== previewToken) return;
        stripHeroProps(model, hero);
        fitPreview(model);
        stage.clear();
        stage.add(model);
        previewMixer = new THREE.AnimationMixer(model);
        const idle = animations.find((clip) => clip.name === "Idle");
        if (idle) previewMixer.clipAction(idle).play();
      })
      .catch((error) => {
        console.error("船长预览加载失败", error);
      });
  }

  function markActive() {
    overlay.querySelectorAll<HTMLButtonElement>(".hero-chip").forEach((chip) => {
      chip.classList.toggle("hero-chip-active", chip.dataset.hero === selected);
    });
  }

  // 面板打开期间切换语言：标题/提示/按钮/角色名整体重译
  function refreshTexts() {
    const title = overlay.querySelector(".modal-title");
    if (title) title.textContent = t("hero.title");
    const hint = overlay.querySelector(".modal-line");
    if (hint) hint.textContent = t("hero.hint");
    const confirm = overlay.querySelector(".hero-select-confirm");
    if (confirm) confirm.textContent = t("hero.confirm");
    overlay.querySelectorAll<HTMLButtonElement>(".hero-chip").forEach((chip) => {
      chip.textContent = t(`hero.${chip.dataset.hero}`);
    });
  }
  const offLangChange = onLangChange(refreshTexts);

  overlay.querySelectorAll<HTMLButtonElement>(".hero-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      selected = chip.dataset.hero as HeroId;
      markActive();
      loadPreview(selected);
    });
  });

  const clock = new THREE.Clock();
  let rafId = 0;
  function tick() {
    const delta = clock.getDelta();
    stage.rotation.y += delta * TURNTABLE_SPEED;
    previewMixer?.update(delta);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }

  overlay.querySelector<HTMLButtonElement>(".hero-select-confirm")?.addEventListener(
    "click",
    () => {
      cancelAnimationFrame(rafId);
      renderer.dispose();
      offLangChange();
      overlay.remove();
      setSelectedHero(selected);
      setHero(selected);
      onDone?.(selected);
    },
    { once: true },
  );

  markActive();
  loadPreview(selected);
  tick();
}
