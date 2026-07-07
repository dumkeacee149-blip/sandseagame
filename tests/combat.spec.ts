import { test, expect, type Page } from "@playwright/test";

// 战斗/装备/技能测试：经济铁律护航线。
// 依赖 DEV-only window.__game 钩子（economy 纯函数 + crabAgents/damageCrab/getPlayerHp）。

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    __game?: any;
  }
}

async function boot(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__game));
  await page.evaluate(() => window.__game!.clearSave());
}

// 已领任务垫底（防任务链自动发奖污染精确金币断言），visited 留空防 ashore 链启动
const QUIET_QUESTS = ["ashore", "crate", "first-buy", "first-sale", "nest-egg", "saltcrest", "survive", "duneskull"];

test("击杀沙虫：赏金极少（+10g），主产出虫鳞入舱并记死亡", async ({ page }) => {
  await boot(page);
  const result = await page.evaluate((quiet) => {
    const g = window.__game!;
    g.setState({ ...g.getState(), gold: 100, claimedQuests: quiet });
    const before = g.getState();
    const { state: next, looted } = g.economy.recordWormKill(before, 0, Date.now() + 90_000, 3);
    return {
      goldDelta: next.gold - before.gold,
      looted,
      wormscale: next.cargo.wormscale,
      wormKills: next.wormKills,
      death: next.enemyDeaths.find((r: { kind: string; id: number }) => r.kind === "worm" && r.id === 0),
    };
  }, QUIET_QUESTS);
  expect(result.goldDelta).toBe(10);
  expect(result.looted).toBe(3);
  expect(result.wormscale).toBe(3);
  expect(result.wormKills).toBe(1);
  expect(result.death).toBeTruthy();
});

test("掉落受货舱上限约束：满舱时材料丢弃不入账", async ({ page }) => {
  await boot(page);
  const result = await page.evaluate((quiet) => {
    const g = window.__game!;
    const base = g.getState();
    // 基础货舱 8：装满 8 件枣椰
    g.setState({ ...base, claimedQuests: quiet, cargo: { ...base.cargo, dates: 8 } });
    const before = g.getState();
    const { state: next, looted } = g.economy.recordWormKill(before, 1, Date.now() + 90_000, 4);
    return { looted, wormscale: next.cargo.wormscale, goldDelta: next.gold - before.gold };
  }, QUIET_QUESTS);
  expect(result.looted).toBe(0);
  expect(result.wormscale).toBe(0);
  expect(result.goldDelta).toBe(10); // 赏金照发，材料丢弃
});

test("经济铁律回归：单次击杀满掉落全额变现 < 满舱香料一趟利润", async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const g = window.__game!;
    const state = g.getState();
    // 虫鳞最高回收价（saltcrest）与香料线利润都按无技能基准价计算
    const scaleTop = g.economy.unitSellPrice(state, "saltcrest", "wormscale");
    const spiceBuy = g.economy.unitBuyPrice(state, "duneskull", "spice");
    const spiceSell = g.economy.unitSellPrice(state, "oasis", "spice");
    return { scaleTop, spiceBuy, spiceSell };
  });
  const killValueMax = 10 + 4 * result.scaleTop; // 赏金 + 最大掉落×最高价
  const spiceTripProfit = (result.spiceSell - result.spiceBuy) * 8; // 基础货舱 8
  expect(killValueMax).toBeLessThan(spiceTripProfit);
});

test("打造装备并穿戴：虫鳞劈刀近战 12→26，材料被消耗", async ({ page }) => {
  await boot(page);
  const result = await page.evaluate((quiet) => {
    const g = window.__game!;
    const base = g.getState();
    g.setState({
      ...base,
      claimedQuests: quiet,
      cargo: { ...base.cargo, wormscale: 6, chitin: 4 },
    });
    const crafted = g.economy.craftItem(g.getState(), "wormscale-cleaver");
    const equipped = g.economy.equipItem(crafted, "wormscale-cleaver");
    g.setState(equipped);
    return {
      owned: equipped.ownedItems,
      weapon: equipped.equipment.weapon,
      wormscaleLeft: equipped.cargo.wormscale,
      chitinLeft: equipped.cargo.chitin,
      melee: g.getDerivedStats(equipped).meleeDamage,
      meleeBase: g.getDerivedStats(base).meleeDamage,
    };
  }, QUIET_QUESTS);
  expect(result.owned).toContain("wormscale-cleaver");
  expect(result.weapon).toBe("wormscale-cleaver");
  expect(result.wormscaleLeft).toBe(0);
  expect(result.chitinLeft).toBe(0);
  expect(result.meleeBase).toBe(12);
  expect(result.melee).toBe(26);
});

