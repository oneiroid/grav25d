# Gravity3D Modular Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the 1746-line single-file `index.html` into modular `src/` files with performance optimizations, code deduplication, and state cleanup, targeting smooth 20-30 body simulations.

**Architecture:** Extract CSS/JS into 7 source files loaded via plain `<script>` tags (no bundler). A zero-dependency Node build script re-inlines everything into `dist/index.html` for deployment. Performance fixes target the grid computation hot path, GL state lookups, and DOM updates.

**Tech Stack:** Vanilla JS, WebGL 1.0, Node.js (build script only), no runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-03-20-modular-restructure-design.md`

---

## File Map

| File | Action | Responsibility | Source lines |
|------|--------|---------------|-------------|
| `src/style.css` | Create | All CSS | `index.html:7-586` (inside `<style>`) |
| `src/math.js` | Create | v3, mat4*, mapPhi, rawPotential, constants | `index.html:705-821` |
| `src/simulation.js` | Create | Body, Simulation, PRESETS | `index.html:824-982` |
| `src/renderer.js` | Create | Renderer class | `index.html:985-1388` |
| `src/ui.js` | Create | updateHUD, toast, bindSlider, syncSliders, toggleMobilePanel | `index.html:1391-1493` + mobile toggles `1689-1728` |
| `src/input.js` | Create | Mouse, touch, keyboard handlers, addBodyAtScreen | `index.html:1496-1687` + keyboard `1496-1506` |
| `src/main.js` | Create | Boot: create sim/ren, wire everything, start loop | `index.html:1423-1431, 1459-1472, 1474-1486, 1730-1743` |
| `index.html` | Rewrite | Minimal shell: DOM only, `<link>` + `<script src>` tags | New |
| `build.js` | Create | Inline CSS+JS into single HTML | New |
| `gravity3d.py` | Delete | Dead code | - |
| `CLAUDE.md` | Modify | Reflect new structure | - |
| `.gitignore` | Modify | Add `dist/` | - |

---

## Task 1: Scaffold file structure and extract CSS

**Files:**
- Create: `src/style.css`
- Rewrite: `index.html`

This task creates the `src/` directory, extracts all CSS verbatim, and rewrites `index.html` as a minimal shell that links to the CSS and will later load JS files. No JS changes yet -- the app won't run until Task 2 is complete.

- [ ] **Step 1: Create `src/` directory**

Run: `mkdir -p src`

- [ ] **Step 2: Extract CSS to `src/style.css`**

Copy the entire contents of `index.html` lines 8-585 (everything between `<style>` and `</style>` tags, not including the tags themselves) into `src/style.css`. No modifications -- exact verbatim copy.

- [ ] **Step 3: Rewrite `index.html` as minimal shell**

Replace the entire `index.html` with the following shell (DOM elements preserved verbatim from original lines 588-694, CSS and JS replaced with external references):

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Gravity — Spacetime Curvature</title>
<link rel="stylesheet" href="src/style.css">
</head>
<body>
<canvas id="c"></canvas>
<div id="scanlines"></div>

<!-- Top bar -->
<div id="top-bar">
  <div class="title-group">
    <h1>Gravity</h1>
    <span class="sub">spacetime curvature</span>
  </div>
  <div class="stats">
    <div class="stat"><span class="lbl">bodies</span><span class="val" id="s-n">0</span></div>
    <div class="stat"><span class="lbl">G</span><span class="val" id="s-g">6.674</span></div>
    <div class="stat"><span id="pulse-dot" class="pulse-dot"></span><span class="val on" id="s-st">running</span></div>
  </div>
</div>

<!-- Body list panel -->
<div id="body-panel" class="bracketed">
  <div class="section-label">bodies</div>
  <div id="body-list"><span style="color:var(--hud-dim)">no bodies</span></div>
</div>

<!-- Params panel (left) -->
<div id="params-panel" class="bracketed">
  <div class="section-label">new body</div>
  <div class="slider-control">
    <span class="slider-label">mass</span>
    <input type="range" id="mass-slider" min="-200" max="200" step="1.0" value="5">
    <span class="slider-val" id="mass-val">5.0</span>
  </div>
  <div class="params-divider"></div>
  <div class="section-label">simulation</div>
  <div class="slider-control">
    <span class="slider-label">gravity</span>
    <input type="range" id="g-slider" min="-50" max="50" step="0.1" value="6.674">
    <span class="slider-val" id="g-val">6.674</span>
  </div>
  <div class="slider-control">
    <span class="slider-label">time</span>
    <input type="range" id="time-slider" min="0.05" max="5" step="0.05" value="1">
    <span class="slider-val" id="time-val">1.0x</span>
  </div>
  <div class="toggle-control">
    <span class="slider-label">body z</span>
    <div class="toggle-switch" id="body-z-toggle"></div>
    <span class="toggle-status" id="body-z-status">off</span>
  </div>
  <div class="slider-control">
    <span class="slider-label">boundary</span>
    <div class="boundary-row">
      <button class="boundary-btn" data-r="60">S</button>
      <button class="boundary-btn active" data-r="120">M</button>
      <button class="boundary-btn" data-r="200">L</button>
      <button class="boundary-btn" data-r="350">XL</button>
    </div>
  </div>
  <button class="params-expand-btn" id="params-expand">+ advanced</button>
  <div class="params-advanced" id="params-advanced">
    <div class="slider-control">
      <span class="slider-label">curve</span>
      <input type="range" id="curve-slider" min="0.1" max="2" step="0.05" value="0.8">
      <span class="slider-val" id="curve-val">0.80</span>
    </div>
    <div class="slider-control">
      <span class="slider-label">soften</span>
      <input type="range" id="soften-slider" min="0.2" max="8" step="0.1" value="2.0">
      <span class="slider-val" id="soften-val">2.0</span>
    </div>
  </div>
</div>

<!-- Bottom toolbar -->
<div id="bottom-bar"><div id="bottom-inner">
  <div class="toolbar-section">
    <div class="preset-row">
      <button class="preset-btn active" data-p="solar">solar</button>
      <button class="preset-btn" data-p="binary">binary</button>
      <button class="preset-btn" data-p="figure8">figure-8</button>
      <button class="preset-btn" data-p="trojan">trojan</button>
      <button class="preset-btn" data-p="runaway">runaway</button>
      <button class="preset-btn" data-p="necklace">necklace</button>
      <button class="preset-btn" data-p="intruder">intruder</button>
      <button class="preset-btn" data-p="collapse">collapse</button>
      <button class="preset-btn" data-p="hierarchy">hierarchy</button>
    </div>
  </div>
  <div class="toolbar-section">
    <div class="keyhints">
      <span class="k"><b>Click</b> add</span>
      <span class="k"><b>RClick</b> remove</span>
      <span class="k"><b>Drag</b> orbit</span>
      <span class="k"><b>Scroll</b> zoom</span>
      <span class="k"><b>Space</b> pause</span>
      <span class="k"><b>R</b> reset</span>
    </div>
  </div>
</div></div>

<!-- Mobile toggle buttons -->
<button class="mobile-toggle" id="toggle-params" title="Parameters">P</button>
<button class="mobile-toggle" id="toggle-bodies" title="Bodies">B</button>
<button class="mobile-toggle" id="mobile-pause" title="Pause/Resume">||</button>
<button class="mobile-toggle" id="mobile-reset" title="Reset">R</button>
<div id="longpress-indicator"></div>

<div id="toast"></div>

<script src="src/math.js"></script>
<script src="src/simulation.js"></script>
<script src="src/renderer.js"></script>
<script src="src/ui.js"></script>
<script src="src/input.js"></script>
<script src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Commit**

```bash
git add src/style.css index.html
git commit -m "refactor: extract CSS to src/style.css, rewrite index.html as shell"
```

---

## Task 2: Extract math.js -- vectors, matrices, potential functions

**Files:**
- Create: `src/math.js`

Extract all pure math utilities. Apply spec section 4a: `mapPhi` and `rawPotential` become explicit-parameter functions. Remove dead `potential()` wrapper (spec section 5).

- [ ] **Step 1: Create `src/math.js`**

Contents (extracted from `index.html:705-821`, with parameter changes per spec 4a):

```js
// ── Constants ──
const G_DEFAULT = 6.674;
const SOFTENING = 0.2;
const DT = 0.005;
const STEPS_PER_FRAME = 4;
const BOUNCE_DAMP = 0.8;
const GRID_N = 200;
const PHI_SCALE = 20;
const MAX_WELL_DEPTH = 150;

