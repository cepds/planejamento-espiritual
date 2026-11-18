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
  function imageOf(item) {
    if (item.type === 'Celebração' && references.memorial) return references.memorial.image;
    if (item.type === 'Assembleia' && item.programId === 'CA-brpgm27' && references.assembly) {
      return safeHttpsUrl(item.imageUrl) || references.assembly.image;
    }
    return safeHttpsUrl(item.imageUrl);
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
    return items.filter(item => validDate(item.date) && until(item.date) >= 0)
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
    return days === 0 ? 'É hoje' : days === 1 ? 'Falta 1 dia' : 'Faltam '+days+' dias';
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
    document.getElementById('agenda-hero-days').textContent=left===null?'—':left===0?'HOJE':String(left);
    document.getElementById('agenda-hero-days-label').textContent=left===null?'sem eventos':left===0?'é hoje':'dias restantes';
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
      row.append(badge,info,dashboardActions(item));
      list.append(row);
    }
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
      dateEnd: validDate(item.dateEnd) ? item.dateEnd : '',
      theme: typeof item.theme === 'string' ? item.theme.slice(0, 140) : '',
      scripture: typeof item.scripture === 'string' ? item.scripture.slice(0, 100) : '',
      imageUrl: safeHttpsUrl(item.imageUrl),
      sourceUrl: safeHttpsUrl(item.sourceUrl),
      programId: item.programId === 'CA-brpgm27' ? item.programId : '',
      programText: typeof item.programText === 'string' ? item.programText.slice(0, 8000) : '',
      talks: cleanTalks(item.talks),
      time: /^([01]\\d|2[0-3]):[0-5]\\d$/.test(item.time || '') ? item.time : '',
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
    const next = ordered.find(item => until(item.date) >= 0);
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
    document.getElementById('event-days').textContent=days===null?'—':days===0?'HOJE':String(days);
    document.getElementById('event-days-label').textContent=days===0?'é hoje':'dias restantes';
    renderDashboard(upcomingEvents(ordered));
    if (next) {
      document.getElementById('event-next-type').textContent = next.type;
      document.getElementById('event-next-title').textContent = titleOf(next);
      const remaining = until(next.date);
      const distance = remaining === 0 ? 'Hoje' : remaining === 1 ? 'Amanhã' : 'Em ' + remaining + ' dias';
      document.getElementById('event-next-date').textContent = dateLabel(next.date) + ' · ' + distance;
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
      row.append(info, actions);
      list.append(row);
    }

    const unsent = legacyEvents().filter(local =>
      !ordered.some(remote => remote.title === local.title && remote.date === local.date));
    importButton.hidden = !connected || unsent.length === 0;
    importButton.textContent = 'Publicar ' + unsent.length + ' evento(s) antigo(s)';
  }

  function openDialog(item = null) {
    if (!connected || !collection) return;
    form.reset();
    editingId = item ? item.id : null;
    document.getElementById('event-dialog-title').textContent =
      item ? 'Editar evento' : 'Adicionar evento';
    submit.textContent = item ? 'Salvar alterações' : 'Salvar evento';
    const inputDate = document.getElementById('event-form-date');
    inputDate.min = item && item.date < currentDate() ? '' : currentDate();
    if (item) {
      document.getElementById('event-form-type').value = item.type;
      document.getElementById('event-form-title').value = item.title;
      inputDate.value = item.date;
      document.getElementById('event-form-location').value = item.location;
    }
    dialog.showModal();
  }

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
    const title = document.getElementById('event-form-title').value.trim() || type;
    const date = document.getElementById('event-form-date').value;
    const location = document.getElementById('event-form-location').value.trim();
    if (!types.has(type) || !validDate(date) || (!editingId && date < currentDate())) {
      message('Selecione um tipo e uma data válida.', true);
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
    saving = true;
    submit.disabled = true;
    try {
      const payload = { type, title, date, location };
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
