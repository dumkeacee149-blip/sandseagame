import { setVirtualStick, injectPress } from "./input";

// 触屏控制：零依赖虚拟摇杆 + 动作/跳跃按钮（Pointer Events）。
// 仅在触屏设备启用；?touch=1 可在桌面强开调试。
const STICK_RADIUS = 44;
const DEAD_ZONE = 0.16;

export function shouldEnableTouch() {
  if (new URLSearchParams(location.search).get("touch") === "1") return true;
  return window.matchMedia("(pointer: coarse)").matches;
}

export function initTouchControls() {
  if (!shouldEnableTouch()) return;
  document.body.classList.add("touch-mode");

  // 摇杆：左下角
  const pad = document.createElement("div");
  pad.className = "touch-stick";
  const thumb = document.createElement("div");
  thumb.className = "touch-stick-thumb";
  pad.appendChild(thumb);
  document.body.appendChild(pad);

  let activePointer: number | null = null;

  const updateThumb = (dx: number, dy: number) => {
    thumb.style.translate = `${dx}px ${dy}px`;
  };

  pad.addEventListener("pointerdown", (event) => {
    activePointer = event.pointerId;
    pad.setPointerCapture(event.pointerId);
  });
  pad.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointer) return;
    const rect = pad.getBoundingClientRect();
    let dx = event.clientX - (rect.left + rect.width / 2);
    let dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    if (length > STICK_RADIUS) {
      dx = (dx / length) * STICK_RADIUS;
      dy = (dy / length) * STICK_RADIUS;
    }
    updateThumb(dx, dy);
    const nx = dx / STICK_RADIUS;
    const ny = dy / STICK_RADIUS;
    setVirtualStick(
      Math.abs(nx) < DEAD_ZONE ? 0 : nx,
      Math.abs(ny) < DEAD_ZONE ? 0 : ny,
    );
  });
  const releaseStick = (event: PointerEvent) => {
    if (event.pointerId !== activePointer) return;
    activePointer = null;
    updateThumb(0, 0);
    setVirtualStick(0, 0);
  };
  pad.addEventListener("pointerup", releaseStick);
  pad.addEventListener("pointercancel", releaseStick);

  // 动作按钮：右下角（E=互动 / 跳跃）
  const makeButton = (label: string, className: string, code: string) => {
    const button = document.createElement("button");
    button.className = `touch-button ${className}`;
    button.textContent = label;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      injectPress(code);
    });
    document.body.appendChild(button);
    return button;
  };
  makeButton("E", "touch-button-action", "KeyE");
  makeButton("▲", "touch-button-jump", "Space");
}
