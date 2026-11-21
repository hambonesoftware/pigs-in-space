import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync("game.js", "utf8");
new vm.Script(source, { filename: "game.js" });
new vm.Script(readFileSync("sw.js", "utf8"), { filename: "sw.js" });
const manifest = JSON.parse(readFileSync("manifest.webmanifest", "utf8"));
assert.equal(manifest.display, "standalone");
for (const path of ["index.html", "styles.css", "icon.svg", "apple-icon.svg", ".github/workflows/pages.yml"]) {
  assert.ok(existsSync(path), "Missing " + path);
}
const html = readFileSync("index.html", "utf8");
for (const target of ["game.js", "styles.css", "manifest.webmanifest", 'data-mode="chicken"', 'data-mode="pasta"', 'data-mode="gonzo"']) {
  assert.ok(html.includes(target), "Missing HTML target " + target);
}

function mockElement(id, dataset = {}) {
  const listeners = {};
  const classes = new Set();
  const el = {
    id, dataset, textContent: "", width: 0, height: 0, style: {}, open: false,
    classList: {
      add(key) { classes.add(key); },
      remove(key) { classes.delete(key); },
      contains(key) { return classes.has(key); }
    },
    addEventListener(key, handler) { (listeners[key] ??= []).push(handler); },
    emit(key, event = {}) {
      const evt = { pointerId: 7, preventDefault() {}, ...event };
      for (const handler of listeners[key] ?? []) handler(evt);
    },
    getBoundingClientRect() { return { left: 0, top: 0, width: 600, height: 760 }; },
    setPointerCapture() {},
    setAttribute() {},
    showModal() { this.open = true; },
    getContext() { return drawingContext; }
  };
  return el;
}
const drawingContext = new Proxy({}, {
  get(target, prop) {
    if (prop === "createLinearGradient" || prop === "createRadialGradient")
      return () => ({ addColorStop() {} });
    if (prop in target) return target[prop];
    return () => {};
  },
  set(target, prop, value) { target[prop] = value; return true; }
});
const ids = [
  "game", "menu", "gameView", "overlay", "controlHint", "fireText",
  "scoreText", "roundText", "livesText", "homeBest", "modeLabel",
  "toast", "overlayIcon", "overlayKicker", "overlayTitle", "overlayText",
  "overlayMain", "overlaySecondary", "backButton", "pauseButton",
  "helpButton", "muteButton", "helpDialog"
];
const elements = Object.fromEntries(ids.map((id) => [id, mockElement(id)]));
const modes = ["chicken", "pasta", "gonzo"].map((mode) => mockElement(mode, { mode }));
const controls = ["left", "right", "up", "down", "fire"].map((control) => mockElement(control, { control }));
const windowListeners = {};
const doc = {
  getElementById(id) { assert.ok(elements[id], "Missing mocked element " + id); return elements[id]; },
  querySelectorAll(selector) {
    if (selector === "[data-mode]") return modes;
    if (selector === "[data-control]") return controls;
    return [];
  },
  addEventListener() {},
  hidden: false
};
const fakeWindow = {
  devicePixelRatio: 2,
  addEventListener(key, cb) { windowListeners[key] = cb; }
};
const local = {};
const localStorage = {
  getItem(key) { return local[key] ?? null; },
  setItem(key, value) { local[key] = String(value); }
};
let nextFrame = null;
let now = 0;
const requestAnimationFrame = (callback) => { nextFrame = callback; };
const sandbox = {
  window: fakeWindow, document: doc, navigator: { getGamepads: () => [] },
  localStorage, location: { protocol: "http:" },
  performance: { now: () => now }, requestAnimationFrame,
  Math, Number, String, Object, Array, console
};

new vm.Script(source).runInNewContext(sandbox);
assert.ok(nextFrame, "Animation loop did not start");
assert.equal(elements.game.width, 1200, "High-DPI backing canvas width");
assert.equal(elements.game.height, 1520, "High-DPI backing canvas height");
assert.equal(elements.homeBest.textContent, "000000");

function tick(frames) {
  for (let i = 0; i < frames; i++) {
    now += 16.667;
    assert.equal(typeof nextFrame, "function");
    const callback = nextFrame; nextFrame = null; callback(now);
  }
}
for (const mode of modes) {
  mode.emit("click");
  assert.equal(elements.gameView.classList.contains("hidden"), false, mode.dataset.mode + " not visible");
  assert.equal(elements.modeLabel.textContent.length > 0, true);
  controls.find((x) => x.dataset.control === "fire").emit("pointerdown");
  controls.find((x) => x.dataset.control === "right").emit("pointerdown");
  tick(100);
  controls.find((x) => x.dataset.control === "fire").emit("pointerup");
  controls.find((x) => x.dataset.control === "right").emit("pointerup");
  elements.game.emit("pointerdown", { clientX: 450, clientY: 300 });
  elements.game.emit("pointermove", { clientX: 300, clientY: 400 });
  tick(25);
  elements.game.emit("pointerup");
  elements.pauseButton.emit("click");
  assert.equal(elements.overlay.classList.contains("hidden"), false, "Pause overlay missing");
  elements.overlayMain.emit("click");
  assert.equal(elements.overlay.classList.contains("hidden"), true, "Resume did not hide pause overlay");
  tick(10);
  elements.backButton.emit("click");
  assert.equal(elements.menu.classList.contains("hidden"), false, "Return to menu failed");
  console.log("PASS: " + mode.dataset.mode + " started, rendered, accepted controls, paused and returned to menu");
}
console.log("PASS: all three game modes, app shell and syntax checks");
