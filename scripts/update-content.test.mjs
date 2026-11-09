import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SKIP_UPDATE_MAIN = '1';
const { dailyHeadingPattern, midweekTargetDate, mondayOf, tuesdayOf, studyRange, rangeIncludes } = await import('./update-content.mjs');

function utcDate(value) {
  return new Date(`${value}T00:00:00Z`);
}

test('texto diário reconhece o primeiro dia com ordinal oficial', () => {
  const pattern = dailyHeadingPattern(utcDate('2026-09-01'));
  assert.match('Terça-feira, 1.º de setembro', pattern);
  assert.match('Terça-feira, 1 de setembro', pattern);
});

test('apostila permanece na semana atual de segunda a quinta', () => {
  for (const date of ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13']) {
    assert.equal(midweekTargetDate(utcDate(date)).toISOString().slice(0, 10), '2026-08-10');
  }
});

test('apostila muda para a próxima semana de sexta a domingo', () => {
  for (const date of ['2026-08-14', '2026-08-15', '2026-08-16']) {
    assert.equal(midweekTargetDate(utcDate(date)).toISOString().slice(0, 10), '2026-08-17');
  }
});

test('Sentinela muda na segunda-feira e adoração em família na terça-feira', () => {
  assert.equal(mondayOf(utcDate('2026-08-16')).toISOString().slice(0, 10), '2026-08-10');
  assert.equal(mondayOf(utcDate('2026-08-17')).toISOString().slice(0, 10), '2026-08-17');
  assert.equal(tuesdayOf(utcDate('2026-08-17')).toISOString().slice(0, 10), '2026-08-11');
  assert.equal(tuesdayOf(utcDate('2026-08-18')).toISOString().slice(0, 10), '2026-08-18');
});

test('novo ciclo de adoração começa na terça e mantém o tema até segunda', async () => {
  const { familyWorshipFor } = await import('./update-content.mjs');
  const first = familyWorshipFor(utcDate('2026-09-22'));
  assert.equal(first.title, 'Como se preparar espiritualmente agora');
  assert.equal(familyWorshipFor(utcDate('2026-09-28')).title, first.title);
  assert.notEqual(familyWorshipFor(utcDate('2026-09-29')).title, first.title);
});

