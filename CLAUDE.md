# Gravity3D - Spacetime Curvature Simulator

## Quick Reference
- Dev: `python -m http.server 8765` then open `http://localhost:8765`
- Build: `node build.js` -> outputs `dist/index.html` (single-file for deployment)
- Zero runtime dependencies; build requires Node.js only

## File Structure
- `index.html` -- minimal shell: DOM only, links to src/ files
- `src/style.css` -- all CSS
- `src/math.js` -- constants, v3, mat4*, mapPhi, rawPotential, rawPotentialCutoff, computeCutoffs
- `src/simulation.js` -- Body (with static radius()), Simulation, PRESETS factories
- `src/renderer.js` -- Renderer class (WebGL setup, grid, ring, body rendering)
- `src/ui.js` -- updateHUD, toast, bindSlider, syncSliders, toggleMobilePanel
- `src/input.js` -- mouse/touch/keyboard handlers, addBodyAtScreen helper
- `src/main.js` -- boot: create sim/ren, wire sliders/buttons, start loop
- `build.js` -- inlines src/ CSS+JS into dist/index.html
- `dist/` -- build output (gitignored)

## Architecture
- Classes: `Body`, `Simulation` (2D N-body physics), `Renderer` (WebGL 3D)
- 2D physics (x,y) with Z axis visualizing gravitational potential wells
- 200x200 wireframe grid deformed by potential; pow-of-log Z mapping: `sign * Z_SCALE * pow(log(1+|phi|/PHI_SCALE), CURVATURE_EXP)`
- Grid extent scales with `camDist * 0.55` (scale-independent density)
- Negative masses supported: wells (Z<0, cyan) vs bumps (Z>0, amber)
- Curvature clamped to +-MAX_WELL_DEPTH to prevent extreme mesh stretching
- MAX_WELL_DEPTH should stay high (>=100); pow-of-log mapping compresses naturally, clamp is only for pathological cases
- CURVATURE_EXP controls compression: <1 amplifies small masses, compresses large
- PHI_SCALE divides raw phi inside log, linearizing small potentials to reduce bump/well asymmetry
- Edge-referenced potential: `edgeRefPhi` = average *raw* potential at 4 cardinal points at `BOUNDARY_R * 1.2`, subtracted from raw phi *before* mapPhi so the nonlinear compression operates on relative potential
- `_computeEdgeRefPhi()` samples at fixed radius `BOUNDARY_R * 1.2` (not grid edge) each frame; grid/ring Z = `mapPhi(rawPhi - edgeRefPhi)`
- `rawPotential()` returns unmapped phi; `mapPhi()` applies pow-of-log
- `rawPotentialCutoff()` -- optimized variant: skips bodies where `d2 > cutoffs[i]` (used for grid loop only)
- `computeCutoffs()` -- returns Float64Array of paired (inner^2, outer^2) cutoff radii per body; inner = `(5 * softening * sqrt(|mass|))^2`, outer = inner * 1.5
- `rawPotentialCutoff` uses smoothstep fade between inner and outer radii (no hard step)
- Grid uses `rawPotentialCutoff` + pre-computed cutoffs for performance; `_computeEdgeRefPhi`, `_updateRingVerts`, and body Z use `rawPotential` (accuracy matters there)
- Plummer softening (`sqrt(r^2 + s^2)`) for smooth grid wells
- Boundary ring is purely visual -- recomputes Z from edge-referenced potential each frame, does NOT influence camera
- Camera target is fixed at origin (0,0,0); Z=0 is the edge reference level
- Boundary is fully decoupled: BOUNDARY_R only affects physics (body bounce) and ring geometry, not grid Z or camera
- Camera distance range: [25, 300]; pitch range [-PI/2, PI/2] (can look from below); far plane = `max(500, camDist * 4)`
- Bodies rendered as point sprites sitting on the curved surface
- Body Z computed per-body each frame (see `bodyFollowZ` toggle); radius offset is mass-sign-dependent: `+radius` for positive mass (above well), `-radius` for negative (below bump)
- Spherical camera (pitch/yaw/dist), Z-up coordinate system
- Multiple presets: solar, binary, figure-8, trojan, runaway, necklace, intruder, collapse, hierarchy
- UI params panel: "new body" section (mass slider) separated from "simulation" section (gravity, time)
- Advanced params (body Z toggle, Z_SCALE, CURVATURE_EXP, softening, boundary radius) hidden behind expand button
- `bodyFollowZ` toggle: ON = bodies sit on edge-referenced mesh surface; OFF = bodies sit at Z=0 (flat reference plane); disabled by default
- BOUNDARY_R selectable via 4-size radio buttons: S(60), M(120), L(200), XL(350); changing reloads current preset

## State Ownership
- `timeDilation`, `gridSoftening`, `boundaryR`, `colorIdx` -- owned by `Simulation`
- `bodyFollowZ`, `zScale`, `curvatureExp` -- owned by `Renderer`
- GL uniform/attribute locations cached in `Renderer.gridLocs`, `bodyLocs`, `ringLocs`
- Body staging buffer pre-allocated in `Renderer.bodyStaging` (grows on demand, never shrinks)

## Removed (dead code cleanup)
- `potential()` -- unused convenience wrapper around rawPotential+mapPhi; removed
- `_gridZ()` -- unused internal method; removed
- `gravity3d.py` -- original pygame/PyOpenGL prototype; deleted

## Notes
- MVP matrix order: `mat4Mul(proj, view)` -- P*V not V*P
- `flat` is a GLSL reserved word -- do not use as variable name
- Column-major matrices (Float32Array), Z-up coordinate system
- Fonts: DM Mono + Fraunces (loaded from Google Fonts)
- `Math.pow(negative, 1/3)` returns NaN in JS -- always use `Math.abs()` for body radius
- Grid shader uses dual uniforms `uMinZ`/`uMaxZ` for well/bump coloring
- Mass range: slider-configurable; mass=0 is valid (test particle, min radius 0.15)
- Negative mass creates "runaway pair" dynamics with positive mass (chase/flee) -- correct physics
- Preview snapshot tool fails on WebGL canvas; use `preview_eval` + `preview_screenshot` for verification
