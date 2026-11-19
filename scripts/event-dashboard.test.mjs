import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public-events.js', import.meta.url), 'utf8');
const programsSource = await readFile(new URL('../event-programs.js', import.meta.url), 'utf8');

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
  reportValidity(){return true}
}
function runWithDocs(documents, useOfficial = false) {
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
  if (useOfficial) vm.runInNewContext(programsSource, {window});
  vm.runInNewContext(source,{document,window,localStorage:{getItem:()=>null},
    setInterval:()=>1,confirm:()=>true,console:{error(){},warn(){}},Intl,Date});
  return {get,recorded};
}

test('Agenda exibe apenas cards ilustrados com os eventos reais e suas datas',()=>{
  const {get}=runWithDocs([
    {id:'a',type:'Assembleia',title:'Primeiro evento',date:offsetDate(5),location:'Local A'},
    {id:'b',type:'Congresso',title:'Segundo evento',date:offsetDate(38),location:'Local B'},
    {id:'c',type:'Outro',title:'Já ocorreu',date:offsetDate(-4),location:''}
  ]);
  assert.equal(get('event-next-title').textContent,'Primeiro evento');
  assert.equal(get('event-days').textContent,'5');
  assert.equal(get('agenda-events-list').children.length,2);
  assert.equal(get('agenda-events-list').children[0].children[1].children.at(-1).textContent,'Faltam 5 dias');
  assert.equal(get('agenda-events-list').children[0].children[2].children.length,3);
  assert.equal(get('event-list').children.length,3,'o histórico cadastrado permanece visível no quadro compacto');
  get('event-dashboard-open').listeners.click();
  assert.equal(get('event-dashboard').open,true);
  get('event-dashboard-close').listeners.click();
  assert.equal(get('event-dashboard').open,false);
});

test('Agenda sem eventos mostra estado vazio sem gráficos',()=>{
  const {get}=runWithDocs([]);
  assert.equal(get('agenda-events-list').children.length,0);
  assert.equal(get('agenda-events-empty').hidden,false);
});

test('Agenda mantém cadastro no Firestore e botão de inclusão em ambos os painéis',()=>{
  const {get}=runWithDocs([]);
  assert.equal(get('event-open').disabled,false);
  assert.equal(get('agenda-add').disabled,false);
  get('agenda-add').listeners.click();
  assert.equal(get('event-dialog').open,true);
});


test('Celebração apresenta somente as três datas oficiais e a imagem enviada',()=>{
  const {get}=runWithDocs([],true);
  const expected=['2027-03-22','2028-04-09','2029-03-29'].filter(d=>d>=dateInBrasilia());

  assert.equal(get('agenda-events-list').children.length,expected.length);
  if(expected.length) {
    const item=get('agenda-events-list').children[0];
    assert.equal(item.children[1].children[0].textContent,'Celebração');
    assert.equal(item.children[2].children.length,1,'datas oficiais são somente leitura');
    item.children[2].children[0].listeners.click();
    assert.equal(get('event-details-dialog').open,true);
    assert.equal(get('event-details-image').src,'images/celebracao-jesus.webp');
    assert.match(get('event-details-note').textContent,/após o pôr do sol/);
    assert.match(get('event-details-source').href,/jw\.org/);
  }
});

test('Programa oficial da Assembleia abre completo dividido em manhã e tarde',()=>{
  const {get}=runWithDocs([],true);
  get('agenda-reference-view').listeners.click();
  assert.equal(get('event-details-dialog').open,true);
  assert.equal(get('event-details-title').textContent,'Encontre a Mais Plena Alegria em Jeová');
  assert.equal(get('event-details-scripture').textContent,'Salmo 37:4');
  const sections=get('event-details-program').children;
  assert.equal(sections.length,2);
  assert.equal(sections[0].children[0].textContent,'Manhã');
  assert.equal(sections[1].children[0].textContent,'Tarde');
  assert.equal(sections[0].children[1].children.length,9);
  assert.equal(sections[1].children[1].children.length,9);
  assert.match(get('event-details-source').href,/1102027242/);
});

