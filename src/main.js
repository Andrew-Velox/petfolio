/**
 * main.js — Local testing entry-point.
 *
 * Instantiates a MishiPet on the page canvas and wires the HTML
 * control-panel buttons to class methods.
 */
import { MishiPet } from './MishiPet.js';

// ── Bootstrap ─────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const mishi  = new MishiPet(canvas);

// Expose to the dev console for quick REPL poking
window.mishi = mishi;

// ── Button wiring ─────────────────────────────────────────
// Each button in the HTML carries a `data-state` attribute.
// We bind a single delegated listener on the controls panel
// so adding new buttons never requires touching this file.
const controls = document.getElementById('controls');

controls.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-state]');
  if (!btn || btn.disabled) return;

  // Manual state click stops auto-pilot
  if (mishi.isAuto) {
    mishi.stopAuto();
    updateAutoButton(false);
  }

  mishi.changeState(btn.dataset.state);
});

// ── Auto-pilot toggle ─────────────────────────────────────
const autoBtn = document.getElementById('btn-auto');

autoBtn.addEventListener('click', () => {
  const nowActive = mishi.toggleAuto();
  updateAutoButton(nowActive);
});

function updateAutoButton(active) {
  if (active) {
    autoBtn.textContent = '⏹ Stop Auto';
    autoBtn.classList.add('active');
  } else {
    autoBtn.textContent = '▶ Auto Pilot';
    autoBtn.classList.remove('active');
  }
}