test("技能树：跳层不可点，点数不足不可点，顺序解锁生效", async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const g = window.__game!;
    // 8 个已领任务 = 4 点（floor(8/2)）；visited 留空避免链式自动发奖
    g.setState({ ...g.getState(), claimedQuests: ["a", "b", "c", "d", "e", "f", "g", "h"] });
    const s0 = g.getState();
    const skipTier = g.economy.unlockSkill(s0, "war3"); // 跳层：应原样返回
    const s1 = g.economy.unlockSkill(s0, "war1");
    const s2 = g.economy.unlockSkill(s1, "war2");
    const s3 = g.economy.unlockSkill(s2, "war3");
    const s4 = g.economy.unlockSkill(s3, "war4");
    const s5 = g.economy.unlockSkill(s4, "war5"); // 第 5 个：4 点已花完，应原样返回
    return {
      skipRejected: skipTier === s0,
      chain: s4.skills,
      pointsExhausted: s5 === s4,
      harpoonAfter: g.getDerivedStats(s4).harpoonDamage, // 20 +4(war2) = 24
      cooldownMul: g.getDerivedStats(s4).harpoonCooldownMul, // 0.9(war3)
    };
  });
  expect(result.skipRejected).toBe(true);
  expect(result.chain).toEqual(["war1", "war2", "war3", "war4"]);
  expect(result.pointsExhausted).toBe(true);
  expect(result.harpoonAfter).toBe(24);
  expect(result.cooldownMul).toBeCloseTo(0.9, 5);
});

test("存档往返：装备/技能/敌人死亡完整恢复，非法 ID 被清洗", async ({ page }) => {
  await boot(page);
  await page.evaluate((quiet) => {
    const g = window.__game!;
    const base = g.getState();
    g.setState({
      ...base,
      claimedQuests: [...quiet, "x1", "x2"], // 5 点，够 3 技能
      gold: 500,
      ownedItems: ["iron-cutlass"],
      equipment: { weapon: "iron-cutlass", harpoonMod: null, charm: null },
      skills: ["mer1", "mer2", "mer3"],
      enemyDeaths: [
        { kind: "worm", id: 0, deadUntil: Date.now() + 600_000 },
        { kind: "crab", id: 2, deadUntil: Date.now() + 600_000 },
      ],
    });
  }, QUIET_QUESTS);
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__game));
  const restored = await page.evaluate(() => {
    const g = window.__game!;
    const s = g.getState();
    return {
      weapon: s.equipment.weapon,
      owned: s.ownedItems,
      skills: s.skills,
      deaths: s.enemyDeaths.map((r: { kind: string; id: number }) => `${r.kind}-${r.id}`).sort(),
      crabDead: g.crabAgents[2].mode,
    };
  });
  expect(restored.weapon).toBe("iron-cutlass");
  expect(restored.owned).toEqual(["iron-cutlass"]);
  expect(restored.skills).toEqual(["mer1", "mer2", "mer3"]);
  expect(restored.deaths).toEqual(["crab-2", "worm-0"]);
  expect(restored.crabDead).toBe("dead");

  // 篡改存档：非法物品/跳层技能在下次加载被清洗
  await page.evaluate(() => {
    const g = window.__game!;
    g.setState({
      ...g.getState(),
      ownedItems: ["bogus-item", "iron-cutlass"],
      skills: ["war3", "mer1"], // war3 无前置应被丢弃
      equipment: { weapon: "bogus-item", harpoonMod: null, charm: null },
    });
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__game));
  const cleansed = await page.evaluate(() => {
    const s = window.__game!.getState();
    return { owned: s.ownedItems, skills: s.skills, weapon: s.equipment.weapon };
  });
  expect(cleansed.owned).toEqual(["iron-cutlass"]);
  expect(cleansed.skills).toEqual(["mer1"]);
  expect(cleansed.weapon).toBeNull();
});

test("沙蟹袭击步行船长扣 HP；击杀掉甲壳 +2g", async ({ page }) => {
  await boot(page);
  await page.evaluate((quiet) => {
    const g = window.__game!;
    g.setState({ ...g.getState(), gold: 50, claimedQuests: quiet });
    g.goAshore();
    // 传送到 0 号蟹领地中心，站着不动挨钳
    g.teleportPlayer(-700, -120);
    g.crabAgents[0].position.set(-700, 0, -130);
  }, QUIET_QUESTS);
  await expect
    .poll(async () => page.evaluate(() => window.__game!.getPlayerHp()), { timeout: 15_000 })
    .toBeLessThan(60);

  const kill = await page.evaluate(() => {
    const g = window.__game!;
    const before = g.getState();
    const died = g.damageCrab(g.crabAgents[0], 999);
    if (died) {
      const { state: next, looted } = g.economy.recordCrabKill(before, 0, Date.now() + 120_000, 2);
      g.setState(next);
      return { died, goldDelta: next.gold - before.gold, chitin: next.cargo.chitin, looted, crabKills: next.crabKills };
    }
    return { died };
  });
  expect(kill.died).toBe(true);
  expect(kill.goldDelta).toBe(2);
  expect(kill.chitin).toBe(2);
  expect(kill.crabKills).toBe(1);
});
