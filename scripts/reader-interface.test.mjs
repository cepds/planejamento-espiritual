import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = relative => readFile(new URL('../' + relative, import.meta.url), 'utf8');
const [html, reader, updater, worker, events, rules, firebaseConfig, css] = await Promise.all([
  read('index.html'), read('reader.js'), read('scripts/update-content.mjs'), read('sw.js'),
  read('public-events.js'), read('firestore.rules'), read('firebase.json'), read('reader.css')
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
  assert.match(events, /planejamento-espiritual-20-events/);
  assert.match(events, /eventosPublicos/);
  assert.match(events, /onSnapshot/);
  assert.match(events, /\.add\(payload\)/);
  assert.match(events, /\.update\(payload\)/);
  assert.match(events, /\.delete\(\)/);
  assert.doesNotMatch(events, /localStorage\.setItem/);
});

test('versões do cache acompanham CSS e JS da página', () => {
  for (const file of ['reader.js?v=4', 'reader.css?v=5', 'public-events.js?v=2']) {
    assert.ok(html.includes(file));
    assert.ok(worker.includes(file));
  }
});

test('Firestore expõe somente eventos públicos sem necessidade de login', () => {
  assert.match(html, /\/__\/firebase\/8\.10\.1\/firebase-app\.js/);
  assert.match(html, /\/__\/firebase\/8\.10\.1\/firebase-firestore\.js/);
  assert.match(html, /\/__\/firebase\/init\.js/);
  assert.match(html, /id="event-sync-status"/);
  assert.match(html, /id="event-import"/);
  assert.match(rules, /match \/eventosPublicos\/\{eventId\}/);
  assert.match(rules, /allow get, list, create, update, delete: if true/);
  assert.doesNotMatch(rules, /match \/\{document=\*\*\}/);
  assert.equal(JSON.parse(firebaseConfig).firestore.rules, 'firestore.rules');
});

test('no celular agenda começa compacta e só expande ao toque', () => {
  assert.match(html, /id="event-mobile-toggle"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /aria-controls="event-widget-content"/);
  assert.match(html, /id="event-mobile-summary"/);
  assert.match(css, /@media\(max-width:600px\)\{/);
  assert.match(css, /\.event-widget-content\{display:none\}/);
  assert.match(css, /\.event-widget\.is-expanded \.event-widget-content\{display:block/);
  assert.match(css, /min-height:48px/);
  assert.match(events, /mobileToggle\.addEventListener\('click'/);
  assert.match(events, /setMobileExpanded\(false\)/);
  assert.match(events, /mobileSummary\.textContent/);
});
