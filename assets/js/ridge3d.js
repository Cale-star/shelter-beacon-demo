// A cut-away of the land between one shelter and headquarters, like a block taken out of a terrain model.
// It plays one report from start to finish: switch flipped, copies sent over the ridge, headquarters hears it,
// the confirmation comes back, two beeps. Same contour style as the valley above it.
import * as THREE from "three";

const STEPS = [
  { t: 0.0, say: "Someone at the shelter flips Water up. The box chirps once." },
  { t: 4.0, say: "Copy 1 leaves the antenna. It's on air for about a third of a second." },
  { t: 7.5, say: "It clears the ridge. No towers, no repeaters: the cell tower in the valley is down anyway." },
  { t: 10.5, say: "Headquarters hears it. The dashboard now reads \"needs water\"." },
  { t: 14, say: "Headquarters answers \"got report 42\", and the box stops sending the other copies." },
  { t: 17, say: "Two quick beeps at the shelter. The person who flipped the switch knows it arrived." },
];
const LOOP = 22;   // each caption gets three to four seconds

const W = 170, D = 34, BASE = -14;
const g = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
function height(x, z) {
  const ridge = 34 * g(x, -6, 17) + 12 * g(x, -32, 9) + 9 * g(x, 22, 10);
  const valley = -3 * g(x, -60, 12);
  const wob = 2.2 * Math.sin(x * .21 + z * .3) + 1.4 * Math.cos(x * .43 - z * .5) + .8 * Math.sin(z * .9 + x * .1);
  const town = 1 - .8 * g(x, 58, 22);                       // headquarters sits on flat ground
  return Math.max(0, (6 + ridge + valley + wob * (.4 + .6 * g(x, -6, 30))) * town + 2);
}

