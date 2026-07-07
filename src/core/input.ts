// 输入状态收口：键盘与未来的虚拟摇杆都写到这里，也是测试注入的接缝
const keys = new Set<string>();
const pressed = new Set<string>();
let captured = false;
let suppressClicksUntil = 0;

// 聊天输入框等 UI 占用键盘时，游戏输入全部静默
export function setKeyCapture(on: boolean) {
  const wasCaptured = captured;
  captured = on;
  keys.clear();
  clearFramePresses();
  if (on) dragging = false;
  if (wasCaptured && !on) suppressClicksUntil = performance.now() + 120;
}

export function isKeyCaptured() {
  return captured;
}

export function initInput() {
  window.addEventListener("keydown", (event) => {
    if (captured) return;
    if (!event.repeat) pressed.add(event.code);
    keys.add(event.code);
    // 首个移动键也尝试锁定指针（键盘算用户手势；浏览器拒绝就静默留给点击路径）
    if (!event.repeat && (event.code === "KeyW" || event.code === "KeyA" || event.code === "KeyS" || event.code === "KeyD")) {
      tryPointerLock();
    }
  });
  window.addEventListener("keyup", (event) => keys.delete(event.code));
}

export function isDown(code: string) {
  return keys.has(code);
}

// 虚拟摇杆轴（触屏）：x=转向 -1..1，y=油门 -1..1（上推为负，遵循屏幕坐标）
let stickX = 0;
let stickY = 0;

export function setVirtualStick(x: number, y: number) {
  stickX = x;
  stickY = y;
}

export function getStick() {
  return { x: stickX, y: stickY };
}

// 触控按钮注入按键（等效敲一下键盘）
export function injectPress(code: string) {
  if (captured) return;
  pressed.add(code);
}

// 触控攻击按钮注入一次左键点击，复用步行攻击/劈箱逻辑。
export function injectClick() {
  if (captured || performance.now() < suppressClicksUntil) return;
  clickPending = true;
}

// 单次按键（边沿触发）：本帧内被消费一次即失效
export function consumePressed(code: string) {
  if (captured) {
    pressed.clear();
    return false;
  }
  const has = pressed.has(code);
  if (has) pressed.delete(code);
  return has;
}

let clickPending = false;
let dragging = false;
let suppressCurrentClick = false;
let dragDistance = 0;
let lastX = 0;
let lastY = 0;
let dragDX = 0;
let dragDY = 0;

export function initMouse() {
  window.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    if (captured) return;
    dragging = true;
    dragDistance = 0;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener("mousemove", (event) => {
    if (captured) return;
    // 指针锁定：鼠标移动直接转镜头（FPS 式），不需要按住拖拽
    if (isPointerLocked()) {
      dragDX += event.movementX;
      dragDY += event.movementY;
      return;
    }
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    dragDX += dx;
    dragDY += dy;
    dragDistance += Math.abs(dx) + Math.abs(dy);
  });
  window.addEventListener("mouseup", (event) => {
    if (event.button !== 0) return;
    if (suppressCurrentClick) {
      suppressCurrentClick = false;
      dragging = false;
      return;
    }
    if (captured || performance.now() < suppressClicksUntil) {
      dragging = false;
      return;
    }
    // 位移小于阈值算点击（攻击），否则是拖拽旋转镜头。
    // 锁定态下 dragDistance 不累计（移动进了镜头通道），点击永远算攻击。
    if (dragging && dragDistance < 6) clickPending = true;
    dragging = false;
  });
}

// ===== 指针锁定：进入游戏后鼠标隐藏，移动即转镜头，Esc 释放 =====
// 浏览器要求首次锁定必须来自用户手势：点击画布或首个 WASD 键触发。
let lockTarget: HTMLElement | null = null;
let lockAllowed: () => boolean = () => true;
let lockChangeCallback: (locked: boolean) => void = () => {};
// 锁定失败（权限受限/内核不支持）后停止尝试，回退拖拽模式且不再吞点击
let lockUnavailable = false;

export function isPointerLocked() {
  return lockTarget !== null && document.pointerLockElement === lockTarget;
}

function tryPointerLock() {
  if (!lockTarget || lockUnavailable || isPointerLocked() || captured || !lockAllowed()) return;
  // 返回 Promise 的新版 API 因权限/手势不足会 reject——标记不可用，留给拖拽模式
  const result = lockTarget.requestPointerLock() as unknown as Promise<void> | undefined;
  result?.catch(() => {
    lockUnavailable = true;
  });
}

export function initPointerLock(target: HTMLElement, allowed: () => boolean, onChange: (locked: boolean) => void) {
  lockTarget = target;
  lockAllowed = allowed;
  lockChangeCallback = onChange;
  target.addEventListener(
    "mousedown",
    (event) => {
      if (event.button !== 0 || lockUnavailable || isPointerLocked() || captured || !lockAllowed()) return;
      suppressCurrentClick = true;
      clickPending = false;
      tryPointerLock();
    },
    { capture: true },
  );
  target.addEventListener("click", () => {
    // 触屏/UI 打开/锁定不可用等场景直接放行，不干扰原有点击语义
    if (lockUnavailable || isPointerLocked() || captured || !lockAllowed()) return;
    tryPointerLock();
    // 获取锁定的那次点击不算攻击
    clickPending = false;
  });
  document.addEventListener("pointerlockchange", () => {
    lockChangeCallback(isPointerLocked());
  });
  document.addEventListener("pointerlockerror", () => {
    lockUnavailable = true;
  });
}

export function exitPointerLock() {
  if (isPointerLocked()) document.exitPointerLock();
}

// 左键单击（边沿触发），语义同 consumePressed；拖拽不算点击
export function consumeClick() {
  if (captured || performance.now() < suppressClicksUntil) {
    clickPending = false;
    return false;
  }
  const clicked = clickPending;
  clickPending = false;
  return clicked;
}

// 本帧鼠标拖拽增量（消费后清零），用于镜头旋转
export function consumeDrag() {
  if (captured) {
    dragDX = 0;
    dragDY = 0;
    return { dx: 0, dy: 0 };
  }
  const delta = { dx: dragDX, dy: dragDY };
  dragDX = 0;
  dragDY = 0;
  return delta;
}

// 每帧结尾清空未消费的按键/点击/拖拽，防止旧输入在之后的状态里误触发
export function clearFramePresses() {
  pressed.clear();
  clickPending = false;
  dragDX = 0;
  dragDY = 0;
}
