(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const stateKey = "fhjj.memory.state.v1";
  const sessionKey = "fhjj.memory.session.v1";
  const imageBase = {
    wall: "images/wall.jpg",
    blackLeaf: "images/blackleaf.PNG",
    blackLock: "images/blacklock.PNG",
    caseImage: "images/ap4m.PNG",
    podLeft: "images/ap4left.PNG",
    podRight: "images/ap4right.PNG"
  };

  const questions = [
    {
      text: "江云雁2020年跃迁时的工服是什么颜色？",
      options: ["白色", "黑色", "绿色", "都不对"],
      answer: "绿色"
    },
    {
      text: "何愉辉二人第一次在江云雁餐厅点的什么食物？",
      options: ["卤肉面", "肉酱披萨", "兰州拉面", "都不对"],
      answer: "肉酱披萨"
    },
    {
      text: "江云雁的笔记本电脑是什么品牌？",
      options: ["微软", "华为", "小米", "都不对"],
      answer: "都不对"
    },
    {
      text: "江云雁喜欢的歌手？",
      options: ["邓紫棋", "苏打绿", "周杰伦", "Queen"],
      answer: "周杰伦"
    }
  ];

  const memoLines = [
    "“每天盯着这张照片一个小时，男人美名曰其为‘跨越维度的心灵交流’”",
    "“考试的时候怎么没见你直觉准过？”\n\n“骗人死老冯”",
    "“这饮料都是刚端上来的我不会下毒的我的老天...”\n\n“噗-”",
    "“怎样啊，你要牵我手啊”\n\n“滚...滚啊，给我点纸擦手嘛...”",
    "“你今天好奇怪哦”\n\n“有吗”",
    "“假如你是叶湘伦，你会回到琴房弹奏《Secret》吗？”\n\n当然",
    "“他说我又不会去世，日子长着呢”\n\n“我为什么不早点开始写日记呢？”",
    "“他说，苦的东西好像喝不腻”\n\n“我尝了一杯，刚开始挺苦的，慢慢也习惯了”",
    "“干嘛干嘛...”\n\n“先擦擦嘴啊，亲的我满脸都是油...”",
    "“所以你看。”\n\n“我这人挺熟练的，对于接受这种事...”",
    "“明天...就在家吧。”\n\n“我想多看看你...”",
    "“就这样看着他，安安静静的，真好...”\n\n“他应该快醒了，就写到这吧。”",
    "“你是个天才！孩子，你的运算完全正确！”\n\n“操！！！”",
    "“你是不是要走”\n\n“嗯”\n\n“他妈的高深呢！”\n\n“他没有错”",
    "“你...是不是...放东西了...”\n\n“睡吧。”",
    "“你可以叫我一声...宝贝吗？”\n\n“...宝贝。”",
    "“这家热干面...她很喜欢吃。”\n\n“操你妈！”",
    "“现在是几几年？”\n\n“你板住头了学生？”",
    "“oi.”\n\n“哪天我要是猝死在这里了，记得帮我清理浏览记录。”\n\n“高深，你...哈哈，你长白头发了！”\n\n“小子，你比我多两根！”",
    "“过得好快啊...”\n\n“是啊，好快啊...”",
    "“祝你好运，我的兄弟。”\n\n“咚！！！！！”",
    "“文字...时间之河...”\n\n“传给...想看的人！！！”",
    "“是他！”\n\n“真的是他！”",
    "“走吧...”\n\n“我们去香山。”",
    "“那女孩最后回来了吗？”\n\n“你猜呀”"
  ];

  const PIC_COUNT = 14;
  const MEMO_SPEED_SCALE = 0.18;
  const MEMO_UNIT = 4.2;
  const MEMO_TEXT_START = 0.34;
  const MEMO_TEXT_END = 0.78;

  const els = {
    loader: $("loader"),
    stages: Array.from(document.querySelectorAll(".stage")),
    quizPanel: $("quizPanel"),
    verifyCard: $("verifyCard"),
    rejectText: $("rejectText"),
    homeButton: $("homeButton"),
    nameCard: $("nameCard"),
    nicknameInput: $("nicknameInput"),
    nicknameSubmit: $("nicknameSubmit"),
    leafLock: $("leafLock"),
    blackLeaf: $("blackLeaf"),
    blackLock: $("blackLock"),
    unlockHint: $("unlockHint"),
    beginMemory: $("beginMemory"),
    scrollWorld: $("scrollWorld"),
    picA: $("picA"),
    picB: $("picB"),
    memoImage: $("memoImage"),
    memoText: $("memoText"),
    casePickup: $("casePickup"),
    caseImage: $("caseImage"),
    podsPair: $("podsPair"),
    podLeft: $("podLeft"),
    podRight: $("podRight"),
    wearPods: $("wearPods"),
    bgm: $("bgm"),
    voice: $("voice"),
    tone: $("tone"),
    video: $("jyyVideo"),
    endingCopy: $("endingCopy"),
    traceButton: $("traceButton"),
    backToMemory: $("backToMemory"),
    reviewInput: $("reviewInput"),
    sendReview: $("sendReview"),
    commentSea: $("commentSea")
  };

  const store = loadState();
  let currentStage = store.currentStage || 1;
  let quizIndex = 0;
  let quizCorrect = 0;
  let phase2Locked = false;
  let phase4Step = 0;
  let activePic = 0;
  let currentPicNumber = 0;
  let rafId = 0;
  let targetProgress = store.scrollProgress || 0;
  let easedProgress = targetProgress;
  let lastMemoIndex = -1;
  let interactionLocked = false;
  let firebaseDb = null;
  let unsubscribeComments = null;
  const bestImageCache = new Map();
  const triggeredMoments = new Set();

  const resources = buildResourceList();

  // Global error reporting to surface initialization or runtime errors
  window.addEventListener("error", (ev) => {
    try {
      const loader = document.getElementById("loader");
      if (loader) loader.querySelector(".loader-panel p").textContent = `加载失败: ${ev.message || ev.error || ev.filename || "未知错误"}`;
    } catch (e) {
      // swallow
    }
    // still log to console
    // eslint-disable-next-line no-console
    console.error(ev.error || ev.message || ev);
  });

  window.addEventListener("unhandledrejection", (ev) => {
    try {
      const loader = document.getElementById("loader");
      if (loader) loader.querySelector(".loader-panel p").textContent = `加载失败: ${ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason)}`;
    } catch (e) {
      // swallow
    }
    // eslint-disable-next-line no-console
    console.error("Unhandled promise rejection:", ev.reason);
  });

  document.addEventListener("contextmenu", (event) => {
    if (event.target.closest("img, video")) event.preventDefault();
  });

  window.addEventListener("beforeunload", () => {
    saveState({ scrollProgress: targetProgress, currentStage });
  });

  // start initialization and surface any errors to the loader UI so user isn't stuck
  init().catch((err) => {
    try {
      const loader = document.getElementById("loader");
      if (loader) loader.querySelector(".loader-panel p").textContent = `加载失败: ${err && err.message ? err.message : String(err)}`;
    } catch (e) {
      // swallow
    }
    // eslint-disable-next-line no-console
    console.error("Initialization error:", err);
  });

  async function init() {
    applyPlatformFallbacks();
    applyImageSources();
    registerServiceWorker();
    bindEvents();
    initSession();
    await preloadEverything();
    els.loader.classList.add("is-hidden");

    const shouldResume = store.quizDone && store.nickname && currentStage > 1;
    showStage(shouldResume ? currentStage : 1);
    if (shouldResume && currentStage === 3) startMemoryScroll();
    if (shouldResume && currentStage === 6) initComments();
  }

  function applyPlatformFallbacks() {
    const ua = navigator.userAgent || "";
    if (/Android|Quark|UCBrowser|HuaweiBrowser|HeyTapBrowser/i.test(ua)) {
      document.body.classList.add("android-fallback");
    }
  }

  function buildResourceList() {
    const list = [
      "index.html",
      "style.css",
      "script.js",
      "firebase-config.js",
      "manifest.json",
      ...Object.values(imageBase),
      "music/bgm.m4a",
      "jyy/jyy.mp4"
    ];
    for (let i = 1; i <= 14; i += 1) list.push(`pic/pic${i}.jpg`);
    for (let i = 1; i <= 26; i += 1) list.push(`memo/memo${i}.jpg`);
    return list;
  }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(stateKey)) || {};
    } catch {
      return {};
    }
  }

  function saveState(next) {
    const merged = { ...loadState(), ...next };
    localStorage.setItem(stateKey, JSON.stringify(merged));
    sessionStorage.setItem(sessionKey, JSON.stringify({
      currentStage: merged.currentStage,
      scrollProgress: merged.scrollProgress,
      quizDone: merged.quizDone
    }));
  }

  function initSession() {
    if (!store.uuid) {
      saveState({ uuid: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}` });
    }
  }

  async function bestImage(path) {
    if (bestImageCache.has(path)) return bestImageCache.get(path);
    const webp = path.replace(/\.(jpg|jpeg|png)$/i, ".webp");
    const resolved = await canLoad(webp) ? webp : path;
    bestImageCache.set(path, resolved);
    return resolved;
  }

  function canLoad(path) {
    return new Promise((resolve) => {
      const img = new Image();
      const timeout = setTimeout(() => resolve(false), 5000);
      img.onload = () => {
        clearTimeout(timeout);
        resolve(true);
      };
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
      img.src = path;
    });
  }

  async function applyImageSources() {
    els.blackLeaf.src = await bestImage(imageBase.blackLeaf);
    els.blackLock.src = await bestImage(imageBase.blackLock);
    await setAirPodsImage(els.caseImage, imageBase.caseImage);
    await setAirPodsImage(els.podLeft, imageBase.podLeft);
    await setAirPodsImage(els.podRight, imageBase.podRight);
  }

  async function setAirPodsImage(img, src) {
    img.onerror = () => {
      if (!img.dataset.rawFallback) {
        img.dataset.rawFallback = "1";
        img.src = src;
      }
    };
    img.src = await bestImage(src);
  }

  async function preloadEverything() {
    await notifyServiceWorker();
    const tasks = resources.map((resource) => {
      if (/\.(jpg|jpeg|png|webp)$/i.test(resource)) return preloadImage(resource);
      if (/\.(m4a|mp3|mp4)$/i.test(resource)) return warmFetch(resource);
      return warmFetch(resource);
    });
    await Promise.allSettled(tasks);
  }

  async function preloadImage(resource) {
    const src = await bestImage(resource);
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.loading = "eager";
      img.onload = resolve;
      img.onerror = resolve;
      img.src = src;
    });
  }

  function warmFetch(resource) {
    const options = /^https?:\/\//i.test(resource)
      ? { cache: "force-cache", mode: "no-cors" }
      : { cache: "force-cache" };
    return fetch(resource, options).catch(() => undefined);
  }

  async function notifyServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.ready.catch(() => null);
    const worker = registration?.active || navigator.serviceWorker.controller;
    if (worker) worker.postMessage({ type: "CACHE_URLS", urls: resources });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      try {
        const loader = document.getElementById("loader");
        if (loader) loader.querySelector(".loader-panel p").textContent = `ServiceWorker 注册失败: ${err && err.message ? err.message : String(err)}`;
      } catch (e) {
        // swallow
      }
      // eslint-disable-next-line no-console
      console.error("ServiceWorker register error:", err);
    });
  }

  function bindEvents() {
    els.homeButton.addEventListener("click", resetQuiz);
    els.nicknameSubmit.addEventListener("click", submitName);
    els.nicknameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") submitName();
    });
    els.unlockHint.addEventListener("click", unlockLeaf);
    els.leafLock.addEventListener("click", unlockLeaf);
    els.beginMemory.addEventListener("click", enterStage3);
    els.casePickup.addEventListener("click", pickupCase);
    els.wearPods.addEventListener("click", wearPods);
    els.video.addEventListener("ended", enterStage5);
    els.traceButton.addEventListener("click", () => {
      showStage(6);
      initComments();
    });
    els.backToMemory.addEventListener("click", () => {
      stopMemoryScroll();
      showStage(2);
    });
    els.sendReview.addEventListener("click", submitReview);
  }

  function showStage(stage) {
    currentStage = stage;
    saveState({ currentStage: stage });
    els.stages.forEach((element) => {
      element.classList.toggle("is-active", Number(element.dataset.stage) === stage);
    });

    if (stage === 1) renderQuestion();
    if (stage === 2) enterStage2();
    if (stage === 4) enterStage4();
    if (stage === 5) stage5Sequence();
  }

  function renderQuestion() {
    if (store.quizDone) {
      showNameCard();
      return;
    }
    const question = questions[quizIndex];
    els.quizPanel.classList.remove("fade");
    els.quizPanel.innerHTML = `
      <p class="question-count">${quizIndex + 1} / ${questions.length}</p>
      <p class="question-title">${question.text}</p>
      <div class="option-list">
        ${question.options.map((option) => `<button class="option-button" type="button">${option}</button>`).join("")}
      </div>
    `;
    Array.from(els.quizPanel.querySelectorAll(".option-button")).forEach((button) => {
      button.addEventListener("click", () => answerQuestion(button.textContent));
    });
  }

  async function answerQuestion(answer) {
    if (answer === questions[quizIndex].answer) quizCorrect += 1;
    els.quizPanel.classList.add("fade");
    await wait(310);
    quizIndex += 1;

    if (quizIndex < questions.length) {
      renderQuestion();
      return;
    }

    if (quizCorrect >= 3) {
      saveState({ quizDone: true });
      showNameCard();
      return;
    }

    reject();
  }

  async function reject() {
    els.verifyCard.classList.add("is-shaking");
    els.rejectText.classList.add("show");
    await wait(900);
    els.rejectText.classList.remove("show");
    els.homeButton.classList.add("show");
    await wait(420);
    els.verifyCard.classList.remove("is-shaking");
  }

  function resetQuiz() {
    quizIndex = 0;
    quizCorrect = 0;
    els.homeButton.classList.remove("show");
    renderQuestion();
  }

  function showNameCard() {
    els.verifyCard.style.display = "none";
    els.nameCard.classList.add("show");
    els.nameCard.setAttribute("aria-hidden", "false");
    els.nicknameInput.value = loadState().nickname || "";
    window.setTimeout(() => els.nicknameInput.focus({ preventScroll: true }), 500);
  }

  async function submitName() {
    const nickname = els.nicknameInput.value.trim();
    if (!nickname) return;
    saveState({
      nickname,
      uuid: loadState().uuid || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)
    });
    $("stage1").classList.add("to-white");
    await wait(1900);
    showStage(2);
  }

  async function enterStage2() {
    stopMemoryScroll();
    phase2Locked = false;
    $("stage2").classList.remove("darkening");
    els.leafLock.classList.remove("ready", "weathered");
    els.unlockHint.classList.remove("hidden");
    els.beginMemory.classList.remove("show");
    await wait(1000);
    els.leafLock.classList.add("ready");
  }

  async function unlockLeaf() {
    if (phase2Locked) return;
    phase2Locked = true;
    els.unlockHint.classList.add("hidden");
    els.leafLock.classList.add("weathered");
    $("stage2").classList.add("darkening");
    await wait(3600);
    els.beginMemory.classList.add("show");
  }

  async function enterStage3() {
    // Reset scroll progress to beginning of memory for new playthrough
    saveState({ scrollProgress: 0 });
    await fadeInBgm();
    showStage(3);
    startMemoryScroll();
  }

  async function fadeInBgm() {
    els.bgm.volume = 0;
    await els.bgm.play().catch(() => undefined);
    for (let i = 0; i <= 26; i += 1) {
      els.bgm.volume = Math.min(0.62, i / 42);
      await wait(70);
    }
  }

  function startMemoryScroll() {
    stopMemoryScroll();
    targetProgress = clamp(loadState().scrollProgress || 0, 0, getTotalMemoryProgress());
    easedProgress = targetProgress;
    lastMemoIndex = -1;
    updateMemoryFrame(true);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    rafId = requestAnimationFrame(tickMemory);
  }

  function stopMemoryScroll() {
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  let touchY = 0;

  function onTouchStart(event) {
    touchY = event.touches[0]?.clientY || 0;
  }

  function onTouchMove(event) {
    event.preventDefault();
    if (interactionLocked) return;
    const y = event.touches[0]?.clientY || touchY;
    pushMemory((touchY - y) * 0.018);
    touchY = y;
  }

  function onWheel(event) {
    event.preventDefault();
    if (interactionLocked) return;
    pushMemory(event.deltaY * 0.006);
  }

  function pushMemory(delta) {
    const nextRaw = targetProgress + delta;
    const crossesIntoMemo = targetProgress < PIC_COUNT && nextRaw > PIC_COUNT;
    const scaledDelta = targetProgress >= PIC_COUNT
      ? delta * MEMO_SPEED_SCALE
      : crossesIntoMemo
        ? (PIC_COUNT - targetProgress) + ((nextRaw - PIC_COUNT) * MEMO_SPEED_SCALE)
        : delta;
    targetProgress = clamp(targetProgress + scaledDelta, 0, getTotalMemoryProgress());
    saveState({ scrollProgress: targetProgress, currentStage: 3 });
  }

  function getTotalMemoryProgress() {
    return PIC_COUNT + (memoLines.length * MEMO_UNIT) + 0.8;
  }

  function tickMemory() {
    if (!interactionLocked) {
      // slower follow for stronger inertia / delayed follow feeling
      easedProgress += (targetProgress - easedProgress) * 0.055;
    }
    updateMemoryFrame(false);
    rafId = requestAnimationFrame(tickMemory);
  }

  async function updateMemoryFrame(force) {
    const parallaxX = Math.sin(easedProgress * 0.55) * 9;
    const parallaxY = Math.cos(easedProgress * 0.43) * 10;
    els.scrollWorld.style.setProperty("--px", `${parallaxX}px`);
    els.scrollWorld.style.setProperty("--py", `${parallaxY}px`);
    els.scrollWorld.style.setProperty("--scale", `${1 + Math.sin(easedProgress) * 0.008}`);

    if (easedProgress < PIC_COUNT) {
      const picNumber = clamp(PIC_COUNT - Math.floor(easedProgress), 1, PIC_COUNT);
      const next = activePic ? els.picA : els.picB;
      const prev = activePic ? els.picB : els.picA;
      if (force || currentPicNumber !== picNumber) {
        next.src = await bestImage(`pic/pic${picNumber}.jpg`);
        next.classList.add("show");
        prev.classList.remove("show");
        activePic = activePic ? 0 : 1;
        currentPicNumber = picNumber;
      }
      els.memoImage.classList.remove("show");
      els.memoText.classList.remove("show", "cosmic");
      return;
    }

    els.picA.classList.remove("show");
    els.picB.classList.remove("show");
    const memoProgress = easedProgress - PIC_COUNT;
    const memoIndex = clamp(Math.floor(memoProgress / MEMO_UNIT), 0, memoLines.length - 1);

    if (memoIndex !== lastMemoIndex || force) {
      lastMemoIndex = memoIndex;
      els.memoImage.src = await bestImage(`memo/memo${memoIndex + 1}.jpg`);
      els.memoText.textContent = "";
      els.memoText.classList.toggle("cosmic", memoIndex === 24);
    }

    const local = (memoProgress - (memoIndex * MEMO_UNIT)) / MEMO_UNIT;
    const parts = splitMemoText(memoLines[memoIndex], memoIndex);
    const frame = getMemoFrame(local, parts.length);
    // ensure image fully disappears before any text becomes visible
    const imageVisible = local > 0.03 && local < (MEMO_TEXT_START - 0.04);
    const textVisible = frame.textVisible && !imageVisible;
    if (frame.textIndex > -1 && els.memoText.textContent !== parts[frame.textIndex]) {
      els.memoText.classList.remove("show", "impact-blur");
      els.memoText.textContent = parts[frame.textIndex];
      els.memoText.classList.toggle("cosmic", memoIndex === 24 && frame.textIndex === parts.length - 1);
    }
    els.memoImage.classList.toggle("show", imageVisible);
    els.memoText.classList.toggle("show", textVisible);

    if (memoIndex === 20 && frame.textIndex === parts.length - 1 && textVisible && !triggeredMoments.has("impact-20")) {
      triggeredMoments.add("impact-20");
      impactMoment();
      await lockInteraction(1500);
    }

    if (memoIndex === 24 && frame.textIndex === parts.length - 1 && textVisible && !triggeredMoments.has("guess-24")) {
      triggeredMoments.add("guess-24");
      playSpaceNoise();
      await lockInteraction(4000);
    }

    if (targetProgress >= getTotalMemoryProgress() - 0.2) {
      stopMemoryScroll();
      saveState({ scrollProgress: targetProgress, currentStage: 4 });
      await wait(900);
      showStage(4);
    }
  }

  function splitMemoText(text, memoIndex) {
    if (memoIndex === 24) {
      return ["那女孩最后回来了吗", "你猜呢"];
    }
    return String(text)
      .split(/\n\s*\n/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function getMemoFrame(local, partCount) {
    if (local < MEMO_TEXT_START || local > MEMO_TEXT_END || partCount === 0) {
      return { textIndex: -1, textVisible: false };
    }

    const textProgress = (local - MEMO_TEXT_START) / (MEMO_TEXT_END - MEMO_TEXT_START);
    const segment = 1 / partCount;
    const index = clamp(Math.floor(textProgress / segment), 0, partCount - 1);
    const inside = (textProgress - (index * segment)) / segment;
    // tighten the in/out window so text fades in/out more slowly and stays longer
    return {
      textIndex: index,
      textVisible: inside > 0.18 && inside < 0.82
    };
  }

  function impactMoment() {
    els.scrollWorld.classList.remove("memory-impact");
    els.memoText.classList.remove("impact-blur");
    void els.scrollWorld.offsetWidth;
    els.scrollWorld.classList.add("memory-impact");
    els.memoText.classList.add("impact-blur");
    playLowFrequencyImpact();
    window.setTimeout(() => {
      els.scrollWorld.classList.remove("memory-impact");
      els.memoText.classList.remove("impact-blur");
    }, 520);
  }

  function playLowFrequencyImpact() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = "sine";
      osc.frequency.setValueAtTime(42, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.42);
      filter.type = "lowpass";
      filter.frequency.value = 90;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.62);
      osc.connect(filter).connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.7);
    } catch {
      // Impact audio is optional.
    }
  }

  async function lockInteraction(ms) {
    interactionLocked = true;
    document.body.classList.add("is-locked");
    await wait(ms);
    document.body.classList.remove("is-locked");
    interactionLocked = false;
  }

  function playSpaceNoise() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i += 1) data[i] = (Math.random() * 2 - 1) * 0.018;
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      gain.gain.value = 0.18;
      source.connect(gain).connect(ctx.destination);
      source.start();
      source.stop(ctx.currentTime + 2);
    } catch {
      // Non-critical ambience.
    }
  }

  async function enterStage4() {
    stopMemoryScroll();
    phase4Step = 0;
    els.casePickup.classList.remove("hide", "show");
    els.podsPair.classList.remove("show", "worn");
    els.wearPods.textContent = "点击拾取";
    els.wearPods.classList.add("hidden");
    await wait(800);
    els.casePickup.classList.add("show");
    await wait(1700);
    els.wearPods.classList.remove("hidden");
  }

  async function pickupCase() {
    if (phase4Step !== 0) return;
    phase4Step = 1;
    els.casePickup.classList.add("hide");
    els.wearPods.classList.add("hidden");
    await wait(1300);
    els.casePickup.classList.remove("show");
    els.podsPair.classList.add("show");
    els.wearPods.textContent = "点击戴上";
    await wait(1700);
    els.wearPods.classList.remove("hidden");
  }

  async function wearPods() {
    if (phase4Step !== 1) return;
    phase4Step = 2;
    els.wearPods.classList.add("hidden");
    els.podsPair.classList.add("worn");
    els.bgm.pause();
    els.bgm.currentTime = 0;
    playTinnitus();
    await wait(1300);
    // Skip voice playback; directly show and play the video as requested
    els.video.classList.add("show");
    els.video.controls = false;
    els.video.currentTime = 0;
    await els.video.play().catch(() => enterStage5());
  }

  function playTinnitus() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 7600;
      gain.gain.value = 0.018;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.6);
      osc.stop(ctx.currentTime + 1.7);
    } catch {
      // The visual transition still works if Web Audio is unavailable.
    }
  }

  async function playVoiceThenVideo() {
    els.voice.currentTime = 0;
    const voicePlayed = await els.voice.play().then(() => true).catch(() => false);
    if (voicePlayed) {
      await new Promise((resolve) => {
        els.voice.addEventListener("ended", resolve, { once: true });
        els.voice.addEventListener("error", resolve, { once: true });
      });
    } else {
      await wait(900);
    }
    els.video.classList.add("show");
    els.video.controls = false;
    els.video.currentTime = 0;
    await els.video.play().catch(() => enterStage5());
  }

  async function enterStage5() {
    els.video.pause();
    els.video.classList.remove("show");
    showStage(5);
  }

  async function stage5Sequence() {
    els.endingCopy.classList.remove("show", "lift");
    els.traceButton.classList.remove("show");
    await lockInteraction(4000);
    els.endingCopy.classList.add("show");
    await wait(2700);
    els.endingCopy.classList.add("lift");
    await wait(500);
    els.traceButton.classList.add("show");
  }

  function initComments() {
    saveState({ currentStage: 6 });
    if (unsubscribeComments) return;
    firebaseDb = firebaseDb || createFirestore();
    if (!firebaseDb) {
      renderLocalComments();
      return;
    }
    unsubscribeComments = firebaseDb
      .collection("fhjj-comments")
      .orderBy("createdAt", "asc")
      .onSnapshot((snapshot) => {
        els.commentSea.innerHTML = "";
        snapshot.forEach((doc) => renderComment(doc.data()));
      }, renderLocalComments);
  }

  function createFirestore() {
    const config = window.FHJJ_FIREBASE_CONFIG || {
      apiKey: "",
      authDomain: "",
      projectId: "",
      storageBucket: "",
      messagingSenderId: "",
      appId: ""
    };
    if (!window.firebase || !config.apiKey) return null;
    if (!firebase.apps.length) firebase.initializeApp(config);
    return firebase.firestore();
  }

  async function submitReview() {
    const content = els.reviewInput.value.trim();
    if (!content) return;
    const current = loadState();
    const comment = {
      nickname: current.nickname || "无名读者",
      content,
      uuid: current.uuid || "anonymous",
      createdAt: firebaseDb ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
    };
    els.reviewInput.value = "";
    saveState({ quizDone: true });

    if (firebaseDb) {
      await firebaseDb.collection("fhjj-comments").add(comment).catch(() => saveLocalComment(comment));
      return;
    }
    saveLocalComment(comment);
    renderLocalComments(true);
  }

  function saveLocalComment(comment) {
    const key = "fhjj.local.comments";
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    list.push({ ...comment, createdAt: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(list));
  }

  function renderLocalComments(markLast = false) {
    const list = JSON.parse(localStorage.getItem("fhjj.local.comments") || "[]");
    els.commentSea.innerHTML = "";
    list.forEach((comment, index) => renderComment(comment, markLast && index === list.length - 1));
  }

  function renderComment(comment, isNew = false) {
    const bubble = document.createElement("button");
    bubble.type = "button";
    bubble.className = `comment-bubble${isNew ? " new" : ""}`;
    bubble.innerHTML = `
      <p class="comment-content"></p>
      <p class="comment-name"></p>
    `;
    bubble.querySelector(".comment-content").textContent = comment.content || "";
    bubble.querySelector(".comment-name").textContent = `-- ${comment.nickname || "无名读者"}`;
    bubble.addEventListener("click", () => {
      const expanded = bubble.classList.toggle("expanded");
      els.commentSea.classList.toggle("has-expanded", expanded);
      if (!expanded) els.commentSea.classList.remove("has-expanded");
    });
    els.commentSea.appendChild(bubble);
  }
})();
