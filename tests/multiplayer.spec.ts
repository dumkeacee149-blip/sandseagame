import { test, expect, type Page, type TestInfo } from "@playwright/test";

// 同世界在线（P0）：两个玩家互见对方的船；一钱包一船（重复连接踢旧）。
// presence 服务器由 playwright.config.ts 起本地实例，与线上 Worker 共用协议逻辑。

const PRESENCE_WS = "ws://127.0.0.1:8790/presence";

declare global {
  interface Window {
    __game?: {
      clearSave(): void;
      teleport(x: number, z: number, heading?: number): void;
      presenceDebug(): {
        connected: boolean;
        selfId: string | null;
        players: Array<{ id: string; name: string; x: number; z: number }>;
      };
    };
  }
}

function roomFor(testInfo: TestInfo) {
  return [testInfo.project.name, testInfo.workerIndex, testInfo.repeatEachIndex, ...testInfo.titlePath]
    .join("-")
    .replace(/[^a-z0-9_-]+/gi, "-");
}

async function bootPlayer(page: Page, pid: string, room: string) {
  const presenceUrl = `${PRESENCE_WS}?room=${encodeURIComponent(room)}`;
  await page.goto(`/?presence=${encodeURIComponent(presenceUrl)}&pid=${pid}`);
  await page.waitForFunction(() => Boolean(window.__game));
  await page.evaluate(() => window.__game!.clearSave());
  await expect
    .poll(async () => page.evaluate(() => window.__game!.presenceDebug().connected), {
      timeout: 10_000,
    })
    .toBe(true);
}

function remoteOf(page: Page, id: string) {
  return page.evaluate(
    (targetId) => window.__game!.presenceDebug().players.find((p) => p.id === targetId) ?? null,
    id,
  );
}

test("两个玩家进入同一世界，互相看到对方的船并跟随移动", async ({ browser }, testInfo) => {
  const room = roomFor(testInfo);
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await bootPlayer(pageA, "captain-a", room);
  await bootPlayer(pageB, "captain-b", room);

  // A 把船开到指定位置 → B 的世界里出现 A 的船且位置一致
  await pageA.evaluate(() => window.__game!.teleport(300, 300, 1));
  await expect
    .poll(async () => (await remoteOf(pageB, "captain-a"))?.x ?? null, { timeout: 10_000 })
    .toBeCloseTo(300, 0);
  expect((await remoteOf(pageB, "captain-a"))?.z).toBeCloseTo(300, 0);

  // 反向：B 移动 → A 看到
  await pageB.evaluate(() => window.__game!.teleport(-200, 500));
  await expect
    .poll(async () => (await remoteOf(pageA, "captain-b"))?.x ?? null, { timeout: 10_000 })
    .toBeCloseTo(-200, 0);

  // A 持续移动 → B 侧位置跟随更新
  await pageA.evaluate(() => window.__game!.teleport(360, 260));
  await expect
    .poll(async () => (await remoteOf(pageB, "captain-a"))?.x ?? null, { timeout: 10_000 })
    .toBeCloseTo(360, 0);

  // B 的场景中确实渲染了远端船实体（名牌 Sprite 挂在船组上）
  const remoteShipInScene = await pageB.evaluate(() => {
    const scene = (window.__game as unknown as { scene: { traverse(cb: (o: unknown) => void): void } })
      .scene;
    let sprites = 0;
    scene.traverse((obj) => {
      if ((obj as { isSprite?: boolean }).isSprite) sprites += 1;
    });
    return sprites;
  });
  expect(remoteShipInScene).toBeGreaterThan(0);

  await contextA.close();
  await contextB.close();
});

test("一钱包一船：同一身份重复连接会踢掉旧会话", async ({ browser }, testInfo) => {
  test.setTimeout(75_000);
  const room = roomFor(testInfo);
  const contextOld = await browser.newContext();
  const contextNew = await browser.newContext();
  const contextWatcher = await browser.newContext();
  const pageOld = await contextOld.newPage();
  const pageWatcher = await contextWatcher.newPage();

  await bootPlayer(pageOld, "captain-dup", room);
  await bootPlayer(pageWatcher, "captain-watcher", room);
  await pageOld.evaluate(() => window.__game!.teleport(100, 100));

  // 同一身份第二次连接
  const pageNew = await contextNew.newPage();
  await bootPlayer(pageNew, "captain-dup", room);

  // 旧会话被断开且不再自动重连
  await expect
    .poll(async () => pageOld.evaluate(() => window.__game!.presenceDebug().connected), {
      timeout: 10_000,
    })
    .toBe(false);

  // 旁观者的世界里 captain-dup 只有一艘船（新会话的）
  await pageNew.evaluate(() => window.__game!.teleport(-400, -400));
  await expect
    .poll(async () => (await remoteOf(pageWatcher, "captain-dup"))?.x ?? null, { timeout: 10_000 })
    .toBeCloseTo(-400, 0);
  const dupCount = await pageWatcher.evaluate(
    () => window.__game!.presenceDebug().players.filter((p) => p.id === "captain-dup").length,
  );
  expect(dupCount).toBe(1);

  await contextOld.close();
  await contextNew.close();
  await contextWatcher.close();
});

test("未配置 presence 地址时保持纯单机：不建立连接、无远端玩家", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(window.__game));
  const debug = await page.evaluate(() => window.__game!.presenceDebug());
  expect(debug.connected).toBe(false);
  expect(debug.players).toEqual([]);
});
