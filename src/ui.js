// -- HUD (spec 2d: targeted DOM updates) --
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

// -- Toast --
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1000);
}

// -- Slider binding --
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
  // Mass slider synced via syncMassSlider() in main.js
  if (typeof syncMassSlider === 'function') syncMassSlider();
  document.getElementById('g-slider').value = sim.G;
  document.getElementById('g-val').textContent = sim.G.toFixed(3);
}

// -- Mobile panel toggle (spec 3b) --
function toggleMobilePanel(panelId, btnId, otherPanelId, otherBtnId) {
  document.getElementById(panelId).classList.toggle('mobile-open');
  document.getElementById(btnId).classList.toggle('active');
  document.getElementById(otherPanelId).classList.remove('mobile-open');
  document.getElementById(otherBtnId).classList.remove('active');
}
