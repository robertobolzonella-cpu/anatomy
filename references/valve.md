# Valves

How to build a valve figure with `kit/valve.mjs`, from `examples/ball-valve/`. Read `craft.md` first for the look and `kit.md` section 10 for the lathe frames these builders sit on.

## Contents
1. What the library holds
2. The model module
3. Parts and painter's order
4. Things that fail
5. The card
6. Checks, and what is not covered

## 1. What the library holds

Every builder works in the world units you choose and returns SVG markup, so one valve can be built at any size. The example uses `U = 0.5` world units per mm, which keeps bevels and screw dots at the sizes the kit expects.

| Function | What it gives |
|---|---|
| `flangeDims(nps, cls = 300)` | `{ od, bc, bolts, bolt }` in mm from the ASME B16.5 Class 300 table, NPS 2 to 12. Throws for any other class or size. Check the table against the edition in use. |
| `bulgeBody({ end, cone, rFlangeHub, rHub, half, rMid })` | A body along the frame's axis: a cone out of each flange, a straight hub, then a cos² swell of half-length `half` and crown radius `rMid`. Returns `{ profile, radius, slope }`. The slope is analytic and zero at the crown and where the swell meets the hub, so the shading has no staircase. |
| `bodySvg(P, F, body, { tone })` | The body as one smooth lathe solid, with the two swell seams under the outline. |
| `rfFlange(P, F, { s, thickness, od, rfOd, rfHeight, bcR, bolts, outward })` | A raised-face flange on the end of the body. `s` is the back face and `outward` says which way the mating face looks. Draws the bolt holes only when that face looks at the viewer, otherwise a rim seam. Returns `{ svg, sFace, sRaised, seen }`. |
| `studs(P, F, { sFace, outward, bcR, count, studR, length, nutR, nutT })` | A stud and a nut at every bolt position, painted far to near. |
| `saddleBoss(P, { at, r, hostZ, top })` | A vertical boss on a curved body. `hostZ(x, y)` gives the body surface height, and the foot is cut by it along the true intersection, as `G.saddleOf` does. Use it for the stem neck, a vent and a drain. |
| `topWorks(P, { at, neckTop, gland, plate })` | A gland flange with its studs and nuts, then the ISO 5211 plate with its bolt circle. Returns `{ svg, zPlate }`. |
| `quadrant(P, { at, z, r })` | A round plate with ninety degrees of ticks and a stop at each end. Closed points along +y and open along +x. |
| `adapterSvg(P, { at, z, h, r })` | The stem adapter, painted after the quadrant so it rises through it. |
| `leverSvg(P, hub, z, alpha, { length, width, thick, grip })` | The lever at opening `alpha` (0 closed, π/2 open). It is rebuilt every frame and uses only kit names, so the page inlines its source (see below). |
| `leverHub(P, { at, z, r, h })` | The nut the lever turns on, drawn after the bar. |
| `boreWindow(P, F, sFace, rBore, alpha)` | A closed path: the bore seen on a flange face as an ellipse as wide as the bore times `sin(alpha)`. |

## 2. The model module

Put every number the figure shows in a pure `model.mjs` and import it in the build; inline its source in the page by stripping `export ` (the example does this with one regular expression), so the file and the page can never disagree. Rules:

- Parameters at the top, each a typical value to be tuned with the manufacturer's data, with units in the name or the comment.
- A header that states the limits. For the ball valve: the open fraction is the thin-ball limit `sin(α)`, an upper bound that ignores the length of the bore through the ball; the residual differential pressure `(1 − A/A0)²` is a teaching assumption; the torque is Coulomb friction at the seats and the packing with a breakaway factor, an order of magnitude and not a prediction.
- The readout text comes from the model (`readoutOf`), so the first paint and every frame say the same thing.

## 3. Parts and painter's order

The axis runs along x with the camera at the +x side, so the +x flange faces you and the −x flange shows its back. The order that worked:

1. Plate with halo, feet and a ruler strip.
2. The cradles under the hubs, far one first. Their top is the body radius where they stand, so a cradle touches along a line and is never sunk into the body.
3. The −x flange (its back face), then the body, then side bosses that start inside the body.
4. The neck (`saddleBoss`), then any vent in front of it.
5. The +x flange with its studs and the bore window.
6. The top works, the quadrant, the adapter, then the lever and its hub.

The lever is last because it lies above everything and is nearer the viewer than the flange studs when it points at them; check any new arrangement with the depth of the pieces, `dot3(point, viewOf(P))`, not by eye.

**Inlining the lever.** `leverSvg` is written with `k.`-prefixed kit calls so it works in Node; for the page, `V.leverSvg.toString().replace(/\bk\./g, "")` gives the same function calling the kit's globals. `scripts/valve.test.mjs` checks that it calls nothing else.

**The bore window.** A flat shape on the flange face, drawn as a lit solid so it reads as the one thing to watch. Draw a shaded disc under it for the closed face of the ball, and rebuild only its `d` attribute each frame.

## 4. Things that fail

- **A boss that floats beside the body.** A side boss must start inside the body (`body.radius(x) − a few units`), not at a guessed distance. The first drain was 12 units off the surface.
- **A boss on a bulge cut as if the body were a cylinder.** `saddleBoss` takes `hostZ(x, y)`, which must follow the swell's radius at the boss's x; the body is not a cylinder of constant radius.
- **Doubled scaling.** Bolt and nut radii come in mm and go through the same `m()` as everything else, once. A stud drawn at a quarter of its size was a double scaling.
- **Nuts that read as caps.** A hex nut for a 3/4-inch bolt is about 31 mm across; use that, not a round cap twice the bolt.
- **Identifiers that shadow.** The page builder has a function `body` and a card `body`; name the card `card`.

## 5. The card

Write it in the user's language (SKILL.md, step 8). The caption names the valve, the class, the face-to-face length and the duty pressure, and says in one sentence what the figure simplifies. Legend keys: the lit part (the bore) and the raised part (lever and quadrant). The readout carries the state, the open area and the torque.

## 6. Checks, and what is not covered

- `node examples/ball-valve/build.mjs` and `--light`, then `node scripts/capture.mjs` at 900 and 390 wide, with `--wait 1500` for the closed state and `--wait 4200` for the open one, and read every PNG.
- `node scripts/lines.mjs examples/ball-valve/ball-valve-light.html` must end `line ends: 0`.
- `node --test scripts/valve.test.mjs`.
- **Not covered:** `kit/valve.mjs` does not record shapes for `kit/audit.mjs`, so `--audit` cannot prove clearances or depth order for a valve figure, and nothing here passes a pipe through the audit. Say so when you hand the figure over.
