# 多人同步技术方案 — 从"看到彼此的船"起步

> 目标形态：**所有玩家进入同一个世界**，在线期间实时看到彼此的船航行、带名牌。
> （用户确认 2026-07-06：在线互见即可；下线船消失，世界事件共享、船间碰撞均后置。）
>
> 设计铁律：**船舶每个玩家一艘**（一钱包一船）。同一钱包重复连接时踢掉旧会话，
> 服务器侧每个身份只维护一个船实体。

## 一、现状与结论

当前游戏是单机架构：船/金币/存档全在客户端本地，没有玩家间同步。
已具备的联机基座：

- `workers/chat`：Cloudflare Durable Object + WebSocket 广播（全服聊天），模式已验证。
- `src/core/wallet.ts`：Solana 钱包公钥即玩家身份；presence 握手要求钱包签名，
  Worker 验签通过后才允许使用该公钥作为玩家 ID。
- `src/game/ship-controller.ts`：船的逻辑状态就是 `{position(x,z), heading, speed}`，
  天然适合做低频快照同步。

结论：**沿用同一套 Cloudflare 栈（Worker + Durable Object + WebSocket）加一个
presence 房间即可实现 P0**，不需要引入新厂商或专用游戏同步框架。

## 二、总体架构（P0：彼此可见）

```
浏览器 A ──ws──┐
浏览器 B ──ws──┤  PresenceRoom (Durable Object, "global" 单例)
浏览器 C ──ws──┘  10Hz 聚合广播全员快照
```

- 客户端以 ~8Hz 上报自己的船状态（有位移才发）。
- DO 不逐条转发，而是按 10Hz tick 把所有在线玩家状态打包成一帧快照广播，
  消息量 O(n) 而非 O(n²)。
- 所有连上同一 PresenceRoom 的玩家即处于**同一个世界**：你能实时看到其他每个
  在线玩家的船在地图上航行。其他玩家的船渲染为"幽灵船"——指**无碰撞、不参与
  经济**（不能挡路顶撞），视觉上是完整的船 + 插值平滑 + 头顶名牌。
  这规避了物理冲突、作弊与防骚扰问题，是 P0 的关键取舍。
- 单一全局房间，上限先定 32 人；超限后按区域/分片扩展（DO 天然支持多实例）。

## 三、协议草案

```jsonc
// 客户端 → 服务器
{ "t": "hello", "name": "Captain", "wallet": "8f2k…Qz9d", "auth": { "audience": "...", "timestamp": 178..., "nonce": "...", "signature": "..." } }   // 连接后首条
{ "t": "pos", "x": 340.2, "z": -512.8, "h": 1.57, "s": 92, "m": "sailing" }
// m: "sailing" | "walking" | "docked"（步行/停靠时船静止，锚定在最后位置）

// 服务器 → 客户端
{ "t": "welcome", "id": "8f2k…Qz9d", "players": [ /* 当前全员快照 */ ] }
{ "t": "snap", "p": [ { "id": "...", "n": "Captain", "x": 0, "z": 0, "h": 0, "s": 0, "m": "sailing" } ] }
{ "t": "leave", "id": "..." }
```

带宽估算：32 人 × ~40 字节 × 10Hz ≈ 13 KB/s/连接，Workers 免费额度内轻松承载。

## 四、服务器实现（workers/presence）

复制 `workers/chat` 的骨架，新增 `PresenceRoom` DO：

- `sessions: Map<playerId, { ws, state, lastSeen }>` — **一身份一条目 = 一船**；
  同 ID 再连接时先 `close` 旧 ws（实现"一钱包一船"）。
- 访客（`guest`）用服务器生成的随机会话 ID，同样一会话一船。
- 输入校验：坐标 clamp 到世界边界 ±1420、速度 clamp 到最大帆速上限、
  上报频率限流（>20Hz 丢弃），字符串字段截断——不信任客户端。
- 10Hz `setInterval` tick 聚合广播；15 秒无心跳踢下线。
- 不用 Hibernation API：10Hz tick 下 DO 在有人在线时本就不会休眠，
  与聊天 Worker 保持同一简单模式；空房间时 DO 自然回收。
- 部署与聊天 Worker 相同：`npx wrangler deploy`，前端配 `VITE_PRESENCE_WS_URL`。
- 房间逻辑抽在 `presence-core.js`（零依赖纯模块），本地测试服务器
  `scripts/presence-test-server.mjs` 复用同一份代码——Playwright 测的就是线上逻辑。

## 五、客户端实现

新增两个小模块（不动现有单机逻辑，未配置 URL 时完全静默）：

1. `src/net/presence.ts` — 传输层，模式照抄 `src/ui/chat.ts`：
   读 `VITE_PRESENCE_WS_URL`，无则不启用；断线指数退避重连；
   每 125ms 读一次 `shipState` 与当前模式，位移超阈值才发送。
2. `src/net/remote-ships.ts` — 渲染层：
   - 收到新玩家 → 用现有 `hunyuanSlot(voxel占位, "/models/skiff.glb")` 同款管线
     生成一艘远端船加入场景。
   - **插值**：为每艘远端船缓存最近两帧快照，渲染时间取 `now - 150ms`，
     位置 lerp、朝向按最短弧插值——10Hz 的数据在 60fps 下依然顺滑。
   - 头顶名牌：`Captain · 8f2k…Qz9d`（Sprite 文字，随距离淡出）。
   - 步行/停靠模式（`m !== "sailing"`）：船锚定显示在最后位置（船不消失，
     符合"船是玩家资产"的世界观）。

身份接线：`hello` 里带钱包公钥、短昵称与签名认证；聊天 Worker 后续同样接入该身份，
替换固定昵称 Captain。

## 六、边界与安全

- P0 是**客户端权威**位置同步——纯视觉呈现可以接受。
- presence 身份已做钱包签名验证，但 P0 仍是**客户端权威位置同步**。
  任何有经济意义的交互（交易、赏金、$SAND）**必须**升级到服务器权威，
  不得信任客户端提交的数值变化。
- 远端船无碰撞，不能用来卡位/顶撞（防骚扰）。

## 七、里程碑

| 阶段 | 内容 | 规模估算 |
|------|------|----------|
| **P0 彼此见船（已完成 2026-07-06）** | presence Worker + 客户端两模块 + 名牌 + 插值 | Worker ~150 行；客户端 ~250 行 |
| P1 岸上互动 | 步行小人同步、挥手表情、在线玩家列表、聊天接身份昵称 | 中 |
| P2 玩法互动 | 服务器权威世界事件（共享沙虫）、玩家间交易、组队赏金 | 大（需权威服务器 + 签名登录） |

## 八、P0 验收标准（测试先行）

1. Playwright 双浏览器上下文连同一 presence Worker（`wrangler dev` 本地起）：
   A 移动船 → 断言 B 场景中出现远端船节点且位置随之更新。
2. 同一钱包开两个标签页 → 旧连接被踢，世界中该身份的船始终只有一艘。
3. 未配置 `VITE_PRESENCE_WS_URL` 时：游戏行为与现在完全一致，冒烟测试全绿。
4. 断网 10 秒后重连 → 远端船恢复，无重影（同 ID 复用同一实体）。
