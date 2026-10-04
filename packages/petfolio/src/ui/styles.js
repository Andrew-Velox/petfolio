/** ui/styles.js — CSS for the menu and chat panel (injected once, `pf-` prefixed). */

const CSS = `
.pf-ui, .pf-ui * { box-sizing: border-box; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }

/* ── Icon bar ─────────────────────────────────────────── */
.pf-menu {
  position: fixed; z-index: 100001; display: none; gap: 6px; padding: 8px 10px;
  background: #ffffffad; border-radius: 14px; box-shadow: 0 6px 24px rgba(0,0,0,.28);
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

/* ── Chat panel (takes the place of the pet's speech bubble) ── */
.pf-chat {
  --pf-bg: #fff; --pf-body: #f6f8fb; --pf-line: #e3e8f0; --pf-line-strong: #d3dae6;
  --pf-text: #1f2937; --pf-muted: #6b7280; --pf-accent: #2563eb; --pf-accent-hover: #1d4ed8;
  position: fixed; z-index: 100003; left: 8px; bottom: 8px; width: min(340px, calc(100vw - 16px));
  max-height: min(480px, calc(100vh - 40px)); display: none; flex-direction: column;
  background: var(--pf-bg); color: var(--pf-text); border: 1px solid var(--pf-line); border-radius: 14px;
  box-shadow: 0 16px 44px -10px rgba(15,23,42,.28), 0 2px 6px rgba(15,23,42,.06);
  transform-origin: bottom left; font: 14px/1.4 Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.pf-chat[data-side="right"] { transform-origin: bottom left; }
.pf-chat[data-side="left"]  { transform-origin: bottom right; }
.pf-chat.pf-open { display: flex; animation: pf-pop .2s cubic-bezier(.2,.9,.3,1.15); }
@keyframes pf-pop { from { opacity: 0; transform: translateY(8px) scale(.96); } to { opacity: 1; transform: none; } }
/* tail pointing down at the pet */
.pf-chat::after {
  content: ""; position: absolute; bottom: -7px; width: 12px; height: 12px; background: var(--pf-bg);
  border-right: 1px solid var(--pf-line); border-bottom: 1px solid var(--pf-line); transform: rotate(45deg);
}
.pf-chat[data-side="right"]::after { left: 26px; }
.pf-chat[data-side="left"]::after  { right: 26px; }

/* header: sparkle + name + status pill ... reset, close */
.pf-chat-head {
  flex: none; display: flex; align-items: center; gap: 8px; padding: 11px 10px 11px 14px;
  background: var(--pf-bg); border-bottom: 1px solid var(--pf-line); border-radius: 14px 14px 0 0;
}
.pf-chat-spark { flex: none; display: grid; place-items: center; width: 20px; height: 20px; color: #f59e0b; }
.pf-chat-spark svg { width: 18px; height: 18px; fill: currentColor; stroke: none; }
.pf-chat-title { font-weight: 700; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.pf-chat-who { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }
.pf-chat-status {
  flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px 2px 8px;
  border: 1px solid var(--pf-line-strong); border-radius: 999px; font-size: 12px; color: var(--pf-muted); background: var(--pf-bg);
}
.pf-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; }
.pf-busy .pf-dot { background: #f59e0b; }
.pf-chat-icon {
  flex: none; width: 30px; height: 30px; padding: 0; border: 0; border-radius: 8px; background: transparent;
  color: var(--pf-muted); cursor: pointer; display: grid; place-items: center; transition: background .15s, color .15s;
}
.pf-chat-icon:hover { background: #eef1f6; color: var(--pf-text); }
.pf-chat-icon:focus-visible, .pf-chip:focus-visible, .pf-chat-send:focus-visible { outline: 2px solid var(--pf-accent); outline-offset: 2px; }
.pf-chat-icon svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

/* messages */
.pf-chat-log {
  flex: 1; min-height: 140px; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px;
  background: var(--pf-body); scroll-behavior: smooth; scrollbar-width: thin; scrollbar-color: #cbd3e0 transparent;
}
.pf-chat-log::-webkit-scrollbar { width: 6px; }
.pf-chat-log::-webkit-scrollbar-thumb { background: #cbd3e0; border-radius: 3px; }
.pf-msg {
  max-width: 85%; padding: 9px 13px; border-radius: 10px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere;
  animation: pf-in .18s ease-out;
}
@keyframes pf-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
.pf-msg.pf-user { align-self: flex-end; color: #fff; background: var(--pf-accent); }
.pf-msg.pf-bot  { align-self: flex-start; background: var(--pf-bg); border: 1px solid var(--pf-line); }
.pf-msg.pf-err  { align-self: flex-start; background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }
.pf-msg.pf-typing { display: flex; gap: 5px; align-items: center; padding: 13px 14px; }
.pf-tdot { width: 7px; height: 7px; border-radius: 50%; background: #9aa5b8; animation: pf-bounce 1.1s infinite ease-in-out; }
.pf-tdot:nth-child(2) { animation-delay: .15s; }
.pf-tdot:nth-child(3) { animation-delay: .3s; }
@keyframes pf-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: .5; } 30% { transform: translateY(-4px); opacity: 1; } }

/* suggestion chips */
.pf-chips { flex: none; display: flex; flex-wrap: wrap; gap: 6px; padding: 0 14px 10px; background: var(--pf-body); }
.pf-chip {
  padding: 6px 11px; border: 1px solid var(--pf-line-strong); border-radius: 999px; background: var(--pf-bg);
  color: var(--pf-accent); font: inherit; font-size: 12.5px; cursor: pointer; transition: background .15s, border-color .15s;
}
.pf-chip:hover { background: #eff5ff; border-color: #b6ccf5; }
.pf-chip:active { transform: scale(.97); }

/* composer */
.pf-chat-form { flex: none; padding: 10px 12px 12px; background: var(--pf-bg); border-top: 1px solid var(--pf-line); border-radius: 0 0 14px 14px; }
.pf-chat-field { display: flex; align-items: flex-end; gap: 8px; }
.pf-chat-input {
  flex: 1; min-width: 0; resize: none; outline: 0; background: var(--pf-bg); color: var(--pf-text);
  border: 1px solid var(--pf-line-strong); border-radius: 8px; font: inherit; line-height: 1.4; padding: 9px 12px; max-height: 96px;
  transition: border-color .15s, box-shadow .15s;
}
.pf-chat-input:focus { border-color: var(--pf-accent); box-shadow: 0 0 0 3px rgba(37,99,235,.15); }
.pf-chat-input::placeholder { color: #9aa3b2; }
.pf-chat-send {
  flex: none; width: 40px; height: 40px; padding: 0; border: 0; border-radius: 8px; cursor: pointer; display: grid; place-items: center;
  color: #fff; background: var(--pf-accent); transition: background .15s, transform .1s;
}
.pf-chat-send:hover:not(:disabled) { background: var(--pf-accent-hover); }
.pf-chat-send:active:not(:disabled) { transform: scale(.94); }
.pf-chat-send:disabled { background: #e8ecf2; color: #9aa5b8; cursor: default; }
.pf-chat-send svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.pf-chat-note { display: none; }

/* API-key setup card */
.pf-setup { flex: none; margin: 14px; padding: 14px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; line-height: 1.45; }
.pf-setup-title { font-weight: 700; margin-bottom: 4px; color: #92400e; }
.pf-setup p { margin: 0 0 10px; color: var(--pf-text); font-size: 13px; }
.pf-setup small { display: block; margin-top: 8px; color: var(--pf-muted); font-size: 11.5px; }
.pf-setup-form { display: flex; gap: 8px; }
.pf-key-input { flex: 1; min-width: 0; padding: 8px 11px; border: 1px solid var(--pf-line-strong); border-radius: 8px; background: #fff; color: var(--pf-text); font: inherit; outline: 0; }
.pf-key-input:focus { border-color: var(--pf-accent); box-shadow: 0 0 0 3px rgba(37,99,235,.15); }
.pf-key-save { padding: 0 14px; border: 0; border-radius: 8px; color: #fff; font: inherit; font-weight: 600; cursor: pointer; background: var(--pf-accent); }

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
