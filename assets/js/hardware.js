import { createBox, PARTS } from "./box3d.js";

const list = document.getElementById("partList"), slider = document.getElementById("explode");
const rows = {};
for (const p of PARTS) {
  const li = document.createElement("li"), b = document.createElement("button"), note = document.createElement("p");
  b.type = "button"; b.setAttribute("aria-pressed", "false"); b.append(p.name); note.textContent = p.note; b.append(note);
  b.onclick = () => select(p.id === current ? null : p.id);
  li.append(b); list.append(li); rows[p.id] = b;
}
let current = null, box = null;
function paint(id) {
  current = id;
  for (const k in rows) rows[k].setAttribute("aria-pressed", String(k === id));
}
function select(id) {
  paint(id);
  if (!box) return;
  box.select(id);
  // parts inside the box can't be seen while it's closed, so open it up
  if (id && Number(slider.value) < 55 && !["lid", "overlay", "toggles", "knob", "led", "antenna", "solar", "base"].includes(id)) setExplode(100);
}
function setExplode(v) { slider.value = v; if (box) box.setExplode(v / 100); }
slider.addEventListener("input", () => box && box.setExplode(slider.value / 100));

const stage = document.getElementById("stage");
try {
  box = createBox(stage, {
    mode: "explore", labels: document.getElementById("labels"),
    onSelect: (id, fromUser) => { paint(id); if (fromUser && id && innerWidth > 900) rows[id].scrollIntoView({ block: "nearest" }); },
  });
  // one opening move so people see it comes apart, then hand it over
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    setTimeout(() => setExplode(100), 700);
  } else setExplode(100);
} catch (e) {
  stage.querySelector(".fallback").hidden = false;
  slider.closest(".explode-ctl").hidden = true;
}
