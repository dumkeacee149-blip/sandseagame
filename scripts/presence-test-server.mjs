// 本地 presence 服务器：与 Cloudflare Worker 共用 presence-core 的协议逻辑。
// 用途：Playwright 多人测试（playwright.config.ts webServer）与本地双开联调。
// 用法：node scripts/presence-test-server.mjs   （PORT 环境变量可改端口，默认 8790）

import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { PresenceCore, TICK_MS } from "../workers/presence/presence-core.js";

const port = Number(process.env.PORT ?? 8790);
const rooms = new Map();

function getRoom(roomId) {
  const id = roomId || "default";
  let core = rooms.get(id);
  if (!core) {
    core = new PresenceCore();
    rooms.set(id, core);
  }
  return core;
}

setInterval(() => {
  for (const core of rooms.values()) core.tick();
}, TICK_MS);

const httpServer = createServer((request, response) => {
  response.writeHead(200, { "content-type": "text/plain" });
  response.end("Sandsea presence test server");
});

const wss = new WebSocketServer({ server: httpServer, path: "/presence" });

wss.on("connection", (socket, request) => {
  const url = new URL(request.url ?? "/presence", `http://127.0.0.1:${port}`);
  const core = getRoom(url.searchParams.get("room"));
  const conn = core.connect({
    send: (payload) => socket.send(payload),
    close: (code, reason) => socket.close(code, reason),
  });
  socket.on("message", (data) => conn.onMessage(data.toString()));
  socket.on("close", () => conn.onClose());
  socket.on("error", () => conn.onClose());
});

httpServer.listen(port, "127.0.0.1", () => {
  console.log(`presence test server: ws://127.0.0.1:${port}/presence`);
});
