import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCongregationReference, extractWolChapter, loadCongregationStudy } from './congregation-study.mjs';

test('identifica capitulo simples e referencia compacta', () => {
  assert.deepEqual(parseCongregationReference('wcg capítulo16').chapters, [16]);
  assert.deepEqual(parseCongregationReference('wcg cap. 16').chapters, [16]);
  assert.equal(parseCongregationReference('leitura de Jeremias 51'), null);
});
test('identifica dois capítulos sem perder a segunda referência', () => {
  for (const ref of ['wcg caps. 16 e 17', 'wcg capítulos 16-17',
    'wcg capítulos 16 a 17', 'wcg cap. 16, 17']) {
    assert.deepEqual(parseCongregationReference(ref).chapters, [16, 17], ref);
  }
  assert.deepEqual(parseCongregationReference('wcg caps. 16-18').chapters, [16, 17, 18]);
});
test('não confunde conteúdo de outro capítulo ou outro livro', () => {
  const html = '<p>wcg cap. 16</p><div class="bodyTxt">' +
    '<h1>O capítulo</h1><p>Texto 1</p><p>Texto 2</p><p>Texto 3</p><p>Texto 4</p><p>Texto 5</p></div>';
  assert.equal(extractWolChapter(html, 'wcg', 17, 'https://wol.jw.org'), null);
  assert.equal(extractWolChapter(html, 'lfb', 16, 'https://wol.jw.org'), null);
  const parsed = extractWolChapter(html, 'wcg', 16, 'https://wol.jw.org');
  assert.equal(parsed.title, 'O capítulo');
  assert.equal(parsed.content.length, 6);
});
test('carrega os dois capítulos e mantém cada texto na seção correta', async () => {
  const fakeFetch = async url => {
    const number = Number(url.slice(-2));
    const html = '<p>wcg cap. ' + number + '</p><div class="bodyTxt">' +
      '<h1>Título ' + number + '</h1>' +
      Array.from({ length: 6 }, (_, index) => '<p>Texto ' + number + ':' + index + '</p>').join('') +
      '</div>';
    return { ok: true, text: async () => html };
  };
  const study = await loadCongregationStudy('wcg caps. 16 e 17',
    'https://wol.jw.org/pt/wol/meetings/r5/lp-t/2026/46', fakeFetch);
  assert.equal(study.chapters.length, 2);
  assert.equal(study.chapters[0].number, 16);
  assert.equal(study.chapters[1].number, 17);
  assert.match(study.chapters[0].content[1].text, /^Texto 16:/);
  assert.match(study.chapters[1].content[1].text, /^Texto 17:/);
});
test('sem conexão mantém o capítulo correto e o link oficial, sem inventar texto', async () => {
  const offline = async () => { throw new Error('offline'); };
  const study = await loadCongregationStudy('wcg capítulo16', 'https://wol.jw.org/pt/wol/meetings/r5/lp-t/2026/46', offline);
  assert.equal(study.chapters.length, 1);
  assert.equal(study.chapters[0].number, 16);
  assert.equal(study.chapters[0].content.length, 0);
  assert.match(study.chapters[0].url, /^https:\/\/www\.jw\.org\//);
  assert.match(study.chapters[0].title, /Certamente irei/);
});
test('publicação desconhecida não recebe link de capítulo inventado', async () => {
  let requests = 0;
  const fetcher = async () => {requests++;throw Error('not expected')};
  const study = await loadCongregationStudy('lfb cap. 8 e 9',
    'https://wol.jw.org/pt/wol/meetings/r5/lp-t/2026/46', fetcher);
  assert.equal(study.chapters.length, 2);
  assert.equal(requests, 0);
  assert.match(study.chapters[0].url, /\/meetings\//);
});
