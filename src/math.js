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
  [0, 0.83, 0.91],
  [0.91, 0.63, 0.19],
  [0.91, 0.25, 0.38],
  [0.38, 0.91, 0.47],
  [0.63, 0.44, 0.88],
  [0.91, 0.78, 0.25],
  [0.28, 0.60, 0.91],
  [0.91, 0.41, 0.63],
];
const COLOR_HEX = ['#00d4e8','#e8a030','#e84060','#60e878','#a070e0','#e8c840','#4898e8','#e868a0'];

// ── Gravitational potential ──
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

function mapPhi(phi, zScale, curvatureExp) {
  const sign = phi < 0 ? -1 : 1;
  const z = sign * zScale * Math.pow(Math.log(1 + Math.abs(phi) / PHI_SCALE), curvatureExp);
  return Math.max(-MAX_WELL_DEPTH, Math.min(MAX_WELL_DEPTH, z));
}
