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

## 三、发布前检查单

- [ ] `npm test` 冒烟测试 4/4 通过
- [ ] `npm run build` 通过且 `dist/` 无 asset-viewer
- [ ] 产物体积合理（`du -sh dist` ≈ 8MB，其中模型 5MB 按需异步加载）
- [ ] 手机真机（iOS Safari / Android Chrome）：摇杆、按钮、帧率
- [ ] 完整通关一遍核对数值（30-45 分钟）
- [ ] `git tag v1.0` 并推送
