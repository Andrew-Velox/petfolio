/** node --test test/  — knowledge loading + chat client (fetch is mocked, no network). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeKnowledge, formatSections, loadKnowledge, MAX_CONTENT_CHARS, MAX_PERSONALITY_CHARS } from '../src/ai/knowledge.js';
import { ChatClient, ChatError, buildMessages } from '../src/ai/client.js';

// What `petfolio-cli about-me.txt` writes.
const KB = {
  version: 2,
  sections: [
    { title: 'About', text: 'Andrew is a full-stack developer based in Dhaka. He loves Rust.' },
    { title: 'Projects > Petfolio', text: 'Petfolio is a Shimeji-style pet for websites.' },
    { title: 'Contact', text: 'You can reach Andrew by email.' },
  ],
  personality: 'Cheerful and a little shy.',
};
const KB_TEXT = [
  '## About\nAndrew is a full-stack developer based in Dhaka. He loves Rust.',
  '## Projects > Petfolio\nPetfolio is a Shimeji-style pet for websites.',
  '## Contact\nYou can reach Andrew by email.',
].join('\n\n');

const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const okFetch = (answer, spy = []) => async (url, init) => {
  spy.push({ url, init, body: init?.body ? JSON.parse(init.body) : null });
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: answer } }] }) };
};
/** fetch that serves the knowledge file for GETs and the model for POSTs */
const siteFetch = (answer, { kb = KB, spy = [] } = {}) => async (url, init = {}) => {
  if (init.method === 'POST') return okFetch(answer, spy)(url, init);
  spy.push({ url, init, kbRequest: true });
  return { ok: true, status: 200, json: async () => kb };
};

test('normalizeKnowledge: CLI sections, {content}, plain string, and junk', () => {
  assert.deepEqual(normalizeKnowledge(KB), {
    content: KB_TEXT, personality: KB.personality, topics: ['About', 'Projects > Petfolio', 'Contact'], truncated: false,
  });
  assert.deepEqual(normalizeKnowledge({ content: ' plain facts ' }), { content: 'plain facts', personality: '', topics: [], truncated: false });
  assert.deepEqual(normalizeKnowledge('  hello there '), { content: 'hello there', personality: '', topics: [], truncated: false });
  assert.equal(formatSections(KB.sections), KB_TEXT);
  // sections with a missing title or text are ignored
  assert.equal(normalizeKnowledge({ sections: [{ title: 'A' }, { text: 'b' }, null, { title: 'C', text: 'd' }] }).content, '## C\nd');
  for (const junk of [null, undefined, 42, [], [{ source: 'x', content: 'old array format' }], { content: 7 }, { sections: 'nope' }]) {
    const k = normalizeKnowledge(junk);
    assert.equal(k.content, '', JSON.stringify(junk));
    assert.equal(k.personality, '');
  }
});

test('normalizeKnowledge cuts oversized text and says so', () => {
  const k = normalizeKnowledge({ content: 'x'.repeat(MAX_CONTENT_CHARS + 5), personality: 'y'.repeat(MAX_PERSONALITY_CHARS + 5) });
  assert.equal(k.content.length, MAX_CONTENT_CHARS);
  assert.equal(k.personality.length, MAX_PERSONALITY_CHARS);
  assert.equal(k.truncated, true);
});

test('loadKnowledge: URL (default path, revalidated), inline data, text that is not a URL', async () => {
  const calls = [];
  const fetchOk = async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => KB }; };
  assert.equal((await loadKnowledge(undefined, fetchOk)).content, KB_TEXT);
  assert.equal(calls[0].url, '/petfolio-knowledge.json');
  assert.equal(calls[0].init.cache, 'no-cache');
  assert.equal((await loadKnowledge('https://example.com/k.json', fetchOk)).personality, KB.personality);
  assert.equal(calls.length, 2);

  assert.equal((await loadKnowledge(KB, fetchOk)).content, KB_TEXT);
  const text = await loadKnowledge('/my site: open 9 to 5', fetchOk);   // has spaces → it is the text, not a URL
  assert.equal(text.content, '/my site: open 9 to 5');
  assert.equal(calls.length, 2, 'inline data never touches the network');
});

test('loadKnowledge: a missing file or bad JSON gives empty knowledge plus loadError', async () => {
  const miss = await loadKnowledge('/nope.json', async () => ({ ok: false, status: 404 }));
  assert.equal(miss.content, '');
  assert.match(miss.loadError.message, /404/);
  const bad = await loadKnowledge('/bad.json', async () => ({ ok: true, json: async () => { throw new SyntaxError('x'); } }));
  assert.ok(bad.loadError);
  const down = await loadKnowledge('/k.json', async () => { throw new TypeError('offline'); });
  assert.ok(down.loadError);
});

test('buildMessages: rules, personality and the WHOLE text in one system message; capped history; question last', () => {
  const history = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
  const msgs = buildMessages({ name: 'Mishi', knowledge: normalizeKnowledge(KB), history, question: 'Q?' });
  assert.equal(msgs[0].role, 'system');
  const sys = msgs[0].content;
  assert.match(sys, /Mishi/);
  assert.match(sys, /ONLY the information between the <knowledge> tags/);
  assert.match(sys, /Cheerful and a little shy\./);
  assert.ok(sys.includes(`<knowledge>\n${KB_TEXT}\n</knowledge>`), 'all of the text is included, untouched');
  assert.match(sys, /Topics covered: About; Projects > Petfolio; Contact\./);
  assert.match(sys, /titled sections/);
  assert.ok(sys.indexOf('Cheerful') < sys.lastIndexOf('<knowledge>'), 'rules and personality come before the long text');
  assert.equal(msgs.filter((m) => m.role === 'system').length, 1);
  assert.equal(msgs.at(-1).content, 'Q?');
  assert.equal(msgs.length, 1 + 6 + 1);
});

