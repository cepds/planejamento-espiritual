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
    keys: async () => ['planejamento-espiritual-shell-v2', 'another-app', 'planejamento-espiritual-shell-v7', 'planejamento-espiritual-shell-v8', 'planejamento-espiritual-shell-v9-leitura', 'planejamento-espiritual-shell-v10-cards', 'planejamento-espiritual-shell-v11-estudos-eventos', 'planejamento-espiritual-shell-v12-eventos-compartilhados', 'planejamento-espiritual-shell-v13-agenda-mobile', 'planejamento-espiritual-shell-v14-galerias-estudos', 'planejamento-espiritual-shell-v15-editorial-jw', 'planejamento-espiritual-shell-v16-reunioes-separadas', 'planejamento-espiritual-shell-v17-comentarios-sentinela', 'planejamento-espiritual-shell-v18-joias-estudo-congregacao', 'planejamento-espiritual-shell-v19-familia-biblioteca-agenda', 'planejamento-espiritual-shell-v20-comentarios-revisao-sentinela', 'planejamento-espiritual-shell-v21-texto-diario-meia-noite', 'planejamento-espiritual-shell-v22-sem-estrela-texto-diario', 'planejamento-espiritual-shell-v23-videos-vida-crista', 'planejamento-espiritual-shell-v24-reunioes-grafite', 'planejamento-espiritual-shell-v25-hoje-refinado', 'planejamento-espiritual-shell-v26-leituras-familia-emergencias', 'planejamento-espiritual-shell-v27-cards-azul-ardosia', 'planejamento-espiritual-shell-v28-sidebar-editorial', 'planejamento-espiritual-shell-v29-agenda-dashboard-tema-unificado', 'planejamento-espiritual-shell-v30-sidebar-icone-original', 'planejamento-espiritual-shell-v31-agenda-programas-celebracao', 'planejamento-espiritual-shell-v32-agenda-imagens-programas','planejamento-espiritual-shell-v33-celebracao-capa-oficial','planejamento-espiritual-shell-v34-agenda-cards-fotos','planejamento-espiritual-shell-v35-familia-leitura-oficial','planejamento-espiritual-shell-v36-familia-leitura-local','planejamento-espiritual-shell-v37-familia-pdf-oficial'],
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
  assert.deepEqual(h.deleted,['planejamento-espiritual-shell-v2','planejamento-espiritual-shell-v7','planejamento-espiritual-shell-v8','planejamento-espiritual-shell-v9-leitura','planejamento-espiritual-shell-v10-cards','planejamento-espiritual-shell-v11-estudos-eventos','planejamento-espiritual-shell-v12-eventos-compartilhados','planejamento-espiritual-shell-v13-agenda-mobile','planejamento-espiritual-shell-v14-galerias-estudos','planejamento-espiritual-shell-v15-editorial-jw','planejamento-espiritual-shell-v16-reunioes-separadas','planejamento-espiritual-shell-v17-comentarios-sentinela', 'planejamento-espiritual-shell-v18-joias-estudo-congregacao','planejamento-espiritual-shell-v19-familia-biblioteca-agenda','planejamento-espiritual-shell-v20-comentarios-revisao-sentinela','planejamento-espiritual-shell-v21-texto-diario-meia-noite','planejamento-espiritual-shell-v22-sem-estrela-texto-diario','planejamento-espiritual-shell-v23-videos-vida-crista','planejamento-espiritual-shell-v24-reunioes-grafite','planejamento-espiritual-shell-v25-hoje-refinado','planejamento-espiritual-shell-v26-leituras-familia-emergencias','planejamento-espiritual-shell-v27-cards-azul-ardosia','planejamento-espiritual-shell-v28-sidebar-editorial','planejamento-espiritual-shell-v29-agenda-dashboard-tema-unificado','planejamento-espiritual-shell-v30-sidebar-icone-original','planejamento-espiritual-shell-v31-agenda-programas-celebracao','planejamento-espiritual-shell-v32-agenda-imagens-programas','planejamento-espiritual-shell-v33-celebracao-capa-oficial','planejamento-espiritual-shell-v34-agenda-cards-fotos','planejamento-espiritual-shell-v35-familia-leitura-oficial','planejamento-espiritual-shell-v36-familia-leitura-local','planejamento-espiritual-shell-v37-familia-pdf-oficial']);
});

test('primeira instalação prepara o conteúdo offline', async () => {
  const h = harness(async () => new Response('{"daily":{"date":"2026-10-26"}}',{status:200}));
  let completed;
  h.handlers.install({waitUntil: promise => completed=promise});
  await completed;
  assert.ok(h.writes.includes('/data/content.json'));
});
test('falha na origem não impede instalação offline', async () => {
  const h = harness(async () => { throw Error('offline'); });
  let completed;
  h.handlers.install({waitUntil: promise => completed=promise});
  await completed;
});
