import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SKIP_UPDATE_MAIN = '1';
const { dailyHeadingPattern, midweekTargetDate, mondayOf, tuesdayOf } = await import('./update-content.mjs');

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
