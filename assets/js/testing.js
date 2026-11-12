// Range test 1: one dot per packet received. Single series, so no legend; the title names it.
// Drawn twice over: a wide layout, and a tall one for phones so the text stays readable.
const pk = JSON.parse(document.getElementById("data").textContent).pkts;       // [seconds, number, rssi, snr]
const svg = document.getElementById("chart"), tip = document.getElementById("tip"), wrap = document.getElementById("chartWrap");
const mq = matchMedia("(max-width: 700px)");
const tMax = pk[pk.length - 1][0], yHi = -10, yLo = -135, FLOOR = -129;
const minus = v => String(v).replace("-", "−");
let gap = [0, 0];                                                              // the longest silence between two packets
for (let i = 1; i < pk.length; i++) if (pk[i][0] - pk[i - 1][0] > gap[1] - gap[0]) gap = [pk[i - 1][0], pk[i][0]];
const weak = pk.reduce((a, b) => b[2] < a[2] ? b : a);
let G = null;

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
    h += `<text x="${x(gap[1]) + 8}" y="${T + 40}" font-size="${fs}" fill="var(--ink-2)">186 lost in a row</text>`;
  } else {
    h += `<text x="${(x(gap[0]) + x(gap[1])) / 2}" y="${T + 26}" text-anchor="middle" font-size="15" font-weight="700" fill="var(--ink)">nothing for ${mins} minutes</text>`;
    h += `<text x="${(x(gap[0]) + x(gap[1])) / 2}" y="${T + 46}" text-anchor="middle" font-size="14" fill="var(--ink-2)">186 packets lost in a row</text>`;
  }
  h += `<line x1="${L}" x2="${R}" y1="${y(FLOOR)}" y2="${y(FLOOR)}" stroke="var(--ink-2)" stroke-width="1.5" stroke-dasharray="5 5"/>`;
  h += `<text x="${R}" y="${y(FLOOR) + (n ? 17 : -7)}" text-anchor="end" font-size="${fs}" fill="var(--ink-2)">${n ? "limit" : "calculated limit"}, −129 dBm</text>`;
  h += pk.map(p => `<circle cx="${x(p[0]).toFixed(1)}" cy="${y(p[2]).toFixed(1)}" r="${n ? 2 : 2.6}" fill="var(--ink)" fill-opacity=".55"/>`).join("");
  h += `<circle cx="${x(weak[0])}" cy="${y(weak[2])}" r="6" fill="none" stroke="var(--ink)" stroke-width="2"/>`;
  const halo = `paint-order="stroke" stroke="var(--paper)" stroke-width="5" stroke-linejoin="round"`;
  h += n ? `<line x1="${x(weak[0])}" y1="${y(weak[2]) - 7}" x2="${x(weak[0]) + 8}" y2="${y(-88) + 26}" stroke="var(--ink)"/><text x="${x(weak[0]) + 10}" y="${y(-88)}" font-size="${fs}" font-weight="700" fill="var(--ink)" ${halo}>weakest decoded</text><text x="${x(weak[0]) + 10}" y="${y(-88) + 19}" font-size="${fs}" font-weight="700" fill="var(--ink)" ${halo}>${minus(weak[2])} dBm</text>`
         : `<text x="${x(weak[0]) + 4}" y="${y(weak[2]) + 26}" font-size="14" font-weight="700" fill="var(--ink)" ${halo}>weakest decoded, ${minus(weak[2])} dBm</text>`;
  h += `<circle id="hover" r="7" fill="var(--caution-fill)" stroke="var(--paper)" stroke-width="2" visibility="hidden"/>`;
  svg.innerHTML = h;
}
draw();
mq.addEventListener("change", draw);

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
const lost = pk.slice(1).reduce((s, p, i) => s + Math.max(0, p[1] - pk[i][1] - 1), 0);
const rows = [
  ["Packets received", pk.length], ["Packets missed (gaps in the numbering)", lost],
  ["Length of the test", Math.round(tMax / 60) + " min"], ["Strongest signal", minus(Math.max(...pk.map(p => p[2]))) + " dBm"],
  ["Weakest signal decoded", minus(weak[2]) + " dBm"], ["Lowest signal-to-noise decoded", minus(Math.min(...pk.map(p => p[3]))) + " dB"],
  ["Longest silence", Math.round((gap[1] - gap[0]) / 60 * 10) / 10 + " min"],
];
document.getElementById("statRows").innerHTML = rows.map(r => `<tr><th>${r[0]}</th><td>${r[1]}</td></tr>`).join("");
