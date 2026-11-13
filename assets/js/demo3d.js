// The demo page's 3D box. The flat box from the dashboard project stays in the page as the fallback;
// when WebGL works, this replaces it and drives the same demo engine through window.SBDemo.
import { createBox } from "./box3d.js";

const D = window.SBDemo, unit = document.querySelector(".unit"), stageWrap = document.querySelector(".stage");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const say = { W: "Water", M: "Medical", FD: "Food", SH: "Blankets", FU: "Fuel" };

if (D && unit) {
  const host = document.createElement("div");
  host.className = "demo3d";
  host.innerHTML = `
    <div class="stage3d" id="demoStage">
      <p class="stage-hint" id="demoHint"><span class="fine">Flip a switch on the box. Drag to turn it round.</span><span class="coarse">Tap a switch on the box. Swipe sideways to turn it.</span></p>
    </div>
    <div class="chips" id="demoChips" role="group" aria-label="Switches"></div>
    <div class="people-step" role="group" aria-label="About how many people">
      <button type="button" id="dLess" aria-label="Fewer people">−</button><output id="dOut" aria-live="polite"></output><button type="button" id="dMore" aria-label="More people">+</button>
    </div>`;
  unit.before(host);
  let box = null;
  try {
    box = createBox(host.querySelector("#demoStage"), {
      mode: "hero", people: D.knob(), driven: true,
      onSwitch: (on, fromUser) => { if (!fromUser) return; const cur = D.on(); D.NEEDS.forEach((n, i) => { if (!!cur[n.key] !== on[i]) D.flip(n.key); }); },
      onPeople: (i, fromUser) => { if (fromUser) D.setKnob(i); },
      onInteract: () => host.querySelector("#demoHint").classList.add("gone"),
    });
  } catch (e) { host.remove(); }

  if (box) {
    unit.classList.add("flat-off");
    const tryP = document.querySelector(".demo-try .try");
    if (tryP) tryP.textContent = "Flip a switch or turn the knob, on the box itself or with the buttons under it. Then try losing the signal.";
    // the accessible controls under the stage
    const chips = host.querySelector("#demoChips");
    const btns = D.NEEDS.map(n => {
      const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = say[n.key] || n.label;
      b.onclick = () => D.flip(n.key); chips.append(b); return b;
    });
    host.querySelector("#dLess").onclick = () => D.setKnob(D.knob() - 1);
    host.querySelector("#dMore").onclick = () => D.setKnob(D.knob() + 1);
    const sync = () => {
      const on = D.on(), k = D.knob(), v = D.OCC[k];
      D.NEEDS.forEach((n, i) => { box.setSwitch(i, !!on[n.key], false); btns[i].setAttribute("aria-pressed", String(!!on[n.key])); });
      box.setPeople(k);
      host.querySelector("#dOut").textContent = v === 0 ? "Nobody yet" : v >= 100 ? "100 or more people" : `About ${v} people`;
      host.querySelector("#dLess").disabled = k === 0; host.querySelector("#dMore").disabled = k === D.OCC.length - 1;
    };
    D.hooks.onBox = sync; sync();

    // the box's light follows the engine, like the firmware: blink per copy, glow on "got it", double-blink while waiting
    const prevWaiting = D.hooks.onWaiting, prevConfirmed = D.hooks.onConfirmed;
    D.hooks.onCopy.push(() => { box.flash(); fly(); });
    D.hooks.onWaiting = on => { prevWaiting && prevWaiting(on); box.setWaiting(on); };
    D.hooks.onConfirmed = late => { prevConfirmed && prevConfirmed(late); box.confirm(); fly(true); };
    D.hooks.onCopyOutcome = lost => { if (current) current.lost = lost; };

    // ---------- the radio, drawn across the page between the box and headquarters ----------
    const wide = matchMedia("(min-width: 881px)");
    const air = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    air.setAttribute("class", "air"); air.setAttribute("aria-hidden", "true");
    stageWrap.append(air);
    let current = null;
    function ends() {
      const s = stageWrap.getBoundingClientRect(), b = host.querySelector("#demoStage").getBoundingClientRect(), h = document.getElementById("headline").getBoundingClientRect();
      return [{ x: b.left - s.left + b.width * .5, y: b.top - s.top + b.height * .1 }, { x: h.left - s.left - 10, y: h.top - s.top + h.height * .45 }];
    }
    function fly(back) {
      if (reduce || !wide.matches) return;
      const hr = document.getElementById("headline").getBoundingClientRect();
      if (hr.bottom < 60 || hr.top > innerHeight) return;                       // headquarters is off screen: nothing to aim at
      const [A, B] = back ? ends().reverse() : ends();
      air.setAttribute("viewBox", `0 0 ${stageWrap.clientWidth} ${stageWrap.clientHeight}`);
      const c = { x: (A.x + B.x) / 2, y: Math.min(A.y, B.y) - 90 };
      const pt = t => ({ x: (1 - t) ** 2 * A.x + 2 * (1 - t) * t * c.x + t * t * B.x, y: (1 - t) ** 2 * A.y + 2 * (1 - t) * t * c.y + t * t * B.y });
      const NS = "http://www.w3.org/2000/svg", g = document.createElementNS(NS, "g");
      const path = document.createElementNS(NS, "path"), dot = document.createElementNS(NS, "circle");
      path.setAttribute("d", `M${A.x} ${A.y}Q${c.x} ${c.y} ${B.x} ${B.y}`); path.setAttribute("class", back ? "air-path ack" : "air-path");
      dot.setAttribute("r", 6); dot.setAttribute("class", back ? "air-dot ack" : "air-dot");
      g.append(path, dot); air.append(g);
      const L = path.getTotalLength(); path.style.strokeDasharray = `${L}`; path.style.strokeDashoffset = `${L}`;
      const f = { lost: false }; if (!back) current = f;
      const t0 = performance.now(), dur = 520;
      (function step(now) {
        const k = Math.min(1, (now - t0) / dur), stop = f.lost ? .55 : 1, t = Math.min(k, stop);
        const p = pt(t); dot.setAttribute("cx", p.x); dot.setAttribute("cy", p.y);
        path.style.strokeDashoffset = `${L * (1 - t)}`;
        if (k < stop) return requestAnimationFrame(step);
        if (f.lost) {
          const x = document.createElementNS(NS, "path"); x.setAttribute("d", `M${p.x - 8} ${p.y - 8}l16 16m0-16-16 16`); x.setAttribute("class", "air-x"); g.append(x); dot.remove();
        }
        g.style.transition = "opacity .9s .5s"; requestAnimationFrame(() => { g.style.opacity = 0; });
        setTimeout(() => g.remove(), 1600);
      })(t0);
    }
  }
}
