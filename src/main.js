/**
 * main.js — Entry-point.
 *
 * Auto-starts the pet with auto-pilot enabled.
 * Right-click on the avatar opens a context menu for manual control.
 */
import { MishiPet } from './MishiPet.js';

// ── Bootstrap ─────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const mishi  = new MishiPet(canvas);
window.mishi = mishi;

// ── Auto-start ────────────────────────────────────────────
mishi.startAuto();
const autoBtn = document.getElementById('btn-auto');
updateAutoButton(true);

// ── Context menu ──────────────────────────────────────────
const menu = document.getElementById('ctx-menu');

// Right-click on the sprite → show context menu at cursor
mishi.sprite.on('rightclick', (e) => {
  e.data.originalEvent.preventDefault();
  showMenu(e.data.originalEvent.clientX, e.data.originalEvent.clientY);
});

// Also handle standard contextmenu event on the canvas
// (some browsers/OS send contextmenu instead of rightclick)
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  // Only show if click is near the sprite
  const pet = mishi.sprite;
  const dx = Math.abs(e.clientX - pet.x);
  const dy = Math.abs(e.clientY - pet.y);
  if (dx < 80 && dy < 120) {
    showMenu(e.clientX, e.clientY);
  }
});

function showMenu(x, y) {
  // Position the menu, keeping it within the viewport
  menu.classList.add('visible');
  const rect = menu.getBoundingClientRect();
  const maxX = window.innerWidth  - rect.width  - 8;
  const maxY = window.innerHeight - rect.height - 8;
  menu.style.left = Math.min(x, maxX) + 'px';
  menu.style.top  = Math.min(y, maxY) + 'px';
}

// Click anywhere outside the menu → close it
document.addEventListener('click', (e) => {
  if (!menu.contains(e.target)) {
    menu.classList.remove('visible');
  }
});

// Also close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') menu.classList.remove('visible');
});

// ── Menu item clicks ──────────────────────────────────────
menu.addEventListener('click', (e) => {
  const item = e.target.closest('.ctx-item[data-state]');
  if (!item) return;

  // Manual state click stops auto-pilot
  if (mishi.isAuto) {
    mishi.stopAuto();
    updateAutoButton(false);
  }

  mishi.changeState(item.dataset.state);
  menu.classList.remove('visible');
});

// ── Auto-pilot toggle ─────────────────────────────────────
autoBtn.addEventListener('click', () => {
  const nowActive = mishi.toggleAuto();
  updateAutoButton(nowActive);
  menu.classList.remove('visible');
});

function updateAutoButton(active) {
  if (active) {
    autoBtn.innerHTML = '<span class="icon">⏹</span> Stop Auto';
    autoBtn.classList.add('auto-on');
    autoBtn.classList.remove('auto-off');
  } else {
    autoBtn.innerHTML = '<span class="icon">▶</span> Auto Pilot';
    autoBtn.classList.add('auto-off');
    autoBtn.classList.remove('auto-on');
  }
}
