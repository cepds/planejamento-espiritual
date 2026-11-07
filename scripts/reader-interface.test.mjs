import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = relative => readFile(new URL('../' + relative, import.meta.url), 'utf8');
const [html, reader, updater, worker] = await Promise.all([
  read('index.html'), read('reader.js'), read('scripts/update-content.mjs'), read('sw.js')
]);

test('navegação contém cinco ícones SVG e páginas com IDs únicos', () => {
  assert.equal((html.match(/class="nav-svg"/g) || []).length, 5);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const page of ['today', 'meetings', 'daily', 'family', 'emergencies']) {
    assert.match(html, new RegExp('data-reader-page="' + page + '"'));
    assert.match(html, new RegExp('data-reader-link="' + page + '"'));
  }
});

test('imagens de estudos vêm de seus artigos e não de capas genéricas', () => {
  assert.match(updater, /heroImageUrl: contentImages\[0\]/);
  assert.match(updater, /heroImageUrl: image/);
  for (const name of ['today-midweek-cover', 'midweek-cover', 'today-watchtower-cover', 'watchtower-cover']) {
    assert.match(html, new RegExp('id="' + name + '"'));
  }
  assert.match(reader, /studyImage\(midweek\)/);
  assert.match(reader, /studyImage\(watchtower\)/);
  assert.doesNotMatch(reader, /\.coverUrl/);
});

test('agenda no canto permite eventos e mantém dados do formato anterior', () => {
  for (const id of ['event-widget', 'event-dialog', 'event-open', 'event-form', 'event-form-date', 'event-list']) {
    assert.match(html, new RegExp('(?:id|class)="' + id + '(?:[" ])'));
  }
  for (const type of ['Congresso', 'Assembleia', 'Visita', 'Outro']) {
    assert.match(html, new RegExp('<option value="' + type + '"'));
  }
  assert.match(reader, /planejamento-espiritual-20-events/);
  assert.match(reader, /localStorage\.setItem/);
  assert.match(reader, /daysToEvent/);
});

test('versões do cache acompanham CSS e JS da página', () => {
  for (const file of ['reader.js?v=3', 'reader.css?v=3']) {
    assert.ok(html.includes(file));
    assert.ok(worker.includes(file));
  }
});