// ── 3D Vector ──
const v3 = {
  create: (x=0,y=0,z=0) => new Float64Array([x,y,z]),
  add: (a,b) => new Float64Array([a[0]+b[0],a[1]+b[1],a[2]+b[2]]),
  sub: (a,b) => new Float64Array([a[0]-b[0],a[1]-b[1],a[2]-b[2]]),
  scale: (a,s) => new Float64Array([a[0]*s,a[1]*s,a[2]*s]),
  dot: (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  cross: (a,b) => new Float64Array([a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]),
  len: (a) => Math.hypot(a[0],a[1],a[2]),
  norm: (a) => { const l=Math.hypot(a[0],a[1],a[2])||1; return new Float64Array([a[0]/l,a[1]/l,a[2]/l]); },
};

// ── Matrix helpers (column-major Float32Array) ──
function mat4Perspective(fov, aspect, near, far) {
  const f = 1/Math.tan(fov*0.5), nf = 1/(near-far);
  return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
}

function mat4LookAt(eye, center, up) {
  const z = v3.norm(v3.sub(eye, center));
  const x = v3.norm(v3.cross(up, z));
  const y = v3.cross(z, x);
  return new Float32Array([
    x[0],y[0],z[0],0,
    x[1],y[1],z[1],0,
    x[2],y[2],z[2],0,
    -v3.dot(x,eye),-v3.dot(y,eye),-v3.dot(z,eye),1
  ]);
}

function mat4Mul(a, b) {
  const r = new Float32Array(16);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[i+k*4] * b[k+j*4];
      r[i+j*4] = s;
    }
  return r;
}

function mat4Inv(m) {
  const r = new Float32Array(16);
  const m0=m[0],m1=m[1],m2=m[2],m3=m[3],m4=m[4],m5=m[5],m6=m[6],m7=m[7];
  const m8=m[8],m9=m[9],m10=m[10],m11=m[11],m12=m[12],m13=m[13],m14=m[14],m15=m[15];
  const b0=m0*m5-m1*m4,b1=m0*m6-m2*m4,b2=m0*m7-m3*m4,b3=m1*m6-m2*m5;
  const b4=m1*m7-m3*m5,b5=m2*m7-m3*m6,b6=m8*m13-m9*m12,b7=m8*m14-m10*m12;
  const b8=m8*m15-m11*m12,b9=m9*m14-m10*m13,b10=m9*m15-m11*m13,b11=m10*m15-m11*m14;
  const det=b0*b11-b1*b10+b2*b9+b3*b8-b4*b7+b5*b6;
  if(Math.abs(det)<1e-8) return null;
  const id=1/det;
  r[0]=(m5*b11-m6*b10+m7*b9)*id; r[1]=(m2*b10-m1*b11-m3*b9)*id;
  r[2]=(m13*b5-m14*b4+m15*b3)*id; r[3]=(m10*b4-m9*b5-m11*b3)*id;
  r[4]=(m6*b8-m4*b11-m7*b7)*id; r[5]=(m0*b11-m2*b8+m3*b7)*id;
  r[6]=(m14*b2-m12*b5-m15*b1)*id; r[7]=(m8*b5-m10*b2+m11*b1)*id;
  r[8]=(m4*b10-m5*b8+m7*b6)*id; r[9]=(m1*b8-m0*b10-m3*b6)*id;
  r[10]=(m12*b4-m13*b2+m15*b0)*id; r[11]=(m9*b2-m8*b4-m11*b0)*id;
  r[12]=(m5*b7-m4*b9-m6*b6)*id; r[13]=(m0*b9-m1*b7+m2*b6)*id;
  r[14]=(m13*b1-m12*b3-m14*b0)*id; r[15]=(m8*b3-m9*b1+m10*b0)*id;
  return r;
}

// ── Palette ──
const COLORS = [
  [0, 0.83, 0.91],   // cyan
  [0.91, 0.63, 0.19], // amber
  [0.91, 0.25, 0.38], // rose
  [0.38, 0.91, 0.47], // green
  [0.63, 0.44, 0.88], // purple
  [0.91, 0.78, 0.25], // yellow
  [0.28, 0.60, 0.91], // blue
  [0.91, 0.41, 0.63], // pink
];
const COLOR_HEX = ['#00d4e8','#e8a030','#e84060','#60e878','#a070e0','#e8c840','#4898e8','#e868a0'];

// ── Gravitational potential ──
// Raw Newtonian potential (unmapped). softening = Plummer softening radius.
function rawPotential(x, y, bodies, G, softening) {
  let phi = 0;
  const s2 = softening * softening;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    const dx = x - b.x, dy = y - b.y;
    const r = Math.sqrt(dx * dx + dy * dy + s2);
    phi -= G * b.mass / r;
  }
  return phi;
}

// Map raw phi to display Z via pow-of-log compression.
function mapPhi(phi, zScale, curvatureExp) {
  const sign = phi < 0 ? -1 : 1;
  const z = sign * zScale * Math.pow(Math.log(1 + Math.abs(phi) / PHI_SCALE), curvatureExp);
  return Math.max(-MAX_WELL_DEPTH, Math.min(MAX_WELL_DEPTH, z));
}
```

Note: `potential()` (the unused convenience wrapper) is intentionally omitted per spec section 5.

- [ ] **Step 2: Verify file is syntactically valid**

Run: `node -c src/math.js`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/math.js
git commit -m "refactor: extract math utilities to src/math.js

Parameterize rawPotential(softening) and mapPhi(zScale, curvatureExp).
Remove unused potential() wrapper."
```

---

## Task 3: Extract simulation.js -- Body, Simulation, Presets

**Files:**
- Create: `src/simulation.js`

Extract Body class, Simulation class, and convert presets to data factories. Apply spec sections 3c (Body.radius), 4a (globals into Simulation), 4b (presets as data).

- [ ] **Step 1: Create `src/simulation.js`**

