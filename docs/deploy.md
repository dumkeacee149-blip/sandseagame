# 部署手册 — Cloudflare Pages + 聊天 Worker

## 一、游戏本体（Cloudflare Pages）

前置：Cloudflare 账号 + 你的域名已托管在 Cloudflare（或至少 DNS 可指向）。

1. 把仓库推到 GitHub（私有仓库也可以）。
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → 连接该仓库。
3. 构建设置：
   - Build command: `npm run build`
   - Build output directory: `dist`
4. 部署完成后 → Custom domains → 绑定你的域名（如 `play.你的域名.com`）。
   国内访问依赖自定义域名走 Cloudflare CDN；默认的 `*.pages.dev` 在国内不可靠。
5. 缓存策略已由 `public/_headers` 声明，无需额外配置。

本地验证生产构建：`npm run build && npm run preview`。

## 二、全服聊天（Cloudflare Worker，可选）

不部署也不影响游戏——聊天自动运行在本地模式（NPC + 系统播报）。

1. `cd workers/chat && npx wrangler deploy`（首次会引导登录 Cloudflare）。
   需要 Durable Objects（Workers 免费计划已含 SQLite-backed DO 额度）。
2. 记下 Worker 域名，例如 `sandsea-chat.<你的子域>.workers.dev`。
3. Pages 项目 → Settings → Environment variables 添加：
   `VITE_CHAT_WS_URL = wss://sandsea-chat.<你的子域>.workers.dev/chat`
4. 重新部署 Pages。聊天面板徽章会从 LOCAL 变为 GLOBAL。

注意：当前聊天为最小实现（无鉴权/无持久化/昵称固定 Captain），
公开上线后如出现滥用，再加限流与昵称系统。

## 三、同世界在线（Cloudflare Worker，可选）

不部署也不影响游戏——保持纯单机。部署后所有玩家进入同一个世界，
实时看到彼此的船（P0：互见 + 名牌，无碰撞）。方案详见
[multiplayer-sync-plan.md](./multiplayer-sync-plan.md)。

1. `cd workers/presence && npx wrangler deploy`（同聊天 Worker，需要 Durable Objects）。
2. Pages 项目 → Settings → Environment variables 添加：
   `VITE_PRESENCE_WS_URL = wss://sandsea-presence.<你的子域>.workers.dev/presence`
3. 重新部署 Pages。进入游戏后聊天会播报 "You've entered the shared sandsea"。

本地联调（不用部署）：`node scripts/presence-test-server.mjs` 起本地服务器，
浏览器开两个标签访问 `http://127.0.0.1:5180/?presence=ws%3A%2F%2F127.0.0.1%3A8790%2Fpresence&pid=a`
（第二个标签 `pid=b`），即可互见。协议逻辑在 `workers/presence/presence-core.js`，
本地服务器与线上 Worker 共用这份代码。

规则：一钱包一船——同一钱包重复连接会踢掉旧会话；房间上限 32 人；
15 秒无心跳自动离场。位置为客户端上报（服务器只做 clamp 与限流），
任何有经济意义的互动上线前必须升级服务器权威 + 签名登录。

## 四、发布前检查单

- [ ] `npm test` 全绿（冒烟 + 多人互见用例）
- [ ] `npm run build` 通过且 `dist/` 无 asset-viewer
- [ ] 产物体积合理（`du -sh dist` ≈ 8MB，其中模型 5MB 按需异步加载）
- [ ] 手机真机（iOS Safari / Android Chrome）：摇杆、按钮、帧率
- [ ] 完整通关一遍核对数值（30-45 分钟）
- [ ] `git tag v1.0` 并推送
