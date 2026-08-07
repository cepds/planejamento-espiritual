const eventKey = 'planejamento-espiritual-20-events';
const pages = document.querySelectorAll('.page');
const navigation = document.querySelectorAll('[data-page]');
const pageTitle = document.querySelector('#page-title');
const eventList = document.querySelector('#events');
const clearEvents = document.querySelector('#clear-events');

const pageNames = { panel: 'Painel', meetings: 'Reuni&otilde;es', daily: 'Texto di&aacute;rio', family: 'Adora&ccedil;&atilde;o em fam&iacute;lia' };
let defaultEvents = [
  { title: 'Reuni\u00e3o de meio de semana', meta: 'Esta semana' },
  { title: 'A Sentinela', meta: 'Fim de semana' }
];

function getEvents() {
  try {
    const events = JSON.parse(localStorage.getItem(eventKey)) || [];
    return events.map((event) => ({
      ...event,
      title: decodeLegacyText(event.title),
      meta: decodeLegacyText(event.meta)
    }));
  } catch { return []; }
}

function decodeLegacyText(value) {
  let decoded = String(value || '');
  decoded = decoded.replace(/&(?:amp;)*atilde;/gi, '\u00e3').replace(/&(?:amp;)*otilde;/gi, '\u00f5').replace(/&(?:amp;)*ccedil;/gi, '\u00e7');
  for (let pass = 0; pass < 3 && /&(?:amp;)?#?\w+;/i.test(decoded); pass += 1) {
    const decoder = document.createElement('textarea');
    decoder.innerHTML = decoded;
    if (decoder.value === decoded) break;
    decoded = decoder.value;
  }
  return decoded;
}

function setPage(page, shouldScroll = true) {
  pages.forEach((item) => item.classList.toggle('is-active', item.id === page));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('is-active', item.dataset.page === page));
  pageTitle.innerHTML = pageNames[page];
  document.querySelector('#add-event').hidden = page !== 'panel';
  window.location.hash = page;
  if (shouldScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
}

function formatFamilyWeek(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(new Date(year, month - 1, day));
}

