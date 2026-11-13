// Booth display: the valley on a loop, the ranked list beside it, and a QR code to the site.
import { createValley } from "./valley3d.js";
const $ = id => document.getElementById(id);
const LABEL = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };
let valley;
function paint(T, ranking, text, who, done) {
  $("vHour").textContent = "Hour " + Math.floor(T);
  $("vSay").textContent = text;
  $("vList").innerHTML = ranking.map(r => `<li data-level="${r.level}"><span class="v-num">${r.s.id}</span><span class="v-what"><b>${r.head}</b><small>${r.s.kind}, ${r.s.people >= 100 ? "100+" : "about " + r.s.people} people</small></span><span class="tag" data-level="${r.level}">${LABEL[r.level]}</span></li>`).join("");
  if (done) setTimeout(() => valley.play(), 8000);            // hold the final picture, then go round again
}
valley = createValley($("valleyStage"), { onTime: paint });
if (valley) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) valley.seek(31); else valley.play();
}
