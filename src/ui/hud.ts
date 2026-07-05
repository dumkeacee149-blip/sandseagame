import * as THREE from "three";
import type { GameState } from "../game/data";
import { cargoCapacity, cargoCount, maxHull, PORTS, TREASURE_X, TREASURE_Z } from "../game/data";

// 方位角转罗盘文字（世界 +z 为北）
function bearingLabel(dx: number, dz: number) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const angle = Math.atan2(dx, dz);
  const index = Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  return dirs[index];
}

// 启动时缓存一次 DOM 引用，避免每帧 querySelector
const speedEl = document.querySelector("#speed");
const goldEl = document.querySelector("#gold");
const cargoEl = document.querySelector("#cargo");
const hullEl = document.querySelector("#hull");
const hullChipEl = hullEl?.closest(".stat-hull") ?? null;
const routeEl = document.querySelector("#route");

const portProbe = new THREE.Vector3();

export function updateHud(state: GameState, shipSpeed: number, shipPosition: THREE.Vector3) {
  if (speedEl) speedEl.textContent = Math.round(Math.abs(shipSpeed) * 0.44).toString();
  if (goldEl) goldEl.textContent = state.gold.toString();
  if (cargoEl) cargoEl.textContent = `${cargoCount(state)}/${cargoCapacity(state)}`;
  if (hullEl) hullEl.textContent = state.hull.toString();
  // 耐久低于 40% 红色脉冲告警
  if (hullChipEl) hullChipEl.classList.toggle("hull-low", state.hull < maxHull(state) * 0.4);

  if (routeEl) {
    // 买了藏宝图且未通关：导航条变成宝藏罗盘（不画图，一行字就是罗盘）
    if (state.mapPurchased && !state.completed) {
      const dx = TREASURE_X - shipPosition.x;
      const dz = TREASURE_Z - shipPosition.z;
      routeEl.textContent = `Relic Vault · ${bearingLabel(dx, dz)} · ${Math.round(Math.hypot(dx, dz))}m`;
      return;
    }
    let nearest = "Open Sandsea";
    let nearestDistance = Infinity;
    for (const port of PORTS) {
      portProbe.set(port.x, shipPosition.y, port.z);
      const distance = shipPosition.distanceTo(portProbe);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = distance < 340 ? port.name : `${port.name} · ${Math.round(distance)}m`;
      }
    }
    routeEl.textContent = nearest;
  }
}
