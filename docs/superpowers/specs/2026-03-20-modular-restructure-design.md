# Gravity3D Modular Restructure & Performance Design

**Date:** 2026-03-20
**Scope:** Split single-file app into modules, fix performance bottlenecks, deduplicate code, clean up state management. Target: smooth 20-30 body simulations.

---

## 1. File Structure & Build

### Target layout

```
gravity3d_free/
  src/
    style.css          -- all CSS extracted from inline <style>
    math.js            -- v3 vector ops, mat4 helpers, mapPhi, rawPotential
    simulation.js      -- Body class, Simulation class, PRESETS config
    renderer.js        -- Renderer class (WebGL, shaders, grid, ring, bodies)
    ui.js              -- HUD updates, slider bindings, panel toggles, toast
    input.js           -- mouse + touch handlers, unified add-body helper
    main.js            -- boot: create sim/renderer, wire UI/input, start loop
  index.html           -- minimal shell: <link> to CSS, DOM elements, <script> tags
  build.js             -- Node script: inlines CSS + JS into single HTML
  dist/
    index.html         -- single-file deployable output
```

### Build script (`build.js`)

- Node.js, zero external dependencies
- Reads `index.html`, finds `<link rel="stylesheet" href="src/style.css">` and `<script src="src/*.js">` tags
- Replaces `<link>` with `<style>` containing file contents
- Replaces all `<script src>` tags with a single `<script>` containing concatenated JS in order
- Outputs to `dist/index.html`
- Run: `node build.js`

### Module loading (dev mode)

Plain `<script>` tags in dependency order (no ES modules, no bundler). Order:

1. `math.js` (no dependencies)
2. `simulation.js` (no load-order dependency on math.js -- presets use only `Math.sqrt` and `G`; listed after math.js for conceptual clarity)
3. `renderer.js` (depends on math.js, simulation.js)
4. `ui.js` (depends on simulation.js, renderer.js)
5. `input.js` (depends on simulation.js, renderer.js, ui.js)
6. `main.js` (depends on all above)

Dev server: `python -m http.server 8765` (unchanged)

---

## 2. Performance Fixes

### 2a. Cache GL uniform/attribute locations

**Problem:** `getUniformLocation` and `getAttribLocation` called every frame in `_drawGrid`, `_drawBoundary`, `_drawBodies`. These are string-based lookups that return stable values.

**Fix:** After each program is created in `_initGL()`, cache all locations into objects:

```js
this.gridLocs = {
  aPos: gl.getAttribLocation(this.gridProg, 'aPos'),
  uMVP: gl.getUniformLocation(this.gridProg, 'uMVP'),
  uMinZ: gl.getUniformLocation(this.gridProg, 'uMinZ'),
  uMaxZ: gl.getUniformLocation(this.gridProg, 'uMaxZ'),
};
// Same for bodyLocs, ringLocs
```

Draw methods use cached locations directly.

### 2b. Pre-allocate body draw buffer

**Problem:** `_drawBodies` builds a JS `Array` with `.push()`, then creates a new `Float32Array` every frame. For N bodies: 2*N*8 floats allocated and GC'd per frame.

**Fix:** Pre-allocate a JS-side staging `Float32Array` as a class field (64 bodies * 2 passes * 8 floats = 1024 floats). Write directly into it with an offset counter. Only reallocate if body count exceeds capacity (doubling strategy). Upload only the used portion to GL via `gl.bufferData(gl.ARRAY_BUFFER, this.bodyStaging.subarray(0, usedFloats), gl.DYNAMIC_DRAW)`.

### 2c. Grid computation -- skip distant bodies

**Problem:** `_updateGridVerts` is O(grid_cells * bodies) per frame. At 200x200 grid = 40,401 cells, each calling `rawPotential` which loops all bodies. With 20-30 bodies this is 800K-1.2M iterations per frame.

**Fix:** Distance cutoff in `rawPotential`. For each body, compute a contribution radius: `cutoffR = 5 * GRID_SOFTENING * sqrt(|mass|)`. Skip bodies where `dx*dx + dy*dy > cutoffR*cutoffR`. The Plummer-softened potential falls off as ~1/r; beyond this radius the contribution is below visual threshold on the grid.

