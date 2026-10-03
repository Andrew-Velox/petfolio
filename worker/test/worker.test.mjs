/** node --test test/  — the Worker handler, with the AI provider mocked (no network, no key). */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const PAGES = 'https://andrew-velox.github.io';
const ENV = { PETFOLIO_GROQ_API_KEY: 'gsk_test_key', PETFOLIO_ALLOWED_ORIGINS: `${PAGES}/` };   // trailing slash is tolerated
const OK = { messages: [{ role: 'system', content: 'rules + facts' }, { role: 'user', content: 'hi' }] };

let upstream;       // what the Worker sent to the provider
let reply;          // what the mocked provider answers
const realFetch = globalThis.fetch;
beforeEach(() => {
  upstream = [];
  reply = () => Response.json({ choices: [{ message: { content: 'Hello!' } }] });
  globalThis.fetch = async (url, init) => { upstream.push({ url, init, body: JSON.parse(init.body) }); return reply(); };
});
afterEach(() => { globalThis.fetch = realFetch; });

let nextIp = 1;     // a fresh visitor per request, so the (shared, in-memory) rate limiter doesn't leak between tests
const post = (body, { origin, env = ENV, headers = {} } = {}) =>
  worker.fetch(new Request('https://chat.example.workers.dev/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `198.51.100.${nextIp++ % 250}`, ...(origin && { Origin: origin }), ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }), env);

test('happy path: key added server-side, model and limits chosen by the Worker, CORS for the Pages origin', async () => {
  const res = await post({ ...OK, model: 'evil-model', max_tokens: 99999 }, { origin: PAGES });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { choices: [{ message: { content: 'Hello!' } }] });
  assert.equal(res.headers.get('access-control-allow-origin'), PAGES);
  assert.equal(res.headers.get('vary'), 'Origin');
  const u = upstream[0];
  assert.match(u.url, /api\.groq\.com/);
  assert.equal(u.init.headers.Authorization, 'Bearer gsk_test_key');
  assert.equal(u.body.model, 'qwen/qwen3.8-27b');
  assert.equal(u.body.max_tokens, 350);
  assert.equal(u.body.temperature, 0.3);
  assert.deepEqual(u.body.messages, OK.messages);
  assert.equal('reasoning_effort' in u.body, false);
});

test('origins: other sites are refused (also on preflight); no Origin (curl) is fine; no CORS headers for strangers', async () => {
  const evil = await post(OK, { origin: 'https://evil.example' });
  assert.equal(evil.status, 403);
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
  assert.equal(upstream.length, 0, 'nothing is forwarded for a refused origin');
  assert.equal((await post(OK)).status, 200);

  const pre = (origin) => worker.fetch(new Request('https://x/', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' } }), ENV);
  const good = await pre(PAGES);
  assert.equal(good.status, 204);
  assert.equal(good.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
  assert.equal(good.headers.get('access-control-allow-headers'), 'Content-Type');
  assert.equal((await pre('https://evil.example')).status, 403);
  // an empty allow-list means: no browser site may call it
  assert.equal((await post(OK, { origin: PAGES, env: { PETFOLIO_GROQ_API_KEY: 'k' } })).status, 403);
});

test('validation: one system message first, size caps, message count, bad JSON', async () => {
  const sys = (n) => ({ role: 'system', content: 'x'.repeat(n) });
  const usr = (c = 'q') => ({ role: 'user', content: c });
  const cases = {
    'no system message': { messages: [usr()] },
    'system not first': { messages: [usr(), sys(1)] },
    'second system message injected': { messages: [sys(1), sys(1), usr()] },
    'system over 26k': { messages: [sys(26_001), usr()] },
    'user over 2k': { messages: [sys(1), usr('y'.repeat(2_001))] },
    '13 messages': { messages: [sys(1), ...Array.from({ length: 12 }, () => usr())] },
    'empty list': { messages: [] },
    'not an array': { messages: 'hi' },
    'bad role': { messages: [sys(1), { role: 'tool', content: 'x' }] },
    'content not a string': { messages: [sys(1), { role: 'user', content: 5 }] },
    'total over 32k': { messages: [sys(26_000), ...Array.from({ length: 4 }, () => usr('z'.repeat(1_900)))] },
  };
  for (const [name, body] of Object.entries(cases)) assert.equal((await post(body)).status, 400, name);
  assert.equal((await post('{not json')).status, 400);
  assert.equal((await post({ messages: [sys(20_000), usr()] })).status, 200, 'a 20k knowledge text is fine');
  assert.equal(upstream.length, 1);
});

test('a big non-Latin body (Bengali, 3 bytes/char) passes; an oversized Content-Length is refused', async () => {
  assert.equal((await post({ messages: [{ role: 'system', content: 'ব'.repeat(22_000) }, { role: 'user', content: 'hi' }] })).status, 200);
  assert.equal((await post(OK, { headers: { 'Content-Length': '200000' } })).status, 413);
});

test('not configured → 503; Gemini key selects the Gemini endpoint', async () => {
  assert.equal((await post(OK, { env: { PETFOLIO_ALLOWED_ORIGINS: PAGES } })).status, 503);
  await post(OK, { env: { PETFOLIO_GEMINI_API_KEY: 'g-key' } });
  assert.match(upstream[0].url, /generativelanguage\.googleapis\.com/);
  assert.equal(upstream[0].init.headers.Authorization, 'Bearer g-key');
  assert.equal(upstream[0].body.model, 'gemini-2.0-flash');
});

test('PETFOLIO_MODEL overrides the default; gpt-oss models get a short reasoning budget', async () => {
  await post(OK, { env: { ...ENV, PETFOLIO_MODEL: ' openai/gpt-oss-20b ' } });
  assert.equal(upstream[0].body.model, 'openai/gpt-oss-20b');
  assert.equal(upstream[0].body.reasoning_effort, 'low');
  await post(OK, { env: { ...ENV, PETFOLIO_MODEL: 'some/other-model' } });
  assert.equal(upstream[1].body.model, 'some/other-model');
  assert.equal('reasoning_effort' in upstream[1].body, false);
});

test('provider failures map to friendly statuses and the real reason is logged, not returned', async () => {
  const logged = []; const err = console.error; console.error = (m) => logged.push(m);
  try {
    const answer = async (status) => { reply = () => new Response('{"error":{"code":"model_not_found"}}', { status }); return post(OK); };
    let res = await answer(401);
    assert.equal(res.status, 502); assert.deepEqual(await res.json(), { error: 'upstream auth failed' });
    assert.equal((await answer(403)).status, 502);
    res = await answer(404);
    assert.equal(res.status, 502); assert.deepEqual(await res.json(), { error: 'upstream error' });
    assert.equal((await answer(429)).status, 429);
    assert.equal((await answer(500)).status, 502);
    assert.match(logged[2], /qwen\/qwen3\.8-27b -> HTTP 404: .*model_not_found/);
    globalThis.fetch = async () => { throw new TypeError('offline'); };
    assert.equal((await post(OK)).status, 502);
  } finally { console.error = err; }
});

test('rate limit: the 21st request in a minute from one IP gets 429; another IP is unaffected', async () => {
  const ip = '203.0.113.9';
  for (let i = 0; i < 20; i++) assert.equal((await post(OK, { headers: { 'CF-Connecting-IP': ip } })).status, 200, `request ${i + 1}`);
  assert.equal((await post(OK, { headers: { 'CF-Connecting-IP': ip } })).status, 429);
  assert.equal((await post(OK, { headers: { 'CF-Connecting-IP': '203.0.113.10' } })).status, 200);
});

test('GET is a harmless health check; other methods are 405', async () => {
  const get = await worker.fetch(new Request('https://x/'), ENV);
  assert.deepEqual(await get.json(), { ok: true, service: 'petfolio-chat', configured: true });
  assert.equal((await (await worker.fetch(new Request('https://x/'), {})).json()).configured, false);
  assert.ok(!JSON.stringify(await (await worker.fetch(new Request('https://x/'), ENV)).json()).includes('gsk_'), 'never reveals the key');
  const put = await worker.fetch(new Request('https://x/', { method: 'PUT' }), ENV);
  assert.equal(put.status, 405);
  assert.equal(put.headers.get('allow'), 'GET, POST, OPTIONS');
});