test('buildMessages: no personality section / no knowledge still gives a safe prompt', () => {
  const noPersona = buildMessages({ name: 'P', knowledge: { content: 'Fact.' }, question: 'q' })[0].content;
  assert.doesNotMatch(noPersona, /personality and tone/);
  assert.match(noPersona, /<knowledge>\nFact\.\n<\/knowledge>/);
  const none = buildMessages({ name: 'P', knowledge: { content: '', personality: '', topics: [] }, question: 'q' })[0].content;
  assert.match(none, /\(no information available\)/);
});

test('direct mode: Bearer key, Groq URL, the full text in the prompt', async () => {
  const spy = [];
  const c = new ChatClient({ knowledge: KB, apiKey: 'gsk_test', fetch: okFetch('He builds pets!', spy), storage: memStorage() });
  const r = await c.ask('what projects has he built?');
  assert.deepEqual(r, { answer: 'He builds pets!' });
  assert.match(spy[0].url, /api\.groq\.com/);
  assert.equal(spy[0].init.headers.Authorization, 'Bearer gsk_test');
  assert.ok(spy[0].body.messages[0].content.includes(KB_TEXT), 'not just the matching sentences — everything');
});

test('the knowledge file is fetched once from the default path, then reused for every question', async () => {
  const spy = [];
  const c = new ChatClient({ endpoint: '/api/petfolio', fetch: siteFetch('ok', { spy }), storage: memStorage() });
  await c.ask('one');
  await c.ask('two');
  const gets = spy.filter((x) => x.kbRequest);
  assert.equal(gets.length, 1);
  assert.equal(gets[0].url, '/petfolio-knowledge.json');
  const posts = spy.filter((x) => !x.kbRequest);
  assert.equal(posts.length, 2);
  assert.ok(posts.every((p) => p.body.messages[0].content.includes(KB_TEXT)));
});

test('a failed knowledge load is not cached: the next question retries and then works', async () => {
  const warn = console.warn; const warnings = []; console.warn = (m) => warnings.push(m);
  try {
    let up = false;
    const fetchImpl = async (url, init = {}) => {
      if (init.method === 'POST') return okFetch('ok')(url, init);
      return up ? { ok: true, json: async () => KB } : { ok: false, status: 404 };
    };
    const c = new ChatClient({ endpoint: '/api/petfolio', fetch: fetchImpl, storage: memStorage() });
    await c.ask('first');                       // still answers (the model will say it doesn't know)…
    assert.match(warnings[0], /petfolio-cli about-me\.txt/);   // …and the developer is told how to fix it
    assert.equal(c.knowledge, null);
    up = true;
    await c.ask('second');
    assert.equal(c.knowledge.content, KB_TEXT);
  } finally { console.warn = warn; }
});

test('proxy mode: posts to the endpoint and never sends an Authorization header', async () => {
  const spy = [];
  const c = new ChatClient({ knowledge: KB, endpoint: '/api/petfolio', apiKey: 'should-not-leak', fetch: okFetch('ok', spy), storage: memStorage() });
  await c.ask('hello');
  assert.equal(spy.length, 1, 'inline knowledge: the only request is the chat call');
  assert.equal(spy[0].url, '/api/petfolio');
  assert.equal(spy[0].init.headers.Authorization, undefined);
});

test('no key and no endpoint → no-key error, nothing sent', async () => {
  let called = false;
  const c = new ChatClient({ knowledge: KB, fetch: async () => { called = true; }, storage: memStorage() });
  assert.equal(c.ready, false);
  await assert.rejects(c.ask('hi'), (e) => e instanceof ChatError && e.kind === 'no-key');
  assert.equal(called, false);
});

test('HTTP and network failures map to friendly error kinds', async () => {
  const mk = (status) => new ChatClient({ knowledge: KB, apiKey: 'k', storage: memStorage(), fetch: async () => ({ ok: false, status }) });
  await assert.rejects(mk(401).ask('q'), { kind: 'auth' });
  await assert.rejects(mk(429).ask('q'), { kind: 'rate' });
  await assert.rejects(mk(500).ask('q'), { kind: 'server' });
  const down = new ChatClient({ knowledge: KB, apiKey: 'k', storage: memStorage(), fetch: async () => { throw new TypeError('x'); } });
  await assert.rejects(down.ask('q'), { kind: 'network' });
  const empty = new ChatClient({ knowledge: KB, apiKey: 'k', storage: memStorage(), fetch: okFetch('   ') });
  await assert.rejects(empty.ask('q'), { kind: 'empty' });
});

test('a pasted key is remembered in storage and can be cleared', () => {
  const storage = memStorage();
  const a = new ChatClient({ storage });
  a.setApiKey('  gsk_abc  ');
  assert.equal(new ChatClient({ storage }).apiKey, 'gsk_abc');
  a.clearApiKey();
  assert.equal(new ChatClient({ storage }).ready, false);
});
