import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public-events.js', import.meta.url), 'utf8');

function dateInBrasilia() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone:'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit'
  }).formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return parts.year+'-'+parts.month+'-'+parts.day;
}
function offsetDate(n) {
  const date = new Date(dateInBrasilia()+'T00:00:00Z');
  date.setUTCDate(date.getUTCDate()+n);
  return date.toISOString().slice(0,10);
}
class Element {
  constructor() {
    this.children=[];this.listeners={};this.dataset={};this.style={};this.attributes={};
    this.classList={toggle(){}};
    this.hidden=false;this.disabled=false;this.open=false;this.textContent='';this.value='';
  }
  append(...nodes){this.children.push(...nodes)}
  replaceChildren(...nodes){this.children=nodes}
  setAttribute(name,value){this.attributes[name]=value}
  addEventListener(name,callback){this.listeners[name]=callback}
  querySelector(){return new Element()}
  showModal(){this.open=true}
  close(){this.open=false}
  reset(){}
}
function runWithDocs(documents) {
  const elements=new Map();
  const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
  const document={
    getElementById:get,
    querySelector:selector=>selector==='.event-widget'?get('event-widget'):get(selector),
    createElement:()=>new Element(),
    addEventListener(){}
  };
  const recorded={deleted:[],updated:[],added:[]};
  const collection={
    orderBy(field,direction) {
      assert.equal(field,'date');
      assert.equal(direction,'desc');
      return { limit(){return {onSnapshot(handler) {
        handler({docs:documents.map(({id,...record})=>({id,data:()=>record}))});
      }}}};
    },
    doc(id){return {
      delete:async()=>{recorded.deleted.push(id)},
      update:async record=>{recorded.updated.push({id,record})}
    }},
    add:async record=>{recorded.added.push(record)}
  };
  const window={firebase:{apps:[{}],firestore:()=>({collection:name=>{
    assert.equal(name,'eventosPublicos');return collection;
  }})}};
  vm.runInNewContext(source,{document,window,localStorage:{getItem:()=>null},
    setInterval:()=>1,confirm:()=>true,console:{error(){},warn(){}},Intl,Date});
  return {get,recorded};
}

test('Agenda mostra somente dados reais, prazos em dias e duas visualizações',()=>{
  const {get}=runWithDocs([
    {id:'a',type:'Assembleia',title:'Primeiro evento',date:offsetDate(5),location:'Local A'},
    {id:'b',type:'Congresso',title:'Segundo evento',date:offsetDate(38),location:'Local B'},
    {id:'c',type:'Outro',title:'Já ocorreu',date:offsetDate(-4),location:''}
  ]);
  assert.equal(get('event-next-title').textContent,'Primeiro evento');
  assert.equal(get('event-days').textContent,'5');
  assert.equal(get('agenda-hero-days').textContent,'5');
  assert.equal(get('agenda-kpi-upcoming').textContent,'2');
  assert.equal(get('agenda-kpi-month').textContent,'1');
  assert.equal(get('agenda-kpi-types').textContent,'2');
  assert.equal(get('agenda-type-chart').children.length,4);
  assert.equal(get('agenda-month-chart').children.length,6);
  assert.equal(get('agenda-events-list').children.length,2);
  assert.equal(get('agenda-events-list').children[0].children[1].children.at(-1).textContent,'Faltam 5 dias');
  assert.equal(get('agenda-events-list').children[0].children[2].children.length,2);
  assert.equal(get('event-list').children.length,3,'o histórico cadastrado permanece visível no quadro compacto');
  get('event-dashboard-open').listeners.click();
  assert.equal(get('event-dashboard').open,true);
  get('event-dashboard-close').listeners.click();
  assert.equal(get('event-dashboard').open,false);
});

test('Agenda sem eventos não inventa dados ou gráficos preenchidos',()=>{
  const {get}=runWithDocs([]);
  assert.equal(get('agenda-kpi-upcoming').textContent,'0');
  assert.equal(get('agenda-kpi-month').textContent,'0');
  assert.equal(get('agenda-kpi-types').textContent,'0');
  assert.equal(get('agenda-hero-days').textContent,'—');
  assert.equal(get('agenda-events-list').children.length,0);
  assert.equal(get('agenda-events-empty').hidden,false);
  assert.equal(get('agenda-type-chart').children.every(row=>row.children[1].children[0].style.width==='0%'),true);
  assert.equal(get('agenda-month-chart').children.every(col=>col.children[1].children[0].style.height==='0%'),true);
});

test('Agenda mantém cadastro no Firestore e botão de inclusão em ambos os painéis',()=>{
  const {get}=runWithDocs([]);
  assert.equal(get('event-open').disabled,false);
  assert.equal(get('agenda-add').disabled,false);
  get('agenda-add').listeners.click();
  assert.equal(get('event-dialog').open,true);
});
