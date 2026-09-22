import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
function harness(fetchResult, failWrite = false) {
  const handlers = {}; const writes = []; const deleted = [];
  const saved = new Response('{"cached":true}');
  const context = { URL, Response, fetch: fetchResult, caches: {
    open: async () => ({ addAll: async () => {}, put: async (key) => { if (failWrite) throw Error('quota'); writes.push(key); }, match: async () => saved }),
    keys: async () => ['planejamento-espiritual-shell-v2', 'another-app', 'planejamento-espiritual-shell-v3'],
    delete: async (key) => deleted.push(key)
  }, self: { location: {origin:'https://example.com'}, addEventListener: (type, handler) => handlers[type] = handler, skipWaiting: async () => {}, clients: {claim: async () => {}} }};
  vm.runInNewContext(source, context);
  return { handlers, writes, deleted, saved };
}
async function request(h) {
  let result;
  h.handlers.fetch({request:{method:'GET',url:'https://example.com/data/content.json?v=42'}, respondWith: (value) => result = value});
  return await result;
}
test('erro HTTP não substitui a cópia válida', async () => {
  const h = harness(async () => new Response('error', {status:503}));
  assert.equal(await request(h),h.saved); assert.equal(h.writes.length,0);
});
test('falha de armazenamento não interrompe resposta online', async () => {
  const h = harness(async () => new Response('online'),true);
  assert.equal(await (await request(h)).text(),'online');
});
test('sem rede utiliza a cópia salva', async () => {
  const h = harness(async () => { throw Error('offline'); });
  assert.equal(await request(h),h.saved);
});
test('limpeza mantém caches de outros aplicativos', async () => {
  const h = harness(async () => new Response('ok'));let done;
  h.handlers.activate({waitUntil: value => done=value}); await done;
  assert.deepEqual(h.deleted,['planejamento-espiritual-shell-v2']);
});
