import assert from "node:assert/strict";
import test from "node:test";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import * as V from "../kit/valve.mjs";
import { DEG, VALVE, areaFraction, readoutOf, residualBar, torque } from "../examples/ball-valve/model.mjs";

const P = k.fitProjection([[-100, -100, 0], [100, 100, 200]], 600, 400, { pad: 20, azimuth: 40 });

test("flange table: Class 300 NPS 6 has 12 bolts on a 269.9 mm circle", () => {
  const row = V.flangeDims(6, 300);
  assert.equal(row.bolts, 12);
  assert.equal(row.bc, 269.9);
  assert.equal(row.od, 317.5);
  assert.throws(() => V.flangeDims(6, 150), /Class 300/);
  assert.throws(() => V.flangeDims(5, 300), /NPS 5/);
});

test("every Class 300 row has its bolt circle inside its outside diameter", () => {
  for (const [nps, row] of Object.entries(V.FLANGE_CL300)) {
    assert.ok(row.bc < row.od, `NPS ${nps}: bolt circle ${row.bc} must be inside OD ${row.od}`);
    assert.ok(row.bc / 2 + row.bolt / 2 < row.od / 2, `NPS ${nps}: bolt hole must clear the rim`);
  }
});

test("model: the open fraction goes from 0 to 1 and never decreases with the angle", () => {
  assert.equal(areaFraction(0), 0);
  assert.ok(Math.abs(areaFraction(90 * DEG) - 1) < 1e-12);
  let last = -1;
  for (let deg = 0; deg <= 90; deg++) {
    const a = areaFraction(deg * DEG);
    assert.ok(a >= last, `area fell at ${deg} deg`);
    last = a;
  }
});

test("model: the residual differential pressure is the full duty closed and zero open", () => {
  assert.equal(residualBar(0), 50);
  assert.ok(Math.abs(residualBar(90 * DEG)) < 1e-12);
});

test("model: the torque is highest at breakaway and lowest fully open, and stays positive", () => {
  const closed = torque(0);
  const open = torque(90 * DEG);
  assert.ok(closed > open, `closed ${closed} should exceed open ${open}`);
  assert.ok(open > 0);
  for (let deg = 0; deg <= 90; deg++) assert.ok(torque(deg * DEG) > 0);
});

test("model: a stiffer packing raises the torque by exactly the packing term", () => {
  const base = torque(90 * DEG, VALVE, { ...{ pressureBar: 50, muSeat: 0.12, muPacking: 0.1, packingStressMPa: 8, seatSealOd: 190, seatSealId: 168, springForceN: 1500, armFactor: 0.64 } });
  const harder = torque(90 * DEG, VALVE, { pressureBar: 50, muSeat: 0.12, muPacking: 0.1, packingStressMPa: 16, seatSealOd: 190, seatSealId: 168, springForceN: 1500, armFactor: 0.64 });
  const packing = (stress) => (0.1 * Math.PI * VALVE.stemD * VALVE.packingHeight * stress * (VALVE.stemD / 2)) / 1000;
  assert.ok(Math.abs(harder - base - (packing(16) - packing(8))) < 1e-5);
});

test("readout: names the state at the ends and the angle between", () => {
  assert.match(readoutOf(0), /^chiusa/);
  assert.match(readoutOf(90 * DEG), /^aperta/);
  assert.match(readoutOf(45 * DEG), /^45° · passaggio 71 %/);
});

test("bulgeBody: the analytic slope matches a finite difference of the radius", () => {
  const body = V.bulgeBody({ end: 80, cone: 15, rFlangeHub: 55, rHub: 47, half: 60, rMid: 70 });
  for (const s of [-55, -30, -10, 5, 25, 50]) {
    const h = 1e-4;
    const numeric = (body.radius(s + h) - body.radius(s - h)) / (2 * h);
    assert.ok(Math.abs(numeric - body.slope(s)) < 1e-5, `slope at ${s}: ${numeric} vs ${body.slope(s)}`);
  }
  assert.equal(body.slope(0), 0);
  assert.equal(body.radius(0), 70);
  assert.equal(body.radius(61), 47);
  const knots = body.profile.filter((point) => point[2]);
  assert.ok(knots.length >= 20, "the bulge is smooth knots");
});

test("bulgeBody: the profile is continuous and spans the end faces", () => {
  const body = V.bulgeBody({ end: 80, cone: 15, rFlangeHub: 55, rHub: 47, half: 60, rMid: 70 });
  assert.equal(body.profile[0][0], -80);
  assert.equal(body.profile[body.profile.length - 1][0], 80);
  for (let index = 1; index < body.profile.length; index++) assert.ok(body.profile[index][0] > body.profile[index - 1][0]);
});

test("boreWindow: a closed path whose width follows sin(alpha)", () => {
  const F = G.frameOf([0, 0, 100], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const widthOf = (alpha) => {
    const d = V.boreWindow(P, F, 50, 30, alpha, 64);
    assert.ok(d.startsWith("M") && d.endsWith("Z"));
    const xs = [...d.matchAll(/(-?\d+\.?\d*)[ ,](-?\d+\.?\d*)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    return Math.hypot(...[0, 1].map((axis) => Math.max(...xs.map((p) => p[axis])) - Math.min(...xs.map((p) => p[axis]))));
  };
  assert.ok(widthOf(90 * DEG) > widthOf(30 * DEG));
  assert.ok(widthOf(30 * DEG) > widthOf(5 * DEG));
});

test("leverSvg: carries a bar, a grip and a knurl, and turns with the angle", () => {
  const dims = { length: 60, width: 6, thick: 2, grip: { r: 2, h: 8 } };
  const closed = V.leverSvg(P, [0, 0], 120, 0, dims);
  const open = V.leverSvg(P, [0, 0], 120, Math.PI / 2, dims);
  assert.equal((closed.match(/class="iso-solid"/g) || []).length, 2);
  assert.notEqual(closed, open);
});

test("leverSvg: uses only kit names, so the page can inline its source", () => {
  const source = V.leverSvg.toString().replace(/\bk\./g, "");
  const kitNames = new Set(Object.keys(k));
  const called = [...source.matchAll(/\b([a-zA-Z]+)\(/g)].map((m) => m[1]);
  const allowed = new Set(["leverSvg", "sin", "cos", "if", "for"]);
  for (const name of called) assert.ok(kitNames.has(name) || allowed.has(name) || name in Math, `${name} must come from the kit`);
});

test("rfFlange: draws the bolt holes only when its face looks at the viewer", () => {
  const F = G.frameOf([0, 0, 100], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const dims = { s: 80, thickness: 18, od: 160, rfOd: 108, rfHeight: 1, bcR: 67, bolts: 12 };
  const toward = V.rfFlange(P, F, { ...dims, outward: 1 });
  const away = V.rfFlange(P, F, { ...dims, s: -80, outward: -1 });
  assert.ok(toward.seen);
  assert.ok(!away.seen);
  assert.equal((toward.svg.match(/<circle/g) || []).length, 12);
  assert.equal((away.svg.match(/<circle/g) || []).length, 0);
});

test("studs: one stud and one nut per bolt", () => {
  const F = G.frameOf([0, 0, 100], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const svg = V.studs(P, F, { sFace: 98, outward: 1, bcR: 67, count: 12, studR: 4, length: 40, nutR: 7, nutT: 7 });
  assert.equal((svg.match(/class="iso-solid"/g) || []).length, 24);
});
