// Valve parts for Anatomy figures: weld-neck bulge body, raised-face flanges, stud bolting,
// saddle bosses on a curved body, a bonnet neck with gland and ISO 5211 plate, a quadrant
// plate and a lever. Everything is built from the kit (iso-kit.mjs) and the lathe (lathe.mjs),
// in world units chosen by the caller, so the same builders serve any size of valve.
//
// Every function returns SVG markup (a string) or plain numbers. Paint the pieces back to front
// in the order the figure needs; helpers that hold several solids sort them by depth themselves.
//
// The flange bolting table is ASME B16.5 Class 300 (mm): outside diameter, bolt circle, bolt count
// and bolt diameter. Check it against the edition the project works to before quoting it.
import * as k from "./iso-kit.mjs";
import * as G from "./lathe.mjs";

const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const TAU = Math.PI * 2;

export const FLANGE_CL300 = {
  2: { od: 165.1, bc: 127.0, bolts: 8, bolt: 15.875 },
  3: { od: 209.6, bc: 168.3, bolts: 8, bolt: 19.05 },
  4: { od: 254.0, bc: 200.2, bolts: 8, bolt: 19.05 },
  6: { od: 317.5, bc: 269.9, bolts: 12, bolt: 19.05 },
  8: { od: 381.0, bc: 330.2, bolts: 12, bolt: 22.225 },
  10: { od: 444.5, bc: 387.4, bolts: 16, bolt: 25.4 },
  12: { od: 520.7, bc: 450.8, bolts: 16, bolt: 28.575 },
};

export function flangeDims(nps, cls = 300) {
  if (cls !== 300) throw new Error(`valve.mjs only carries the Class 300 table, not Class ${cls}`);
  const row = FLANGE_CL300[nps];
  if (!row) throw new Error(`no Class 300 flange row for NPS ${nps}`);
  return row;
}

// The body: end cones that grow into a smooth bulge (a cos² swell, so the slope is analytic and
// zero where it joins the straight hub and at the crown). Axis runs along the frame's `a`.
export function bulgeBody({ end, cone, rFlangeHub, rHub, half, rMid, knots = 30 }) {
  const swell = (a) => (a >= half ? rHub : rHub + (rMid - rHub) * Math.cos((Math.PI * a) / (2 * half)) ** 2);
  const radius = (s) => swell(Math.abs(s));
  const slope = (s) => {
    const a = Math.abs(s);
    if (a >= half) return 0;
    return -Math.sign(s) * (rMid - rHub) * (Math.PI / (2 * half)) * Math.sin((Math.PI * a) / half) + 0;
  };
  const profile = [
    [-end, rFlangeHub],
    [-end + cone, rHub],
    [-half, rHub, 1],
  ];
  for (let index = 1; index < knots; index++) {
    const s = -half + (2 * half * index) / knots;
    profile.push([s, radius(s), 1]);
  }
  profile.push([half, rHub, 1], [end - cone, rHub], [end, rFlangeHub]);
  return { profile, radius, slope, end, half };
}

export function bodySvg(P, F, body, { tone = "mid", rows = 5 } = {}) {
  const paths = G.solidOf(body.profile, F, P, { smooth: { slope: body.slope, rows } });
  const seams = [-body.half, body.half].map((s) => G.arcOf(F, s, body.radius(s), P, { slope: body.slope(s) })).join("");
  return S(paths, { tone, inner: L(seams, { tone: "faint" }) });
}

// A raised-face flange on the end of the body. `s` is the back face (where the hub meets it) and
// `outward` (+1 or -1) says which way the mating face looks along the frame's axis.
export function rfFlange(P, F, { s, thickness, od, rfOd, rfHeight, bcR, bolts, outward = 1, phase = 0, bevel = 1 }) {
  const sFace = s + outward * thickness;
  const sRaised = sFace + outward * rfHeight;
  const lo = Math.min(s, sFace);
  const hi = Math.max(s, sFace);
  const V = G.viewOf(P);
  const seen = G.dot3(G.mul3(F.a, outward), V) > 0.12;
  const out = [S(G.disc(lo, hi, od / 2, F, P, { bevel }), { tone: "mid" })];
  out.push(S(G.disc(Math.min(sFace, sRaised), Math.max(sFace, sRaised), rfOd / 2, F, P), { tone: "mid" }));
  if (seen) {
    const holes = G.dotsOf(F, sFace, bcR, bolts, P, { all: true, phase });
    out.push(D(holes, { size: 0.42, tone: "lo" }));
    out.push(L(G.circleOf(F, sFace, od / 2 - 3.2, P), { tone: "faint" }));
  } else {
    out.push(L(G.arcOf(F, (lo + hi) / 2, od / 2, P), { tone: "faint" }));
  }
  return { svg: out.join(""), sFace, sRaised, seen };
}

