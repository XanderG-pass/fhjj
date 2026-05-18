const body = document.body;
const leaf = document.getElementById('leaf');
const lock = document.getElementById('lock');
const quote = document.getElementById('quote');
const scrollHint = document.getElementById('scrollHint');
const bgm = document.getElementById('bgm');
const voice = document.getElementById('voice');
const fragments = document.querySelectorAll('.fragment');
const earPods = document.getElementById('earPods');
const overlay = document.getElementById('overlay');
const finalCopy = document.getElementById('finalCopy');

let unlocked = false;
let earPodsActivated = false;

const fadeAudio = (audio, targetVolume, duration = 2200, onComplete) => {
  clearInterval(audio.fadeTimer);
  const startVolume = audio.volume;
  const stepCount = Math.max(1, Math.round(duration / 80));
  let step = 0;
  const delta = targetVolume - startVolume;
  audio.fadeTimer = setInterval(() => {
    step += 1;
    audio.volume = Math.min(1, Math.max(0, startVolume + delta * (step / stepCount)));
    if (step >= stepCount) {
      clearInterval(audio.fadeTimer);
      audio.volume = targetVolume;
      if (typeof onComplete === 'function') {
        onComplete();
      }
    }
  }, 80);
};

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  },
  {
    threshold: 0.3,
  }
);

fragments.forEach((fragment) => revealObserver.observe(fragment));

leaf.addEventListener('click', () => {
  if (unlocked) return;
  unlocked = true;

  body.classList.add('unlocked');
  lock.classList.add('lock-hidden');
  quote.classList.add('visible');
  scrollHint.classList.add('visible');
  leaf.style.filter = 'grayscale(0%)';
  leaf.style.transform = 'scale(1.02)';

  try {
    bgm.currentTime = 0;
    bgm.volume = 0;
    const playPromise = bgm.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {});
    }
  } catch (error) {
    console.warn('BGM 播放被浏览器拦截。', error);
  }

  fadeAudio(bgm, 0.42, 2400);
});

const endSequence = () => {
  overlay.classList.add('active');
};

const playVoiceSequence = () => {
  try {
    voice.currentTime = 0;
    voice.volume = 1;
    const voicePromise = voice.play();
    if (voicePromise !== undefined) {
      voicePromise.catch(() => {
        setTimeout(endSequence, 2400);
      });
    }
  } catch (error) {
    console.warn('语音播放被拦截或资源缺失。', error);
    setTimeout(endSequence, 2400);
  }
};

earPods.addEventListener('click', () => {
  if (!unlocked || earPodsActivated) return;
  earPodsActivated = true;

  earPods.classList.add('active');
  body.classList.add('ready-dark');

  setTimeout(() => {
    body.classList.add('dimmed');
  }, 360);

  fadeAudio(bgm, 0, 1600, () => {
    bgm.pause();
    bgm.currentTime = 0;
  });

  setTimeout(() => {
    playVoiceSequence();
  }, 1200);
});

voice.addEventListener('ended', () => {
  setTimeout(endSequence, 1400);
});

window.addEventListener('load', () => {
  document.documentElement.style.scrollBehavior = 'smooth';
});
