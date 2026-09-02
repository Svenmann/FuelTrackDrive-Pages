/* FuelTrackDrive – Scrollytelling-Controller
   Bildet die Scroll-Position auf eine inszenierte App-Sequenz ab.
   Respektiert prefers-reduced-motion (dann übernimmt CSS ein ruhiges Layout). */
(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const story = document.querySelector(".story");
  if (!story) return;

  const pin = story.querySelector(".story-pin");
  const device = story.querySelector("[data-device]");
  const screens = {
    dashboard: story.querySelector('[data-screen="dashboard"]'),
    vehicles: story.querySelector('[data-screen="vehicles"]'),
    entries: story.querySelector('[data-screen="entries"]'),
    newentry: story.querySelector('[data-screen="newentry"]'),
    stats: story.querySelector('[data-screen="stats"]'),
    settings: story.querySelector('[data-screen="settings"]'),
  };
  const darkOverlay = story.querySelector("[data-dark-overlay]");
  const saveToast = story.querySelector("[data-save-toast]");
  const statsStrip = story.querySelector("[data-stats-strip]");
  const statsDots = Array.from(story.querySelectorAll("[data-stats-dots] span"));
  const swipeHint = story.querySelector("[data-swipe-hint]");
  const progressBar = story.querySelector("[data-progress-bar]");
  const beats = Array.from(story.querySelectorAll(".beat"));

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  // normierter Fortschritt 0..1 innerhalb [a,b]
  const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const setOpacity = (el, v) => { if (el) el.style.opacity = v.toFixed(3); };

  function activeBeatIndex(p) {
    if (p < 0.11) return 0;   // App öffnen
    if (p < 0.22) return 1;   // Fahrzeug wählen
    if (p < 0.31) return 2;   // Verlauf
    if (p < 0.58) return 3;   // Tankvorgang erfassen + Gespeichert
    if (p < 0.79) return 4;   // Statistik
    if (p < 0.89) return 5;   // Einstellungen
    return 6;                 // Hell oder dunkel
  }

  let lastBeat = -1;
  let lastDot = -1;

  // --- Magnetisches Einrasten ("Widerstand" + weiches Springen zum nächsten View) ---
  // Ruhepunkte als Fortschrittswerte (p) – ein sauberer Zustand je View.
  const SNAP_POINTS = [0.085, 0.19, 0.29, 0.46, 0.605, 0.75, 0.835, 0.955];
  const SNAP_IDLE_MS = 150;     // Ruhe, bevor eingerastet wird
  const SNAP_DURATION = 520;    // Dauer des weichen Gleitens
  let snapRAF = null;
  let idleTimer = null;

  function cancelSnap() {
    if (snapRAF) { cancelAnimationFrame(snapRAF); snapRAF = null; }
  }

  function smoothScrollTo(targetY) {
    cancelSnap();
    const startY = window.scrollY;
    const dist = targetY - startY;
    if (Math.abs(dist) < 2) return;
    const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3); // easeOutCubic
    function step(now) {
      const t = clamp((now - t0) / SNAP_DURATION, 0, 1);
      window.scrollTo(0, Math.round(startY + dist * ease(t)));
      snapRAF = t < 1 ? requestAnimationFrame(step) : null;
    }
    snapRAF = requestAnimationFrame(step);
  }

  function maybeSnap() {
    if (reduceMotion.matches) return;
    const rect = story.getBoundingClientRect();
    // nur wenn die Story den Viewport füllt (Bühne ist gepinnt)
    if (rect.top > 1 || rect.bottom < window.innerHeight - 1) return;
    const total = story.offsetHeight - window.innerHeight;
    if (total <= 0) return;
    const p = clamp(-rect.top / total, 0, 1);
    if (p <= 0.02 || p >= 0.98) return; // Ränder frei lassen (rein/raus scrollen)
    let best = SNAP_POINTS[0], bd = Infinity;
    for (const sp of SNAP_POINTS) {
      const d = Math.abs(sp - p);
      if (d < bd) { bd = d; best = sp; }
    }
    if (bd < 0.005) return; // schon eingerastet
    const storyTop = rect.top + window.scrollY;
    smoothScrollTo(Math.round(storyTop + best * total));
  }

  function onScrollIdle() {
    if (snapRAF) return; // eigenes Gleiten nicht als Nutzer-Scroll werten
    clearTimeout(idleTimer);
    idleTimer = setTimeout(maybeSnap, SNAP_IDLE_MS);
  }
  function onUserIntent() {
    cancelSnap(); // laufendes Einrasten sofort abbrechen, wenn der Nutzer eingreift
    clearTimeout(idleTimer);
    idleTimer = setTimeout(maybeSnap, SNAP_IDLE_MS);
  }
  const SNAP_INTENT_EVENTS = ["wheel", "touchstart", "touchmove", "keydown"];

  function update(p) {
    // --- Gerät: reinzoomen ---
    const scale = lerp(0.66, 1, seg(p, 0.0, 0.06));
    if (device) device.style.transform = `scale(${scale.toFixed(3)})`;

    // --- Screen-Opazitäten (Crossfades) ---
    const dashOp = 1 - seg(p, 0.11, 0.16);
    const vehOp = seg(p, 0.11, 0.16) * (1 - seg(p, 0.22, 0.27));
    const entOp = seg(p, 0.22, 0.27) * (1 - seg(p, 0.55, 0.60));
    const statsOp = seg(p, 0.55, 0.60) * (1 - seg(p, 0.79, 0.84));
    const settingsOp = seg(p, 0.79, 0.84);

    setOpacity(screens.dashboard, dashOp);
    setOpacity(screens.vehicles, vehOp);
    setOpacity(screens.entries, entOp);
    setOpacity(screens.stats, statsOp);
    setOpacity(screens.settings, settingsOp);

    // --- Neuer Eintrag: schiebt sich hoch, hält, fährt wieder runter ---
    const upT = seg(p, 0.31, 0.38);        // hoch
    const downT = seg(p, 0.49, 0.54);      // runter
    const newY = Math.min(lerp(102, 0, upT) + lerp(0, 102, downT), 102);
    const newOp = seg(p, 0.29, 0.33) * (1 - seg(p, 0.54, 0.58));
    if (screens.newentry) {
      screens.newentry.style.transform = `translateY(${newY.toFixed(2)}%)`;
      setOpacity(screens.newentry, newOp);
    }

    // --- "Gespeichert"-Bestätigung ---
    const toastOp = seg(p, 0.44, 0.47) * (1 - seg(p, 0.50, 0.54));
    if (saveToast) {
      setOpacity(saveToast, toastOp);
      const ty = lerp(12, 0, seg(p, 0.44, 0.47));
      saveToast.style.transform = `translate(-50%, ${ty.toFixed(1)}px)`;
    }

    // --- Statistik: Chartkarte wandert seitlich, Dots springen mit ---
    const panT = seg(p, 0.62, 0.77);
    if (statsStrip) {
      const cards = statsStrip.children.length;
      const maxShift = Math.max(0, cards - 1) * 100;
      statsStrip.style.transform = `translateX(${(-maxShift * panT).toFixed(2)}%)`;
    }
    if (statsDots.length) {
      const active = Math.round(panT * (statsDots.length - 1));
      if (active !== lastDot) {
        statsDots.forEach((d, i) => d.classList.toggle("is-active", i === active));
        lastDot = active;
      }
    }
    if (swipeHint) {
      const hintOp = seg(p, 0.60, 0.63) * (1 - seg(p, 0.74, 0.78));
      setOpacity(swipeHint, hintOp);
    }

    // --- Moduswechsel: hell -> dunkel (auf dem Einstellungen-Screen) ---
    const modeT = seg(p, 0.89, 0.985);
    setOpacity(darkOverlay, modeT);
    if (pin) {
      pin.style.setProperty("--mode-dark", modeT.toFixed(3));
      pin.dataset.modeDark = modeT > 0.5 ? "1" : "0";
    }

    // --- Fortschrittsbalken ---
    if (progressBar) progressBar.style.width = (p * 100).toFixed(2) + "%";

    // --- aktive Caption ---
    const bi = activeBeatIndex(p);
    if (bi !== lastBeat) {
      beats.forEach((b, i) => b.classList.toggle("is-active", i === bi));
      lastBeat = bi;
    }
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const rect = story.getBoundingClientRect();
      const total = story.offsetHeight - window.innerHeight;
      const p = clamp(-rect.top / total, 0, 1);
      update(p);
      ticking = false;
    });
  }

  function enable() {
    beats.forEach((b, i) => b.classList.toggle("is-active", i === 0));
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScrollIdle, { passive: true });
    SNAP_INTENT_EVENTS.forEach((ev) => window.addEventListener(ev, onUserIntent, { passive: true }));
    onScroll();
  }

  function disable() {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
    window.removeEventListener("scroll", onScrollIdle);
    SNAP_INTENT_EVENTS.forEach((ev) => window.removeEventListener(ev, onUserIntent));
    cancelSnap();
    clearTimeout(idleTimer);
    // ruhiger Grundzustand für reduced-motion / Fallback
    beats.forEach((b) => b.classList.add("is-active"));
    if (device) device.style.transform = "";
  }

  if (reduceMotion.matches) {
    disable();
  } else {
    enable();
  }
  if (typeof reduceMotion.addEventListener === "function") {
    reduceMotion.addEventListener("change", (e) => (e.matches ? disable() : enable()));
  }
})();
