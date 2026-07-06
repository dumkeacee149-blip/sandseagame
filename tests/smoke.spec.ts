import { test, expect, type Page } from "@playwright/test";

// 冒烟测试：每次改动的护航线。依赖 DEV-only 的 window.__game 钩子（生产构建无此对象）。

declare global {
  interface Window {
    __game?: {
      teleport(x: number, z: number, heading?: number): void;
      teleportPlayer(x: number, z: number, heading?: number): void;
      getMode(): "sailing" | "walking";
      getState(): {
        gold: number;
        cargo: Record<string, number>;
        hull: number;
        docking: { kind: "sailing" | "docked"; portId?: string };
      };
      setState(state: unknown): void;
      goAshore(): void;
      boardShip(): void;
      clearSave(): void;
      wormAi: {
        mode: "patrol" | "chase" | "bite" | "dive" | "return";
        position: { set(x: number, y: number, z: number): void };
        heading: number;
      };
    };
  }
}

async function boot(page: Page, path = "/") {
  await page.goto(path);
  await page.waitForFunction(() => Boolean(window.__game));
  // 干净存档，测试相互独立
  await page.evaluate(() => window.__game!.clearSave());
}


// 经济测试种子：注入本金并预标已领任务（任务奖励不再污染精确数字断言）
async function seedTradingGold(page: Page) {
  await page.evaluate(() => {
    const g = window.__game!;
    g.setState({
      ...(g.getState() as object),
      gold: 60,
      claimedQuests: [
        "ashore", "crate", "first-buy", "first-sale", "nest-egg",
        "saltcrest", "survive", "duneskull", "upgrade", "sail2",
      ],
    });
  });
}

function pressKey(page: Page, code: string) {
  return page.evaluate((keyCode) => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code: keyCode }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: keyCode }));
  }, code);
}

test("页面加载无报错，HUD 就位", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await boot(page);
  await expect(page.locator("#speed")).toBeVisible();
  await expect(page.locator("#gold")).toHaveText("0");
  await expect(page.locator("#minimap")).toBeVisible();
  expect(errors).toEqual([]);
});

test("WASD 航行：按 W 速度上升，松开回落", async ({ page }) => {
  await boot(page);
  await page.keyboard.down("KeyW");
  await expect.poll(async () => Number(await page.locator("#speed").textContent()), { timeout: 5_000 }).toBeGreaterThan(5);
  await page.keyboard.up("KeyW");
  await expect.poll(async () => Number(await page.locator("#speed").textContent()), { timeout: 8_000 }).toBeLessThan(3);
});

test("交易闭环：绿洲买枣椰 → Saltcrest 卖出，金币先减后增", async ({ page }) => {
  await boot(page);
  await seedTradingGold(page);

  // 绿洲集市买入
  await page.evaluate(() => {
    const g = window.__game!;
    g.teleport(-520, -140, Math.PI);
    g.goAshore();
    g.teleportPlayer(-640, -400, Math.PI);
  });
  await expect(page.locator("#action")).toContainText("trade at Oasis Harbor");
  await pressKey(page, "KeyE");
  await expect(page.locator("#trade-panel")).toBeVisible();
  await page.locator('button[data-action="buy"][data-good="dates"][data-qty="5"]').click();
  await expect(page.locator("#gold")).toHaveText("40");
  await expect(page.locator("#cargo")).toHaveText("5/8");
  await pressKey(page, "Escape");

  // 去 Saltcrest 卖出
  await page.evaluate(() => {
    const g = window.__game!;
    g.boardShip();
    g.teleport(340, 480, 0);
    g.goAshore();
    g.teleportPlayer(300, 660, 0);
  });
  await expect(page.locator("#action")).toContainText("trade at Saltcrest");
  await pressKey(page, "KeyE");
  await page.locator('button[data-action="sell"][data-good="dates"][data-qty="5"]').click();
  await expect(page.locator("#gold")).toHaveText("75");
  await expect(page.locator("#cargo")).toHaveText("0/8");
});

test("存档持久化：交易后刷新页面进度保留", async ({ page }) => {
  await boot(page);
  await seedTradingGold(page);
  await page.evaluate(() => {
    const g = window.__game!;
    g.teleport(-520, -140, Math.PI);
    g.goAshore();
    g.teleportPlayer(-640, -400, Math.PI);
  });
  await pressKey(page, "KeyE");
  await expect(page.locator("#trade-panel")).toBeVisible();
  await page.locator('button[data-action="buy"][data-good="dates"][data-qty="1"]').click();
  await expect(page.locator("#gold")).toHaveText("56");

  await page.reload();
  await page.waitForFunction(() => Boolean(window.__game));
  await expect(page.locator("#gold")).toHaveText("56");
  await expect(page.locator("#cargo")).toHaveText("1/8");
});

test("靠港下船会修满船壳，上船后回到航行状态", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const g = window.__game!;
    g.setState({ ...g.getState(), hull: 35 });
    g.teleport(-520, -380, Math.PI);
    g.goAshore();
  });

  await expect.poll(async () => (await page.evaluate(() => window.__game!.getState())).hull).toBe(100);
  await expect.poll(async () => (await page.evaluate(() => window.__game!.getState())).docking.kind).toBe("docked");

  await page.evaluate(() => window.__game!.boardShip());
  await expect.poll(async () => (await page.evaluate(() => window.__game!.getState())).docking.kind).toBe("sailing");
});

test("巨兽咬击会进入 bite 状态再下潜", async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const g = window.__game!;
    g.teleport(760, -680, 0);
    g.wormAi.position.set(760, 0, -680);
    g.wormAi.heading = 0;
    g.wormAi.mode = "chase";
  });

  await expect.poll(async () => page.evaluate(() => window.__game!.wormAi.mode), { timeout: 1_000 }).toBe("bite");
  await expect.poll(async () => page.evaluate(() => window.__game!.wormAi.mode), { timeout: 2_000 }).toBe("dive");
});

test("触屏布局不遮挡底部操作区，并提供攻击按钮", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });
  await boot(page, "/?touch=1");
  await expect(page.locator(".touch-button-attack")).toBeVisible();

  const overlapPairs = await page.evaluate(() => {
    const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
    const overlaps = (a: DOMRect, b: DOMRect) =>
      Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
        Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) >
      0;
    const controls = [".touch-stick", ".touch-button-action", ".touch-button-attack", ".touch-button-jump"];
    const overlays = [".route-chip", ".action-chip"];
    const pairs: string[] = [];
    for (const overlay of overlays) {
      for (const control of controls) {
        if (overlaps(rect(overlay), rect(control))) pairs.push(`${overlay} x ${control}`);
      }
    }
    return pairs;
  });
  expect(overlapPairs).toEqual([]);
});
