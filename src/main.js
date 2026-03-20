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

// -- Sliders --
bindSlider('mass-slider', 'mass-val', v => v.toFixed(1), v => { sim.nextMass = v; });
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
