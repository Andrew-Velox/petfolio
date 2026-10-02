/**
 * ui/index.js — Right-click icon bar, avatar picker and chat.
 *
 *     [ avatar ] [ chat ] [ settings ] [ exit ]
 *
 *   avatar    pick another character
 *   chat      ask the pet about the site (AI + petfolio knowledge base)
 *   settings  reserved — wire it up with `ui.onSettings`
 *   exit      the pet walks off and peeks in from the corner;
 *             click the peeking pet to call it back
 */
import { ChatClient } from '../ai/client.js';
import { CHARACTERS } from '../characters/characters.js';
import { createChat } from './chat.js';
import { ICONS } from './icons.js';
import { injectStyles } from './styles.js';

/**
 * @param {import('../Petfolio.js').Petfolio} pet
 * @param {object} [opts]
 * @param {string}   [opts.name='Petfolio']  persona name (chat header + prompt)
 * @param {object}   [opts.ai]               ChatClient options (knowledge, endpoint, apiKey, provider, model)
 * @param {string[]} [opts.suggestions]      starter questions shown as chips in the chat (default: 3 generic ones, [] = none)
 * @param {Function} [opts.onSettings]       called when the settings button is pressed
 */
export function createUI(pet, opts = {}) {
  injectStyles();
  const name = opts.name ?? 'Petfolio';

  const client = new ChatClient({ ...opts.ai, name });
  const chat   = createChat({ client, name, suggestions: opts.suggestions, onOpen: () => pet.startChat(), onClose: () => pet.endChat() });

  // ── Icon bar ────────────────────────────────────────────
  const menu = document.createElement('div');
  menu.className = 'pf-ui pf-menu';
  menu.setAttribute('role', 'toolbar');
  menu.setAttribute('aria-label', `${name} menu`);

  const button = (key, label, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pf-btn';
    b.title = label;
    b.innerHTML = ICONS[key];          // static, trusted markup from icons.js
    b.addEventListener('click', (e) => { e.stopPropagation(); onClick(b); });
    menu.appendChild(b);
    return b;
  };

  // ── Avatar picker ───────────────────────────────────────
  const picker = document.createElement('div');
  picker.className = 'pf-ui pf-avatars';

  function fillPicker() {
    picker.replaceChildren();
    for (const [key, ch] of Object.entries(CHARACTERS)) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'pf-avatar-item' + (key === pet.currentCharacter ? ' pf-active' : '');
      item.textContent = ch.displayName ?? key;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        pet.setCharacter(key);
        closeAll();
      });
      picker.appendChild(item);
    }
  }

  function closeAll() {
    menu.classList.remove('pf-open');
    picker.classList.remove('pf-open');
  }

  button('avatar', 'Switch avatar', (b) => {
    if (picker.classList.toggle('pf-open')) {
      fillPicker();
      const r = b.getBoundingClientRect();
      const below = r.bottom + 8 + picker.offsetHeight < window.innerHeight;
      picker.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - picker.offsetWidth - 8))}px`;
      picker.style.top  = `${below ? r.bottom + 8 : Math.max(8, r.top - 8 - picker.offsetHeight)}px`;
    }
  });

  button('chat', 'Chat', () => { closeAll(); chat.open(); });
  button('settings', 'Settings', () => { closeAll(); opts.onSettings?.(); });
  button('exit', 'Exit', () => { closeAll(); chat.close(); pet.exitToPeek(); });

  document.body.append(menu, picker);

  // ── Open on right-click over the pet ────────────────────
  const canvas = pet.app.view;
  const onContext = (e) => {
    const r = canvas.getBoundingClientRect();
    const hit = pet.sprite.getBounds().contains(e.clientX - r.left, e.clientY - r.top);
    if (!hit) return;
    e.preventDefault();
    openMenu(e.clientX, e.clientY);
  };
  canvas.addEventListener('contextmenu', onContext);

  function openMenu(x, y) {
    picker.classList.remove('pf-open');
    menu.classList.add('pf-open');
    menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth  - menu.offsetWidth  - 8))}px`;
    menu.style.top  = `${Math.max(8, Math.min(y, window.innerHeight - menu.offsetHeight - 8))}px`;
  }

  // Click elsewhere / Escape closes the bar and the picker.
  const onDocClick = (e) => { if (!menu.contains(e.target) && !picker.contains(e.target)) closeAll(); };
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    closeAll();
    chat.close();
  };
  document.addEventListener('pointerdown', onDocClick);
  document.addEventListener('keydown', onKey);

  return {
    client, chat,
    openMenu, closeMenu: closeAll,
    openChat: () => chat.open(),
    destroy() {
      canvas.removeEventListener('contextmenu', onContext);
      document.removeEventListener('pointerdown', onDocClick);
      document.removeEventListener('keydown', onKey);
      chat.destroy();
      menu.remove();
      picker.remove();
    },
  };
}