test('Visita permite salvar semana terça-domingo e dois temas independentes',async()=>{
  const {get,recorded}=runWithDocs([],true);
  get('agenda-add').listeners.click();
  get('event-form-type').value='Visita';
  get('event-form-type').listeners.change();
  const nextDate=new Date(dateInBrasilia()+'T00:00:00Z');
  nextDate.setUTCDate(nextDate.getUTCDate()+(9-nextDate.getUTCDay())%7);
  const tuesday=nextDate.toISOString().slice(0,10);
  get('event-form-date').value=tuesday;
  get('event-form-date').listeners.change();
  assert.equal(get('event-form-date-end').value,offsetDateFrom(tuesday,5));
  assert.equal(get('event-talk-1-date').value,tuesday);
  assert.equal(get('event-talk-2-date').value,offsetDateFrom(tuesday,4));
  get('event-form-title').value='Visita do superintendente';
  get('event-talk-1-theme').value='Tema de terça';
  get('event-talk-2-theme').value='Tema de sábado';
  get('event-talk-1-time').value='19:30';
  get('event-talk-2-time').value='18:00';
  await get('event-form').listeners.submit({preventDefault(){}});
  assert.equal(recorded.added.length,1);
  assert.equal(recorded.added[0].dateEnd,offsetDateFrom(tuesday,5));
  assert.equal(recorded.added[0].talks.length,2);
  assert.equal(recorded.added[0].talks[0].theme,'Tema de terça');
  assert.equal(recorded.added[0].talks[1].theme,'Tema de sábado');
});

function offsetDateFrom(value,days) {
  const date=new Date(value+'T00:00:00Z');
  date.setUTCDate(date.getUTCDate()+days);
  return date.toISOString().slice(0,10);
}

test('Card da visita exibe imagem enviada, data e abre os discursos',()=>{
  const date=offsetDate(6);
  const {get}=runWithDocs([{id:'visita-visual',type:'Visita',title:'Visita do superintendente',
    date,location:'Salão',dateEnd:offsetDate(11),talks:[
      {date,theme:'Discurso da semana',time:'19:30'},
      {date:offsetDate(10),theme:'Discurso de sábado',time:'18:00'}]}]);
  assert.equal(get('event-next-image').src,'images/visita-super.jpg');
  assert.match(get('event-next-date-chip').textContent,/\d{4}/);
  assert.equal(get('agenda-events-list').children[0].children[3].children[0].src,'images/visita-super.jpg');
  get('event-next').listeners.click();
  assert.equal(get('event-details-image').src,'images/visita-super.jpg');
  assert.equal(get('event-details-program').children.length,2);
});

test('Todo tipo de evento pode ter imagem própria e detalhes ilustrados',()=>{
  const {get}=runWithDocs([{id:'outro-visual',type:'Outro',title:'Evento especial',
    date:offsetDate(7),imageUrl:'https://example.com/capa.jpg',description:'Local a confirmar'}]);
  const card=get('agenda-events-list').children[0];
  assert.equal(card.children[3].children[0].src,'https://example.com/capa.jpg');
  card.children[3].listeners.click();
  assert.equal(get('event-details-dialog').open,true);
  assert.equal(get('event-details-description').textContent,'Local a confirmar');
  assert.equal(get('event-details-image').src,'https://example.com/capa.jpg');
});

test('Celebração antiga ignora capa, link e tema personalizados e mantém título oficial',()=>{
  const {get}=runWithDocs([{
    id:'memorial-manual',type:'Celebração',title:'Celebração cadastrada',
    date:offsetDate(4),imageUrl:'https://example.com/foto-errada.jpg',
    sourceUrl:'https://example.com/sem-fonte',theme:'Tema personalizado'
  }],true);
  assert.equal(get('event-next-image').src,'images/celebracao-jesus.webp');
  const card=get('agenda-events-list').children[0];
  assert.equal(card.children[3].children[0].src,'images/celebracao-jesus.webp');
  card.children[3].listeners.click();
  assert.equal(get('event-details-image').src,'images/celebracao-jesus.webp');
  assert.equal(get('event-details-title').textContent,'Celebração da morte de Cristo');
  assert.match(get('event-details-source').href,/jw\.org/);
});

test('Formulário da Celebração oculta capas e sempre salva fonte oficial',async()=>{
  const {get,recorded}=runWithDocs([],true);
  get('agenda-add').listeners.click();
  get('event-form-type').value='Celebração';
  get('event-form-type').listeners.change();
  assert.equal(get('event-form-media-fields').hidden,true);
  get('event-form-date').value=offsetDate(5);
  get('event-form-title').value='Celebração';
  get('event-form-image').value='https://example.com/imagem-inadequada.jpg';
  get('event-form-source').value='https://example.com/nao-oficial';
  await get('event-form').listeners.submit({preventDefault(){}});
  assert.equal(recorded.added.length,1);
  assert.equal(recorded.added[0].imageUrl,'');
  assert.match(recorded.added[0].sourceUrl,/jw\.org/);
  get('event-form-type').value='Visita';
  get('event-form-type').listeners.change();
  assert.equal(get('event-form-media-fields').hidden,false);
});
