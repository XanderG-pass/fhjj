const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = process.env.FHJJ_TEST_URL || "http://127.0.0.1:4173";
const out = process.env.FHJJ_QA_DIR || path.join(__dirname, "output");
const executablePath = process.env.FHJJ_BROWSER || undefined;
const stateKey = "fhjj.memory.state.v1";
const commentsKey = "fhjj.local.comments";
fs.mkdirSync(out, { recursive: true });
let browser;
const results = [];
const errors = [];

async function check(name, action) {
  await action();
  results.push(name);
  console.log("PASS " + name);
}
async function context(options = {}, seed) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block", ...options });
  if (seed) await ctx.addInitScript(({ key, seed }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed)); }, { key: stateKey, seed });
  await ctx.addInitScript(() => {
    window.hapticCalls = [];
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: (pattern) => { window.hapticCalls.push(pattern); return true; } });
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base);
  await page.locator("#enterArchive").waitFor();
  return { ctx, page };
}
async function screenshot(page, name) {
  await page.waitForTimeout(550);
  await page.screenshot({ path: path.join(out, name + ".png"), animations: "disabled" });
}
async function stored(page) { return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), stateKey); }
async function frameReady(page, index) {
  await page.waitForFunction(({ key, index }) => JSON.parse(localStorage.getItem(key)).frameIndex === index, { key: stateKey, index });
  await page.waitForTimeout(170);
}
async function tapNext(page, index) {
  await page.locator("#nextFrame").click();
  await frameReady(page, index);
}
async function visibleLayout(page) {
  return page.evaluate(() => {
    const viewport = { width: innerWidth, height: innerHeight };
    const bad = [];
    const stage = document.querySelector(".stage:not([hidden])");
    const scrollable = stage.scrollHeight > stage.clientHeight + 2;
    const nodes = [...stage.querySelectorAll("button, input, textarea, h1, h2, .memo-text, .ending-copy")];
    for (const node of nodes) {
      if (!node.getClientRects().length) continue;
      const rect = node.getBoundingClientRect();
      if (rect.left < -1 || rect.right > viewport.width + 1) bad.push(node.id || node.className);
      if (!scrollable && (rect.top < -1 || rect.bottom > viewport.height + 1)) bad.push(node.id || node.className);
      if (node.scrollWidth > node.clientWidth + 2) bad.push("text-overflow:" + (node.id || node.className));
    }
    return bad;
  });
}

