import * as THREE from "three";
import { PORTS } from "../game/data";
import { surfaceHeight } from "./sand";

// 集市上空的悬浮标识牌：canvas 文字 Sprite（始终面向相机），远处也能看清哪里能交易

function createLabelSprite(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 144;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const radius = 40;
    ctx.fillStyle = "rgba(22, 16, 11, 0.88)";
    ctx.beginPath();
    ctx.roundRect(8, 8, canvas.width - 16, canvas.height - 16, radius);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(255, 214, 120, 0.9)";
    ctx.stroke();
    ctx.font = "bold 72px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffd678";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  sprite.scale.set(64, 18, 1);
  return sprite;
}

const bobbers: THREE.Object3D[] = [];

export function createMarketMarkers() {
  const group = new THREE.Group();
  for (const port of PORTS) {
    const marker = new THREE.Group();
    const label = createLabelSprite("⚖ MARKET");
    marker.add(label);

    // 牌下的金色指向方块（旋转动画让它更显眼）
    const gem = new THREE.Mesh(
      new THREE.BoxGeometry(6, 6, 6),
      new THREE.MeshBasicMaterial({ color: "#ffd678" }),
    );
    gem.position.y = -14;
    gem.name = "marker-gem";
    marker.add(gem);

    marker.position.set(
      port.marketX,
      surfaceHeight(port.marketX, port.marketZ) + 58,
      port.marketZ,
    );
    bobbers.push(marker);
    group.add(marker);
  }
  return group;
}

export function updateMarkers(elapsed: number) {
  bobbers.forEach((marker, index) => {
    const baseY = marker.userData.baseY ?? (marker.userData.baseY = marker.position.y);
    marker.position.y = baseY + Math.sin(elapsed * 1.6 + index) * 3;
    const gem = marker.getObjectByName("marker-gem");
    if (gem) {
      gem.rotation.y = elapsed * 1.8;
      gem.rotation.x = Math.PI / 5;
    }
  });
}
