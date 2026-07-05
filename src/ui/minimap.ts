import type * as THREE from "three";
import { ISLANDS } from "../world/sand";
import { PORTS } from "../game/data";

// 右上角小地图：世界 ±1420 映射到画布，帧率驱动重绘（绘制量极小）
const WORLD_EXTENT = 1420;

let ctx: CanvasRenderingContext2D | null = null;
let size = 150;

export function initMinimap() {
  const canvas = document.querySelector<HTMLCanvasElement>("#minimap");
  if (!canvas) return;
  size = canvas.width;
  ctx = canvas.getContext("2d");
}

function toMap(worldX: number, worldZ: number): [number, number] {
  return [
    ((worldX + WORLD_EXTENT) / (WORLD_EXTENT * 2)) * size,
    ((worldZ + WORLD_EXTENT) / (WORLD_EXTENT * 2)) * size,
  ];
}

export function updateMinimap(
  shipPosition: THREE.Vector3,
  shipHeading: number,
  playerPosition: THREE.Vector3,
  walking: boolean,
  wormPosition: THREE.Vector3,
  elapsed: number,
) {
  if (!ctx) return;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "rgba(214, 178, 110, 0.92)";
  ctx.fillRect(0, 0, size, size);

  // 岛屿
  for (const isle of ISLANDS) {
    const [x, y] = toMap(isle.x, isle.z);
    const radius = ((isle.plateauRadius + isle.falloff * 0.5) / (WORLD_EXTENT * 2)) * size;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(133, 112, 72, 0.95)";
    ctx.fill();
  }

  // 港口标记
  for (const port of PORTS) {
    const [x, y] = toMap(port.x, port.z);
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = "#5df08d";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(20, 40, 24, 0.8)";
    ctx.stroke();
  }

  // 沙虫：脉冲红点（危险信号）
  {
    const [x, y] = toMap(wormPosition.x, wormPosition.z);
    const pulse = 3 + Math.sin(elapsed * 4) * 1.2;
    ctx.beginPath();
    ctx.arc(x, y, pulse, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(214, 58, 46, 0.9)";
    ctx.fill();
  }

  // 船：朝向三角
  {
    const [x, y] = toMap(shipPosition.x, shipPosition.z);
    ctx.save();
    ctx.translate(x, y);
    // 世界 +z 朝下、heading 0 = +z：画布旋转取反再补 π
    ctx.rotate(Math.PI - shipHeading);
    ctx.beginPath();
    ctx.moveTo(0, -5.5);
    ctx.lineTo(3.6, 4);
    ctx.lineTo(-3.6, 4);
    ctx.closePath();
    ctx.fillStyle = "#fff6dd";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(40, 28, 12, 0.85)";
    ctx.stroke();
    ctx.restore();
  }

  // 步行中的小人：金色圆点
  if (walking) {
    const [x, y] = toMap(playerPosition.x, playerPosition.z);
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd75e";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(60, 40, 10, 0.9)";
    ctx.stroke();
  }

  // 罗盘 N
  ctx.fillStyle = "rgba(40, 28, 12, 0.75)";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.fillText("N", size - 14, 14);
}