```js
// ── Body ──
class Body {
  static radius(mass) {
    return Math.max(0.15, 0.5 * Math.pow(Math.abs(mass), 1/3));
  }

  constructor(x, y, mass, vx, vy, colorIdx = 0) {
    this.x = x; this.y = y;
    this.vx = vx || 0; this.vy = vy || 0;
    this.mass = mass;
    this.cidx = colorIdx % COLORS.length;
    this.color = COLORS[this.cidx];
    this.hex = COLOR_HEX[this.cidx];
    this.r = Body.radius(mass);
  }
}

// ── Presets (factory functions returning body data arrays) ──
const PRESETS = {
  solar: (G) => {
    const Ms = 150, r1 = 20, r2 = 35, r3 = 50;
    return [
      { x: 0, y: 0, mass: Ms, vx: 0, vy: 0 },
      { x: r1, y: 0, mass: 6, vx: 0, vy: Math.sqrt(G * Ms / r1) },
      { x: -r2, y: 0, mass: 10, vx: 0, vy: -Math.sqrt(G * Ms / r2) },
      { x: 0, y: r3, mass: 3, vx: -Math.sqrt(G * Ms / r3), vy: 0 },
    ];
  },
  binary: (G) => {
    const sep = 25, m = 80;
    const v = Math.sqrt(G * m / (4 * (sep / 2)));
    return [
      { x: -sep / 2, y: 0, mass: m, vx: 0, vy: -v },
      { x: sep / 2, y: 0, mass: m, vx: 0, vy: v },
    ];
  },
  figure8: (G) => {
    const m = 40, S = 18;
    const vS = Math.sqrt(G * m / S);
    return [
      { x: -0.97 * S, y: 0.243 * S, mass: m, vx: 0.4662 * vS, vy: 0.4324 * vS },
      { x: 0.97 * S, y: -0.243 * S, mass: m, vx: 0.4662 * vS, vy: 0.4324 * vS },
      { x: 0, y: 0, mass: m, vx: -0.9324 * vS, vy: -0.8647 * vS },
    ];
  },
  trojan: (G) => {
    const M = 150, r1 = 30, r2 = 30;
    const v1 = Math.sqrt(G * M / r1);
    const v2_ = Math.sqrt(G * M / r2);
    const a4 = Math.PI / 3, a5 = -Math.PI / 3;
    return [
      { x: 0, y: 0, mass: M, vx: 0, vy: 0 },
      { x: r1, y: 0, mass: 8, vx: 0, vy: v1 },
      { x: r2 * Math.cos(a4), y: r2 * Math.sin(a4), mass: 8, vx: -v2_ * Math.sin(a4), vy: v2_ * Math.cos(a4) },
      { x: r2 * Math.cos(a5), y: r2 * Math.sin(a5), mass: 6, vx: -v2_ * Math.sin(a5), vy: v2_ * Math.cos(a5) },
    ];
  },
  runaway: (G) => [
    { x: -8, y: 0, mass: 100, vx: 0, vy: 0.5 },
    { x: 8, y: 0, mass: -100, vx: 0, vy: 0.5 },
  ],
  necklace: (G) => {
    const n = 6, m = 30, r = 30;
    let fSum = 0;
    for (let k = 1; k < n; k++) fSum += 1 / (2 * Math.sin(Math.PI * k / n));
    const v = Math.sqrt(G * m * fSum / r);
    const bodies = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      bodies.push({ x: r * Math.cos(a), y: r * Math.sin(a), mass: m, vx: -v * Math.sin(a), vy: v * Math.cos(a) });
    }
    return bodies;
  },
  intruder: (G) => {
    const sep = 25, m = 80;
    const v = Math.sqrt(G * m / (4 * (sep / 2)));
    return [
      { x: -sep / 2, y: 0, mass: m, vx: 0, vy: -v },
      { x: sep / 2, y: 0, mass: m, vx: 0, vy: v },
      { x: -50, y: 40, mass: -60, vx: 2.0, vy: -1.5 },
    ];
  },
  collapse: (G) => {
    const n = 5, m = 50, r = 35;
    const bodies = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      bodies.push({ x: r * Math.cos(a), y: r * Math.sin(a), mass: m, vx: 0, vy: 0 });
    }
    return bodies;
  },
  hierarchy: (G) => {
    const Ms = 150, Mp = 20, Mm = 2;
    const rp = 40, rm = 8;
    const vp = Math.sqrt(G * Ms / rp);
    const vm = Math.sqrt(G * Mp / rm);
    return [
      { x: 0, y: 0, mass: Ms, vx: 0, vy: 0 },
      { x: rp, y: 0, mass: Mp, vx: 0, vy: vp },
      { x: rp + rm, y: 0, mass: Mm, vx: 0, vy: vp + vm },
    ];
  },
};

// ── Simulation ──
class Simulation {
  constructor() {
    this.bodies = [];
    this.G = G_DEFAULT;
    this.paused = false;
    this.nextMass = 5;
    this.currentPreset = 'solar';
    this.colorIdx = 0;
    // Moved from globals (spec 4a)
    this.timeDilation = 1.0;
    this.gridSoftening = 2.0;
    this.boundaryR = 120;
  }

  step() {
    if (this.paused) return;
    const dt = DT * this.timeDilation;
    const n = this.bodies.length;
    for (let i = 0; i < n; i++) {
      const bi = this.bodies[i];
      let ax = 0, ay = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const bj = this.bodies[j];
        const dx = bj.x - bi.x, dy = bj.y - bi.y;
        const r2 = dx * dx + dy * dy + SOFTENING * SOFTENING;
        const r = Math.sqrt(r2);
        const f = this.G * bj.mass / (r * r * r);
        ax += f * dx; ay += f * dy;
      }
      bi.vx += ax * dt; bi.vy += ay * dt;
    }
    for (const b of this.bodies) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.r = Body.radius(b.mass);
      const d = Math.hypot(b.x, b.y);
      if (d > this.boundaryR) {
        const nx = b.x / d, ny = b.y / d;
        b.x = nx * this.boundaryR;
        b.y = ny * this.boundaryR;
        const vDotN = b.vx * nx + b.vy * ny;
        if (vDotN > 0) {
          b.vx -= (1 + BOUNCE_DAMP) * vDotN * nx;
          b.vy -= (1 + BOUNCE_DAMP) * vDotN * ny;
        }
        b.vx *= 0.5;
        b.vy *= 0.5;
      }
    }
  }

  addBody(x, y, mass, vx, vy) {
    this.bodies.push(new Body(x, y, mass ?? this.nextMass, vx || 0, vy || 0, this.colorIdx++));
  }

  removeBody(idx) {
    if (idx >= 0 && idx < this.bodies.length) this.bodies.splice(idx, 1);
  }

  reset() {
    this.bodies = [];
    this.colorIdx = 0;
  }

  loadPreset(name) {
    this.reset();
    this.currentPreset = name;
    const factory = PRESETS[name];
    if (factory) {
      for (const b of factory(this.G)) {
        this.addBody(b.x, b.y, b.mass, b.vx, b.vy);
      }
    }
  }
}
```

- [ ] **Step 2: Verify file is syntactically valid**

Run: `node -c src/simulation.js`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/simulation.js
git commit -m "refactor: extract Body, Simulation, PRESETS to src/simulation.js

Move timeDilation, gridSoftening, boundaryR, colorIdx into Simulation.
Convert presets from closures to data factories.
Unify Body.radius() as static method."
```

---

## Task 4: Extract renderer.js -- Renderer class with perf fixes

**Files:**
- Create: `src/renderer.js`

Extract Renderer class. Apply spec sections 2a (cache GL locations), 2b (pre-allocate body buffer), 4a (bodyFollowZ, zScale, curvatureExp into Renderer). Remove dead `_gridZ` method (spec section 5). Add shader error checking in `_mkProg`.

- [ ] **Step 1: Create `src/renderer.js`**

```js
class Renderer {
  constructor(sim) {
    this.sim = sim;
    this.canvas = document.getElementById('c');
    const gl = this.canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl) { alert('WebGL not supported'); return; }
    this.gl = gl;

    // Camera
    this.camPitch = 35 * Math.PI / 180;
    this.camYaw = -30 * Math.PI / 180;
    this.camDist = 100;
    this.camTarget = v3.create(0, 0, 0);
    this.edgeRefPhi = 0;

