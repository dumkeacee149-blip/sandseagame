// 输入状态收口：键盘与未来的虚拟摇杆都写到这里，也是测试注入的接缝
const keys = new Set<string>();

export function initInput() {
  window.addEventListener("keydown", (event) => keys.add(event.code));
  window.addEventListener("keyup", (event) => keys.delete(event.code));
}

export function isDown(code: string) {
  return keys.has(code);
}
