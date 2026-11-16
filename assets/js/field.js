// Field day 1 (October 18, 2026): the spot-by-spot results and the "spend the margin" tool.
// Numbers are from the field log. Distances marked ~ were map estimates; the rest are between GPS pins.
const LIMIT = -129;                       // calculated decode limit at SF9, dBm
const SPOTS = [
  { name: "Ridge, clear view", dist: "~125 m", rssi: -59, del: "100%", view: "Clear" },
  { name: "Ridge, through trees", dist: "280 m", rssi: -76, del: "100%", view: "Through trees" },
  { name: "Ridge to valley, the long one", dist: "1.41 km", rssi: -85, del: "100% (13 of 13)", view: "Clear", star: true },
  { name: "Valley, clear view", dist: "250 m", rssi: -86, del: "100% (60 of 60)", view: "Clear" },
  { name: "Ridge to ridge, box on the ground", dist: "302 m", rssi: -90, del: "100%", view: "Clear" },
  { name: "Hilltop, over the crest", dist: "~350 m", rssi: -101, lo: -119, del: "96 to 100%", view: "Blocked" },
  { name: "Valley, behind a spur", dist: "~250 m", rssi: -114, del: "100%", view: "Blocked" },
  { name: "Behind two ridges", dist: "972 m", rssi: null, del: "0%", view: "Blocked", dead: true },
];
const minus = n => String(n).replace("-", "−");

const spots = document.getElementById("spots");
if (spots) {
  const MAX = 75;                          // dB of scale
  spots.innerHTML = `<div class="spot head" role="row"><span role="columnheader">Spot</span><span role="columnheader">Distance</span><span role="columnheader">Signal to spare</span><span role="columnheader">Delivered</span></div>` +
    SPOTS.map(s => {
      const hi = s.rssi == null ? 0 : s.rssi - LIMIT, lo = s.lo == null ? hi : s.lo - LIMIT;
      const label = s.dead ? "none" : s.lo != null ? `${lo} to ${hi} dB` : `${hi} dB`;
      const bar = s.dead ? `<i class="bar none"></i>` :
        `<i class="bar${s.view === "Blocked" ? " blocked" : ""}" style="width:${(hi / MAX * 100).toFixed(1)}%">${s.lo != null ? `<i style="width:${(lo / hi * 100).toFixed(1)}%"></i>` : ""}</i>`;
      return `<div class="spot${s.star ? " star" : ""}${s.dead ? " dead" : ""}" role="row">
        <span role="cell"><b>${s.name}</b><small>${s.view}${s.rssi != null ? `, ${minus(s.lo != null ? s.rssi + " to " + s.lo : s.rssi)} dBm` : ", nothing heard"}</small></span>
        <span role="cell">${s.dist}</span>
        <span role="cell" class="barcell">${bar}<em>${label}</em></span>
        <span role="cell">${s.del}</span></div>`;
    }).join("");
}

// ---- spend the margin ----
const tool = document.getElementById("margin");
if (tool) {
  const START = 44;
  const COSTS = [
    { id: "flat", label: "Antenna laid flat", db: 30, how: "up to 30 dB" },
    { id: "hill", label: "A hill blocks the view", db: 28, how: "about 28 dB" },
    { id: "car", label: "Box inside a vehicle", db: 18, how: "18 dB at this distance" },
    { id: "ground", label: "Box on the ground", db: 13, how: "13 dB at this distance" },
    { id: "japan", label: "Japan's power limit, 13 dBm", db: 9, how: "9 dB, by arithmetic", calc: true },
  ];
  tool.insertAdjacentHTML("beforeend", `
    <div class="costs" role="group" aria-label="Things that cost signal">${COSTS.map(c =>
      `<label class="cost"><input type="checkbox" value="${c.id}"><span><b>${c.label}</b><small>${c.how}</small></span></label>`).join("")}</div>
    <div class="meter" aria-hidden="true"><i id="mFill"></i><span class="zero"></span></div>
    <dl class="tool-out"><div class="big"><dt>Signal left over</dt><dd id="mLeft"></dd></div></dl>
    <p class="tool-say" id="mSay" aria-live="polite"></p>
    <p class="tool-src"><span class="ev" data-k="estimated">Estimated</span> Each loss was measured once and is assumed to add to the others. The Japan figure is 22 dBm minus 13 dBm. A real link also needs a few dB in hand for fading.</p>`);
  const boxes = [...tool.querySelectorAll("input")], fill = tool.querySelector("#mFill");
  const paint = () => {
    const on = COSTS.filter((c, i) => boxes[i].checked), left = START - on.reduce((a, c) => a + c.db, 0);
    tool.querySelector("#mLeft").textContent = left >= 0 ? `${left} dB` : `${minus(left)} dB`;
    fill.style.width = Math.max(0, left) / START * 100 + "%";
    tool.dataset.state = left < 0 ? "lost" : left < 10 ? "edge" : "ok";
    tool.querySelector("#mSay").textContent =
      !on.length ? "Nothing switched on. This is the link as measured: 13 of 13 packets." :
      left < 0 ? `Lost. The signal would be ${-left} dB too faint to decode. ${on.length > 1 ? "Each of these alone leaves a working link; together they do not." : ""}` :
      left < 10 ? "Still decodable, but on the edge. In the continuous log, packets started going missing with this little in hand." :
      on.length === 1 ? "Still gets through with room to spare. A single loss is within the margin." : "Still gets through, with reduced margin.";
  };
  boxes.forEach(b => b.addEventListener("change", paint)); paint();
}
