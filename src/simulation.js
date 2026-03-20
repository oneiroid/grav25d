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

// ── Presets ──
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
