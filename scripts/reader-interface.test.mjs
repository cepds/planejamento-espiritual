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
  for (const file of ['reader.js?v=19', 'reader.css?v=28', 'public-events.js?v=7', 'event-programs.js?v=1']) {
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
  const meetingNav = reader.slice(reader.indexOf('function selectMeeting(view)'),
    reader.indexOf('function setText(selector, text)'));
  assert.doesNotMatch(meetingNav, /data-scroll-to/);
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

test('adoracao em familia apresenta calendario completo e filtro de cinco categorias', () => {
  for (const id of ['family-library', 'family-plan-list', 'family-library-count',
    'family-category-filter', 'family-plan-reset', 'family-plan-status']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  for (const category of ['Perseverança', 'Família', 'Princípios', 'Exemplos do passado', 'Pregação']) {
    assert.ok(html.includes('<option value="' + category + '">'), category);
  }
  assert.match(updater, /familyScheduleFor\(\)/);
  assert.match(updater, /familySchedule,/);
  assert.match(reader, /function initializeFamilyPlan\(content\)/);
  assert.match(reader, /renderFamilySchedule\(\)/);
  assert.match(reader, /familyStudyForDate\(entry\.weekOf\)/);
  assert.match(css, /\.family-plan-list/);
});
test('troca de hoje com outra data é persistida sem mudar o calendário original', () => {
  assert.match(reader, /function swapFamilyStudy\(otherDate\)/);
  assert.match(reader, /const todaySource = next\[familyCurrentWeek\] \|\| familyCurrentWeek/);
  assert.match(reader, /const otherSource = next\[otherDate\] \|\| otherDate/);
  assert.match(reader, /next\[familyCurrentWeek\] = otherSource/);
  assert.match(reader, /next\[otherDate\] = todaySource/);
  assert.match(reader, /localStorage\.setItem\(familyPlanStorageKey, JSON\.stringify\(next\)\)/);
  assert.match(reader, /function loadFamilyAssignments\(\)/);
  assert.match(reader, /new Set\(sourceWeeks\)\.size !== weeks\.length/);
  assert.match(reader, /localStorage\.removeItem\(familyPlanStorageKey\)/);
  assert.match(reader, /renderFamilyStudy\(familyStudyForDate\(familyCurrentWeek\)\)/);
  assert.doesNotMatch(events, /family-agenda-v1/);
});

test('seção Como responderia mostra um card logo abaixo de cada pergunta', () => {
  const study = reader.slice(reader.indexOf('function renderWatchtowerReading(study)'),
    reader.indexOf('function createJewelComment(study)'));
  assert.match(study, /Como responderia/);
  assert.match(study, /reviewQuestionIndex \+= 1/);
  const question = study.indexOf("item.append(studyEl('p', 'study-review-question', questionText))");
  const answer = study.indexOf("item.append(createWatchtowerReviewComment(reviewQuestionIndex))", question);
  assert.ok(question >= 0 && answer > question, 'comentário abaixo da pergunta');
  assert.match(reader, /function createWatchtowerReviewComment\(index\)/);
  assert.match(reader, /'review-' \+ index/);
  assert.match(reader, /'watchtower-review-comment-' \+ index/);
  assert.match(reader, /field\.value = currentWatchtowerComments\[key\] \|\| ''/);
  assert.match(reader, /saveWatchtowerComment\(key, field\.value\)/);
  assert.match(reader, /resizeWatchtowerComment\(field\)/);
  assert.match(css, /\.study-review-comment/);
  assert.match(css, /\.study-review-question/);
});

test('comentários da revisão são persistidos junto ao artigo sem prejudicar os parágrafos', () => {
  assert.ok(reader.includes('review-\\d{1,2}'), 'chaves dos comentários finais precisam ser carregadas');
  assert.match(reader, /saveWatchtowerComment\(number, field\.value\)/);
  assert.match(reader, /saveWatchtowerComment\(key, field\.value\)/);
  assert.doesNotMatch(events, /watchtower-review-comment/);
});

test('texto diário troca na data local de Brasília sem recarregar outros estudos', () => {
  assert.match(reader, /function brazilDay\(now = new Date\(\)\)/);
  assert.match(reader, /timeZone: 'America\/Sao_Paulo'/);
  assert.match(reader, /function renderDailyOnly\(content\)/);
  assert.match(reader, /item\?\.date === today/);
  assert.match(reader, /dailyReadings/);
  assert.match(reader, /function scheduleDailyMidnightCheck\(\)/);
  assert.match(reader, /60000 - \(Date\.now\(\) % 60000\)/);
  assert.match(reader, /addEventListener\('visibilitychange'/);
  assert.match(reader, /addEventListener\('focus', checkDailyDate\)/);
  assert.match(reader, /renderDailyOnly\(latestContent\)/);
  assert.match(reader, /function refreshDailyFromSite\(\)/);
  assert.match(reader, /cache: 'no-store'/);
  assert.match(reader, /'Texto diário de hoje ainda não disponível neste site\.'/);
  assert.match(reader, /selected\?\.url \|\| officialDailyLink\(today\)/);
});

test('atualização programa meia-noite de Brasília e pré-carrega próximos textos', async () => {
  const workflow = await read('.github/workflows/update-content.yml');
  assert.match(workflow, /cron: '0 3 \* \* \*'/);
  assert.match(workflow, /cron: '10 3 \* \* \*'/);
  assert.match(updater, /const dailyDates = nextDates\(now, 4\)/);
  assert.match(updater, /getDaily/);
  assert.match(updater, /daily, dailyReadings,/);
});

test('card do Texto Diário não exibe estrela decorativa', () => {
  const dailyCard = html.slice(html.indexOf('today-feature-card--daily'), html.indexOf('today-feature-card--publication'));
  assert.doesNotMatch(dailyCard, /today-feature-decoration|✧/);
  assert.doesNotMatch(css, /\.today-feature-decoration/);
});

test('videos de Nossa Vida Cristã exibem fonte oficial e comentários por pergunta', () => {
  assert.match(reader, /function createLifeVideoCard\(study, video, videoIndex\)/);
  assert.match(reader, /function createLifeVideoComment\(study, video, videoIndex, questionIndex\)/);
  assert.match(reader, /function lifeVideoCommentKey\(study, video, videoIndex, questionIndex\)/);
  assert.match(reader, /filter\(video => Number\(video\.partNumber\) === number\)/);
  assert.match(reader, /body\.append\(createLifeVideoCard\(study, video, index\)\)/);
  assert.match(reader, /card\.append\(studyEl\('p', 'life-video-question', question\)\)/);
  assert.match(reader, /card\.append\(createLifeVideoComment\(study, video, videoIndex, questionIndex \+ 1\)\)/);
  assert.match(reader, /directVideoUrl \|\| sourceUrl/);
  assert.match(reader, /'Consultar vídeo na programação oficial/);
  assert.match(reader, /resizeWatchtowerComment\(field\)/);
  assert.match(reader, /localStorage\.setItem\(key, field\.value\)/);
  assert.match(css, /\.life-video-card/);
  assert.match(css, /\.life-video-comment-input/);
  assert.match(updater, /extractLifeVideoDiscussions\(completeText, wolMeetingUrl\(monday\)\)/);
  assert.match(updater, /congregationStudy, lifeVideos/);
  assert.doesNotMatch(events, /vida-crista-video-v1/);
});

test('tema grafite é aplicado apenas nas rotas de reuniões e não altera outros conteúdos', () => {
  assert.match(reader, /document\.body\.classList\.toggle\('meetings-reading-theme', page === 'meetings'\)/);
  assert.match(reader, /const meetingsRoute = \['meetings', 'meetings-midweek', 'meetings-weekend'\]/);
  assert.match(css, /body\.meetings-reading-theme\{background:#111317\}/);
  assert.match(css, /\.meetings-reading-theme \.main\{/);
  assert.match(css, /\.meetings-reading-theme \.study-reading\{/);
  assert.match(css, /\.meetings-reading-theme \.meeting-tabs \[role="tab"\]\[aria-selected="true"\]/);
  assert.match(css, /--surface:#1b1e23/);
  assert.match(css, /--soft:#262a31/);
  assert.match(css, /--ink:#f2f3f5/);
  assert.match(css, /color-scheme:dark/);
  assert.match(css, /\.meetings-reading-theme \.study-reading \.study-comment-input\{/);
  assert.match(css, /\.meetings-reading-theme \.study-reading \.congregation-accordion\{/);
  assert.match(css, /\.meetings-reading-theme \.study-reading \.life-video-card\{/);
  assert.match(css, /\.meetings-reading-theme \.study-reading \.study-gallery-item\{/);
  assert.match(css, /\.meetings-reading-theme \.study-reading--watchtower \.study-heading h2/);
  assert.match(css, /\.meetings-reading-theme \.study-reading \.study-date-band/);
});

test('aba Hoje mantém os quatro cards originais com seus destinos', () => {
  const today = html.slice(html.indexOf('data-reader-page="today"'),
    html.indexOf('data-reader-page="meetings"'));
  const destinations = [...today.matchAll(/<a class="today-feature-card[^"]*" href="([^"]+)"/g)]
    .map(match => match[1]);
  assert.deepEqual(destinations,
    ['#daily', '#meetings-midweek', '#meetings-weekend', '#family']);
  for (const id of ['today-verse', 'today-midweek-title', 'today-watchtower-title', 'today-family-title',
    'today-midweek-cover', 'today-watchtower-cover', 'today-family-cover']) {
    assert.match(today, new RegExp('id="' + id + '"'));
  }
  assert.match(today, /<span class="today-feature-eyebrow">Meio de semana<\/span>/);
  assert.doesNotMatch(today, /Próxima reunião/);
});

test('imagens da aba Hoje preenchem a largura inteira e o texto diário fica refinado', () => {
  assert.match(css, /Aba Hoje — refinamento editorial dos quatro cards originais/);
  assert.match(css, /\[data-reader-page="today"\] \.today-feature-card--publication \.today-feature-media\{/);
  assert.match(css, /\[data-reader-page="today"\] \.today-feature-card--publication \.today-feature-media img\{/);
  assert.match(css, /object-fit:cover/);
  assert.match(css, /border-radius:0/);
  assert.match(css, /\[data-reader-page="today"\] \.today-feature-card--daily\{/);
  assert.match(css, /linear-gradient\(125deg,#182c34 0%,#142e30 53%,#1b3842 100%\)/);
  assert.match(css, /\[data-reader-page="today"\] \.today-feature-card--daily h3\{/);
  assert.match(css, /@media\(max-width:600px\)/);
  assert.match(css, /@media\(prefers-color-scheme:dark\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});


test('Texto Diário tem leitura editorial refinada sem perder texto, data e fonte', () => {
  const daily = html.slice(html.indexOf('data-reader-page="daily"'),
    html.indexOf('data-reader-page="family"'));
  assert.match(daily, /class="reading daily-single-reading daily-editorial"/);
  for (const id of ['daily-date', 'daily-verse', 'daily-reference', 'daily-content', 'daily-original']) {
    assert.match(daily, new RegExp('id="' + id + '"'));
  }
  assert.match(css, /\[data-reader-page="daily"\] \.daily-editorial \.reading-heading\{/);
  assert.match(css, /\[data-reader-page="daily"\] \.daily-editorial \.prose\{/);
  assert.match(css, /\[data-reader-page="daily"\] \.daily-editorial \.source-line\{/);
  assert.match(reader, /renderDailyOnly\(content\)/);
});

test('Adoração em família mantém o visual superior e apresenta somente link da publicação', () => {
  const family = html.slice(html.indexOf('data-reader-page="family"'),
    html.indexOf('data-reader-page="emergencies"'));
  assert.match(family, /class="reading family-feature-reading"/);
  assert.match(family, /class="reading-cover family-feature-cover"/);
  for (const id of ['family-cover','family-topic','family-title','family-date','family-prompt',
    'family-reading','family-original','family-library','family-category-filter',
    'family-plan-list','family-plan-reset']) {
    assert.match(family, new RegExp('id="' + id + '"'));
  }
  assert.match(family, /class="family-source-only"/);
  assert.match(family, /class="family-original-link"/);
  assert.match(family, /Ler publicação completa no JW.org/);
  for (const removed of ['family-pdf-frame','family-official-pdf',
    'family-reader-input','family-reader-content','family-publication-status']) {
    assert.doesNotMatch(family, new RegExp('id="' + removed + '"'), removed);
  }
  assert.doesNotMatch(family, /<iframe|<textarea|class="family-insight/);
  assert.match(css, /\.family-feature-cover img:not\(\[hidden\]\)\{/);
  assert.match(css, /\.family-source-only\{/);
  assert.match(css, /\.family-original-link\{/);
  assert.match(reader, /function swapFamilyStudy\(otherDate\)/);
  assert.match(reader, /function renderFamilySchedule\(\)/);
  assert.match(reader, /setSource\('#family-original', study.articleUrl\)/);
  assert.doesNotMatch(reader, /renderOfficialFamilyPdf|renderPersonalFamilyText/);
  assert.doesNotMatch(reader, /GETPUBMEDIALINKS/);
  assert.doesNotMatch(reader, /family-reader-input/);
});

test('Emergências mantém as referências e tem navegação por atalhos em cartões', () => {
  const emergencies = html.slice(html.indexOf('data-reader-page="emergencies"'),
    html.indexOf('id="content-updated"'));
  assert.match(emergencies, /class="intro emergency-intro"/);
  assert.match(emergencies, /class="quick-links emergency-links"/);
  for (const section of ['planning', 'bag', 'action', 'sources']) {
    assert.match(emergencies, new RegExp('id="' + section + '"'));
    assert.match(emergencies, new RegExp('data-scroll-to="' + section + '"'));
  }
  for (const phrase of ['Organize um plano de emergência', 'Bolsa de emergência',
    'Como agir em uma emergência', 'Preparação espiritual e ajuda mútua',
    'Continue lendo no JW.org']) {
    assert.ok(emergencies.includes(phrase), phrase);
  }
  assert.match(css, /\[data-reader-page="emergencies"\] \.emergency-intro\{/);
  assert.match(css, /\[data-reader-page="emergencies"\] \.emergency-links button\{/);
  assert.match(css, /\[data-reader-page="emergencies"\] \.topic-grid section\{/);
  assert.match(css, /\[data-reader-page="emergencies"\] \.sources li\{/);
  assert.match(reader, /document\.querySelectorAll\('\[data-reader-page="emergencies"\] \[data-scroll-to\]'\)/);
  assert.match(reader, /target\.scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
});

test('refinamento destas três abas não modifica a barra lateral nem a aba Hoje', () => {
  const nav = html.slice(html.indexOf('<aside class="sidebar"'),
    html.indexOf('</aside>') + '</aside>'.length);
  assert.match(nav, /class="sidebar"/);
  assert.match(nav, /data-reader-link="today"/);
  assert.match(nav, /data-reader-link="daily"/);
  assert.match(nav, /data-reader-link="family"/);
  assert.match(nav, /data-reader-link="emergencies"/);
  assert.match(css, /Leitura editorial refinada: Texto diário, Adoração em família e Emergências/);
  assert.match(css, /Aba Hoje — refinamento editorial dos quatro cards originais/);
  assert.match(css, /body\.meetings-reading-theme\{background:#111317\}/);
});


test('cards refinados têm paleta própria sem os fundos verdes globais', () => {
  assert.match(css, /Ajuste de acabamento: retira fundos verdes herdados/);
  const scoped = css.slice(css.indexOf('Ajuste de acabamento: retira fundos verdes herdados'))
    .split('/* Navegação lateral editorial — paleta azul-ardósia')[0];
  for (const page of ['daily', 'family', 'emergencies']) {
    assert.ok(scoped.includes('[data-reader-page="' + page + '"]'), page);
  }
  for (const color of ['--soft:#eef3f8', '--surface:#fcfdff',
    '--soft:#273745', '--surface:#1d2934', '--green:#325f81', '--green:#b4d3f5']) {
    assert.ok(scoped.includes(color), color);
  }
  for (const card of ['.family-insight', '.family-plan-item.is-current',
    '.family-library-controls', '.topic-grid section', '.note', '.sources li']) {
    assert.ok(scoped.includes(card), card);
  }
  assert.match(scoped, /@media\(prefers-color-scheme:dark\)/);
  assert.doesNotMatch(scoped, /(?:\.sidebar|\[data-reader-page="today"\]|\[data-reader-page="meetings"\])/);
});

test('ajuste residual mantém estudos e controles de Emergências', () => {
  assert.match(html, /id="family-library"/);
  assert.match(html, /id="family-plan-list"/);
  assert.match(html, /id="family-category-filter"/);
  assert.match(html, /id="daily-content"/);
  assert.match(html, /id="sources"/);
  assert.match(reader, /function swapFamilyStudy\(otherDate\)/);
  assert.match(reader, /function renderDailyOnly\(content\)/);
  assert.match(reader, /document\.querySelectorAll\('\[data-reader-page="emergencies"\] \[data-scroll-to\]'\)/);
});


test('barra lateral tem cinco destinos originais e identidades visuais refinadas', () => {
  const sidebar = html.slice(html.indexOf('<aside class="sidebar"'), html.indexOf('</aside>') + 8);
  const found = [...sidebar.matchAll(/data-reader-link="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(found, ['today', 'meetings', 'daily', 'family', 'emergencies']);
  assert.match(sidebar, /class="sidebar-section-label">Navegação/);
  assert.match(sidebar, /class="brand-mark" aria-hidden="true"><img src="icons\/planejamento-espiritual-original\.png"/);
  assert.doesNotMatch(sidebar, /<span class="brand-mark" aria-hidden="true">✧/);
  assert.equal((sidebar.match(/class="nav-svg"/g) || []).length, 5);
  assert.equal((sidebar.match(/class="nav-label"/g) || []).length, 5);
  assert.equal((sidebar.match(/class="nav-description"/g) || []).length, 5);
  for (const name of ['Hoje', 'Reuniões', 'Texto diário', 'Adoração em família', 'Emergências']) {
    assert.ok(sidebar.includes('class="nav-label">' + name + '</span>'), name);
  }
  assert.match(reader, /link\.dataset\.readerLink === page/);
  assert.match(reader, /link\.setAttribute\('aria-current', 'page'\)/);
  assert.match(css, /Navegação lateral editorial — paleta azul-ardósia/);
  assert.match(css, /\.sidebar \.nav a\[aria-current="page"\]/);
  assert.match(css, /\.sidebar \.nav a:focus-visible/);
});

test('barra lateral mantém opções acessíveis no celular sem mudar as páginas', () => {
  assert.match(css, /@media\(max-width:880px\)\{/);
  assert.match(css, /@media\(max-width:600px\)\{/);
  assert.match(css, /\.sidebar \.nav-description\{display:none\}/);
  assert.match(css, /\.sidebar \.nav a:last-child\{grid-column:1\/-1\}/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{/);
  assert.match(css, /linear-gradient\(160deg,#1b2d3e/);
  assert.match(html, /data-reader-page="today"/);
  assert.match(html, /data-reader-page="meetings"/);
  assert.match(html, /data-reader-page="daily"/);
  assert.match(html, /data-reader-page="family"/);
  assert.match(html, /data-reader-page="emergencies"/);
});


test('botão JW.org é padronizado e fundo azul-grafite em todas as abas', () => {
  assert.match(html, /class="source-pill" href="https:\/\/www\.jw\.org\/pt\/"/);
  assert.match(css, /UNIFICAÇÃO: base azul-grafite das reuniões em todas as cinco páginas/);
  const unified = css.slice(css.indexOf('UNIFICAÇÃO: base azul-grafite'));
  assert.match(unified, /body\{\s*--bg:#111317/);
  assert.match(unified, /background:#111317/);
  assert.match(unified, /body \.source-pill,\s*body\.meetings-reading-theme \.source-pill/);
  assert.match(unified, /background:#242e3a/);
  for (const name of ['daily','family','emergencies','today']) {
    assert.ok(unified.includes('[data-reader-page="' + name + '"]'), name);
  }
  assert.match(unified, /--surface:#1b1e23/);
  assert.match(unified, /--soft:#262a31/);
});

test('Agenda completa mostra somente cards com fotos e preserva os controles', () => {
  assert.match(html, /class="event-widget"/);
  for (const id of ['event-open','event-toggle','event-preview','event-all',
    'event-list','event-import','event-sync-status','event-dialog','event-form',
    'event-form-date','event-dashboard-open','event-dashboard','event-dashboard-close',
    'agenda-events-list','agenda-events-empty','agenda-add','event-days']) {
    assert.match(html, new RegExp('id="' + id + '"'), id);
  }
  for (const removed of ['agenda-hero','agenda-kpis','agenda-charts',
    'agenda-type-chart','agenda-month-chart']) {
    assert.doesNotMatch(html, new RegExp('class="' + removed + '"|id="' + removed + '"'), removed);
  }
  assert.match(events, /function upcomingEvents\(items\)/);
  assert.match(events, /function renderDashboard\(upcoming\)/);
  assert.match(events, /function remainingLabel\(days\)/);
  assert.doesNotMatch(events, /function renderTypeChart\(/);
  assert.doesNotMatch(events, /function renderMonthChart\(/);
  assert.match(events, /agenda-event-image/);
  assert.match(events, /dashboard\.showModal\(\)/);
  assert.match(events, /dashboard\.close\(\)/);
  assert.match(events, /new Intl\.DateTimeFormat\('en-CA'/);
  assert.match(events, /timeZone: 'America\/Sao_Paulo'/);
  assert.match(events, /setInterval\(refreshWhenDateChanges, 60000\)/);
  assert.match(events, /collection\.orderBy\('date', 'desc'\)\.limit\(200\)\.onSnapshot/);
  assert.match(events, /collection\.doc\(editingId\)\.update\(payload\)/);
  assert.match(events, /collection\.add\(payload\)/);
  assert.match(events, /collection\.doc\(item\.id\)\.delete\(\)/);
  assert.doesNotMatch(events, /localStorage\.setItem/);
  assert.match(css, /\.event-dashboard\{/);
  assert.match(css, /\.agenda-events-list\{/);
  assert.match(css, /\.agenda-event-cover\{/);
});

test('Agenda mantém quadro compacto no celular e painel grande responsivo', () => {
  assert.match(html, /data-mobile-collapsed="true"/);
  assert.match(html, /id="event-toggle"/);
  assert.match(html, /id="event-dashboard-open"/);
  assert.match(css, /@media\(max-width:650px\)/);
  assert.match(css, /\.event-dashboard\{width:calc\(100vw - 12px\)/);
  assert.match(css, /\.agenda-events-list\{grid-template-columns:1fr/);
  assert.match(events, /setMobileCollapsed/);
  assert.match(events, /mini\.textContent/);
});


test('nova lateral premium preserva rotas e exibe o ícone aprovado', async () => {
  const sidebar = html.slice(html.indexOf('<aside class="sidebar"'), html.indexOf('</aside>') + 8);
  const choices = [...sidebar.matchAll(/data-reader-link="([^"]+)"/g)].map(item => item[1]);
  assert.deepEqual(choices, ['today', 'meetings', 'daily', 'family', 'emergencies']);
  assert.match(sidebar, /icons\/planejamento-espiritual-original\.png/);
  assert.match(css, /Sidebar premium — livro, luz e azul profundo/);
  assert.match(css, /\.sidebar \.brand-mark img\{/);
  assert.match(css, /\.sidebar \.nav a\[aria-current="page"\]::after/);
  assert.match(css, /background:linear-gradient\(#fff0c8,#e4ba75\)/);
  assert.match(css, /@media\(max-width:600px\)/);
  assert.match(html, /class="today-feature-eyebrow">A Sentinela<\/span>/);
  assert.doesNotMatch(html, /A Sentinela · Estudo da semana/);
  assert.match(html, /rel="icon" href="icons\/planejamento-espiritual-original\.png" type="image\/png"/);
  assert.match(html, /rel="apple-touch-icon" href="icons\/planejamento-espiritual-original\.png"/);
  const manifest = JSON.parse(await read('manifest.webmanifest'));
  assert.equal(manifest.theme_color, '#101f32');
  assert.equal(manifest.start_url, '/#today');
  assert.ok(manifest.icons.some(item => item.src === 'icons/planejamento-espiritual-original.png'));
  assert.ok(manifest.icons.some(item => item.src === 'icons/planejamento-espiritual.svg'));
  const png = await readFile(new URL('../icons/planejamento-espiritual-original.png', import.meta.url));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 128);
  assert.equal(png.readUInt32BE(20), 128);
  const svg = await read('icons/planejamento-espiritual.svg');
  assert.match(svg, /<svg/);
  assert.match(svg, /Planejamento Espiritual/);
  assert.match(worker, /v38-familia-link-oficial/);
  assert.match(worker, /\/icons\/planejamento-espiritual-original\.png/);
});


test('Agenda suporta Assembleia, Visita e Celebração com datas e fontes oficiais', async () => {
  for (const id of ['event-form-assembly','event-form-visit','event-form-memorial',
    'event-form-date-end','event-form-program','event-form-theme','event-form-scripture',
    'event-form-image','event-form-source','event-form-program-lines',
    'event-talk-1-date','event-talk-1-time','event-talk-1-theme',
    'event-talk-2-date','event-talk-2-time','event-talk-2-theme',
    'event-memorial-time','agenda-reference-view','event-details-dialog',
    'event-details-close','event-details-program','event-details-image',
    'event-next-image','agenda-events-list']) {
    assert.match(html, new RegExp('id="' + id + '"'), id);
  }
  assert.match(html, /<option value="Celebração">Celebração<\/option>/);
  assert.match(html, /Realizada após o pôr do sol|Sempre após o pôr do sol/);
  assert.match(html, /event-programs\.js\?v=1/);
  assert.match(events, /function memorialEvents\(\)/);
  assert.match(events, /function visitWeekIsValid\(start, end\)/);
  assert.match(events, /function showEventDetails\(item\)/);
  assert.match(events, /function renderProgramSection\(root, title, entries\)/);
  assert.match(events, /function parseCustomProgram\(text\)/);
  assert.match(events, /function toggleEventFields\(\)/);
  assert.match(events, /function updateVisitDates\(resetTalks = true\)/);
  assert.match(events, /function allEventsWithOfficialDates\(\)/);
  assert.match(events, /function imageOf\(item\)/);
  assert.match(events, /function sourceOf\(item\)/);
  assert.match(css, /\.event-details-dialog\{/);
  assert.match(css, /\.event-talk-fields\{/);
  assert.match(css, /\.agenda-reference-panel\{/);
  const program = await read('event-programs.js');
  assert.match(program, /CA-brpgm27/);
  for (const date of ['2027-03-22','2028-04-09','2029-03-29']) assert.ok(program.includes(date));
  assert.match(program, /images\/celebracao-jesus\.webp/);
});
