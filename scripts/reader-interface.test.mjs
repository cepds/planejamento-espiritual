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
  for (const name of ['today-midweek-cover', 'midweek-gallery', 'midweek-images', 'today-watchtower-cover', 'watchtower-gallery', 'watchtower-images', 'study-image-dialog']) {
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
  for (const file of ['reader.js?v=9', 'reader.css?v=10', 'public-events.js?v=2']) {
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

test('agenda móvel inicia recolhida e permite expansão manual', () => {
  assert.match(html, /class="event-widget" data-mobile-collapsed="true"/);
  assert.match(html, /id="event-mini"/);
  assert.match(html, /id="event-toggle"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(events, /setMobileCollapsed/);
  assert.match(events, /mini.textContent/);
});

test('galerias oferecem todas as ilustrações válidas e navegação ampliada', () => {
  assert.match(reader, /function renderStudyGallery/);
  assert.match(reader, /renderStudyGallery\('midweek', midweek/);
  assert.match(reader, /renderStudyGallery\('watchtower', watchtower/);
  assert.match(reader, /function imageList/);
  assert.match(reader, /new Set\(sources\.map\(officialUrl\)/);
  assert.match(reader, /function openImageViewer/);
  assert.match(reader, /imageDialog\.showModal\(\)/);
  assert.match(reader, /ArrowLeft/);
  assert.match(reader, /ArrowRight/);
  assert.match(updater, /publicationContentImages\(media, current\.track\)/);
  assert.match(updater, /const articleIndex = Number\(selected\.file\.track\) - 1/);
  assert.match(updater, /publicationContentImages\(selected\.media, articleIndex\)/);
  assert.match(updater, /images, heroImageUrl: image/);
});

test('Sentinela preserva perguntas e texto completo com apresentação de leitura', () => {
  for (const part of ['study-reading--watchtower', 'study-date-band',
    'study-scripture-theme', 'watchtower-goal', 'watchtower-content']) {
    assert.ok(html.includes(part), part);
  }
  assert.match(reader, /function renderWatchtowerReading/);
  assert.match(reader, /renderWatchtowerReading\(watchtower\)/);
  assert.match(reader, /Pergunta\\s\+/);
  assert.match(reader, /study-question-number/);
  assert.match(reader, /study-numbered-paragraph/);
  assert.match(reader, /study-scripture/);
  assert.match(reader, /study-review-list/);
  assert.match(reader, /studyIllustration\(images, imageIndex/);
  assert.match(reader, /studyRangeText\(watchtower.title/);
  assert.match(html, /id="watchtower-comment-status"/);
  assert.doesNotMatch(html, /contenteditable/);
});

test('reunião de meio de semana mantém programação com seções e duração', () => {
  assert.match(html, /study-reading--midweek/);
  assert.match(html, /id="midweek-content" class="study-document study-document--midweek"/);
  assert.match(reader, /function renderMidweekReading/);
  assert.match(reader, /renderMidweekReading\(midweek\)/);
  assert.match(reader, /Tesouros da Palavra de Deus/);
  assert.match(reader, /Faça seu melhor no ministério/);
  assert.match(reader, /Nossa vida cristã/);
  assert.match(reader, /study-program-item-heading/);
  assert.match(reader, /study-program-duration/);
  assert.match(reader, /study-program-question/);
  assert.match(css, /\.study-program-section/);
  assert.match(css, /\.study-program-duration/);
});

test('formatação não modifica os dados das leituras nem a agenda de eventos', () => {
  const meetings = html.slice(html.indexOf('data-reader-page="meetings"'), html.indexOf('data-reader-page="daily"'));
  assert.match(meetings, /midweek-gallery/);
  assert.match(meetings, /watchtower-gallery/);
  assert.match(meetings, /midweek-original/);
  assert.match(meetings, /watchtower-original/);
  assert.match(css, /\.study-image-viewer/);
  assert.match(html, /event-widget/);
  assert.match(reader, /textContent = text/);
});

test('meio de semana e fim de semana aparecem em abas separadas', () => {
  assert.match(html, /role="tablist" aria-label="Selecione a reunião"/);
  assert.match(html, /id="meeting-tab-midweek" role="tab" aria-controls="midweek" aria-selected="true"/);
  assert.match(html, /id="meeting-tab-weekend" role="tab" aria-controls="weekend" aria-selected="false"/);
  assert.match(html, /id="weekend" role="tabpanel" tabindex="0" aria-labelledby="meeting-tab-weekend" hidden/);
  assert.match(html, /id="midweek" role="tabpanel" tabindex="0" aria-labelledby="meeting-tab-midweek"/);
  assert.match(html, /href="#meetings-midweek"/);
  assert.match(html, /href="#meetings-weekend"/);
  assert.match(reader, /function selectMeeting\(view\)/);
  assert.match(reader, /document\.getElementById\(panel\)\.hidden = panel !== selection/);
  assert.match(reader, /tab\.setAttribute\('aria-selected'/);
  assert.match(reader, /requested === 'meetings-weekend'/);
  assert.match(reader, /document\.querySelectorAll\('\[data-meeting-tab\]'\)/);
  assert.doesNotMatch(reader, /pendingMeetingScroll/);
  assert.doesNotMatch(reader, /data-scroll-to/);
});

test('comentários são criados acima de cada parágrafo da Sentinela e não no meio de semana', () => {
  const section = reader.slice(reader.indexOf('function renderWatchtowerReading('), reader.indexOf('function renderMidweekReading('));
  const before = section.indexOf('container.append(createWatchtowerComment(numbered[1]))');
  const after = section.indexOf('container.append(paragraph)', before);
  assert.ok(before >= 0 && after > before, 'campo deve vir antes do parágrafo');
  const midweek = reader.slice(reader.indexOf('function renderMidweekReading('));
  assert.doesNotMatch(midweek, /createWatchtowerComment/);
  assert.match(reader, /function createWatchtowerComment\(number\)/);
  assert.match(reader, /field\.placeholder = 'Escreva seu comentário…'/);
  assert.match(reader, /field\.addEventListener\('input'/);
  assert.match(reader, /field\.value = currentWatchtowerComments\[number\]/);
  assert.match(reader, /function resizeWatchtowerComment/);
  assert.match(reader, /field\.scrollHeight/);
  assert.match(css, /\.study-comment-input/);
  assert.match(css, /resize:none;overflow:hidden/);
});

test('comentários ficam separados por artigo e salvos localmente, sem publicação pública', () => {
  assert.match(reader, /function watchtowerCommentKey\(study\)/);
  assert.match(reader, /study\.weekOf/);
  assert.match(reader, /String\(study\?\.title/);
  assert.match(reader, /localStorage\.getItem\(currentWatchtowerCommentKey\)/);
  assert.match(reader, /localStorage\.setItem\(currentWatchtowerCommentKey/);
  assert.match(reader, /loadWatchtowerComments\(study\)/);
  assert.match(reader, /saveWatchtowerComment\(number, field\.value\)/);
  assert.match(html, /id="watchtower-comment-status"/);
  assert.doesNotMatch(events, /watchtower-commentarios/);
});

test('joias espirituais tem comentario autoexpansivel restrito ao meio de semana', () => {
  assert.match(reader, /function createJewelComment\(study\)/);
  assert.match(reader, /function jewelCommentKey\(study\)/);
  assert.match(reader, /midweek-jewels-comment/);
  assert.match(reader, /body\.append\(createJewelComment\(study\)\)/);
  assert.match(reader, /resizeWatchtowerComment\(field\)/);
  assert.match(reader, /localStorage\.setItem\(jewelCommentKey\(study\), field\.value\)/);
  assert.match(css, /\.study-jewels-comment/);
});

test('estudo de congregacao exibe painel recolhido com capitulos separados', () => {
  assert.match(reader, /function createCongregationReading\(study, referenceText\)/);
  assert.match(reader, /studyEl\('details', 'congregation-accordion'\)/);
  assert.match(reader, /studyEl\('summary', 'congregation-toggle'\)/);
  assert.match(reader, /for \(const chapter of chapters\)/);
  assert.match(reader, /body\.replaceChildren\(createCongregationReading\(study, source\)\)/);
  assert.match(reader, /officialUrl\(chapter\.url\)/);
  assert.match(css, /\.congregation-accordion/);
  assert.match(css, /\.congregation-chapter/);
});

test('comentario de Joias não usa a coleção publica de eventos', () => {
  assert.doesNotMatch(events, /midweek-jewels-comment/);
  assert.doesNotMatch(events, /congregationStudy/);
});

test('cada pergunta do estudo de congregação recebe card de comentário logo abaixo', () => {
  const begin = reader.indexOf('function createCongregationReading(study, referenceText)');
  const end = reader.indexOf('function resizeVisibleMidweekComments()', begin);
  const section = reader.slice(begin, end);
  const question = section.indexOf("section.append(studyEl('p', 'congregation-content-question', block.text))");
  const comment = section.indexOf('section.append(createCongregationComment(study, chapter, questionIndex))', question);
  assert.ok(question >= 0 && comment > question);
  assert.match(reader, /function congregationCommentKey\(study, chapter, questionIndex\)/);
  assert.match(reader, /function createCongregationComment\(study, chapter, questionIndex\)/);
  assert.match(reader, /congregation-comment-input/);
  assert.match(reader, /localStorage\.setItem\(key, field\.value\)/);
  assert.match(reader, /resizeWatchtowerComment\(field\)/);
  assert.match(reader, /accordion\.addEventListener\('toggle'/);
  assert.match(reader, /if \(accordion\.open\) requestAnimationFrame\(resizeVisibleMidweekComments\)/);
  assert.match(css, /\.congregation-comment-box/);
  assert.match(css, /\.congregation-comment-status/);
  assert.doesNotMatch(events, /congregation-comment/);
});