export function createRidge(stage, { onStep } = {}) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(26, 1, 1, 1200);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x202423, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(-40, 90, 60); scene.add(sun);

  // ---------- the block: a contoured top and cut faces showing the layers ----------
  const NX = 220, NZ = 40;
  const top = new THREE.PlaneGeometry(W, D, NX, NZ); top.rotateX(-Math.PI / 2);
  const tp = top.attributes.position;
  for (let i = 0; i < tp.count; i++) tp.setY(i, height(tp.getX(i), tp.getZ(i)));
  top.computeVertexNormals();
  const topMat = new THREE.ShaderMaterial({
    vertexShader: "varying vec3 vP; varying vec3 vN; void main(){ vP = position; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
    fragmentShader: `varying vec3 vP; varying vec3 vN;
      void main(){
        float lit = clamp(dot(normalize(vN), normalize(vec3(-.4, .85, .45))), 0., 1.);
        vec3 col = mix(vec3(.08, .09, .087), vec3(.23, .255, .245), lit);
        float f = vP.y / 2.2, d = abs(fract(f - .5) - .5) / fwidth(f);
        col = mix(col, vec3(.62, .66, .64), (1. - clamp(d, 0., 1.)) * .42);
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  scene.add(new THREE.Mesh(top, topMat));
  // walls: front, back, ends. Strata bands, darker going down.
  function wall(points) {                                    // points: [x, z] along the top edge
    const pos = [], idx = [];
    points.forEach(([x, z], i) => { pos.push(x, height(x, z), z, x, BASE, z); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  }
  const wallMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
    fragmentShader: `varying vec3 vP;
      void main(){
        float y = vP.y + 1.6 * sin(vP.x * .07) + .8 * sin(vP.x * .19 + vP.z);
        float band = floor(y / 5.5);
        float k = .5 + .5 * sin(band * 2.7);
        vec3 col = mix(vec3(.105, .115, .11), vec3(.15, .165, .158), k);
        col *= .62 + .38 * smoothstep(${BASE.toFixed(1)}, 30., vP.y);
        float edge = abs(fract(y / 5.5) - .0) ; col = mix(vec3(.3, .33, .32), col, smoothstep(0., .06, edge));
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  const xs = n => Array.from({ length: n + 1 }, (_, i) => -W / 2 + i / n * W), zs = n => Array.from({ length: n + 1 }, (_, i) => -D / 2 + i / n * D);
  scene.add(new THREE.Mesh(wall(xs(NX).map(x => [x, D / 2])), wallMat));
  scene.add(new THREE.Mesh(wall(xs(NX).map(x => [x, -D / 2])), wallMat));
  scene.add(new THREE.Mesh(wall(zs(NZ).map(z => [-W / 2, z])), wallMat));
  scene.add(new THREE.Mesh(wall(zs(NZ).map(z => [W / 2, z])), wallMat));
  const bottom = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0b0c0c })); bottom.position.y = BASE; scene.add(bottom);

  // ---------- buildings, the cut road, the dead tower ----------
  const wallM = new THREE.MeshStandardMaterial({ color: 0xd9dcd8, roughness: .8 }), roofM = new THREE.MeshStandardMaterial({ color: 0x8b918d, roughness: .9 });
  const ground = (x, z) => height(x, z);
  function house(x, z, w, h, d) {
    const gr = new THREE.Group(); gr.position.set(x, ground(x, z), z);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallM); b.position.y = h / 2; gr.add(b);
    const r = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * .76, h * .7, 4), roofM); r.position.y = h * 1.35; r.rotation.y = Math.PI / 4; gr.add(r);
    scene.add(gr); return gr;
  }
  const SH = { x: -62, z: 2 }, HQ = { x: 58, z: -1 };
  const shelter = house(SH.x, SH.z, 6, 4, 6);
  [[-72, -8, 3], [-50, 9, 2.6], [-69, 11, 2.4]].forEach(([x, z, s]) => house(x, z, s, s * .7, s));
  const hq = house(HQ.x, HQ.z, 10, 5.5, 7);
  [[44, 8, 3], [71, 9, 3.2], [47, -10, 2.6], [73, -9, 2.8], [62, 12, 2.4]].forEach(([x, z, s]) => house(x, z, s, s * .75, s));
  function mast(gr, h, dx = 0) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, h), roofM); m.position.set(dx, h / 2 + 4, 0); gr.add(m);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), new THREE.MeshBasicMaterial({ color: 0x3a3f3d })); lamp.position.set(dx, h + 4.6, 0); gr.add(lamp);
    return { lamp, tip: new THREE.Vector3(gr.position.x + dx, gr.position.y + h + 4.6, gr.position.z) };
  }
  const shMast = mast(shelter, 9), hqMast = mast(hq, 15, 3);
  // the road: a pale ribbon along the front edge, broken by a landslide on the slope
  const roadPts = [];
  for (let x = -W / 2 + 2; x <= W / 2 - 2; x += 1) roadPts.push(new THREE.Vector3(x, ground(x, 12) + .25, 12 + 2 * Math.sin(x * .05)));
  const cutAt = -24;
  const roadA = roadPts.filter(p => p.x < cutAt - 4), roadB = roadPts.filter(p => p.x > cutAt + 4);
  const roadMat = new THREE.LineBasicMaterial({ color: 0x9da19e });
  [roadA, roadB].forEach(pts => scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), roadMat)));
  const slide = new THREE.Mesh(new THREE.DodecahedronGeometry(3.2, 0), new THREE.MeshStandardMaterial({ color: 0x6d6255, roughness: 1, flatShading: true }));
  slide.position.set(cutAt, ground(cutAt, 12) + 1.4, 12); slide.scale.set(1.6, .7, 1.1); scene.add(slide);
  // a cell tower, dark
  const towerX = 20, tower = new THREE.Group(); tower.position.set(towerX, ground(towerX, -9), -9);
  const tmat = new THREE.MeshStandardMaterial({ color: 0x5b605d, roughness: .7 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.35, .7, 18, 6), tmat); pole.position.y = 9; tower.add(pole);
  for (const a of [0, 2.1, 4.2]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.6, 2.6, .5), tmat); p.position.set(Math.cos(a) * 1.1, 17, Math.sin(a) * 1.1); p.rotation.y = -a; tower.add(p); }
  scene.add(tower);
  const towerTop = new THREE.Vector3(towerX, tower.position.y + 19, -9);

  // ---------- the radio path ----------
  const mid = shMast.tip.clone().lerp(hqMast.tip, .5); mid.y = 74;
  const up = new THREE.QuadraticBezierCurve3(shMast.tip, mid, hqMast.tip).getPoints(120);
  const back = [...up].reverse();
  function trail(color) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(up), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .9 }));
    line.geometry.setDrawRange(0, 0); scene.add(line);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), new THREE.MeshBasicMaterial({ color })); dot.visible = false; scene.add(dot);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .25, depthWrite: false })); dot.add(halo);
    return { line, dot };
  }
  const out = trail(0xeef0ed), ack = trail(0xf2b200);
  ack.line.geometry.setFromPoints(back);
  // rings from the shelter antenna as it transmits
  const rings = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(.92, 1, 48), new THREE.MeshBasicMaterial({ color: 0xeef0ed, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); m.position.copy(shMast.tip); scene.add(m); return m; });

  // ---------- labels ----------
  const labels = [
    { el: tag("Shelter", "a community hall, 30 people"), p: shMast.tip.clone().add(new THREE.Vector3(0, 6, 0)) },
    { el: tag("Headquarters", "the town hall"), p: hqMast.tip.clone().add(new THREE.Vector3(0, 6, 0)) },
    { el: tag("Road cut", "landslide", "need"), p: slide.position.clone().add(new THREE.Vector3(0, 9, 0)) },
    { el: tag("Cell tower", "no power"), p: towerTop.clone().add(new THREE.Vector3(0, 5, 0)) },
  ];
  function tag(t, sub, kind) {
    const el = document.createElement("span"); el.className = "r-label" + (kind ? " " + kind : "");
    el.innerHTML = `<b>${t}</b><small>${sub}</small>`; stage.append(el); return el;
  }
  const v = new THREE.Vector3();
  function placeLabels() {
    const w = stage.clientWidth, h = stage.clientHeight, small = w < 560;
    labels.forEach((l, i) => {
      v.copy(l.p).project(camera);
      l.el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2 * w).toFixed(1)}px, ${((1 - v.y) / 2 * h).toFixed(1)}px)`;
      l.el.classList.toggle("compact", small);
    });
  }

  // ---------- camera ----------
  const target = new THREE.Vector3(0, 14, 0);
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
    camera.aspect = w / h;
    const narrow = camera.aspect < 1.4;
    const dir = new THREE.Vector3(-.2, narrow ? .5 : .36, 1).normalize();
    // fit the block's width, and the arc's height, whichever needs more room
    const tanH = Math.tan(camera.fov * Math.PI / 360);
    const dist = Math.max(W * (narrow ? 1.3 : .86) / (2 * tanH * camera.aspect), 108 / (2 * tanH));
    target.set(0, narrow ? 26 : 30, 0);
    camera.position.copy(target).addScaledVector(dir, dist); camera.lookAt(target);
    camera.updateProjectionMatrix(); dirty = true;
  }
  let dirty = true, visible = true, clock = reduce ? 17.9 : 0, last = 0, step = -1;
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: .2 }).observe(stage);

  const OFF = 0x3a3f3d, AMBER = 0xf2b200, WHITE = 0xeef0ed;
  const ease = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  function show(t) {
    // shelter light: on once the switch flips; a double blink for "headquarters got it"
    const beep = t > 17 && t < 17.6 && ((t - 17) % .3) < .15;
    shMast.lamp.material.color.setHex(t < .3 ? OFF : beep ? WHITE : AMBER);
    shMast.lamp.scale.setScalar(beep ? 1.5 : 1);
    // copy 1 out: 4.0 to 10.5 s
    const a = Math.min(1, Math.max(0, (t - 4) / 6.5)), n = Math.floor(ease(a) * 120);
    out.line.geometry.setDrawRange(0, a > 0 ? n + 1 : 0); out.dot.visible = a > 0 && a < 1; out.dot.position.copy(up[n]);
    out.line.material.opacity = t > 20.5 ? Math.max(0, .9 - (t - 20.5)) : .9;
    rings.forEach((r, k) => { const q = (t - 4 - k * .18) / 1.2; r.material.opacity = q > 0 && q < 1 ? .7 * (1 - q) : 0; r.scale.setScalar(2 + q * 12); r.lookAt(camera.position); });
    // headquarters lights at 3.0
    hqMast.lamp.material.color.setHex(t > 10.5 ? AMBER : OFF); hqMast.lamp.scale.setScalar(t > 10.5 && t < 11.1 ? 1.6 : 1);
    // the confirmation back: 3.6 to 5.0
    const b = Math.min(1, Math.max(0, (t - 14) / 3)), m = Math.floor(ease(b) * 120);
    ack.line.geometry.setDrawRange(0, b > 0 ? m + 1 : 0); ack.dot.visible = b > 0 && b < 1; ack.dot.position.copy(back[m]);
    ack.line.material.opacity = t > 20.5 ? Math.max(0, .9 - (t - 20.5)) : .9;
    let s = 0; STEPS.forEach((x, i) => { if (t >= x.t) s = i; });
    if (s !== step) { step = s; onStep && onStep(s, STEPS[s].say, STEPS.length); }
    dirty = true;
  }
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!visible) return;
    if (!reduce && !paused) { clock = (clock + dt) % LOOP; show(clock); }
    if (!dirty) return; dirty = false;
    renderer.render(scene, camera); placeLabels();
  }
  resize(); show(clock); requestAnimationFrame(frame);
  let paused = false;
  // Stepping by hand shows the end of a step, so its result is on screen while you read it.
  const settle = i => i < STEPS.length - 1 ? STEPS[i + 1].t - .05 : 17.9;
  return {
    steps: STEPS,
    get paused() { return paused; },
    pause() { paused = true; }, play() { paused = false; },
    step(d) { paused = true; const i = (step + d + STEPS.length) % STEPS.length; clock = settle(i); show(clock); },
  };
}