(async () => {
  browser = await chromium.launch({ headless: true, executablePath });
  const first = await context();
  const p = first.page;
  await check("cold start without service worker or third-party scripts", async () => {
    assert.equal(await p.locator("#stage0").isVisible(), true);
    assert.equal(await p.locator("#homeTitle").textContent(), "枫海蒹葭");
    const resources = await p.evaluate(() => performance.getEntriesByType("resource").map((r) => r.name));
    assert.equal(resources.some((r) => /gstatic|bgm\.m4a|jyy\.mp4/.test(r)), false);
    await screenshot(p, "home-mobile");
    assert.deepEqual(await visibleLayout(p), []);
  });
  await check("failed quiz, retry, rapid double-click protection and successful name entry", async () => {
    await p.locator("#enterArchive").click();
    for (let i = 0; i < 4; i++) {
      await p.locator(".option-button").first().click();
      await p.waitForTimeout(260);
    }
    assert.equal(await p.locator("#retryQuiz").isVisible(), true);
    await p.locator("#retryQuiz").click();
    const answers = [2, 1, 3, 2];
    for (let i = 0; i < 4; i++) {
      const buttons = p.locator(".option-button");
      await buttons.nth(answers[i]).evaluate((button) => { button.click(); button.click(); });
      await p.waitForTimeout(260);
      if (i < 3) assert.match(await p.locator(".question-count").textContent(), new RegExp("^0" + (i + 2)));
    }
    await p.locator("#nicknameInput").fill("时光测试者");
    await p.locator("#nameCard button").click();
    assert.equal(await p.locator("#stage2").isVisible(), true);
  });
  await check("unlock cue belongs to the actual leaf lock", async () => {
    await p.evaluate(() => { window.hapticCalls = []; });
    await p.locator("#unlockHint").click();
    await p.locator("#beginMemory").waitFor({ state: "visible" });
    assert.equal(await p.evaluate(() => window.hapticCalls.some((x) => Array.isArray(x) && x[0] === 10)), true);
    await p.locator("#beginMemory").click();
    await p.waitForFunction(() => document.querySelector("#memoryImage").naturalWidth > 0);
  });
  await check("one physical touch swipe advances exactly one frame", async () => {
    const cdp = await first.ctx.newCDPSession(p);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 170, y: 650 }] });
    for (let y = 625; y >= 250; y -= 25) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 170, y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await frameReady(p, 1);
    assert.equal((await stored(p)).frameIndex, 1);
    await p.waitForTimeout(600);
    assert.equal((await stored(p)).frameIndex, 1);
  });
  await check("continuous wheel inertia does not skip multiple frames", async () => {
    await p.evaluate(() => { for (let i = 0; i < 12; i++) document.querySelector("#scrollWorld").dispatchEvent(new WheelEvent("wheel", { deltaY: 400, bubbles: true, cancelable: true })); });
    await frameReady(p, 2);
    assert.equal((await stored(p)).frameIndex, 2);
    await p.locator("#previousFrame").click();
    await frameReady(p, 1);
  });
  await check("every original illustration and every quote is reachable, legible and persistent", async () => {
    const expected = await p.evaluate(() => window.FHJJ_STORY.memoLines.flatMap((text) => text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)));
    const total = 14 + 25 + expected.length;
    let textIndex = 0;
    for (let i = 2; i < total; i++) {
      await tapNext(p, i);
      const img = p.locator("#memoryImage");
      if (await img.isVisible()) {
        await p.waitForFunction(() => document.querySelector("#imageStatus").hidden && document.querySelector("#memoryImage").naturalWidth > 0);
        assert.equal(await img.evaluate((el) => getComputedStyle(el).objectFit), "contain");
        assert.equal(await img.evaluate((el) => getComputedStyle(el).filter), "none");
        if (i === 14) await screenshot(p, "memo-mobile");
      } else {
        assert.equal(await p.locator("#memoText").textContent(), expected[textIndex++]);
        assert.deepEqual(await visibleLayout(p), []);
      }
    }
    assert.equal(textIndex, expected.length);
    assert.equal(await p.locator("#memoText").textContent(), "“你猜呀”");
    await screenshot(p, "last-line");
    const before = (await stored(p)).frameIndex;
    await p.waitForTimeout(2200);
    assert.equal((await stored(p)).frameIndex, before);
    assert.equal(await p.evaluate(() => window.hapticCalls.filter((x) => Array.isArray(x) && x[0] === 100).length), 1);
  });
  await check("pickup label works and haptics stop as the pair appears", async () => {
    await p.locator("#nextFrame").click();
    await p.locator("#wearPods").click();
    await p.locator("#podsPair").waitFor({ state: "visible" });
    assert.equal(await p.locator("#casePickup").isVisible(), false);
    assert.match(await p.locator("#wearPods").textContent(), /点击戴上/);
    assert.equal(await p.evaluate(() => window.hapticCalls.at(-1)), 0);
    await screenshot(p, "earphones-mobile");
  });
  await check("video is not skipped when autoplay is rejected", async () => {
    await p.evaluate(() => { document.querySelector("#jyyVideo").play = () => Promise.reject(new DOMException("Blocked", "NotAllowedError")); });
    await p.locator("#wearPods").click();
    await p.locator("#videoFallback").waitFor({ state: "visible" });
    assert.equal(await p.locator("#stage4").isVisible(), true);
    await p.evaluate(() => { delete document.querySelector("#jyyVideo").play; });
    await p.locator("#retryVideo").click();
    await p.waitForFunction(() => document.querySelector("#jyyVideo").currentTime > 0, null, { timeout: 12000 });
    assert.equal(await p.locator("#videoFallback").isVisible(), false);
    assert.equal(await p.locator("#jyyVideo").evaluate((el) => getComputedStyle(el).objectFit), "contain");
    await p.locator("#skipFilm").click();
  });
  await check("ending haptic fires on bubble appearance, not only its click", async () => {
    await p.locator("#traceButton").waitFor({ state: "visible" });
    assert.equal(await p.evaluate(() => window.hapticCalls.some((x) => Array.isArray(x) && x[0] === 12)), true);
    await screenshot(p, "ending-mobile");
    await p.locator("#traceButton").click();
  });
  await check("review persistence, literal markup and draft retention after reload", async () => {
    const review = "风铃还在。<img src=x onerror=alert(1)>";
    await p.locator("#reviewInput").fill(review);
    await p.locator("#sendReview").click();
    await p.waitForFunction(() => document.querySelector("#reviewStatus").textContent.includes("已保存"));
    assert.equal(await p.locator(".comment-content").last().textContent(), review);
    assert.equal(await p.locator("#commentSea img").count(), 0);
    await p.locator("#reviewInput").fill("还没有写完的想念");
    await p.waitForTimeout(350);
    await p.reload();
    assert.equal(await p.locator("#stage0").isVisible(), true);
    await p.locator("#enterArchive").click();
    assert.equal(await p.locator("#reviewInput").inputValue(), "还没有写完的想念");
    assert.equal(await p.locator(".comment-content").last().textContent(), review);
    await screenshot(p, "reviews-mobile");
  });
  await first.ctx.close();

  await check("old progress migration and return to saved frame", async () => {
    const {ctx, page} = await context({}, { quizDone: true, nickname: "旧读者", currentStage: 3, scrollProgress: 14.1 });
    await page.locator("#enterArchive").click();
    assert.equal((await stored(page)).frameIndex, 14);
    await page.locator("#nextFrame").click();
    await frameReady(page, 15);
    await page.locator("#goHome").click();
    await page.locator("#enterArchive").click();
    assert.equal((await stored(page)).frameIndex, 15);
    await ctx.close();
  });
  await check("blocked storage does not prevent reading and preserves unsaved review", async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    await ctx.addInitScript(({key}) => {
      const get = Storage.prototype.getItem;
      Storage.prototype.getItem = function(name) { return name === key ? JSON.stringify({ quizDone: true, nickname: "隐私读者", currentStage: 6 }) : get.call(this, name); };
      Storage.prototype.setItem = function() { throw new DOMException("Denied", "SecurityError"); };
    }, {key:stateKey});
    const page = await ctx.newPage();
    page.on("pageerror",e=>errors.push(String(e)));
    await page.goto(base);
    await page.locator("#enterArchive").click();
    await page.locator("#reviewInput").fill("不要丢掉这句话");
    await page.locator("#sendReview").click();
    assert.equal(await page.locator("#reviewInput").inputValue(), "不要丢掉这句话");
    assert.match(await page.locator("#reviewStatus").textContent(), /无法保存/);
    await ctx.close();
  });
  await check("missing image retry, navigation while loading, and stale callbacks", async () => {
    const {ctx, page} = await context({}, { quizDone: true, nickname: "读者", currentStage: 3, frameIndex: 14 });
    await page.route("**/memo/memo1.jpg", route => route.abort());
    await page.locator("#enterArchive").click();
    await page.locator("#retryImage").waitFor({ state: "visible" });
    await page.unroute("**/memo/memo1.jpg");
    await page.locator("#retryImage").click();
    await page.waitForFunction(() => document.querySelector("#imageStatus").hidden);
    await page.locator("#goHome").click();
    await page.locator("#restartMemory").click();
    await page.locator("#unlockHint").click();
    await page.locator("#goHome").click();
    await page.waitForTimeout(1200);
    assert.equal(await page.locator("#stage0").isVisible(), true);
    await ctx.close();
  });
  await check("reduced motion suppresses impact and haptics", async () => {
    const {ctx, page} = await context({ reducedMotion: "reduce" }, { quizDone: true, nickname: "读者", currentStage: 2 });
    await page.locator("#enterArchive").click();
    await page.locator("#unlockHint").click();
    await page.locator("#beginMemory").waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => window.hapticCalls.filter((p) => p !== 0).length), 0);
    await ctx.close();
  });
  await check("small phones, wide phones, landscape and desktop layouts", async () => {
    for (const size of [{width:320,height:568},{width:360,height:640},{width:430,height:932},{width:844,height:390},{width:1440,height:960}]) {
      const {ctx, page} = await context({viewport:size,isMobile:size.width<900}, { quizDone: true, nickname: "读者", currentStage: 3, frameIndex: 15 });
      await screenshot(page, "home-" + size.width + "x" + size.height);
      assert.deepEqual(await visibleLayout(page), [], "home " + JSON.stringify(size));
      await page.locator("#enterArchive").click();
      await screenshot(page, "reader-" + size.width + "x" + size.height);
      assert.deepEqual(await visibleLayout(page), [], "reader " + JSON.stringify(size));
      await page.locator("#goHome").click();
      await page.evaluate((key) => { const s=JSON.parse(localStorage.getItem(key)); s.currentStage=5; localStorage.setItem(key,JSON.stringify(s)); },stateKey);
      await page.reload();
      await page.locator("#enterArchive").click();
      await page.locator("#traceButton").waitFor({ state:"visible" });
      assert.deepEqual(await visibleLayout(page), [], "ending " + JSON.stringify(size));
      await ctx.close();
    }
  });
  await check("service worker caches the shell and supports offline entry", async () => {
    const ctx = await browser.newContext({ serviceWorkers: "allow" });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(base);
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await ctx.setOffline(true);
    await page.reload();
    await page.locator("#enterArchive").click();
    assert.equal(await page.locator("#quizPanel h2").textContent(), "江云雁2020年跃迁时的工服是什么颜色？");
    await ctx.close();
  });
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out,"results.json"), JSON.stringify({passed:results,errors},null,2));
  console.log("ALL PASS: " + results.length + " scenario groups");
})().catch((error) => { console.error(error); process.exitCode=1; }).finally(async()=>{ await browser?.close(); });
