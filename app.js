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

function renderEvents() {
  const savedEvents = getEvents();
  const events = savedEvents.length ? savedEvents : defaultEvents;
  eventList.replaceChildren();
  events.forEach((event, index) => {
    const row = document.createElement('div'); row.className = 'event-row';
    const dot = document.createElement('span'); dot.className = 'event-dot';
    const copy = document.createElement('div');
    const title = document.createElement('p'); title.className = 'event-title'; title.textContent = decodeLegacyText(event.title);
    const meta = document.createElement('p'); meta.className = 'event-meta'; meta.textContent = decodeLegacyText(event.meta);
    copy.append(title, meta); row.append(dot, copy);
    if (savedEvents.length) { const remove = document.createElement('button'); remove.className = 'event-remove'; remove.type = 'button'; remove.textContent = 'Remover'; remove.addEventListener('click', () => removeEvent(index)); row.append(remove); }
    eventList.append(row);
  });
  clearEvents.hidden = !savedEvents.length;
}

function removeEvent(index) { const events = getEvents(); events.splice(index, 1); localStorage.setItem(eventKey, JSON.stringify(events)); renderEvents(); }
document.querySelector('#add-event').addEventListener('click', () => { const title = prompt('Nome do evento:'); if (!title || !title.trim()) return; const events = getEvents(); events.push({ title: title.trim(), meta: 'Evento pessoal' }); localStorage.setItem(eventKey, JSON.stringify(events)); renderEvents(); });
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
      defaultEvents = [{ title: 'Reunião de meio de semana', meta: content.meeting.reading }, ...defaultEvents.slice(1)];
      if (!getEvents().length) renderEvents();
    }
    if (content.covers?.workbook) {
      const cover = document.querySelector('#workbook-cover');
      cover.src = content.covers.workbook;
      cover.hidden = false;
      const meetingCover = document.querySelector('#meeting-workbook-cover');
      meetingCover.src = content.covers.workbook;
      meetingCover.hidden = false;
    }
    if (content.covers?.watchtower) {
      const cover = document.querySelector('#watchtower-cover');
      cover.src = content.covers.watchtower;
      cover.hidden = false;
      const meetingCover = document.querySelector('#meeting-watchtower-cover');
      meetingCover.src = content.covers.watchtower;
      meetingCover.hidden = false;
    }
  } catch (error) { console.warn('Conteúdo oficial não pôde ser atualizado.', error); }
}

loadOfficialContent();
