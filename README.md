# Gravity 2.5D - Spacetime Curvature Simulator

An interactive 3D visualization of gravitational spacetime curvature, running entirely in the browser with WebGL. Watch how massive bodies warp the fabric of spacetime in real time.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Demo

Open `index.html` in any modern browser -- no build step, no dependencies, no server required.

To serve locally (for development):

```bash
python -m http.server 8765
# then open http://localhost:8765
```

## Features

- **Real-time N-body simulation** -- Newtonian gravity with Plummer softening for smooth potential wells
- **3D spacetime curvature mesh** -- 100x100 wireframe grid deformed by gravitational potential using a pow-of-log mapping
- **Negative mass support** -- Wells (positive mass, cyan) and bumps (negative mass, amber) with correct "runaway pair" dynamics
- **Interactive controls** -- Click to add bodies, right-click to remove, drag to orbit, scroll to zoom
- **9 built-in presets** -- Solar system, binary stars, figure-8 three-body, Trojan asteroids, runaway pair, necklace, intruder, gravitational collapse, hierarchical system
- **Adjustable physics parameters** -- Gravitational constant, time dilation, mass, Z-scale, curvature exponent, and softening radius via sliders
- **Spherical camera** -- Pitch/yaw/distance with Z-up coordinate system
- **Zero dependencies** -- Single HTML file with inline CSS and JavaScript/WebGL

## Controls

| Input | Action |
|-------|--------|
| **Click** | Add a body |
| **Right-click** | Remove nearest body |
| **Drag** | Orbit camera |
| **Scroll** | Zoom in/out |
| **Space** | Pause/resume |
| **R** | Reset to current preset |

## How It Works

The simulation runs 2D Newtonian gravity in the X-Y plane. The Z axis visualizes gravitational potential -- massive bodies create "wells" that deform a wireframe grid downward (or upward for negative masses). The potential mapping uses a signed power-of-logarithm function to compress the huge dynamic range of gravitational potentials into a visually useful range:

```
Z = sign(phi) * Z_SCALE * pow(log(1 + |phi| / PHI_SCALE), CURVATURE_EXP)
```

A reference-level normalization keeps the boundary ring at Z=0, so the mesh floats naturally in space regardless of total potential.

## Tech Stack

- **Rendering**: WebGL 1.0 with custom shaders
- **UI**: Vanilla HTML/CSS with DM Mono + Fraunces fonts
- **Physics**: Symplectic Euler integration with adaptive softening

## License

[MIT](LICENSE)
