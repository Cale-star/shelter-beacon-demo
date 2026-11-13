// Seven shelters, three days, one list. A simulated valley that runs on the same scoring rules as the real dashboard.
// The terrain, the place and the events are invented; the ranking logic is the real one.
import * as THREE from "three";

const NEEDS = { M: ["medical help", 3], W: ["water", 2], FD: ["food", 1], SH: ["blankets", 1], FU: ["fuel", 1] };
const ORDER = ["M", "W", "FD", "SH", "FU"];
const join = a => a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];

const SHELTERS = [
  { id: 1, kind: "Community hall", x: -12, z: 4, people: 40 },
  { id: 2, kind: "School gym", x: 10, z: -18, people: 100 },
  { id: 3, kind: "Temple hall", x: -40, z: -20, people: 15 },
  { id: 4, kind: "Fishing co-op", x: -28, z: 23, people: 30 },
  { id: 5, kind: "Hamlet meeting room", x: -51, z: 3, people: 10 },
  { id: 6, kind: "Clinic annex", x: 27, z: -29, people: 60 },
  { id: 7, kind: "Nursery", x: 13, z: 22, people: 20 },
];
const HQ = { x: 43, z: 9 };

// t = hour the switch was flipped. late = hours the report was blocked before headquarters heard it.
const EVENTS = [
  { t: 2, s: 2, on: ["W"], say: "The school gym asks for water." },
  { t: 3, s: 5, on: ["M"], say: "A hamlet of ten people asks for medical help. Small, but it goes to the top." },
  { t: 5, s: 4, on: ["FU"], say: "The fishing co-op is running low on fuel." },
  { t: 7, s: 6, on: ["W", "FD"], say: "Sixty people at the clinic annex need water and food." },
  { t: 14, s: 1, on: ["SH"], say: "Night falls. The community hall asks for blankets." },
  { t: 18, s: 3, on: ["M", "W"], late: 3, say: "The temple hall needs medical help and water, but the signal is blocked. The box keeps trying by itself.", then: "Three hours later the temple hall's report gets through, and it jumps the list." },
  { t: 26, s: 5, off: ["M"], say: "A medical team reaches the hamlet on foot. Its switch goes back down." },
  { t: 30, s: 2, on: ["FD"], say: "The school gym, with over a hundred people, now needs food as well." },
  { t: 36, s: 6, off: ["W"], say: "Water reaches the clinic annex." },
  { t: 41, s: 7, on: ["W"], say: "The nursery asks for water." },
  { t: 47, s: 3, off: ["M"], say: "The temple hall's medical need is met." },
  { t: 50, s: 2, off: ["W"], say: "Water reaches the school gym." },
  { t: 55, s: 4, off: ["FU"], say: "Fuel is delivered to the fishing co-op." },
  { t: 60, s: 1, off: ["SH"], say: "The community hall has its blankets." },
  { t: 64, s: 3, off: ["W"], say: "Water reaches the temple hall." },
  { t: 68, s: 6, off: ["FD"], say: "Food reaches the clinic annex." },
];
const T_MAX = 72;

function stateAt(T, heardOnly) {                       // heardOnly: what headquarters knows. Otherwise: what the boxes are set to.
  const st = Object.fromEntries(SHELTERS.map(s => [s.id, { on: new Set(), at: 0 }]));
  for (const e of EVENTS) {
    if ((heardOnly ? e.t + (e.late || 0) : e.t) > T) continue;
    (e.on || []).forEach(k => st[e.s].on.add(k)); (e.off || []).forEach(k => st[e.s].on.delete(k));
    st[e.s].at = e.t;
  }
  return st;
}
function score(s, on) {
  const keys = ORDER.filter(k => on.has(k));
  let n = keys.reduce((a, k) => a + NEEDS[k][1], 0);
  if (keys.length) n += s.people >= 50 ? 2 : s.people >= 25 ? 1 : 0;
  return { n, level: n >= 3 ? "HIGH" : n >= 2 ? "MEDIUM" : "LOW", head: keys.length ? "Needs " + join(keys.map(k => NEEDS[k][0])) : "Nothing needed" };
}

