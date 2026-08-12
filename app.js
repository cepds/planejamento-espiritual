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
  const countdown = daysUntil === 0 ? 'é hoje' : daysUntil === 1 ? 'falta 1 dia' : `faltam ${daysUntil} dias`;
  return { daysUntil, meta: `${date} · ${countdown}` };
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

const midweekSections = {
  'tesouros da palavra de deus': { key: 'treasures', title: 'TESOUROS DA PALAVRA DE DEUS' },
  'faca seu melhor no ministerio': { key: 'ministry', title: 'FA\u00c7A SEU MELHOR NO MINIST\u00c9RIO' },
  'nossa vida crista': { key: 'christian-life', title: 'NOSSA VIDA CRIST\u00c3' }
};

const midweekIcons = {
  treasures: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 8 7 3.5h10L20.5 8 12 20.5 3.5 8Z"/><path d="m3.5 8 8.5 12.5L20.5 8M7 3.5 9.5 8 12 3.5 14.5 8 17 3.5M3.5 8h17"/></svg>',
  ministry: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V7M12 11c-3.2 0-5.5-1.8-5.5-4.5C9.7 6.5 12 8.3 12 11Zm0 4c3.2 0 5.5-1.8 5.5-4.5-3.2 0-5.5 1.8-5.5 4.5Zm0 4c-3.2 0-5.5-1.8-5.5-4.5 3.2 0 5.5 1.8 5.5 4.5Z"/></svg>',
  'christian-life': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm7.6 1.2a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4ZM2.8 20v-2.1c0-3 2.4-5.4 5.4-5.4s5.4 2.4 5.4 5.4V20H2.8Zm10.8 0v-1.6c0-1.7-.6-3.2-1.7-4.4 1.1-.5 2.4-.6 3.9-.3 3 .6 4.8 2.5 4.8 5.2V20h-7Z"/></svg>'
};

