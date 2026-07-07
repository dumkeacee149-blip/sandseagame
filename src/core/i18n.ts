// 游戏内双语（中/英）文案：所有面向玩家的字符串统一从这里取。
// 语言选择持久化到 localStorage；切换时通过 onLangChange 通知各 UI 模块重绘。

export type Lang = "en" | "zh";

const LANG_KEY = "sandsea-lang";

type Dict = Readonly<Record<string, string>>;

const en: Dict = {
  title: "Sandsea Privateers — Voxel Desert Pirate Trading Adventure",
  "boot.loading": "Charting the sandsea…",
  "webgl.error":
    "Your browser does not support WebGL, which this game requires.<br/>Please try a recent version of Chrome, Edge, Firefox or Safari.",

  // 常驻 HUD
  "hud.knots": "knots",
  "hud.gold": "gold",
  "hud.cargo": "cargo",
  "hud.hull": "hull",
  "route.open": "Open Sandsea",
  "route.vault": "Relic Vault",
  "controls.hint": "WASD move · E interact · Space jump · Click attack · Drag rotate · Enter chat",
  // 模式化快捷键条（图标 + 键帽，JS 渲染）
  "hint.sail": "Sail",
  "hint.move": "Move",
  "hint.sprint": "Sprint",
  "hint.jump": "Jump",
  "hint.attack": "Attack",
  "hint.fire": "Fire harpoon",
  "hint.noWeapon": "No weapon · visit shipwright",
  "hint.ashore": "Go ashore",
  "hint.interact": "Interact",
  "hint.rotate": "Camera",
  "hint.chat": "Chat",
  "hint.escFree": "Free cursor",
  "hint.clickLock": "Click screen to lock view",
  "harpoon.notMounted": "No weapon mounted — buy a Harpoon Cannon at any shipwright ({cost}g)",

  // 试玩删档提示
  "trial.note": "Playtest build · all progress will be wiped before launch",
  "trial.chat": "Heads up, Captain: this is a playtest build — all progress will be wiped before official launch.",

  // 港口与货物
  "port.oasis": "Oasis Harbor",
  "port.saltcrest": "Saltcrest",
  "port.duneskull": "Duneskull Outpost",
  "good.dates": "Dates",
  "good.salt": "Salt",
  "good.glassware": "Glassware",
  "good.spice": "Spice",
  "good.chitin": "Chitin",
  "good.wormscale": "Wormscale",

  // NPC 名号
  "npc.harbormaster": "Harbormaster",
  "npc.shipwright": "Shipwright",
  "npc.lookout": "Lookout",
  "npc.quartermaster": "Quartermaster",
  "npc.mirza": "Mirza the Trader",
  "npc.beshir": "Old Salt Beshir",
  "npc.nur": "Dockhand Nur",

  // 聊天面板
  "chat.band": "Harbor Band",
  "chat.local": "LOCAL",
  "chat.global": "GLOBAL",
  "chat.placeholder": "Say something, Captain… (Enter)",
  "chat.you": "Captain (you)",
  "chat.welcome": "Welcome to the Sandsea, Captain. Markets are marked overhead.",
  "chat.globalConnected": "Connected to the global Harbor Band.",
  "chatter.1": "Spice is fetching mad prices out at Duneskull, if you dare the worm.",
  "chatter.2": "Saw the leviathan breach at dusk. Bigger than last season, I swear.",
  "chatter.3": "Dates buy low here, sell sweet at Saltcrest. Easy run for a new sail.",
  "chatter.4": "Keep your hull patched, Captain. The sandsea forgives nothing.",
  "chatter.5": "They say a relic vault sleeps under the Sunken Ruins. Maps cost a fortune.",
  "chatter.6": "Wind's turning. Good day to run the near route twice.",
  "chatter.7": "A cargo hold upgrade pays itself back in three runs. Just saying.",

  // 任务
  "quest.title": "Voyage Log",
  "quest.allDone": "All legends fulfilled 🏴‍☠️",
  "quest.complete": "Quest complete: {text} (+{reward}g)",
  "quest.ashore": "Dock at Oasis Harbor and go ashore",
  "quest.crate": "Crack open a supply crate",
  "quest.first-buy": "Buy trade goods at a market",
  "quest.first-sale": "Sell cargo at another port",
  "quest.nest-egg": "Hold 150 gold at once",
  "quest.upgrade": "Buy your first shipwright upgrade",
  "quest.saltcrest": "Set foot in Saltcrest",
  "quest.survive": "Survive a leviathan bite",
  "quest.duneskull": "Reach Duneskull Outpost",
  "quest.sail2": "Upgrade sails to L2 — outrun the leviathan",
  "quest.harpoon": "Mount a harpoon cannon at the shipwright",
  "quest.slay": "Slay a leviathan",
  "quest.map": "Buy the treasure map at Duneskull",
  "quest.chest": "Open the relic chest in the Sunken Ruins",

  // 交易面板
  "trade.market": "{port} Market",
  "trade.stats": "<b>{gold}</b> gold · cargo <b>{held}/{cap}</b>",
  "trade.held": "held {n}",
  "trade.buy": "Buy {qty} · {price}g",
  "trade.sell": "Sell {qty} · {price}g",
  "trade.upgrades": "Shipwright Upgrades",
  "trade.upgradeBtn": "L{level} · {value} {unit} · {cost}g",
  "trade.max": "MAX",
  "trade.leave": "E / Esc to leave",
  "upgrade.sail": "Sail",
  "upgrade.sail.unit": "speed",
  "upgrade.cargo": "Cargo Hold",
  "upgrade.cargo.unit": "slots",
  "upgrade.hull": "Hull",
  "upgrade.hull.unit": "HP",
  "harpoon.name": "Harpoon Cannon",
  "harpoon.mounted": "mounted · left-click while sailing",
  "harpoon.pitch": "hunt the leviathan · 20 dmg per bolt",
  "harpoon.mountedTag": "MOUNTED",
  "harpoon.buy": "Mount · {cost}g",
  "outfit.title": "Dressing Room",
  "outfit.bandana": "Bandana",
  "outfit.cloth": "Cloak",
  "outfit.leather": "Leathers",
  "hero.title": "Choose Your Captain",
  "hero.hint": "You can change captains any time in the Dressing Room.",
  "hero.confirm": "Set Sail",
  "hero.slot": "Captain",
  "hero.rogue_hooded": "Hooded Rogue",
  "hero.knight": "Knight",
  "hero.barbarian": "Barbarian",
  "hero.mage": "Mage",
  "hero.rogue": "Rogue",
  "rumors.title": "Rumors",
  "gear.title": "Blacksmith & Gear",
  "slot.weapon": "Blade",
  "slot.harpoonMod": "Harpoon Mod",
  "slot.charm": "Charm",
  "item.buy": "Buy · {cost}g",
  "item.craft": "Craft · {mats}",
  "item.questReward": "Quest reward",
  "item.equip": "Equip",
  "item.unequip": "Unequip",
  "item.sell": "Sell · {gold}g",
  "item.iron-cutlass": "Iron Cutlass",
  "item.iron-cutlass.desc": "Melee +6",
  "item.wormscale-cleaver": "Wormscale Cleaver",
  "item.wormscale-cleaver.desc": "Melee +14",
  "item.quick-winch": "Quick Winch",
  "item.quick-winch.desc": "Harpoon cooldown -25%",
  "item.piercing-head": "Piercing Head",
  "item.piercing-head.desc": "Harpoon +10",
  "item.cargo-net": "Cargo Net",
  "item.cargo-net.desc": "Bite cargo loss 25% → 15%",
  "item.sailor-charm": "Old Sailor's Charm",
  "item.sailor-charm.desc": "Towing fee waived",
  "skills.title.one": "Skills · {points} point to spend",
  "skills.title.many": "Skills · {points} points to spend",
  "branch.seafaring": "Seafaring",
  "branch.combat": "Combat",
  "branch.merchant": "Merchant",
  "skill.sea1": "Trimmed Sails",
  "skill.sea1.desc": "Sail speed +4%",
  "skill.sea2": "Salvage Drill",
  "skill.sea2.desc": "Stranding cargo loss -10pt",
  "skill.sea3": "Lash the Hold",
  "skill.sea3.desc": "Bite cargo loss -5pt",
  "skill.sea4": "Stormcloth",
  "skill.sea4.desc": "Sail speed +6%",
  "skill.sea5": "Harbor Kin",
  "skill.sea5.desc": "Towing fee waived",
  "skill.war1": "Keen Edge",
  "skill.war1.desc": "Melee +3",
  "skill.war2": "Barbed Bolts",
  "skill.war2.desc": "Harpoon +4",
  "skill.war3": "Fast Hands",
  "skill.war3.desc": "Harpoon cooldown -10%",
  "skill.war4": "Butcher's Arc",
  "skill.war4.desc": "Melee +5",
  "skill.war5": "Deadeye",
  "skill.war5.desc": "Harpoon crit 10% ×2",
  "skill.mer1": "Haggler",
  "skill.mer1.desc": "Sell price +2%",
  "skill.mer2": "Tight Stowage",
  "skill.mer2.desc": "Cargo +2",
  "skill.mer3": "Bulk Buyer",
  "skill.mer3.desc": "Buy price -2%",
  "skill.mer4": "Silver Tongue",
  "skill.mer4.desc": "Sell price +3%",
  "skill.mer5": "Deep Hold",
  "skill.mer5.desc": "Cargo +4",
  "map.name": "Treasure Map",
  "map.owned": "purchased — head to the Sunken Ruins",
  "map.pitch": "leads to the relic vault",
  "map.ownedTag": "OWNED",
  "map.buy": "Buy · {cost}g",

  // 主循环提示
  "action.ashore": "Press E to go ashore",
  "action.chest": "Press E to open the relic chest",
  "action.trade": "Press E to trade at {port}",
  "action.board": "Press E to board the skiff",
  "toast.hullRepaired": "Hull repaired at {port}",
  "chat.hullRepaired": "Hull patched and ready at {port}.",
  "harpoon.noTarget": "No leviathan in harpoon range",
  "worm.slain": "Leviathan slain! +{gold}g · +{scales} wormscale{note}",
  "worm.lootLost": " (hold full, {n} scale lost)",
  "worm.slainChat": "The leviathan sinks! +{gold}g bounty, {scales} wormscale hauled aboard.",
  "worm.crit": "CRIT! ",
  "worm.hit": "Harpoon hit! Leviathan {hp} HP",
  "worm.bite": "Leviathan bite! Hull {hull}",
  "worm.biteChat": "Leviathan strike! Hull at {hull}.",
  "crab.slain": "Duneclaw cracked! +{gold}g · +{loot} chitin",
  "crab.hit": "Hit! Duneclaw {hp} HP",
  "crab.pinch": "Duneclaw pinch! HP {hp}",
  "player.downChat": "Dragged you back to the market half-pinched. Mind the duneclaws, Captain.",
  "player.downToast": "You went down! Carried back to the market",
  "strand.chat": "Fished you out of the dunes. Towing fee {fee}g, Captain.",
  "strand.eyebrow": "Shipwreck",
  "strand.title": "Stranded in the Sandsea",
  "strand.l1": "The leviathan tore your skiff apart.",
  "strand.l2": "Lost part of your cargo and {fee}g towing fee.",
  "strand.l3": "Towed back to {port}, hull fully repaired.",
  "strand.btn": "Set Sail Again",
  "treasure.eyebrow": "Legend Fulfilled",
  "treasure.title": "The Relic Chest Opens!",
  "treasure.l1": "Cyan light floods out of the ancient vault.",
  "treasure.l2": "Treasure claimed: +{gold}g.",
  "treasure.l3": "The sandsea is yours, Captain. Keep sailing as long as you like.",
  "treasure.btn": "Claim Glory",
  "treasure.chat": "Word spreads fast — the relic vault stands open. A legend walks among us!",
  "wallet.linked": "Wallet linked: {id}. Your voyage is bound to it.",

  // 同世界在线
  "presence.replaced": "Your captain set sail from another session — this one is ashore now.",
  "presence.badHello": "Shared sandsea sign-in failed. Reconnect your wallet and try again.",
  "presence.signDeclined": "Wallet signature was declined, so shared sandsea is offline for this session.",
  "presence.cantSign": "This wallet cannot sign presence messages, so shared sandsea is offline.",
  "presence.entered": "You've entered the shared sandsea. Other captains' sails are on the horizon.",
};