// ---------- terrain ----------
const SEA = -2.2;
const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
function height(x, z) {
  let h = 7 * Math.sin(x * .09 + 1.3) * Math.cos(z * .11 - .4) + 4.2 * Math.sin(x * .2 + z * .13) + 2.6 * Math.cos(z * .27 - x * .08 + 2) + 1.1 * Math.sin(x * .5) * Math.sin(z * .45) + 8;
  h *= .35 + .65 * sm(5, 26, Math.hypot(x - HQ.x, z - HQ.z));          // the town sits in a basin
  h -= sm(24, 42, z) * 16;                                               // the coast
  return Math.max(SEA, h);
}

export function createValley(stage, { onTime, onPick } = {}) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); }
  catch { stage.querySelector(".fallback")?.removeAttribute("hidden"); return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, 1, 800);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x202423, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(-40, 80, 30); scene.add(sun);

  const geo = new THREE.PlaneGeometry(124, 84, 186, 126); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const land = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: { sea: { value: SEA } },
    vertexShader: "varying vec3 vP; varying vec3 vN; void main(){ vP = position; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
    fragmentShader: `varying vec3 vP; varying vec3 vN; uniform float sea;
      void main(){
        float lit = clamp(dot(normalize(vN), normalize(vec3(-.45, .8, .35))), 0., 1.);
        vec3 col = mix(vec3(.075, .085, .082), vec3(.2, .225, .215), lit);
        float f = vP.y / 2.3, d = abs(fract(f - .5) - .5) / fwidth(f);
        col = mix(col, vec3(.6, .64, .62), (1. - clamp(d, 0., 1.)) * .36);
        if (vP.y <= sea + .02) col = vec3(.05, .058, .056);
        float edge = smoothstep(62., 50., abs(vP.x)) * smoothstep(42., 33., abs(vP.z));
        gl_FragColor = vec4(col, edge);
      }`, transparent: true,
  }));
  scene.add(land);

  // ---------- buildings ----------
  const wall = new THREE.MeshStandardMaterial({ color: 0xd9dcd8, roughness: .8 }), roof = new THREE.MeshStandardMaterial({ color: 0x8b918d, roughness: .9 });
  const C = { LOW: 0xeef0ed, MEDIUM: 0xf2b200, HIGH: 0xff5a4a };
  function building(x, z, w, hh, d) {
    const g = new THREE.Group(); g.position.set(x, height(x, z), z);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), wall); b.position.y = hh / 2; g.add(b);
    const r = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * .78, hh * .7, 4), roof); r.position.y = hh + hh * .35; r.rotation.y = Math.PI / 4; g.add(r);
    scene.add(g); return g;
  }
  const marks = SHELTERS.map(s => {
    const g = building(s.x, s.z, 3.2, 2.1, 3.2);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.62, 16, 12), new THREE.MeshBasicMaterial({ color: C.LOW }));
    lamp.position.y = 5.2; g.add(lamp);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 2.2), roof); pole.position.y = 3.9; g.add(pole);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.9, 1.15, 40), new THREE.MeshBasicMaterial({ color: C.HIGH, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .25; g.add(ring);
    const el = document.createElement("button");
    el.className = "v-label"; el.textContent = s.id; el.setAttribute("aria-label", `Shelter ${s.id}, ${s.kind}`);
    el.onclick = () => onPick && onPick(s.id);
    stage.append(el);
    return { s, g, lamp, ring, el, top: new THREE.Vector3(s.x, height(s.x, s.z) + 5.2, s.z) };
  });
  const hq = building(HQ.x, HQ.z, 5.4, 2.8, 4.2);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 8), roof); mast.position.set(1.6, 6.8, 0); hq.add(mast);
  const hqTop = new THREE.Vector3(HQ.x + 1.6, height(HQ.x, HQ.z) + 10.8, HQ.z);
  const hqLamp = new THREE.Mesh(new THREE.SphereGeometry(.6, 16, 12), new THREE.MeshBasicMaterial({ color: 0xeef0ed })); hqLamp.position.set(1.6, 10.8, 0); hq.add(hqLamp);
  const hqEl = document.createElement("span"); hqEl.className = "v-label hq"; hqEl.textContent = "Headquarters"; stage.append(hqEl);

  // ---------- radio arcs ----------
  const arcs = [];
  function arc(from, to, kind) {
    const mid = from.clone().lerp(to, .5); mid.y += 12 + from.distanceTo(to) * .16;
    const pts = new THREE.QuadraticBezierCurve3(from, mid, to).getPoints(60);
    const color = kind === "ack" ? C.MEDIUM : kind === "lost" ? C.HIGH : 0xeef0ed;
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .85 }));
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.75, 14, 10), new THREE.MeshBasicMaterial({ color }));
    line.geometry.setDrawRange(0, 0); scene.add(line, dot);
    arcs.push({ line, dot, pts, k: 0, end: kind === "lost" ? .56 : 1, hold: 0 });
  }
  function send(m, kind) {
    if (reduce) return;
    arc(m.top, hqTop, kind);
    if (kind === "ok") setTimeout(() => arc(hqTop, m.top, "ack"), 620);
  }

  // ---------- time ----------
  let hold = 0, lastText = "";
  const HOLD = 4.2, CRAWL = .12, CRUISE = 2.2;          // seconds per caption; hours per second while reading, and between events
  // every moment a caption changes: an event, or a late report finally getting through
  const KEYS = [...new Set(EVENTS.flatMap(e => e.late ? [e.t, e.t + e.late] : [e.t]))].sort((a, b) => a - b);
  let T = 0, playing = false, heard = stateAt(0, true), set = stateAt(0, false), dirty = true, visible = true, last = 0, clock = 0;
  function apply(prev) {
    heard = stateAt(T, true); set = stateAt(T, false);
    for (const m of marks) m.level = score(m.s, heard[m.s.id].on).level, m.waiting = [...set[m.s.id].on].sort().join() !== [...heard[m.s.id].on].sort().join();
    if (prev !== undefined && T > prev) for (const e of EVENTS) {       // fire the radio for anything we just passed
      const m = marks[e.s - 1], ta = e.t + (e.late || 0);
      if (e.late && e.t > prev && e.t <= T) send(m, "lost");
      if (ta > prev && ta <= T) send(m, "ok");
    }
    let cur = null, text = "The earthquake. Phones, power and roads are down. Every box reports how many people it has.";
    for (const e of EVENTS) { if (e.t <= T) { cur = e; text = e.say; } if (e.late && e.t + e.late <= T && cur === e) text = e.then; }
    if (text !== lastText) { lastText = text; if (playing) hold = HOLD; }      // a new caption: slow right down so it can be read
    onTime && onTime(T, ranking(), text, cur ? cur.s : 0);
    dirty = true;
  }
  function ranking() {
    return SHELTERS.map(s => ({ s, ...score(s, heard[s.id].on), waiting: marks[s.id - 1].waiting, at: heard[s.id].at }))
      .sort((a, b) => b.n - a.n || a.at - b.at || a.s.id - b.s.id);
  }

  // ---------- camera ----------
  const tgt = new THREE.Vector3(-2, 0, 2), v = new THREE.Vector3();
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
    camera.aspect = w / h;
    // Fit by measurement: every shelter's light (with room for its label), headquarters, and the land's corners
    // must land inside the frame, whatever shape the screen is.
    const narrow = camera.aspect < 1.25;
    const dir = new THREE.Vector3(-.12, narrow ? .9 : .62, narrow ? .62 : .78).normalize();
    const pts = [...marks.map(m => m.top.clone().add(new THREE.Vector3(0, 7, 0))), hqTop.clone().add(new THREE.Vector3(0, 7, 0))];
    for (const x of [-58, -30, 0, 30, 58]) for (const z of [-38, 0, 30]) pts.push(new THREE.Vector3(x, Math.max(0, height(x, z)), z));
    const tanH = Math.tan(camera.fov * Math.PI / 360), right = new THREE.Vector3(), upv = new THREE.Vector3(), q = new THREE.Vector3();
    const fill = narrow ? .84 : .9;
    tgt.set(-4, 0, 0); let d = 200;
    for (let pass = 0; pass < 5; pass++) {
      camera.position.copy(tgt).addScaledVector(dir, d); camera.lookAt(tgt); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      for (const p of pts) { q.copy(p).project(camera); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
      right.setFromMatrixColumn(camera.matrixWorld, 0); upv.setFromMatrixColumn(camera.matrixWorld, 1);
      tgt.addScaledVector(right, (x0 + x1) / 2 * d * tanH * camera.aspect).addScaledVector(upv, (y0 + y1) / 2 * d * tanH);
      d *= Math.max((x1 - x0) / 2, (y1 - y0) / 2) / fill;
    }
    camera.position.copy(tgt).addScaledVector(dir, d); camera.lookAt(tgt);
    camera.updateProjectionMatrix(); dirty = true;
  }
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(stage);
  function place(el, p, dy) {
    v.copy(p).project(camera);
    el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2 * stage.clientWidth).toFixed(1)}px, ${((1 - v.y) / 2 * stage.clientHeight - dy).toFixed(1)}px)`;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now; clock += dt;
    if (!visible) return;
    if (playing) { const p = T; const rate = hold > 0 ? CRAWL : CRUISE; hold -= dt; T = Math.min(T_MAX, T + dt * rate); apply(p); if (T >= T_MAX) { playing = false; onTime && onTime(T, ranking(), "Seventy-two hours in. Every request was heard and ranked without a phone line or a power line.", 0, true); } }
    for (const m of marks) {
      const want = m.waiting ? (clock % 1.1 < .16 || (clock % 1.1 > .3 && clock % 1.1 < .46) ? C.MEDIUM : 0x3a3f3d) : C[m.level];
      if (m.lamp.material.color.getHex() !== want) { m.lamp.material.color.setHex(want); dirty = true; }
      m.lamp.scale.setScalar(m.level === "HIGH" ? 1.35 : m.level === "MEDIUM" ? 1.15 : 1);
      if (m.level === "HIGH" && !reduce) { const k = clock * .7 % 1; m.ring.scale.setScalar(1 + k * 4.5); m.ring.material.opacity = .8 * (1 - k); dirty = true; }
      else if (m.ring.material.opacity) { m.ring.material.opacity = 0; dirty = true; }
      m.el.dataset.level = m.waiting ? "WAIT" : m.level;
    }
    for (let i = arcs.length - 1; i >= 0; i--) {
      const a = arcs[i]; dirty = true;
      if (a.k < a.end) { a.k = Math.min(a.end, a.k + dt * 1.7); const n = Math.floor(a.k * 60); a.line.geometry.setDrawRange(0, n + 1); a.dot.position.copy(a.pts[n]); }
      else { a.hold += dt; a.line.material.opacity = Math.max(0, .85 - a.hold * 1.3); a.dot.scale.setScalar(Math.max(.01, 1 - a.hold * 1.6));
        if (a.hold > .7) { scene.remove(a.line, a.dot); a.line.geometry.dispose(); arcs.splice(i, 1); } }
    }
    if (!dirty) return; dirty = false;
    renderer.render(scene, camera);
    for (const m of marks) place(m.el, m.top, 10);
    place(hqEl, hqTop, 10);
  }
  resize(); apply(); requestAnimationFrame(frame);

  return {
    max: T_MAX,
    get playing() { return playing; },
    play() { if (T >= T_MAX) { T = 0; apply(); } playing = true; },
    pause() { playing = false; },
    jump(d) {                                                 // to the previous or next event, paused there
      playing = false;
      const k = d > 0 ? KEYS.find(t => t > T + .01) : [...KEYS].reverse().find(t => t < T - .3);
      const to = k === undefined ? (d > 0 ? T_MAX : 0) : k + .05, p = T; T = to; apply(to > p && to - p < 12 ? p : undefined);
    },
    seek(t) { const p = T; T = Math.max(0, Math.min(T_MAX, t)); apply(t > p && t - p < 3 ? p : undefined); },
    highlight(id) { marks.forEach(m => m.el.classList.toggle("sel", m.s.id === id)); },
  };
}
