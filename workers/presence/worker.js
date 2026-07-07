// Sandsea Privateers 同世界在线 Worker（Cloudflare Workers + Durable Objects）
// 部署: cd workers/presence && npx wrangler deploy
// 前端: 在 Pages 环境变量设 VITE_PRESENCE_WS_URL=wss://<worker域名>/presence
// 协议与房间逻辑在 presence-core.js（与本地测试服务器共用）。

import { PresenceCore, TICK_MS } from "./presence-core.js";

export class PresenceRoom {
  constructor() {
    this.core = new PresenceCore({ requireSignedWallets: true });
    // DO 在有活跃 WebSocket 时常驻，10Hz tick 随实例生命周期运行
    setInterval(() => this.core.tick(), TICK_MS);
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const conn = this.core.connect({
      send: (payload) => server.send(payload),
      close: (code, reason) => server.close(code, reason),
    });
    server.addEventListener("message", (event) => conn.onMessage(event.data));
    server.addEventListener("close", () => conn.onClose());
    server.addEventListener("error", () => conn.onClose());

    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/presence") {
      // 生产当前有意固定到 global 单房；本地测试服务器才读取 ?room 做测试隔离。
      const room = env.PRESENCE_ROOM.get(env.PRESENCE_ROOM.idFromName("global"));
      return room.fetch(request);
    }
    return new Response("Sandsea presence worker", { status: 200 });
  },
};
