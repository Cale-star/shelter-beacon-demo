// The home page's valley: wires the 3D scene to the ranked list, the scrubber and the caption.
import { createValley } from "./valley3d.js";
const $ = id => document.getElementById(id);
const list = $("vList"), say = $("vSay"), hour = $("vHour"), time = $("vTime"), play = $("vPlay");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const LABEL = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };
const rows = new Map();
let valley, started = false;

function paint(T, ranking, text, who, done) {
  hour.textContent = "Hour " + Math.floor(T);
  if (document.activeElement !== time) time.value = T;
  say.textContent = text;
  if (done || !valley?.playing) play.textContent = T >= 72 ? "Play again" : "Play";
  const before = new Map([...rows].map(([id, li]) => [id, li.getBoundingClientRect().top]));
  ranking.forEach((r, i) => {
    let li = rows.get(r.s.id);
    if (!li) {
      li = document.createElement("li");
      li.innerHTML = `<span class="v-num"></span><span class="v-what"><b></b><small></small></span><span class="tag"></span>`;
      li.onmouseenter = () => valley.highlight(r.s.id); li.onmouseleave = () => valley.highlight(0);
      rows.set(r.s.id, li);
    }
    li.dataset.level = r.level;
    li.querySelector(".v-num").textContent = r.s.id;
    li.querySelector("b").textContent = r.head;
    li.querySelector("small").textContent = `${r.s.kind}, ${r.s.people >= 100 ? "100+" : "about " + r.s.people} people` + (r.waiting ? ". A newer report is still trying to get through." : "");
    const tag = li.querySelector(".tag"); tag.dataset.level = r.level; tag.textContent = LABEL[r.level];
    if (list.children[i] !== li) list.insertBefore(li, list.children[i] || null);
  });
  if (reduce) return;
  rows.forEach((li, id) => {                                   // slide rows to their new place so a change of order is visible
    const d = before.has(id) ? before.get(id) - li.getBoundingClientRect().top : 0;
    if (Math.abs(d) < 2) return;
    li.animate([{ transform: `translateY(${d}px)` }, { transform: "none" }], { duration: 380, easing: "cubic-bezier(.3,.7,.2,1)" });
  });
}

valley = createValley($("valleyStage"), { onTime: paint, onPick: id => { rows.get(id)?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" }); valley.highlight(id); } });
if (!valley) { play.hidden = true; $("vBack").hidden = $("vNext").hidden = true; time.closest("label").hidden = true; }
else {
  play.onclick = () => { if (valley.playing) { valley.pause(); play.textContent = "Play"; } else { valley.play(); play.textContent = "Pause"; } };
  $("vBack").onclick = () => { valley.jump(-1); play.textContent = "Play"; };
  $("vNext").onclick = () => { valley.jump(1); play.textContent = "Play"; };
  time.oninput = () => { valley.pause(); play.textContent = "Play"; valley.seek(+time.value); };
  if (reduce) valley.seek(31);
  else new IntersectionObserver((es, io) => { if (es[0].isIntersecting && !started) { started = true; io.disconnect(); valley.play(); play.textContent = "Pause"; } }, { threshold: .45 }).observe($("valleyStage"));
}
