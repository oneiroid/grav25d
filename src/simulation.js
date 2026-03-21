// ── Body ──
class Body {
  static radius(mass) {
    const a = Math.abs(mass);
    if (a < 1) return Math.max(0.15, 0.5 * a);
    return 0.5 + 0.8 * Math.log10(a);
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
    const Ms = 500, r1 = 20, r2 = 38, r3 = 55, r4 = 75;
    return [
      { x: 0, y: 0, mass: Ms, vx: 0, vy: 0 },
      { x: r1, y: 0, mass: 0.8, vx: 0, vy: Math.sqrt(G * Ms / r1) },
      { x: -r2, y: 0, mass: 5, vx: 0, vy: -Math.sqrt(G * Ms / r2) },
      { x: 0, y: r3, mass: 1.5, vx: -Math.sqrt(G * Ms / r3), vy: 0 },
      { x: -r4, y: -r4 * 0.3, mass: 0.3, vx: Math.sqrt(G * Ms / r4) * 0.3, vy: -Math.sqrt(G * Ms / r4) * 0.95 },
    ];
  },
  binary: (G) => {
    const sep = 25, m = 200;
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
    const M = 500, r1 = 35, r2 = 35;
    const v1 = Math.sqrt(G * M / r1);
    const v2_ = Math.sqrt(G * M / r2);
    const a4 = Math.PI / 3, a5 = -Math.PI / 3;
    return [
      { x: 0, y: 0, mass: M, vx: 0, vy: 0 },
      { x: r1, y: 0, mass: 3, vx: 0, vy: v1 },
      { x: r2 * Math.cos(a4), y: r2 * Math.sin(a4), mass: 3, vx: -v2_ * Math.sin(a4), vy: v2_ * Math.cos(a4) },
      { x: r2 * Math.cos(a5), y: r2 * Math.sin(a5), mass: 2, vx: -v2_ * Math.sin(a5), vy: v2_ * Math.cos(a5) },
    ];
  },
  runaway: (G) => [
    { x: -8, y: 0, mass: 200, vx: 0, vy: 0.5 },
    { x: 8, y: 0, mass: -200, vx: 0, vy: 0.5 },
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
    const sep = 25, m = 200;
    const v = Math.sqrt(G * m / (4 * (sep / 2)));
    return [
      { x: -sep / 2, y: 0, mass: m, vx: 0, vy: -v },
      { x: sep / 2, y: 0, mass: m, vx: 0, vy: v },
      { x: -50, y: 40, mass: -80, vx: 2.0, vy: -1.5 },
    ];
  },
  collapse: (G) => {
    const n = 5, m = 80, r = 35;
    const bodies = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      bodies.push({ x: r * Math.cos(a), y: r * Math.sin(a), mass: m, vx: 0, vy: 0 });
    }
    return bodies;
  },
  hierarchy: (G) => {
    const Ms = 500, Mp = 8, Mm = 0.3;
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
    this.mergeEnabled = true;
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
        // When merge is off, use sum-of-radii as softening so overlapping bodies pass through
        const s = this.mergeEnabled ? SOFTENING : Math.max(SOFTENING, bi.r + bj.r);
        const r2 = dx * dx + dy * dy + s * s;
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
    // Merge overlapping bodies (inelastic collision / accretion)
    // Only merge if gravitationally bound (total orbital energy < 0)
    if (!this.mergeEnabled) return;
    for (let i = 0; i < this.bodies.length; i++) {
      const bi = this.bodies[i];
      for (let j = i + 1; j < this.bodies.length; j++) {
        const bj = this.bodies[j];
        const dx = bj.x - bi.x, dy = bj.y - bi.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const mergeR = 0.5 * Math.max(bi.r, bj.r);
        if (dist < mergeR) {
          // Check if pair is gravitationally bound
          const dvx = bj.vx - bi.vx, dvy = bj.vy - bi.vy;
          const vRel2 = dvx * dvx + dvy * dvy;
          const mu = Math.abs(bi.mass * bj.mass) / (Math.abs(bi.mass) + Math.abs(bj.mass));
          const ke = 0.5 * mu * vRel2;
          const pe = this.G * Math.abs(bi.mass * bj.mass) / Math.max(dist, 0.01);
          if (ke >= pe) continue; // unbound flyby -- skip
          const mSum = bi.mass + bj.mass;
          if (Math.abs(mSum) < 0.01) {
            this.bodies.splice(j, 1);
            this.bodies.splice(i, 1);
            i--;
            break;
          }
          bi.x = (bi.mass * bi.x + bj.mass * bj.x) / mSum;
          bi.y = (bi.mass * bi.y + bj.mass * bj.y) / mSum;
          bi.vx = (bi.mass * bi.vx + bj.mass * bj.vx) / mSum;
          bi.vy = (bi.mass * bi.vy + bj.mass * bj.vy) / mSum;
          bi.mass = mSum;
          bi.r = Body.radius(mSum);
          this.bodies.splice(j, 1);
          j--;
        }
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