const zh: Dict = {
  title: "沙海私掠者 — 方块沙海海盗贸易冒险",
  "boot.loading": "正在绘制沙海航图…",
  "webgl.error": "你的浏览器不支持本游戏所需的 WebGL。<br/>请改用较新版本的 Chrome、Edge、Firefox 或 Safari。",

  "hud.knots": "节",
  "hud.gold": "金币",
  "hud.cargo": "货舱",
  "hud.hull": "船壳",
  "route.open": "沙海航行中",
  "route.vault": "遗物宝库",
  "controls.hint": "WASD 移动 · E 互动 · 空格 跳跃 · 点击 攻击 · 拖拽 转视角 · 回车 聊天",
  // 模式化快捷键条（图标 + 键帽，JS 渲染）
  "hint.sail": "航行",
  "hint.move": "移动",
  "hint.sprint": "冲刺",
  "hint.jump": "跳跃",
  "hint.attack": "攻击",
  "hint.fire": "发射鱼叉",
  "hint.noWeapon": "无武器 · 去船坞购置",
  "hint.ashore": "上岸",
  "hint.interact": "交互",
  "hint.rotate": "转镜头",
  "hint.chat": "聊天",
  "hint.escFree": "释放鼠标",
  "hint.clickLock": "点击画面锁定视角",
  "harpoon.notMounted": "船上未装备武器——到任意港口船坞购置鱼叉炮（{cost} 金）",

  "trial.note": "试玩测试版 · 正式上线前将清空所有存档",
  "trial.chat": "船长请注意：当前为试玩删档测试，正式上线前所有进度将被清空。",

  "port.oasis": "绿洲港",
  "port.saltcrest": "盐脊镇",
  "port.duneskull": "沙颅前哨",
  "good.dates": "椰枣",
  "good.salt": "岩盐",
  "good.glassware": "玻璃器皿",
  "good.spice": "香料",
  "good.chitin": "甲壳",
  "good.wormscale": "虫鳞",

  "npc.harbormaster": "港务长",
  "npc.shipwright": "船匠",
  "npc.lookout": "瞭望手",
  "npc.quartermaster": "军需官",
  "npc.mirza": "商人米尔扎",
  "npc.beshir": "老水手贝希尔",
  "npc.nur": "码头工努尔",

  "chat.band": "港湾频道",
  "chat.local": "本地",
  "chat.global": "全服",
  "chat.placeholder": "船长，说点什么…（回车）",
  "chat.you": "船长（你）",
  "chat.welcome": "欢迎来到沙海，船长。集市上方都有标记。",
  "chat.globalConnected": "已接入全服港湾频道。",
  "chatter.1": "香料在沙颅前哨卖出了疯价——前提是你敢闯沙虫的地盘。",
  "chatter.2": "黄昏时看见沙虫破沙而出，我发誓比上一季更大了。",
  "chatter.3": "椰枣在这儿进价便宜，运到盐脊镇能卖个好价，新手跑这条线最稳。",
  "chatter.4": "船壳记得随时修补，船长。沙海从不留情。",
  "chatter.5": "听说沉没遗迹之下沉睡着遗物宝库，那张藏宝图可要花大价钱。",
  "chatter.6": "风向转了，今天适合近线跑两趟。",
  "chatter.7": "货舱升级三趟就回本，随口一提。",

  "quest.title": "航海日志",
  "quest.allDone": "所有传说均已达成 🏴‍☠️",
  "quest.complete": "任务完成：{text}（+{reward} 金）",
  "quest.ashore": "在绿洲港停靠并上岸",
  "quest.crate": "劈开一个补给货箱",
  "quest.first-buy": "在集市购入贸易货物",
  "quest.first-sale": "把货物卖到另一座港口",
  "quest.nest-egg": "同时持有 150 金币",
  "quest.upgrade": "购买第一次船坞升级",
  "quest.saltcrest": "踏上盐脊镇",
  "quest.survive": "在沙虫咬击中幸存",
  "quest.duneskull": "抵达沙颅前哨",
  "quest.sail2": "船帆升到 L2——甩开沙虫",
  "quest.harpoon": "在船坞装上鱼叉炮",
  "quest.slay": "击杀一条沙虫",
  "quest.map": "在沙颅前哨购买藏宝图",
  "quest.chest": "打开沉没遗迹的遗物宝箱",

  "trade.market": "{port}集市",
  "trade.stats": "<b>{gold}</b> 金币 · 货舱 <b>{held}/{cap}</b>",
  "trade.held": "持有 {n}",
  "trade.buy": "买 {qty} · {price} 金",
  "trade.sell": "卖 {qty} · {price} 金",
  "trade.upgrades": "船坞升级",
  "trade.upgradeBtn": "L{level} · {value}{unit} · {cost} 金",
  "trade.max": "已满级",
  "trade.leave": "按 E / Esc 离开",
  "upgrade.sail": "船帆",
  "upgrade.sail.unit": " 航速",
  "upgrade.cargo": "货舱",
  "upgrade.cargo.unit": " 格",
  "upgrade.hull": "船壳",
  "upgrade.hull.unit": " 耐久",
  "harpoon.name": "鱼叉炮",
  "harpoon.mounted": "已装备 · 航行中左键发射",
  "harpoon.pitch": "猎杀沙虫 · 每发 20 伤害",
  "harpoon.mountedTag": "已装备",
  "harpoon.buy": "购置 · {cost} 金",
  "outfit.title": "更衣室",
  "outfit.bandana": "头巾",
  "outfit.cloth": "披风",
  "outfit.leather": "皮甲",
  "hero.title": "选择你的船长",
  "hero.hint": "之后可随时在更衣室更换船长。",
  "hero.confirm": "扬帆出发",
  "hero.slot": "船长",
  "hero.rogue_hooded": "兜帽游侠",
  "hero.knight": "骑士",
  "hero.barbarian": "野蛮人",
  "hero.mage": "法师",
  "hero.rogue": "游荡者",
  "rumors.title": "传闻",
  "gear.title": "铁匠与装备",
  "slot.weapon": "武器",
  "slot.harpoonMod": "鱼叉改装",
  "slot.charm": "护符",
  "item.buy": "购买 · {cost} 金",
  "item.craft": "打造 · {mats}",
  "item.questReward": "任务奖励",
  "item.equip": "装备",
  "item.unequip": "卸下",
  "item.sell": "回售 · {gold} 金",
  "item.iron-cutlass": "铁弯刀",
  "item.iron-cutlass.desc": "近战 +6",
  "item.wormscale-cleaver": "虫鳞劈刀",
  "item.wormscale-cleaver.desc": "近战 +14",
  "item.quick-winch": "快速绞盘",
  "item.quick-winch.desc": "鱼叉冷却 -25%",
  "item.piercing-head": "穿甲叉头",
  "item.piercing-head.desc": "鱼叉 +10",
  "item.cargo-net": "货物防护网",
  "item.cargo-net.desc": "咬击掉货 25% → 15%",
  "item.sailor-charm": "老水手护符",
  "item.sailor-charm.desc": "免拖船费",
  "skills.title.one": "技能 · 可用点数 {points}",
  "skills.title.many": "技能 · 可用点数 {points}",
  "branch.seafaring": "航海",
  "branch.combat": "战斗",
  "branch.merchant": "商贾",
  "skill.sea1": "修帆理索",
  "skill.sea1.desc": "航速 +4%",
  "skill.sea2": "抢捞演练",
  "skill.sea2.desc": "搁浅掉货 -10 点",
  "skill.sea3": "捆扎货舱",
  "skill.sea3.desc": "咬击掉货 -5 点",
  "skill.sea4": "风暴帆布",
  "skill.sea4.desc": "航速 +6%",
  "skill.sea5": "港湾人脉",
  "skill.sea5.desc": "免拖船费",
  "skill.war1": "利刃",
  "skill.war1.desc": "近战 +3",
  "skill.war2": "倒刺叉矢",
  "skill.war2.desc": "鱼叉 +4",
  "skill.war3": "快手",
  "skill.war3.desc": "鱼叉冷却 -10%",
  "skill.war4": "屠夫弧斩",
  "skill.war4.desc": "近战 +5",
  "skill.war5": "神射",
  "skill.war5.desc": "鱼叉暴击 10% ×2",
  "skill.mer1": "讨价还价",
  "skill.mer1.desc": "卖价 +2%",
  "skill.mer2": "紧凑堆装",
  "skill.mer2.desc": "货舱 +2",
  "skill.mer3": "批量采购",
  "skill.mer3.desc": "买价 -2%",
  "skill.mer4": "巧舌如簧",
  "skill.mer4.desc": "卖价 +3%",
  "skill.mer5": "深舱",
  "skill.mer5.desc": "货舱 +4",
  "map.name": "藏宝图",
  "map.owned": "已购入——前往沉没遗迹",
  "map.pitch": "指向遗物宝库",
  "map.ownedTag": "已拥有",
  "map.buy": "购买 · {cost} 金",

  "action.ashore": "按 E 上岸",
  "action.chest": "按 E 开启遗物宝箱",
  "action.trade": "按 E 在{port}交易",
  "action.board": "按 E 登船",
  "toast.hullRepaired": "已在{port}修复船壳",
  "chat.hullRepaired": "船壳已在{port}修补完毕。",
  "harpoon.noTarget": "鱼叉射程内没有沙虫",
  "worm.slain": "沙虫被击杀！+{gold} 金 · 虫鳞 +{scales}{note}",
  "worm.lootLost": "（货舱已满，损失 {n} 片虫鳞）",
  "worm.slainChat": "沙虫沉入沙下！赏金 +{gold} 金，{scales} 片虫鳞已入舱。",
  "worm.crit": "暴击！",
  "worm.hit": "鱼叉命中！沙虫剩余 {hp} 血",
  "worm.bite": "被沙虫咬中！船壳 {hull}",
  "worm.biteChat": "沙虫袭击！船壳剩 {hull}。",
  "crab.slain": "沙蟹碎裂！+{gold} 金 · 甲壳 +{loot}",
  "crab.hit": "命中！沙蟹剩余 {hp} 血",
  "crab.pinch": "被沙蟹夹中！生命 {hp}",
  "player.downChat": "把被夹得半死的你拖回了集市。当心沙蟹，船长。",
  "player.downToast": "你倒下了！已被抬回集市",
  "strand.chat": "把你从沙丘里捞了出来。拖船费 {fee} 金，船长。",
  "strand.eyebrow": "船难",
  "strand.title": "搁浅沙海",
  "strand.l1": "沙虫把你的沙船撕成了碎片。",
  "strand.l2": "损失部分货物，并支付 {fee} 金拖船费。",
  "strand.l3": "已拖回{port}，船壳修复如初。",
  "strand.btn": "再次起航",
  "treasure.eyebrow": "传说达成",
  "treasure.title": "遗物宝箱开启！",
  "treasure.l1": "青色光芒从远古宝库中倾泻而出。",
  "treasure.l2": "获得宝藏：+{gold} 金。",
  "treasure.l3": "沙海已是你的天下，船长。想航行多久都可以。",
  "treasure.btn": "领受荣耀",
  "treasure.chat": "消息传得飞快——遗物宝库已开。传奇就在我们中间！",
  "wallet.linked": "钱包已连接：{id}。你的航程将绑定到该钱包。",

  "presence.replaced": "你的船长在另一个会话起航——当前会话已上岸。",
  "presence.badHello": "共享沙海登录失败，请重新连接钱包再试。",
  "presence.signDeclined": "钱包签名被拒绝，本次会话的共享沙海已离线。",
  "presence.cantSign": "该钱包无法签名在线消息，共享沙海已离线。",
  "presence.entered": "你已进入共享沙海，其他船长的帆影就在天边。",
};