test('calendário ampliado preserva as oito semanas iniciais e a data de Abigail', async () => {
  const { familyCatalog, familyUpcomingFor, familyWorshipFor, familyScheduleFor } = await import('./update-content.mjs');
  assert.equal(familyCatalog.length, 39);
  const weeks = familyUpcomingFor(utcDate('2026-09-22'), familyCatalog.length);
  assert.equal(weeks.length, 39);
  assert.equal(new Set(weeks.map((item) => item.title)).size, 39);
  assert.equal(familyWorshipFor(utcDate('2026-11-03')).title, 'Abigail: acalmar conflitos com sensatez');
  assert.equal(familyWorshipFor(utcDate('2026-11-17')).title, familyCatalog[8].title);
  const schedule = familyScheduleFor();
  assert.equal(schedule[0].weekOf, '2026-09-22');
  assert.equal(schedule.at(-1).weekOf, '2027-08-31');
  assert.equal(new Set(schedule.map((item) => item.weekOf)).size, schedule.length);
  for (let index = 1; index < schedule.length; index++) {
    assert.equal(utcDate(schedule[index].weekOf) - utcDate(schedule[index - 1].weekOf), 7 * 86400000);
  }
});
test('família, princípios, perseverança, exemplos e pregação constam na biblioteca', async () => {
  const { familyCatalog } = await import('./update-content.mjs');
  const categories = new Set(familyCatalog.map(item => item.category));
  for (const name of ['Perseverança', 'Família', 'Princípios', 'Exemplos do passado', 'Pregação']) {
    assert.ok(categories.has(name), name);
  }
  for (const item of familyCatalog) {
    assert.match(item.articleUrl, /^https:\/\/www\.jw\.org\/pt\//);
    assert.ok(item.title && item.prompt && item.action);
    assert.ok(Array.isArray(item.questions) && item.questions.length >= 2);
  }
});

test('A Sentinela reconhece mudança de mês com travessão e ordinal', () => {
  const title = '26 de outubro–1.º de novembro de 2026: Dê valor ao serviço sagrado';
  const range = studyRange(title);
  assert.equal(range.start.toISOString().slice(0, 10), '2026-10-26');
  assert.equal(range.end.toISOString().slice(0, 10), '2026-11-01');
  assert.equal(rangeIncludes(title, utcDate('2026-10-26')), true);
  assert.equal(rangeIncludes(title, utcDate('2026-11-01')), true);
  assert.equal(rangeIncludes(title, utcDate('2026-11-02')), false);
});

test('A Sentinela aceita outras formas oficiais de separar intervalos', () => {
  for (const title of [
    '26 DE OUTUBRO A 1.° DE NOVEMBRO DE 2026: Estudo',
    '26 de outubro—1º de novembro de 2026: Estudo',
    '26 de outubro&ndash;1.º de novembro de 2026: Estudo',
    '26 de outubro&#8211;1.º de novembro de 2026: Estudo'
  ]) {
    assert.equal(rangeIncludes(title, utcDate('2026-10-26')), true, title);
  }
});

test('A Sentinela preserva intervalos normais da mesma publicação', () => {
  assert.equal(rangeIncludes('19 a 25 de outubro de 2026', utcDate('2026-10-19')), true);
  assert.equal(rangeIncludes('19-25 de outubro de 2026', utcDate('2026-10-26')), false);
  assert.equal(rangeIncludes('5-11 de outubro de 2026', utcDate('2026-10-05')), true);
});

test('A Sentinela reconhece virada de ano e rejeita datas impossíveis', () => {
  const title = '28 de dezembro–3 de janeiro de 2027';
  assert.equal(studyRange(title).start.toISOString().slice(0, 10), '2026-12-28');
  assert.equal(rangeIncludes(title, utcDate('2027-01-03')), true);
  assert.equal(studyRange('31 a 34 de outubro de 2026'), null);
  assert.equal(studyRange('título sem intervalo'), null);
});

test('falha isolada conserva a última Sentinela validada sem bloquear outros conteúdos', async () => {
  const { resolveContentUpdates } = await import('./update-content.mjs');
  const previous = {
    daily: {date:'2026-10-25', verse:'A', reference:'B', content:'C'},
    meeting: {weekOf:'2026-10-19', reading:'A'},
    midweekStudy: {weekOf:'2026-10-19', content:'A'},
    watchtower: {weekOf:'2026-10-19', title:'A', theme:'B', objective:'C', content:'D'}
  };
  const result=resolveContentUpdates(previous, [
    {status:'fulfilled',value:{...previous.daily,date:'2026-10-26'}},
    {status:'fulfilled',value:{meeting:{...previous.meeting,weekOf:'2026-10-26'},midweekStudy:{...previous.midweekStudy,weekOf:'2026-10-26'}}},
    {status:'rejected',reason:new Error('API indisponível')}
  ], {daily:'2026-10-26',midweek:'2026-10-26',watchtower:'2026-10-26'});
  assert.equal(result.daily.date,'2026-10-26');
  assert.equal(result.watchtower.weekOf,'2026-10-19');
  assert.equal(result.errors.length,1);
});
test('não fabrica conteúdo quando não existe cópia anterior válida', async () => {
  const { resolveContentUpdates } = await import('./update-content.mjs');
  assert.throws(()=>resolveContentUpdates({},[
    {status:'rejected',reason:new Error('sem rede')},
    {status:'rejected',reason:new Error('sem rede')},
    {status:'rejected',reason:new Error('sem rede')}
  ], {daily:'2026-10-26',midweek:'2026-10-26',watchtower:'2026-10-26'}), /sem conteúdo anterior válido/);
});

test('virada do dia ocorre à meia-noite de Brasília, mesmo quando UTC ainda está no dia anterior', async () => {
  const { dateInSaoPaulo } = await import('./update-content.mjs');
  assert.equal(dateInSaoPaulo(new Date('2026-11-09T02:59:59Z')).toISOString().slice(0, 10), '2026-11-08');
  assert.equal(dateInSaoPaulo(new Date('2026-11-09T03:00:00Z')).toISOString().slice(0, 10), '2026-11-09');
});

test('textos dos próximos três dias são preparados com datas exatas', async () => {
  const { nextDates, mergeDailyReadings } = await import('./update-content.mjs');
  const dates = nextDates(utcDate('2026-12-30'), 4);
  assert.deepEqual(dates.map(item => item.toISOString().slice(0, 10)),
    ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  const entry = date => ({ date, verse: 'Versículo ' + date, reference: 'Referência',
    content: 'Comentário', url: 'https://wol.jw.org/pt/wol/h/r5/lp-t/2026/12/30' });
  const previous = { daily: entry('2026-12-29'),
    dailyReadings: [entry('2027-01-01'), entry('2026-12-29')] };
  const results = [{ status: 'fulfilled', value: entry('2026-12-31') },
    { status: 'rejected', reason: Error('fonte temporariamente fora') },
    { status: 'fulfilled', value: entry('2027-01-02') }];
  const selected = mergeDailyReadings(dates, entry('2026-12-30'), results, previous);
  assert.deepEqual(selected.map(item => item.date),
    ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  assert.ok(!selected.some(item => item.date === '2026-12-29'));
});