    // Display params (moved from globals, spec 4a)
    this.bodyFollowZ = true;
    this.zScale = 8.5;
    this.curvatureExp = 0.8;

    // Grid vertex data
    this.gridN = GRID_N;
    const gn1 = GRID_N + 1;
    this.gridVerts = new Float32Array(gn1 * gn1 * 3);

    // Build grid index arrays for lines
    const lineIndices = [];
    for (let i = 0; i <= GRID_N; i++) {
      for (let j = 0; j < GRID_N; j++) {
        lineIndices.push(i * gn1 + j, i * gn1 + j + 1);
        lineIndices.push(j * gn1 + i, (j + 1) * gn1 + i);
      }
    }
    this.gridLineCount = lineIndices.length;
    this.gridIndices = new Uint32Array(lineIndices);

    // Pre-allocated buffers (spec 2b)
    this._bodyCapacity = 64;
    this.bodyStaging = new Float32Array(this._bodyCapacity * 2 * 8);
    this._bodyZBuf = new Float32Array(this._bodyCapacity);

    this._initGL();
    this._initGridBuffers();
    this._initBodyBuffers();
  }

  _initGL() {
    const gl = this.gl;
    gl.clearColor(0.024, 0.024, 0.031, 1);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // ── Grid shader ──
    const gridVS = `
      attribute vec3 aPos;
      uniform mat4 uMVP;
      varying float vDepth;
      void main() {
        vDepth = aPos.z;
        gl_Position = uMVP * vec4(aPos, 1.0);
      }
    `;
    const gridFS = `
      precision mediump float;
      varying float vDepth;
      uniform float uMinZ;
      uniform float uMaxZ;
      void main() {
        vec3 base = vec3(0.15, 0.18, 0.25);
        vec3 wellCol = vec3(0.0, 0.6, 0.85);
        vec3 bumpCol = vec3(0.85, 0.4, 0.15);
        float wellI = clamp(-vDepth / (-uMinZ + 0.01), 0.0, 1.0);
        float bumpI = clamp(vDepth / (uMaxZ + 0.01), 0.0, 1.0);
        vec3 col = base;
        col = mix(col, wellCol, wellI);
        col = mix(col, bumpCol, bumpI);
        float alpha = 0.12 + 0.48 * max(wellI, bumpI);
        gl_FragColor = vec4(col, alpha);
      }
    `;
    this.gridProg = this._mkProg(gridVS, gridFS);

    // ── Body shader ──
    const bodyVS = `
      attribute vec3 aPos;
      attribute vec4 aColor;
      attribute float aSize;
      uniform mat4 uMVP;
      uniform float uScale;
      varying vec4 vColor;
      void main() {
        vColor = aColor;
        gl_Position = uMVP * vec4(aPos, 1.0);
        gl_PointSize = aSize * uScale / gl_Position.w;
      }
    `;
    const bodyFS = `
      precision mediump float;
      varying vec4 vColor;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float r = dot(c, c);
        if (r > 0.25) discard;
        float core = smoothstep(0.25, 0.01, r);
        float glow = smoothstep(0.25, 0.0, r) * 0.4;
        gl_FragColor = vec4(vColor.rgb * (core + glow), vColor.a * (core * 0.9 + glow));
      }
    `;
    this.bodyProg = this._mkProg(bodyVS, bodyFS);

    // ── Ring shader ──
    const ringVS = `
      attribute vec3 aPos;
      uniform mat4 uMVP;
      void main() {
        gl_Position = uMVP * vec4(aPos, 1.0);
      }
    `;
    const ringFS = `
      precision mediump float;
      void main() {
        gl_FragColor = vec4(0.45, 0.5, 0.6, 0.6);
      }
    `;
    this.ringProg = this._mkProg(ringVS, ringFS);

    // ── Cache GL locations (spec 2a) ──
    this.gridLocs = {
      aPos: gl.getAttribLocation(this.gridProg, 'aPos'),
      uMVP: gl.getUniformLocation(this.gridProg, 'uMVP'),
      uMinZ: gl.getUniformLocation(this.gridProg, 'uMinZ'),
      uMaxZ: gl.getUniformLocation(this.gridProg, 'uMaxZ'),
    };
    this.bodyLocs = {
      aPos: gl.getAttribLocation(this.bodyProg, 'aPos'),
      aColor: gl.getAttribLocation(this.bodyProg, 'aColor'),
      aSize: gl.getAttribLocation(this.bodyProg, 'aSize'),
      uMVP: gl.getUniformLocation(this.bodyProg, 'uMVP'),
      uScale: gl.getUniformLocation(this.bodyProg, 'uScale'),
    };
    this.ringLocs = {
      aPos: gl.getAttribLocation(this.ringProg, 'aPos'),
      uMVP: gl.getUniformLocation(this.ringProg, 'uMVP'),
    };

    // Boundary ring (dynamic)
    this.ringSegs = 128;
    this.ringVertCount = this.ringSegs + 1;
    this.ringVerts = new Float32Array(this.ringVertCount * 3);
    this.ringBuf = gl.createBuffer();
  }

  _mkProg(vs, fs) {
    const gl = this.gl;
    const v = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(v, vs); gl.compileShader(v);
    if (!gl.getShaderParameter(v, gl.COMPILE_STATUS))
      console.error('Vertex shader error:', gl.getShaderInfoLog(v));
    const f = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(f, fs); gl.compileShader(f);
    if (!gl.getShaderParameter(f, gl.COMPILE_STATUS))
      console.error('Fragment shader error:', gl.getShaderInfoLog(f));
    const p = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      console.error('Program link error:', gl.getProgramInfoLog(p));
    return p;
  }

  _initGridBuffers() {
    const gl = this.gl;
    this.gridVBuf = gl.createBuffer();
    this.gridIBuf = gl.createBuffer();
    gl.getExtension('OES_element_index_uint');
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.gridIBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.gridIndices, gl.STATIC_DRAW);
  }

  _initBodyBuffers() {
    const gl = this.gl;
    this.bodyBuf = gl.createBuffer();
  }

  _computeEdgeRefPhi() {
    const bodies = this.sim.bodies;
    const G = this.sim.G;
    const soft = this.sim.gridSoftening;
    const e = this.sim.boundaryR * 1.2;
    const p0 = rawPotential(e, 0, bodies, G, soft);
    const p1 = rawPotential(-e, 0, bodies, G, soft);
    const p2 = rawPotential(0, e, bodies, G, soft);
    const p3 = rawPotential(0, -e, bodies, G, soft);
    return (p0 + p1 + p2 + p3) / 4;
  }

  _updateGridVerts() {
    const gn1 = this.gridN + 1;
    this.gridExtent = Math.max(this.camDist * 0.55, this.sim.boundaryR);
    this.gridStep = (this.gridExtent * 2) / this.gridN;
    const bodies = this.sim.bodies;
    const G = this.sim.G;
    const soft = this.sim.gridSoftening;
    this.edgeRefPhi = this._computeEdgeRefPhi();

    for (let i = 0; i <= this.gridN; i++) {
      for (let j = 0; j <= this.gridN; j++) {
        const x = -this.gridExtent + j * this.gridStep;
        const y = -this.gridExtent + i * this.gridStep;
        const idx = (i * gn1 + j) * 3;
        this.gridVerts[idx] = x;
        this.gridVerts[idx + 1] = y;
        this.gridVerts[idx + 2] = mapPhi(rawPotential(x, y, bodies, G, soft) - this.edgeRefPhi, this.zScale, this.curvatureExp);
      }
    }
  }

  _updateRingVerts() {
    const bodies = this.sim.bodies;
    const G = this.sim.G;
    const soft = this.sim.gridSoftening;
    const boundaryR = this.sim.boundaryR;
    for (let i = 0; i <= this.ringSegs; i++) {
      const a = (i / this.ringSegs) * Math.PI * 2;
      const x = boundaryR * Math.cos(a);
      const y = boundaryR * Math.sin(a);
      const z = mapPhi(rawPotential(x, y, bodies, G, soft) - this.edgeRefPhi, this.zScale, this.curvatureExp);
      const idx = i * 3;
      this.ringVerts[idx] = x;
      this.ringVerts[idx + 1] = y;
      this.ringVerts[idx + 2] = z;
    }
  }

  getMVP() {
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const cy = Math.cos(this.camYaw), sy = Math.sin(this.camYaw);
    const eye = v3.create(
      this.camTarget[0] + this.camDist * cp * sy,
      this.camTarget[1] + this.camDist * cp * cy,
      this.camTarget[2] + this.camDist * sp
    );
    const view = mat4LookAt(eye, this.camTarget, v3.create(0, 0, 1));
    const aspect = this.w / this.h;
    const proj = mat4Perspective(Math.PI / 4, aspect, 0.1, Math.max(500, this.camDist * 4));
    return mat4Mul(proj, view);
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  unproject(mx, my) {
    const mvp = this.getMVP();
    const inv = mat4Inv(mvp);
    if (!inv) return null;
    const nx = (mx / this.w) * 2 - 1;
    const ny = 1 - (my / this.h) * 2;
    function up(zNdc) {
      const x = inv[0]*nx + inv[4]*ny + inv[8]*zNdc + inv[12];
      const y = inv[1]*nx + inv[5]*ny + inv[9]*zNdc + inv[13];
      const z = inv[2]*nx + inv[6]*ny + inv[10]*zNdc + inv[14];
      const w = inv[3]*nx + inv[7]*ny + inv[11]*zNdc + inv[15];
      return v3.create(x/w, y/w, z/w);
    }
    const near = up(-1), far = up(1);
    const dir = v3.sub(far, near);
    if (Math.abs(dir[2]) < 1e-6) return null;
    const t = -near[2] / dir[2];
    if (t < 0) return null;
    const hit = v3.add(near, v3.scale(dir, t));
    return { x: hit[0], y: hit[1] };
  }

  findBody(mx, my) {
    const hit = this.unproject(mx, my);
    if (!hit) return null;
    let best = -1, bestD = Infinity;
    for (let i = 0; i < this.sim.bodies.length; i++) {
      const b = this.sim.bodies[i];
      const d = Math.hypot(b.x - hit.x, b.y - hit.y);
      const thresh = Math.max(b.r * 2, 1.5);
      if (d < thresh && d < bestD) { best = i; bestD = d; }
    }
    return best >= 0 ? best : null;
  }

  render() {
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this._updateGridVerts();
    this._updateRingVerts();
    const mvp = this.getMVP();
    this._drawGrid(mvp);
    this._drawBoundary(mvp);
    this._drawBodies(mvp);
  }

  _drawGrid(mvp) {
    const gl = this.gl;
    const loc = this.gridLocs;
    gl.useProgram(this.gridProg);
    gl.uniformMatrix4fv(loc.uMVP, false, mvp);

    let minZ = 0, maxZ = 0;
    for (let i = 2; i < this.gridVerts.length; i += 3) {
      if (this.gridVerts[i] < minZ) minZ = this.gridVerts[i];
      if (this.gridVerts[i] > maxZ) maxZ = this.gridVerts[i];
    }
    gl.uniform1f(loc.uMinZ, minZ);
    gl.uniform1f(loc.uMaxZ, maxZ);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.gridVBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.gridVerts, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.gridIBuf);
    gl.drawElements(gl.LINES, this.gridLineCount, gl.UNSIGNED_INT, 0);
    gl.disableVertexAttribArray(loc.aPos);
  }

  _drawBoundary(mvp) {
    const gl = this.gl;
    const loc = this.ringLocs;
    gl.useProgram(this.ringProg);
    gl.uniformMatrix4fv(loc.uMVP, false, mvp);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ringBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.ringVerts, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(loc.aPos);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.LINE_LOOP, 0, this.ringVertCount);
    gl.disableVertexAttribArray(loc.aPos);
  }

  _drawBodies(mvp) {
    const gl = this.gl;
    const bodies = this.sim.bodies;
    if (!bodies.length) return;

    const loc = this.bodyLocs;
    gl.useProgram(this.bodyProg);
    gl.uniformMatrix4fv(loc.uMVP, false, mvp);
    gl.uniform1f(loc.uScale, this.canvas.height * 0.5);

    // Ensure staging buffers are large enough (spec 2b)
    if (bodies.length > this._bodyCapacity) {
      this._bodyCapacity = Math.max(this._bodyCapacity * 2, bodies.length);
      this.bodyStaging = new Float32Array(this._bodyCapacity * 2 * 8);
      this._bodyZBuf = new Float32Array(this._bodyCapacity);
    }

    const G = this.sim.G;
    const soft = this.sim.gridSoftening;
    const baseZ = 0;
    let off = 0;
    const buf = this.bodyStaging;

    // Compute body Z positions (reuse pre-allocated buffer)
    const bodyZ = this._bodyZBuf;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      bodyZ[i] = this.bodyFollowZ
        ? mapPhi(rawPotential(b.x, b.y, bodies, G, soft) - this.edgeRefPhi, this.zScale, this.curvatureExp)
        : baseZ;
    }

    // Pass 1: glow
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      const offset = b.mass >= 0 ? b.r : -b.r;
      buf[off++] = b.x; buf[off++] = b.y; buf[off++] = bodyZ[i] + offset;
      buf[off++] = b.color[0]*0.6; buf[off++] = b.color[1]*0.6; buf[off++] = b.color[2]*0.6; buf[off++] = 0.25;
      buf[off++] = b.r * 8;
    }
    // Pass 2: core
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      const offset = b.mass >= 0 ? b.r : -b.r;
      buf[off++] = b.x; buf[off++] = b.y; buf[off++] = bodyZ[i] + offset;
      buf[off++] = b.color[0]; buf[off++] = b.color[1]; buf[off++] = b.color[2]; buf[off++] = 0.95;
      buf[off++] = b.r * 3.5;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bodyBuf);
    gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, off), gl.DYNAMIC_DRAW);

    const stride = 32;
    gl.enableVertexAttribArray(loc.aPos);
    gl.enableVertexAttribArray(loc.aColor);
    gl.enableVertexAttribArray(loc.aSize);
    gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, stride, 0);
    gl.vertexAttribPointer(loc.aColor, 4, gl.FLOAT, false, stride, 12);
    gl.vertexAttribPointer(loc.aSize, 1, gl.FLOAT, false, stride, 28);

    gl.depthMask(false);
    gl.drawArrays(gl.POINTS, 0, bodies.length * 2);
    gl.depthMask(true);

    gl.disableVertexAttribArray(loc.aPos);
    gl.disableVertexAttribArray(loc.aColor);
    gl.disableVertexAttribArray(loc.aSize);
  }
}
```

Note: `_gridZ()` is intentionally omitted (dead code, spec section 5).

- [ ] **Step 2: Verify file is syntactically valid**

Run: `node -c src/renderer.js`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer.js
git commit -m "refactor: extract Renderer to src/renderer.js

Cache GL uniform/attribute locations (perf 2a).
Pre-allocate body staging buffer (perf 2b).
Move bodyFollowZ, zScale, curvatureExp into Renderer.
Add shader compile error logging.
Remove unused _gridZ() method."
```

