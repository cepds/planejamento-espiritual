import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const backup = require('../backup.js');
function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    key: (i) => Array.from(values.keys())[i] || null,
    getItem: (k) => values.has(k) ? values.get(k) : null,
    setItem: (k, v) => values.set(k, String(v)),
    removeItem: (k) => values.delete(k)
  };
}
const prefix = 'planejamento-espiritual-study-v1:';
test('backup exporta somente dados pessoais do aplicativo', () => {
  const source = memory({
    [prefix + 'preferences']: JSON.stringify({ theme:'dark' }),
    'planejamento-espiritual-20-events': JSON.stringify([{title:'Congresso', date:'2026-10-26'}]),
    'outra-aplicacao': JSON.stringify({ token:'privado' })
  });
  const data = backup.exportData(source);
  assert.equal(Object.keys(data.records).length, 2);
  assert.equal(data.records['outra-aplicacao'], undefined);
  const target = memory();
  assert.equal(backup.importData(target, data), 2);
  assert.equal(target.getItem(prefix+'preferences'), JSON.stringify({theme:'dark'}));
});
test('backup rejeita dados inválidos e chaves de outras aplicações', () => {
  const data = { format:'planejamento-espiritual-backup',version:1,records:{'outra-aplicacao':'{}'} };
  assert.throws(() => backup.importData(memory(),data),/inválidos/);
  data.records = {[prefix+'preferences']:'não é JSON'};
  assert.throws(() => backup.importData(memory(),data),/inválidos/);
  assert.throws(() => backup.importData(memory(),{}),/incompatível/);
});
test('restauração não remove registros de semanas não incluídas no arquivo', () => {
  const key = prefix+'meeting:midweek:2026-10-26';
  const target=memory({[key]:'{"notes":"preservar"}'});
  backup.importData(target,{format:'planejamento-espiritual-backup',version:1,records:{[prefix+'preferences']:'{"theme":"light"}'}});
  assert.equal(target.getItem(key),'{"notes":"preservar"}');
});
