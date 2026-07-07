# 战斗系统 / 技能树 / 装备栏 设计文档

> 状态：待评审。分期落地：P0 战斗数值化 → P1 装备栏 → P2 技能树。
> 前置阅读：`src/game/data.ts`（全部数值唯一落点）、`docs/multiplayer-sync-plan.md`。

## 0. 经济铁律（最高优先级约束）

**金币只从两个管道产出：交易商品、完成任务。击败怪物只掉极少金币。**

- 战斗的主产出是**战利品材料**——材料本身是货物（`GoodId` 扩展），占货舱、
  在港口按回收价卖出。也就是说：战斗收益必须经过贸易管道才能变现，
  金币水龙头仍然只有"卖货"和"任务奖励"两个。
- 现状问题（本文档顺带修复）：`WORM_BOUNTY = 150` + 90 秒刷新，刷沙虫的
  金币效率已超过香料险线（(26-12)×8 货舱 = 112g/趟），违背贸易立本的设计。
  改为：**击杀直接金币 10g（"极少"）+ 掉落材料 2~4 件**。
- 为什么材料要占货舱：战斗收益受 cargo 上限与航线约束，猎手也必须跑船，
  贸易始终是所有玩法的汇聚点；同时材料适用各港差价机制，猎场附近的港
  回收价最低（就地卖=懒人折价，运走卖=正常利润）。

## 1. 现有地基（不重建，只扩展）

| 已有系统 | 位置 | 在本设计中的角色 |
|---|---|---|
| 挥砍攻击 | `main.ts startAttack/tryBreakCrates` | P0 扩展为对敌人的近战判定 |
| 鱼叉炮 | `HARPOON_*` 常量 + `updateBolts` | P0 数值成长的载体 |
| 沙虫 AI 状态机 | `worm-ai.ts`（patrol/chase/bite/dive/return） | 新敌人的模板 |
| 升级查表 | `UPGRADES`（sail/cargo/hull） | 技能树的原型模式 |
| 更衣室 | `OutfitState`（纯数据、不渲染装备模型） | 装备栏照抄此模式 |
| 任务链 | `quests.ts` 严格顺序链 | 技能点的主要来源 |
| 存档清洗 | `save.ts sanitizeState` | 所有新字段的必经入口 |

## 2. P0 —— 战斗数值化 + 材料掉落

### 2.1 玩家侧数值

```
MELEE_DAMAGE = 12        // 挥砍对敌伤害（现仅劈箱，无对敌概念）
MELEE_RANGE  = 30        // 与劈箱判定 24 同量级
HARPOON_DAMAGE = 20      // 不变
```

### 2.2 敌人

P0 只加一种陆地敌人，验证"步行战斗"手感（沙虫是海战）：

```
沙蟹 Duneclaw（陆地近战，港口外围/遗迹岛游荡）
  HP 36（挥砍 3 刀）  伤害 8（打玩家硬直+击退，不掉货）
  掉落：甲壳 chitin ×1~2，金币 2
  刷新：120s，死亡持久化沿用 wormDeaths 模式（改为通用 enemyDeaths）
```

沙虫调整：`WORM_BOUNTY 150 → 10`，新增掉落 `wormscale ×2~4`。

### 2.3 材料即货物

```
GoodId 扩展：
  chitin    甲壳   回收价：oasis 5 / saltcrest 7 / duneskull 4
  wormscale 虫鳞   回收价：oasis 16 / saltcrest 22 / duneskull 12
```

- 材料**只有 sell 没有 buy**（港口不出售，防止买来倒卖刷交易数）。
- 击杀沙虫期望收益 ≈ 10g + 3×16~22 ≈ 58~76g（需运输变现），
  低于香料线 112g/趟——猎杀是补充收入与装备材料来源，不是主业。✅铁律
- 卖材料走 `sellGood` 原路径：计入 trades、适用 completedAwaySale 判定，
  无新增金币入口。

### 2.4 验证标准（写测试先行）

1. 击杀沙虫：金币 +10、cargo.wormscale 增加、超出货舱容量的掉落丢弃有提示
2. 沙蟹三刀死、玩家被击中扣的是新增 `playerHp` 而非船 hull（岸上无船）
3. `playerHp` 归零：回到最后港口，材料不掉（惩罚轻于搁浅，岸战容错高）
4. 经济回归：模拟 1 小时纯猎杀 vs 纯跑商，跑商金币收益必须 ≥ 1.5×

## 3. P1 —— 装备栏（纯数据，不渲染模型）

### 3.1 数据结构

```ts
type EquipSlotId = "weapon" | "harpoonMod" | "charm";   // 三槽起步
interface ItemDef {
  readonly id: ItemId;
  readonly slot: EquipSlotId;
  readonly name: string;
  readonly bonus: Partial<DerivedBonus>;   // 见 3.3
  readonly cost: number;                    // 港口铁匠售价；0 = 非卖品
  readonly craft?: Partial<Record<GoodId, number>>; // 材料打造配方
}
// GameState 增量
equipment: Readonly<Record<EquipSlotId, ItemId | null>>;
ownedItems: readonly ItemId[];
```

- **不渲染到人物**：与 outfit 同模式，只进存档和数值层，零美术成本，
  也符合方块风格铁律（不给方块人挂装备网格）。
- 获取途径：铁匠购买（金币出口，回收经济）、材料打造（材料出口）、
  任务奖励（非卖品）。**敌人不直接掉装备**——掉材料，材料打造装备，
  保持"战斗产出必须过一道加工/贸易手续"的原则。

