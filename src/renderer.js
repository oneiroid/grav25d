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
    this._cutoffsBuf = new Float64Array(this._bodyCapacity * 2);

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

    // -- Grid shader --
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

    // -- Body shader --
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

    // -- Ring shader --
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

    // -- Cache GL locations (spec 2a) --
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

  _updateGridVerts() {
    const gn1 = this.gridN + 1;
    this.gridExtent = Math.max(this.camDist * 0.55, this.sim.boundaryR);
    this.gridStep = (this.gridExtent * 2) / this.gridN;
    const bodies = this.sim.bodies;
    const G = this.sim.G;
    const soft = this.sim.gridSoftening;
    // Pre-compute cutoffs once per frame (spec 2c)
    if (bodies.length * 2 > this._cutoffsBuf.length) {
      this._cutoffsBuf = new Float64Array(bodies.length * 2);
    }
    const cutoffs = computeCutoffs(bodies, soft, this._cutoffsBuf);

    for (let i = 0; i <= this.gridN; i++) {
      for (let j = 0; j <= this.gridN; j++) {
        const x = -this.gridExtent + j * this.gridStep;
        const y = -this.gridExtent + i * this.gridStep;
        const idx = (i * gn1 + j) * 3;
        this.gridVerts[idx] = x;
        this.gridVerts[idx + 1] = y;
        this.gridVerts[idx + 2] = mapPhi(rawPotentialCutoff(x, y, bodies, G, soft, cutoffs), this.zScale, this.curvatureExp);
      }
    }
  }

  _updateRingVerts() {
    const bodies = this.sim.bodies;
    const G = this.sim.G;
    const soft = this.sim.gridSoftening;
    const boundaryR = this.sim.boundaryR;
    let zSum = 0;
    for (let i = 0; i <= this.ringSegs; i++) {
      const a = (i / this.ringSegs) * Math.PI * 2;
      const x = boundaryR * Math.cos(a);
      const y = boundaryR * Math.sin(a);
      const z = mapPhi(rawPotential(x, y, bodies, G, soft), this.zScale, this.curvatureExp);
      const idx = i * 3;
      this.ringVerts[idx] = x;
      this.ringVerts[idx + 1] = y;
      this.ringVerts[idx + 2] = z;
      zSum += z;
    }
    // Camera tracks average ring Z so grid stays centered in view
    this.camTarget[2] = this.ringSegs > 0 ? zSum / (this.ringSegs + 1) : 0;
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
        ? mapPhi(rawPotential(b.x, b.y, bodies, G, soft), this.zScale, this.curvatureExp)
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
