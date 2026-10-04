/** ui/icons.js — Inline SVG icons for the menu bar (24×24 viewBox, stroke = currentColor). */

const svg = (inner, label) =>
  `<svg viewBox="0 0 24 24" role="img" aria-label="${label}">${inner}</svg>`;

export const ICONS = {
  chat: svg(
    '<path d="M5 4h14a2.5 2.5 0 0 1 2.5 2.5v8A2.5 2.5 0 0 1 19 17H11l-4.5 4v-4H5a2.5 2.5 0 0 1-2.5-2.5v-8A2.5 2.5 0 0 1 5 4z"/>' +
    '<circle cx="8" cy="10.5" r=".9" fill="currentColor"/><circle cx="12" cy="10.5" r=".9" fill="currentColor"/><circle cx="16" cy="10.5" r=".9" fill="currentColor"/>',
    'Chat',
  ),
  settings: svg(
    '<circle cx="12" cy="12" r="3"/><path d="M12 2.5l1.6 2.3 2.7-.6 1 2.6 2.6 1-.6 2.7 2.3 1.6-2.3 1.6.6 2.7-2.6 1-1 2.6-2.7-.6L12 21.5l-1.6-2.3-2.7.6-1-2.6-2.6-1 .6-2.7L2.4 12l2.3-1.6-.6-2.7 2.6-1 1-2.6 2.7.6z"/>',
    'Settings',
  ),
  exit: svg(
    '<circle cx="12" cy="12" r="10"/><path d="M8.2 8.2l7.6 7.6M15.8 8.2l-7.6 7.6" stroke-width="3"/>',
    'Exit',
  ),
  // Chat panel
  sparkle: svg('<path d="M12 2l2.3 6.2L20.5 10.5l-6.2 2.3L12 19l-2.3-6.2L3.5 10.5l6.2-2.3z"/><path d="M19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>', 'Assistant'),
  send: svg('<path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/>', 'Send'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>', 'Close'),
  reset: svg('<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4.5v4.6h4.6"/>', 'New conversation'),
};
