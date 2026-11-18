(function () {
  'use strict';
  // Agenda pública: qualquer visitante pode ver, adicionar, editar e excluir eventos.
  // Eventos locais antigos só são compartilhados após confirmação explícita.
  const legacyKey = 'planejamento-espiritual-20-events';
  const types = new Set(['Congresso', 'Assembleia', 'Visita', 'Celebração', 'Outro']);
  const references = window.spiritualEventPrograms || { assembly: null, memorial: null };
  const dialog = document.getElementById('event-dialog');
  const form = document.getElementById('event-form');
  const submit = form.querySelector('button[type="submit"]');
  const add = document.getElementById('event-open');
  const importButton = document.getElementById('event-import');
  const status = document.getElementById('event-sync-status');
  const currentDate = () => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date()).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    return parts.year + '-' + parts.month + '-' + parts.day;
  };
  let collection = null;
  let connected = false;
  let sharedEvents = [];
  let editingId = null;
  let saving = false;
  const widget = document.querySelector('.event-widget');
  const toggle = document.getElementById('event-toggle');
  const dashboard = document.getElementById('event-dashboard');
  const openDashboard = document.getElementById('event-dashboard-open');
  const closeDashboard = document.getElementById('event-dashboard-close');
  const dashboardAdd = document.getElementById('agenda-add');
  const nextCard = document.getElementById('event-next');
  let nextCardItem = null;
  nextCard.addEventListener('click', () => { if (nextCardItem) showEventDetails(nextCardItem); });
  nextCard.addEventListener('keydown', event => {
    if (nextCardItem && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      showEventDetails(nextCardItem);
    }
  });

  function setMobileCollapsed(collapsed) {
    widget.dataset.mobileCollapsed = String(collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Expandir agenda' : 'Recolher agenda');
    toggle.title = collapsed ? 'Expandir agenda' : 'Recolher agenda';
  }

  toggle.addEventListener('click', () => {
    setMobileCollapsed(widget.dataset.mobileCollapsed !== 'true');
  });

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }

  function dateLabel(value) {
    if (!validDate(value)) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric'
    }).format(new Date(value + 'T00:00:00Z'));
  }

  function shortDate(value) {
    if (!validDate(value)) return '';
    const date = new Date(value + 'T00:00:00Z');
    const month = new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',month:'short'})
      .format(date).replace(/\./g,'').toUpperCase();
    return String(date.getUTCDate()).padStart(2,'0')+' '+month+' '+date.getUTCFullYear();
  }
  function until(value) {
    return Math.round((Date.parse(value + 'T00:00:00Z') -
      Date.parse(currentDate() + 'T00:00:00Z')) / 86400000);
  }

  function addDays(date, count) {
    if (!validDate(date)) return '';
    const next = new Date(date + 'T00:00:00Z');
    next.setUTCDate(next.getUTCDate() + count);
    return next.toISOString().slice(0, 10);
  }
  function visitWeekIsValid(start, end) {
    return validDate(start) && new Date(start + 'T00:00:00Z').getUTCDay() === 2 &&
      end === addDays(start, 5);
  }
  function safeHttpsUrl(value) {
    return typeof value === 'string' && /^https:\/\/[^\s<>"']+$/i.test(value) ?
      value.slice(0, 500) : '';
  }
  function dayWithin(date, start, end) {
    return validDate(date) && date >= start && date <= end;
  }
  function cleanTalks(input) {
    if (!Array.isArray(input)) return [];
    return input.slice(0, 2).map(item => ({
      date: validDate(item?.date) ? item.date : '',
      time: /^([01]\d|2[0-3]):[0-5]\d$/.test(item?.time || '') ? item.time : '',
      theme: typeof item?.theme === 'string' ? item.theme.slice(0, 180) : ''
    }));
  }
  function memorialEvents() {
    if (!references.memorial) return [];
    return references.memorial.dates.map(date => ({
      id: 'official-memorial-' + date, type: 'Celebração',
      title: references.memorial.title, date, location: '', dateEnd: date,
      theme: '', scripture: 'Lucas 22:19', programId: '',
      programText: '', talks: [], time: '', sourceUrl: references.memorial.source,
      imageUrl: references.memorial.image, official: true
    }));
  }
  function allEventsWithOfficialDates() {
    const items = sharedEvents.slice();
    for (const official of memorialEvents()) {
      if (!items.some(item => item.type === 'Celebração' && item.date === official.date)) {
        items.push(official);
      }
    }
    return items;
  }
  function defaultCover(item) {
    if (item.type === 'Visita') return 'images/visita-super.jpg';
    if (item.type === 'Assembleia') return references.assembly?.image || 'images/evento-padrao.svg';
    if (item.type === 'Celebração') return references.memorial?.image || 'images/celebracao-jesus.webp';
    if (item.type === 'Congresso') return 'images/congresso.svg';
    return 'images/evento-padrao.svg';
  }
  function imageOf(item) {
    return safeHttpsUrl(item.imageUrl) || defaultCover(item);
  }
  function sourceOf(item) {
    if (item.type === 'Celebração' && references.memorial) return references.memorial.source;
    if (item.type === 'Assembleia' && item.programId === 'CA-brpgm27' && references.assembly) {
      return safeHttpsUrl(item.sourceUrl) || references.assembly.source;
    }
    return safeHttpsUrl(item.sourceUrl);
  }
  // Computed exclusively from Firestore events, using Brasília calendar dates.
  function upcomingEvents(items) {
    return items.filter(item => validDate(item.date) && until(item.dateEnd || item.date) >= 0)
      .slice().sort((a,b) => a.date.localeCompare(b.date) || titleOf(a).localeCompare(titleOf(b)));
  }
  function countByType(items) {
    return ['Congresso','Assembleia','Visita','Celebração','Outro'].map(type => ({
      name:type, count:items.filter(item => item.type === type).length
    }));
  }
  function sixMonthCounts(items) {
    const [year,month] = currentDate().slice(0,7).split('-').map(Number);
    return Array.from({length:6},(_,index) => {
      const date = new Date(Date.UTC(year,month-1+index,1));
      const key = date.toISOString().slice(0,7);
      const label = new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',month:'short'}).format(date).replace(/\.$/,'');
      return {key,label,count:items.filter(item => item.date.startsWith(key)).length};
    });
  }
  function remainingLabel(days) {
    return days < 0 ? 'Em andamento' : days === 0 ? 'É hoje' : days === 1 ? 'Falta 1 dia' : 'Faltam '+days+' dias';
  }
  function renderTypeChart(items) {
    const target = document.getElementById('agenda-type-chart');
    target.replaceChildren();
    const entries = countByType(items);
    const maximum = Math.max(1,...entries.map(item => item.count));
    target.setAttribute('aria-label','Eventos futuros por categoria: '+
      entries.map(item => item.name+': '+item.count).join(', '));
    for (const item of entries) {
      const row = document.createElement('div');
      row.className='agenda-type-row';
      const top = document.createElement('div');
      top.className='agenda-type-row-heading';
      const label=document.createElement('span');
      label.textContent=item.name;
      const count=document.createElement('strong');
      count.textContent=String(item.count);
      top.append(label,count);
      const track=document.createElement('div');
      track.className='agenda-type-track';
      const bar=document.createElement('span');
      bar.className='agenda-type-bar';
      bar.dataset.type=item.name;
      bar.style.width=(100*item.count/maximum)+'%';
      track.append(bar);
      row.append(top,track);
      target.append(row);
    }
  }
  function renderMonthChart(items) {
    const target=document.getElementById('agenda-month-chart');
    target.replaceChildren();
    const entries=sixMonthCounts(items);
    const maximum=Math.max(1,...entries.map(item=>item.count));
    target.setAttribute('aria-label','Eventos por mês: '+
      entries.map(item=>item.key+': '+item.count).join(', '));
    for (const item of entries) {
      const col=document.createElement('div');
      col.className='agenda-month-col';
      const count=document.createElement('strong');
      count.className='agenda-month-count';
      count.textContent=String(item.count);
      const track=document.createElement('div');
      track.className='agenda-month-track';
      const bar=document.createElement('span');
      bar.className='agenda-month-bar';
      bar.style.height=(100*item.count/maximum)+'%';
      track.append(bar);
      const label=document.createElement('span');
      label.className='agenda-month-label';
      label.textContent=item.label;
      col.append(count,track,label);
      target.append(col);
    }
  }
  function dashboardActions(item) {
    const actions=document.createElement('div');
    actions.className='event-list-actions';
    const edit=document.createElement('button');
    edit.type='button';
    edit.textContent='Editar';
    edit.disabled=!connected;
    edit.addEventListener('click',()=>openDialog(item));
    const remove=document.createElement('button');
    remove.type='button';
    remove.textContent='Excluir';
    remove.disabled=!connected;
    remove.addEventListener('click',async()=>{
      if(!collection || !confirm('Excluir "'+titleOf(item)+'" da agenda de todos?')) return;
      remove.disabled=true;
      try {
        await collection.doc(item.id).delete();
        message('Evento excluído para todos.');
      } catch(error) {
        console.error('Erro ao excluir evento público:',error);
        remove.disabled=false;
        message('Não foi possível excluir o evento.',true);
      }
    });
    if (!item.official) actions.append(edit,remove);
    const detail = document.createElement('button');
    detail.type = 'button';
    detail.textContent = item.type === 'Assembleia' ? 'Programa' : 'Detalhes';
    detail.addEventListener('click', () => showEventDetails(item));
    actions.append(detail);
    return actions;
  }
  function renderDashboard(upcoming) {
    const next=upcoming[0];
    document.getElementById('agenda-hero-title').textContent=next?titleOf(next):'Nenhum evento futuro';
    document.getElementById('agenda-hero-meta').textContent=next
      ?dateLabel(next.date)+(next.location?' · '+next.location:'')
      :'Adicione um evento para começar seu planejamento.';
    const left=next?until(next.date):null;
    document.getElementById('agenda-hero-days').textContent=left===null?'—':left<0?'ATUAL':left===0?'HOJE':String(left);
    const cover=document.getElementById('agenda-hero-image');
    const coverSource=next?imageOf(next):'';
    cover.hidden=!coverSource;
    if (coverSource) cover.src=coverSource;
    cover.alt=coverSource?'Imagem do próximo compromisso':'';
    const heroDate=document.getElementById('agenda-hero-date-chip');
    heroDate.hidden=!next;
    if (next) { heroDate.dateTime=next.date; heroDate.textContent=shortDate(next.date); }
    document.getElementById('agenda-hero-days-label').textContent=left===null?'sem eventos':left<0?'em andamento':left===0?'é hoje':'dias restantes';
    document.getElementById('agenda-kpi-upcoming').textContent=String(upcoming.length);
    document.getElementById('agenda-kpi-month').textContent=String(upcoming.filter(item=>until(item.date)<=30).length);
    document.getElementById('agenda-kpi-types').textContent=String(new Set(upcoming.map(item=>item.type)).size);
    renderTypeChart(upcoming);
    renderMonthChart(upcoming);
    const list=document.getElementById('agenda-events-list');
    list.replaceChildren();
    document.getElementById('agenda-events-empty').hidden=upcoming.length>0;
    for(const item of upcoming) {
      const row=document.createElement('li');
      row.className='agenda-event';
      const badge=document.createElement('time');
      badge.className='agenda-event-date';
      badge.dateTime=item.date;
      const day=document.createElement('strong');
      day.textContent=item.date.slice(8,10);
      const month=document.createElement('small');
      month.textContent=new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',month:'short'})
        .format(new Date(item.date+'T00:00:00Z')).replace(/\.$/,'');
      badge.append(day,month);
      const info=document.createElement('div');
      info.className='agenda-event-info';
      const type=document.createElement('span');
      type.className='agenda-event-type';
      type.textContent=item.type;
      const title=document.createElement('strong');
      title.textContent=titleOf(item);
      const meta=document.createElement('span');
      meta.className='agenda-event-meta';
      meta.textContent=dateLabel(item.date)+(item.dateEnd && item.dateEnd !== item.date?' a '+dateLabel(item.dateEnd):'')+(item.location?' · '+item.location:'');
      const remaining=document.createElement('span');
      remaining.className='agenda-event-remaining';
      remaining.textContent=remainingLabel(until(item.date));
      info.append(type,title,meta,remaining);
      const coverButton=document.createElement('button');
      coverButton.type='button';
      coverButton.className='agenda-event-cover';
      coverButton.setAttribute('aria-label','Abrir detalhes de '+titleOf(item));
      const coverImage=document.createElement('img');
      coverImage.className='agenda-event-image';
      coverImage.src=imageOf(item);
      coverImage.alt='Imagem de '+titleOf(item);
      coverImage.loading='lazy';
      const imageDate=document.createElement('time');
      imageDate.className='agenda-event-image-date';
      imageDate.dateTime=item.date;
      imageDate.textContent=shortDate(item.date);
      const imageDays=document.createElement('span');
      imageDays.className='agenda-event-image-days';
      imageDays.textContent=remainingLabel(until(item.date));
      coverButton.append(coverImage,imageDate,imageDays);
      coverButton.addEventListener('click',()=>showEventDetails(item));
      row.append(badge,info,dashboardActions(item),coverButton);
      list.append(row);
    }
  }

  function detailText(tag, className, value) {
    const el = document.createElement(tag);
    el.className = className;
    el.textContent = value;
    return el;
  }

  function renderProgramSection(root, title, entries) {
    if (!entries.length) return;
    const section = document.createElement('section');
    section.className = 'event-details-section';
    section.append(detailText('h3', 'event-details-section-title', title));
    const list = document.createElement('ol');
    list.className = 'event-details-timeline';
    for (const [clock, description] of entries) {
      const row = document.createElement('li');
      if (clock) row.append(detailText('time', 'event-details-time', clock));
      row.append(detailText('span', 'event-details-talk-title', description));
      list.append(row);
    }
    section.append(list);
    root.append(section);
  }

  function parseCustomProgram(text) {
    const sections = new Map();
    for (const line of String(text || '').split(/\r?\n/).slice(0, 90)) {
      if (!line.trim()) continue;
      const parts = line.split('|').map(item => item.trim());
      if (parts.length !== 4 || !parts[3]) continue;
      const heading = [parts[0], parts[1]].filter(Boolean).join(' · ') || 'Programação';
      if (!sections.has(heading)) sections.set(heading, []);
      sections.get(heading).push([parts[2].slice(0, 12), parts[3].slice(0, 200)]);
    }
    return [...sections.entries()].map(([title, items]) => ({title, items}));
  }

  function showEventDetails(item) {
    const details = document.getElementById('event-details-dialog');
    const cover = document.getElementById('event-details-image');
    const image = imageOf(item);
    cover.hidden = !image;
    if (image) cover.src = image;
    cover.alt = image ? 'Imagem de ' + titleOf(item) : '';
    const detailDate=document.getElementById('event-details-date-chip');
    detailDate.hidden=!validDate(item.date);
    if (validDate(item.date)) { detailDate.dateTime=item.date; detailDate.textContent=shortDate(item.date); }
    const detailDays=document.getElementById('event-details-days-chip');
    detailDays.hidden=!validDate(item.date);
    if (validDate(item.date)) detailDays.textContent=remainingLabel(until(item.date));
    const officialAssembly = item.type === 'Assembleia' && item.programId === 'CA-brpgm27'
      ? references.assembly : null;
    document.getElementById('event-details-kind').textContent =
      item.official ? 'DATA OFICIAL · ' + item.type.toUpperCase() : item.type.toUpperCase();
    document.getElementById('event-details-title').textContent =
      item.theme || officialAssembly?.title || titleOf(item);
    const scripture = item.scripture || officialAssembly?.scripture || '';
    const scriptureElement = document.getElementById('event-details-scripture');
    scriptureElement.hidden = !scripture;
    scriptureElement.textContent = scripture;
    document.getElementById('event-details-period').textContent =
      validDate(item.date)
        ? dateLabel(item.date) + (item.dateEnd && item.dateEnd !== item.date
          ? ' — ' + dateLabel(item.dateEnd) : '')
        : 'Referência oficial · data do evento ainda não cadastrada';
    const location = document.getElementById('event-details-location');
    location.textContent = item.location || '';
    location.hidden = !item.location;
    const note = document.getElementById('event-details-note');
    note.hidden = item.type !== 'Celebração';
    note.textContent = item.type === 'Celebração'
      ? 'Realizada após o pôr do sol' +
        (item.time ? ' · Horário cadastrado: ' + item.time : ' · Confira o horário com a congregação.')
      : '';
    const description=document.getElementById('event-details-description');
    description.hidden=!item.description;
    description.textContent=item.description || '';
    const program = document.getElementById('event-details-program');
    program.replaceChildren();
    if (item.type === 'Assembleia') {
      const sections = item.programText ? parseCustomProgram(item.programText)
        : officialAssembly?.sections || [];
      for (const section of sections) renderProgramSection(program, section.title, section.items);
      if (!sections.length) {
        program.append(detailText('p', 'event-details-empty',
          'Ainda não há uma programação cadastrada para esta assembleia.'));
      }
    } else if (item.type === 'Visita') {
      const talks = cleanTalks(item.talks);
      talks.forEach((talk, index) => {
        const title = 'Discurso ' + (index + 1) +
          (talk.date ? ' · ' + dateLabel(talk.date) : '') +
          (talk.time ? ' às ' + talk.time : '');
        renderProgramSection(program, title, [
          ['', talk.theme || 'Tema ainda não informado.']
        ]);
      });
      if (!talks.length) program.append(detailText('p', 'event-details-empty',
        'Os discursos ainda não foram cadastrados. Edite a visita para incluir datas e temas.'));
    } else if (item.type === 'Celebração') {
      program.append(detailText('p', 'event-details-memorial',
        'A Celebração recorda a morte de Jesus Cristo. O horário local deve ser confirmado antes do evento.'));
    }
    const link = document.getElementById('event-details-source');
    const url = sourceOf(item);
    link.hidden = !url;
    if (url) link.href = url;
    link.textContent=item.type === 'Assembleia' || item.type === 'Celebração'
      ? 'Consultar publicação oficial ↗' : 'Abrir referência do evento ↗';
    if (!details.open) details.showModal();
  }
  function message(text, error = false) {
    status.textContent = text;
    status.classList.toggle('error', error);
  }

  function setConnected(value) {
    connected = value;
    add.disabled = !value;
    importButton.disabled = !value;
    dashboardAdd.disabled = !value;
  }

  function fromDoc(doc) {
    const item = doc.data() || {};
    return {
      id: doc.id,
      type: types.has(item.type) ? item.type : 'Outro',
      title: typeof item.title === 'string' ? item.title.slice(0, 100) : '',
      date: validDate(item.date) ? item.date : '',
      location: typeof item.location === 'string' ? item.location.slice(0, 120) : '',
      description: typeof item.description === 'string' ? item.description.slice(0, 700) : '',
      dateEnd: validDate(item.dateEnd) ? item.dateEnd : '',
      theme: typeof item.theme === 'string' ? item.theme.slice(0, 140) : '',
      scripture: typeof item.scripture === 'string' ? item.scripture.slice(0, 100) : '',
      imageUrl: safeHttpsUrl(item.imageUrl),
      sourceUrl: safeHttpsUrl(item.sourceUrl),
      programId: item.programId === 'CA-brpgm27' ? item.programId : '',
      programText: typeof item.programText === 'string' ? item.programText.slice(0, 8000) : '',
      talks: cleanTalks(item.talks),
      time: /^([01]\d|2[0-3]):[0-5]\d$/.test(item.time || '') ? item.time : '',
      official: false
    };
  }

  function legacyEvents() {
    try {
      const items = JSON.parse(localStorage.getItem(legacyKey) || '[]');
      return Array.isArray(items) ? items.filter(item =>
        item && typeof item.title === 'string' && validDate(item.date) &&
        item.date >= currentDate()).slice(0, 50) : [];
    } catch {
      return [];
    }
  }

  function titleOf(item) {
    return item.title || item.type || 'Evento';
  }

  function render() {
    const ordered = allEventsWithOfficialDates().filter(item => item.date)
      .sort((a, b) => a.date.localeCompare(b.date) || titleOf(a).localeCompare(titleOf(b)));
    const next = ordered.find(item => until(item.dateEnd || item.date) >= 0);
    nextCardItem = next || null;
    const mini = document.getElementById('event-mini');
    if (next) {
      const [year, month, day] = next.date.split('-');
      mini.textContent = titleOf(next) + ' · ' + day + '/' + month;
    } else {
      mini.textContent = 'Nenhum evento cadastrado';
    }
    document.getElementById('event-empty').hidden = Boolean(next);
    document.getElementById('event-next').hidden = !next;
    const days=next?until(next.date):null;
    document.getElementById('event-days').textContent=days===null?'—':days<0?'ATUAL':days===0?'HOJE':String(days);
    document.getElementById('event-days-label').textContent=days!==null&&days<0?'em andamento':days===0?'é hoje':'dias restantes';
    const miniImage=document.getElementById('event-next-image');
    const nextImage=next?imageOf(next):'';
    miniImage.hidden=!nextImage;
    if (nextImage) miniImage.src=nextImage;
    miniImage.alt=nextImage?'Imagem do evento '+titleOf(next):'';
    const miniDate=document.getElementById('event-next-date-chip');
    miniDate.hidden=!next;
    if (next) { miniDate.dateTime=next.date; miniDate.textContent=shortDate(next.date); }
    renderDashboard(upcomingEvents(ordered));
    if (next) {
      document.getElementById('event-next-type').textContent = next.type;
      document.getElementById('event-next-title').textContent = titleOf(next);
      const remaining = until(next.date);
      const distance = remaining < 0 ? 'Em andamento' : remaining === 0 ? 'Hoje' : remaining === 1 ? 'Amanhã' : 'Em ' + remaining + ' dias';
      document.getElementById('event-next-date').textContent = dateLabel(next.date) + (next.dateEnd && next.dateEnd !== next.date ? ' a ' + dateLabel(next.dateEnd) : '') + ' · ' + distance;
      const location = document.getElementById('event-next-location');
      location.textContent = next.location;
      location.hidden = !next.location;
    }

    const wrapper = document.getElementById('event-all');
    const list = document.getElementById('event-list');
    wrapper.hidden = ordered.length === 0;
    list.replaceChildren();
    for (const item of ordered) {
      const row = document.createElement('li');
      const info = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = titleOf(item);
      const meta = document.createElement('small');
      meta.textContent = dateLabel(item.date) + (until(item.date) < 0 ? ' · encerrado' : '');
      info.append(title, meta);
      const actions = document.createElement('div');
      actions.className = 'event-list-actions';

      if (!item.official) {
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Editar';
      edit.disabled = !connected;
      edit.addEventListener('click', () => openDialog(item));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Excluir';
      remove.disabled = !connected;
      remove.addEventListener('click', async () => {
        if (!collection || !confirm('Excluir "' + titleOf(item) + '" da agenda de todos?')) return;
        remove.disabled = true;
        try {
          await collection.doc(item.id).delete();
          message('Evento excluído para todos.');
        } catch (error) {
          console.error('Erro ao excluir evento público:', error);
          remove.disabled = false;
          message('Não foi possível excluir o evento.', true);
        }
      });

      actions.append(edit, remove);
      }
      const detail = document.createElement('button');
      detail.type = 'button';
      detail.textContent = 'Detalhes';
      detail.addEventListener('click', () => showEventDetails(item));
      actions.append(detail);
      const thumb=document.createElement('button');
      thumb.type='button';
      thumb.className='event-list-cover';
      thumb.setAttribute('aria-label','Abrir detalhes de '+titleOf(item));
      const thumbImage=document.createElement('img');
      thumbImage.src=imageOf(item);
      thumbImage.alt='Imagem de '+titleOf(item);
      thumbImage.loading='lazy';
      thumb.append(thumbImage);
      thumb.addEventListener('click',()=>showEventDetails(item));
      row.append(thumb,info,actions);
      list.append(row);
    }

    const unsent = legacyEvents().filter(local =>
      !ordered.some(remote => remote.title === local.title && remote.date === local.date));
    importButton.hidden = !connected || unsent.length === 0;
    importButton.textContent = 'Publicar ' + unsent.length + ' evento(s) antigo(s)';
  }

  function field(id) { return document.getElementById(id); }

  function prefillOfficialAssembly() {
    if (field('event-form-program').value !== 'CA-brpgm27' || !references.assembly) return;
    field('event-form-theme').value = references.assembly.title;
    field('event-form-scripture').value = references.assembly.scripture;
    field('event-form-image').value = references.assembly.image;
    field('event-form-source').value = references.assembly.source;
    field('event-form-program-lines').value = '';
  }

  function updateVisitDates(resetTalks = true) {
    const start = field('event-form-date').value;
    const isTuesday = validDate(start) &&
      new Date(start + 'T00:00:00Z').getUTCDay() === 2;
    field('event-form-date-end').value = isTuesday ? addDays(start, 5) : '';
    if (resetTalks) {
      field('event-talk-1-date').value = isTuesday ? start : '';
      field('event-talk-2-date').value = isTuesday ? addDays(start, 4) : '';
    }
  }

  function toggleEventFields() {
    const type = field('event-form-type').value;
    field('event-form-assembly').hidden = type !== 'Assembleia';
    field('event-form-visit').hidden = type !== 'Visita';
    field('event-form-memorial').hidden = type !== 'Celebração';
    if (type === 'Visita') updateVisitDates(false);
  }

  field('event-form-type').addEventListener('change', () => {
    toggleEventFields();
    const type = field('event-form-type').value;
    if (type === 'Assembleia' && !field('event-form-theme').value) prefillOfficialAssembly();
    if (type === 'Visita') updateVisitDates(true);
    if (type === 'Celebração' && !field('event-form-date').value && references.memorial) {
      const next = references.memorial.dates.find(date => date >= currentDate());
      if (next) field('event-form-date').value = next;
    }
  });
  field('event-form-program').addEventListener('change', () => {
    if (field('event-form-program').value === 'CA-brpgm27') prefillOfficialAssembly();
  });
  field('event-form-date').addEventListener('change', () => {
    if (field('event-form-type').value === 'Visita') updateVisitDates(true);
  });

  function openDialog(item = null) {
    if (!connected || !collection) return;
    form.reset();
    editingId = item ? item.id : null;
    field('event-dialog-title').textContent = item ? 'Editar evento' : 'Adicionar evento';
    submit.textContent = item ? 'Salvar alterações' : 'Salvar evento';
    const inputDate = field('event-form-date');
    inputDate.min = item && item.date < currentDate() ? '' : currentDate();
    field('event-form-program').value = 'CA-brpgm27';
    if (item) {
      field('event-form-type').value = item.type;
      field('event-form-title').value = item.title;
      inputDate.value = item.date;
      field('event-form-location').value = item.location;
      field('event-form-description').value = item.description || '';
      field('event-form-program').value = item.programId || 'custom';
      field('event-form-theme').value = item.theme || '';
      field('event-form-scripture').value = item.scripture || '';
      field('event-form-image').value = item.imageUrl || '';
      field('event-form-source').value = item.sourceUrl || '';
      field('event-form-program-lines').value = item.programText || '';
      field('event-memorial-time').value = item.time || '';
      const talks = cleanTalks(item.talks);
      for (const index of [1, 2]) {
        const talk = talks[index - 1] || {};
        field('event-talk-' + index + '-date').value = talk.date || '';
        field('event-talk-' + index + '-time').value = talk.time || '';
        field('event-talk-' + index + '-theme').value = talk.theme || '';
      }
      field('event-form-date-end').value = item.dateEnd || '';
    }
    toggleEventFields();
    if (!item && field('event-form-type').value === 'Assembleia') prefillOfficialAssembly();
    dialog.showModal();
  }

  document.getElementById('event-details-close').addEventListener('click', () =>
    document.getElementById('event-details-dialog').close());
  document.getElementById('event-details-dialog').addEventListener('click', event => {
    if (event.target === document.getElementById('event-details-dialog')) {
      document.getElementById('event-details-dialog').close();
    }
  });
  document.getElementById('agenda-reference-view').addEventListener('click', () => {
    if (!references.assembly) return;
    showEventDetails({
      type: 'Assembleia', title: references.assembly.title,
      theme: references.assembly.title,
      programId: references.assembly.id,
      date: '', dateEnd: '', location: '',
      imageUrl: references.assembly.image, sourceUrl: references.assembly.source
    });
  });

  openDashboard.addEventListener('click', () => {
    render();
    if (!dashboard.open) dashboard.showModal();
  });
  closeDashboard.addEventListener('click', () => dashboard.close());
  dashboard.addEventListener('click', event => {
    if (event.target === dashboard) dashboard.close();
  });
  dashboardAdd.addEventListener('click', () => openDialog());
  let lastDay = currentDate();
  function refreshWhenDateChanges() {
    const today = currentDate();
    if (today !== lastDay) {
      lastDay = today;
      render();
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshWhenDateChanges();
  });
  setInterval(refreshWhenDateChanges, 60000);
  add.addEventListener('click', () => openDialog());
  document.getElementById('event-cancel').addEventListener('click', () => dialog.close());
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving || !connected || !collection || !form.reportValidity()) return;
    const type = document.getElementById('event-form-type').value;
    const programId = type === 'Assembleia' && field('event-form-program').value === 'CA-brpgm27'
      ? 'CA-brpgm27' : '';
    const title = field('event-form-title').value.trim() ||
      (type === 'Celebração' ? (references.memorial?.title || type)
        : programId ? references.assembly?.title || type : type);
    const date = document.getElementById('event-form-date').value;
    const location = document.getElementById('event-form-location').value.trim();
    if (!types.has(type) || !validDate(date) || (!editingId && date < currentDate())) {
      message('Selecione um tipo e uma data válida.', true);
      return;
    }
    const coverInput=field('event-form-image').value.trim();
    const sourceInput=field('event-form-source').value.trim();
    const descriptionInput=field('event-form-description').value.trim();
    if ((coverInput && !safeHttpsUrl(coverInput)) || (sourceInput && !safeHttpsUrl(sourceInput))) {
      message('Use somente URLs HTTPS válidas para imagem e referência.',true);
      return;
    }
    if (descriptionInput.length > 700) {
      message('A descrição não pode ultrapassar 700 caracteres.',true);
      return;
    }
    if (title.length > 100 || location.length > 120) {
      message('Título ou local ultrapassa o limite.', true);
      return;
    }
    if (!editingId && sharedEvents.some(item => item.title === title && item.date === date)) {
      message('Este evento já está cadastrado.', true);
      return;
    }
    if (type === 'Visita') {
      if (!visitWeekIsValid(date, field('event-form-date-end').value)) {
        message('A visita deve começar na terça e terminar no domingo.', true);
        return;
      }
      for (const index of [1, 2]) {
        const day = field('event-talk-' + index + '-date').value;
        const theme = field('event-talk-' + index + '-theme').value.trim();
        if ((day && !dayWithin(day, date, field('event-form-date-end').value)) ||
            (theme && !day)) {
          message('Informe datas de discursos dentro da visita (terça a domingo).', true);
          return;
        }
      }
    }
    if (type === 'Assembleia') {
      if (field('event-form-theme').value.length > 140 ||
          field('event-form-program-lines').value.length > 8000) {
        message('O tema ou a programação ultrapassou o limite.', true);
        return;
      }
    }
    saving = true;
    submit.disabled = true;
    try {
      const payload = {
        type, title, date, location,
        description: descriptionInput,
        dateEnd: type === 'Visita' ? field('event-form-date-end').value : '',
        theme: type === 'Assembleia' ? field('event-form-theme').value.trim() : '',
        scripture: type === 'Assembleia' ? field('event-form-scripture').value.trim() : '',
        imageUrl: safeHttpsUrl(coverInput),
        sourceUrl: safeHttpsUrl(sourceInput),
        programId,
        programText: type === 'Assembleia' ? field('event-form-program-lines').value.trim() : '',
        talks: type === 'Visita' ? [1, 2].map(index => ({
          date: field('event-talk-' + index + '-date').value,
          time: field('event-talk-' + index + '-time').value,
          theme: field('event-talk-' + index + '-theme').value.trim()
        })) : [],
        time: type === 'Celebração' ? field('event-memorial-time').value : ''
      };
      if (editingId) await collection.doc(editingId).update(payload);
      else await collection.add(payload);
      dialog.close();
      message('Evento salvo para todos.');
    } catch (error) {
      console.error('Erro ao salvar evento público:', error);
      message('Falha ao salvar. Confira a conexão e o Firestore.', true);
    } finally {
      saving = false;
      submit.disabled = false;
    }
  });

  importButton.addEventListener('click', async () => {
    if (!connected || !collection) return;
    const unsent = legacyEvents().filter(local =>
      !sharedEvents.some(remote => remote.title === local.title && remote.date === local.date));
    if (!unsent.length || !confirm('Publicar ' + unsent.length +
      ' evento(s) antigos deste navegador para todos?')) return;
    importButton.disabled = true;
    try {
      for (const item of unsent) {
        const type = types.has(item.type) ? item.type
          : types.has(item.title) ? item.title : 'Outro';
        await collection.add({
          type, title: item.title.slice(0, 100), date: item.date,
          location: typeof item.location === 'string' ? item.location.slice(0, 120) : ''
        });
      }
      message('Eventos antigos publicados para todos.');
    } catch (error) {
      console.error('Falha ao publicar eventos antigos:', error);
      message('Alguns eventos podem não ter sido publicados.', true);
    } finally {
      importButton.disabled = false;
    }
  });

  function connect() {
    setConnected(false);
    message('Conectando agenda compartilhada…');
    try {
      if (!window.firebase || !window.firebase.apps.length ||
          typeof window.firebase.firestore !== 'function') {
        throw new Error('Firebase não inicializado.');
      }
      collection = window.firebase.firestore().collection('eventosPublicos');
      collection.orderBy('date', 'desc').limit(200).onSnapshot(snapshot => {
        sharedEvents = snapshot.docs.map(fromDoc);
        setConnected(true);
        render();
        message('Agenda compartilhada · tempo real');
      }, error => {
        console.error('Falha ao ler agenda pública:', error);
        setConnected(false);
        render();
        message('Agenda indisponível. Confira a configuração do Firestore.', true);
      });
    } catch (error) {
      console.error('Erro ao conectar agenda pública:', error);
      setConnected(false);
      render();
      message('Agenda indisponível. Confira a configuração do Firebase.', true);
    }
  }

  connect();
})();
