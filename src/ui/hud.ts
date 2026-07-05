import * as THREE from "three";

// 启动时缓存一次 DOM 引用，避免每帧 querySelector
const speedEl = document.querySelector("#speed");
const cargoEl = document.querySelector("#cargo");
const windEl = document.querySelector("#wind");
const routeEl = document.querySelector("#route");

export function updateHud(shipSpeed: number, elapsed: number, shipPosition: THREE.Vector3) {
  if (speedEl) speedEl.textContent = Math.round(Math.abs(shipSpeed) * 0.44).toString();
  if (cargoEl) cargoEl.textContent = `${12 + Math.round(Math.sin(elapsed * 0.3) * 2)}`;
  if (windEl) windEl.textContent = elapsed % 18 > 9 ? "SE" : "NE";

  if (routeEl) {
    const nearOasis = shipPosition.distanceTo(new THREE.Vector3(-520, shipPosition.y, -380)) < 340;
    const nearRuins = shipPosition.distanceTo(new THREE.Vector3(650, shipPosition.y, 280)) < 360;
    routeEl.textContent = nearOasis
      ? "Oasis Port / Brass Market / Palm Quay"
      : nearRuins
        ? "Sunken Gate / Obsidian Columns / Rune Vault"
        : "Glass Dunes / Salt Flats / Wind Road";
  }
}
