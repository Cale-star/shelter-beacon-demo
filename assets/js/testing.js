// Range test 1: one dot per packet received. Single series, so no legend; the title names it.
// Drawn twice over: a wide layout, and a tall one for phones so the text stays readable.
const pk = JSON.parse(document.getElementById("data").textContent).pkts;       // [seconds, number, rssi, snr]
const svg = document.getElementById("chart"), tip = document.getElementById("tip"), wrap = document.getElementById("chartWrap");
const mq = matchMedia("(max-width: 700px)");
const tMax = pk[pk.length - 1][0], yHi = -10, yLo = -135, FLOOR = -129;
const minus = v => String(v).replace("-", "−");
// Silences over a minute. If the packet number went backwards across one, the carried board restarted:
// that's a reboot, not the radio, so it's drawn and labelled differently.
const gaps = [];
for (let i = 1; i < pk.length; i++) if (pk[i][0] - pk[i - 1][0] > 60) gaps.push({ a: pk[i - 1][0], b: pk[i][0], reset: pk[i][1] < pk[i - 1][1], lost: pk[i][1] - pk[i - 1][1] - 1 });
const gap = (() => { const g = gaps.filter(g => !g.reset).sort((p, q) => (q.b - q.a) - (p.b - p.a))[0]; return [g.a, g.b, g.lost]; })();
const restart = gaps.find(g => g.reset);
// short dropouts: missing numbers between packets less than a minute apart
const drops = []; for (let i = 1; i < pk.length; i++) { const m = pk[i][1] - pk[i - 1][1] - 1; if (m > 0 && pk[i][0] - pk[i - 1][0] <= 60) drops.push(m); }
const weak = pk.reduce((a, b) => b[2] < a[2] ? b : a);
let G = null, played = 0, playing = false;

function draw() {
  const n = mq.matches;
  const W = n ? 400 : 1120, H = n ? 470 : 420, L = n ? 46 : 56, R = W - (n ? 6 : 20), T = 16, B = H - (n ? 56 : 48), fs = n ? 15 : 14;
  const x = t => L + t / tMax * (R - L), y = v => T + (yHi - v) / (yHi - yLo) * (B - T);
  G = { W, H, L, R, x, y };
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  let h = "";
  for (let v = -20; v >= -120; v -= 20) h += `<line x1="${L}" x2="${R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 7}" y="${y(v) + 5}" text-anchor="end" font-size="${fs}" fill="var(--ink-2)">${minus(v)}</text>`;
  for (let m = 0; m * 60 <= tMax; m += n ? 10 : 5) h += `<text x="${x(m * 60)}" y="${B + 22}" text-anchor="middle" font-size="${fs}" fill="var(--ink-2)">${m}</text>`;
  h += `<text x="${R}" y="${B + 44}" text-anchor="end" font-size="${fs}" fill="var(--ink-2)">minutes into the test</text>`;
  h += `<rect x="${x(gap[0])}" y="${T}" width="${x(gap[1]) - x(gap[0])}" height="${B - T}" fill="var(--need-bg)"/>`;
  const mins = ((gap[1] - gap[0]) / 60).toFixed(1);
  if (n) {
    h += `<text x="${x(gap[1]) + 8}" y="${T + 20}" font-size="${fs}" font-weight="700" fill="var(--ink)">${mins} min of nothing</text>`;
    h += `<text x="${x(gap[1]) + 8}" y="${T + 40}" font-size="${fs}" fill="var(--ink-2)">${gap[2]} lost in a row</text>`;
  } else {
    h += `<text x="${(x(gap[0]) + x(gap[1])) / 2}" y="${T + 26}" text-anchor="middle" font-size="15" font-weight="700" fill="var(--ink)">nothing for ${mins} minutes</text>`;
    h += `<text x="${(x(gap[0]) + x(gap[1])) / 2}" y="${T + 46}" text-anchor="middle" font-size="14" fill="var(--ink-2)">${gap[2]} packets lost in a row</text>`;
  }
  if (restart) {
    const rx = x(restart.a), rw = x(restart.b) - rx, rm = ((restart.b - restart.a) / 60).toFixed(1);
    h += `<rect x="${rx}" y="${T}" width="${rw}" height="${B - T}" fill="var(--ink)" fill-opacity=".08"/>`;
    h += `<text x="${rx - 8}" y="${T + (n ? 20 : 26)}" text-anchor="end" font-size="${n ? fs : 15}" font-weight="700" fill="var(--ink)">board restarted</text>`;
    h += `<text x="${rx - 8}" y="${T + (n ? 40 : 46)}" text-anchor="end" font-size="${n ? fs : 14}" fill="var(--ink-2)">${rm} min, not the radio</text>`;
  }
  h += `<line x1="${L}" x2="${R}" y1="${y(FLOOR)}" y2="${y(FLOOR)}" stroke="var(--ink-2)" stroke-width="1.5" stroke-dasharray="5 5"/>`;
  h += `<text x="${R}" y="${y(FLOOR) + (n ? 17 : -7)}" text-anchor="end" font-size="${fs}" fill="var(--ink-2)">${n ? "limit" : "calculated limit"}, −129 dBm</text>`;
  h += `<defs><clipPath id="reveal"><rect id="revealR" x="0" y="0" width="${played >= 1 ? W : x(played * tMax) + 3}" height="${H}"/></clipPath></defs>`;
  h += `<g clip-path="url(#reveal)">` + pk.map(p => `<circle cx="${x(p[0]).toFixed(1)}" cy="${y(p[2]).toFixed(1)}" r="${n ? 2 : 2.6}" fill="var(--ink)" fill-opacity=".55"/>`).join("") + `</g>`;
  h += `<line id="head" x1="0" x2="0" y1="${T}" y2="${B}" stroke="var(--caution-fill)" stroke-width="2" visibility="hidden"/>`;
  h += `<circle cx="${x(weak[0])}" cy="${y(weak[2])}" r="6" fill="none" stroke="var(--ink)" stroke-width="2"/>`;
  const halo = `paint-order="stroke" stroke="var(--paper)" stroke-width="5" stroke-linejoin="round"`;
  h += n ? `<line x1="${x(weak[0])}" y1="${y(weak[2]) - 7}" x2="${x(weak[0]) + 8}" y2="${y(-88) + 26}" stroke="var(--ink)"/><text x="${x(weak[0]) + 10}" y="${y(-88)}" font-size="${fs}" font-weight="700" fill="var(--ink)" ${halo}>weakest decoded</text><text x="${x(weak[0]) + 10}" y="${y(-88) + 19}" font-size="${fs}" font-weight="700" fill="var(--ink)" ${halo}>${minus(weak[2])} dBm</text>`
         : `<text x="${x(weak[0]) + 4}" y="${y(weak[2]) + 26}" font-size="14" font-weight="700" fill="var(--ink)" ${halo}>weakest decoded, ${minus(weak[2])} dBm</text>`;
  h += `<circle id="hover" r="7" fill="var(--caution-fill)" stroke="var(--paper)" stroke-width="2" visibility="hidden"/>`;
  svg.innerHTML = h;
}
draw();
mq.addEventListener("change", draw);