**Note:** This is an approximation that changes visual output slightly (very distant bodies' tiny contributions are dropped). The cutoff threshold is chosen to be visually imperceptible, but the result is not pixel-identical to the unoptimized version. Verification: compare side-by-side with the same preset at 5-10 bodies and confirm no visible difference before increasing body count.

Implementation: compute cutoff radii once per frame into a reusable array (recomputed only when body count or masses change). Pass to `rawPotential` as an additional parameter.

Same optimization applies to `_computeEdgeRefPhi` (4 sample points) and `_updateRingVerts` (128 points), though those are already cheap.

### 2d. Targeted HUD DOM updates

**Problem:** `updateHUD` rebuilds the entire body list via `innerHTML` every 100ms. For 20-30 bodies, this creates and destroys ~60-90 DOM elements per second.

**Fix:**
- Track last known body count
- On count change: rebuild DOM elements, store references in an array
- On count unchanged: update only `textContent` of mass/velocity spans
- Body color pips and indices are stable -- only velocity changes per frame

---

## 3. Code Reuse & Deduplication

### 3a. Unified add-body-at-screen helper

Duplicated in `mouseup` handler (line 1536-1541) and `touchend` handler (line 1669-1674).

Extract to `input.js`:
```js
function addBodyAtScreen(clientX, clientY, sim, renderer) {
  const hit = renderer.unproject(clientX, clientY);
  if (hit && Math.hypot(hit.x, hit.y) < sim.boundaryR) {  // requires section 4a (BOUNDARY_R -> sim.boundaryR)
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 8;
    sim.addBody(hit.x, hit.y, undefined, speed * Math.cos(angle), speed * Math.sin(angle));
  }
}
```

### 3b. Panel toggle deduplication

Mobile toggle handlers for params/bodies panels (lines 1690-1708) are mirror images.

Extract to `ui.js`:
```js
function toggleMobilePanel(panelId, btnId, otherPanelId, otherBtnId) {
  document.getElementById(panelId).classList.toggle('mobile-open');
  document.getElementById(btnId).classList.toggle('active');
  document.getElementById(otherPanelId).classList.remove('mobile-open');
  document.getElementById(otherBtnId).classList.remove('active');
}
```

### 3c. Body radius calculation

Computed in `Body` constructor (line 832: `max(0.2, 0.65 * cbrt(|mass|))`) and overwritten every frame in `Simulation.step()` (line 867: `max(0.15, 0.5 * cbrt(|mass|))`). The constructor value is immediately stale.

Fix: Remove from constructor. Add a static method `Body.radius(mass)` using the step values. Call from `step()` and from `Body` constructor (with same constants).

---

## 4. State Hygiene

### 4a. Move globals into owning classes

Current globals and their new homes:

| Global | New owner | Rationale |
|--------|-----------|-----------|
| `timeDilation` | `Simulation` | Affects physics step |
| `GRID_SOFTENING` | `Simulation` | Physics parameter |
| `BOUNDARY_R` | `Simulation` | Physics boundary + ring geometry |
| `bodyFollowZ` | `Renderer` | Display-only toggle |
| `CURVATURE_EXP` | `Renderer` | Display mapping parameter |
| `Z_SCALE` | `Renderer` | Display mapping parameter |
| `colorIdx` | `Simulation` | Manages body creation |

`PHI_SCALE`, `MAX_WELL_DEPTH` stay as module-level constants (they don't change at runtime).

UI handlers change from `timeDilation = v` to `sim.timeDilation = v`.

`mapPhi` and `rawPotential` currently read `GRID_SOFTENING`, `Z_SCALE`, `CURVATURE_EXP`, `PHI_SCALE`, `MAX_WELL_DEPTH` as globals. After the move, both become explicit-parameter functions in `math.js`:
- `rawPotential(x, y, bodies, G, softening)` -- takes softening as parameter
- `mapPhi(phi, zScale, curvatureExp)` -- takes display params explicitly

Since both live in `math.js` (a stateless utility module), they must not hold references to `Renderer` or `Simulation`. Callers in `Renderer` pass `this.zScale`, `this.curvatureExp`, etc.

### 4b. Presets as data objects

Current presets are closures inside `loadPreset()` that call `this.addBody` with computed velocities.

Convert to a `PRESETS` const in `simulation.js`:
```js
const PRESETS = {
  solar: (G) => [
    { x: 0, y: 0, mass: 150, vx: 0, vy: 0 },
    { x: 20, y: 0, mass: 6, vx: 0, vy: Math.sqrt(G * 150 / 20) },
    // ...
  ],
  // ...
};
```

Factory functions receive `G` so velocities can be computed. The new `loadPreset`:
```js
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
```

---

## 5. Cleanup

- **Remove `gravity3d.py`** -- confirmed dead code
- **Remove `potential()` function** (line 819-821) -- unused convenience wrapper noted in CLAUDE.md
- **Remove `_gridZ()` method** (lines 1175-1190) -- bilinear interpolation defined but never called. If body-follows-mesh needs it later, it can be re-added
- **Add shader compile error checking** in `_mkProg` (dev mode only): log `gl.getShaderInfoLog` on compile failure
- **Update CLAUDE.md** to reflect new file structure, build process, removed files, and module boundaries. Also fix existing inaccuracy: CLAUDE.md says "150x150 wireframe grid" but code uses `GRID_N = 200` (200x200)
- **Add `.gitignore` entry** for `dist/` (generated output)

---

## Non-goals (explicitly excluded)

- ES modules / bundler toolchain
- Event system between Simulation and UI
- Input handler class abstraction
- Renderer state machine refactor
- GPU-based grid computation
- Any new features

---

## Risk & Rollback

The refactored code must be functionally identical to the current `index.html` for all changes **except** section 2c (distance cutoff optimization), which intentionally drops sub-visual-threshold contributions for performance. Verification:
- Sections 1-4 (excluding 2c): run refactored code and original side by side, same preset -- behavior and visuals must be identical
- Section 2c: compare with 5-10 bodies and confirm no visible difference before enabling for higher body counts

If the build script introduces issues, the original `index.html` remains in git history as the rollback target.
