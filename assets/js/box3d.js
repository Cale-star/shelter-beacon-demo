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
  // small procedural textures: moulded-plastic grain, printed layer lines, solar cells, the OLED
  function canvasTex(w, h, draw, o = {}) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (o.srgb) t.colorSpace = THREE.SRGBColorSpace; if (o.repeat) t.repeat.set(...o.repeat);
    return t;
  }
  const grain = canvasTex(256, 256, (c, w, h) => {
    const d = c.createImageData(w, h);
    for (let i = 0; i < d.data.length; i += 4) { const v = 120 + Math.random() * 26; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    c.putImageData(d, 0, 0);
  }, { repeat: [0.02, 0.02] });
  const layerLines = canvasTex(4, 512, (c, w, h) => { for (let y = 0; y < h; y++) { const v = y % 3 === 0 ? 96 : 150; c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(0, y, w, 1); } });
  const shell = () => std(0xd6d9d5, { roughness: 0.62, bumpMap: grain, bumpScale: 0.35 });
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
    for (const [x, y] of [[-82, 132], [82, 132], [-82, -132], [82, -132]]) {                                // moulded screw posts
      add(g, cylZ(6.5, 7.5, 112, 24), shell(), x, y, -65);
      add(g, cylZ(2, 2, 2, 16), black(0.8), x, y, -8.4);
    }
    for (const y of [-60, 0, 60]) for (const x of [-92, 92]) add(g, new THREE.BoxGeometry(2.4, 3, 112), shell(), x, y, -65);   // wall ribs
    const gland = new THREE.Group(); gland.position.set(48, -147, -62); g.add(gland);                       // where the solar lead comes in
    add(gland, new THREE.CylinderGeometry(8.5, 8.5, 5, 6), black(0.55), 0, -4, 0);
    add(gland, new THREE.CylinderGeometry(7, 7.6, 9, 24), black(0.5), 0, -11, 0);
    add(gland, new THREE.SphereGeometry(6.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), black(0.5), 0, -15, 0).rotation.x = Math.PI;
    add(gland, new THREE.CylinderGeometry(2.4, 2.4, 14, 12), black(0.75), 0, -22, 0);
  });
  piece("plate", [0, 0, -95], g => {
    const printed = std(0xf1f1ee, { roughness: 0.78, bumpMap: layerLines, bumpScale: 0.6 });
    add(g, new RoundedBoxGeometry(150, 228, 3, 2, 1.5), printed, 0, 0, -113);
    for (const x of [-72, 72]) add(g, new THREE.BoxGeometry(4, 220, 4), printed, x, 0, -110);             // stiffening ribs
    for (const [x, y] of [[-66, 105], [66, 105], [-66, -105], [66, -105]]) {
      add(g, cylZ(5, 5, 1.2, 24), chrome(), x, y, -110.8);                                                 // screw heads
      const slot = add(g, new THREE.BoxGeometry(6, 0.9, 0.6), black(0.7), x, y, -110.1); slot.rotation.z = (x + y) * 0.01;
    }
    for (const [x, y] of [[17, 36], [43, 36], [17, 88], [43, 88]]) add(g, cylZ(2.6, 2.6, 4, 16), printed, x, y, -110);   // board standoffs
  });
  piece("battery", [0, 0, -15], g => {
    const holder = black(0.75);
    add(g, new RoundedBoxGeometry(84, 80, 4, 2, 1.2), holder, 0, -52, -109.5);                               // tray
    for (const x of [-39.8, -19.6, 0, 19.6, 39.8]) add(g, new THREE.BoxGeometry(1.6, 74, 10), holder, x, -52, -104);   // dividers
    for (const y of [-14, -90]) add(g, new THREE.BoxGeometry(84, 3.5, 14), holder, 0, y, -102);            // end walls
    const wrap = std(0xd78fc4, { roughness: 0.38 }), band = std(0xf3eef2, { roughness: 0.4 }), cap = std(0xe9ebea, { roughness: 0.25, metalness: 1 });
    const cell = new THREE.CylinderGeometry(9, 9, 65, 32);
    for (const x of [-29.4, -9.8, 9.8, 29.4]) {
      add(g, cell, wrap, x, -52, -98);
      add(g, new THREE.CylinderGeometry(9.05, 9.05, 12, 32), band, x, -44, -98);                             // printed band on the wrap
      add(g, new THREE.CylinderGeometry(8.4, 8.4, 1.2, 32), cap, x, -18.9, -98);
      add(g, new THREE.CylinderGeometry(3.2, 3.2, 1.6, 20), cap, x, -17.9, -98);                             // positive nub
      add(g, new THREE.CylinderGeometry(8.4, 8.4, 1, 32), cap, x, -85, -98);
      add(g, new THREE.BoxGeometry(10, 1, 9), cap, x, -16.6, -100); add(g, new THREE.BoxGeometry(10, 1, 9), cap, x, -87.4, -100);   // spring contacts
    }
  });
  piece("charger", [0, 0, -15], g => {
    const pcbB = std(0x1d3f74, { roughness: 0.45 }), jst = std(0xf2f0e8, { roughness: 0.5 }), solder = std(0xd9dbd8, { roughness: 0.3, metalness: 1 });
    add(g, new RoundedBoxGeometry(34, 26, 1.6, 1, 0.4), pcbB, -38, 52, -110.5);
    add(g, new THREE.BoxGeometry(4, 3.2, 1.1), black(0.35), -38, 54, -109.2);                                 // MCP73871
    for (const [x, y] of [[-51, 60], [-25, 60], [-38, 41]]) {                                              // JST jacks: solar, battery, load
      add(g, new THREE.BoxGeometry(8, 6, 6), jst, x, y, -106.7);
      add(g, new THREE.BoxGeometry(6, 4, 4), black(0.8), x, y - 0.4, -105.2);
    }
    add(g, new THREE.BoxGeometry(8, 6, 3), solder, -51, 45, -108.2);                                         // USB
    add(g, new THREE.BoxGeometry(8, 9, 9), black(0.5), -25, 45, -105.2);                                     // DC jack
    for (const [x, c] of [[-42, 0xff5a3c], [-38, 0x3cff6a], [-34, 0xffb000]]) add(g, new THREE.BoxGeometry(1.6, 0.8, 0.6), std(c, { emissive: c, emissiveIntensity: 0.25 }), x, 63, -109.4);
  });
  piece("board", [0, 0, -15], g => {
    const pcbK = std(0x15191c, { roughness: 0.4 }), can = std(0xcfd3d3, { roughness: 0.28, metalness: 1 }), gold = std(0xd9b45a, { roughness: 0.3, metalness: 1 });
    add(g, new RoundedBoxGeometry(26, 52, 1.6, 1, 0.4), pcbK, 30, 62, -110.5);
    const oledTex = canvasTex(128, 256, (c, w, h) => {                                                       // what the box's screen shows
      c.fillStyle = "#04080c"; c.fillRect(0, 0, w, h); c.save(); c.translate(w, 0); c.rotate(Math.PI / 2);
      c.fillStyle = "#cfe9ff"; c.font = "bold 30px sans-serif"; c.fillText("Shelter 1", 14, 40);
      c.font = "22px sans-serif"; c.fillText("Sent 42, got it", 14, 76); c.fillText("20 people", 14, 104); c.restore();
    }, { srgb: true });
    add(g, new THREE.BoxGeometry(15, 28, 1.4), black(0.3), 30, 71, -109);                                    // OLED module
    add(g, new THREE.PlaneGeometry(12, 23), new THREE.MeshBasicMaterial({ map: oledTex }), 30, 71.5, -108.25);
    add(g, new RoundedBoxGeometry(13, 13, 2.2, 1, 0.3), can, 30, 46, -108.6);                                  // SX1262 shield can
    add(g, new THREE.BoxGeometry(7, 7, 0.9), black(0.3), 23, 52.5, -109.3);                                   // ESP32-S3
    add(g, new THREE.BoxGeometry(9, 7.4, 3.2), can, 30, 87.5, -108.2);                                       // USB-C
    for (const x of [22, 38]) { add(g, new THREE.BoxGeometry(3.6, 3.6, 1.6), can, x, 85, -109); add(g, cylZ(1.1, 1.1, 1, 12), black(0.6), x, 85, -108); }   // buttons
    add(g, cylZ(1.3, 1.3, 1.2, 12), gold, 37, 41, -109.2);                                                    // antenna connector
    // pin headers: black strips with gold pins
    const pin = new THREE.BoxGeometry(0.64, 0.64, 6), pinsM = new THREE.InstancedMesh(pin, gold, 36), mtx = new THREE.Matrix4();
    for (let i = 0; i < 18; i++) for (const [k, x] of [[0, 18.5], [1, 41.5]]) { mtx.makeTranslation(x, 40.4 + i * 2.54, -106.5); pinsM.setMatrixAt(i * 2 + k, mtx); }
    g.add(pinsM);
    for (const x of [18.5, 41.5]) add(g, new THREE.BoxGeometry(2.5, 46, 2.5), black(0.6), x, 62, -108.4);
    // the small parts that make a board read as a board
    const tiny = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.8, 0.6), std(0x9a7b55, { roughness: 0.5 }), 26);
    for (let i = 0; i < 26; i++) { mtx.makeTranslation(22 + (i * 37 % 16), 55 + (i * 53 % 30) * 0.2 + (i % 2) * 1.5 - 14, -109.4); tiny.setMatrixAt(i, mtx); }
    g.add(tiny);
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
    const seal = roundedRect(184, 284, 11); seal.holes.push(roundedRect(176, 276, 8));                        // the rubber seal
    add(g, new THREE.ExtrudeGeometry(seal, { depth: 2.4, bevelEnabled: false, curveSegments: 8 }), black(0.9), 0, 0, -0.9);
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
    knobGroup.children.forEach(o => { o.userData.prim = true; });                     // stand-ins until the real knob's STL loads
    add(knobGroup, cylZ(40, 40, 30, 32), new THREE.MeshBasicMaterial({ visible: false }), 0, 0, 12);   // a grab area bigger than the knob
    add(knobGroup, new RoundedBoxGeometry(3, 15, 1, 2, 0.5), std(0xf2b200, { roughness: 0.4, emissive: 0xf2b200, emissiveIntensity: 0.25 }), 0, 20.5, 5.3);
    add(knobGroup, new RoundedBoxGeometry(3, 9, 1, 2, 0.5), std(0xf2b200, { roughness: 0.4, emissive: 0xf2b200, emissiveIntensity: 0.25 }), 0, 11, 22.6);
  });
  // ---------- the real printed parts, from the project's own STL files ----------
  async function loadSTL(url) {
    const b = await (await fetch(url)).arrayBuffer(), dv = new DataView(b), n = dv.getUint32(80, true);
    const pos = new Float32Array(n * 9), fn = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50;
      for (let j = 0; j < 3; j++) fn[i * 3 + j] = dv.getFloat32(o + j * 4, true);
      for (let j = 0; j < 9; j++) pos[i * 9 + j] = dv.getFloat32(o + 12 + j * 4, true);
    }
    // smooth the curved surfaces, keep the sharp edges: average normals only across faces within 35 degrees
    const nor = new Float32Array(n * 9), byPos = new Map(), key = i => `${Math.round(pos[i * 3] * 100)},${Math.round(pos[i * 3 + 1] * 100)},${Math.round(pos[i * 3 + 2] * 100)}`;
    for (let v = 0; v < n * 3; v++) { const k = key(v); (byPos.get(k) || byPos.set(k, []).get(k)).push(v); }
    const cos = Math.cos(35 * Math.PI / 180);
    for (let v = 0; v < n * 3; v++) {
      const f = Math.floor(v / 3), ax = fn[f * 3], ay = fn[f * 3 + 1], az = fn[f * 3 + 2]; let x = 0, y = 0, z = 0;
      for (const u of byPos.get(key(v))) { const g = Math.floor(u / 3), bx = fn[g * 3], by = fn[g * 3 + 1], bz = fn[g * 3 + 2]; if (ax * bx + ay * by + az * bz >= cos) { x += bx; y += by; z += bz; } }
      const l = Math.hypot(x, y, z) || 1; nor[v * 3] = x / l; nor[v * 3 + 1] = y / l; nor[v * 3 + 2] = z / l;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    return geo;
  }
  const coverPiece = piece("charger", [0, 0, 45], () => {});                       // the printed cover lifts off the charger
  const refit = () => { if (typeof placeCamera === "function" && camera.aspect) { placeCamera(); placeGuides(explode); } dirty = true; };
  const tagPart = (m, part) => { m.castShadow = m.receiveShadow = true; m.userData.part = part; };
  loadSTL("assets/models/knob.stl").then(geo => {
    knobGroup.children.filter(o => o.userData.prim).forEach(o => knobGroup.remove(o));
    const m = new THREE.Mesh(geo, black(0.48)); tagPart(m, "knob"); m.userData.knob = true; knobGroup.add(m);
    delete knobGroup.parent.userData.box; refit();
  }).catch(() => {});
  loadSTL("assets/models/charger_cover.stl").then(geo => {
    const m = new THREE.Mesh(geo, std(0x3a3e3d, { roughness: 0.7, bumpMap: layerLines, bumpScale: 0.4 })); m.position.set(-38, 52, -111.6);
    tagPart(m, "charger"); coverPiece.add(m); delete coverPiece.userData.box; refit();
  }).catch(() => {});

  const antennaTip = new THREE.Vector3(-57, 262, -62);
  piece("antenna", [0, 40, -200], g => {
    add(g, new THREE.CylinderGeometry(4.2, 4.2, 9, 6), std(0xc8a24a, { roughness: 0.3, metalness: 1 }), -57, 149, -62);
    add(g, new THREE.CylinderGeometry(4.6, 5.2, 16, 24), black(0.55), -57, 161, -62);
    add(g, new THREE.CylinderGeometry(3.6, 4.4, 92, 24), black(0.6), -57, 214, -62);
    add(g, new THREE.SphereGeometry(3.6, 16, 10), black(0.6), -57, 260, -62);
  });
  piece("solar", [0, 70, -200], g => {
    const p = new THREE.Group(); p.position.set(34, 172, -62); p.rotation.x = 0.55; g.add(p);
    const cells = canvasTex(512, 320, (c, w, h) => {
      c.fillStyle = "#0b1320"; c.fillRect(0, 0, w, h);
      const cw = w / 6, ch = h / 4;
      for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
        const x = i * cw + 3, y = j * ch + 3;
        const gr = c.createLinearGradient(x, y, x + cw, y + ch); gr.addColorStop(0, "#1c2f52"); gr.addColorStop(1, "#122340");
        c.fillStyle = gr; c.fillRect(x, y, cw - 6, ch - 6);
        c.fillStyle = "rgba(210,220,230,.55)"; for (let k = 1; k < 3; k++) c.fillRect(x, y + k * (ch - 6) / 3, cw - 6, 1.2);   // busbars
      }
    }, { srgb: true });
    add(p, new RoundedBoxGeometry(112, 3, 72, 2, 1.2), std(0xb9bec0, { roughness: 0.35, metalness: 0.9 }), 0, 0, 0);   // aluminium frame
    add(p, new THREE.PlaneGeometry(104, 64).rotateX(-Math.PI / 2), std(0xffffff, { map: cells, roughness: 0.1, metalness: 0.3 }), 0, 1.6, 0);
    add(g, new THREE.BoxGeometry(10, 26, 6), shell(), 34, 156, -76);
  });

  // ---------- a floor to catch the shadow, so the box sits somewhere ----------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: mode === "hero" ? 0.28 : 0.4 }));
  floor.position.y = -190; floor.receiveShadow = true; scene.add(floor);

  // ---------- staging: outer parts leave first; dashed guides show which way each one travelled ----------
  const maxTravel = Math.max(...pieces.map(g => g.userData.explode.length()));
  const guides = [];
  for (const g of pieces) {
    const len = g.userData.explode.length();
    g.userData.delay = 0.32 * (1 - len / maxTravel);
    if (mode === "hero" || len < 30) continue;
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineDashedMaterial({ color: 0x9da19e, dashSize: 4, gapSize: 4, transparent: true, opacity: 0 }));
    line.frustumCulled = false; root.add(line); guides.push({ g, line, a: new THREE.Vector3(), b: new THREE.Vector3() });
  }
  const homeCentre = new THREE.Vector3();
  function placeGuides(e) {
    for (const G of guides) {
      if (!G.g.userData.box) G.g.userData.box = new THREE.Box3().setFromObject(G.g).translate(G.g.position.clone().negate());
      if (G.g.userData.box.isEmpty()) { G.line.material.opacity = 0; continue; }
      G.g.userData.box.getCenter(homeCentre);
      G.a.copy(homeCentre).add(G.g.userData.home); G.b.copy(homeCentre).add(G.g.position);
      G.line.geometry.setFromPoints([G.a, G.b]); G.line.computeLineDistances();
      G.line.material.opacity = Math.min(0.7, e * 2);
    }
  }

  // radio rings from the antenna tip: drawn only when the box "sends"
  const rings = [];
  for (let k = 0; k < 3; k++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 72), new THREE.MeshBasicMaterial({ color: 0xf2b200, transparent: true, opacity: 0, depthWrite: false }));
    m.position.copy(antennaTip); m.rotation.x = Math.PI / 2; m.visible = false;
    root.add(m); rings.push({ m, t: 0, on: false });
  }
  // ---------- state ----------
  let explode = 0, explodeTarget = 0, dirty = true, visible = true, selected = null, ledOn = false, ledFlash = 0, glow = 0, waiting = false;
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
      if (!g.userData.box.isEmpty()) fitBox.union(tmpBox.copy(g.userData.box).translate(g.position));
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
        if (b.isEmpty()) continue;                                // a part whose file hasn't loaded yet
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
      for (const g of pieces) {
        const d = g.userData.delay || 0, local = Math.min(1, Math.max(0, (explode - d) / (1 - 0.32)));
        g.position.copy(g.userData.home).addScaledVector(g.userData.explode, easeInOut(local));
      }
      placeGuides(explode); placeCamera(); dirty = true;
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
    const wph = idle % 2, dbl = wph < 0.12 || (wph > 0.26 && wph < 0.38);        // double-blink while still waiting for an answer
    const want = ledFlash > 0 ? 3.2 : glow > 0 ? 2.4 : waiting ? (dbl ? 2.4 : 0.12) : ledOn ? 1.9 : (!reduce && idle % 4 < 0.09 ? 2.2 : 0.12);
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
      ledOn = levers.some(l => l.on); if (!opts.driven) api.pulse();
      if (opts.onSwitch) opts.onSwitch(levers.map(l => l.on), !!fromUser);
    },
    setPeople(i) { knobIdx = i; knobTarget = angleFor(i); if (!opts.driven) api.pulse(); },
    flash() { ledFlash = 0.14; if (reduce) return; rings.forEach((r, k) => { r.t = -k * 0.22; r.on = true; }); },
    confirm() { glow = 1.5; waiting = false; },
    setWaiting(on) { waiting = on; },
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