### 3.2 首批物品（示例，6 件起步）

| 物品 | 槽 | 加成 | 获取 |
|---|---|---|---|
| 铁刃弯刀 | weapon | 近战 +6 | 铁匠 200g |
| 虫鳞劈刀 | weapon | 近战 +14 | 打造：wormscale×6 + chitin×4 |
| 速装绞盘 | harpoonMod | 鱼叉冷却 -25% | 铁匠 450g |
| 穿甲叉头 | harpoonMod | 鱼叉 +10 | 打造：wormscale×10 |
| 护货绳网 | charm | 咬击掉货 25%→15% | 铁匠 350g |
| 老水手护符 | charm | 搁浅拖船费全免 | 任务奖励 |

### 3.3 派生属性（只算不存）

```ts
interface DerivedBonus { meleeDamage; harpoonDamage; harpoonCooldownMul;
                         biteCargoLossMul; towFeeWaived; }
function getDerivedStats(state): DerivedStats  // data.ts 纯函数，查表求和
```

存档只存 `equipment`/`ownedItems`（ID 白名单过 sanitizeState），
加成一律现算——严禁把算好的属性写进 GameState（防双源漂移）。

### 3.4 验证标准

1. 装备虫鳞劈刀后沙蟹两刀死（12+14=26 ≥ 36/2）
2. 存档往返：装备栏/背包完整恢复；未知 ItemId 被清洗丢弃
3. 老档兜底：equipment 三槽 null、ownedItems 空，游戏正常

## 4. P2 —— 技能树

### 4.1 技能点来源（防刷设计）

**技能点只来自任务与里程碑，不来自击杀计数。**

- 任务链每完成一环 +1 点（现有 12 环 → 12 点）
- 里程碑：首访三港 +1、首次通关 +2、贸易累计 500g +1（一次性）
- 上限约 16 点，三分支各 5 层，**不可洗点**（原型期简化；洗点是
  后续付费/代币出口的候选，先留白）

### 4.2 三分支（每层 1 点，线性解锁）

```
航海：帆效+4% → 搁浅掉货50%→40% → 转向+10% → 咬击掉货-5pt → 帆效+6%
战斗：近战+3 → 鱼叉+4 → 冷却-10% → 近战+5 → 鱼叉暴击10%×2倍
商贾：卖价+2% → 货舱+2 → 买价-2% → 卖价+3% → 港口修船费减半
```

- 商贾分支直接放大金币产出，数值刻意保守（顶配全点 ≈ 卖价+5%），
  且加成走 `getDerivedStats` 统一管道，未来服务端结算校验时同一套表。

### 4.3 验证标准

1. 点数总供给 = 各来源之和，无重复领取（沿用 claimedQuests 模式）
2. 前置未解锁不可点后置；存档往返技能完整
3. 经济回归：商贾满配后跑商收益增幅 ≤ 8%

## 5. 存档与多人边界

- 每期新增字段全部接 `sanitizeState`：ID 白名单、数值钳制、老档缺失
  兜底为初始值；`enemyDeaths` 沿用 wormDeaths 的过期过滤。
- **战斗不进 presence 同步**：P0~P2 全部本地 PvE，其他玩家看不到你的
  战斗过程（船位同步不变）。"看到别人开炮"另立提案评估带宽与作弊面。
- **Web3 红线**：战斗扩大了客户端权威的金币入口面（尽管已收窄到 10g/杀 +
  材料贸易）。金币→$SAND 兑换在服务端结算校验落地前，保持预发布记账，
  不接真链。装备/材料未来若上链交易，同样以服务端库存为准。

## 6. 任务分解

| # | 任务 | 依赖 | 量级 |
|---|---|---|---|
| P0-1 | playerHp + 岸上受击/重生（economy 纯函数 + 测试） | - | 0.5d |
| P0-2 | 近战对敌判定（复用挥砍，MELEE_* 常量） | P0-1 | 0.5d |
| P0-3 | 沙蟹 AI（worm-ai 模板派生 walker 版）+ enemyDeaths 持久化 | P0-2 | 1d |
| P0-4 | 材料 GoodId 扩展 + 掉落表 + WORM_BOUNTY 调 10 + 经济回归测试 | - | 0.5d |
| P1-1 | ItemDef 表 + equipment/ownedItems + sanitize + getDerivedStats | P0 | 1d |
| P1-2 | 铁匠/打造 UI（复用交易面板模式）+ 装备栏 UI | P1-1 | 1d |
| P2-1 | 技能点账本 + 三分支表 + 解锁校验 | P1 | 1d |
| P2-2 | 技能树 UI + 经济回归全量跑 | P2-1 | 1d |

每步走 TDD：economy/save 层先写用例（RED）再实现（GREEN），
UI 层补 Playwright 冒烟。

## 7. 待拍板的问题

1. **材料占货舱**（本文档预设：占）——占舱强化贸易耦合但猎手体验受限，
   若改"独立材料袋"则需要新容量维度，倾向不做。
2. **装备可否转卖回铁匠**：预设可以，半价回收（金币出口，不产生新金币）。
3. **playerHp 数值**：预设 60、沙蟹 8/击、离战 5s 后缓回——需要试玩调。
4. **沙蟹是否威胁货箱区**：预设不（新手区安全），只在港口外围与遗迹岛。
