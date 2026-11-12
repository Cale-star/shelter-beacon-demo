import { createBox } from "./box3d.js";

const NEEDS = [
  { label: "Water", say: "water", w: 2 }, { label: "Medical", say: "medical help", w: 3 }, { label: "Food", say: "food", w: 1 },
  { label: "Blankets", say: "blankets", w: 1 }, { label: "Fuel", say: "fuel", w: 1 },
];
const PEOPLE = 20;
const join = a => a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];

const chips = document.getElementById("heroChips");
const buttons = NEEDS.map((n, i) => {
  const b = document.createElement("button");
  b.className = "chip"; b.textContent = n.label; b.setAttribute("aria-pressed", "false");
  b.onclick = () => box ? box.setSwitch(i, b.getAttribute("aria-pressed") !== "true", true) : paint(state.map((v, k) => k === i ? !v : v));
  chips.append(b);
  return b;
});
let state = NEEDS.map(() => false);
function paint(on) {
  state = on;
  buttons.forEach((b, i) => b.setAttribute("aria-pressed", String(on[i])));
  const active = NEEDS.filter((_, i) => on[i]).sort((a, b) => b.w - a.w);
  const score = active.reduce((s, n) => s + n.w, 0) + (active.length && PEOPLE >= 50 ? 2 : active.length && PEOPLE >= 25 ? 1 : 0);
  const level = score >= 3 ? "HIGH" : score >= 2 ? "MEDIUM" : "LOW";
  document.getElementById("heroHead").textContent = active.length ? "Needs " + join(active.map(n => n.say)) : "Nothing needed";
  const tag = document.getElementById("heroTag");
  tag.dataset.level = level; tag.textContent = level[0] + level.slice(1).toLowerCase() + " priority";
}

let box = null;
const stage = document.getElementById("heroStage");
try {
  box = createBox(stage, { mode: "hero", onSwitch: paint });
  setTimeout(() => box.pulse(), 900);                       // one hello: the box checks in
} catch (e) {
  stage.querySelector(".fallback").hidden = false;
}

// ---- the ridge drawing: a shelter behind the hills, headquarters in town, one report crossing ----
const svg = document.getElementById("ridge");
if (svg) {
  const W = 1120, H = 340;
  const ridge = (base, amp, seed, n = 9) => {
    let d = `M0 ${H} L0 ${base}`;
    for (let i = 0; i <= n; i++) {
      const x = i / n * W, y = base - amp * (0.5 + 0.5 * Math.sin(i * 1.7 + seed) * Math.cos(i * 0.6 + seed * 2));
      const px = (i - 0.5) / n * W;
      d += i ? ` Q${px.toFixed(0)} ${(y - amp * 0.18 * Math.sin(i + seed)).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)}` : ` L0 ${y.toFixed(0)}`;
    }
    return d + ` L${W} ${H}Z`;
  };
  const house = (x, y, s, lit) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-16 0V-16L0-29 16-16V0Z" fill="var(--ink)"/>` +
    (lit ? `<rect x="-5" y="-13" width="10" height="9" rx="1" fill="#f2b200"/>` : "") + `</g>`;
  const A = [196, 196], B = [938, 214];                      // shelter and headquarters
  const arc = `M${A[0]} ${A[1] - 50} Q${(A[0] + B[0]) / 2} -40 ${B[0]} ${B[1] - 62}`;
  svg.innerHTML = `
    <path d="${ridge(150, 70, 0.4)}" fill="var(--line)" opacity=".55"/>
    <path d="${ridge(205, 90, 2.1)}" fill="var(--line)"/>
    <path d="${ridge(262, 60, 4.2, 12)}" fill="color-mix(in srgb, var(--ink-2) 34%, var(--paper))"/>
    <path id="ridgeArc" d="${arc}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-dasharray="3 9" stroke-linecap="round"/>
    <circle id="ridgeDot" r="7" fill="#f2b200" stroke="var(--paper)" stroke-width="2"><animateMotion dur="2.6s" repeatCount="indefinite" path="${arc}" keyPoints="0;1;1" keyTimes="0;0.55;1" calcMode="linear"/></circle>
    <line x1="${A[0] + 14}" y1="${A[1] - 2}" x2="${A[0] + 14}" y2="${A[1] - 50}" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/>
    ${house(A[0], A[1], 1.25, true)}${house(A[0] - 52, A[1] + 6, 0.8)}${house(A[0] + 58, A[1] + 10, 0.7)}
    <line x1="${B[0]}" y1="${B[1] - 4}" x2="${B[0]}" y2="${B[1] - 62}" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/>
    <rect x="${B[0] - 34}" y="${B[1] - 36}" width="68" height="40" rx="2" fill="var(--ink)"/>
    <g fill="var(--paper)">${[0, 1, 2].map(i => `<rect x="${B[0] - 24 + i * 19}" y="${B[1] - 28}" width="10" height="9" rx="1"/>`).join("")}</g>
    ${house(B[0] + 62, B[1] + 4, 0.8)}${house(B[0] - 70, B[1] + 6, 0.9)}${house(B[0] + 104, B[1] + 8, 0.7)}
    <g stroke="var(--need)" stroke-width="4" stroke-linecap="round"><path d="M548 250l18 18M566 250l-18 18"/></g>
    <text x="557" y="296" text-anchor="middle" font-size="15" class="dim">road cut, phones down</text>
    <text x="${A[0]}" y="${A[1] + 44}" text-anchor="middle" font-size="16" font-weight="700">Shelter</text>
    <text x="${A[0]}" y="${A[1] + 64}" text-anchor="middle" font-size="15" class="dim">flips up "water"</text>
    <text x="${B[0]}" y="${B[1] + 44}" text-anchor="middle" font-size="16" font-weight="700">Headquarters</text>
    <text x="${B[0]}" y="${B[1] + 64}" text-anchor="middle" font-size="15" class="dim">"Shelter 1 needs water"</text>
    <text x="560" y="34" text-anchor="middle" font-size="15" class="dim">LoRa radio, 915 MHz, no towers in between</text>`;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) svg.querySelector("animateMotion").remove(), svg.querySelector("#ridgeDot").setAttribute("transform", `translate(${(A[0] + B[0]) / 2} 62)`);
}
