// Atualização pontual solicitada para a visita de 24 a 29/11/2026.
// Usa as permissões públicas existentes. Nunca cria eventos ou altera outros documentos.
const base = 'https://firestore.googleapis.com/v1/projects/planejamento-espiritual/databases/(default)/documents';
async function request(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error('Firestore HTTP ' + response.status);
  return response.json();
}
const rows = await request(base + ':runQuery', {
  method:'POST', headers:{'Content-Type':'application/json'},
  body:JSON.stringify({structuredQuery:{from:[{collectionId:'eventosPublicos'}],
    where:{fieldFilter:{field:{fieldPath:'date'},op:'EQUAL',value:{stringValue:'2026-11-24'}}}}})
});
const matches = rows.map(row=>row.document).filter(doc=>doc?.fields?.type?.stringValue==='Visita');
if (matches.length !== 1) throw new Error('Esperado exatamente um cadastro da visita; encontrados: '+matches.length+'. Nenhum evento alterado.');
const doc=matches[0];
const end=doc.fields.dateEnd?.stringValue;
if (end && end!=='2026-11-29') throw new Error('Data final divergente; nenhum evento alterado.');
const talks=[
  {date:'2026-11-24',time:'',theme:'Tenha a mais alta consideração por eles em amor'},
  {date:'2026-11-28',time:'',theme:'A História e o Ministério de Jesus: Episódio 2 — “Este é meu filho” — Parte I'},
  {date:'2026-11-28',time:'',theme:'Quem realmente governa o mundo?'}
];
const note='Superintendente de circuito: Adiltom Vieira dos Santos. Reunião de meio de semana: terça-feira, 24/11, às 19h45. Reunião de fim de semana: sábado, 28/11, às 19h. Horários individuais dos discursos não informados.';
const original=doc.fields.description?.stringValue||'';
const description=original.includes(note)?original:[original,note].filter(Boolean).join('\n\n');
if(description.length>700)throw new Error('Descrição excederia o limite; nenhum evento alterado.');
const fields={talks:{arrayValue:{values:talks.map(talk=>({mapValue:{fields:Object.fromEntries(Object.entries(talk).map(([k,v])=>[k,{stringValue:v}]))}}))}},description:{stringValue:description}};
const params=new URLSearchParams();
for(const key of Object.keys(fields))params.append('updateMask.fieldPaths',key);
params.set('currentDocument.updateTime',doc.updateTime);
const url='https://firestore.googleapis.com/v1/'+doc.name;
await request(url+'?'+params,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields})});
const verified=await request(url);
if(JSON.stringify(verified.fields.talks.arrayValue.values.map(v=>v.mapValue.fields.theme.stringValue))!==JSON.stringify(talks.map(t=>t.theme)))throw new Error('Falha na conferência dos temas.');
if(!verified.fields.description.stringValue.includes(note))throw new Error('Falha na conferência do nome e horários.');
console.log('VISITA_CONFIRMADA: três discursos cadastrados e conferidos no evento existente de 24/11/2026.');
