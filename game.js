/* Pigs in Space: Cosmic Arcade — original HTML5 implementation.
   A fan tribute to the three 1983 arcade game modes; no ROMs or extracted assets. */
(() => {
  "use strict";

  const W = 600, H = 760, TAU = Math.PI * 2;
  const $ = (id) => document.getElementById(id);
  const canvas = $("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  const menu = $("menu"), view = $("gameView"), overlay = $("overlay");
  const controlHint = $("controlHint"), fireText = $("fireText");
  const modeNames = { chicken: "CHICKENVADERS", pasta: "PASTAROIDS", gonzo: "GONZOID ESCAPE" };
  const modeColors = { chicken: "#ff77b5", pasta: "#ffcb7e", gonzo: "#72e9da" };

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const rand = (a, b) => a + Math.random() * (b - a);
  const hit = (a, b, radius) => Math.hypot(a.x - b.x, a.y - b.y) < radius;
  const storage = {
    get(key, fallback) { try { const value = localStorage.getItem(key); return value === null ? fallback : value; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, String(value)); } catch { /* Storage may be unavailable */ } }
  };

  let audioCtx = null, muted = storage.get("cosmic-muted", "0") === "1";
  function sound(freq = 350, duration = .11, type = "triangle", volume = .05, endFreq = null) {
    if (muted) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      if (!audioCtx) audioCtx = new Audio();
      if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain(), now = audioCtx.currentTime;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(.001, now + duration);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(now); osc.stop(now + duration + .01);
    } catch { /* Audio is an optional enhancement */ }
  }
  function melody(win) {
    [0, 1, 2].forEach((i) => {
      // Audio scheduling uses audio-context time, never a repeating browser timer.
      if (muted) return;
      try {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!audioCtx) audioCtx = new Audio();
        const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        const start = audioCtx.currentTime + i * .14;
        osc.type = "triangle"; osc.frequency.value = win ? [440, 550, 740][i] : [330, 240, 165][i];
        gain.gain.setValueAtTime(.001, start);
        gain.gain.exponentialRampToValueAtTime(.065, start + .015);
        gain.gain.exponentialRampToValueAtTime(.001, start + .16);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(start); osc.stop(start + .18);
      } catch { /* optional */ }
    });
  }

  const run = { score: 0, round: 1, lives: 5, over: false, started: false };
  let best = Math.max(0, Number(storage.get("cosmic-best", "0")) || 0);
  let game = null, phase = "menu", activeMode = "chicken";
  const pressed = { left: false, right: false, up: false, down: false, fire: false };
  const keys = { left: false, right: false, up: false, down: false, fire: false };
  const pointer = { active: false, id: null, x: W / 2, y: 610 };
  let previousFrame = 0, toastUntil = 0, gamepadFireWasDown = false;
  let lastUi = "";

  const stars = Array.from({ length: 115 }, () => ({
    x: rand(0, W), y: rand(0, H), size: rand(.6, 2.2), speed: rand(6, 36), phase: rand(0, TAU)
  }));
  const particles = [];
  function particle(x, y, color, amount = 9, power = 100) {
    for (let i = 0; i < amount && particles.length < 170; i++) {
      const a = rand(0, TAU), v = rand(power * .25, power);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: rand(1.5, 5), life: rand(.2, .7), age: 0, color });
    }
  }
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 56 * dt;
      if (p.age >= p.life) particles.splice(i, 1);
    }
  }
  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - p.age / p.life * .5), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function updateUi(force = false) {
    if (run.score > best) {
      best = run.score;
      storage.set("cosmic-best", best);
    }
    const snapshot = [run.score, run.round, run.lives, best, activeMode].join(":");
    if (!force && snapshot === lastUi) return;
    lastUi = snapshot;
    $("scoreText").textContent = String(run.score).padStart(6, "0");
    $("roundText").textContent = String(run.round).padStart(2, "0");
    $("livesText").textContent = "♥ ".repeat(run.lives).trim() || "—";
    $("homeBest").textContent = String(best).padStart(6, "0");
    $("modeLabel").textContent = modeNames[activeMode];
  }
  function addScore(n) { run.score += Math.round(n); updateUi(); }
  function showToast(message, seconds = 1.35) {
    const el = $("toast");
    el.textContent = message; el.classList.add("shown");
    toastUntil = performance.now() + seconds * 1000;
  }
  function resetRun() {
    run.score = 0; run.round = 1; run.lives = 5; run.over = false; run.started = true;
    updateUi(true);
  }
  function clearInputs() {
    for (const k of Object.keys(pressed)) pressed[k] = false;
    for (const k of Object.keys(keys)) keys[k] = false;
    pointer.active = false;
    document.querySelectorAll(".pressed").forEach((el) => el.classList.remove("pressed"));
  }

  function chooseMode(mode) {
    if (!modeNames[mode]) return;
    if (!run.started || run.over) resetRun();
    activeMode = mode;
    particles.length = 0;
    game = { mode, time: 0, invulnerable: 1.2, shake: 0, flash: 0, difficulty: Math.min(run.round, 12), state: null };
    game.state = mode === "chicken" ? newChicken() : mode === "pasta" ? newPasta() : newGonzo();
    menu.classList.add("hidden");
    view.classList.remove("hidden");
    overlay.classList.add("hidden");
    phase = "playing";
    clearInputs();
    controlHint.textContent = mode === "chicken" ? "DODGE + FIRE" : mode === "pasta" ? "MOVE + CHOP" : "STEER + FIRE";
    fireText.textContent = mode === "pasta" ? "CHOP" : "FIRE";
    updateUi(true);
    showToast(mode === "pasta" ? "REACH THE SWINETREK!" : mode === "gonzo" ? "ESCAPE THE PIZZA MINE!" : "DEFEND PLANET CLUCK!");
    sound(470, .14, "sine", .065, 740);
  }

  function goHome() {
    clearInputs(); phase = "menu"; game = null;
    menu.classList.remove("hidden"); view.classList.add("hidden"); overlay.classList.add("hidden");
    updateUi(true);
  }
  function showOverlay(type) {
    phase = type;
    clearInputs();
    overlay.classList.remove("hidden");
    $("overlayScore").textContent = String(run.score).padStart(6, "0");
    const icon = $("overlayIcon"), kicker = $("overlayKicker"), title = $("overlayTitle"), description = $("overlayText");
    const main = $("overlayMain"), secondary = $("overlaySecondary");
    if (type === "complete") {
      icon.textContent = "★"; kicker.textContent = "MISSION COMPLETE"; title.textContent = "COSMIC LEGEND!";
      description.textContent = "Incredible work, Captain! Pick your next adventure. The galaxy gets tougher every round.";
      main.textContent = "CHOOSE NEXT MISSION →"; secondary.textContent = "REPLAY THIS MISSION";
    } else if (type === "over") {
      icon.textContent = "☄"; kicker.textContent = "END OF TRANSMISSION"; title.textContent = "GAME OVER";
      description.textContent = "The Swinetrek is going to need some repairs. Your high score is saved on this device.";
      main.textContent = "START A NEW RUN →"; secondary.textContent = "MISSION SELECT";
    } else {
      icon.textContent = "Ⅱ"; kicker.textContent = "TRANSMISSION PAUSED"; title.textContent = "PAUSED";
      description.textContent = "Even space heroes deserve a snack break.";
      main.textContent = "RESUME GAME →"; secondary.textContent = "QUIT TO MISSIONS";
    }
  }
  function pause() {
    if (phase === "playing") showOverlay("paused");
    else if (phase === "paused") { phase = "playing"; overlay.classList.add("hidden"); }
  }
  function winMission() {
    if (phase !== "playing") return;
    addScore(1000);
    run.round++;
    game.flash = .3;
    melody(true);
    updateUi();
    showOverlay("complete");
  }
  function loseLife() {
    if (phase !== "playing" || game.invulnerable > 0) return;
    run.lives = Math.max(0, run.lives - 1);
    game.shake = .4; game.flash = .25; game.invulnerable = 2.0;
    updateUi();
    sound(220, .3, "sawtooth", .09, 60);
    if (game.mode === "chicken") {
      const s = game.state; particle(s.x, s.y, "#ff7bad", 23, 180);
      s.x = W / 2; s.eggs.length = 0;
    } else if (game.mode === "pasta") {
      const s = game.state; particle(s.x, s.y, "#ffb777", 18, 140);
      s.x = 300; s.y = 662; s.shipX = -110; s.shipTime = 0;
    } else {
      const s = game.state; particle(s.x, s.y, "#80fff0", 23, 170);
      s.x = W / 2; s.y = 625; s.pizzas.length = 0; s.rays.length = 0;
    }
    if (run.lives <= 0) { run.over = true; melody(false); showOverlay("over"); }
    else showToast("SHIELD LOST! " + run.lives + " LEFT");
  }

  // === VECTOR DRAWING UTILITIES ===
  function ellipse(x, y, rx, ry, color, stroke = null, sw = 1) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    if (color) { ctx.fillStyle = color; ctx.fill(); }
    if (stroke) { ctx.lineWidth = sw; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function line(points, color, width = 2, closed = false, fillColor = null) {
    ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    if (closed) ctx.closePath();
    if (fillColor) { ctx.fillStyle = fillColor; ctx.fill(); }
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
  }
  function glow(x, y, r, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, "transparent");
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function text(str, x, y, size = 18, color = "#fff", align = "center", family = "Barlow Condensed, Impact, sans-serif") {
    ctx.font = "900 " + size + "px " + family; ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  function roundRect(x, y, w, h, r, color, stroke = null) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (color) { ctx.fillStyle = color; ctx.fill(); }
    if (stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function drawBackground(dt, theme) {
    const bg = ctx.createLinearGradient(0, 0, 450, H);
    if (theme === "pasta") {
      bg.addColorStop(0, "#231534"); bg.addColorStop(.52, "#191528"); bg.addColorStop(1, "#0a102a");
      glow(420, 275, 245, "#4a273b86"); glow(110, 580, 205, "#4e2e5590");
    } else if (theme === "gonzo") {
      bg.addColorStop(0, "#0b2032"); bg.addColorStop(.55, "#081c2b"); bg.addColorStop(1, "#101126");
      glow(280, 160, 280, "#1b727e66");
    } else {
      bg.addColorStop(0, "#19143d"); bg.addColorStop(.5, "#0f1534"); bg.addColorStop(1, "#171028");
      glow(125, 205, 270, "#4930747b"); glow(500, 515, 250, "#4f275d58");
    }
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    for (const s of stars) {
      const y = ((s.y + (game ? game.time * s.speed * (theme === "gonzo" ? 4 : .5) : 0)) % H + H) % H;
      const a = .28 + .62 * (.5 + .5 * Math.sin((game ? game.time : 0) * 2 + s.phase));
      ctx.globalAlpha = a; ctx.fillStyle = "#e9f7ff"; ctx.fillRect(s.x, y, s.size, s.size);
      if (s.size > 1.75) {
        ctx.fillRect(s.x - 3, y + s.size / 2, s.size + 6, .6);
        ctx.fillRect(s.x + s.size / 2, y - 3, .7, s.size + 6);
      }
    }
    ctx.globalAlpha = 1;
    // Decorative distant planet and rings, deliberately kept behind game entities.
    if (theme === "chicken") {
      glow(540, 510, 160, "#d749b63b");
      ellipse(552, 520, 95, 95, "#563d83");
      ellipse(536, 493, 44, 21, "#7b5c9e65");
      line([[475, 567], [503, 550], [541, 541], [583, 549]], "#b17cc450", 5);
    } else if (theme === "pasta") {
      glow(475, 535, 180, "#df85522d");
      ellipse(495, 545, 85, 85, "#674054");
      ellipse(475, 510, 28, 15, "#ab6c6977");
    }
  }
  function sceneTitle(label, sub, color) {
    roundRect(22, 16, 556, 49, 12, "#0b0d25a8", "#9a9dcb44");
    text(label, 39, 39, 19, color, "left");
    text(sub, 561, 39, 12, "#d2d7ee", "right");
    ctx.strokeStyle = color; ctx.globalAlpha = .6; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(38, 51); ctx.lineTo(135, 51); ctx.stroke(); ctx.globalAlpha = 1;
  }
  function drawPig(x, y, scale = 1, outfit = "captain", time = 0) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    const bob = Math.sin(time * 8) * 1.5;
    ctx.translate(0, bob);
    // Suit and boots.
    ellipse(0, 28, 25, 28, outfit === "piggy" ? "#d75baf" : "#446ec4", "#142b57", 3);
    ellipse(-12, 52, 10, 8, "#212648"); ellipse(12, 52, 10, 8, "#212648");
    ellipse(-28, 24, 12, 8, "#f7a0c3", "#a9537d", 2);
    ellipse(28, 24, 12, 8, "#f7a0c3", "#a9537d", 2);
    ellipse(-27, -20, 12, 21, "#f68db7", "#a95287", 2);
    ellipse(27, -20, 12, 21, "#f68db7", "#a95287", 2);
    ellipse(0, -17, 34, 34, "#f7a7c5", "#9f4974", 3);
    ellipse(-10, -22, 5.5, 7, "#fff");
    ellipse(11, -22, 5.5, 7, "#fff");
    ellipse(-9, -21, 2.5, 4, "#24304a");
    ellipse(12, -21, 2.5, 4, "#24304a");
    ellipse(0, -5, 20, 13, "#ef84aa", "#b15880", 2);
    ellipse(-7, -5, 3, 4, "#ab5a7d"); ellipse(7, -5, 3, 4, "#ab5a7d");
    ctx.strokeStyle = "#9b466f"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 6, 10, .15, Math.PI - .15); ctx.stroke();
    if (outfit === "piggy") {
      ellipse(0, -45, 18, 8, "#ffe09d"); ellipse(0, -47, 12, 6, "#f8c373");
      ellipse(18, -38, 11, 7, "#ffc9df");
      ellipse(9, -12, 1.8, 2, "#61294c");
    } else {
      roundRect(-25, -52, 50, 16, 7, "#edf4fd", "#6c94ca");
      ellipse(0, -53, 7, 4, "#f4ba51");
      roundRect(-15, 24, 30, 7, 2, "#f4c463");
      ellipse(0, 27, 4, 4, "#ffffff");
    }
    ctx.restore();
  }
  function drawChicken(x, y, size = 1, tick = 0) {
    ctx.save(); ctx.translate(x, y); ctx.scale(size, size);
    const flap = Math.sin(tick * 12);
    ellipse(-22, 4 + flap * 3, 13, 20, "#ead7ff", "#aa77d6", 2);
    ellipse(22, 4 - flap * 3, 13, 20, "#ead7ff", "#aa77d6", 2);
    ellipse(0, 2, 22, 23, "#fff1e8", "#dba3cb", 2.2);
    ellipse(0, -15, 19, 17, "#fff8ec");
    ellipse(-10, -19, 3.8, 5.4, "#202442"); ellipse(10, -19, 3.8, 5.4, "#202442");
    ellipse(-9.5, -20.5, 1.4, 1.8, "#fff"); ellipse(10.5, -20.5, 1.4, 1.8, "#fff");
    line([[-10, -33], [-6, -42], [1, -34], [7, -43], [13, -29]], "#ee699a", 7);
    line([[-10, -1], [0, 6], [10, -1]], "#e4a348", 2, true, "#ffca64");
    line([[-8, 23], [-9, 32], [-15, 34]], "#f6bc62", 3);
    line([[8, 23], [9, 32], [15, 34]], "#f6bc62", 3);
    ctx.restore();
  }
  function drawSausage(x, y) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 2);
    ctx.shadowColor = "#ffb05f"; ctx.shadowBlur = 14;
    roundRect(-15, -5, 30, 10, 6, "#ec7952", "#ffcf88");
    ellipse(-13, 0, 3, 4, "#ffcc84"); ellipse(13, 0, 3, 4, "#ffcc84");
    ctx.restore();
  }
  function drawEgg(x, y) {
    glow(x, y, 20, "#ffd2b755");
    ellipse(x, y, 8, 12, "#fff0de", "#edbcca", 2);
    ellipse(x - 2, y - 3, 2, 3, "#fff");
  }
  function drawUfo(x, y, scale = 1, t = 0) {
    ctx.save(); ctx.translate(x, y + Math.sin(t * 4) * 2); ctx.scale(scale, scale);
    glow(0, 20, 60, "#54edda55");
    ellipse(0, 5, 39, 19, "#81def5", "#f0eaff", 3);
    ellipse(0, -6, 20, 21, "#f7aaca", "#fee9ec", 2);
    ellipse(0, 11, 59, 14, "#9aa1d8", "#d8edff", 3);
    for (const dx of [-35, -18, 0, 18, 35]) ellipse(dx, 13, 3.5, 4, "#fff8a5");
    ellipse(-7, -9, 2.8, 3, "#283655"); ellipse(8, -9, 2.8, 3, "#283655");
    ellipse(1, -1, 13, 7, "#f88ab6");
    ctx.restore();
  }
  function drawMeatball(x, y, r = 20, spin = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(spin);
    glow(0, 0, r * 1.9, "#fd986b35");
    ellipse(0, 0, r, r, "#a94c37", "#eea266", 2);
    for (const [dx, dy, sz] of [[-8,-7,4],[9,4,5],[-2,10,3],[8,-9,2]]) ellipse(dx, dy, sz, sz * .7, "#e27e4d");
    ellipse(-5, -11, 5, 2, "#f7b48a94");
    ctx.restore();
  }
  function drawSpaghetti(x, y, width = 105, tick = 0) {
    ctx.save(); ctx.translate(x, y);
    glow(0, 0, width * .8, "#ffb96c1d");
    for (let j = 0; j < 5; j++) {
      ctx.beginPath();
      for (let i = 0; i <= 18; i++) {
        const px = -width / 2 + i * width / 18;
        const py = Math.sin(i * .8 + tick * 5 + j * 1.4) * 7 + j * 5 - 11;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = j % 2 ? "#ffcd79" : "#ffe09e"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.stroke();
    }
    ctx.restore();
  }
  function drawRobot(x, y, side, t = 0) {
    ctx.save(); ctx.translate(x, y); ctx.scale(side === "left" ? 1 : -1, 1);
    ctx.translate(0, Math.sin(t * 5) * 2);
    ellipse(0, 9, 20, 25, "#7c9ab6", "#243e67", 3);
    roundRect(-20, -25, 40, 38, 9, "#a4bcd1", "#243e67");
    ellipse(-7, -10, 5, 6, "#ff7898"); ellipse(10, -10, 5, 6, "#ff7898");
    line([[13,-3],[35,2],[13,10]], "#47657a", 2, true, "#e3bd67");
    line([[0,-25],[0,-41],[9,-45]], "#92b8cd", 4);
    ellipse(10, -45, 5, 5, "#ff7f9d");
    line([[-16,24],[-18,35],[-28,36]], "#7791b0", 5);
    line([[12,24],[18,35],[28,36]], "#7791b0", 5);
    ctx.restore();
  }
  function drawPizza(x, y, r = 17, angle = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    glow(0, 0, r * 2, "#f4a24a2b");
    ellipse(0, 0, r, r, "#d78e40", "#f7d78d", 3);
    ellipse(0, 0, r - 4, r - 4, "#f5bd4c");
    for (const [px, py] of [[-6,-5],[6,3],[-3,8],[7,-7]]) ellipse(px, py, 3.5, 3.5, "#d45159");
    ctx.restore();
  }
  function drawRay(x, y, a = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.shadowBlur = 18; ctx.shadowColor = "#66fdf1";
    line([[-9,0],[-2,-7],[9,-7],[16,0],[9,7],[-2,7],[-9,0]], "#b8fff0", 3);
    ellipse(0, 0, 5, 5, "#8bfdef");
    ctx.restore();
  }
  function drawPlayerShip(x, y, t = 0) {
    ctx.save(); ctx.translate(x, y);
    const tilt = game && game.state ? clamp(game.state.tilt || 0, -.22, .22) : 0;
    ctx.rotate(tilt);
    glow(0, 21, 105, "#51edf970");
    const flame = Math.sin(t * 26) * 7;
    line([[-17,36],[-9,78 + flame],[0,52],[9,78 + flame],[17,36]], "#ffa15d", 2, true, "#ffd481");
    line([[-12,35],[0,66 + flame],[12,35]], "#abebfa", 2, true, "#71eaff");
    line([[0,-57],[-27,-8],[-40,27],[-15,35],[0,25],[15,35],[40,27],[27,-8]], "#e6faff", 3, true, "#659bb9");
    line([[-40,26],[-30,-2],[-22,12],[-20,37]], "#f3bd77", 3);
    line([[40,26],[30,-2],[22,12],[20,37]], "#f3bd77", 3);
    ellipse(0, -10, 20, 29, "#152942", "#9ff3ef", 3);
    ellipse(0, -12, 13, 18, "#f7aaca", "#ecfbff", 2);
    ellipse(-5, -17, 2, 3, "#22344c"); ellipse(6, -17, 2, 3, "#22344c");
    ellipse(0, -8, 8, 5, "#f477a7");
    ellipse(-28, 17, 5, 5, "#faffd4"); ellipse(28, 17, 5, 5, "#faffd4");
    ctx.restore();
  }

  // === MISSION 1: CHICKENVADERS ===
  function newChicken() {
    const chickens = [];
    for (let row = 0; row < 5; row++) for (let col = 0; col < 7; col++) chickens.push({ x: 105 + col * 64, y: 177 + row * 54, row, col, alive: true });
    return { x: 300, y: 660, chickens, bullets: [], eggs: [], formationX: 0, formationY: 0, dir: 1, eggClock: 1.1, fireClock: 0, saucerX: -100, saucerClock: 9.5, saucerActive: false };
  }
  function updateChicken(dt) {
    const s = game.state;
    let move = Number(pressed.right || keys.right) - Number(pressed.left || keys.left);
    if (pointer.active) move = clamp((pointer.x - s.x) / 35, -1, 1);
    s.x = clamp(s.x + move * 365 * dt, 40, W - 40);
    s.fireClock -= dt;
    if ((pressed.fire || keys.fire) && s.fireClock <= 0 && s.bullets.length < 2) {
      s.fireClock = .23;
      s.bullets.push({ x: s.x, y: s.y - 45 });
      sound(480, .075, "square", .025, 160);
    }
    const speed = 27 + game.difficulty * 8 + (35 - s.chickens.length) * 1.35;
    s.formationX += s.dir * speed * dt;
    const living = s.chickens;
    if (living.length) {
      const min = Math.min(...living.map((c) => c.x)) + s.formationX;
      const max = Math.max(...living.map((c) => c.x)) + s.formationX;
      if ((max > 552 && s.dir > 0) || (min < 48 && s.dir < 0)) {
        s.dir *= -1; s.formationY += 13;
        if (s.formationY + 430 > 600) { loseLife(); s.formationY = 0; }
      }
    }
    s.eggClock -= dt;
    if (s.eggClock <= 0 && living.length) {
      const chicken = living[Math.floor(rand(0, living.length))];
      s.eggs.push({ x: chicken.x + s.formationX, y: chicken.y + s.formationY + 26, v: 185 + game.difficulty * 16 });
      s.eggClock = rand(.62, 1.22) / (1 + game.difficulty * .07);
    }
    for (let i = s.bullets.length - 1; i >= 0; i--) {
      const b = s.bullets[i]; b.y -= 600 * dt;
      if (b.y < 25) { s.bullets.splice(i, 1); continue; }
      if (s.saucerActive && Math.abs(b.x - s.saucerX) < 49 && Math.abs(b.y - 99) < 21) {
        s.bullets.splice(i, 1); s.saucerActive = false; s.saucerClock = rand(7, 12);
        addScore(300); particle(s.saucerX, 99, "#8cf7fc", 23, 180); sound(840, .19, "triangle", .09, 290); showToast("GONZO BONUS +300");
        continue;
      }
      const index = s.chickens.findIndex((c) => Math.abs(b.x - (c.x + s.formationX)) < 24 && Math.abs(b.y - (c.y + s.formationY)) < 26);
      if (index >= 0) {
        const c = s.chickens[index]; particle(c.x + s.formationX, c.y + s.formationY, "#ffd5ed", 12, 115);
        addScore([100, 70, 50, 20, 10][c.row]);
        s.chickens.splice(index, 1); s.bullets.splice(i, 1);
        sound(650, .085, "triangle", .06, 250);
        if (!s.chickens.length) { winMission(); return; }
      }
    }
    for (let i = s.eggs.length - 1; i >= 0; i--) {
      const e = s.eggs[i]; e.y += e.v * dt;
      if (e.y > H + 20) { s.eggs.splice(i, 1); continue; }
      if (game.invulnerable <= 0 && Math.abs(e.x - s.x) < 28 && Math.abs(e.y - (s.y - 12)) < 44) {
        s.eggs.splice(i, 1); loseLife(); break;
      }
    }
    if (!s.saucerActive) {
      s.saucerClock -= dt;
      if (s.saucerClock < 0) { s.saucerX = -80; s.saucerActive = true; }
    } else { s.saucerX += (130 + game.difficulty * 8) * dt; if (s.saucerX > W + 90) { s.saucerActive = false; s.saucerClock = rand(7, 11); } }
  }
  function drawChickenScene(dt) {
    const s = game.state;
    drawBackground(dt, "chicken");
    // Ground under the defender.
    ctx.fillStyle = "#241f51"; ctx.fillRect(0, 710, W, 50);
    for (let x = 0; x < W; x += 25) { ellipse(x, 721 + Math.sin(x) * 2, 16, 6, "#4d3d76"); }
    line([[0,704],[600,704]], "#be6cbd", 3);
    sceneTitle("PLANET CLUCK", s.chickens.length + " CHICKENS REMAINING", "#ff91ca");
    if (s.saucerActive) drawUfo(s.saucerX, 100, .78, game.time);
    for (const c of s.chickens) {
      drawChicken(c.x + s.formationX, c.y + s.formationY, .68, game.time + c.col * .45);
    }
    for (const e of s.eggs) drawEgg(e.x, e.y);
    for (const b of s.bullets) drawSausage(b.x, b.y);
    if (game.invulnerable <= 0 || Math.floor(game.time * 9) % 2 === 0) drawPig(s.x, s.y, .92, "captain", game.time);
    if (game.invulnerable > 0) { ctx.strokeStyle = "#7af8f688"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, s.y - 4, 55, 0, TAU); ctx.stroke(); }
    drawParticles();
  }

  // === MISSION 2: PASTAROIDS ===
  function newPasta() {
    const hazards = [];
    for (let row = 0; row < 5; row++) {
      const y = 206 + row * 86, sign = row % 2 ? -1 : 1;
      for (let col = 0; col < 3; col++) hazards.push({
        x: col * 240 + row * 72 - 55, y, vx: sign * (78 + row * 22 + Math.min(run.round, 10) * 7),
        kind: (row + col) % 3 === 0 ? "spaghetti" : "meatball", spin: rand(0, TAU), size: row % 2 ? 21 : 19
      });
    }
    return { x: 300, y: 658, shipX: -95, shipTime: 0, hazards, chopTime: 0, chopPulse: 0, knockback: 0 };
  }
  function updatePasta(dt) {
    const s = game.state;
    let dx = Number(pressed.right || keys.right) - Number(pressed.left || keys.left);
    let dy = Number(pressed.down || keys.down) - Number(pressed.up || keys.up);
    if (pointer.active) { dx = clamp((pointer.x - s.x) / 45, -1, 1); dy = clamp((pointer.y - s.y) / 45, -1, 1); }
    const length = Math.max(1, Math.hypot(dx, dy));
    s.x = clamp(s.x + dx / length * 295 * dt, 36, W - 36);
    s.y = clamp(s.y + dy / length * 295 * dt, 98, 680);
    s.shipTime += dt;
    s.shipX = -110 + s.shipTime * (45 + game.difficulty * 2);
    if (s.shipX > W + 98) { loseLife(); return; }
    if (s.y < 155 && Math.abs(s.x - s.shipX) < 79) { particle(s.shipX, 107, "#ffd88b", 35, 160); winMission(); return; }
    s.chopTime -= dt; s.chopPulse = Math.max(0, s.chopPulse - dt);
    if ((pressed.fire || keys.fire) && s.chopTime <= 0) {
      s.chopTime = .29; s.chopPulse = .2; sound(340, .07, "triangle", .04, 700);
      let chopped = 0;
      for (let i = s.hazards.length - 1; i >= 0; i--) {
        const h = s.hazards[i];
        if (h.kind === "meatball" && hit(h, s, 76)) {
          chopped++;
          particle(h.x, h.y, "#ffa565", 13, 120);
          s.hazards.splice(i, 1);
        }
      }
      if (chopped) { addScore(chopped * 100); showToast("KARATE CHOP! +" + chopped * 100, .75); sound(730, .16, "square", .045, 440); }
    }
    for (const h of s.hazards) {
      h.x += h.vx * dt; h.spin += dt * (h.vx > 0 ? 2 : -2);
      if (h.vx > 0 && h.x > W + 85) h.x = -90;
      if (h.vx < 0 && h.x < -90) h.x = W + 90;
      const radius = h.kind === "spaghetti" ? 38 : 29;
      if (game.invulnerable <= 0 && hit(h, s, radius)) {
        particle(s.x, s.y, "#ffb5b6", 15, 110);
        s.y = 670; s.x = clamp(s.x + (h.vx > 0 ? 30 : -30), 40, W - 40);
        game.invulnerable = .95; game.shake = .15;
        showToast("PASTA PANIC! BACK TO START", 1.0);
        sound(180, .22, "sawtooth", .045, 70);
        break;
      }
    }
  }
  function drawPastaScene(dt) {
    const s = game.state;
    drawBackground(dt, "pasta");
    // Boarding bay and a visible upward flight corridor.
    ctx.fillStyle = "#18244366"; ctx.fillRect(31, 145, 538, 548);
    ctx.setLineDash([10, 16]); ctx.strokeStyle = "#8d7ba85c"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(300, 161); ctx.lineTo(300, 693); ctx.stroke(); ctx.setLineDash([]);
    for (let y = 185; y < 680; y += 86) {
      line([[45,y + 40],[555,y + 40]], "#8d729c34", 2);
    }
    roundRect(30, 78, 540, 90, 15, "#5dcac917", "#65e7d878");
    text("DOCKING LANE", 50, 93, 12, "#8df8ea", "left");
    const remaining = Math.max(0, (W + 100 - s.shipX) / (45 + game.difficulty * 2));
    sceneTitle("PASTEROID STORM", Math.ceil(remaining) + "s UNTIL DEPARTURE", "#ffca85");
    drawUfo(s.shipX, 121, 1.07, game.time);
    // Flight lane ends with a very clear destination marker.
    for (const h of s.hazards) {
      if (h.kind === "spaghetti") drawSpaghetti(h.x, h.y, 115, game.time + h.spin);
      else drawMeatball(h.x, h.y, h.size, h.spin);
    }
    if (game.invulnerable <= 0 || Math.floor(game.time * 9) % 2 === 0) drawPig(s.x, s.y, .78, "piggy", game.time);
    if (s.chopPulse > 0) {
      ctx.strokeStyle = "#ffeab1"; ctx.lineWidth = 9 * s.chopPulse / .2; ctx.globalAlpha = s.chopPulse / .2;
      ctx.beginPath(); ctx.arc(s.x + 8, s.y, 71 - s.chopPulse * 60, -1.1, 1.25); ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (game.invulnerable > 0) { ctx.strokeStyle = "#ffb8d580"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x,s.y,42,0,TAU); ctx.stroke(); }
    drawParticles();
  }

  // === MISSION 3: ESCAPE THE PLANET OF THE GONZOIDS ===
  function newGonzo() {
    return { x: 300, y: 621, tilt: 0, lastDir: 1, progress: 0, maxDistance: 1250 + Math.min(run.round, 8) * 210,
      scoreMiles: 0, robots: [], pizzas: [], rays: [], spawnClock: 1.2, fireClock: 0 };
  }
  function canyonBounds(y, dist) {
    const wave = (dist + (H - y) * 1.3);
    const center = Math.sin(wave * .0037) * 44 + Math.sin(wave * .0081) * 17;
    const narrowing = Math.sin(wave * .0064 + .9) * 16;
    return { left: 97 + center + narrowing, right: 503 + center - narrowing };
  }
  function updateGonzo(dt) {
    const s = game.state;
    let dx = Number(pressed.right || keys.right) - Number(pressed.left || keys.left);
    let dy = Number(pressed.down || keys.down) - Number(pressed.up || keys.up);
    if (pointer.active) { dx = clamp((pointer.x - s.x) / 45, -1, 1); dy = clamp((pointer.y - s.y) / 50, -1, 1); }
    const len = Math.max(1, Math.hypot(dx, dy));
    s.x += dx / len * 290 * dt; s.y += dy / len * 230 * dt;
    s.y = clamp(s.y, 220, 680);
    if (dx !== 0) s.lastDir = Math.sign(dx);
    s.tilt += (dx * .23 - s.tilt) * Math.min(1, dt * 9);
    const travel = (50 + game.difficulty * 5) * dt;
    s.progress += travel;
    s.scoreMiles += travel;
    if (s.scoreMiles >= 18) { const miles = Math.floor(s.scoreMiles / 18); addScore(miles); s.scoreMiles -= miles * 18; }
    if (s.progress >= s.maxDistance) { winMission(); return; }
    const walls = canyonBounds(s.y, s.progress);
    if (game.invulnerable <= 0 && (s.x - 32 < walls.left || s.x + 32 > walls.right)) {
      loseLife(); return;
    }
    if (game.invulnerable > 0) s.x = clamp(s.x, walls.left + 40, walls.right - 40);
    s.fireClock -= dt;
    if ((pressed.fire || keys.fire) && s.fireClock <= 0) {
      s.fireClock = .48;
      s.rays.push({ x: s.x + s.lastDir * 10, y: s.y - 47, vx: s.lastDir * 157, vy: -470, age: 0, spin: 0 });
      sound(740, .13, "triangle", .05, 240);
    }
    for (let i = s.rays.length - 1; i >= 0; i--) {
      const r = s.rays[i]; r.age += dt; r.x += r.vx * dt; r.y += r.vy * dt; r.vy += 650 * dt; r.spin += dt * 11;
      if (r.x < -50 || r.x > W + 50 || r.y < -55 || r.y > H + 40 || r.age > 2.5) { s.rays.splice(i, 1); continue; }
      if (game.invulnerable <= 0 && r.age > .75 && hit(r, s, 32)) { s.rays.splice(i, 1); loseLife(); break; }
      let destroyed = false;
      for (let j = s.robots.length - 1; j >= 0; j--) {
        if (hit(r, s.robots[j], 34)) {
          particle(r.x, r.y, "#80f9e1", 20, 150);
          s.robots.splice(j, 1); addScore(100); sound(590, .17, "square", .08, 170);
          s.rays.splice(i, 1); destroyed = true; break;
        }
      }
      if (destroyed) continue;
    }
    s.spawnClock -= dt;
    if (s.spawnClock <= 0 && s.progress < s.maxDistance - 120) {
      const side = Math.random() < .5 ? "left" : "right";
      const bound = canyonBounds(-35, s.progress);
      const robot = { x: side === "left" ? bound.left + 27 : bound.right - 27, y: -45, side, clock: rand(.6, 1.8), t: 0 };
      s.robots.push(robot);
      s.spawnClock = rand(1.05, 2.1) / (1 + game.difficulty * .04);
    }
    for (const robot of s.robots) {
      robot.y += (113 + game.difficulty * 4) * dt; robot.t += dt; robot.clock -= dt;
      const bound = canyonBounds(robot.y, s.progress);
      robot.x = robot.side === "left" ? bound.left + 27 : bound.right - 27;
      if (robot.clock <= 0 && robot.y < 620 && robot.y > 0) {
        s.pizzas.push({ x: robot.x, y: robot.y, vx: robot.side === "left" ? 130 : -130, vy: rand(30, 85), spin: 0 });
        robot.clock = rand(1.4, 2.2); sound(230, .09, "sine", .015, 360);
      }
    }
    s.robots = s.robots.filter((r) => r.y < H + 60);
    for (let i = s.pizzas.length - 1; i >= 0; i--) {
      const p = s.pizzas[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.spin += dt * 5;
      if (p.x < -35 || p.x > W + 35 || p.y > H + 45) { s.pizzas.splice(i, 1); continue; }
      if (game.invulnerable <= 0 && hit(p, s, 37)) { s.pizzas.splice(i, 1); loseLife(); break; }
    }
  }
  function drawCanyon(s) {
    ctx.save();
    const left = [], right = [];
    for (let y = -24; y <= H + 24; y += 12) {
      const b = canyonBounds(y, s.progress);
      left.push([b.left, y]); right.push([b.right, y]);
    }
    // Dark canyon outside the safe corridor, plus mineral strata and glowing edge markers.
    const lg = ctx.createLinearGradient(0, 0, 158, 0);
    lg.addColorStop(0, "#161429"); lg.addColorStop(.52, "#392341"); lg.addColorStop(1, "#8c4564");
    const rg = ctx.createLinearGradient(440, 0, 600, 0);
    rg.addColorStop(0, "#a45b67"); rg.addColorStop(.5, "#442a49"); rg.addColorStop(1, "#161529");
    ctx.beginPath(); ctx.moveTo(0, -24);
    for (const p of left) ctx.lineTo(p[0], p[1]);
    ctx.lineTo(0, H + 24); ctx.closePath(); ctx.fillStyle = lg; ctx.fill();
    ctx.beginPath(); ctx.moveTo(W, -24);
    for (const p of right) ctx.lineTo(p[0], p[1]);
    ctx.lineTo(W, H + 24); ctx.closePath(); ctx.fillStyle = rg; ctx.fill();
    for (let k = 0; k < 12; k++) {
      const y = (k * 91 + s.progress * 2) % (H + 90) - 45;
      const b = canyonBounds(y, s.progress);
      line([[0,y+15],[b.left - 6,y],[b.left-15,y+39]], "#d1847950", 4);
      line([[W,y+15],[b.right+6,y],[b.right+15,y+39]], "#d1847950", 4);
      ellipse(b.left - 20, y + 17, 6, 4, "#f99c805e"); ellipse(b.right + 21, y + 19, 6, 4, "#f99c805e");
    }
    line(left, "#feaf87", 4); line(right, "#feaf87", 4);
    ctx.shadowColor = "#ff9d83"; ctx.shadowBlur = 12;
    line(left, "#ff9f8a", 1.6); line(right, "#ff9f8a", 1.6);
    ctx.shadowBlur = 0; ctx.restore();
    // Canyon floor chevrons to make forward movement legible.
    ctx.globalAlpha = .19; ctx.strokeStyle = "#70cfd0"; ctx.lineWidth = 2;
    for (let k = 0; k < 10; k++) {
      const y = (k * 105 + s.progress * 2.3) % (H + 60) - 30;
      const b = canyonBounds(y, s.progress);
      const mid = (b.left + b.right) / 2;
      line([[mid-28,y-8],[mid,y+6],[mid+28,y-8]], "#70cfd0", 2);
    }
    ctx.globalAlpha = 1;
  }
  function drawGonzoScene(dt) {
    const s = game.state;
    drawBackground(dt, "gonzo");
    drawCanyon(s);
    sceneTitle("PIZZA MINE · SECTOR 7", Math.round(100 * s.progress / s.maxDistance) + "% TO ESCAPE", "#8ff9e8");
    for (const robot of s.robots) drawRobot(robot.x, robot.y, robot.side, robot.t);
    for (const pizza of s.pizzas) drawPizza(pizza.x, pizza.y, 18, pizza.spin);
    for (const r of s.rays) drawRay(r.x, r.y, r.spin);
    if (game.invulnerable <= 0 || Math.floor(game.time * 9) % 2 === 0) drawPlayerShip(s.x, s.y, game.time);
    if (game.invulnerable > 0) { ctx.strokeStyle = "#5bf8f38c"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(s.x,s.y,49,71,0,0,TAU); ctx.stroke(); }
    roundRect(32, 707, 536, 16, 7, "#081629dd", "#527c7c");
    roundRect(35, 710, 530 * clamp(s.progress / s.maxDistance, 0, 1), 10, 5, "#65e3d7");
    text("EXIT", 566, 699, 12, "#d8fffb", "right");
    drawParticles();
  }

  function update(dt) {
    if (!game || phase !== "playing") return;
    game.time += dt;
    game.invulnerable = Math.max(0, game.invulnerable - dt);
    game.shake = Math.max(0, game.shake - dt);
    game.flash = Math.max(0, game.flash - dt);
    updateParticles(dt);
    if (game.mode === "chicken") updateChicken(dt);
    else if (game.mode === "pasta") updatePasta(dt);
    else updateGonzo(dt);
  }
  function render(dt) {
    if (!game || phase === "menu") return;
    ctx.save();
    if (game.shake > 0 && phase === "playing") ctx.translate(rand(-5, 5), rand(-5, 5));
    if (game.mode === "chicken") drawChickenScene(dt);
    else if (game.mode === "pasta") drawPastaScene(dt);
    else drawGonzoScene(dt);
    if (game.flash > 0) {
      ctx.fillStyle = "rgba(255,245,242," + (.25 * game.flash / .3) + ")";
      ctx.fillRect(0, 0, W, H);
    }
    const vignette = ctx.createRadialGradient(W/2,H/2,150,W/2,H/2,530);
    vignette.addColorStop(0,"transparent"); vignette.addColorStop(1,"#05041c92");
    ctx.fillStyle = vignette; ctx.fillRect(0,0,W,H);
    ctx.restore();
  }

  function loop(timestamp) {
    const dt = Math.min(.034, Math.max(0, (timestamp - (previousFrame || timestamp)) / 1000));
    previousFrame = timestamp;
    if (phase === "playing") {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = pads && Array.from(pads).find(Boolean);
      if (pad) {
        const x = pad.axes[0] || 0, y = pad.axes[1] || 0;
        pressed.left = x < -.25 || !!pad.buttons[14]?.pressed;
        pressed.right = x > .25 || !!pad.buttons[15]?.pressed;
        pressed.up = y < -.25 || !!pad.buttons[12]?.pressed;
        pressed.down = y > .25 || !!pad.buttons[13]?.pressed;
        pressed.fire = !!(pad.buttons[0]?.pressed || pad.buttons[1]?.pressed);
        gamepadFireWasDown = pressed.fire;
      } else if (gamepadFireWasDown) { pressed.fire = false; gamepadFireWasDown = false; }
      update(dt);
    }
    if (phase !== "menu") render(dt);
    if (toastUntil && performance.now() > toastUntil) { $("toast").classList.remove("shown"); toastUntil = 0; }
    requestAnimationFrame(loop);
  }

  function setupCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.lineJoin = "round"; ctx.lineCap = "round";
  }
  function eventToPoint(event) {
    const r = canvas.getBoundingClientRect();
    return { x: clamp((event.clientX - r.left) * W / r.width, 0, W), y: clamp((event.clientY - r.top) * H / r.height, 0, H) };
  }
  function bind() {
    document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => chooseMode(button.dataset.mode)));
    $("backButton").addEventListener("click", goHome);
    $("pauseButton").addEventListener("click", pause);
    $("helpButton").addEventListener("click", () => {
      if (phase === "playing") pause();
      $("helpDialog").showModal();
    });
    $("muteButton").textContent = muted ? "♪̸" : "♫";
    $("muteButton").addEventListener("click", () => {
      muted = !muted; storage.set("cosmic-muted", muted ? "1" : "0");
      $("muteButton").textContent = muted ? "♪̸" : "♫";
      $("muteButton").setAttribute("aria-label", muted ? "Enable sound" : "Mute sound");
      if (!muted) sound(660, .08);
    });
    $("overlayMain").addEventListener("click", () => {
      if (phase === "paused") { phase = "playing"; overlay.classList.add("hidden"); }
      else if (phase === "complete") goHome();
      else if (phase === "over") { resetRun(); goHome(); }
    });
    $("overlaySecondary").addEventListener("click", () => {
      if (phase === "complete") chooseMode(activeMode);
      else goHome();
    });
    const controlButtons = document.querySelectorAll("[data-control]");
    controlButtons.forEach((button) => {
      const dir = button.dataset.control;
      const down = (event) => {
        event.preventDefault(); button.setPointerCapture?.(event.pointerId);
        pressed[dir] = true; button.classList.add("pressed");
        if (dir === "fire") sound(220,.025,"sine",.008);
      };
      const up = (event) => {
        event.preventDefault(); pressed[dir] = false; button.classList.remove("pressed");
      };
      button.addEventListener("pointerdown", down);
      button.addEventListener("pointerup", up);
      button.addEventListener("pointercancel", up);
      button.addEventListener("lostpointercapture", up);
      button.addEventListener("contextmenu", (event) => event.preventDefault());
    });
    const keymap = { ArrowLeft:"left", KeyA:"left", ArrowRight:"right", KeyD:"right", ArrowUp:"up", KeyW:"up", ArrowDown:"down", KeyS:"down", Space:"fire", KeyJ:"fire", Enter:"fire" };
    window.addEventListener("keydown", (event) => {
      if ($("helpDialog").open) return;
      if (event.code === "Escape" || event.code === "KeyP") { if (phase !== "menu") { event.preventDefault(); if (!event.repeat) pause(); } return; }
      const key = keymap[event.code];
      if (key && phase === "playing") { event.preventDefault(); keys[key] = true; }
    });
    window.addEventListener("keyup", (event) => { const key = keymap[event.code]; if (key) keys[key] = false; });
    window.addEventListener("blur", () => { if (phase === "playing") pause(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden && phase === "playing") pause(); });
    canvas.addEventListener("pointerdown", (event) => {
      if (phase !== "playing") return;
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      pointer.id = event.pointerId; pointer.active = true;
      const p = eventToPoint(event); pointer.x = p.x; pointer.y = p.y;
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!pointer.active || pointer.id !== event.pointerId) return;
      const p = eventToPoint(event); pointer.x = p.x; pointer.y = p.y;
    });
    const stopPointer = (event) => { if (pointer.id === event.pointerId) { pointer.active = false; pointer.id = null; } };
    canvas.addEventListener("pointerup", stopPointer);
    canvas.addEventListener("pointercancel", stopPointer);
    window.addEventListener("resize", setupCanvas);
    document.addEventListener("contextmenu", (event) => { if (event.target.closest(".game-view")) event.preventDefault(); });
  }

  setupCanvas();
  bind();
  updateUi(true);
  requestAnimationFrame(loop);
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
})();