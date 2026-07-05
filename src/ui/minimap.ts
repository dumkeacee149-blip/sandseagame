import type * as THREE from "three";
import { ISLANDS } from "../world/sand";
import { PORTS } from "../game/data";

// 右上角小地图：圆形羊皮纸航海图——罗盘刻度环、墨线岛屿、锚点港口、
// 黄铜船头箭标、沙虫红色警戒点。与"船长的航海桌"设计系统同语言。
const WORLD_EXTENT = 1420;

let ctx: CanvasRenderingContext2D | null = null;
let size = 168;

export function initMinimap() {
  const canvas = document.querySelector<HTMLCanvasElement>("#minimap");
  if (!canvas) return;
  size = canvas.width;
  ctx = canvas.getContext("2d");
}

function toMap(worldX: number, worldZ: number): [number, number] {
  // 圆形表盘：世界方形域映射进内接圆（留出罗盘环）
  const usable = size * 0.82;
  const offset = (size - usable) / 2;
  return [
    offset + ((worldX + WORLD_EXTENT) / (WORLD_EXTENT * 2)) * usable,
    offset + ((worldZ + WORLD_EXTENT) / (WORLD_EXTENT * 2)) * usable,
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
  const c = size / 2;

  ctx.clearRect(0, 0, size, size);

  // 圆形羊皮纸底
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, c - 1, 0, Math.PI * 2);
  ctx.clip();
  const paper = ctx.createRadialGradient(c, c * 0.8, size * 0.1, c, c, size * 0.72);
  paper.addColorStop(0, "#eee0ba");
  paper.addColorStop(0.75, "#e3d0a2");
  paper.addColorStop(1, "#cdb582");
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, size, size);

  // 淡墨经纬参考环
  ctx.strokeStyle = "rgba(107, 74, 28, 0.16)";
  ctx.lineWidth = 1;
  for (const radius of [0.22, 0.44, 0.66]) {
    ctx.beginPath();
    ctx.arc(c, c, c * radius * 1.24, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 岛屿：沙金色填充 + 墨线描边
  for (const isle of ISLANDS) {
    const [x, y] = toMap(isle.x, isle.z);
    const radius = ((isle.plateauRadius + isle.falloff * 0.5) / (WORLD_EXTENT * 2)) * size * 0.82;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#c8ab74";
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = "rgba(107, 74, 28, 0.75)";
    ctx.stroke();
  }

  // 港口：墨圈金芯锚点
  for (const port of PORTS) {
    const [x, y] = toMap(port.x, port.z);
    ctx.beginPath();
    ctx.arc(x, y, 3.4, 0, Math.PI * 2);
    ctx.fillStyle = "#8a6420";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = "#f3e2b4";
    ctx.fill();
  }

  // 沙虫：红点 + 扩散警戒圈
  {
    const [x, y] = toMap(wormPosition.x, wormPosition.z);
    const ripple = (elapsed % 1.6) / 1.6;
    ctx.beginPath();
    ctx.arc(x, y, 3 + ripple * 7, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(162, 55, 42, ${0.55 * (1 - ripple)})`;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#a2372a";
    ctx.fill();
  }

  // 船：黄铜箭标（墨描边）
  {
    const [x, y] = toMap(shipPosition.x, shipPosition.z);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI - shipHeading);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 4.5);
    ctx.lineTo(0, 2.4);
    ctx.lineTo(-4, 4.5);
    ctx.closePath();
    ctx.fillStyle = "#ecc06a";
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(58, 38, 12, 0.9)";
    ctx.stroke();
    ctx.restore();
  }

  // 步行中的小人：金点
  if (walking) {
    const [x, y] = toMap(playerPosition.x, playerPosition.z);
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = "#ffd678";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(58, 38, 12, 0.9)";
    ctx.stroke();
  }
  ctx.restore();

  // 罗盘刻度环（清晰的仪器边缘）
  ctx.beginPath();
  ctx.arc(c, c, c - 2, 0, Math.PI * 2);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = "rgba(107, 74, 28, 0.55)";
  ctx.stroke();
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2;
    const major = i % 4 === 0;
    const inner = c - (major ? 10 : 6);
    ctx.beginPath();
    ctx.moveTo(c + Math.sin(angle) * inner, c - Math.cos(angle) * inner);
    ctx.lineTo(c + Math.sin(angle) * (c - 3), c - Math.cos(angle) * (c - 3));
    ctx.lineWidth = major ? 2 : 1;
    ctx.strokeStyle = "rgba(107, 74, 28, 0.6)";
    ctx.stroke();
  }

  // 罗盘 N（船长字体）
  ctx.fillStyle = "#6b4a1c";
  ctx.font = `700 13px "Pirata One", Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", c, 15);
}
