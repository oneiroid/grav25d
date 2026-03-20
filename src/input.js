// -- Shared helper (spec 3a) --
function addBodyAtScreen(clientX, clientY, sim, renderer) {
  const hit = renderer.unproject(clientX, clientY);
  if (hit && Math.hypot(hit.x, hit.y) < sim.boundaryR) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 8;
    sim.addBody(hit.x, hit.y, undefined, speed * Math.cos(angle), speed * Math.sin(angle));
  }
}

function initInput(sim, ren) {
  // -- Keyboard --
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    switch (e.key) {
      case ' ': e.preventDefault(); sim.paused = !sim.paused; toast(sim.paused ? 'PAUSED' : 'RUNNING'); break;
      case 'r': case 'R': sim.loadPreset(sim.currentPreset); toast('RESET'); break;
      case 'G': sim.G = Math.min(sim.G + 1, 50); syncSliders(sim); break;
      case 'g': sim.G = Math.max(sim.G - 1, -50); syncSliders(sim); break;
      case '=': case '+': sim.nextMass = Math.min(sim.nextMass + 1, 200); syncSliders(sim); break;
      case '-': sim.nextMass = Math.max(sim.nextMass - 1, -200); syncSliders(sim); break;
    }
  });

  // -- Mouse --
  let isDragging = false;
  let lastMouse = null;

  ren.canvas.addEventListener('mousedown', e => {
    if (e.button === 0) { isDragging = false; lastMouse = [e.clientX, e.clientY]; }
  });

  ren.canvas.addEventListener('mousemove', e => {
    if (lastMouse && e.buttons & 1) {
      const dx = e.clientX - lastMouse[0];
      const dy = e.clientY - lastMouse[1];
      if (!isDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) isDragging = true;
      if (isDragging) {
        ren.camYaw += dx * 0.005;
        ren.camPitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, ren.camPitch + dy * 0.005));
      }
      lastMouse = [e.clientX, e.clientY];
    }
  });

  ren.canvas.addEventListener('mouseup', e => {
    if (e.button === 0 && !isDragging) addBodyAtScreen(e.clientX, e.clientY, sim, ren);
    lastMouse = null; isDragging = false;
  });

  ren.canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    const idx = ren.findBody(e.clientX, e.clientY);
    if (idx !== null) sim.removeBody(idx);
  });

  ren.canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.08 : 0.92;
    ren.camDist = Math.max(25, Math.min(300, ren.camDist * factor));
  }, { passive: false });

  // -- Touch --
  const LONG_PRESS_MS = 500;
  const TAP_MOVE_THRESH = 10;
  let touchStartPos = null;
  let touchStartTime = 0;
  let touchMoved = false;
  let longPressTimer = null;
  let longPressFired = false;
  let pinchStartDist = 0;
  let pinchStartCamDist = 0;

  function getTouchDist(t1, t2) {
    return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  }

  function showLongPressIndicator(x, y) {
    const el = document.getElementById('longpress-indicator');
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.display = 'block';
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'lp-ring 0.5s ease-out forwards';
  }

  function hideLongPressIndicator() {
    document.getElementById('longpress-indicator').style.display = 'none';
  }

  function clearLongPress() {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    hideLongPressIndicator();
  }

  ren.canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (e.touches.length === 2) {
      clearLongPress();
      pinchStartDist = getTouchDist(e.touches[0], e.touches[1]);
      pinchStartCamDist = ren.camDist;
      return;
    }
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStartPos = [t.clientX, t.clientY];
    lastMouse = [t.clientX, t.clientY];
    touchStartTime = Date.now();
    touchMoved = false;
    isDragging = false;
    longPressFired = false;

    longPressTimer = setTimeout(() => {
      if (!touchMoved) {
        longPressFired = true;
        const idx = ren.findBody(touchStartPos[0], touchStartPos[1]);
        if (idx !== null) {
          sim.removeBody(idx);
          showLongPressIndicator(touchStartPos[0], touchStartPos[1]);
          setTimeout(hideLongPressIndicator, 600);
          toast('REMOVED');
        }
      }
    }, LONG_PRESS_MS);
  }, { passive: false });

  ren.canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 2) {
      clearLongPress();
      const dist = getTouchDist(e.touches[0], e.touches[1]);
      const ratio = pinchStartDist / dist;
      ren.camDist = Math.max(25, Math.min(300, pinchStartCamDist * ratio));
      return;
    }
    if (e.touches.length !== 1 || !touchStartPos) return;
    const t = e.touches[0];
    const dx = t.clientX - lastMouse[0];
    const dy = t.clientY - lastMouse[1];
    const totalDx = t.clientX - touchStartPos[0];
    const totalDy = t.clientY - touchStartPos[1];

    if (!touchMoved && (Math.abs(totalDx) > TAP_MOVE_THRESH || Math.abs(totalDy) > TAP_MOVE_THRESH)) {
      touchMoved = true;
      isDragging = true;
      clearLongPress();
    }

    if (isDragging) {
      ren.camYaw += dx * 0.005;
      ren.camPitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, ren.camPitch + dy * 0.005));
    }
    lastMouse = [t.clientX, t.clientY];
  }, { passive: false });

  ren.canvas.addEventListener('touchend', e => {
    e.preventDefault();
    clearLongPress();
    if (longPressFired) { touchStartPos = null; return; }
    if (touchStartPos && !touchMoved && e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      if (Date.now() - touchStartTime < LONG_PRESS_MS) {
        addBodyAtScreen(t.clientX, t.clientY, sim, ren);
      }
    }
    touchStartPos = null; lastMouse = null; isDragging = false;
  }, { passive: false });

  ren.canvas.addEventListener('touchcancel', e => {
    clearLongPress();
    touchStartPos = null; lastMouse = null; isDragging = false;
  }, { passive: false });

  // -- Mobile buttons --
  document.getElementById('toggle-params').addEventListener('click', () => {
    toggleMobilePanel('params-panel', 'toggle-params', 'body-panel', 'toggle-bodies');
  });
  document.getElementById('toggle-bodies').addEventListener('click', () => {
    toggleMobilePanel('body-panel', 'toggle-bodies', 'params-panel', 'toggle-params');
  });
  document.getElementById('mobile-pause').addEventListener('click', () => {
    sim.paused = !sim.paused;
    toast(sim.paused ? 'PAUSED' : 'RUNNING');
  });
  document.getElementById('mobile-reset').addEventListener('click', () => {
    sim.loadPreset(sim.currentPreset);
    toast('RESET');
  });

  // Close panels when tapping canvas on mobile
  const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (isTouchDevice) {
    ren.canvas.addEventListener('touchstart', () => {
      document.getElementById('params-panel').classList.remove('mobile-open');
      document.getElementById('body-panel').classList.remove('mobile-open');
      document.getElementById('toggle-params').classList.remove('active');
      document.getElementById('toggle-bodies').classList.remove('active');
    });
  }

  // Prevent pull-to-refresh
  document.body.addEventListener('touchmove', e => {
    if (e.target === ren.canvas || e.target === document.body) e.preventDefault();
  }, { passive: false });
}
