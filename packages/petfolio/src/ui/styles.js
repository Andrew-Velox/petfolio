/** ui/styles.js — CSS for the menu and chat panel (injected once, `pf-` prefixed). */

const CSS = `
.pf-ui, .pf-ui * { box-sizing: border-box; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }

/* ── Icon bar ─────────────────────────────────────────── */
.pf-menu {
  position: fixed; z-index: 100001; display: none; gap: 6px; padding: 8px 10px;
  background: #a9a9a9; border-radius: 14px; box-shadow: 0 6px 24px rgba(0,0,0,.28);
}
.pf-menu.pf-open { display: flex; }
.pf-btn {
  width: 52px; height: 52px; padding: 0; border: 0; border-radius: 50%;
  background: transparent; color: #111; cursor: pointer;
  display: grid; place-items: center; transition: background .12s, transform .12s;
}
.pf-btn:hover  { background: rgba(0,0,0,.14); }
.pf-btn:active { transform: scale(.94); }
.pf-btn:focus-visible { outline: 2px solid #111; outline-offset: 2px; }
.pf-btn svg { width: 38px; height: 38px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }

/* ── Avatar picker ────────────────────────────────────── */
.pf-avatars {
  position: fixed; z-index: 100002; display: none; flex-direction: column; min-width: 160px; padding: 6px;
  background: #a9a9a9; border-radius: 12px; box-shadow: 0 6px 24px rgba(0,0,0,.28);
}
.pf-avatars.pf-open { display: flex; }
.pf-avatar-item {
  padding: 9px 12px; border: 0; border-radius: 8px; background: transparent; color: #111;
  font-size: 14px; text-align: left; cursor: pointer;
}
.pf-avatar-item:hover { background: rgba(0,0,0,.14); }
.pf-avatar-item.pf-active { background: rgba(0,0,0,.24); font-weight: 600; }

/* ── Chat panel (takes the place of the pet's speech bubble) ── */
.pf-chat {
  --pf-bg: rgba(20, 21, 27, .94); --pf-surface: #23252e; --pf-line: rgba(255,255,255,.08);
  --pf-text: #eceef3; --pf-muted: #9aa1b0; --pf-accent: #6366f1; --pf-accent2: #8b5cf6;
  position: fixed; z-index: 100003; left: 8px; bottom: 8px; width: min(340px, calc(100vw - 16px));
  max-height: min(480px, calc(100vh - 40px)); display: none; flex-direction: column; overflow: hidden;
  background: var(--pf-bg); color: var(--pf-text); border: 1px solid var(--pf-line); border-radius: 20px;
  box-shadow: 0 24px 60px -12px rgba(0,0,0,.55), 0 2px 0 rgba(255,255,255,.04) inset;
  -webkit-backdrop-filter: blur(18px) saturate(1.4); backdrop-filter: blur(18px) saturate(1.4);
  transform-origin: bottom left; font-size: 14px;
}
.pf-chat[data-side="right"] { transform-origin: bottom left; }
.pf-chat[data-side="left"]  { transform-origin: bottom right; }
.pf-chat.pf-open { display: flex; animation: pf-pop .22s cubic-bezier(.2,.9,.3,1.2); }
@keyframes pf-pop { from { opacity: 0; transform: translateY(8px) scale(.94); } to { opacity: 1; transform: none; } }

/* header */
.pf-chat-head {
  flex: none; display: flex; align-items: center; gap: 10px; padding: 12px 12px 12px 14px;
  background: linear-gradient(135deg, rgba(99,102,241,.28), rgba(139,92,246,.12) 60%, transparent);
  border-bottom: 1px solid var(--pf-line);
}
.pf-chat-avatar {
  flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center;
  font-weight: 700; font-size: 16px; color: #fff; background: linear-gradient(135deg, var(--pf-accent), var(--pf-accent2));
  box-shadow: 0 0 0 2px rgba(255,255,255,.12), 0 4px 12px rgba(99,102,241,.45);
}
.pf-chat-who { flex: 1; min-width: 0; line-height: 1.25; }
.pf-chat-title { font-weight: 650; font-size: 15px; letter-spacing: .01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pf-chat-status { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--pf-muted); }
.pf-dot { width: 7px; height: 7px; border-radius: 50%; background: #34d399; box-shadow: 0 0 0 3px rgba(52,211,153,.18); }
.pf-busy .pf-dot { background: #fbbf24; box-shadow: 0 0 0 3px rgba(251,191,36,.2); }
.pf-chat-icon {
  flex: none; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 10px; background: transparent;
  color: var(--pf-muted); cursor: pointer; display: grid; place-items: center; transition: background .15s, color .15s;
}
.pf-chat-icon:hover { background: rgba(255,255,255,.1); color: var(--pf-text); }
.pf-chat-icon:focus-visible, .pf-chip:focus-visible, .pf-chat-send:focus-visible { outline: 2px solid var(--pf-accent); outline-offset: 2px; }
.pf-chat-icon svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

/* messages */
.pf-chat-log {
  flex: 1; min-height: 140px; overflow-y: auto; padding: 14px 14px 6px; display: flex; flex-direction: column; gap: 10px;
  scroll-behavior: smooth; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.18) transparent;
}
.pf-chat-log::-webkit-scrollbar { width: 6px; }
.pf-chat-log::-webkit-scrollbar-thumb { background: rgba(255,255,255,.18); border-radius: 3px; }
.pf-msg {
  max-width: 85%; padding: 9px 13px; border-radius: 16px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere;
  animation: pf-in .2s ease-out;
}
@keyframes pf-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.pf-msg.pf-user { align-self: flex-end; color: #fff; background: linear-gradient(135deg, var(--pf-accent), var(--pf-accent2)); border-bottom-right-radius: 5px; box-shadow: 0 4px 14px -4px rgba(99,102,241,.6); }
.pf-msg.pf-bot  { align-self: flex-start; background: var(--pf-surface); border: 1px solid var(--pf-line); border-bottom-left-radius: 5px; }
.pf-msg.pf-err  { align-self: flex-start; background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.35); color: #fecaca; border-bottom-left-radius: 5px; }
.pf-msg.pf-typing { display: flex; gap: 5px; align-items: center; padding: 13px 14px; }
.pf-tdot { width: 7px; height: 7px; border-radius: 50%; background: var(--pf-muted); animation: pf-bounce 1.1s infinite ease-in-out; }
.pf-tdot:nth-child(2) { animation-delay: .15s; }
.pf-tdot:nth-child(3) { animation-delay: .3s; }
@keyframes pf-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: .45; } 30% { transform: translateY(-5px); opacity: 1; } }

/* suggestion chips */
.pf-chips { flex: none; display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 14px 8px; }
.pf-chip {
  padding: 6px 11px; border: 1px solid rgba(99,102,241,.5); border-radius: 999px; background: rgba(99,102,241,.12);
  color: #c7c9ff; font-size: 12.5px; cursor: pointer; transition: background .15s, transform .1s;
}
.pf-chip:hover { background: rgba(99,102,241,.28); }
.pf-chip:active { transform: scale(.96); }

/* composer */
.pf-chat-form { flex: none; padding: 8px 12px 10px; border-top: 1px solid var(--pf-line); }
.pf-chat-field {
  display: flex; align-items: flex-end; gap: 8px; padding: 6px 6px 6px 14px; background: var(--pf-surface);
  border: 1px solid var(--pf-line); border-radius: 22px; transition: border-color .15s, box-shadow .15s;
}
.pf-chat-field:focus-within { border-color: rgba(99,102,241,.7); box-shadow: 0 0 0 3px rgba(99,102,241,.2); }
.pf-chat-input {
  flex: 1; min-width: 0; resize: none; border: 0; outline: 0; background: transparent; color: var(--pf-text);
  font: inherit; line-height: 1.4; padding: 7px 0; max-height: 96px;
}
.pf-chat-input::placeholder { color: var(--pf-muted); }
.pf-chat-send {
  flex: none; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 50%; cursor: pointer; display: grid; place-items: center;
  color: #fff; background: linear-gradient(135deg, var(--pf-accent), var(--pf-accent2)); transition: transform .12s, opacity .15s, filter .15s;
}
.pf-chat-send:hover:not(:disabled) { filter: brightness(1.12); }
.pf-chat-send:active:not(:disabled) { transform: scale(.92); }
.pf-chat-send:disabled { opacity: .35; cursor: default; }
.pf-chat-send svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.pf-chat-note { margin-top: 7px; text-align: center; font-size: 11px; color: var(--pf-muted); opacity: .8; }

/* API-key setup card */
.pf-setup { flex: none; margin: 14px 14px 0; padding: 14px; background: rgba(251,191,36,.08); border: 1px solid rgba(251,191,36,.28); border-radius: 14px; line-height: 1.45; }
.pf-setup-title { font-weight: 650; margin-bottom: 4px; color: #fde68a; }
.pf-setup p { margin: 0 0 10px; color: var(--pf-text); font-size: 13px; }
.pf-setup small { display: block; margin-top: 8px; color: var(--pf-muted); font-size: 11.5px; }
.pf-setup-form { display: flex; gap: 8px; }
.pf-key-input { flex: 1; min-width: 0; padding: 8px 11px; border: 1px solid var(--pf-line); border-radius: 10px; background: var(--pf-surface); color: var(--pf-text); font: inherit; outline: 0; }
.pf-key-input:focus { border-color: rgba(99,102,241,.7); box-shadow: 0 0 0 3px rgba(99,102,241,.2); }
.pf-key-save { padding: 0 14px; border: 0; border-radius: 10px; color: #fff; font: inherit; font-weight: 600; cursor: pointer; background: linear-gradient(135deg, var(--pf-accent), var(--pf-accent2)); }

@media (prefers-reduced-motion: reduce) {
  .pf-chat.pf-open, .pf-msg, .pf-tdot { animation: none; }
  .pf-chat-log { scroll-behavior: auto; }
}
`;

let injected = false;

/**
 * Adds the CSS once. A constructable stylesheet is used when available because,
 * unlike a <style> tag, it is not blocked by a strict Content-Security-Policy
 * (style-src without 'unsafe-inline'); a <style> tag is the fallback.
 */
export function injectStyles() {
  if (typeof document === 'undefined' || injected || document.getElementById('petfolio-ui-style')) return;
  injected = true;
  try {
    if ('adoptedStyleSheets' in document && typeof CSSStyleSheet !== 'undefined' && 'replaceSync' in CSSStyleSheet.prototype) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      return;
    }
  } catch { /* fall through to <style> */ }
  const el = document.createElement('style');
  el.id = 'petfolio-ui-style';
  el.textContent = CSS;
  document.head.appendChild(el);
}
