import * as THREE from "three";
import type { GameState } from "../game/data";
import { cargoCapacity, cargoCount, PORTS } from "../game/data";

// 启动时缓存一次 DOM 引用，避免每帧 querySelector
const speedEl = document.querySelector("#speed");
const goldEl = document.querySelector("#gold");
const cargoEl = document.querySelector("#cargo");
const hullEl = document.querySelector("#hull");
const routeEl = document.querySelector("#route");

const portProbe = new THREE.Vector3();

export function updateHud(state: GameState, shipSpeed: number, shipPosition: THREE.Vector3) {
  if (speedEl) speedEl.textContent = Math.round(Math.abs(shipSpeed) * 0.44).toString();
  if (goldEl) goldEl.textContent = state.gold.toString();
  if (cargoEl) cargoEl.textContent = `${cargoCount(state)}/${cargoCapacity(state)}`;
  if (hullEl) hullEl.textContent = state.hull.toString();

  if (routeEl) {
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
