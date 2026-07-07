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
    if (!dragging || captured) return;
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
    if (captured || performance.now() < suppressClicksUntil) {
      dragging = false;
      return;
    }
    // 位移小于阈值算点击（攻击），否则是拖拽旋转镜头
    if (dragging && dragDistance < 6) clickPending = true;
    dragging = false;
  });
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
