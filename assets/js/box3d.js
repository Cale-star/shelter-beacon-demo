// The shelter box as a to-scale 3D model (units are millimetres), built from simple shapes.
// One model serves the home page (flip the switches) and the hardware page (exploded view).
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { RoomEnvironment } from "three/addons/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/RoundedBoxGeometry.js";

export const PARTS = [
  { id: "overlay", name: "Printed face", note: "One sheet of laminated vinyl. Labels in Japanese and English, the same list headquarters sees." },
  { id: "toggles", name: "Five need switches", note: "Chrome toggles: water, medical, food, blankets, fuel. Up means needed. Works with cold or gloved hands." },
  { id: "knob", name: "People knob", note: "An 11-click dial for about how many people are sheltering: 0 to 100+. The big knob is 3D printed." },
  { id: "led", name: "Status light", note: "Blinks when sending, glows when headquarters confirms, double-blinks while the box is still trying." },
  { id: "buzzer", name: "Beeper", note: "Two quick beeps mean headquarters got it. One long beep means not yet." },
  { id: "lid", name: "Lid", note: "Hinged and latched. Everything a person touches is on this one surface." },
  { id: "board", name: "Radio board", note: "Heltec V4.3: an ESP32-S3 microcontroller and an SX1262 LoRa radio on one small board." },
  { id: "battery", name: "Battery pack", note: "Four 18650 cells in parallel, about 14 Ah. Roughly eight days with no sun at all." },
  { id: "charger", name: "Solar charger", note: "Charges the pack from the panel and powers the board at the same time." },
  { id: "plate", name: "Mounting plate", note: "3D printed. Holds the battery, charger and board so nothing rattles loose." },
  { id: "antenna", name: "Antenna", note: "915 MHz. Outside the box, so the radio isn't shouting through plastic." },
  { id: "solar", name: "Solar panel", note: "1 W. Keeps the pack topped up through a long outage." },
  { id: "base", name: "Enclosure", note: "Weatherproof ABS, 290 × 190 × 140 mm. Mounts on a wall." },
];
const SWITCH_Y = [-22, -46, -70, -94, -118], SWITCH_X = 58;
const KNOB = { x: 0, y: 46 }, LED = { x: 69, y: 118 }, BUZZ = { x: -69, y: 118 };

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function createBox(container, opts = {}) {
  const mode = opts.mode || "explore";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.78;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  container.prepend(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(-260, 420, 520); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -420, right: 420, top: 420, bottom: -420, near: 100, far: 1600 });
  key.shadow.bias = -0.0005; key.shadow.radius = 6;
  const rim = new THREE.DirectionalLight(0xcfe0ff, 1.3); rim.position.set(420, 260, -520);          // outlines dark parts against the dark stage
  scene.add(key, rim, new THREE.HemisphereLight(0xffffff, 0x8a8f8c, 0.3));

  const camera = new THREE.PerspectiveCamera(30, 1, 10, 6000);
  const root = new THREE.Group(); scene.add(root);

  // ---------- materials ----------
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });
  const shell = () => std(0xd6d9d5, { roughness: 0.6 });
  const chrome = () => std(0xdfe3e3, { roughness: 0.16, metalness: 1 });
  const black = (r = 0.5) => std(0x1b1d1f, { roughness: r });

  // ---------- pieces: each piece belongs to a part and knows how far it travels when exploded ----------
  const pieces = [];
  function piece(partId, explode, build) {
    const g = new THREE.Group();
    g.userData = { part: partId, home: new THREE.Vector3(), explode: new THREE.Vector3(...explode) };
    build(g);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.part = partId; } });
    root.add(g); pieces.push(g);
    return g;
  }
  const add = (g, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  const cylZ = (rt, rb, h, seg = 32) => new THREE.CylinderGeometry(rt, rb, h, seg).rotateX(Math.PI / 2);   // axis along z, "top" toward +z

  // enclosure base: a hollow tub, open at the front (z = 0), 124 deep
  piece("base", [0, 0, -200], g => {
    const wall = roundedRect(190, 290, 14); wall.holes.push(roundedRect(184, 284, 11));
    add(g, new THREE.ExtrudeGeometry(wall, { depth: 121, bevelEnabled: false, curveSegments: 8 }), shell(), 0, 0, -121);
    add(g, new THREE.ExtrudeGeometry(roundedRect(190, 290, 14), { depth: 3, bevelEnabled: false, curveSegments: 8 }), shell(), 0, 0, -124);
    for (const y of [78, -78]) add(g, new RoundedBoxGeometry(7, 38, 16, 2, 2), shell(), -98, y, -8);       // hinge halves
    for (const y of [78, -78]) add(g, new RoundedBoxGeometry(6, 30, 20, 2, 2), shell(), 98, y, -10);       // latch keepers
    for (const y of [158, -158]) add(g, new RoundedBoxGeometry(60, 26, 4, 2, 1.5), shell(), 0, y, -122);    // wall-mount tabs
  });
  piece("plate", [0, 0, -95], g => {
    add(g, new RoundedBoxGeometry(150, 228, 3, 2, 1.5), std(0xf4f4f2, { roughness: 0.8 }), 0, 0, -113);
    for (const [x, y] of [[-66, 105], [66, 105], [-66, -105], [66, -105]]) add(g, cylZ(3, 3, 8, 12), chrome(), x, y, -117);
  });
  piece("battery", [0, 0, -15], g => {
    add(g, new RoundedBoxGeometry(82, 74, 12, 2, 2), black(0.7), 0, -52, -105.5);
    const cell = new THREE.CylinderGeometry(9, 9, 65, 28);
    for (const x of [-29.4, -9.8, 9.8, 29.4]) {
      add(g, cell, std(0xd78fc4, { roughness: 0.42 }), x, -52, -97);
      add(g, new THREE.CylinderGeometry(9.1, 9.1, 3, 28), std(0xf3f3f1, { roughness: 0.3, metalness: 0.6 }), x, -18.5, -97);
    }
  });
  piece("charger", [0, 0, -15], g => {
    add(g, new THREE.BoxGeometry(34, 26, 1.6), std(0x1f4f8f, { roughness: 0.5 }), -38, 52, -110.5);
    add(g, new THREE.BoxGeometry(7, 7, 2.5), black(0.4), -38, 52, -108.6);
    add(g, new THREE.BoxGeometry(9, 8, 6), std(0x3b8f4a, { roughness: 0.6 }), -50, 44, -107);          // screw terminal
    add(g, new THREE.BoxGeometry(9, 8, 6), std(0x3b8f4a, { roughness: 0.6 }), -27, 44, -107);
  });
  piece("board", [0, 0, -15], g => {
    add(g, new THREE.BoxGeometry(26, 52, 1.6), std(0x16181a, { roughness: 0.45 }), 30, 62, -110.5);
    add(g, new THREE.BoxGeometry(14, 27, 1.8), std(0x050607, { roughness: 0.08, metalness: 0.3 }), 30, 70, -108.8);   // OLED glass
    add(g, new THREE.BoxGeometry(13, 13, 2.6), std(0xc9cdcd, { roughness: 0.3, metalness: 1 }), 30, 45, -108.4);      // radio shield
    add(g, new THREE.BoxGeometry(9, 7, 3.2), std(0xb9bdbd, { roughness: 0.3, metalness: 1 }), 30, 87.5, -108.2);      // USB-C
    for (const x of [18.5, 41.5]) add(g, new THREE.BoxGeometry(2.4, 46, 2.5), black(0.6), x, 62, -108.6);            // header strips
  });
  // rear of the lid: switch bodies, the knob's potentiometer, the beeper
  piece("toggles", [0, 0, 62], g => {
    for (const y of SWITCH_Y) {
      add(g, new THREE.BoxGeometry(13, 17, 14), std(0x20324f, { roughness: 0.5 }), SWITCH_X, y, 5.5);
      for (const dy of [-5, 0, 5]) add(g, new THREE.BoxGeometry(4, 1, 5), chrome(), SWITCH_X, y + dy, -3.5);
    }
  });
  piece("knob", [0, 0, 62], g => {
    add(g, new THREE.BoxGeometry(10, 12, 7), std(0x2f6b3f, { roughness: 0.6 }), KNOB.x, KNOB.y, 9);
    add(g, cylZ(4.5, 4.5, 6, 20), chrome(), KNOB.x, KNOB.y, 15);
  });
  piece("buzzer", [0, 0, 62], g => {
    add(g, cylZ(6, 6, 9, 24), black(0.45), BUZZ.x, BUZZ.y, 8);
    add(g, new THREE.BoxGeometry(16, 12, 1.4), std(0x1f4f8f, { roughness: 0.5 }), BUZZ.x, BUZZ.y - 2, 3);
  });
  // the lid itself, then everything a person touches
  piece("lid", [0, 0, 120], g => {
    add(g, new THREE.ExtrudeGeometry(roundedRect(190, 290, 14), { depth: 13, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5, bevelSegments: 3, curveSegments: 10 }), shell(), 0, 0, 1.5);
    for (const y of [78, -78]) add(g, new RoundedBoxGeometry(7, 38, 14, 2, 2), shell(), -98, y, 8);
    for (const y of [78, -78]) add(g, new RoundedBoxGeometry(7, 34, 16, 2, 2), shell(), 98, y, 7);
  });
  const tex = new THREE.TextureLoader().load(opts.texture || "assets/img/lid_overlay.jpg", () => { dirty = true; });
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  piece("overlay", [0, 0, 195], g => {
    const geo = new THREE.ShapeGeometry(roundedRect(176, 276, 8), 10);
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 88) / 176, (p.getY(i) + 138) / 276);
    add(g, geo, std(0xe9e9e9, { map: tex, roughness: 0.7 }), 0, 0, 16.25);
  });
  const levers = [];
  piece("toggles", [0, 0, 265], g => {
    SWITCH_Y.forEach((y, i) => {
      add(g, cylZ(8.6, 8.6, 0.9, 32), chrome(), SWITCH_X, y, 16.8);
      add(g, cylZ(6.8, 6.8, 2.4, 6), chrome(), SWITCH_X, y, 18.4);
      add(g, cylZ(3.4, 3.4, 5, 20), chrome(), SWITCH_X, y, 21);
      const pivot = new THREE.Group(); pivot.position.set(SWITCH_X, y, 20.5); g.add(pivot);
      const lever = new THREE.Mesh(cylZ(3.5, 1.9, 18, 20).translate(0, 0, 9), chrome());
      lever.scale.set(1, 0.6, 1); lever.userData.leverOf = i; pivot.add(lever);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(26, 22, 30), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(SWITCH_X, y, 30); hit.userData.switch = i; g.add(hit);
      pivot.rotation.x = 0.52;                               // down
      levers.push({ pivot, on: false, from: 0.52, to: 0.52, t: 1 });
    });
  });
  let ledMat, knobGroup;
  piece("led", [0, 0, 265], g => {
    add(g, cylZ(4.6, 4.6, 2.6, 28), chrome(), LED.x, LED.y, 17.4);
    ledMat = std(0xf2b200, { roughness: 0.3, emissive: 0xf2b200, emissiveIntensity: 0.15 });
    const dome = add(g, new THREE.SphereGeometry(2.9, 20, 14), ledMat, LED.x, LED.y, 18.6);
    dome.scale.z = 0.8;
  });
  piece("knob", [0, 0, 310], g => {
    knobGroup = new THREE.Group(); knobGroup.position.set(KNOB.x, KNOB.y, 16.4); g.add(knobGroup);
    add(knobGroup, cylZ(27.5, 29, 5, 64), black(0.42), 0, 0, 2.5);
    add(knobGroup, cylZ(21, 23, 17, 64), black(0.36), 0, 0, 13.5);
    const ridge = new THREE.BoxGeometry(1.4, 2.2, 15);
    for (let k = 0; k < 40; k++) {
      const a = k / 40 * Math.PI * 2, m = add(knobGroup, ridge, black(0.5), Math.sin(a) * 22.4, Math.cos(a) * 22.4, 13.5);
      m.rotation.z = -a;
    }
    add(knobGroup, cylZ(17, 17, 0.6, 48), black(0.25), 0, 0, 22.2);
    add(knobGroup, cylZ(40, 40, 30, 32), new THREE.MeshBasicMaterial({ visible: false }), 0, 0, 12);   // a grab area bigger than the knob
    add(knobGroup, new RoundedBoxGeometry(3, 15, 1, 2, 0.5), std(0xf2b200, { roughness: 0.4, emissive: 0xf2b200, emissiveIntensity: 0.25 }), 0, 20.5, 5.3);
    add(knobGroup, new RoundedBoxGeometry(3, 9, 1, 2, 0.5), std(0xf2b200, { roughness: 0.4, emissive: 0xf2b200, emissiveIntensity: 0.25 }), 0, 11, 22.6);
  });
  const antennaTip = new THREE.Vector3(-57, 262, -62);
  piece("antenna", [0, 40, -200], g => {
    add(g, new THREE.CylinderGeometry(4.2, 4.2, 9, 6), std(0xc8a24a, { roughness: 0.3, metalness: 1 }), -57, 149, -62);
    add(g, new THREE.CylinderGeometry(4.6, 5.2, 16, 24), black(0.55), -57, 161, -62);
    add(g, new THREE.CylinderGeometry(3.6, 4.4, 92, 24), black(0.6), -57, 214, -62);
    add(g, new THREE.SphereGeometry(3.6, 16, 10), black(0.6), -57, 260, -62);
  });
  piece("solar", [0, 70, -200], g => {
    const p = new THREE.Group(); p.position.set(34, 172, -62); p.rotation.x = 0.55; g.add(p);
    add(p, new RoundedBoxGeometry(112, 3, 72, 2, 1.2), std(0xe9ebe8, { roughness: 0.5 }), 0, 0, 0);
    add(p, new THREE.BoxGeometry(104, 0.8, 64), std(0x10203a, { roughness: 0.12, metalness: 0.4 }), 0, 1.8, 0);
    for (let k = 1; k < 6; k++) add(p, new THREE.BoxGeometry(0.7, 0.3, 64), std(0xbfc6cc, { roughness: 0.3, metalness: 0.8 }), -52 + k * 104 / 6, 2.3, 0);
    add(g, new THREE.BoxGeometry(10, 26, 6), shell(), 34, 156, -76);
  });

  // radio rings from the antenna tip: drawn only when the box "sends"
  const rings = [];
  for (let k = 0; k < 3; k++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 72), new THREE.MeshBasicMaterial({ color: 0xf2b200, transparent: true, opacity: 0, depthWrite: false }));
    m.position.copy(antennaTip); m.rotation.x = Math.PI / 2; m.visible = false;
    root.add(m); rings.push({ m, t: 0, on: false });
  }
  // ---------- state ----------
  let explode = 0, explodeTarget = 0, dirty = true, visible = true, selected = null, ledOn = false, ledFlash = 0, glow = 0;
  let knobIdx = opts.people ?? 4, knobAngle = angleFor(knobIdx), knobTarget = knobAngle;
  function angleFor(i) { return -(-150 + i * 30) * Math.PI / 180; }
  const target = new THREE.Vector3(0, 28, -30);
  const dir = new THREE.Vector3(mode === "hero" ? -0.36 : -1.25, mode === "hero" ? 0.12 : 0.3, 1).normalize();
  const dirPortrait = new THREE.Vector3(-0.5, 1.25, 1).normalize();
  camera.position.copy(target).addScaledVector(dir, 900);
  // Orbit all the way round. Zoom with a pinch, or with the scroll wheel once you've clicked into the box,
  // so scrolling past it on the way down the page never grabs the page.
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minPolarAngle = 0.12; controls.maxPolarAngle = 2.5; controls.rotateSpeed = 0.75; controls.zoomSpeed = 0.9;
  controls.enableZoom = false;
  controls.target.copy(target);
  controls.addEventListener("change", () => { dirty = true; });
  controls.addEventListener("start", () => { touched = true; if (opts.onInteract) opts.onInteract(); });
  canvas.style.touchAction = "pan-y";
  let touched = false, fitD = 900;
  canvas.addEventListener("pointerdown", () => { controls.enableZoom = true; });
  canvas.addEventListener("pointerleave", () => { controls.enableZoom = false; });
  canvas.addEventListener("wheel", e => { if (e.ctrlKey || e.metaKey) { controls.enableZoom = true; } }, { capture: true, passive: true });
  // Frame the model by measurement, not by guesswork: project its bounding box and back the camera
  // off until every corner is inside the view. Works for any explode amount and any screen shape.
  const fitBox = new THREE.Box3(), tmpBox = new THREE.Box3(), corner = new THREE.Vector3(), off = new THREE.Vector3();
  let wasPortrait = null;
  const right = new THREE.Vector3(), up = new THREE.Vector3();
  function placeCamera() {
    const w = container.clientWidth, h = container.clientHeight, portrait = w / h < 0.8;
    fitBox.makeEmpty();
    for (const g of pieces) {
      if (!g.userData.box) g.userData.box = new THREE.Box3().setFromObject(g).translate(g.position.clone().negate());
      fitBox.union(tmpBox.copy(g.userData.box).translate(g.position));
    }
    fitBox.getCenter(target);
    if (touched && wasPortrait === portrait) off.copy(camera.position).sub(controls.target).normalize();
    else off.copy(mode === "hero" ? dir : portrait ? dirPortrait : dir).normalize();   // a tall screen looks from higher up, so the layers run corner to corner
    wasPortrait = portrait;
    const fill = mode === "hero" ? 0.94 : 0.9, padBottom = mode === "hero" ? 0 : 0.14;
    let d = 1200;
    const tanH = Math.tan(camera.fov * Math.PI / 360);
    for (let pass = 0; pass < 4; pass++) {
      camera.position.copy(target).addScaledVector(off, d); camera.lookAt(target); camera.updateMatrixWorld();
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      for (const g of pieces) {                                   // every piece's own corners, so a diagonal layout isn't over-estimated
        const b = g.userData.box, p = g.position;
        for (let k = 0; k < 8; k++) {
          corner.set((k & 1 ? b.max.x : b.min.x) + p.x, (k & 2 ? b.max.y : b.min.y) + p.y + (mode === "hero" && k & 2 ? 14 : 0), (k & 4 ? b.max.z : b.min.z) + p.z).project(camera);
          x0 = Math.min(x0, corner.x); x1 = Math.max(x1, corner.x); y0 = Math.min(y0, corner.y); y1 = Math.max(y1, corner.y);
        }
      }
      // centre what is actually on screen (the antenna makes the model top-heavy), then scale it to fill
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 - padBottom * fill;
      right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1);
      target.addScaledVector(right, cx * d * tanH * camera.aspect).addScaledVector(up, cy * d * tanH);
      d *= Math.max((x1 - x0) / 2, (y1 - y0) / 2 / (1 - padBottom)) / fill;
    }
    fitD = d;
    controls.minDistance = d * 0.32; controls.maxDistance = d * 1.7;
    const keep = touched && mode === "hero" ? camera.position.distanceTo(controls.target) : d;
    camera.position.copy(target).addScaledVector(off, Math.min(controls.maxDistance, Math.max(controls.minDistance, keep)));
    controls.target.copy(target);
  }
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); canvas.style.width = "100%"; canvas.style.height = "100%";
    camera.aspect = w / h; camera.updateProjectionMatrix();
    placeCamera(); dirty = true;
  }
  new ResizeObserver(resize).observe(container);
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(container);

  // ---------- highlighting and picking ----------
  function paintSelection() {
    root.traverse(o => {
      if (!o.isMesh || !o.material.emissive || o.material === ledMat) return;
      if (o.userData.baseEmissive === undefined) { o.userData.baseEmissive = o.material.emissiveIntensity; o.userData.baseEmissiveColor = o.material.emissive.getHex(); }
      const hit = selected && o.userData.part === selected;
      o.material.emissive.setHex(hit ? 0xf2b200 : o.userData.baseEmissiveColor);
      o.material.emissiveIntensity = hit ? 0.42 : o.userData.baseEmissive;
    });
    dirty = true;
  }
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  function pick(e, wantSwitch) {
    const r = canvas.getBoundingClientRect();
    ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ptr, camera);
    for (const h of ray.intersectObjects(root.children, true)) {
      if (wantSwitch) {
        if (h.object.userData.switch !== undefined) return h.object.userData.switch;
        if (h.object.userData.knob) return "knob";
        if (h.object.userData.part === "lid" || h.object.userData.part === "overlay") return null;   // the face is in the way
        continue;
      }
      if (h.object.userData.part && h.object.material.visible !== false) return h.object.userData.part;
    }
    return null;
  }
  let downAt = null, turning = null;
  // The knob turns like the real one: grab it and drag round its centre. It clicks between 11 positions.
  const knobCentre = new THREE.Vector3();
  function knobAngleAt(e) {
    knobGroup.getWorldPosition(knobCentre); knobCentre.project(camera);
    const r = canvas.getBoundingClientRect();
    const cx = (knobCentre.x + 1) / 2 * r.width + r.left, cy = (1 - knobCentre.y) / 2 * r.height + r.top;
    return Math.atan2(e.clientX - cx, cy - e.clientY) * 180 / Math.PI;        // 0 at twelve o'clock, clockwise
  }
  function knobIndexAt(e) { return Math.max(0, Math.min(10, Math.round((knobAngleAt(e) + 150) / 30))); }
  if (mode === "hero") {
    // A finger on a switch or the knob shouldn't scroll the page.
    canvas.addEventListener("touchstart", e => { const t = e.touches[0]; if (e.touches.length === 1 && pick(t, true) !== null) e.preventDefault(); }, { passive: false });
  }
  canvas.addEventListener("pointerdown", e => {
    downAt = [e.clientX, e.clientY];
    if (mode === "hero" && pick(e, true) === "knob") {
      turning = { id: e.pointerId, moved: false, start: knobIdx };
      controls.enabled = false; canvas.setPointerCapture(e.pointerId); touched = true;
      if (opts.onInteract) opts.onInteract();
    }
  });
  canvas.addEventListener("pointermove", e => {
    if (!turning || e.pointerId !== turning.id) return;
    if (Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 4) turning.moved = true;
    if (turning.moved) setKnobFromUser(knobIndexAt(e));
  });
  const endTurn = e => {
    if (!turning || e.pointerId !== turning.id) return;
    if (!turning.moved) setKnobFromUser((knobIdx + 1) % 11);                     // a tap clicks it one step on
    turning = null; controls.enabled = true;
  };
  canvas.addEventListener("pointerup", e => {
    if (turning) { endTurn(e); return; }
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;      // a drag, not a tap
    if (mode === "hero") { const i = pick(e, true); if (typeof i === "number") api.setSwitch(i, !levers[i].on, true); }
    else { const id = pick(e, false); api.select(id === selected ? null : id, true); }
  });
  canvas.addEventListener("pointercancel", endTurn);
  function setKnobFromUser(i) {
    if (i === knobIdx) return;
    knobIdx = i; knobTarget = angleFor(i); dirty = true;
    if (opts.onPeople) opts.onPeople(i, true);
  }
  canvas.addEventListener("pointermove", e => {
    if (e.pointerType === "touch") return;
    if (mode === "hero") {
      if (turning) return;
      const hit = pick(e, true);
      canvas.style.cursor = hit === "knob" ? "grab" : hit !== null ? "pointer" : "grab";
      hover(hit);
    } else {
      const id = pick(e, false);
      canvas.style.cursor = id ? "pointer" : "grab";
      if (opts.onHover) opts.onHover(id);
    }
  });
  canvas.addEventListener("pointerleave", () => { if (mode === "hero") hover(null); });
  // Hover: the switch or knob under the pointer lights up a little, so it reads as something to press.
  let hovered = null;
  function hover(hit) {
    if (hit === hovered) return; hovered = hit;
    root.traverse(o => {
      if (!o.isMesh || !o.material.emissive) return;
      if (o.userData.leverOf === undefined && !o.userData.knob) return;
      const mine = hit === "knob" ? !!o.userData.knob : o.userData.leverOf === hit;
      if (o.userData.hoverBase === undefined) { o.userData.hoverBase = o.material.emissiveIntensity; o.userData.hoverColor = o.material.emissive.getHex(); }
      o.material.emissive.setHex(mine ? 0xf2b200 : o.userData.hoverColor);
      o.material.emissiveIntensity = mine ? 0.35 : o.userData.hoverBase;
    });
    dirty = true;
  }

  // ---------- labels (hardware page): HTML chips pinned to parts ----------
  const labels = [];
  if (opts.labels) {
    for (const p of PARTS) {
      const el = document.createElement("button");
      el.className = "part-label"; el.type = "button"; el.textContent = p.name; el.dataset.part = p.id;
      el.onclick = () => api.select(p.id === selected ? null : p.id, true);
      opts.labels.append(el);
      labels.push({ el, id: p.id, anchor: new THREE.Vector3() });
    }
  }
  const box3 = new THREE.Box3(), v = new THREE.Vector3();
  function placeLabels() {
    const w = container.clientWidth, h = container.clientHeight, show = explode > 0.45, compact = w < 520;
    const pts = [];
    for (const l of labels) {
      box3.makeEmpty();
      for (const g of pieces) if (g.userData.part === l.id) box3.expandByObject(g);
      box3.getCenter(v);
      const below = ["battery", "plate", "toggles", "base"].includes(l.id);       // label under the part; the rest sit above it
      v.y = below ? box3.min.y - 16 : box3.max.y + 16;
      v.project(camera);
      pts.push({ l, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, w: l.el.offsetWidth || 110 });
    }
    // nudge overlapping labels apart, top to bottom
    pts.sort((a, b) => a.y - b.y);
    for (let pass = 0; pass < 4; pass++) for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j];
      if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 6 && b.y - a.y < 30) b.y = a.y + 30;
    }
    for (const p of pts) {
      const l = p.l;
      l.el.style.transform = `translate(${Math.max(p.w / 2 + 6, Math.min(w - p.w / 2 - 6, p.x)).toFixed(1)}px, ${Math.max(18, Math.min(h - 78, p.y)).toFixed(1)}px) translate(-50%, -50%)`;
      l.el.classList.toggle("show", show && (!compact || l.id === selected));       // on a phone only the picked part is labelled
      l.el.classList.toggle("sel", l.id === selected);
      l.el.tabIndex = show && !compact ? 0 : -1;
    }
  }

  // ---------- frame loop ----------
  let last = performance.now(), idle = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible) return;
    if (Math.abs(explodeTarget - explode) > 0.0005) {
      explode += (explodeTarget - explode) * (reduce ? 1 : Math.min(1, dt * 7));
      for (const g of pieces) g.position.copy(g.userData.home).addScaledVector(g.userData.explode, easeInOut(explode));
      placeCamera(); dirty = true;
    }
    for (const L of levers) if (L.t < 1) {
      L.t = Math.min(1, L.t + dt / (reduce ? 0.001 : 0.11));
      L.pivot.rotation.x = L.from + (L.to - L.from) * L.t; dirty = true;
    }
    if (Math.abs(knobTarget - knobAngle) > 0.001) { knobAngle += (knobTarget - knobAngle) * (reduce ? 1 : Math.min(1, dt * 12)); knobGroup.rotation.z = knobAngle; dirty = true; }
    for (const r of rings) if (r.on) {
      r.t += dt / 1.5;
      if (r.t >= 1) { r.on = false; r.m.visible = false; } else if (r.t > 0) {
        r.m.visible = true; r.m.scale.setScalar(10 + r.t * 95); r.m.material.opacity = 0.75 * (1 - r.t) * (1 - r.t);
        r.m.lookAt(camera.position);
      }
      dirty = true;
    }
    // status light: steady when a need is on, a blink when sending, a slow "alive" blip otherwise
    idle += dt; ledFlash = Math.max(0, ledFlash - dt); glow = Math.max(0, glow - dt);
    const want = ledFlash > 0 ? 3.2 : glow > 0 || ledOn ? 1.9 : (!reduce && idle % 4 < 0.09 ? 2.2 : 0.12);
    if (Math.abs(ledMat.emissiveIntensity - want) > 0.01) { ledMat.emissiveIntensity = want; dirty = true; }
    if (mode === "hero" && !reduce && !touched) {
      const want = Math.sin(now / 5200) * 0.16;                               // a slow drift until someone takes hold
      if (Math.abs(root.rotation.y - want) > 0.0004) { root.rotation.y = want; dirty = true; }
    } else if (mode === "hero" && root.rotation.y !== 0 && touched) {
      root.rotation.y *= 0.9; if (Math.abs(root.rotation.y) < 0.001) root.rotation.y = 0; dirty = true;
    }
    controls.update();
    if (dirty) { renderer.render(scene, camera); if (labels.length) placeLabels(); dirty = false; }
  }
  const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  const api = {
    parts: PARTS,
    setExplode(t) { explodeTarget = Math.max(0, Math.min(1, t)); },
    select(id, fromUser) { selected = id; paintSelection(); if (labels.length) placeLabels(); if (opts.onSelect) opts.onSelect(id, !!fromUser); },
    setSwitch(i, on, fromUser) {
      const L = levers[i]; if (L.on === on) return;
      L.on = on; L.from = L.pivot.rotation.x; L.to = on ? -0.52 : 0.52; L.t = 0;
      ledOn = levers.some(l => l.on); api.pulse();
      if (opts.onSwitch) opts.onSwitch(levers.map(l => l.on), !!fromUser);
    },
    setPeople(i) { knobIdx = i; knobTarget = angleFor(i); api.pulse(); },
    resetView() { touched = false; wasPortrait = null; placeCamera(); dirty = true; },
    zoom(f) { const d = camera.position.distanceTo(controls.target) * f; touched = true;
      camera.position.sub(controls.target).setLength(Math.min(controls.maxDistance, Math.max(controls.minDistance, d))).add(controls.target); dirty = true; },
    pulse() { ledFlash = 0.14; glow = 1.4; if (reduce) return; rings.forEach((r, k) => { r.t = -k * 0.22; r.on = true; }); },
    switches: () => levers.map(l => l.on),
  };
  knobGroup.rotation.z = knobAngle;
  knobGroup.traverse(o => { if (o.isMesh) o.userData.knob = true; });
  resize();
  requestAnimationFrame(frame);
  return api;
}
