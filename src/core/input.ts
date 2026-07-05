// 输入状态收口：键盘与未来的虚拟摇杆都写到这里，也是测试注入的接缝
const keys = new Set<string>();
const pressed = new Set<string>();

export function initInput() {
  window.addEventListener("keydown", (event) => {
    if (!event.repeat) pressed.add(event.code);
    keys.add(event.code);
  });
  window.addEventListener("keyup", (event) => keys.delete(event.code));
}

export function isDown(code: string) {
  return keys.has(code);
}

// 单次按键（边沿触发）：本帧内被消费一次即失效
export function consumePressed(code: string) {
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
    dragging = true;
    dragDistance = 0;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener("mousemove", (event) => {
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
    // 位移小于阈值算点击（攻击），否则是拖拽旋转镜头
    if (dragging && dragDistance < 6) clickPending = true;
    dragging = false;
  });
}

// 左键单击（边沿触发），语义同 consumePressed；拖拽不算点击
export function consumeClick() {
  const clicked = clickPending;
  clickPending = false;
  return clicked;
}

// 本帧鼠标拖拽增量（消费后清零），用于镜头旋转
export function consumeDrag() {
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
