/**
 * main.js — Entry-point.
 *
 * Auto-starts the pet with auto-pilot enabled.
 * Right-click on the avatar opens a context menu for manual control.
 */
import { Petfolio } from './Petfolio.js';
import { CHARACTERS } from './characters/characters.js';

// ── Bootstrap ─────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const pet    = new Petfolio(canvas);
window.pet = pet;

// ── Auto-start ────────────────────────────────────────────
pet.startAuto();
const autoBtn = document.getElementById('btn-auto');
updateAutoButton(true);

// ── Context menu ──────────────────────────────────────────
const menu = document.getElementById('ctx-menu');

// Right-click on the sprite → show context menu at cursor
pet.sprite.on('rightclick', (e) => {
  e.data.originalEvent.preventDefault();
  showMenu(e.data.originalEvent.clientX, e.data.originalEvent.clientY);
});

// Also handle standard contextmenu event on the canvas
// (some browsers/OS send contextmenu instead of rightclick)
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  // Only show if click is near the sprite
  const sprite = pet.sprite;
  const dx = Math.abs(e.clientX - sprite.x);
  const dy = Math.abs(e.clientY - sprite.y);
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

  // Stop auto-pilot immediately so the user sees their chosen
  // state play uninterrupted. The pet will auto-resume after
  // AUTO_RESUME_DELAY_MS (configured in constants.js).
  if (pet.isAuto) {
    pet.stopAuto();
    updateAutoButton(false);
  }

  // triggerState() handles "play this state, then auto-resume"
  pet.triggerState(item.dataset.state);
  menu.classList.remove('visible');
});

// ── Auto-pilot toggle ─────────────────────────────────────
autoBtn.addEventListener('click', () => {
  const nowActive = pet.toggleAuto();
  updateAutoButton(nowActive);
  menu.classList.remove('visible');
});

// ── Exit button ───────────────────────────────────────────
// Makes the avatar walk off-screen in a random direction and freeze
// at the edge (peek state). Pressing Auto Pilot later calls
// pet.startAuto() which teleports the avatar back and resumes.
const exitBtn = document.getElementById('btn-exit');
exitBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  pet.exitToPeek();
  menu.classList.remove('visible');
  // Reflect the new state: auto is now off, so show "Auto Pilot" label.
  updateAutoButton(false);
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

// ── Character submenu ──────────────────────────────────────
// Populate the character list at startup. Each entry calls
// pet.setCharacter(key) when clicked. The active character is
// highlighted with the .active class.
const charList = document.getElementById('ctx-character-list');
if (charList) {
  Object.entries(CHARACTERS).forEach(([key, char]) => {
    const btn = document.createElement('button');
    btn.className = 'ctx-item';
    btn.dataset.character = key;
    btn.innerHTML = `<span class="icon">🐱</span> ${char.displayName}`;
    if (key === pet.currentCharacter) btn.classList.add('active');
    btn.addEventListener('click', () => {
      pet.setCharacter(key);
      // Update active highlight
      charList.querySelectorAll('.ctx-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      menu.classList.remove('visible');
    });
    charList.appendChild(btn);
  });
}
