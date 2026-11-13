// Step 4 on How it works: one report between a shelter box and headquarters, in 3D.
// Copies fly as packets; a blocked signal is a ridge that rises between them; the box's light and
// beeps follow the v0.6 firmware. The page script drives it step by step and writes the log.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/RoundedBoxGeometry.js";

export function createSeq(stage) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, 1, 2000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1d1c, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-60, 120, 140); scene.add(key);
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .6, ...o });

  // ---------- floor: contour rings, like the terrain elsewhere on the site ----------
  const floor = new THREE.Mesh(new THREE.CircleGeometry(260, 96).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: "varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
    fragmentShader: `varying vec2 vP;
      void main(){
        float r = length(vP * vec2(.8, 1.4)) + 6. * sin(vP.x * .03) * cos(vP.y * .05);
        float f = r / 18., d = abs(fract(f) - .5) / fwidth(f);
        float line = (1. - clamp(d * .9, 0., 1.)) * .22;
        float fade = smoothstep(250., 60., length(vP));
        gl_FragColor = vec4(vec3(.75, .8, .78), line * fade);
      }`,
  }));
  scene.add(floor);

  // ---------- the shelter box ----------
  const BX = -120, HX = 120;
  const boxG = new THREE.Group(); boxG.position.set(BX, 0, 0); boxG.rotation.y = .35; scene.add(boxG);
  const body = new THREE.Mesh(new RoundedBoxGeometry(38, 58, 26, 4, 3), std(0xe6e8e5, { roughness: .55 })); body.position.y = 29; boxG.add(body);
  const plate = new THREE.Mesh(new RoundedBoxGeometry(28, 7, 1.2, 2, .6), std(0x16181a)); plate.position.set(0, 49, 13.2); boxG.add(plate);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6, 4, 32).rotateX(Math.PI / 2), std(0x1b1d1f, { roughness: .4 })); knob.position.set(-2, 36, 14); boxG.add(knob);
  for (let i = 0; i < 5; i++) {
    const sw = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, 4, 12).rotateX(Math.PI / 2), std(0xdfe3e3, { metalness: 1, roughness: .2 }));
    sw.position.set(10, 24 - i * 4.4, 14.5); sw.rotation.x = i === 0 ? -.5 : .5; boxG.add(sw);
  }
  const ledMat = new THREE.MeshStandardMaterial({ color: 0xf2b200, emissive: 0xf2b200, emissiveIntensity: .1 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), ledMat); led.position.set(11, 49, 14.2); boxG.add(led);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(.8, 1, 26), std(0x1b1d1f)); ant.position.set(-12, 70, -4); boxG.add(ant);
  boxG.updateMatrixWorld(true);
  const boxTip = new THREE.Vector3(-12, 83, -4).applyMatrix4(boxG.matrixWorld);
  const ledWorld = () => led.getWorldPosition(new THREE.Vector3());

  // ---------- headquarters: a laptop running the dashboard, and the receiver beside it ----------
  const hqG = new THREE.Group(); hqG.position.set(HX, 0, 0); hqG.rotation.y = -.42; scene.add(hqG);
  const desk = new THREE.Mesh(new RoundedBoxGeometry(90, 4, 48, 2, 1.5), std(0x2b2f2e, { roughness: .8 })); desk.position.y = 18; hqG.add(desk);
  const legM = std(0x232726);
  for (const [x, z] of [[-40, -20], [40, -20], [-40, 20], [40, 20]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(3, 16, 3), legM); l.position.set(x, 8, z); hqG.add(l); }
  const base = new THREE.Mesh(new RoundedBoxGeometry(46, 2, 30, 2, .8), std(0xb9bdba, { metalness: .6, roughness: .35 })); base.position.set(-6, 21, 4); hqG.add(base);
  const lid = new THREE.Group(); lid.position.set(-6, 21.5, -11); lid.rotation.x = -.22; hqG.add(lid);
  const lidBack = new THREE.Mesh(new RoundedBoxGeometry(46, 30, 1.6, 2, .7), std(0xb9bdba, { metalness: .6, roughness: .35 }));
  lidBack.position.set(0, 15, 0); lid.add(lidBack);
  const screenCanvas = document.createElement("canvas"); screenCanvas.width = 640; screenCanvas.height = 400;
  const screenTex = new THREE.CanvasTexture(screenCanvas); screenTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(42, 26.25), new THREE.MeshBasicMaterial({ map: screenTex }));
  screen.position.set(0, 15, .85); lid.add(screen);
  function paintScreen(mode) {                                 // the real dashboard's look, in miniature
    const c = screenCanvas.getContext("2d"), W = 640, H = 400;
    c.fillStyle = "#f2f4f1"; c.fillRect(0, 0, W, H);
    c.fillStyle = "#16181a"; c.font = "600 26px 'Fira Sans', sans-serif"; c.fillText("Shelter 1", 40, 64);
    if (mode === "high") { c.fillStyle = "#bf2a1e"; c.fillRect(0, 0, W, 22); }
    c.fillStyle = "#16181a"; c.font = "700 58px 'Fira Sans', sans-serif";
    c.fillText(mode === "idle" ? "Nothing needed" : "Needs water", 40, 150);
    c.fillStyle = "#565c5d"; c.font = "400 26px 'Fira Sans', sans-serif";
    c.fillText(mode === "idle" ? "20 people. Last report 4 min ago." : "20 people. Last report just now.", 40, 196);
    ["Water", "Medical", "Food", "Blankets", "Fuel"].forEach((n, i) => {
      const y = 236 + i * 32, on = mode !== "idle" && i === 0;
      c.fillStyle = on ? "#fbecea" : "#ffffff"; c.fillRect(40, y - 22, W - 80, 30);
      c.fillStyle = on ? "#bf2a1e" : "#16181a"; c.font = `${on ? 700 : 400} 22px 'Fira Sans', sans-serif`; c.fillText(n, 56, y);
      c.fillStyle = on ? "#bf2a1e" : "#565c5d"; c.fillText(on ? "Needed" : "Not needed", W - 190, y);
    });
    screenTex.needsUpdate = true;
  }
  paintScreen("idle");
  const rx = new THREE.Mesh(new RoundedBoxGeometry(12, 3, 8, 2, .6), std(0x1b1d1f)); rx.position.set(26, 21.5, 2); hqG.add(rx);
  const rxAnt = new THREE.Mesh(new THREE.CylinderGeometry(.7, .9, 22), std(0x1b1d1f)); rxAnt.position.set(29, 33, 1); hqG.add(rxAnt);
  const rxLedMat = new THREE.MeshStandardMaterial({ color: 0xeef0ed, emissive: 0xeef0ed, emissiveIntensity: .05 });
  const rxLed = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), rxLedMat); rxLed.position.set(22, 23.4, 6); hqG.add(rxLed);
  hqG.updateMatrixWorld(true);
  const hqTip = new THREE.Vector3(29, 44, 1).applyMatrix4(hqG.matrixWorld);

  // ---------- the ridge that blocks the signal ----------
  const ridgeGeo = new THREE.PlaneGeometry(130, 118, 64, 48);
  const rp = ridgeGeo.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    const x = rp.getX(i), y = rp.getY(i) + 59, peak = 112 * Math.exp(-((x / 36) ** 2)) * (1 + .1 * Math.sin(x * .3));
    rp.setY(i, Math.min(y, peak)); rp.setZ(i, (Math.sin(x * .21 + y * .1) + Math.cos(y * .17)) * 3);
  }
  ridgeGeo.computeVertexNormals();
  const ridge = new THREE.Mesh(ridgeGeo, std(0x3a3f3d, { roughness: .95, flatShading: true, side: THREE.DoubleSide }));
  ridge.rotation.y = Math.PI / 2 * .12; scene.add(ridge);
  let ridgeUp = 0, ridgeTarget = 0;
  const ridgeAt = h => { ridge.position.y = -116 + h * 116; ridge.visible = h > .01; };
  ridgeAt(0);

  // ---------- packets, rings, bursts ----------
  const mid = boxTip.clone().lerp(hqTip, .5); mid.y += 48;
  const curve = new THREE.QuadraticBezierCurve3(boxTip, mid, hqTip), pathPts = curve.getPoints(160);
  const flights = [], rings = [], bursts = [];
  function packet(color) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CapsuleGeometry(2.4, 6, 6, 12).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color })));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(7, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .16, depthWrite: false })));
    scene.add(g); return g;
  }
  function trail(color) {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pathPts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .55 }));
    l.geometry.setDrawRange(0, 0); scene.add(l); return l;
  }
  function fly({ back = false, lost = false, color = 0xeef0ed, dur = 1.5 } = {}) {
    return new Promise(done => {
      const p = packet(color), t = trail(color);
      flights.push({ p, t, back, stop: lost ? .47 : 1, k: 0, dur: reduce ? .01 : dur, lost, done });
    });
  }
  function ring(at, color = 0xeef0ed, size = 22, dur = .9) {
    const m = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    m.position.copy(at); scene.add(m); rings.push({ m, k: 0, size, dur });
  }

  // ---------- labels pinned to the scene ----------
  const tags = [];
  function tag(text, at, cls = "", life = 2.6) {
    const el = document.createElement("span"); el.className = "s-tag " + cls; el.textContent = text; stage.append(el);
    tags.push({ el, at: at.clone(), life, k: 0 });
  }
  const fixed = [["Shelter box", new THREE.Vector3(BX, -8, 30)], ["Headquarters", new THREE.Vector3(HX, -8, 30)]].map(([t, at]) => {
    const el = document.createElement("span"); el.className = "s-name"; el.textContent = t; stage.append(el); return { el, at };
  });
  const countdown = document.createElement("div"); countdown.className = "s-count"; countdown.hidden = true; stage.append(countdown);

  // ---------- state of the lights ----------
  let ledMode = "off", ledT = 0, glowLeft = 0;
  const setLed = m => { ledMode = m; ledT = 0; };

  // ---------- camera, loop ----------
  const target = new THREE.Vector3(0, 46, 0), v = new THREE.Vector3();
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
    camera.aspect = w / h;
    const tanH = Math.tan(camera.fov * Math.PI / 360), dist = Math.max((camera.aspect < 1.4 ? 385 : 350) / (2 * tanH * camera.aspect), 150 / (2 * tanH));
    camera.position.copy(target).add(new THREE.Vector3(0, .42, 1).normalize().multiplyScalar(dist)); camera.lookAt(target);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  const place = (el, at, dy = 0) => { v.copy(at).project(camera); el.style.transform = `translate(-50%, -50%) translate(${((v.x + 1) / 2 * stage.clientWidth).toFixed(1)}px, ${((1 - v.y) / 2 * stage.clientHeight + dy).toFixed(1)}px)`; };
  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    // ridge
    ridgeUp += (ridgeTarget - ridgeUp) * (reduce ? 1 : Math.min(1, dt * 3)); ridgeAt(ridgeUp);
    // packets
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      f.k = Math.min(f.stop, f.k + dt / f.dur);
      const e = f.k, n = Math.round(e * 160), at = pathPts[f.back ? 160 - n : n];
      f.p.position.copy(at); f.t.geometry.setDrawRange(f.back ? 160 - n : 0, n + 1);
      if (f.k >= f.stop) {
        if (f.lost) { burst(at); tag("lost", at.clone().add(new THREE.Vector3(0, 12, 0)), "bad", 2.2); }
        scene.remove(f.p); fade(f.t); flights.splice(i, 1); f.done();
      }
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.k += dt / r.dur; r.m.scale.setScalar(2 + r.k * r.size); r.m.material.opacity = .85 * (1 - r.k); r.m.lookAt(camera.position);
      if (r.k >= 1) { scene.remove(r.m); rings.splice(i, 1); }
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]; b.k += dt / .7; b.m.scale.setScalar(1 + b.k * 3); b.m.material.opacity = .9 * (1 - b.k);
      if (b.k >= 1) { scene.remove(b.m); bursts.splice(i, 1); }
    }
    // the box's light
    ledT += dt; glowLeft = Math.max(0, glowLeft - dt);
    const ph = ledT % 2, dbl = ph < .14 || (ph > .3 && ph < .44);
    ledMat.emissiveIntensity = glowLeft > 0 ? 2.6 : ledMode === "waiting" ? (dbl ? 2.6 : .1) : ledMode === "on" ? 1.6 : .1;
    rxLedMat.emissiveIntensity = Math.max(.05, rxLedMat.emissiveIntensity - dt * 3);
    renderer.render(scene, camera);
    fixed.forEach(f => place(f.el, f.at));
    for (let i = tags.length - 1; i >= 0; i--) {
      const t = tags[i]; t.k += dt; place(t.el, t.at); t.el.style.opacity = t.k > t.life - .5 ? Math.max(0, (t.life - t.k) / .5) : 1;
      if (t.k >= t.life) { t.el.remove(); tags.splice(i, 1); }
    }
    countdown.style.left = "0"; if (!countdown.hidden) place(countdown, ledWorld().add(new THREE.Vector3(0, 46, 0)));
  }
  function fade(line) { let o = .55; const id = setInterval(() => { o -= .05; line.material.opacity = o; if (o <= 0) { clearInterval(id); scene.remove(line); } }, 60); }
  function burst(at) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff6a5b, transparent: true, depthWrite: false }));
    m.position.copy(at); scene.add(m); bursts.push({ m, k: 0 });
  }
  resize(); requestAnimationFrame(frame);
  const wait = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));

  // ---------- what the page script calls ----------
  return {
    reset(blocked) {
      flights.splice(0).forEach(f => { scene.remove(f.p); scene.remove(f.t); });
      tags.splice(0).forEach(t => t.el.remove()); countdown.hidden = true;
      ridgeTarget = blocked ? 1 : 0; setLed("off"); paintScreen("idle");
    },
    async flip() { setLed("on"); glowLeft = .15; ring(ledWorld(), 0xeef0ed, 10, .5); tag("chirp", ledWorld().add(new THREE.Vector3(0, 14, 0)), "", 1.8); await wait(1100); },
    async copy(n, lost) {
      glowLeft = .12; ring(boxTip, 0xeef0ed, 26, 1);
      tag(`copy ${n}`, boxTip.clone().add(new THREE.Vector3(0, 12, 0)), "", 1.4);
      await fly({ lost });
      if (!lost) { rxLedMat.emissiveIntensity = 3; ring(hqTip, 0xeef0ed, 18, .8); paintScreen("water"); tag("dashboard updates", hqTip.clone().add(new THREE.Vector3(-30, 14, 0)), "", 3); }
    },
    async longBeep() { ring(ledWorld(), 0xf2b200, 40, 1.6); tag("one long beep", ledWorld().add(new THREE.Vector3(0, 16, 0)), "amb", 2.4); setLed("waiting"); await wait(1500); },
    async retry(seconds) {
      countdown.hidden = false;
      for (let s = seconds; s > 0; s--) { countdown.textContent = `tries again in ${s} s`; await wait(520); }
      countdown.hidden = true; ridgeTarget = 0; await wait(700);          // the signal comes back
    },
    async ack() { await wait(250); await fly({ back: true, color: 0xf2b200, dur: 1.3 }); },
    async twoBeeps() {
      setLed("on"); glowLeft = 1.5;
      ring(ledWorld(), 0xeef0ed, 18, .6); await wait(160); ring(ledWorld(), 0xeef0ed, 18, .6);
      tag("two quick beeps", ledWorld().add(new THREE.Vector3(0, 16, 0)), "", 3);
      await wait(800);
    },
  };
}
