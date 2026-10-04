/**
 * ui/index.js — Right-click icon bar and chat.
 *
 *     [ chat ] [ settings ] [ exit ]
 *
 *   chat      ask the pet about the site (AI + the text from petfolio-cli)
 *   settings  reserved — wire it up with `ui.onSettings`
 *   exit      the pet walks off and peeks in from the corner;
 *             click the peeking pet to call it back
 */
import { ChatClient } from '../ai/client.js';
import { createChat } from './chat.js';
import { ICONS } from './icons.js';
import { injectStyles } from './styles.js';

/**
 * @param {import('../Petfolio.js').Petfolio} pet
 * @param {object} [opts]
 * @param {string}   [opts.name='Petfolio']  persona name (chat header + prompt)
 * @param {object}   [opts.ai]               ChatClient options (knowledge, endpoint, apiKey, provider, model)
 * @param {string[]} [opts.suggestions]      starter questions shown as chips in the chat (default: 3 generic ones, [] = none)
 * @param {boolean}  [opts.chat=true]       false = no chat button in the menu (e.g. a static site with no server endpoint)
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

  function closeAll() {
    menu.classList.remove('pf-open');
  }

  if (opts.chat !== false) button('chat', 'Chat', () => { closeAll(); chat.open(); });
  button('settings', 'Settings', () => { closeAll(); opts.onSettings?.(); });
  button('exit', 'Exit', () => { closeAll(); chat.close(); pet.exitToPeek(); });

  document.body.append(menu);

  // ── Open on right-click over the pet ────────────────────
  // The canvas is click-through except over the pet (see interaction.js), so a
  // right-click that lands on the canvas is a right-click on the pet.
  const canvas = pet.app.view;
  const onContext = (e) => {
    if (e.target !== canvas) return;
    const r = canvas.getBoundingClientRect();
    if (!pet.isOverPet(e.clientX - r.left, e.clientY - r.top)) return;
    e.preventDefault();
    openMenu(e.clientX, e.clientY);
  };
  canvas.addEventListener('contextmenu', onContext);
  pet.onTap = (x, y) => openMenu(x, y);        // tap / click works too (touch has no right-click)

  function openMenu(x, y) {
    menu.classList.add('pf-open');
    menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth  - menu.offsetWidth  - 8))}px`;
    menu.style.top  = `${Math.max(8, Math.min(y, window.innerHeight - menu.offsetHeight - 8))}px`;
  }

  // Click elsewhere / Escape closes the bar.
  const onDocClick = (e) => { if (!menu.contains(e.target)) closeAll(); };
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
      if (pet.onTap) pet.onTap = null;
      document.removeEventListener('pointerdown', onDocClick);
      document.removeEventListener('keydown', onKey);
      chat.destroy();
      menu.remove();
    },
  };
}
