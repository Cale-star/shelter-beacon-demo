// Range test 1: one dot per packet received. Single series, so no legend; the title names it.
const pk = JSON.parse(document.getElementById("data").textContent).pkts;       // [seconds, number, rssi, snr]
const svg = document.getElementById("chart"), tip = document.getElementById("tip"), wrap = document.getElementById("chartWrap");
const W = 1120, H = 420, L = 56, R = 1100, T = 16, B = 372;
const tMax = pk[pk.length - 1][0], yHi = -10, yLo = -135, FLOOR = -129;
const x = t => L + t / tMax * (R - L), y = v => T + (yHi - v) / (yHi - yLo) * (B - T);
const minus = v => String(v).replace("-", "−");

// the longest silence between two packets
let gap = [0, 0];
for (let i = 1; i < pk.length; i++) if (pk[i][0] - pk[i - 1][0] > gap[1] - gap[0]) gap = [pk[i - 1][0], pk[i][0]];

let h = "";
for (let v = -20; v >= -120; v -= 20) h += `<line x1="${L}" x2="${R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 8}" y="${y(v) + 5}" text-anchor="end" font-size="14" fill="var(--ink-2)">${minus(v)}</text>`;
for (let m = 0; m * 60 <= tMax; m += 5) h += `<text x="${x(m * 60)}" y="${B + 24}" text-anchor="middle" font-size="14" fill="var(--ink-2)">${m}</text>`;
h += `<text x="${R}" y="${B + 44}" text-anchor="end" font-size="14" fill="var(--ink-2)">minutes into the test</text>`;
h += `<rect x="${x(gap[0])}" y="${T}" width="${x(gap[1]) - x(gap[0])}" height="${B - T}" fill="var(--need-bg)"/>`;
h += `<text x="${(x(gap[0]) + x(gap[1])) / 2}" y="${T + 26}" text-anchor="middle" font-size="15" font-weight="700" fill="var(--need)">nothing for ${((gap[1] - gap[0]) / 60).toFixed(1)} minutes</text>`;
h += `<text x="${(x(gap[0]) + x(gap[1])) / 2}" y="${T + 46}" text-anchor="middle" font-size="14" fill="var(--need)">186 packets lost in a row</text>`;
h += `<line x1="${L}" x2="${R}" y1="${y(FLOOR)}" y2="${y(FLOOR)}" stroke="var(--ink-2)" stroke-width="1.5" stroke-dasharray="5 5"/>`;
h += `<text x="${R}" y="${y(FLOOR) - 7}" text-anchor="end" font-size="14" fill="var(--ink-2)">calculated limit, −129 dBm</text>`;
h += pk.map(p => `<circle cx="${x(p[0]).toFixed(1)}" cy="${y(p[2]).toFixed(1)}" r="2.6" fill="var(--ink)" fill-opacity=".55"/>`).join("");
const weak = pk.reduce((a, b) => b[2] < a[2] ? b : a);
h += `<circle cx="${x(weak[0])}" cy="${y(weak[2])}" r="6" fill="none" stroke="var(--ink)" stroke-width="2"/>`;
h += `<text x="${x(weak[0]) + 4}" y="${y(weak[2]) + 26}" font-size="14" font-weight="700" fill="var(--ink)">weakest decoded, ${minus(weak[2])} dBm</text>`;
h += `<circle id="hover" r="7" fill="var(--caution-fill)" stroke="var(--paper)" stroke-width="2" visibility="hidden"/>`;
svg.innerHTML = h;

// hover / touch: nearest packet in time
const dot = svg.querySelector("#hover");
function show(e) {
  const r = svg.getBoundingClientRect(), t = ((e.clientX - r.left) / r.width * W - L) / (R - L) * tMax;
  let best = pk[0];
  for (const p of pk) if (Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p;
  if (Math.abs(best[0] - t) > 20) return hide();
  dot.setAttribute("cx", x(best[0])); dot.setAttribute("cy", y(best[2])); dot.setAttribute("visibility", "visible");
  const mm = Math.floor(best[0] / 60), ss = String(Math.floor(best[0] % 60)).padStart(2, "0");
  tip.textContent = `${mm}:${ss} in · ${minus(best[2])} dBm · signal-to-noise ${minus(best[3])} dB`;
  const wr = wrap.getBoundingClientRect();
  tip.style.left = Math.max(120, Math.min(wr.width - 120, r.left - wr.left + x(best[0]) / W * r.width)) + "px";
  tip.style.top = (r.top - wr.top + y(best[2]) / H * r.height - 14) + "px";
  tip.classList.add("on");
}
function hide() { tip.classList.remove("on"); dot.setAttribute("visibility", "hidden"); }
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
