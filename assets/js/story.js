// The box, told by scrolling: the stage stays pinned while the page scrolls, and scroll position
// drives the camera, the switches, the knob and the exploded view. Scrolling back rewinds it.
// Without WebGL, or with reduced motion, the captions simply read as a list.
import { createBox } from "./box3d.js";

const story = document.getElementById("story"), stage = document.getElementById("storyStage");
const caps = [...document.querySelectorAll("#storyCaps li")], bar = document.getElementById("storyBar");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Keyframes along the scroll, 0 to 1. dir = where the camera looks from, zoom < 1 is closer,
// sy shifts the view up (+) or down (−) in model units, ex = how far apart the parts are.
const KEYS = [
  { p: 0.00, dir: [-0.36, 0.12, 1], zoom: 1.00, sy: 0, ex: 0 },
  { p: 0.10, dir: [-0.36, 0.12, 1], zoom: 1.00, sy: 0, ex: 0 },
  { p: 0.22, dir: [-0.10, 0.02, 1], zoom: 0.55, sy: -80, ex: 0 },     // the switches
  { p: 0.34, dir: [-0.10, 0.02, 1], zoom: 0.55, sy: -80, ex: 0 },
  { p: 0.44, dir: [0.12, 0.04, 1], zoom: 0.56, sy: 30, ex: 0 },       // the knob
  { p: 0.54, dir: [0.12, 0.04, 1], zoom: 0.56, sy: 30, ex: 0 },
  { p: 0.62, dir: [-0.30, 0.16, 1], zoom: 0.80, sy: 30, ex: 0 },      // the light
  { p: 0.70, dir: [-0.30, 0.16, 1], zoom: 0.80, sy: 30, ex: 0 },
  { p: 0.86, dir: [-1.25, 0.34, 1], zoom: 1.00, sy: 0, ex: 1 },       // open
  { p: 0.92, dir: [-1.25, 0.34, 1], zoom: 1.00, sy: 0, ex: 1 },
  { p: 1.00, dir: [-1.7, 0.62, 0.7], zoom: 1.00, sy: 0, ex: 1 },      // round to the panel
];
const CAP_AT = [[0, 0.13], [0.17, 0.36], [0.40, 0.56], [0.60, 0.72], [0.76, 0.92], [0.94, 1.01]];
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const lerp = (a, b, t) => a + (b - a) * t;

let box = null;
if (story && stage && !reduce) {
  try { box = createBox(stage, { mode: "explore", story: true, driven: true, people: 2 }); } catch (e) { box = null; }
}
if (box) {
  story.classList.add("live");
  let want = -1, shown = -1, confirmed = false;
  const apply = p => {
    let i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = ease(Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p))));
    box.setView(lerp(a.dir[0], b.dir[0], t), lerp(a.dir[1], b.dir[1], t), lerp(a.dir[2], b.dir[2], t), lerp(a.zoom, b.zoom, t), 0, lerp(a.sy, b.sy, t));
    box.setExplode(lerp(a.ex, b.ex, t));
    // the controls follow the scroll too, and rewind with it
    box.setSwitch(0, p > 0.24 && p < 0.99, false);
    box.setSwitch(1, p > 0.29 && p < 0.99, false);
    const k = p < 0.44 ? 2 : Math.min(8, 2 + Math.round((p - 0.44) / 0.10 * 6));
    box.setPeople(k);
    if (p > 0.62 && p < 0.74) { if (!confirmed) { confirmed = true; box.pulse(); } } else confirmed = false;
    caps.forEach((li, n) => {
      const [s, e] = CAP_AT[n], fade = 0.035;
      const o = Math.max(0, Math.min(1, (p - s) / fade, (e - p) / fade));
      li.style.opacity = o; li.style.transform = `translateY(${(1 - o) * 14}px)`;
      li.style.visibility = o > 0.01 ? "visible" : "hidden";
    });
    bar.style.transform = `scaleX(${p})`;
  };
  const read = () => {
    const r = story.getBoundingClientRect(), span = r.height - innerHeight;
    return Math.max(0, Math.min(1, -r.top / Math.max(1, span)));
  };
  const tick = () => { const p = read(); if (Math.abs(p - shown) > 0.0004) { shown = p; apply(p); } want = -1; };
  const onScroll = () => { if (want < 0) want = requestAnimationFrame(tick); };
  addEventListener("scroll", onScroll, { passive: true }); addEventListener("resize", onScroll);
  apply(read());
}
