import test from 'node:test';
import assert from 'node:assert/strict';
import state from '../study-state.js';
function storage() { const map = new Map(); return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),get length(){return map.size},key:i=>[...map.keys()][i]}; }
test('anotações e marcações permanecem separadas por semana e reunião',()=>{
 const s=storage();const a=state.meetingKey('midweek','2026-09-28');const b=state.meetingKey('weekend','2026-09-28');const c=state.meetingKey('midweek','2026-10-05');
 state.patch(s,a,{notes:'minha nota'});state.patch(s,a,{checked:{one:true}});state.patch(s,b,{notes:'outra nota'});
 assert.equal(state.read(s,a).notes,'minha nota');assert.equal(state.read(s,a).checked.one,true);assert.equal(state.read(s,b).notes,'outra nota');assert.deepEqual(state.read(s,c),{});
 assert.deepEqual(state.savedWeeks(s,'midweek'),['2026-09-28']);
});
test('progresso desconsidera partes que deixaram de existir após atualização',()=>{
 assert.deepEqual(state.progress({checked:{old:true,current:true}},[{id:'current'},{id:'new'}]),{done:1,total:2});
});
test('leitura de outro dia não marca automaticamente a leitura de hoje',()=>{
 const s=storage();state.patch(s,'daily:2026-09-30',{done:true});assert.equal(state.read(s,'daily:2026-10-01').done,undefined);
});
test('falha de gravação é informada ao chamador e dados inválidos não quebram leitura',()=>{
 const s=storage();s.setItem(state.prefix+'bad','broken');assert.deepEqual(state.read(s,'bad'),{});
 assert.throws(()=>state.patch({getItem:()=>null,setItem:()=>{throw Error('quota')}},'test',{notes:'a'}),/quota/);
});
