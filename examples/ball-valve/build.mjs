import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import * as G from "../../kit/lathe.mjs";
import * as V from "../../kit/valve.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";
import { DEG, VALVE, DUTY, areaFraction, readoutOf } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 640;
const HEIGHT = 440;
const U = 0.5; // unita' di mondo per mm
const m = (mm) => mm * U;

// ---- dimensioni, tutte in mm e poi in unita' di mondo ----
const FLANGE = V.flangeDims(VALVE.nps, VALVE.cls);
const FACE = VALVE.ftf / 2 - VALVE.rfHeight; // faccia di accoppiamento
const BACK = FACE - VALVE.flangeT; // dorso della flangia: dove finisce il corpo
const RH = VALVE.hubOd / 2;
const RM = VALVE.bodyMid / 2;
const ZC = RM + 60; // quota dell'asse della valvola sul piano
const BOLT_R = FLANGE.bolt / 2;

const BODY = V.bulgeBody({ end: m(BACK), cone: m(30), rFlangeHub: m(RH * 1.16), rHub: m(RH), half: m(120), rMid: m(RM) });
const AXIS = G.frameOf([0, 0, m(ZC)], [1, 0, 0], [0, 1, 0], [0, 0, 1]);

const PLATE = { x: m(-290), y: m(-190), w: m(580), d: m(380), r: m(18) };
const PLATE_H = m(26);
const FOOT_H = m(12);

const NECK = { r: m(52), top: m(ZC + RM + 95) };
const GLAND = { r: m(78), t: m(20), studs: 4, pcd: m(60), studR: m(7), stud: m(36), nutR: m(11), nutT: m(10) };
const PLATE_ISO = { r: m(96), t: m(16), pcd: m(75), bolts: 4 };
const QUAD_R = m(84);
const ADAPTER = { r: m(26), h: m(40) };
const LEVER = { length: m(420), width: m(40), thick: m(14), grip: { r: m(14), h: m(60) } };

// ---- camera: si adatta a tutto, compresa la leva nelle due posizioni estreme ----
const HUB = [0, 0];
const leverTipAt = (alpha) => [Math.sin(alpha) * LEVER.length, Math.cos(alpha) * LEVER.length];
const topProbe = NECK.top + GLAND.t + GLAND.stud + 1 + PLATE_ISO.t + ADAPTER.h + LEVER.thick + LEVER.grip.h + m(10);
const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [leverTipAt(0)[0], leverTipAt(0)[1], topProbe],
    [leverTipAt(Math.PI / 2)[0], leverTipAt(Math.PI / 2)[1], topProbe],
    [m(FACE), 0, m(ZC + 160)],
    [m(-FACE), 0, m(ZC - 160)],
  ],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 40 },
);

const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const at = (point) => k.iso(point, P);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// ---- base e sostegni ----
function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, m(40)))) {
    out.push(S(k.cylinder(x, y, m(18), -PLATE_H - FOOT_H, m(4), P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, m(14), -PLATE_H - FOOT_H + m(4), FOOT_H - m(4), P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, m(12)), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, m(24));
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const strip = { x: m(-230), y: PLATE.y + PLATE.d - m(44), w: m(460), d: m(16), r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 3, strip.x + strip.w - 3, m(10), 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 1.6, strip.y + strip.d / 2, 0.6]), at([strip.x + strip.w - 1.6, strip.y + strip.d / 2, 0.6])], { size: 0.45 }));
  return out.join("");
}