// Studs with a nut on each end, standing out of a flange face. Painted far to near.
export function studs(P, F, { sFace, outward = 1, bcR, count, studR, length, nutR, nutT, phase = 0 }) {
  const V = G.viewOf(P);
  const list = [];
  for (let index = 0; index < count; index++) {
    const angle = phase + (index / count) * TAU;
    const base = G.pointOf(F, sFace, bcR, angle);
    list.push({ key: G.dot3(G.add3(base, G.mul3(F.a, outward * length * 0.5)), V), base });
  }
  list.sort((a, b) => a.key - b.key);
  const out = [];
  for (const { base } of list) {
    const SF = G.frameAlong(base, G.mul3(F.a, outward));
    out.push(S(G.disc(0, length, studR, SF, P), { tone: "mid", crease: "none" }));
    out.push(S(G.disc(length * 0.22, length * 0.22 + nutT, nutR, SF, P, { bevel: 0.25 }), { tone: "hi", crease: "lo" }));
  }
  return out.join("");
}

// A boss that stands on a curved body (a vent, a drain, the stem neck): a saddle pad whose foot is
// cut by the body's own surface, so it meets the body along the true intersection.
// `hostZ(x, y)` gives the height of the body surface above the boss.
export function saddleBoss(P, { at, r, hostZ, top }) {
  const F = G.frameOf([at[0], at[1], 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const start = (angle) => hostZ(at[0] + r * Math.cos(angle), at[1] + r * Math.sin(angle));
  return { F, svg: S(G.saddleOf(F, r, start, top, P), { tone: "mid" }), foot: Math.min(...Array.from({ length: 24 }, (_, j) => start((j / 24) * TAU))) };
}

// Top works: gland flange with four studs, then the ISO 5211 mounting plate with its bolts. They stand on
// the neck, which the caller makes with saddleBoss. The stem adapter is separate (`adapterSvg`) so the
// quadrant can be painted between the plate and the adapter that rises through it.
export function topWorks(P, { at, neckTop, gland, plate }) {
  const F = G.frameOf([at[0], at[1], 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const out = [];
  out.push(S(G.disc(neckTop, neckTop + gland.t, gland.r, F, P, { bevel: 0.8 }), { tone: "mid" }));
  out.push(L(G.circleOf(F, neckTop + gland.t, gland.r - 2.6, P), { tone: "faint" }));
  const glandStuds = [];
  for (let index = 0; index < gland.studs; index++) {
    const angle = Math.PI / 4 + (index / gland.studs) * TAU;
    glandStuds.push({ angle, key: G.dot3(G.pointOf(F, neckTop + gland.t, gland.pcd, angle), G.viewOf(P)) });
  }
  glandStuds.sort((a, b) => a.key - b.key);
  for (const { angle } of glandStuds) {
    const SF = G.frameAlong(G.pointOf(F, neckTop + gland.t, gland.pcd, angle), [0, 0, 1]);
    out.push(S(G.disc(0, gland.stud, gland.studR, SF, P), { tone: "mid", crease: "none" }));
    out.push(S(G.disc(gland.stud * 0.3, gland.stud * 0.3 + gland.nutT, gland.nutR, SF, P, { bevel: 0.2 }), { tone: "hi", crease: "lo" }));
  }
  const zPlate = neckTop + gland.t + gland.stud + 1;
  out.push(S(G.disc(zPlate, zPlate + plate.t, plate.r, F, P, { bevel: 1 }), { tone: "mid" }));
  out.push(D(G.dotsOf(F, zPlate + plate.t, plate.pcd, plate.bolts, P, { all: true, phase: Math.PI / 4 }), { size: 0.55, tone: "hi" }));
  out.push(L(G.circleOf(F, zPlate + plate.t, plate.r - 3, P), { tone: "faint" }));
  return { svg: out.join(""), zPlate: zPlate + plate.t };
}

// The stem adapter, standing on the mounting plate and rising through the quadrant.
export function adapterSvg(P, { at, z, h, r }) {
  const F = G.frameOf([at[0], at[1], 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  return S(G.disc(z, z + h, r, F, P, { bevel: 0.5 }), { tone: "hi" }) + L(G.circleOf(F, z + h, r - 2.4, P, 24), { tone: "faint" });
}

// The quadrant: a round plate with ninety degrees of ticks and a stop at each end. The lever sweeps
// from the closed stop to the open one. Closed points along +y and open along +x.
export function quadrant(P, { at, z, r, ticks = 18, every = 6 }) {
  const out = [];
  const F = G.frameOf([at[0], at[1], 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  out.push(S(G.disc(z, z + 3, r, F, P, { bevel: 0.4 }), { tone: "mid" }));
  const minor = [];
  const major = [];
  for (let index = 0; index <= ticks; index++) {
    const angle = (index / ticks) * (Math.PI / 2);
    const inner = r - (index % every === 0 ? 9 : 5.5);
    const outer = r - 2.4;
    const a = [at[0] + Math.sin(angle) * inner, at[1] + Math.cos(angle) * inner];
    const b = [at[0] + Math.sin(angle) * outer, at[1] + Math.cos(angle) * outer];
    (index % every === 0 ? major : minor).push(k.lineOnTop(a, b, z + 3, P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  for (const angle of [0, Math.PI / 2]) {
    const stop = [at[0] + Math.sin(angle) * (r - 4.5), at[1] + Math.cos(angle) * (r - 4.5)];
    out.push(S(k.cylinder(stop[0], stop[1], 2.6, z + 3, 6, P, 16), { tone: "hi" }));
  }
  return out.join("");
}

// The lever. It is rebuilt every frame (a rotation about z can't be a screen transform), so it uses
// only kit functions, called by bare name: the example inlines this function's source in the page.
// `alpha` is the opening in radians: 0 is closed (lever along +y), pi/2 is open (along +x).
export function leverSvg(P, hub, z, alpha, { length, width, thick, grip }) {
  const dx = Math.sin(alpha);
  const dy = Math.cos(alpha);
  const nx = dy;
  const ny = -dx;
  const w = width / 2;
  const tail = -width * 1.1;
  const ring = [
    [hub[0] + dx * tail + nx * w, hub[1] + dy * tail + ny * w],
    [hub[0] + dx * length + nx * w, hub[1] + dy * length + ny * w],
    [hub[0] + dx * length - nx * w, hub[1] + dy * length - ny * w],
    [hub[0] + dx * tail - nx * w, hub[1] + dy * tail - ny * w],
  ];
  const bar = k.extrude(ring, z, thick, P);
  const end = [hub[0] + dx * (length - grip.r - 3), hub[1] + dy * (length - grip.r - 3)];
  const mark = k.lineOnTop([hub[0] + dx * 4, hub[1] + dy * 4], [hub[0] + dx * (length - 2 * grip.r - 8), hub[1] + dy * (length - 2 * grip.r - 8)], z + thick, P);
  return (
    k.solidSvg(bar, { tone: "hi", crease: "lo" }) +
    k.lineSvg(mark, { tone: "faint" }) +
    k.solidSvg(k.cylinder(end[0], end[1], grip.r, z + thick, grip.h, P, 24, 0.4), { tone: "mid" }) +
    k.lineSvg(k.knurl(end[0], end[1], grip.r, z + thick, z + thick + grip.h, 20, P), { tone: "lo" })
  );
}

// The hub the lever turns on, drawn once under the moving bar.
export function leverHub(P, { at, z, r, h }) {
  return S(k.cylinder(at[0], at[1], r, z, h, P, 28, 0.5), { tone: "hi", crease: "lo" }) + L(k.ring(at[0], at[1], r - 3, z + h, P, 24), { tone: "faint" });
}

// The bore seen on a flange face as the ball turns. The ball's bore tilts by (pi/2 - alpha) from the
// flow axis, so what you see through the port is an ellipse as wide as the bore times sin(alpha) and
// as tall as the bore: the thin-ball limit, an upper bound on the flow area. Returns a closed path.
export function boreWindow(P, F, sFace, rBore, alpha, steps = 40) {
  const points = [];
  for (let index = 0; index < steps; index++) {
    const t = (index / steps) * TAU;
    const y = rBore * Math.sin(alpha) * Math.cos(t);
    const z = rBore * Math.sin(t);
    points.push(k.iso([F.o[0] + F.a[0] * sFace, F.o[1] + F.a[1] * sFace + y, F.o[2] + F.a[2] * sFace + z], P));
  }
  return k.pathOf(points, true);
}
