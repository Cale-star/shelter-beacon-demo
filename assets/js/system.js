const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = id => document.getElementById(id);
const NEEDS = [
  { key: "W", label: "Water", say: "water", w: 2 }, { key: "M", label: "Medical", say: "medical help", w: 3 },
  { key: "FD", label: "Food", say: "food", w: 1 }, { key: "SH", label: "Blankets", say: "blankets", w: 1 }, { key: "FU", label: "Fuel", say: "fuel", w: 1 },
];
const OCC = [0, 5, 10, 15, 20, 30, 40, 50, 60, 80, 100];
const join = a => a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];

// ---------- build a report ----------
const st = { on: { W: true }, occ: 4, n: 42, pick: 2 };
const swBox = $("pbSwitches");
NEEDS.forEach(n => {
  const b = document.createElement("button");
  b.className = "chip"; b.textContent = n.label; b.dataset.k = n.key;
  b.onclick = () => { st.on[n.key] = !st.on[n.key]; st.n++; st.pick = 2 + NEEDS.indexOf(n); paintReport(); };
  swBox.append(b);
});
$("pbLess").onclick = () => { if (st.occ > 0) { st.occ--; st.n++; st.pick = 7; paintReport(); } };
$("pbMore").onclick = () => { if (st.occ < OCC.length - 1) { st.occ++; st.n++; st.pick = 7; paintReport(); } };
function fields() {
  const occ = OCC[st.occ];
  return [
    { t: "PKT", note: "A tag. The receiver ignores anything that doesn't start with it." },
    { t: String(st.n), note: "The report number. Every copy of one report carries the same number, so headquarters can drop repeats and can tell when a report went missing." },
    ...NEEDS.map(n => ({ t: n.key + (st.on[n.key] ? 1 : 0), live: !!st.on[n.key], note: `${n.label}: ${st.on[n.key] ? "1, the switch is up, so it's needed." : "0, the switch is down."} Worth ${n.w} point${n.w > 1 ? "s" : ""} when it's on.` })),
    { t: "O" + occ, note: `About how many people: ${occ >= 100 ? "100 or more" : occ}. It comes from the 11-click knob, so it's a round number on purpose.` },
    { t: "H0", note: "How often the box checks in by itself, in seconds. 0 means it only speaks when something changes, which saves battery and airtime." },
  ];
}
function paintReport() {
  swBox.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(!!st.on[b.dataset.k])));
  const occ = OCC[st.occ];
  $("pbPeople").textContent = occ >= 100 ? "100+ people" : occ + " people";
  const f = fields(), box = $("packet");
  box.textContent = "";
  f.forEach((x, i) => {
    const b = document.createElement("button");
    b.textContent = x.t; if (x.live) b.classList.add("live");
    b.setAttribute("aria-pressed", String(i === st.pick));
    b.onclick = () => { st.pick = i; paintReport(); };
    box.append(b);
  });
  $("fieldNote").textContent = f[st.pick].note;
  // score
  const active = NEEDS.filter(n => st.on[n.key]).sort((a, b) => b.w - a.w);
  const parts = active.map(n => [n.say, n.w]);
  if (active.length && occ >= 50) parts.push([(occ >= 100 ? "100+" : occ) + " people", 2]);
  else if (active.length && occ >= 25) parts.push([occ + " people", 1]);
  const score = parts.reduce((s, p) => s + p[1], 0), level = score >= 3 ? "HIGH" : score >= 2 ? "MEDIUM" : "LOW";
  const unit = 100 / Math.max(10, score + 1);
  $("scorebar").innerHTML = parts.map(([l, p]) => `<i style="width:calc(${p * unit}% - 3px)">${l} ${p}</i>`).join("") || `<i style="width:auto;padding:0 12px;background:var(--line);color:var(--ink-2)">score 0</i>`;
  $("pbHead").textContent = active.length ? "Needs " + join(active.map(n => n.say)) : "Nothing needed";
  const tag = $("pbTag"); tag.dataset.level = level; tag.textContent = level[0] + level.slice(1).toLowerCase() + " priority";
  $("pbWhy").textContent = (parts.length ? `Score ${score}: ${parts.map(p => p.join(" ")).join(", ")}.` : "Score 0.") + " High is 3 or more.";
}
paintReport();