function cradle(side) {
  const x = side * m(137);
  const top = m(ZC) - BODY.radius(m(152));
  const block = { x: x - m(15), y: m(-95), w: m(30), d: m(190), r: m(4) };
  const out = [`<path class="iso-halo" d="${k.haloOf(block, 0, top, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.slabOf(block, 0, top, P, 4, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(block, m(5)), top, P, 4), { tone: "faint" }));
  const screws = [[block.x + m(7), block.y + m(18)], [block.x + m(7), block.y + block.d - m(18)], [block.x + block.w - m(7), block.y + m(18)], [block.x + block.w - m(7), block.y + block.d - m(18)]];
  out.push(D(screws.map(([sx, sy]) => at([sx, sy, top])), { size: 0.45 }));
  return out.join("");
}

// ---- corpo ----
const hostZ = (x, y) => {
  const r = BODY.radius(x);
  return m(ZC) + Math.sqrt(Math.max(0, r * r - y * y));
};

function bodyShell() {
  return V.bodySvg(P, AXIS, BODY, { tone: "mid" });
}

function ventBoss() {
  const top = m(ZC) + BODY.radius(m(85)) + m(30);
  const boss = V.saddleBoss(P, { at: [m(85), 0], r: m(16), hostZ, top });
  const F = boss.F;
  const out = [boss.svg];
  out.push(S(G.disc(top, top + m(9), m(12), F, P, { bevel: 0.3 }), { tone: "hi", crease: "lo" }));
  out.push(L(G.circleOf(F, top + m(9), m(6), P, 20), { tone: "faint" }));
  return out.join("");
}

function drainBoss() {
  // Spurgo della cavita' del corpo (DBB) sul fianco +y: nasce dentro il corpo e sporge radialmente.
  const x = m(-70);
  const F = G.frameOf([x, 0, m(ZC)], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
  const r = BODY.radius(x);
  const out = [];
  out.push(S(G.disc(r - m(6), r + m(30), m(14), F, P, { bevel: 0.3 }), { tone: "mid" }));
  out.push(S(G.disc(r + m(30), r + m(38), m(10), F, P), { tone: "hi", crease: "lo" }));
  return out.join("");
}

function neck() {
  const boss = V.saddleBoss(P, { at: [0, 0], r: NECK.r, hostZ, top: NECK.top });
  return boss.svg;
}

function topStack() {
  const works = V.topWorks(P, { at: [0, 0], neckTop: NECK.top, gland: GLAND, plate: PLATE_ISO });
  const quad = V.quadrant(P, { at: HUB, z: works.zPlate, r: QUAD_R });
  const zA = works.zPlate + 3 + ADAPTER.h;
  const adapter = V.adapterSvg(P, { at: HUB, z: works.zPlate, h: 3 + ADAPTER.h, r: ADAPTER.r });
  return { svg: works.svg + quad + adapter, zLever: zA };
}

// ---- flangia con il foro visibile dal lato +x ----
const FACE_W = m(FACE);
const BORE_R = m(VALVE.bore / 2);

function flange(side) {
  if (side < 0) {
    return V.rfFlange(P, AXIS, { s: -m(BACK), thickness: m(VALVE.flangeT), od: m(FLANGE.od), rfOd: m(VALVE.rfOd), rfHeight: m(VALVE.rfHeight), bcR: m(FLANGE.bc / 2), bolts: FLANGE.bolts, outward: -1 }).svg;
  }
  const f = V.rfFlange(P, AXIS, { s: m(BACK), thickness: m(VALVE.flangeT), od: m(FLANGE.od), rfOd: m(VALVE.rfOd), rfHeight: m(VALVE.rfHeight), bcR: m(FLANGE.bc / 2), bolts: FLANGE.bolts, outward: 1 });
  const out = [f.svg];
  out.push(V.studs(P, AXIS, { sFace: f.sFace, outward: 1, bcR: m(FLANGE.bc / 2), count: FLANGE.bolts, studR: m(BOLT_R), length: m(84), nutR: m(16), nutT: m(16) }));
  return out.join("");
}

const WINDOW_S = m(FACE + VALVE.rfHeight);

function boreWindows(alpha) {
  const bore = G.circleOf(AXIS, WINDOW_S, BORE_R, P, 56);
  const open = V.boreWindow(P, AXIS, WINDOW_S, BORE_R, alpha);
  const ball = `<path class="iso-shade" data-shade="1" d="${bore}"/>`;
  const frame = L(bore, { tone: "mid" });
  const recess = L(G.circleOf(AXIS, WINDOW_S, BORE_R + m(5), P, 56), { tone: "faint" });
  const hole = `<g data-part="window" class="iso-solid" data-lit=""><path class="iso-fill" d="${open}"/><path class="iso-line iso-edge" data-tone="lit" d="${open}"/></g>`;
  return recess + ball + frame + hole;
}

// ---- leva: la funzione sta in kit/valve.mjs e viene copiata nella pagina ----
const leverSource = V.leverSvg.toString().replace(/\bk\./g, "");
const START = 0;

const stack = topStack();
const parts = [
  plate(),
  cradle(-1),
  cradle(1),
  flange(-1),
  bodyShell(),
  drainBoss(),
  neck(),
  ventBoss(),
  flange(1),
  boreWindows(START),
  stack.svg,
  `<g data-part="lever">${V.leverSvg(P, HUB, stack.zLever, START, LEVER)}${V.leverHub(P, { at: HUB, z: stack.zLever + LEVER.thick, r: m(20), h: m(7) })}</g>`,
];

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Una valvola a sfera trunnion da 6 pollici Class 300 con flange a faccia rialzata, sui suoi sostegni. Girando la leva da chiusa ad aperta, la sfera interna ruota di novanta gradi: dal lato della flangia si vede il foro allargarsi da una fessura a un cerchio pieno, e la coppia stimata scende quando la pressione a monte si scarica.",
  body: parts,
});

// ---- pagina viva ----
const modelSource = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const live = `
${modelSource}
const P = ${JSON.stringify(P)};
const HUB = ${JSON.stringify(HUB)};
const Z_LEVER = ${stack.zLever}, LEVER = ${JSON.stringify(LEVER)};
const AXIS_O = ${JSON.stringify(AXIS.o)}, WINDOW_S = ${WINDOW_S}, BORE_R = ${BORE_R};
${leverSource}
const boreWindow = (alpha, steps = 40) => {
  const points = [];
  for (let index = 0; index < steps; index++) {
    const t = (index / steps) * Math.PI * 2;
    points.push(iso([AXIS_O[0] + WINDOW_S, AXIS_O[1] + BORE_R * Math.sin(alpha) * Math.cos(t), AXIS_O[2] + BORE_R * Math.sin(t)], P));
  }
  return pathOf(points, true);
};
const HUB_SVG = ${JSON.stringify(V.leverHub(P, { at: HUB, z: stack.zLever + LEVER.thick, r: m(20), h: m(7) }))};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const lever = svg.querySelector('[data-part="lever"]');
const windowGroup = svg.querySelector('[data-part="window"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const QUARTER = Math.PI / 2;
let alpha = 0, target = 0, frame = 0, last = 0, clock = 0, touring = true, visible = false, idleTimer = 0;
const tourAt = (t) => { const c = t % 9; return c < 1.5 ? 0 : c < 4 ? QUARTER * (1 - Math.cos(((c - 1.5) / 2.5) * Math.PI)) / 2 : c < 5.5 ? QUARTER : QUARTER * (1 + Math.cos(((c - 5.5) / 3.5) * Math.PI)) / 2; };
function draw() {
  lever.innerHTML = leverSvg(P, HUB, Z_LEVER, alpha, LEVER) + HUB_SVG;
  const d = boreWindow(alpha);
  for (const path of windowGroup.querySelectorAll("path")) path.setAttribute("d", d);
  const text = readoutOf(alpha);
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(Math.round(alpha / DEG)));
  stage.setAttribute("aria-valuetext", text);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) { clock += dt; target = tourAt(clock); }
  alpha = still.matches ? target : alpha + (target - alpha) * (1 - Math.exp(-dt / 0.22));
  if (Math.abs(target - alpha) < 0.0004) alpha = target;
  draw();
  frame = visible && (touring || alpha !== target) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next) => { touring = false; target = clamp(next, 0, QUARTER); clearTimeout(idleTimer); idleTimer = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 4200); run(); };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  steer(clamp(((event.clientX - box.left) / box.width - 0.15) / 0.7, 0, 1) * QUARTER);
});
stage.addEventListener("pointerleave", () => steer(target));
stage.addEventListener("keydown", (event) => {
  const step = 5 * DEG;
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = target + step;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = target - step;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = QUARTER;
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
draw();
`;

const card = k.plateHtml({
  fig: "Fig 1",
  title: "Valvola a sfera trunnion 6″ · 300",
  hint: "Muovi il puntatore per girare la leva",
  readout: readoutOf(START),
  keys: [
    { mark: "lit", label: "Il foro visto dalla flangia: l’area di passaggio" },
    { mark: "raised", label: "Leva e quadrante: 0° chiusa, 90° aperta" },
  ],
  caption: `Valvola a sfera trunnion full bore da 6″, Class 300 RF, lunghezza fra le facce ${VALVE.ftf} mm. Il foro nella sfera ruota con la leva: visto dalla flangia diventa un’ellisse larga quanto ${"sin(α)"} volte il passaggio (limite della sfera sottile, una stima per eccesso). La coppia è una stima di ordine di grandezza a ${DUTY.pressureBar} bar a monte, con attrito costante; non sostituisce i dati del costruttore.`,
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Valvola a sfera: le frecce girano la leva fra chiusa e aperta" aria-valuemin="0" aria-valuemax="90" aria-valuenow="0">${svg}</div>`,
});

const name = theme === "light" ? "ball-valve-light.html" : "ball-valve.html";
writeFileSync(join(HERE, name), k.pageHtml({ title: "Valvola a sfera", theme, body: card, script: kitScript() + live }));
console.log("wrote", name);