---

## Task 5: Extract ui.js -- HUD, sliders, toggles, toast

**Files:**
- Create: `src/ui.js`

Extract UI functions. Apply spec 2d (targeted HUD DOM updates) and 3b (panel toggle dedup).

- [ ] **Step 1: Create `src/ui.js`**

```js
// ── HUD (spec 2d: targeted DOM updates) ──
let _hudBodyEls = [];
let _hudBodyCount = -1;

function updateHUD(sim) {
  document.getElementById('s-n').textContent = sim.bodies.length;
  document.getElementById('s-g').textContent = sim.G.toFixed(3);
  const st = document.getElementById('s-st');
  st.textContent = sim.paused ? 'paused' : 'running';
  st.className = 'val ' + (sim.paused ? 'off' : 'on');
  const dot = document.getElementById('pulse-dot');
  dot.className = 'pulse-dot' + (sim.paused ? ' paused' : '');

  const list = document.getElementById('body-list');
  if (!sim.bodies.length) {
    list.innerHTML = '<span style="color:var(--hud-dim)">-- empty --</span>';
    _hudBodyEls = [];
    _hudBodyCount = 0;
    return;
  }

  // Rebuild DOM elements only when body count changes
  if (sim.bodies.length !== _hudBodyCount) {
    _hudBodyCount = sim.bodies.length;
    list.innerHTML = '';
    _hudBodyEls = [];
    for (let i = 0; i < sim.bodies.length; i++) {
      const b = sim.bodies[i];
      const row = document.createElement('div');
      row.className = 'body-row';

      const pip = document.createElement('span');
      pip.className = 'body-pip';
      pip.style.background = b.hex;
      pip.style.boxShadow = '0 0 6px ' + b.hex;

      const idx = document.createElement('span');
      idx.style.color = b.hex;
      idx.textContent = i;

      const massSpan = document.createElement('span');
      const velSpan = document.createElement('span');
      velSpan.style.color = 'var(--hud-dim)';

      row.appendChild(pip);
      row.appendChild(idx);
      row.appendChild(massSpan);
      row.appendChild(velSpan);
      list.appendChild(row);

      _hudBodyEls.push({ massSpan, velSpan, pip, idx: idx });
    }
  }

  // Update only changing values
  for (let i = 0; i < sim.bodies.length; i++) {
    const b = sim.bodies[i];
    const el = _hudBodyEls[i];
    if (!el) continue;
    el.massSpan.textContent = 'm=' + b.mass.toFixed(1);
    el.velSpan.textContent = 'v=' + Math.hypot(b.vx, b.vy).toFixed(1);
    // Update color in case body order shifted after removal
    el.pip.style.background = b.hex;
    el.pip.style.boxShadow = '0 0 6px ' + b.hex;
    el.idx.style.color = b.hex;
    el.idx.textContent = i;
  }
}

// ── Toast ──
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1000);
}

// ── Slider binding ──
function bindSlider(id, valId, fmt, onChange) {
  const sl = document.getElementById(id);
  const vl = document.getElementById(valId);
  sl.addEventListener('input', () => { const v = parseFloat(sl.value); vl.textContent = fmt(v); onChange(v); });
  sl.addEventListener('wheel', e => {
    e.preventDefault();
    const step = parseFloat(sl.step) || 1;
    const delta = e.deltaY < 0 ? step : -step;
    const min = parseFloat(sl.min), max = parseFloat(sl.max);
    sl.value = Math.max(min, Math.min(max, parseFloat(sl.value) + delta));
    sl.dispatchEvent(new Event('input'));
  }, { passive: false });
  return sl;
}

function syncSliders(sim) {
  document.getElementById('mass-slider').value = sim.nextMass;
  document.getElementById('mass-val').textContent = sim.nextMass.toFixed(1);
  document.getElementById('g-slider').value = sim.G;
  document.getElementById('g-val').textContent = sim.G.toFixed(3);
}

// ── Mobile panel toggle (spec 3b) ──
function toggleMobilePanel(panelId, btnId, otherPanelId, otherBtnId) {
  document.getElementById(panelId).classList.toggle('mobile-open');
  document.getElementById(btnId).classList.toggle('active');
  document.getElementById(otherPanelId).classList.remove('mobile-open');
  document.getElementById(otherBtnId).classList.remove('active');
}
```