// ---------- one report, start to finish ----------
const seq = $("seq"), log = $("seqLog"), NS = "http://www.w3.org/2000/svg";
const BX = 150, HX = 610, TOP = 64;
let run = 0;
function el(tag, attrs, text) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text) e.textContent = text; return e; }
function baseSeq() {
  seq.textContent = "";
  seq.append(
    el("text", { x: BX, y: 26, "text-anchor": "middle", "font-size": 17, "font-weight": 700 }, "Shelter box"),
    el("text", { x: HX, y: 26, "text-anchor": "middle", "font-size": 17, "font-weight": 700 }, "Headquarters"),
    el("line", { x1: BX, y1: 44, x2: BX, y2: 410, stroke: "var(--line)", "stroke-width": 2 }),
    el("line", { x1: HX, y1: 44, x2: HX, y2: 410, stroke: "var(--line)", "stroke-width": 2 }));
}
function note(x, y, text, anchor, bold) { seq.append(el("text", { x, y, "text-anchor": anchor, "font-size": 15, "font-weight": bold ? 700 : 400, class: bold ? "" : "dim" }, text)); }
function addLog(t, text) { const li = document.createElement("li"), tm = document.createElement("time"); tm.textContent = t; li.append(tm, text); log.append(li); }
const wait = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));
async function arrow(y, toHQ, lost, color) {
  const x1 = toHQ ? BX : HX, x2full = toHQ ? HX : BX, x2 = lost ? x1 + (x2full - x1) * 0.55 : x2full, y2 = y + (lost ? 14 : 26);
  const line = el("line", { x1, y1: y, x2: x1, y2: y, stroke: color || "var(--ink)", "stroke-width": 2.5, "stroke-linecap": "round" });
  seq.append(line);
  if (!reduce) {
    const t0 = performance.now(), D = lost ? 380 : 560;
    await new Promise(done => { (function step(now) {
      const k = Math.min(1, (now - t0) / D);
      line.setAttribute("x2", x1 + (x2 - x1) * k); line.setAttribute("y2", y + (y2 - y) * k);
      k < 1 ? requestAnimationFrame(step) : done();
    })(t0); });
  } else { line.setAttribute("x2", x2); line.setAttribute("y2", y2); }
  if (lost) seq.append(el("path", { d: `M${x2 - 7} ${y2 - 7}l14 14m0-14-14 14`, stroke: "var(--need)", "stroke-width": 3, "stroke-linecap": "round", fill: "none" }));
  else seq.append(el("circle", { cx: x2, cy: y2, r: 5, fill: color || "var(--ink)" }));
}
async function play() {
  const me = ++run, blocked = $("seqBlock").checked, alive = () => me === run;
  baseSeq(); log.textContent = "";
  let y = TOP;
  note(BX - 14, y + 5, "switch flipped", "end", true); addLog("0.0 s", "Someone flips Water up. The box chirps once.");
  await wait(350); if (!alive()) return;
  if (blocked) {
    for (let k = 0; k < 3; k++) {
      await arrow(y, true, true); if (!alive()) return;
      note((BX + HX) / 2 + 40, y + 22, `copy ${k + 1} lost`, "start");
      addLog((0.1 + k * 0.7).toFixed(1) + " s", `Copy ${k + 1} is sent and never arrives.`);
      y += 44; await wait(300); if (!alive()) return;
    }
    note(BX - 14, y - 6, "one long beep", "end", true);
    addLog("2.4 s", "No answer. The box gives one long beep and its light starts double-blinking.");
    seq.append(el("path", { d: `M${BX - 8} ${y + 14}h16M${BX - 8} ${y + 22}h16`, stroke: "var(--ink-2)", "stroke-width": 2 }));
    note(BX + 16, y + 23, "waits 5 s, then tries again by itself", "start");
    y += 52; await wait(700); if (!alive()) return;
  }
  const tSend = blocked ? 7.4 : 0.1;
  await arrow(y, true, false); if (!alive()) return;
  note((BX + HX) / 2, y + 4, blocked ? "copy 1 of the retry" : "copy 1", "middle");
  addLog(tSend.toFixed(1) + " s", "A copy arrives. Headquarters updates the dashboard.");
  y += 40; await wait(200); if (!alive()) return;
  await arrow(y, false, false, "#b98900"); if (!alive()) return;
  note((BX + HX) / 2, y + 4, "“got report 42”", "middle");
  addLog((tSend + 0.4).toFixed(1) + " s", "Headquarters confirms. The box stops sending the other copies.");
  y += 44;
  note(BX - 14, y - 10, "two quick beeps", "end", true);
  note(HX + 14, y - 50, "dashboard updates", "start", true);
  addLog((tSend + 0.5).toFixed(1) + " s", "Two quick beeps and a steady glow: headquarters got it.");
}
$("seqGo").onclick = play;
$("seqBlock").onchange = play;
baseSeq();
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); play(); } }, { threshold: 0.5 });
  io.observe(seq);
} else play();

// ---------- link budget scale ----------
(function budget() {
  const svg = $("budget"), L = 40, R = 1080, hi = 30, lo = -140, y = 104;
  const x = v => L + (hi - v) / (hi - lo) * (R - L);
  let h = `<line x1="${L}" x2="${R}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="2"/>`;
  for (let v = 20; v >= -140; v -= 20) h += `<line x1="${x(v)}" x2="${x(v)}" y1="${y - 5}" y2="${y + 5}" stroke="var(--ink-2)"/><text x="${x(v)}" y="${y + 26}" text-anchor="middle" font-size="14" class="dim">${v > 0 ? "+" + v : v < 0 ? "−" + (-v) : 0}</text>`;
  h += `<text x="${R}" y="${y + 50}" text-anchor="end" font-size="14" class="dim">signal strength, dBm</text>`;
  h += `<rect x="${x(-21)}" y="${y - 7}" width="${x(-122) - x(-21)}" height="14" rx="7" fill="var(--ink)"/>`;
  h += `<rect x="${x(-122)}" y="${y - 7}" width="${x(-129) - x(-122)}" height="14" rx="7" fill="var(--caution-fill)"/>`;
  const mark = (v, top, a, b, anchor) => `<line x1="${x(v)}" x2="${x(v)}" y1="${y - 12}" y2="${top + 22}" stroke="var(--ink)" stroke-width="1.5"/><text x="${x(v)}" y="${top}" text-anchor="${anchor}" font-size="15" font-weight="700">${a}</text><text x="${x(v)}" y="${top + 18}" text-anchor="${anchor}" font-size="14" class="dim">${b}</text>`;
  h += mark(22, 28, "+22 dBm", "the box transmits", "start") + mark(-21, 28, "−21 dBm", "strongest heard, side by side", "middle")
    + mark(-122, 28, "−122 dBm", "weakest decoded in the field", "end") + mark(-129, 62, "−129", "limit", "start");
  svg.innerHTML = h;
})();
