/**
 * ui/chat.js — The chat panel.
 *
 * All text is inserted with textContent (never innerHTML), so neither the
 * visitor's input nor the model's answer can inject markup. (innerHTML is
 * used only for the static SVG icons in icons.js.)
 */
import { ChatError } from '../ai/client.js';
import { ICONS } from './icons.js';

const PANEL_W = 340;
const MAX_H   = 480;
const MIN_H   = 260;
const MAX_INPUT_PX = 96;           // textarea grows up to ~4 lines

const PROVIDER_LABEL = { groq: 'Groq', gemini: 'Gemini' };
const DEFAULT_SUGGESTIONS = ['What do you do?', 'Show me your projects', 'How can I contact you?'];

/**
 * @param {object}   o
 * @param {ChatClient} o.client
 * @param {string}   [o.name]
 * @param {string[]} [o.suggestions]  starter questions shown as chips (empty array = none)
 * @param {Function} [o.onOpen]    called when the panel opens (pet stands still)
 * @param {Function} [o.onClose]   called when it closes (pet resumes)
 */
export function createChat({ client, name = 'Petfolio', suggestions = DEFAULT_SUGGESTIONS, onOpen, onClose }) {
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const iconButton = (cls, icon, label) => {
    const b = el('button', cls);
    b.type = 'button';
    b.title = label;
    b.setAttribute('aria-label', label);
    b.innerHTML = ICONS[icon];            // static, trusted markup
    return b;
  };

  // ── Skeleton ────────────────────────────────────────────
  const root = el('div', 'pf-ui pf-chat');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', `Chat with ${name}`);

  const head   = el('div', 'pf-chat-head');
  const spark  = el('span', 'pf-chat-spark');
  spark.innerHTML = ICONS.sparkle;             // static, trusted markup
  const who    = el('div', 'pf-chat-who');
  const title  = el('div', 'pf-chat-title', name);
  const status = el('div', 'pf-chat-status');
  const statusText = el('span', '', 'Ready');
  status.append(el('span', 'pf-dot'), statusText);
  who.append(title, status);
  const reset = iconButton('pf-chat-icon', 'reset', 'New conversation');
  const close = iconButton('pf-chat-icon pf-chat-close', 'close', 'Close chat');
  head.append(spark, who, reset, close);

  const setup = el('div', 'pf-setup');
  const log   = el('div', 'pf-chat-log');
  log.setAttribute('aria-live', 'polite');
  const chips = el('div', 'pf-chips');

  const form  = el('form', 'pf-chat-form');
  const field = el('div', 'pf-chat-field');
  const input = el('textarea', 'pf-chat-input');
  input.rows = 1;
  input.placeholder = `Message ${name}…`;
  input.maxLength = 500;
  input.setAttribute('aria-label', `Message ${name}`);
  const send = iconButton('pf-chat-send', 'send', 'Send');
  send.type = 'submit';
  send.disabled = true;
  field.append(input, send);
  form.append(field, el('div', 'pf-chat-note', `Answers come from this site's content and may be imperfect.`));

  root.append(head, setup, log, chips, form);
  document.body.appendChild(root);

  // ── State ───────────────────────────────────────────────
  const history = [];          // {role, content} sent back for follow-up questions
  let busy = false;

  const scrollDown = () => { log.scrollTop = log.scrollHeight; };

  function addMessage(kind, text) {
    const m = el('div', `pf-msg pf-${kind}`, text);
    log.appendChild(m);
    scrollDown();
    return m;
  }

  function refreshSend() { send.disabled = busy || !input.value.trim(); }

  function setBusy(on) {
    busy = on;
    root.classList.toggle('pf-busy', on);
    statusText.textContent = on ? 'Typing…' : 'Ready';
    refreshSend();
  }

  function autosize() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, MAX_INPUT_PX)}px`;
    refreshSend();
  }

  function renderChips() {
    chips.replaceChildren();
    const show = client.ready && suggestions.length > 0 && history.length === 0 && !busy;
    chips.style.display = show ? '' : 'none';
    if (!show) return;
    for (const text of suggestions) {
      const c = el('button', 'pf-chip', text);
      c.type = 'button';
      c.addEventListener('click', () => { input.value = text; ask(); });
      chips.appendChild(c);
    }
  }

  function renderSetup() {
    setup.replaceChildren();
    const needsKey = !client.ready;
    setup.style.display = needsKey ? '' : 'none';
    form.style.display  = needsKey ? 'none' : '';
    renderChips();
    if (!needsKey) return;

    setup.append(
      el('div', 'pf-setup-title', 'Connect an API key'),
      el('p', '', `Paste a ${PROVIDER_LABEL[client.provider] ?? 'Groq'} API key to start chatting (free tiers work).`),
    );
    const f  = el('form', 'pf-setup-form');
    const k  = el('input', 'pf-key-input');
    k.type = 'password';
    k.placeholder = 'API key';
    k.autocomplete = 'off';
    const ok = el('button', 'pf-key-save', 'Save');
    ok.type = 'submit';
    f.append(k, ok);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!k.value.trim()) return;
      client.setApiKey(k.value);
      renderSetup();
      input.focus();
    });
    setup.append(f, el('small', '', 'Saved only in this browser. For a public site, use a server endpoint so the key stays private.'));
  }

  function greet() {
    if (log.childElementCount === 0) addMessage('bot', `Hi! I'm ${name} 👋 Ask me anything about this site.`);
  }

  function newConversation() {
    if (busy) return;
    history.length = 0;
    log.replaceChildren();
    greet();
    renderChips();
    input.focus();
  }

  // ── Sending ─────────────────────────────────────────────
  async function ask() {
    const question = input.value.trim();
    if (!question || busy) return;
    input.value = '';
    autosize();
    addMessage('user', question);
    chips.style.display = 'none';

    const typing = el('div', 'pf-msg pf-bot pf-typing');
    typing.setAttribute('aria-label', `${name} is typing`);
    for (let i = 0; i < 3; i++) typing.appendChild(el('span', 'pf-tdot'));
    log.appendChild(typing);
    scrollDown();
    setBusy(true);

    try {
      const { answer } = await client.ask(question, history);
      history.push({ role: 'user', content: question }, { role: 'assistant', content: answer });
      typing.className = 'pf-msg pf-bot';
      typing.textContent = answer;
    } catch (err) {
      typing.className = 'pf-msg pf-err';
      typing.textContent = err instanceof ChatError ? err.message : 'Something went wrong.';
      if (err instanceof ChatError && err.kind === 'auth' && !client.usesProxy) {
        client.clearApiKey();            // wrong key: ask for a new one
        renderSetup();
      }
    } finally {
      setBusy(false);
      scrollDown();
      input.focus();
    }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); ask(); });
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', (e) => {
    // Enter sends, Shift+Enter inserts a newline (never while composing IME text).
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(); }
  });
  reset.addEventListener('click', newConversation);

  // Where the panel was last placed (skip DOM writes while the pet stands still).
  let placed = '';

  const api = {
    get isOpen() { return root.classList.contains('pf-open'); },
    open() {
      const wasOpen = api.isOpen;
      renderSetup();
      greet();
      root.classList.add('pf-open');
      if (!wasOpen) onOpen?.();
      (client.ready ? input : setup.querySelector('input'))?.focus();
    },
    close() {
      if (!api.isOpen) return;
      root.classList.remove('pf-open');
      placed = '';
      onClose?.();
    },
    toggle() { api.isOpen ? api.close() : api.open(); },

    /**
     * Take the speech bubble's place: bottom edge at the bubble's anchor,
     * growing right when the pet faces right and left when it faces left.
     * @param {{x:number,y:number,facingRight:boolean}} at  bubble.placement() (canvas px)
     * @param {{left:number,top:number}} origin  canvas position in the page
     */
    follow(at, origin = { left: 0, top: 0 }) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w  = Math.min(PANEL_W, vw - 16);
      const ax = origin.left + at.x;
      const ay = origin.top + at.y;
      const left   = Math.max(8, Math.min(at.facingRight ? ax : ax - w, vw - w - 8));
      const bottom = Math.max(8, vh - ay);
      const maxH   = Math.max(MIN_H, Math.min(MAX_H, vh - bottom - 8));
      const key = `${Math.round(left)}|${Math.round(bottom)}|${Math.round(maxH)}|${w}|${at.facingRight}`;
      if (key === placed) return;
      placed = key;
      root.style.left      = `${left}px`;
      root.style.bottom    = `${bottom}px`;
      root.style.width     = `${w}px`;
      root.style.maxHeight = `${maxH}px`;
      root.dataset.side    = at.facingRight ? 'right' : 'left';   // pop-in grows from the pet's side
    },
    destroy() { root.remove(); },
  };
  close.addEventListener('click', api.close);
  return api;
}