const DICTS: Record<Lang, Dict> = { en, zh };

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "en" || saved === "zh") return saved;
  } catch {
    // localStorage 不可用时跟随浏览器语言
  }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

let current: Lang = detectLang();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // 保存失败不影响本次会话
  }
  applyStaticI18n();
  for (const listener of listeners) listener();
}

export function toggleLang() {
  setLang(current === "en" ? "zh" : "en");
}

export function onLangChange(listener: () => void) {
  listeners.add(listener);
  // 返回退订函数：临时性 UI（如选船长面板）关闭时解除监听，避免泄漏
  return () => {
    listeners.delete(listener);
  };
}

// 取文案并替换 {param} 占位符；缺 key 时回退英文字典，再退回 key 本身
export function t(key: string, params?: Record<string, string | number>): string {
  const template = DICTS[current][key] ?? en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] !== undefined ? String(params[name]) : match,
  );
}

// 刷新 index.html 里带 data-i18n / data-i18n-placeholder 标记的静态文本
export function applyStaticI18n() {
  document.documentElement.lang = current === "zh" ? "zh-CN" : "en";
  document.title = t("title");
  for (const el of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  }
  for (const el of document.querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]")) {
    const key = el.dataset.i18nPlaceholder;
    if (key) el.placeholder = t(key);
  }
}
