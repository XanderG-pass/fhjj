(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const { questions, memoLines } = window.FHJJ_STORY;
  const STATE_KEY = "fhjj.memory.state.v1";
  const COMMENTS_KEY = "fhjj.local.comments";
  const DRAFT_KEY = "fhjj.review.draft";
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const stages = [...document.querySelectorAll(".stage")];
  const frames = [];
  const chapters = (i) => i < 6 ? "相遇" : i < 12 ? "相守" : i < 18 ? "离散" : i < 21 ? "余烬" : "回响";
  for (let i = 14; i > 0; i--) frames.push({ type: "image", src: "pic/pic" + i + ".jpg", chapter: "序 · 倒带", caption: "时间的另一端", legacy: 14 - i });
  memoLines.forEach((text, memo) => {
    frames.push({ type: "image", src: "memo/memo" + (memo + 1) + ".jpg", chapter: chapters(memo), memo, caption: "回忆 " + String(memo + 1).padStart(2, "0"), legacy: 14 + memo * 4.2 + .6 });
    const parts = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    parts.forEach((part, line) => frames.push({
      type: "text", text: part, chapter: chapters(memo), memo, line,
      caption: "回忆 " + String(memo + 1).padStart(2, "0") + " / " + (line + 1),
      legacy: 14 + (memo + .34 + ((line + .5) / parts.length) * .44) * 4.2,
      effect: memo === 20 && line === parts.length - 1 ? "impact" : memo === 24 && line === parts.length - 1 ? "echo" : ""
    }));
  });
  function readStorage(key, fallback) {
    try { const value = JSON.parse(localStorage.getItem(key)); return value === null ? fallback : value; }
    catch { return fallback; }
  }
  const saved = readStorage(STATE_KEY, {});
  const state = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  state.currentStage = Number.isInteger(state.currentStage) ? clamp(state.currentStage, 0, 6) : 0;
  state.nickname = typeof state.nickname === "string" ? state.nickname.slice(0, 18) : "";
  state.quizDone = state.quizDone === true;
  if (!Number.isInteger(state.frameIndex)) {
    const legacy = Number.isFinite(state.scrollProgress) ? state.scrollProgress : 0;
    state.frameIndex = frames.reduce((best, frame, i) => Math.abs(frame.legacy - legacy) < Math.abs(frames[best].legacy - legacy) ? i : best, 0);
  }
  state.frameIndex = clamp(state.frameIndex, 0, frames.length - 1);
  state.uuid = typeof state.uuid === "string" ? state.uuid : (window.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
  let currentStage = 0;
  let stageToken = 0;
  let frameToken = 0;
  let frameIndex = state.frameIndex;
  let frameBusy = false;
  let quizIndex = 0;
  let quizCorrect = 0;
  let quizBusy = false;
  let unlockBusy = false;
  let pickupState = "case";
  let soundEnabled = false;
  let hapticsEnabled = state.haptics !== false;
  let audioContext = null;
  let musicGain = null;
  let draftTimer = 0;
  let filmWatchdog = 0;
  let firestore = null;
  let unsubscribe = null;
  let submitting = false;
  let wheelLast = 0;
  let wheelTotal = 0;
  let wheelLatched = false;
  let touchStart = null;
  const stageTimers = new Set();
  const imageCache = new Map();
  const effectsPlayed = new Set();

  function saveState(next = {}) {
    Object.assign(state, next);
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); return true; }
    catch { return false; }
  }
  function later(callback, delay) {
    const token = stageToken;
    const timer = setTimeout(() => {
      stageTimers.delete(timer);
      if (stageToken === token) callback();
    }, reducedMotion.matches ? Math.min(delay, 100) : delay);
    stageTimers.add(timer);
  }
  function icon(button, name, label, pressed) {
    button.innerHTML = '<i data-lucide="' + name + '"></i>';
    button.setAttribute("aria-label", label);
    button.title = label;
    if (pressed !== undefined) button.setAttribute("aria-pressed", String(pressed));
    window.FHJJ_ICONS?.render(button);
  }
  function syncSound() {
    $("bgm").muted = !soundEnabled;
    $("jyyVideo").muted = !soundEnabled;
    icon($("soundToggle"), soundEnabled ? "volume-2" : "volume-x", soundEnabled ? "关闭声音" : "开启声音", soundEnabled);
  }
  function unlockAudio() {
    soundEnabled = state.sound !== false;
    if (soundEnabled) {
      try {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (Context && !audioContext) {
          audioContext = new Context();
          musicGain = audioContext.createGain();
          musicGain.gain.value = .48;
          audioContext.createMediaElementSource($("bgm")).connect(musicGain).connect(audioContext.destination);
        }
        audioContext?.resume().catch(() => {});
      } catch { /* HTML media remains available without Web Audio. */ }
    }
    syncSound();
  }
  function startMusic() {
    if (!soundEnabled) return;
    $("bgm").play().catch(() => {
      soundEnabled = false;
      syncSound();
    });
  }
  function haptic(pattern) {
    if (pattern !== 0 && (!hapticsEnabled || reducedMotion.matches || document.hidden)) return;
    try { navigator.vibrate?.(pattern); } catch { /* Unsupported hardware is optional. */ }
  }
  function cue(kind) {
    if (!soundEnabled || !audioContext || audioContext.state !== "running") return;
    const ctx = audioContext;
    const start = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    if (kind === "impact") {
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(88, start);
      osc.frequency.exponentialRampToValueAtTime(34, start + .35);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(.16, start + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .6);
      osc.connect(gain);
      osc.start(start);
      osc.stop(start + .65);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    } else {
      const duration = kind === "unlock" ? .12 : .9;
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) {
        const t = i / ctx.sampleRate;
        const envelope = kind === "unlock"
          ? Math.exp(-t * 140) + (t > .045 ? .55 * Math.exp(-(t - .045) * 180) : 0)
          : Math.sin(Math.PI * i / samples.length) * .06;
        samples[i] = (Math.random() * 2 - 1) * envelope;
      }
      const noise = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = kind === "unlock" ? 1450 : 550;
      filter.Q.value = .65;
      gain.gain.value = kind === "unlock" ? .15 : .2;
      noise.buffer = buffer;
      noise.connect(filter).connect(gain);
      noise.start();
      noise.onended = () => { noise.disconnect(); filter.disconnect(); gain.disconnect(); };
    }
  }

  function refreshHome() {
    const hasResume = state.quizDone && state.nickname && state.currentStage >= 2;
    $("enterArchive").querySelector("span").textContent = hasResume ? "继续上次的记忆" : "打开记忆";
    $("restartMemory").hidden = !hasResume;
  }
  function showStage(stage) {
    stageToken++;
    frameToken++;
    frameBusy = false;
    for (const timer of stageTimers) clearTimeout(timer);
    stageTimers.clear();
    clearTimeout(filmWatchdog);
    filmWatchdog = 0;
    haptic(0);
    $("jyyVideo").pause();
    $("film").hidden = true;
    document.body.classList.remove("dark-header");
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    currentStage = stage;
    document.body.dataset.stage = String(stage);
    stages.forEach((element, i) => {
      element.hidden = i !== stage;
      element.inert = i !== stage;
      element.classList.toggle("is-active", i === stage);
    });
    if (stage !== 0) saveState({ currentStage: stage });
    if (stage !== 3 && stage !== 4) $("bgm").pause();
    document.querySelector('meta[name="theme-color"]').content = stage === 3 || stage === 4 ? "#101313" : "#eef1ef";
    if (stage === 0) refreshHome();
    if (stage === 1) setupQuiz();
    if (stage === 2) setupUnlock();
    if (stage === 3) { wheelLatched = false; wheelTotal = 0; touchStart = null; renderFrame(frameIndex, true); startMusic(); }
    if (stage === 4) setupKeepsake();
    if (stage === 5) {
      $("traceButton").hidden = true;
      later(() => { $("traceButton").hidden = false; haptic([12, 38, 8]); }, 2200);
    }
    if (stage === 6) initComments();
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest(".stage")?.hidden) active.blur();
  }
  function openArchive(restart = false) {
    unlockAudio();
    if (restart) {
      effectsPlayed.clear();
      frameIndex = 0;
      saveState({ frameIndex: 0, scrollProgress: 0, currentStage: 2 });
    }
    if (!state.quizDone || !state.nickname) showStage(1);
    else showStage(restart ? 2 : Math.max(2, state.currentStage));
  }
  function setupQuiz() {
    quizIndex = 0;
    quizCorrect = 0;
    quizBusy = false;
    $("rejectText").textContent = "";
    $("retryQuiz").hidden = true;
    $("verifyCard").hidden = state.quizDone;
    $("nameCard").hidden = !state.quizDone;
    $("nicknameInput").value = state.nickname;
    if (!state.quizDone) renderQuestion();
  }
  function renderQuestion() {
    const question = questions[quizIndex];
    $("quizPanel").innerHTML = '<p class="question-count">' + String(quizIndex + 1).padStart(2, "0") + ' / 04</p><h2 class="question-title"></h2><div class="option-list"></div>';
    $("quizPanel").querySelector("h2").textContent = question.text;
    question.options.forEach((option, i) => {
      const button = document.createElement("button");
      button.className = "option-button";
      const mark = document.createElement("span");
      mark.className = "option-letter";
      mark.textContent = "ABCD"[i];
      button.append(mark, document.createTextNode(option));
      button.addEventListener("click", () => answerQuestion(option, button));
      $("quizPanel").querySelector(".option-list").append(button);
    });
  }
  function answerQuestion(answer, button) {
    if (quizBusy) return;
    quizBusy = true;
    if (answer === questions[quizIndex].answer) quizCorrect++;
    button.classList.add("selected");
    $("quizPanel").querySelectorAll("button").forEach((b) => { b.disabled = true; });
    later(() => {
      quizIndex++;
      if (quizIndex < questions.length) { renderQuestion(); quizBusy = false; return; }
      if (quizCorrect >= 3) {
        saveState({ quizDone: true });
        $("verifyCard").hidden = true;
        $("nameCard").hidden = false;
      } else {
        $("rejectText").textContent = "请回吧，这里不欢迎犯罪嫌疑人。";
        $("retryQuiz").hidden = false;
      }
    }, 220);
  }
  function setupUnlock() {
    unlockBusy = false;
    $("stage2").classList.remove("opened");
    $("leafLock").disabled = false;
    $("unlockHint").hidden = false;
    $("beginMemory").hidden = true;
  }
  function unlockLeaf() {
    if (unlockBusy || currentStage !== 2) return;
    unlockBusy = true;
    unlockAudio();
    cue("unlock");
    haptic([10, 28, 7]);
    $("leafLock").disabled = true;
    $("unlockHint").hidden = true;
    $("stage2").classList.add("opened");
    document.body.classList.add("dark-header");
    later(() => { $("beginMemory").hidden = false; }, 1000);
  }

  function loadImage(src) {
    if (imageCache.has(src)) return imageCache.get(src);
    const promise = new Promise((resolve) => {
      const img = new Image();
      const timer = setTimeout(() => finish(false), 5000);
      let finished = false;
      function finish(ok) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        img.onload = img.onerror = null;
        if (!ok) imageCache.delete(src);
        resolve(ok);
      }
      img.decoding = "async";
      img.onload = () => finish(true);
      img.onerror = () => finish(false);
      img.src = src;
    });
    imageCache.set(src, promise);
    return promise;
  }
  async function renderFrame(next, immediate = false) {
    const token = ++frameToken;
    frameBusy = true;
    const world = $("scrollWorld");
    world.classList.remove("arriving", "impact");
    if (!immediate && !reducedMotion.matches) {
      world.classList.add("leaving");
      await new Promise((resolve) => setTimeout(resolve, 140));
    }
    if (token !== frameToken || currentStage !== 3) return;
    frameIndex = clamp(next, 0, frames.length - 1);
    const frame = frames[frameIndex];
    saveState({ frameIndex, scrollProgress: frame.legacy, currentStage: 3 });
    $("stage3").dataset.tone = frame.chapter;
    $("chapterName").textContent = frame.chapter;
    $("frameNumber").textContent = String(frameIndex + 1).padStart(2, "0") + " / " + frames.length;
    $("frameCaption").textContent = frame.caption;
    $("memoryProgress").value = (frameIndex + 1) / frames.length * 100;
    $("previousFrame").disabled = frameIndex === 0;
    $("nextFrame").setAttribute("aria-label", frameIndex === frames.length - 1 ? "前往尾声" : "下一帧");
    $("memoryImage").hidden = frame.type !== "image";
    $("memoText").hidden = frame.type !== "text";
    $("imageStatus").hidden = true;
    world.classList.remove("leaving");
    frameBusy = false;
    if (frame.type === "image") {
      $("memoryImage").removeAttribute("src");
      $("imageMessage").textContent = "正在展开这一帧";
      $("retryImage").hidden = true;
      $("imageStatus").hidden = false;
      const ready = await loadImage(frame.src);
      if (token !== frameToken || currentStage !== 3) return;
      if (ready) {
        $("memoryImage").src = frame.src;
        $("memoryImage").alt = frame.chapter + "，" + frame.caption;
        $("imageStatus").hidden = true;
      } else {
        $("imageMessage").textContent = "这一帧暂时未能载入";
        $("retryImage").hidden = false;
      }
    } else {
      $("memoText").textContent = frame.text;
      $("memoText").classList.toggle("cosmic", frame.effect === "echo");
      $("memoText").scrollTop = 0;
    }
    if (token !== frameToken || currentStage !== 3) return;
    world.classList.add("arriving");
    if (frame.effect && !effectsPlayed.has(frame.effect)) {
      effectsPlayed.add(frame.effect);
      if (frame.effect === "impact") {
        world.classList.remove("arriving");
        world.classList.add("impact");
        cue("impact");
        haptic([100, 35, 140, 45, 65]);
      } else cue("echo");
    }
    frames.slice(frameIndex + 1, frameIndex + 4).filter((f) => f.type === "image").forEach((f) => loadImage(f.src));
  }
  function moveFrame(direction) {
    if (currentStage !== 3 || frameBusy) return;
    if (frameIndex === frames.length - 1 && direction > 0) { showStage(4); return; }
    const next = clamp(frameIndex + direction, 0, frames.length - 1);
    if (next !== frameIndex) renderFrame(next);
  }
  function textCanScroll(direction) {
    const text = $("memoText");
    return !text.hidden && text.scrollHeight > text.clientHeight + 2 &&
      (direction > 0 ? text.scrollTop + text.clientHeight < text.scrollHeight - 2 : text.scrollTop > 2);
  }
  $("stage3").addEventListener("wheel", (event) => {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    if (event.target.closest("button") || textCanScroll(Math.sign(event.deltaY))) return;
    event.preventDefault();
    const now = performance.now();
    if (now - wheelLast > 180) { wheelLatched = false; wheelTotal = 0; }
    wheelLast = now;
    if (wheelLatched) return;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
    if (Math.sign(delta) !== Math.sign(wheelTotal)) wheelTotal = 0;
    wheelTotal += delta;
    if (Math.abs(wheelTotal) >= 45) { wheelLatched = true; moveFrame(Math.sign(wheelTotal)); }
  }, { passive: false });
  $("scrollWorld").addEventListener("touchstart", (event) => {
    touchStart = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
    if (event.touches.length === 1 && !$("memoText").hidden && $("memoText").scrollHeight > $("memoText").clientHeight + 2) touchStart = null;
  }, { passive: true });
  $("scrollWorld").addEventListener("touchmove", (event) => {
    if (event.touches.length !== 1) { touchStart = null; return; }
    if (touchStart && Math.abs(touchStart.y - event.touches[0].clientY) > Math.abs(touchStart.x - event.touches[0].clientX)) event.preventDefault();
  }, { passive: false });
  $("scrollWorld").addEventListener("touchend", (event) => {
    if (!touchStart || !event.changedTouches[0]) return;
    const dx = touchStart.x - event.changedTouches[0].clientX;
    const dy = touchStart.y - event.changedTouches[0].clientY;
    touchStart = null;
    if (Math.abs(dy) >= 42 && Math.abs(dy) > Math.abs(dx) * 1.15) moveFrame(Math.sign(dy));
  }, { passive: true });
  $("scrollWorld").addEventListener("touchcancel", () => { touchStart = null; });
  document.addEventListener("keydown", (event) => {
    if (event.target.closest("button, input, textarea") || event.ctrlKey || event.metaKey || event.altKey) return;
    if (currentStage === 3 && ["ArrowDown", "ArrowUp", "PageDown", "PageUp", " "].includes(event.key)) {
      event.preventDefault();
      moveFrame(["ArrowUp", "PageUp"].includes(event.key) || (event.key === " " && event.shiftKey) ? -1 : 1);
    }
  });

  function setupKeepsake() {
    pickupState = "case";
    $("casePickup").hidden = false;
    $("casePickup").disabled = false;
    $("casePickup").classList.remove("picked");
    $("podsPair").hidden = true;
    $("wearPods").hidden = false;
    $("wearPods").disabled = false;
    $("wearPods").innerHTML = '点击拾取 <i data-lucide="arrow-up-right"></i>';
    window.FHJJ_ICONS?.render($("wearPods"));
    $("jyyVideo").preload = "metadata";
  }
  function pickupCase() {
    if (currentStage !== 4 || pickupState !== "case") return;
    pickupState = "picking";
    $("casePickup").disabled = true;
    $("wearPods").hidden = true;
    $("casePickup").classList.add("picked");
    haptic([7, 153, 6, 154, 6, 154, 6, 154, 6, 154, 6]);
    later(() => {
      haptic(0);
      $("casePickup").hidden = true;
      $("podsPair").hidden = false;
      pickupState = "pods";
      $("wearPods").innerHTML = '点击戴上 <i data-lucide="play"></i>';
      window.FHJJ_ICONS?.render($("wearPods"));
      $("wearPods").hidden = false;
    }, 820);
  }
  function playFilm() {
    if (currentStage !== 4) return;
    unlockAudio();
    pickupState = "film";
    $("bgm").pause();
    $("film").hidden = false;
    $("videoFallback").hidden = true;
    const token = stageToken;
    const video = $("jyyVideo");
    video.controls = true;
    video.muted = !soundEnabled;
    video.play().then(() => {
      if (token !== stageToken) video.pause();
    }).catch(() => {
      if (token === stageToken) { $("videoMessage").textContent = "轻触，再听见她。"; $("videoFallback").hidden = false; }
    });
    clearTimeout(filmWatchdog);
    filmWatchdog = setTimeout(() => {
      if (token === stageToken && !video.currentTime) {
        $("videoMessage").textContent = "影片还未载入，请重试。";
        $("videoFallback").hidden = false;
      }
    }, 10000);
  }
  $("jyyVideo").addEventListener("playing", () => { clearTimeout(filmWatchdog); $("videoFallback").hidden = true; });
  $("jyyVideo").addEventListener("error", () => {
    if (currentStage === 4 && pickupState === "film") { $("videoMessage").textContent = "影片暂时无法播放，请重试。"; $("videoFallback").hidden = false; }
  });

  function localComments() {
    const comments = readStorage(COMMENTS_KEY, []);
    return (Array.isArray(comments) ? comments : [])
      .filter((c) => c && typeof c.content === "string" && c.content.trim());
  }
  function renderComments(comments = localComments()) {
    $("commentSea").replaceChildren();
    if (!comments.length) {
      const empty = document.createElement("p");
      empty.className = "comment-empty";
      empty.textContent = "这一页，等你落笔。";
      $("commentSea").append(empty);
    }
    comments.forEach((comment) => {
      const bubble = document.createElement("article");
      bubble.className = "comment-bubble";
      const content = document.createElement("p");
      content.className = "comment-content";
      content.textContent = comment.content;
      const author = document.createElement("p");
      author.className = "comment-name";
      author.textContent = typeof comment.nickname === "string" ? comment.nickname : "无名读者";
      bubble.append(content, author);
      $("commentSea").append(bubble);
    });
  }
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const timer = setTimeout(() => reject(new Error("timeout")), 6000);
      script.src = src;
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); reject(new Error("unavailable")); };
      document.head.append(script);
    });
  }
  async function initComments() {
    updateReviewCount();
    $("reviewStatus").textContent = "";
    $("storageNote").textContent = "保存在此设备";
    renderComments();
    const config = window.FHJJ_FIREBASE_CONFIG;
    if (!config?.apiKey || !config.projectId) return;
    const token = stageToken;
    try {
      if (!window.firebase) await loadScript("https://www.gstatic.com/firebasejs/9.17.2/firebase-app-compat.js");
      if (!window.firebase.firestore) await loadScript("https://www.gstatic.com/firebasejs/9.17.2/firebase-firestore-compat.js");
      if (token !== stageToken) return;
      if (!firebase.apps.length) firebase.initializeApp(config);
      firestore = firebase.firestore();
      unsubscribe = firestore.collection("fhjj-comments").orderBy("createdAt", "asc").onSnapshot((snapshot) => {
        if (token !== stageToken) return;
        renderComments([...snapshot.docs.map((doc) => doc.data()), ...localComments()]);
        $("storageNote").textContent = "公开的评论海";
      }, () => {
        firestore = null;
        $("storageNote").textContent = "暂时离线 · 保存在此设备";
        renderComments();
      });
    } catch {
      firestore = null;
      if (token === stageToken) $("storageNote").textContent = "暂时离线 · 保存在此设备";
    }
  }
  function updateReviewCount() {
    $("reviewCount").textContent = $("reviewInput").value.length + " / 600";
  }
  function persistDraft() {
    clearTimeout(draftTimer);
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify($("reviewInput").value)); } catch { /* The form retains the draft while this page stays open. */ }
  }
  async function submitReview(event) {
    event.preventDefault();
    const content = $("reviewInput").value.trim();
    if (!content || submitting) return;
    submitting = true;
    $("sendReview").disabled = true;
    const comment = { nickname: state.nickname || "无名读者", content, uuid: state.uuid, createdAt: new Date().toISOString() };
    let remote = false;
    try {
      if (firestore) {
        await firestore.collection("fhjj-comments").add({ ...comment, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        remote = true;
      }
      if (!remote) {
        const comments = readStorage(COMMENTS_KEY, []);
        localStorage.setItem(COMMENTS_KEY, JSON.stringify([...(Array.isArray(comments) ? comments : []), comment]));
      }
      $("reviewStatus").textContent = remote ? "已送入评论海。" : "已保存在此设备。";
      $("reviewInput").value = "";
      persistDraft();
      updateReviewCount();
      if (!remote) renderComments();
      haptic([9, 32, 6]);
    } catch {
      $("reviewStatus").textContent = "暂时无法保存，文字仍留在输入框中。";
    } finally {
      submitting = false;
      $("sendReview").disabled = false;
    }
  }

  $("enterArchive").addEventListener("click", () => openArchive());
  $("restartMemory").addEventListener("click", () => openArchive(true));
  $("readAgain").addEventListener("click", () => openArchive(true));
  $("goHome").addEventListener("click", () => showStage(0));
  $("retryQuiz").addEventListener("click", setupQuiz);
  $("nameCard").addEventListener("submit", (event) => {
    event.preventDefault();
    const nickname = $("nicknameInput").value.trim();
    if (!nickname) { $("nicknameInput").focus(); return; }
    saveState({ nickname });
    showStage(2);
  });
  $("leafLock").addEventListener("click", unlockLeaf);
  $("unlockHint").addEventListener("click", unlockLeaf);
  $("beginMemory").addEventListener("click", () => {
    unlockAudio();
    frameIndex = 0;
    effectsPlayed.clear();
    saveState({ frameIndex: 0, scrollProgress: 0 });
    showStage(3);
  });
  $("previousFrame").addEventListener("click", () => moveFrame(-1));
  $("nextFrame").addEventListener("click", () => moveFrame(1));
  $("retryImage").addEventListener("click", () => {
    imageCache.delete(frames[frameIndex].src);
    renderFrame(frameIndex, true);
  });
  $("casePickup").addEventListener("click", pickupCase);
  $("wearPods").addEventListener("click", () => {
    if (pickupState === "case") pickupCase();
    else if (pickupState === "pods") { $("jyyVideo").currentTime = 0; playFilm(); }
  });
  $("retryVideo").addEventListener("click", () => {
    if ($("jyyVideo").error) $("jyyVideo").load();
    playFilm();
  });
  $("skipFilm").addEventListener("click", () => showStage(5));
  $("jyyVideo").addEventListener("ended", () => { if (currentStage === 4) showStage(5); });
  $("traceButton").addEventListener("click", () => showStage(6));
  $("backToMemory").addEventListener("click", () => showStage(5));
  $("reviewForm").addEventListener("submit", submitReview);
  $("reviewInput").addEventListener("input", () => {
    updateReviewCount();
    clearTimeout(draftTimer);
    draftTimer = setTimeout(persistDraft, 300);
  });
  $("soundToggle").addEventListener("click", () => {
    const next = !soundEnabled;
    saveState({ sound: next });
    unlockAudio();
    soundEnabled = next;
    syncSound();
    if (soundEnabled && (currentStage === 3 || (currentStage === 4 && pickupState !== "film"))) startMusic();
    if (!soundEnabled) $("bgm").pause();
  });
  $("hapticToggle").hidden = typeof navigator.vibrate !== "function";
  $("hapticToggle").addEventListener("click", () => {
    hapticsEnabled = !hapticsEnabled;
    saveState({ haptics: hapticsEnabled });
    icon($("hapticToggle"), "vibrate", hapticsEnabled ? "关闭触感" : "开启触感", hapticsEnabled);
    haptic(hapticsEnabled ? 8 : 0);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      $("bgm").pause();
      $("jyyVideo").pause();
      haptic(0);
      persistDraft();
    } else if (currentStage === 4 && pickupState === "film") {
      $("videoMessage").textContent = "继续这一段声音。";
      $("videoFallback").hidden = false;
    } else if (currentStage === 3 || currentStage === 4) startMusic();
  });
  window.addEventListener("pagehide", () => { persistDraft(); haptic(0); });
  const draft = readStorage(DRAFT_KEY, "");
  $("reviewInput").value = typeof draft === "string" ? draft : "";
  window.FHJJ_ICONS?.render(document);
  syncSound();
  icon($("hapticToggle"), "vibrate", hapticsEnabled ? "关闭触感" : "开启触感", hapticsEnabled);
  saveState();
  refreshHome();
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).catch(() => {});
    }, { once: true });
  }
})();