- [ ] **Step 2: Verify file is syntactically valid**

Run: `node -c src/ui.js`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/ui.js
git commit -m "refactor: extract UI to src/ui.js

Targeted HUD DOM updates (perf 2d).
Deduplicate mobile panel toggle (dedup 3b).
syncSliders now takes sim parameter."
```

---

## Task 6: Extract input.js -- mouse, touch, keyboard handlers

**Files:**
- Create: `src/input.js`

Extract all input handling. Apply spec 3a (unified addBodyAtScreen helper).

- [ ] **Step 1: Create `src/input.js`**

```js
// ── Shared helper (spec 3a) ──
function addBodyAtScreen(clientX, clientY, sim, renderer) {
  const hit = renderer.unproject(clientX, clientY);
  if (hit && Math.hypot(hit.x, hit.y) < sim.boundaryR) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 8;
    sim.addBody(hit.x, hit.y, undefined, speed * Math.cos(angle), speed * Math.sin(angle));
  }
}

function initInput(sim, ren) {
  // ── Keyboard ──
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    switch (e.key) {
      case ' ': e.preventDefault(); sim.paused = !sim.paused; toast(sim.paused ? 'PAUSED' : 'RUNNING'); break;
      case 'r': case 'R': sim.loadPreset(sim.currentPreset); toast('RESET'); break;
      case 'G': sim.G = Math.min(sim.G + 1, 50); syncSliders(sim); break;
      case 'g': sim.G = Math.max(sim.G - 1, -50); syncSliders(sim); break;
      case '=': case '+': sim.nextMass = Math.min(sim.nextMass + 1, 200); syncSliders(sim); break;
      case '-': sim.nextMass = Math.max(sim.nextMass - 1, -200); syncSliders(sim); break;
    }
  });

  // ── Mouse ──
  let isDragging = false;
  let lastMouse = null;

  ren.canvas.addEventListener('mousedown', e => {
    if (e.button === 0) { isDragging = false; lastMouse = [e.clientX, e.clientY]; }
  });

  ren.canvas.addEventListener('mousemove', e => {
    if (lastMouse && e.buttons & 1) {
      const dx = e.clientX - lastMouse[0];
      const dy = e.clientY - lastMouse[1];
      if (!isDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) isDragging = true;
      if (isDragging) {
        ren.camYaw += dx * 0.005;
        ren.camPitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, ren.camPitch + dy * 0.005));
      }
      lastMouse = [e.clientX, e.clientY];
    }
  });

  ren.canvas.addEventListener('mouseup', e => {
    if (e.button === 0 && !isDragging) addBodyAtScreen(e.clientX, e.clientY, sim, ren);
    lastMouse = null; isDragging = false;
  });

  ren.canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    const idx = ren.findBody(e.clientX, e.clientY);
    if (idx !== null) sim.removeBody(idx);
  });

  ren.canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.08 : 0.92;
    ren.camDist = Math.max(25, Math.min(300, ren.camDist * factor));
  }, { passive: false });

  // ── Touch ──
  const LONG_PRESS_MS = 500;
  const TAP_MOVE_THRESH = 10;
  let touchStartPos = null;
  let touchStartTime = 0;
  let touchMoved = false;
  let longPressTimer = null;
  let longPressFired = false;
  let pinchStartDist = 0;
  let pinchStartCamDist = 0;

  function getTouchDist(t1, t2) {
    return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  }

  function showLongPressIndicator(x, y) {
    const el = document.getElementById('longpress-indicator');
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.display = 'block';
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'lp-ring 0.5s ease-out forwards';
  }

  function hideLongPressIndicator() {
    document.getElementById('longpress-indicator').style.display = 'none';
  }

  function clearLongPress() {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    hideLongPressIndicator();
  }

  ren.canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (e.touches.length === 2) {
      clearLongPress();
      pinchStartDist = getTouchDist(e.touches[0], e.touches[1]);
      pinchStartCamDist = ren.camDist;
      return;
    }
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStartPos = [t.clientX, t.clientY];
    lastMouse = [t.clientX, t.clientY];
    touchStartTime = Date.now();
    touchMoved = false;
    isDragging = false;
    longPressFired = false;

    longPressTimer = setTimeout(() => {
      if (!touchMoved) {
        longPressFired = true;
        const idx = ren.findBody(touchStartPos[0], touchStartPos[1]);
        if (idx !== null) {
          sim.removeBody(idx);
          showLongPressIndicator(touchStartPos[0], touchStartPos[1]);
          setTimeout(hideLongPressIndicator, 600);
          toast('REMOVED');
        }
      }
    }, LONG_PRESS_MS);
  }, { passive: false });

  ren.canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 2) {
      clearLongPress();
      const dist = getTouchDist(e.touches[0], e.touches[1]);
      const ratio = pinchStartDist / dist;
      ren.camDist = Math.max(25, Math.min(300, pinchStartCamDist * ratio));
      return;
    }
    if (e.touches.length !== 1 || !touchStartPos) return;
    const t = e.touches[0];
    const dx = t.clientX - lastMouse[0];
    const dy = t.clientY - lastMouse[1];
    const totalDx = t.clientX - touchStartPos[0];
    const totalDy = t.clientY - touchStartPos[1];

    if (!touchMoved && (Math.abs(totalDx) > TAP_MOVE_THRESH || Math.abs(totalDy) > TAP_MOVE_THRESH)) {
      touchMoved = true;
      isDragging = true;
      clearLongPress();
    }

    if (isDragging) {
      ren.camYaw += dx * 0.005;
      ren.camPitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, ren.camPitch + dy * 0.005));
    }
    lastMouse = [t.clientX, t.clientY];
  }, { passive: false });

  ren.canvas.addEventListener('touchend', e => {
    e.preventDefault();
    clearLongPress();
    if (longPressFired) { touchStartPos = null; return; }
    if (touchStartPos && !touchMoved && e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      if (Date.now() - touchStartTime < LONG_PRESS_MS) {
        addBodyAtScreen(t.clientX, t.clientY, sim, ren);
      }
    }
    touchStartPos = null; lastMouse = null; isDragging = false;
  }, { passive: false });

  ren.canvas.addEventListener('touchcancel', e => {
    clearLongPress();
    touchStartPos = null; lastMouse = null; isDragging = false;
  }, { passive: false });

  // ── Mobile buttons ──
  document.getElementById('toggle-params').addEventListener('click', () => {
    toggleMobilePanel('params-panel', 'toggle-params', 'body-panel', 'toggle-bodies');
  });
  document.getElementById('toggle-bodies').addEventListener('click', () => {
    toggleMobilePanel('body-panel', 'toggle-bodies', 'params-panel', 'toggle-params');
  });
  document.getElementById('mobile-pause').addEventListener('click', () => {
    sim.paused = !sim.paused;
    toast(sim.paused ? 'PAUSED' : 'RUNNING');
  });
  document.getElementById('mobile-reset').addEventListener('click', () => {
    sim.loadPreset(sim.currentPreset);
    toast('RESET');
  });

  // Close panels when tapping canvas on mobile
  const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (isTouchDevice) {
    ren.canvas.addEventListener('touchstart', () => {
      document.getElementById('params-panel').classList.remove('mobile-open');
      document.getElementById('body-panel').classList.remove('mobile-open');
      document.getElementById('toggle-params').classList.remove('active');
      document.getElementById('toggle-bodies').classList.remove('active');
    });
  }

  // Prevent pull-to-refresh
  document.body.addEventListener('touchmove', e => {
    if (e.target === ren.canvas || e.target === document.body) e.preventDefault();
  }, { passive: false });
}
```

- [ ] **Step 2: Verify file is syntactically valid**

Run: `node -c src/input.js`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/input.js
git commit -m "refactor: extract input handlers to src/input.js

Unify add-body logic into addBodyAtScreen() helper (dedup 3a).
Encapsulate all mouse/touch/keyboard state in initInput()."
```

