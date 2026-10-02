/** node --test test/  — knowledge search + chat client (fetch is mocked, no network). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KnowledgeIndex, chunkText, tokenize, normalizeKnowledge, loadKnowledge } from '../src/ai/knowledge.js';
import { ChatClient, ChatError, buildMessages } from '../src/ai/client.js';

const KB = [
  { source: 'src/pages/about.jsx', content: 'Andrew is a full-stack developer based in Dhaka. He loves Rust and building desktop pets. He has five years of experience.' },
  { source: 'src/pages/projects.jsx', content: 'Petfolio is a Shimeji-style pet for websites. Mocap RS is a motion capture tool written in Rust using MediaPipe.' },
  { source: 'src/pages/contact.jsx', content: 'You can reach Andrew by email or on GitHub. He replies within two days.' },
];

const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const okFetch = (answer, spy = []) => async (url, init) => {
  spy.push({ url, init, body: JSON.parse(init.body) });
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: answer } }] }) };
};

test('tokenize drops stopwords and stems simple plurals', () => {
  assert.deepEqual(tokenize('What are the projects?'), ['project']);
});

test('normalizeKnowledge accepts CLI array, {entries} and strings; drops junk', () => {
  assert.equal(normalizeKnowledge(KB).length, 3);
  assert.equal(normalizeKnowledge({ entries: KB }).length, 3);
  assert.equal(normalizeKnowledge('hello there')[0].content, 'hello there');
  assert.deepEqual(normalizeKnowledge([{ source: 'x' }, null, { content: '  ' }]), []);
  assert.deepEqual(normalizeKnowledge(42), []);
});

test('chunkText respects the size and splits oversized sentences', () => {
  const chunks = chunkText('One. Two. Three. ' + 'x'.repeat(1200), 100);
  assert.ok(chunks.every((c) => c.length <= 100));
  assert.ok(chunks.length >= 13);
});

test('search ranks the relevant file first', () => {
  const idx = new KnowledgeIndex(KB);
  assert.equal(idx.search('Which projects did he build with Rust?')[0].source, 'src/pages/projects.jsx');
  assert.equal(idx.search('how can I contact him')[0].source, 'src/pages/contact.jsx');
});

test('search falls back to an overview for generic questions and respects limits', () => {
  const idx = new KnowledgeIndex(KB);
  const r = idx.search('hi who are you', { limit: 2 });
  assert.equal(r.length, 2);
  const tiny = idx.search('rust', { maxChars: 10 });
  assert.equal(tiny.length, 1, 'always returns at least the best chunk');
});

test('loadKnowledge: inline data, URL, and a missing file', async () => {
  assert.equal((await loadKnowledge(KB)).size, 3);
  const fetchOk = async () => ({ ok: true, json: async () => KB });
  assert.equal((await loadKnowledge('/petfolio-knowledgeBase.json', fetchOk)).size, 3);
  const miss = await loadKnowledge('/nope.json', async () => ({ ok: false, status: 404 }));
  assert.equal(miss.size, 0);
  assert.ok(miss.loadError);
});

test('buildMessages: grounded system prompt, capped history, question last', () => {
  const history = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
  const msgs = buildMessages({ name: 'Mishi', context: [{ source: 'a.js', text: 'Fact one.' }], history, question: 'Q?' });
  assert.equal(msgs[0].role, 'system');
  assert.match(msgs[0].content, /Mishi/);
  assert.match(msgs[0].content, /\[1\] \(a\.js\) Fact one\./);
  assert.equal(msgs.at(-1).content, 'Q?');
  assert.equal(msgs.length, 1 + 6 + 1);
});

test('direct mode: Bearer key, Groq URL, retrieved context in the prompt, sources returned', async () => {
  const spy = [];
  const c = new ChatClient({ knowledge: KB, apiKey: 'gsk_test', fetch: okFetch('He builds pets!', spy), storage: memStorage() });
  const r = await c.ask('what projects has he built?');
  assert.equal(r.answer, 'He builds pets!');
  assert.ok(r.sources.includes('src/pages/projects.jsx'));
  assert.match(spy[0].url, /api\.groq\.com/);
  assert.equal(spy[0].init.headers.Authorization, 'Bearer gsk_test');
  assert.match(spy[0].body.messages[0].content, /Petfolio is a Shimeji-style pet/);
});

test('proxy mode: posts to the endpoint and never sends an Authorization header', async () => {
  const spy = [];
  const c = new ChatClient({ knowledge: KB, endpoint: '/api/petfolio', apiKey: 'should-not-leak', fetch: okFetch('ok', spy), storage: memStorage() });
  await c.ask('hello');
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
