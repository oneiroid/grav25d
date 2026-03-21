// -- Boot --
const sim = new Simulation();
const ren = new Renderer(sim);

sim.loadPreset('solar');

function onResize() { ren.resize(); }
window.addEventListener('resize', onResize);
onResize();

// -- Preset buttons --
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const name = btn.dataset.p;
    sim.loadPreset(name);
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    toast(name.toUpperCase());
  });
});

// -- Mass slider: log/linear mapping --
let massLogScale = true;

function massFromSlider(s) {
  if (!massLogScale) return s;
  if (s === 0) return 0;
  return Math.sign(s) * (Math.pow(10, Math.abs(s)) - 1);
}

function sliderFromMass(m) {
  if (!massLogScale) return m;
  if (m === 0) return 0;
  return Math.sign(m) * Math.log10(Math.abs(m) + 1);
}

function fmtMass(mass) {
  const a = Math.abs(mass);
  if (a === 0) return '0';
  if (a >= 100) return mass.toFixed(0);
  if (a >= 10) return mass.toFixed(1);
  return mass.toFixed(2);
}

function updateMassDisplay() {
  const sl = document.getElementById('mass-slider');
  const s = parseFloat(sl.value);
  const mass = massFromSlider(s);
  document.getElementById('mass-val').textContent = fmtMass(mass);
  sim.nextMass = mass;
}

function syncMassSlider() {
  const sl = document.getElementById('mass-slider');
  if (massLogScale) {
    sl.min = -3; sl.max = 3; sl.step = 0.01;
  } else {
    sl.min = -999; sl.max = 999; sl.step = 1;
  }
  sl.value = sliderFromMass(sim.nextMass);
  document.getElementById('mass-val').textContent = fmtMass(sim.nextMass);
}

const massSlider = bindSlider('mass-slider', 'mass-val',
  s => fmtMass(massFromSlider(s)),
  s => { sim.nextMass = massFromSlider(s); }
);

// -- Mass scale toggle (log/linear) --
document.getElementById('mass-scale-toggle').addEventListener('click', function() {
  massLogScale = !massLogScale;
  this.classList.toggle('on', massLogScale);
  document.getElementById('mass-scale-label').textContent = massLogScale ? 'log' : 'lin';
  syncMassSlider();
});

// -- Other sliders --
bindSlider('g-slider', 'g-val', v => v.toFixed(3), v => { sim.G = v; });
bindSlider('time-slider', 'time-val', v => v.toFixed(1) + 'x', v => { sim.timeDilation = v; });
bindSlider('curve-slider', 'curve-val', v => v.toFixed(2), v => { ren.curvatureExp = v; });
bindSlider('soften-slider', 'soften-val', v => v.toFixed(1), v => { sim.gridSoftening = v; });

// -- Boundary size buttons --
document.querySelectorAll('.boundary-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    sim.boundaryR = Number(btn.dataset.r);
    document.querySelectorAll('.boundary-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    sim.loadPreset(sim.currentPreset);
  });
});

// -- Merge toggle --
document.getElementById('merge-toggle').addEventListener('click', function() {
  sim.mergeEnabled = !sim.mergeEnabled;
  this.classList.toggle('on', sim.mergeEnabled);
  document.getElementById('merge-status').textContent = sim.mergeEnabled ? 'on' : 'off';
});

// -- Body Z toggle --
document.getElementById('body-z-toggle').addEventListener('click', function() {
  ren.bodyFollowZ = !ren.bodyFollowZ;
  this.classList.toggle('on', ren.bodyFollowZ);
  document.getElementById('body-z-status').textContent = ren.bodyFollowZ ? 'on' : 'off';
});

// -- Advanced params expand/collapse --
document.getElementById('params-expand').addEventListener('click', function() {
  const adv = document.getElementById('params-advanced');
  const open = adv.classList.toggle('open');
  this.textContent = open ? '- advanced' : '+ advanced';
});

// -- Input --
initInput(sim, ren);

// -- Loop --
let lastHud = 0;
function loop(t) {
  for (let i = 0; i < STEPS_PER_FRAME; i++) sim.step();
  ren.render();
  if (t - lastHud > 100) { updateHUD(sim); lastHud = t; }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
