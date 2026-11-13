// Two small calculators: the radio setting (spreading factor) and the power budget.
// Both say how sure each number is. Mounted on any element with data-tool="sf" or data-tool="power".
const $ = (sel, root = document) => root.querySelector(sel);
const fmt = (n, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const minus = s => String(s).replace("-", "−");

// ---------------- spreading factor ----------------
// Time on air from Semtech's formula: 31-byte report, 125 kHz, coding rate 4/7, 8-symbol preamble,
// explicit header, CRC on, low-data-rate optimisation at SF11 and SF12.
function airtime(sf, bytes = 31) {
  const ts = (2 ** sf) / 125000, de = sf >= 11 ? 1 : 0, cr = 3;
  const n = 8 + Math.max(Math.ceil((8 * bytes - 4 * sf + 28 + 16) / (4 * (sf - 2 * de))) * (cr + 4), 0);
  return (8 + 4.25 + n) * ts;
}
// Typical receive sensitivity at 125 kHz, rounded from the SX1262 datasheet figures.
const SENS = { 7: -123, 8: -126, 9: -129, 10: -132, 11: -134.5, 12: -137 };

function sfTool(el) {
  el.insertAdjacentHTML("beforeend", `
    <div class="tool-head"><label for="sfIn"><b>Spreading factor</b></label><output id="sfOut"></output></div>
    <input type="range" id="sfIn" min="7" max="12" step="1" value="9" list="sfTicks" aria-describedby="sfSay">
    <div class="tool-ticks" aria-hidden="true">${[7, 8, 9, 10, 11, 12].map(n => `<span>${n}</span>`).join("")}</div>
    <dl class="tool-out">
      <div><dt>On air, one copy</dt><dd id="sfAir"></dd></div>
      <div><dt>A whole report, three copies</dt><dd id="sfRep"></dd></div>
      <div><dt>Faintest signal it can read</dt><dd id="sfSens"></dd></div>
      <div><dt>Reach in open air, against SF9</dt><dd id="sfReach"></dd></div>
    </dl>
    <p class="tool-say" id="sfSay" aria-live="polite"></p>
    <p class="tool-src"><span class="ev" data-k="calculated">Calculated</span> Time on air from Semtech's LoRa formula. Sensitivity rounded from the SX1262 datasheet. Reach assumes open air; hills cut it down.</p>`);
  const inp = $("#sfIn", el);
  const paint = () => {
    const sf = +inp.value, a = airtime(sf), rep = 3 * a + 2 * 0.7, d = SENS[sf] - SENS[9], k = 10 ** (-d / 20);
    $("#sfOut", el).textContent = "SF" + sf + (sf === 9 ? ", what the box uses" : "");
    $("#sfAir", el).textContent = a < 1 ? fmt(a * 1000) + " ms" : fmt(a, 2) + " s";
    $("#sfRep", el).textContent = fmt(rep, 1) + " s";
    $("#sfSens", el).textContent = minus(SENS[sf]) + " dBm";
    $("#sfReach", el).textContent = sf === 9 ? "the baseline" : "about ×" + fmt(k, 1);
    $("#sfSay", el).textContent =
      sf < 9 ? `Faster and kinder to the battery. But the weakest signal in the first range test was −122 dBm, and SF${sf} would read that with only ${fmt(-122 - SENS[sf], 0)} dB to spare. A wet tree line costs more than that.`
      : sf === 9 ? "The middle of the range. Each copy is about a third of a second, and the receiver still has about 7 dB in hand below the weakest signal measured in the field."
      : `${fmt(d * -1, 1)} dB more reach, at ${fmt(a / airtime(9), 1)} times the time on air. Every box keeps the channel busy that much longer, so neighbours collide more and each report costs more battery.`;
    inp.setAttribute("aria-valuetext", "SF" + sf);
  };
  inp.addEventListener("input", paint); paint();
}

// ---------------- power ----------------
// Pack: 4 × 18650, ≈ 52 Wh. Draw today: the "about eight days with no sun" estimate works back to ≈ 0.27 W.
// Sleep mode (planned): the "about 4½ months" estimate works back to ≈ 16 mW. Panel: 1 W, ≈ 70% of it reaches the pack.
const PACK = 52, PANEL = 1, EFF = 0.7, DRAW = { now: 0.27, sleep: 0.016 };
function powerTool(el) {
  el.insertAdjacentHTML("beforeend", `
    <div class="tool-seg" role="radiogroup" aria-label="Firmware">
      <button role="radio" aria-checked="true" data-fw="now">Firmware today</button>
      <button role="radio" aria-checked="false" data-fw="sleep">With sleep mode</button>
    </div>
    <div class="tool-head"><label for="sunIn"><b>Hours of full sun a day</b></label><output id="sunOut"></output></div>
    <input type="range" id="sunIn" min="0" max="8" step="0.5" value="2">
    <div class="tool-ticks" aria-hidden="true">${[0, 2, 4, 6, 8].map(n => `<span>${n}</span>`).join("")}</div>
    <div class="tool-bar" aria-hidden="true"><span>Uses</span><i class="use"></i><span>Panel</span><i class="sun"></i></div>
    <dl class="tool-out">
      <div><dt>The box uses, per day</dt><dd id="pwUse"></dd></div>
      <div><dt>The panel adds, per day</dt><dd id="pwSun"></dd></div>
      <div class="big"><dt id="pwLastT">The pack lasts</dt><dd id="pwLast"></dd></div>
    </dl>
    <p class="tool-say" id="pwSay" aria-live="polite"></p>
    <p class="tool-src"><span class="ev" data-k="estimated">Estimated</span> From the parts' rated current, not a measurement yet. A USB power meter test will replace these numbers. Sleep mode is planned, not built.</p>`);
  let fw = "now";
  const sun = $("#sunIn", el);
  el.querySelectorAll("[data-fw]").forEach(b => b.onclick = () => {
    fw = b.dataset.fw; el.querySelectorAll("[data-fw]").forEach(x => x.setAttribute("aria-checked", String(x === b))); paint();
  });
  const days = d => d >= 60 ? fmt(d / 30, 1) + " months" : fmt(d, d < 10 ? 1 : 0) + " days";
  function paint() {
    const h = +sun.value, use = DRAW[fw] * 24, gain = PANEL * EFF * h, net = use - gain;
    $("#sunOut", el).textContent = h === 0 ? "none" : fmt(h, h % 1 ? 1 : 0) + (h === 1 ? " hour" : " hours");
    $("#pwUse", el).textContent = fmt(use, use < 1 ? 2 : 1) + " Wh";
    $("#pwSun", el).textContent = fmt(gain, 1) + " Wh";
    const bar = Math.max(use, gain, 0.01);
    $(".tool-bar .use", el).style.width = (use / bar * 100) + "%";
    $(".tool-bar .sun", el).style.width = (gain / bar * 100) + "%";
    if (net <= 0) {
      $("#pwLastT", el).textContent = "The pack";
      $("#pwLast", el).textContent = "keeps charging";
    } else {
      $("#pwLastT", el).textContent = h ? "The pack runs out in" : "With no sun, the pack lasts";
      $("#pwLast", el).textContent = days(PACK / net);
    }
    $("#pwSay", el).textContent = fw === "now"
      ? (net > 0 ? `Today the radio listens all the time. The 1 W panel only slows the drain; it would need about ${fmt(use / (PANEL * EFF), 0)} hours of full sun a day to keep up, which it never gets.`
                 : "The panel keeps up.")
      : (net > 0 ? "Asleep between switch flips, the box uses so little that even a dark week barely dents the pack."
                 : `Asleep between switch flips, about ${fmt(use / (PANEL * EFF) * 60, 0)} minutes of full sun a day covers everything. This is the change that makes the box able to wait on a wall for months.`);
    sun.setAttribute("aria-valuetext", $("#sunOut", el).textContent);
  }
  sun.addEventListener("input", paint); paint();
}

document.querySelectorAll('[data-tool="sf"]').forEach(sfTool);
document.querySelectorAll('[data-tool="power"]').forEach(powerTool);