---

## Task 7: Extract main.js -- boot sequence and game loop

**Files:**
- Create: `src/main.js`

Wire everything together: create Simulation and Renderer, bind sliders, start the loop.

- [ ] **Step 1: Create `src/main.js`**

```js
// ── Boot ──
const sim = new Simulation();
const ren = new Renderer(sim);

sim.loadPreset('solar');

function onResize() { ren.resize(); }
window.addEventListener('resize', onResize);
onResize();

// ── Preset buttons ──
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const name = btn.dataset.p;
    sim.loadPreset(name);
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    toast(name.toUpperCase());
  });
});

// ── Sliders ──
bindSlider('mass-slider', 'mass-val', v => v.toFixed(1), v => { sim.nextMass = v; });
bindSlider('g-slider', 'g-val', v => v.toFixed(3), v => { sim.G = v; });
bindSlider('time-slider', 'time-val', v => v.toFixed(1) + 'x', v => { sim.timeDilation = v; });
bindSlider('curve-slider', 'curve-val', v => v.toFixed(2), v => { ren.curvatureExp = v; });
bindSlider('soften-slider', 'soften-val', v => v.toFixed(1), v => { sim.gridSoftening = v; });

// ── Boundary size buttons ──
document.querySelectorAll('.boundary-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    sim.boundaryR = Number(btn.dataset.r);
    document.querySelectorAll('.boundary-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    sim.loadPreset(sim.currentPreset);
  });
});

// ── Body Z toggle ──
document.getElementById('body-z-toggle').addEventListener('click', function() {
  ren.bodyFollowZ = !ren.bodyFollowZ;
  this.classList.toggle('on', ren.bodyFollowZ);
  document.getElementById('body-z-status').textContent = ren.bodyFollowZ ? 'on' : 'off';
});

// ── Advanced params expand/collapse ──
document.getElementById('params-expand').addEventListener('click', function() {
  const adv = document.getElementById('params-advanced');
  const open = adv.classList.toggle('open');
  this.textContent = open ? '- advanced' : '+ advanced';
});

// ── Input ──
initInput(sim, ren);

// ── Loop ──
let lastHud = 0;
function loop(t) {
  for (let i = 0; i < STEPS_PER_FRAME; i++) sim.step();
  ren.render();
  if (t - lastHud > 100) { updateHUD(sim); lastHud = t; }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
```

- [ ] **Step 2: Verify file is syntactically valid**

Run: `node -c src/main.js`
Expected: no errors

- [ ] **Step 3: Test in browser**

Run: `python -m http.server 8765`

