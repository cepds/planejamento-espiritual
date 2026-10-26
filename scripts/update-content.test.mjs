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

test('plano exibe oito semanas distintas e reinicia após o ciclo completo', async () => {
  const { familyUpcomingFor, familyWorshipFor } = await import('./update-content.mjs');
  const weeks = familyUpcomingFor(utcDate('2026-09-22'));
  assert.equal(weeks.length, 8);
  assert.equal(new Set(weeks.map((item) => item.title)).size, 8);
  assert.equal(familyWorshipFor(utcDate('2026-11-17')).title, weeks[0].title);
  for (let index = 1; index < weeks.length; index++) {
    assert.equal(utcDate(weeks[index].weekOf) - utcDate(weeks[index-1].weekOf), 7 * 86400000);
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
