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

export function initMouse() {
  window.addEventListener("mousedown", (event) => {
    if (event.button === 0) clickPending = true;
  });
}

// 左键单击（边沿触发），语义同 consumePressed
export function consumeClick() {
  const clicked = clickPending;
  clickPending = false;
  return clicked;
}

// 每帧结尾清空未消费的按键/点击，防止旧输入在之后的状态里误触发
export function clearFramePresses() {
  pressed.clear();
  clickPending = false;
}