function parseEventDate(value) {
  const match = String(value || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match.map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    : null;
}

function specialEventDetails(event) {
  if (!event.special || !event.date) return null;
  const target = new Date(`${event.date}T00:00:00`);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysUntil = Math.round((target - today) / 86400000);
  if (daysUntil < 0 || daysUntil > 30) return null;
  const date = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(target);
  return { daysUntil, meta: daysUntil === 0 ? `${date} · é hoje` : `${date} · faltam ${daysUntil} dias` };
}

function renderEvents() {
  const savedEvents = getEvents();
  const visibleSavedEvents = savedEvents.map((event, savedIndex) => ({ event, savedIndex, special: specialEventDetails(event) }))
    .filter(({ event, special }) => !event.special || special);
  const events = [...defaultEvents.map((event) => ({ event, savedIndex: null, special: null })), ...visibleSavedEvents];
  eventList.replaceChildren();
  events.forEach(({ event, savedIndex, special }) => {
    const row = document.createElement('div'); row.className = `event-row${special ? ' is-special' : ''}`;
    const dot = document.createElement('span'); dot.className = 'event-dot';
    const copy = document.createElement('div');
    const title = document.createElement('p'); title.className = 'event-title'; title.textContent = decodeLegacyText(event.title);
    const meta = document.createElement('p'); meta.className = 'event-meta'; meta.textContent = special?.meta || decodeLegacyText(event.meta);
    copy.append(title, meta); row.append(dot, copy);
    if (savedIndex !== null) { const remove = document.createElement('button'); remove.className = 'event-remove'; remove.type = 'button'; remove.textContent = 'Remover'; remove.addEventListener('click', () => removeEvent(savedIndex)); row.append(remove); }
    eventList.append(row);
  });
  clearEvents.hidden = !savedEvents.length;
}

function removeEvent(index) { const events = getEvents(); events.splice(index, 1); localStorage.setItem(eventKey, JSON.stringify(events)); renderEvents(); }
document.querySelector('#add-event').addEventListener('click', () => {
  const types = { '1': 'Congresso', '2': 'Assembleia', '3': 'Visita', congresso: 'Congresso', assembleia: 'Assembleia', visita: 'Visita' };
  const selected = prompt('Evento especial:\n1 — Congresso\n2 — Assembleia\n3 — Visita\n\nDigite o número ou o nome do evento.');
  if (selected === null) return;
  const title = types[selected.trim().toLowerCase()];
  if (!title) { alert('Escolha Congresso, Assembleia ou Visita.'); return; }
  const date = parseEventDate(prompt(`Data do ${title} (dd/mm/aaaa):`));
  if (!date) { alert('Informe uma data válida no formato dd/mm/aaaa.'); return; }
  const events = getEvents();
  events.push({ title, meta: 'Evento especial', date, special: true });
  localStorage.setItem(eventKey, JSON.stringify(events)); renderEvents();
});
clearEvents.addEventListener('click', () => { localStorage.removeItem(eventKey); renderEvents(); });
navigation.forEach((item) => item.addEventListener('click', () => setPage(item.dataset.page)));
const initialPage = window.location.hash.slice(1);
if (Object.hasOwn(pageNames, initialPage)) setPage(initialPage, false);
document.querySelector('#today').textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
renderEvents();

async function loadOfficialContent() {
  try {
    const response = await fetch(`data/content.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Conteúdo indisponível.');
    const content = await response.json();
    if (content.daily?.verse && content.daily?.reference) {
      document.querySelector('#panel-daily-verse').textContent = `“${content.daily.verse}”`;
      document.querySelector('#panel-daily-reference').textContent = content.daily.reference;
      document.querySelector('#daily-page-verse').textContent = `“${content.daily.verse}”`;
      document.querySelector('#daily-page-reference').textContent = content.daily.reference;
      document.querySelector('#daily-link').addEventListener('click', () => window.open(content.daily.url, '_blank', 'noopener'));
    }
    if (content.meeting?.reading) {
      document.querySelector('#meeting-reading').textContent = content.meeting.reading;
      document.querySelector('#meeting-treasure').textContent = content.meeting.treasure;
      if (content.meeting.points?.length) {
        const points = document.querySelector('#meeting-points');
        points.replaceChildren(...content.meeting.points.map((point) => { const item = document.createElement('li'); item.textContent = point; return item; }));
      }
      defaultEvents = [{ title: 'Reunião de meio de semana', meta: content.meeting.reading }, ...defaultEvents.slice(1)];
      if (!getEvents().length) renderEvents();
      document.querySelector('#midweek-reading').textContent = content.meeting.reading;
      document.querySelector('#midweek-treasure').textContent = content.meeting.treasure;
      const focusPoints = document.querySelector('#midweek-points');
      focusPoints.replaceChildren(...(content.meeting.points || []).slice(0, 3).map((point) => { const item = document.createElement('li'); item.textContent = point; return item; }));
    }
    if (content.covers?.workbook) {
      const cover = document.querySelector('#workbook-cover');
      cover.src = content.covers.workbook;
      cover.hidden = false;
      const meetingCover = document.querySelector('#meeting-workbook-cover');
      meetingCover.src = content.covers.workbook;
      meetingCover.hidden = false;
      const midweekCover = document.querySelector('#midweek-cover');
      midweekCover.src = content.covers.workbook;
      midweekCover.hidden = false;
    }
    if (content.covers?.watchtower) {
      const cover = document.querySelector('#watchtower-cover');
      cover.src = content.covers.watchtower;
      cover.hidden = false;
      const meetingCover = document.querySelector('#meeting-watchtower-cover');
      meetingCover.src = content.covers.watchtower;
      meetingCover.hidden = false;
    }
    if (content.familyWorship?.title) {
      const family = content.familyWorship;
      document.querySelector('#panel-family-topic').textContent = family.topic;
      document.querySelector('#panel-family-title').textContent = family.title;
      document.querySelector('#panel-family-prompt').textContent = family.prompt;
      const panelCover = document.querySelector('#panel-family-cover');
      panelCover.hidden = !family.publicationImageUrl;
      if (family.publicationImageUrl) panelCover.src = family.publicationImageUrl;
      document.querySelector('#family-topic').textContent = family.topic;
      document.querySelector('#family-title').textContent = family.title;
      document.querySelector('#family-prompt').textContent = family.prompt;
      const article = document.querySelector('#family-article');
      article.href = family.articleUrl;
      const video = document.querySelector('#family-video');
      video.hidden = !family.videoUrl;
      if (family.videoUrl) video.href = family.videoUrl;
      const publicationMedia = document.querySelector('#family-publication-media');
      publicationMedia.hidden = !family.publicationImageUrl;
      publicationMedia.href = family.articleUrl;
      if (family.publicationImageUrl) document.querySelector('#family-publication-image').src = family.publicationImageUrl;
      const videoMedia = document.querySelector('#family-video-media');
      videoMedia.hidden = !family.videoImageUrl || family.videoImageUrl === family.publicationImageUrl;
      videoMedia.href = family.videoUrl || '#';
      if (family.videoImageUrl) document.querySelector('#family-video-image').src = family.videoImageUrl;
    }
    if (content.familyUpcoming?.length) {
      const upcoming = document.querySelector('#family-upcoming');
      upcoming.replaceChildren(...content.familyUpcoming.map((item, index) => {
        const row = document.createElement('div'); row.className = 'family-upcoming-row';
        const date = document.createElement('span'); date.className = 'family-upcoming-date';
        date.textContent = index === 0 ? 'Esta semana' : formatFamilyWeek(item.weekOf);
        const copy = document.createElement('div');
        const topic = document.createElement('p'); topic.className = 'family-upcoming-topic'; topic.textContent = item.topic;
        const title = document.createElement('p'); title.className = 'family-upcoming-title'; title.textContent = item.title;
        copy.append(topic, title); row.append(date, copy);
        return row;
      }));
    }
    const day = new Date().getDay();
    const showWeekend = day === 0 || day === 5 || day === 6;
    document.querySelector('#midweek-focus').hidden = showWeekend;
    document.querySelector('#weekend-focus').hidden = !showWeekend;
  } catch (error) { console.warn('Conteúdo oficial não pôde ser atualizado.', error); }
}

loadOfficialContent();