Open `http://localhost:8765` in browser. Verify:
- Solar preset loads with 4 bodies orbiting
- Clicking adds bodies, right-click removes
- Camera drag/zoom works
- All sliders functional
- Preset buttons switch correctly
- Mobile toggles work (test with dev tools responsive mode)
- Body list panel updates
- Pause/resume with spacebar

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "refactor: extract boot/loop to src/main.js

Slider callbacks now target sim/ren properties.
All modules wired together and functional."
```

---

## Task 8: Build script and cleanup

**Files:**
- Create: `build.js`
- Delete: `gravity3d.py`
- Modify: `.gitignore`

- [ ] **Step 1: Create `build.js`**

```js
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Inline CSS: replace <link rel="stylesheet" href="src/style.css"> with <style>...</style>
html = html.replace(
  /<link\s+rel="stylesheet"\s+href="src\/style\.css"\s*\/?>/,
  '<style>\n' + fs.readFileSync(path.join(SRC, 'style.css'), 'utf8') + '</style>'
);

// Inline JS: collect all <script src="src/..."> tags, replace with single <script>
const scripts = [...html.matchAll(/<script\s+src="src\/([^"]+)"><\/script>/g)].map(m => m[1]);

if (scripts.length > 0) {
  const combined = scripts
    .map(name => fs.readFileSync(path.join(SRC, name), 'utf8'))
    .join('\n\n');

  // Replace first script tag with combined, remove the rest
  let first = true;
  html = html.replace(/<script\s+src="src\/[^"]+"><\/script>/g, () => {
    if (first) { first = false; return '<script>\n' + combined + '\n</script>'; }
    return '';
  });

  // Clean up blank lines left by removed tags
  html = html.replace(/\n{3,}/g, '\n\n');
}

const dist = path.join(ROOT, 'dist');
if (!fs.existsSync(dist)) fs.mkdirSync(dist);
fs.writeFileSync(path.join(dist, 'index.html'), html, 'utf8');

console.log('Built dist/index.html (' + Math.round(html.length / 1024) + ' KB)');
```

- [ ] **Step 2: Run build and verify**

Run: `node build.js`
Expected: prints `Built dist/index.html (XX KB)`

Run: `python -m http.server 8765 -d dist`
Open `http://localhost:8765` -- verify identical behavior to dev mode.

- [ ] **Step 3: Delete `gravity3d.py`**

Run: `rm gravity3d.py`

- [ ] **Step 4: Update `.gitignore`**

Add `dist/` to `.gitignore`.

- [ ] **Step 5: Commit**

```bash
git add build.js .gitignore
git rm gravity3d.py
git commit -m "feat: add build script, remove dead gravity3d.py

node build.js inlines src/ into dist/index.html.
Add dist/ to .gitignore."
```

---

## Task 9: Grid distance cutoff optimization (spec 2c)

**Files:**
- Modify: `src/math.js`

This is the performance optimization that intentionally changes visual output slightly (sub-threshold). Implemented as a separate task for clean verification.

- [ ] **Step 1: Add cutoff-aware rawPotential variant to `src/math.js`**

Add this function after `rawPotential`:

```js
// Optimized rawPotential with distance cutoff (spec 2c).
// cutoffs[i] = squared cutoff radius for bodies[i], pre-computed per frame.
// Bodies beyond cutoff contribute negligibly and are skipped.
function rawPotentialCutoff(x, y, bodies, G, softening, cutoffs) {
  let phi = 0;
  const s2 = softening * softening;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    const dx = x - b.x, dy = y - b.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > cutoffs[i]) continue;
    const r = Math.sqrt(d2 + s2);
    phi -= G * b.mass / r;
  }
  return phi;
}

// Compute squared cutoff radii for each body.
// cutoffR = 5 * softening * sqrt(|mass|); store squared.
function computeCutoffs(bodies, softening) {
  const cutoffs = new Float64Array(bodies.length);
  for (let i = 0; i < bodies.length; i++) {
    const cr = 5 * softening * Math.sqrt(Math.abs(bodies[i].mass));
    cutoffs[i] = cr * cr;
  }
  return cutoffs;
}
```

- [ ] **Step 2: Use cutoff variant in Renderer grid computation**

In `src/renderer.js`, modify `_updateGridVerts` to compute cutoffs once and use `rawPotentialCutoff`:

Replace the grid loop section in `_updateGridVerts` with:

```js
  _updateGridVerts() {
    const gn1 = this.gridN + 1;
    this.gridExtent = Math.max(this.camDist * 0.55, this.sim.boundaryR);
    this.gridStep = (this.gridExtent * 2) / this.gridN;
    const bodies = this.sim.bodies;
    const G = this.sim.G;
    const soft = this.sim.gridSoftening;
    this.edgeRefPhi = this._computeEdgeRefPhi();

    // Pre-compute cutoffs once per frame (spec 2c)
    const cutoffs = computeCutoffs(bodies, soft);

    for (let i = 0; i <= this.gridN; i++) {
      for (let j = 0; j <= this.gridN; j++) {
        const x = -this.gridExtent + j * this.gridStep;
        const y = -this.gridExtent + i * this.gridStep;
        const idx = (i * gn1 + j) * 3;
        this.gridVerts[idx] = x;
        this.gridVerts[idx + 1] = y;
        this.gridVerts[idx + 2] = mapPhi(rawPotentialCutoff(x, y, bodies, G, soft, cutoffs) - this.edgeRefPhi, this.zScale, this.curvatureExp);
      }
    }
  }
```

Note: `_computeEdgeRefPhi`, `_updateRingVerts`, and body Z computation continue to use the original `rawPotential` (no cutoff) since those are cheap operations where accuracy matters more.

- [ ] **Step 3: Visual verification**

Run: `python -m http.server 8765`
Open `http://localhost:8765`. Load each preset. Verify no visible difference from before this task. Add 15-20 bodies and confirm smooth frame rate.

- [ ] **Step 4: Commit**

```bash
git add src/math.js src/renderer.js
git commit -m "perf: add distance cutoff to grid potential computation

Skip bodies beyond 5*softening*sqrt(|mass|) for grid cells.
Reduces O(cells*N) to O(cells*k) for spread-out bodies."
```

---

## Task 10: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Update to reflect the new structure. Key changes:
- Quick Reference: add `node build.js` for building, keep dev server command
- Architecture: document `src/` file breakdown and their responsibilities
- Fix "150x150" to "200x200"
- Remove references to `gravity3d.py`
- Note that `potential()` and `_gridZ()` were removed
- Document `rawPotentialCutoff` and `computeCutoffs` in math.js
- Note globals moved to Simulation/Renderer properties
- Document build script and `dist/` output

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for modular restructure

Reflect src/ file structure, build process, removed dead code,
state ownership changes, and performance optimizations."
```

---

## Verification Checklist

After all tasks are complete, run through these checks:

- [ ] `node build.js` produces `dist/index.html` without errors
- [ ] Dev mode (`python -m http.server 8765` from root) loads and runs correctly
- [ ] Built mode (`python -m http.server 8765 -d dist`) loads and runs identically
- [ ] All 9 presets load correctly
- [ ] Click to add, right-click to remove bodies
- [ ] Camera orbit, zoom, pitch all work
- [ ] All sliders (mass, gravity, time, curve, soften) functional
- [ ] Boundary size buttons reload preset
- [ ] Body Z toggle works
- [ ] Mobile: touch tap/drag/pinch/long-press all work
- [ ] Mobile: panel toggles open/close correctly
- [ ] 20+ bodies run at smooth frame rate
- [ ] `gravity3d.py` is gone
- [ ] `dist/` is in `.gitignore`
