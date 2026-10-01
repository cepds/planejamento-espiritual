(() => {
  const state = window.StudyState;
  let content = window.officialContent || null;
  let meeting = 'midweek';
  let viewedWeek = null;
  let settings = { theme: 'light', size: 16 };
  let focus = false;
  const $ = (selector) => document.querySelector(selector);
  function read(key) {
    try { return state.read(localStorage, key); } catch { return {}; }
  }
  function write(key, changes) {
    try {
      state.patch(localStorage, key, changes);
      $('#personal-save-status').textContent = 'Salvo neste navegador.';
      return true;
    } catch {
      $('#personal-save-status').textContent = 'Não foi possível salvar. Mantenha esta página aberta e copie suas anotações.';
      return false;
    }
  }
  function currentWeek(kind = meeting) {
    return kind === 'midweek' ? content?.midweekStudy?.weekOf : content?.watchtower?.weekOf;
  }
  function itemsFor(kind) {
    if (!content) return [];
    if (kind === 'weekend') return [
      { id: 'read', title: 'Ler o estudo de A Sentinela' },
      { id: 'scriptures', title: 'Conferir os textos bíblicos' },
      { id: 'comment', title: 'Preparar um comentário' }
    ];
    const entries = parseMidweekProgram(content.midweekStudy.content).sections.flatMap((section) => section.entries).filter((entry) => entry.type === 'part');
    return entries.map((entry) => ({ id: `part-${entry.number}-${entry.title}`, title: `${entry.number}. ${entry.title}`, number: entry.number }));
  }
  function recordFor(kind, week = currentWeek(kind)) {
    return week ? read(state.meetingKey(kind, week)) : {};
  }
  function progressText(kind) {
    const p = state.progress(recordFor(kind), itemsFor(kind));
    return p.total ? `${p.done} de ${p.total} etapas preparadas` : 'Preparação disponível após carregar o conteúdo';
  }
  function renderToday() {
    $('#today-midweek-progress').textContent = progressText('midweek');
    $('#today-weekend-progress').textContent = progressText('weekend');
    const next = getEvents().filter((event) => specialEventDetails(event)).sort((a, b) => a.date.localeCompare(b.date))[0];
    $('#today-next-title').textContent = next?.title || 'Nenhum evento cadastrado';
    $('#today-next-date').textContent = next ? specialEventDetails(next).meta : 'Adicione congressos, assembleias e visitas à sua agenda.';
    const available = content?.daily?.date === saoPauloDate();
    const done = available && read(`daily:${content.daily.date}`).done === true;
    $('#today-verse').textContent = content?.daily?.verse ? `“${content.daily.verse}”` : 'Carregando a leitura…';
    $('#today-reference').textContent = content?.daily?.reference || '';
    $('#today-reading-label').textContent = available ? 'TEXTO DE HOJE' : content ? `TEXTO DE ${formatFamilyWeek(content.daily.date)}` : 'TEXTO DIÁRIO';
    document.querySelectorAll('[data-daily-done]').forEach((button) => {
      button.disabled = !available;
      button.textContent = done ? '✓ Leitura concluída — desfazer' : 'Concluir leitura';
      button.setAttribute('aria-pressed', String(Boolean(done)));
    });
    $('#today-family-title').textContent = content?.familyWorship?.title || 'Adoração em família';
    document.querySelectorAll('[data-open-prep]').forEach((button) => { button.disabled = !content; });
    $('#today-open-daily').disabled = !content;
  }
  function renderPreparation() {
    if (!content || !currentWeek()) return;
    const actualWeek = currentWeek();
    if (!viewedWeek) viewedWeek = actualWeek;
    let weeks = [];
    try { weeks = state.savedWeeks(localStorage, meeting); } catch {}
    weeks = [...new Set([actualWeek, ...weeks])].sort().reverse();
    const select = $('#prep-week');
    select.replaceChildren(...weeks.map((week) => {
      const option = document.createElement('option'); option.value = week;
      option.textContent = `Semana de ${formatFamilyWeek(week)}${week === actualWeek ? ' · conteúdo atual' : ''}`;
      return option;
    }));
    select.value = viewedWeek;
    const archived = viewedWeek !== actualWeek;
    const record = recordFor(meeting, viewedWeek);
    const items = archived ? (Array.isArray(record.items) ? record.items : []) : itemsFor(meeting);
    $('#prep-title').textContent = meeting === 'midweek' ? 'Meu preparo · Meio de semana' : 'Meu preparo · A Sentinela';
    $('#prep-archive-note').hidden = !archived;
    $('#prep-show-content').hidden = archived;
    const p = state.progress(record, items);
    $('#prep-progress').textContent = `${p.done} de ${p.total} etapas preparadas`;
    $('#prep-progress-bar').max = p.total || 1; $('#prep-progress-bar').value = p.done;
    const list = $('#prep-checklist'); list.replaceChildren();
    for (const item of items) {
      const row = document.createElement('label'); row.className = 'prep-task';
      const input = document.createElement('input'); input.type = 'checkbox'; input.checked = record.checked?.[item.id] === true;
      input.addEventListener('change', () => {
        const latest = recordFor(meeting, viewedWeek);
        if (!write(state.meetingKey(meeting, viewedWeek), { checked: { ...latest.checked, [item.id]: input.checked }, items })) {
          input.checked = !input.checked; return;
        }
        const p = state.progress(recordFor(meeting, viewedWeek), items);
        $('#prep-progress').textContent = `${p.done} de ${p.total} etapas preparadas`;
        $('#prep-progress-bar').value = p.done;
        renderToday();
      });
      const text = document.createElement('span'); text.textContent = item.title;
      row.append(input, text); list.append(row);
    }
    for (const [id, field] of [['prep-notes','notes'],['prep-scriptures','scriptures']]) {
      const input = $('#' + id);
      if (document.activeElement !== input) input.value = typeof record[field] === 'string' ? record[field] : '';
    }
    $('#meeting-preparation').hidden = false;
  }
  for (const [id, field] of [['prep-notes','notes'],['prep-scriptures','scriptures']]) {
    $('#' + id).addEventListener('input', (event) => {
      if (viewedWeek) write(state.meetingKey(meeting, viewedWeek), { [field]: event.target.value, items: viewedWeek === currentWeek() ? itemsFor(meeting) : recordFor(meeting, viewedWeek).items || [] });
    });
  }
  $('#prep-week').addEventListener('change', (event) => { viewedWeek = event.target.value; renderPreparation(); });
  $('#prep-show-content').addEventListener('click', () => {
    const card = $(meeting === 'midweek' ? '#meeting-midweek-card' : '#meeting-weekend-card');
    card.scrollIntoView({ behavior: 'auto', block: 'start' });
  });
  document.querySelectorAll('[data-open-prep]').forEach((button) => button.addEventListener('click', () => {
    setPage('meetings'); selectMeeting(button.dataset.openPrep);
    $('#meeting-preparation').scrollIntoView({ behavior: 'auto', block: 'start' });
  }));
  $('#today-open-daily').addEventListener('click', () => setPage('daily'));
  $('#today-add-event').addEventListener('click', () => $('#add-event').click());
  $('#today-family').addEventListener('click', () => setPage('family'));
  document.querySelectorAll('[data-daily-done]').forEach((button) => button.addEventListener('click', () => {
    if (content?.daily?.date !== saoPauloDate()) return;
    const key = `daily:${content.daily.date}`;
    if (write(key, { done: read(key).done !== true })) renderToday();
  }));
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  function applySettings() {
    const dark = settings.theme === 'dark' || (settings.theme === 'system' && systemTheme.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.fontSize = settings.size + 'px';
    $('#reading-theme').value = settings.theme;
    $('#reading-size').textContent = Math.round(settings.size / 16 * 100) + '%';
    $('#font-smaller').disabled = settings.size <= 16;
    $('#font-larger').disabled = settings.size >= 22;
    document.querySelector('meta[name="theme-color"]').content = dark ? '#111e18' : '#f6f7f2';
  }
  const saved = read('preferences');
  settings.theme = ['light','dark','system'].includes(saved.theme) ? saved.theme : 'light';
  settings.size = [16,18,20,22].includes(saved.size) ? saved.size : 16;
  function saveSettings() { write('preferences', settings); applySettings(); }
  $('#reading-theme').addEventListener('change', (event) => { settings.theme = event.target.value; saveSettings(); });
  $('#font-smaller').addEventListener('click', () => { settings.size = Math.max(16, settings.size - 2); saveSettings(); });
  $('#font-larger').addEventListener('click', () => { settings.size = Math.min(22, settings.size + 2); saveSettings(); });
  systemTheme.addEventListener('change', applySettings);
  function setFocus(value) {
    focus = value;
    document.documentElement.dataset.focus = String(focus);
    $('#reading-focus').textContent = focus ? 'Sair da leitura' : 'Modo de leitura';
    $('#reading-focus').setAttribute('aria-pressed', String(focus));
  }
  $('#reading-focus').addEventListener('click', () => {
    if (!focus && location.hash === '#panel') setPage('daily');
    setFocus(!focus);
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && focus) { setFocus(false); $('#reading-focus').focus(); } });
  window.addEventListener('page-changed', () => { if (focus) setFocus(false); renderToday(); });
  window.addEventListener('meeting-selected', (event) => { meeting = event.detail; viewedWeek = null; renderPreparation(); });
  window.addEventListener('events-changed', renderToday);
  window.addEventListener('official-content-ready', (event) => { content = event.detail; renderToday(); renderPreparation(); });
  window.addEventListener('storage', (event) => {
    if (event.key?.startsWith(state.prefix) || event.key === 'planejamento-espiritual-20-events') { renderToday(); renderPreparation(); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) renderToday(); });
  // Atualiza as tarefas se a página continuar aberta durante a mudança do dia.
  setInterval(renderToday, 60000);
  meeting = document.querySelector('[data-meeting][aria-pressed="true"]')?.dataset.meeting || 'midweek';
  applySettings(); renderToday(); renderPreparation();
})();