function midweekLabelKey(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function parseMidweekProgram(content) {
  const paragraphs = String(content || '').split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const program = { date: paragraphs.shift() || '', opening: [], sections: [] };
  let section = null;
  let part = null;

  paragraphs.forEach((paragraph) => {
    const sectionDefinition = midweekSections[midweekLabelKey(paragraph)];
    if (sectionDefinition) {
      section = { ...sectionDefinition, entries: [] };
      program.sections.push(section);
      part = null;
      return;
    }

    const partMatch = paragraph.match(/^(\d+)\.\s+(.+?)\s+\((\d+\s+min)\)$/i);
    if (partMatch && section) {
      part = { type: 'part', number: Number(partMatch[1]), title: partMatch[2], duration: partMatch[3], details: [] };
      section.entries.push(part);
      return;
    }

    const label = midweekLabelKey(paragraph);
    if (/^(?:cantico\b|comentarios finais\b)/i.test(label) && section) {
      section.entries.push({ type: 'transition', text: paragraph });
      part = null;
      return;
    }

    if (part) part.details.push(paragraph);
    else if (section) section.entries.push({ type: 'transition', text: paragraph });
    else program.opening.push(paragraph);
  });

  return program;
}

function programIcon(type) {
  const icon = document.createElement('span');
  icon.className = 'program-section-icon';
  icon.innerHTML = midweekIcons[type];
  return icon;
}

function programTransition(text) {
  const row = document.createElement('div');
  row.className = 'program-transition';
  const icon = document.createElement('span');
  icon.className = 'program-transition-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = midweekLabelKey(text).startsWith('cantico') ? '\u266b' : '\u2022';
  const copy = document.createElement('span'); copy.textContent = text;
  row.append(icon, copy);
  return row;
}

function renderMidweekProgram(content, imageSources = []) {
  let target = document.querySelector('#meeting-midweek-program');
  if (!target) {
    target = document.createElement('div');
    target.id = 'meeting-midweek-program';
    target.className = 'meeting-program';
    target.setAttribute('aria-live', 'polite');
    document.querySelector('#meeting-midweek-link').before(target);
  }
  const program = parseMidweekProgram(content);
  target.replaceChildren();

  const intro = document.createElement('header'); intro.className = 'program-intro';
  const date = document.createElement('p'); date.className = 'program-date';
  date.textContent = program.date.replace(/\s*\([^)]+\)\s*$/, '');
  const opening = document.createElement('div'); opening.className = 'program-opening';
  opening.append(...program.opening.map(programTransition));
  intro.append(date, opening); target.append(intro);

  program.sections.forEach((section) => {
    const sectionElement = document.createElement('section');
    sectionElement.className = `program-section program-section--${section.key}`;
    const heading = document.createElement('header'); heading.className = 'program-section-heading';
    const title = document.createElement('h4'); title.textContent = section.title;
    heading.append(programIcon(section.key), title); sectionElement.append(heading);

    const body = document.createElement('div'); body.className = 'program-section-body';
    section.entries.forEach((entry) => {
      if (entry.type === 'transition') { body.append(programTransition(entry.text)); return; }
      const article = document.createElement('article'); article.className = 'program-part';
      const partHeading = document.createElement('div'); partHeading.className = 'program-part-heading';
      const number = document.createElement('span'); number.className = 'program-part-number'; number.textContent = entry.number;
      const partCopy = document.createElement('div'); partCopy.className = 'program-part-copy';
      const partTitle = document.createElement('h5'); partTitle.textContent = entry.title;
      const duration = document.createElement('span'); duration.className = 'program-part-duration'; duration.textContent = entry.duration;
      partCopy.append(partTitle, duration); partHeading.append(number, partCopy); article.append(partHeading);

      if (entry.details.length) {
        const details = document.createElement(entry.number === 1 ? 'ul' : 'div');
        details.className = entry.number === 1 ? 'program-part-points' : 'program-part-details';
        entry.details.forEach((detail) => {
          const item = document.createElement(entry.number === 1 ? 'li' : 'p'); item.textContent = detail; details.append(item);
        });
        article.append(details);
      }

      if (entry.number === 1 && imageSources.length) {
        const gallery = document.createElement('div'); gallery.className = 'program-part-media';
        imageSources.forEach((source) => {
          const image = document.createElement('img'); image.src = source; image.alt = `Imagem da parte ${entry.number}: ${entry.title}`; gallery.append(image);
        });
        article.append(gallery);
      }
      body.append(article);
    });
    sectionElement.append(body); target.append(sectionElement);
  });
}

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
      if (content.daily.content) document.querySelector('#daily-page-content').textContent = content.daily.content;
    }
      if (content.meeting?.reading) {
      document.querySelector('#meeting-reading').textContent = content.meeting.reading;
      const meetingTreasure = document.querySelector('#meeting-treasure');
      if (meetingTreasure) meetingTreasure.textContent = content.meeting.treasure;
      if (content.meeting.points?.length) {
        const points = document.querySelector('#meeting-points');
        if (points) points.replaceChildren(...content.meeting.points.map((point) => { const item = document.createElement('li'); item.textContent = point; return item; }));
      }
      defaultEvents = [{ title: 'Reunião de meio de semana', meta: content.meeting.reading }, ...defaultEvents.slice(1)];
      if (!getEvents().length) renderEvents();
      document.querySelector('#midweek-reading').textContent = content.meeting.reading;
      document.querySelector('#midweek-treasure').textContent = content.meeting.treasure;
      const focusPoints = document.querySelector('#midweek-points');
        focusPoints.replaceChildren(...(content.meeting.points || []).slice(0, 3).map((point) => { const item = document.createElement('li'); item.textContent = point; return item; }));
      }
      if (content.midweekStudy?.content) {
        const midweekStudy = content.midweekStudy;
        document.querySelector('#meeting-reading').textContent = midweekStudy.title;
        renderMidweekProgram(midweekStudy.content, midweekStudy.images || []);
        document.querySelector('#meeting-midweek-link').href = midweekStudy.url;
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
    if (content.watchtower?.title) {
      const watchtower = content.watchtower;
      document.querySelector('#panel-watchtower-title').textContent = watchtower.title;
      document.querySelector('#panel-watchtower-theme').textContent = watchtower.theme;
      document.querySelector('#panel-watchtower-objective').textContent = watchtower.objective;
      document.querySelector('#meeting-watchtower-title').textContent = watchtower.title;
      document.querySelector('#meeting-watchtower-theme').textContent = watchtower.theme;
      document.querySelector('#meeting-watchtower-objective').textContent = watchtower.objective;
      document.querySelector('#meeting-watchtower-content').textContent = watchtower.content;
      document.querySelector('#meeting-watchtower-link').href = watchtower.url;
      const cover = document.querySelector('#meeting-watchtower-cover');
      cover.src = watchtower.coverUrl;
      cover.hidden = false;
      const images = document.querySelector('#meeting-watchtower-images');
      images.replaceChildren(...(watchtower.images || []).map((src) => { const image = document.createElement('img'); image.src = src; image.alt = `Imagem do estudo: ${watchtower.title}`; return image; }));
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
      const hasSeparateVideo = Boolean(family.videoUrl && family.videoUrl !== family.articleUrl);
      video.hidden = !hasSeparateVideo;
      if (hasSeparateVideo) video.href = family.videoUrl;
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
      upcoming.replaceChildren(...content.familyUpcoming.slice(1).map((item) => {
        const row = document.createElement('div'); row.className = 'family-upcoming-row';
        const date = document.createElement('span'); date.className = 'family-upcoming-date';
        date.textContent = formatFamilyWeek(item.weekOf);
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
    document.querySelector('#meeting-midweek-card').hidden = showWeekend;
    document.querySelector('#meeting-weekend-card').hidden = !showWeekend;
  } catch (error) { console.warn('Conteúdo oficial não pôde ser atualizado.', error); }
}

loadOfficialContent();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((error) => console.warn('Modo app indisponível.', error)));
}
