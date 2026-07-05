// Sandsea Privateers 全服聊天 Worker（Cloudflare Workers + Durable Objects）
// 部署: cd workers/chat && npx wrangler deploy
// 前端: 在 Pages 环境变量设 VITE_CHAT_WS_URL=wss://<worker域名>/chat

export class ChatRoom {
  constructor(state) {
    this.state = state;
    this.sessions = new Set();
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.sessions.add(server);

    server.addEventListener("message", (event) => {
      let parsed;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      const author = String(parsed.author ?? "Captain").slice(0, 24);
      const text = String(parsed.text ?? "").slice(0, 120).trim();
      if (!text) return;
      const payload = JSON.stringify({ author, text });
      for (const session of this.sessions) {
        try {
          session.send(payload);
        } catch {
          this.sessions.delete(session);
        }
      }
    });

    const close = () => this.sessions.delete(server);
    server.addEventListener("close", close);
    server.addEventListener("error", close);

    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/chat") {
      const room = env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName("global"));
      return room.fetch(request);
    }
    return new Response("Sandsea chat worker", { status: 200 });
  },
};
