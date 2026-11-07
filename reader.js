(function () {
  'use strict';
  const pageTitles = {
    today: 'Hoje',
    meetings: 'Reuniões',
    daily: 'Texto diário',
    family: 'Adoração em família',
    emergencies: 'Emergências'
  };

  let pendingMeetingScroll = null;
  const pages = [...document.querySelectorAll('[data-reader-page]')];
  const navItems = [...document.querySelectorAll('[data-reader-link]')];

  function navigate() {
    const requested = location.hash.slice(1);
    const page = Object.hasOwn(pageTitles, requested) ? requested : 'today';
    for (const item of pages) item.hidden = item.dataset.readerPage !== page;
    for (const link of navItems) {
      if (link.dataset.readerLink === page) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    document.querySelector('#page-title').textContent = pageTitles[page];
    document.title = pageTitles[page] + ' · Planejamento Espiritual';
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (page === 'meetings' && pendingMeetingScroll) {
      const targetSection = document.getElementById(pendingMeetingScroll);
      pendingMeetingScroll = null;
      if (targetSection) requestAnimationFrame(() => targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }

  function setText(selector, text) {
    const element = document.querySelector(selector);
    if (element) element.textContent = String(text ?? '');
  }

  function setVisible(selector, show) {
    const element = document.querySelector(selector);
    if (element) element.hidden = !show;
  }

  function asDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '';
    const date = new Date(value + 'T12:00:00Z');
    if (isNaN(date.valueOf())) return '';
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  }

  function officialUrl(value) {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'https:') return '';
      const host = parsed.hostname.toLowerCase();
      if (!['jw.org', 'wol.jw.org', 'jw-cdn.org'].some(domain => host === domain || host.endsWith('.' + domain))) return '';
      return parsed.href;
    } catch {
      return '';
    }
  }

  function setSource(selector, url) {
    const element = document.querySelector(selector);
    if (!element) return;
    const verified = officialUrl(url);
    element.hidden = !verified;
    if (verified) element.href = verified;
    else element.removeAttribute('href');
  }

  function setCover(selector, url, description) {
    const element = document.querySelector(selector);
    if (!element) return;
    const verified = officialUrl(url);
    element.hidden = !verified;
    if (verified) {
      element.src = verified;
      element.alt = description;
      element.loading = 'lazy';
    } else element.removeAttribute('src');
  }

  function studyImage(study) {
    // Use the article illustration; never replace it with the magazine cover.
    return study?.heroImageUrl || (Array.isArray(study?.images) ? study.images[0] : null) || null;
  }

  function studyTitle(title) {
    return String(title || '').replace(/^\d{1,2}\s+(?:a|[-–—])\s+\d{1,2}\s+de\s+[a-zÀ-ÿ]+\s+de\s+\d{4}\s+/i, '').trim();
  }

  function appendParagraphs(selector, content) {
    const container = document.querySelector(selector);
    if (!container) return;
    container.replaceChildren();
    const paragraphs = String(content || '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
    if (!paragraphs.length) {
      const placeholder = document.createElement('p');
      placeholder.textContent = 'Conteúdo indisponível no momento. Consulte a publicação oficial.';
      container.append(placeholder);
      return;
    }
    for (const text of paragraphs) {
      const isHeader = /^(Tesouros da Palavra de Deus|Faça seu melhor no ministério|Nossa vida cristã|Um salmo sobre|Como Jeová|Que tipo de proteção|Pergunta\s+\d|Comentários finais|Joias espirituais)/i.test(text) && text.length < 200;
      const element = document.createElement(isHeader ? 'h3' : 'p');
      element.textContent = text;
      container.append(element);
    }
  }

  function render(content) {
    const daily = content.daily || {};
    const meeting = content.meeting || {};
    const midweek = content.midweekStudy || {};
    const watchtower = content.watchtower || {};
    const family = content.familyWorship || {};

    setText('#today-date', asDate(daily.date));
    setText('#today-verse', daily.verse || 'Texto do dia indisponível.');
    setText('#today-reference', daily.reference);

    setText('#today-midweek-title', meeting.treasure || midweek.title || meeting.reading || 'Programação da reunião indisponível.');
    setText('#today-midweek-reading', meeting.reading || midweek.title || '');
    setText('#today-midweek-date', (midweek.weekOf || meeting.weekOf) ? 'Semana de ' + asDate(midweek.weekOf || meeting.weekOf) : '');
    setCover('#today-midweek-cover', studyImage(midweek), 'Ilustração do tema da reunião de meio de semana');

    setText('#today-watchtower-title', studyTitle(watchtower.title) || 'Estudo de A Sentinela');
    setText('#today-watchtower-date', watchtower.weekOf ? 'Semana de ' + asDate(watchtower.weekOf) : '');
    setCover('#today-watchtower-cover', studyImage(watchtower), 'Ilustração do estudo de A Sentinela');

    setText('#today-family-title', family.title || 'Adoração em família');
    setText('#today-family-date', family.weekOf ? 'Semana de ' + asDate(family.weekOf) : '');
    setCover('#today-family-cover', family.publicationImageUrl, 'Imagem da publicação da adoração em família');

    setText('#daily-date', asDate(daily.date));
    setText('#daily-verse', daily.verse || 'Texto do dia indisponível.');
    setText('#daily-reference', daily.reference);
    appendParagraphs('#daily-content', daily.content);
    setSource('#daily-original', daily.url);

    setText('#midweek-title', midweek.title || meeting.reading || 'Reunião de meio de semana');
    setText('#midweek-date', asDate(midweek.weekOf || meeting.weekOf));
    setCover('#midweek-cover', studyImage(midweek), 'Ilustração do tema da reunião de meio de semana');
    appendParagraphs('#midweek-content', midweek.content);
    setSource('#midweek-original', midweek.url);

    setText('#watchtower-title', studyTitle(watchtower.title) || 'Estudo de A Sentinela');
    setText('#watchtower-date', 'Semana de ' + (asDate(watchtower.weekOf) || 'data indisponível'));
    setText('#watchtower-theme', watchtower.theme);
    setText('#watchtower-objective', watchtower.objective ? 'Objetivo: ' + watchtower.objective : '');
    setVisible('#watchtower-objective', !!watchtower.objective);
    setCover('#watchtower-cover', studyImage(watchtower), 'Ilustração do estudo de A Sentinela');
    appendParagraphs('#watchtower-content', watchtower.content);
    setSource('#watchtower-original', watchtower.url);

    setText('#family-topic', family.topic || 'Tema da semana');
    setText('#family-title', family.title || 'Adoração em família');
    setText('#family-date', asDate(family.weekOf));
    setText('#family-prompt', family.prompt);
    setText('#family-reading', family.reading);
    setText('#family-do', family.doThis);
    setText('#family-avoid', family.avoidThis);
    setText('#family-action', family.action);
    setCover('#family-cover', family.publicationImageUrl, 'Imagem da publicação indicada para esta semana');
    const questions = document.querySelector('#family-questions');
    questions.replaceChildren();
    for (const question of Array.isArray(family.questions) ? family.questions : []) {
      const item = document.createElement('li');
      item.textContent = question;
      questions.append(item);
    }
    setVisible('#family-questions-wrap', questions.children.length > 0);
    setSource('#family-original', family.articleUrl);
    setText('#family-source-title', family.sourceTitle || 'Abrir publicação oficial');

    setText('#content-updated', content.updatedAt
      ? 'Conteúdo atualizado: ' + new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(content.updatedAt))
      : 'Data de atualização não informada.');
  }

  async function load() {
    const status = document.querySelector('#content-status');
    try {
      const response = await fetch('data/content.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (!data || typeof data !== 'object' || !data.daily) throw new Error('Dados incompletos');
      render(data);
      status.hidden = true;
    } catch (error) {
      status.textContent = 'Não foi possível carregar as leituras automáticas. Tente novamente com conexão ou consulte as fontes oficiais.';
      status.classList.add('error');
      console.warn('Falha ao carregar conteúdo:', error);
    }
  }

  document.querySelectorAll('[data-target-reading]').forEach(link => {
    link.addEventListener('click', () => {
      pendingMeetingScroll = link.dataset.targetReading;
      if (location.hash === '#meetings') navigate();
    });
  });
  document.querySelectorAll('[data-scroll-to]').forEach(button => {
    button.addEventListener('click', () => {
      document.getElementById(button.dataset.scrollTo)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  addEventListener('hashchange', navigate);
  navigate();
  load();

  // Eventos pessoais são o único recurso editável; preserva eventos já salvos na versão anterior.
  const eventKey = 'planejamento-espiritual-20-events';
  const eventDialog = document.querySelector('#event-dialog');
  const eventForm = document.querySelector('#event-form');
  const eventTypes = new Set(['Congresso', 'Assembleia', 'Visita', 'Outro']);

  function todayLocalDate() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date()).filter(item => item.type !== 'literal').map(item => [item.type, item.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    const date = new Date(value + 'T00:00:00Z');
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }

  function readEvents() {
    try {
      const saved = JSON.parse(localStorage.getItem(eventKey) || '[]');
      return Array.isArray(saved) ? saved.filter(event =>
        event && typeof event.title === 'string' && isValidDate(event.date)) : [];
    } catch { return []; }
  }

  function saveEvents(events) {
    try {
      localStorage.setItem(eventKey, JSON.stringify(events));
      renderEvents();
      return true;
    } catch {
      alert('Não foi possível salvar os eventos neste navegador.');
      return false;
    }
  }

  function daysToEvent(value) {
    return Math.round((Date.parse(value + 'T00:00:00Z') - Date.parse(todayLocalDate() + 'T00:00:00Z')) / 86400000);
  }

  function eventDescription(event) {
    const kind = eventTypes.has(event.type) ? event.type : (eventTypes.has(event.title) ? event.title : 'Evento');
    const detail = event.title === kind ? '' : event.title;
    return { kind, detail: detail || kind };
  }

  function renderEvents() {
    const currentEvents = readEvents();
    const ordered = currentEvents.map((event, index) => ({ event, index }))
      .sort((a, b) => a.event.date.localeCompare(b.event.date));
    const next = ordered.find(item => daysToEvent(item.event.date) >= 0);
    const empty = document.querySelector('#event-empty');
    const current = document.querySelector('#event-next');
    empty.hidden = Boolean(next);
    current.hidden = !next;
    if (next) {
      const details = eventDescription(next.event);
      setText('#event-next-type', details.kind);
      setText('#event-next-title', details.detail);
      const remaining = daysToEvent(next.event.date);
      const remainingText = remaining === 0 ? 'Hoje' : remaining === 1 ? 'Amanhã' : `Em ${remaining} dias`;
      setText('#event-next-date', `${asDate(next.event.date)} · ${remainingText}`);
      setText('#event-next-location', next.event.location || '');
      setVisible('#event-next-location', Boolean(next.event.location));
    }
    const wrapper = document.querySelector('#event-all');
    const list = document.querySelector('#event-list');
    wrapper.hidden = ordered.length === 0;
    list.replaceChildren();
    for (const { event, index } of ordered) {
      const details = eventDescription(event);
      const row = document.createElement('li');
      const info = document.createElement('span');
      const label = document.createElement('strong');
      label.textContent = details.detail;
      const date = document.createElement('small');
      date.textContent = asDate(event.date) + (daysToEvent(event.date) < 0 ? ' · encerrado' : '');
      info.append(label, date);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remover';
      remove.setAttribute('aria-label', 'Remover ' + details.detail + ' de ' + asDate(event.date));
      remove.addEventListener('click', () => {
        if (!confirm('Remover este evento da agenda?')) return;
        const saved = readEvents();
        saved.splice(index, 1);
        saveEvents(saved);
      });
      row.append(info, remove);
      list.append(row);
    }
  }

  document.querySelector('#event-open').addEventListener('click', () => {
    eventForm.reset();
    document.querySelector('#event-form-date').min = todayLocalDate();
    eventDialog.showModal();
  });
  document.querySelector('#event-cancel').addEventListener('click', () => eventDialog.close());
  eventForm.addEventListener('submit', event => {
    event.preventDefault();
    if (!eventForm.reportValidity()) return;
    const type = document.querySelector('#event-form-type').value;
    const title = document.querySelector('#event-form-title').value.trim() || type;
    const date = document.querySelector('#event-form-date').value;
    const location = document.querySelector('#event-form-location').value.trim();
    if (!eventTypes.has(type) || !isValidDate(date) || date < todayLocalDate()) {
      alert('Selecione um tipo e uma data válida a partir de hoje.');
      return;
    }
    const saved = readEvents();
    if (saved.some(item => item.title === title && item.date === date)) {
      alert('Este evento já está cadastrado para a mesma data.');
      return;
    }
    if (saveEvents([...saved, { type, title, date, location, special: true }])) eventDialog.close();
  });
  addEventListener('storage', event => {
    if (event.key === eventKey) renderEvents();
  });
  renderEvents();
})();