// Replay the walk: a playhead sweeps the 41 minutes and packets appear as they arrived.
const replayBtn = document.getElementById("replay"), clock = document.getElementById("replayClock");
function replay() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { played = 1; draw(); return; }
  played = 0; playing = true; replayBtn.disabled = true;
  const t0 = performance.now(), D = 6500;
  (function step(now) {
    played = Math.min(1, (now - t0) / D);
    const t = played * tMax, X = G.x(t), r = svg.querySelector("#revealR"), head = svg.querySelector("#head");
    r.setAttribute("width", played >= 1 ? G.W : X + 3);
    head.setAttribute("x1", X); head.setAttribute("x2", X); head.setAttribute("visibility", played < 1 ? "visible" : "hidden");
    const got = pk.filter(p => p[0] <= t).length, inGap = t > gap[0] && t < gap[1], inRestart = restart && t > restart.a && t < restart.b;
    clock.textContent = played < 1 ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")} into the walk, ${got} packets heard${inGap ? ". Nothing is getting through." : inRestart ? ". The carried board is restarting." : ""}` : `All ${pk.length} packets heard in 41 minutes.`;
    clock.classList.toggle("bad", inGap && played < 1);
    if (played < 1) requestAnimationFrame(step); else { playing = false; replayBtn.disabled = false; }
  })(t0);
}
replayBtn.onclick = replay;
if ("IntersectionObserver" in window) { const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); replay(); } }, { threshold: .5 }); io.observe(svg); }
else { played = 1; draw(); }

// hover / touch: nearest packet in time
function show(e) {
  const dot = svg.querySelector("#hover");
  const r = svg.getBoundingClientRect(), t = ((e.clientX - r.left) / r.width * G.W - G.L) / (G.R - G.L) * tMax;
  let best = pk[0];
  for (const p of pk) if (Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p;
  if (Math.abs(best[0] - t) > 20) return hide();
  dot.setAttribute("cx", G.x(best[0])); dot.setAttribute("cy", G.y(best[2])); dot.setAttribute("visibility", "visible");
  const mm = Math.floor(best[0] / 60), ss = String(Math.floor(best[0] % 60)).padStart(2, "0");
  tip.innerHTML = `<b>${minus(best[2])} dBm</b> at ${mm}:${ss}<br>signal-to-noise ${minus(best[3])} dB`;
  const wr = wrap.getBoundingClientRect();
  tip.style.left = Math.max(90, Math.min(wr.width - 90, r.left - wr.left + G.x(best[0]) / G.W * r.width)) + "px";
  tip.style.top = (r.top - wr.top + G.y(best[2]) / G.H * r.height - 14) + "px";
  tip.classList.add("on");
}
function hide() { tip.classList.remove("on"); const d = svg.querySelector("#hover"); if (d) d.setAttribute("visibility", "hidden"); }
svg.addEventListener("pointermove", show); svg.addEventListener("pointerdown", show); svg.addEventListener("pointerleave", hide);

// the table view
const rows = [
  ["Packets received", pk.length],
  ["Missed in short dropouts", `${drops.reduce((a, b) => a + b, 0)}, in ${drops.length} dropouts (longest ${Math.max(...drops)} in a row)`],
  ["Missed in the long blackout", gap[2]],
  ["Length of the test", Math.round(tMax / 60) + " min"], ["Strongest signal", minus(Math.max(...pk.map(p => p[2]))) + " dBm"],
  ["Weakest signal decoded", minus(weak[2]) + " dBm"], ["Lowest signal-to-noise decoded", minus(Math.min(...pk.map(p => p[3]))) + " dB"],
  ["Longest silence", Math.round((gap[1] - gap[0]) / 60 * 10) / 10 + " min"],
  ...(restart ? [["Board restart (count went back to zero)", Math.round((restart.b - restart.a) / 60 * 10) / 10 + " min"]] : []),
];
document.getElementById("statRows").innerHTML = rows.map(r => `<tr><th>${r[0]}</th><td>${r[1]}</td></tr>`).join("");
