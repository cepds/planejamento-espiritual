import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';

const contentFile = new URL('../data/content.json', import.meta.url);
const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const familyCatalog = [
  { topic: 'Casamento', title: 'Como ser feliz no casamento? — Mostre respeito', prompt: 'Conversem sobre uma maneira prática de mostrar respeito no casamento nesta semana.', articleUrl: 'https://www.jw.org/pt/ensinos-biblicos/familia/casamento-mostrar-respeito/', videoUrl: 'https://www.jw.org/pt/ensinos-biblicos/familia/casamento-mostrar-respeito/' },
  { topic: 'Família', title: 'Como desenvolver uma família espiritualmente forte', prompt: 'Identifiquem uma prioridade que pode fortalecer a espiritualidade da família.', articleUrl: 'https://www.jw.org/pt/biblioteca/revistas/w20010515/Como-desenvolver-uma-fam%C3%ADlia-espiritualmente-forte/', videoUrl: null, coverUrl: 'https://cms-imgp.jw-cdn.org/img/p/1011205/univ/art/1011205_univ_lsr_lg.jpg' },
  { topic: 'Fortalecimento espiritual', title: 'Famílias cristãs — “fiquem despertas”', prompt: 'Escolham uma ação simples para manter a família espiritualmente desperta.', articleUrl: 'https://www.jw.org/pt/biblioteca/revistas/w20110515/Fam%C3%ADlias-crist%C3%A3s-fiquem-despertas/', videoUrl: null, coverUrl: 'https://cfp2.jw-cdn.org/a/8abb908/1/ir/w_T_20110515_lg.jpg' },
  { topic: 'Amor', title: 'Um amor de verdade', prompt: 'Assistam juntos e conversem sobre como demonstrar amor nas atitudes diárias.', articleUrl: 'https://www.jw.org/pt/biblioteca/videos/amor-de-verdade/', videoUrl: 'https://www.jw.org/pt/biblioteca/videos/amor-de-verdade/' },
  { topic: 'Bondade', title: 'Bondade — Uma qualidade que mostramos em palavras e ações', prompt: 'Pensem em uma ação bondosa que cada pessoa da família pode fazer nesta semana.', articleUrl: 'https://www.jw.org/pt/biblioteca/revistas/sentinela-estudo-novembro-2018/fruto-do-espirito-bondade/', videoUrl: null, coverUrl: 'https://cfp2.jw-cdn.org/a/de4be04/1/ir/w_T_201811_lg.jpg' },
  { topic: 'Luto e perda', title: 'Como lidar com a morte de alguém que eu amo?', prompt: 'Conversem com sensibilidade sobre como oferecer consolo a quem está sofrendo uma perda.', articleUrl: 'https://www.jw.org/pt/ensinos-biblicos/jovens/perguntam/lidar-morte-alguem-que-amo/', videoUrl: 'https://www.jw.org/pt-pt/biblioteca/videos/torna-te-amigo-jeova/lidar-com-a-morte-de-alguem-que-amamos/' }
];
const familyStart = new Date(Date.UTC(2026, 7, 4));
const familyEnd = '2027-08-31';

async function fetchWithTimeout(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok) return response;

      const error = new Error(`Fonte oficial respondeu HTTP ${response.status}: ${url}`);
      const retryable = [408, 425, 429, 500, 502, 503, 504].includes(response.status);
      error.retryable = retryable;
      if (!retryable || attempt === 3) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if (error.retryable === false || attempt === 3) throw error;
    } finally {
      clearTimeout(timeout);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
  }
  throw lastError;
}

function decodeHtml(value) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&([a-z]+);/gi, (_, entity) => ({ aacute: 'á', agrave: 'à', atilde: 'ã', eacute: 'é', ecirc: 'ê', iacute: 'í', oacute: 'ó', ocirc: 'ô', otilde: 'õ', uacute: 'ú', ccedil: 'ç', ldquo: '“', rdquo: '”', mdash: '—' }[entity.toLowerCase()] || _))
    .replace(/\s+/g, ' ')
    .trim();
}

function rtfToText(value) {
  return value
    .replace(/\\u(-?\d+)\?/g, (_, code) => String.fromCodePoint(Number(code) < 0 ? Number(code) + 65536 : Number(code)))
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\'[0-9a-f]{2}/gi, '')
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function rtfToParagraphs(value) {
  return value
    .replace(/\{\\\*\\fldinst\s+\{HYPERLINK "[^"]+"\s*\}\}/g, '')
    .replace(/\\u(-?\d+)\?/g, (_, code) => String.fromCodePoint(Number(code) < 0 ? Number(code) + 65536 : Number(code)))
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\tab/g, ' ')
    .replace(/\\'[0-9a-f]{2}/gi, '')
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, '')
    .split(/\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

function normalizeReferences(value) {
  return value
    .replace(/ cap[ií]tulo (\d+) vers[ií]culos? (\d+) a (\d+)/gi, ' $1:$2-$3')
    .replace(/ cap[ií]tulo (\d+) vers[ií]culos? (\d+), (\d+)/gi, ' $1:$2, $3')
    .replace(/ cap[ií]tulo (\d+) vers[ií]culo (\d+)/gi, ' $1:$2');
}

function extractStudyPoints(rtf, treasure) {
  const paragraphs = rtf.split(/\\par/).map(rtfToText).map((item) => item.replace(/^d(?=[A-ZÀ-Ú0-9“])/, '')).filter(Boolean);
  const start = paragraphs.findIndex((item) => item.includes(`1. ${treasure}`));
  if (start < 0) return [];
  const candidates = paragraphs.slice(start + 1).filter((item) => !item.includes('[Texto') && !item.includes('[Imagem') && !item.includes('[Fim')).filter((item) => !/^d?2\. /.test(item));
  return candidates.filter((item) => item.length > 35 && item.length < 260).slice(0, 3);
}

function mondayOf(date) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const shift = (value.getUTCDay() + 6) % 7;
  value.setUTCDate(value.getUTCDate() - shift);
  return value;
}

function wolMeetingUrl(date) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const year = value.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((value - yearStart) / 86400000) + 1) / 7);
  return `https://wol.jw.org/pt/wol/meetings/r5/lp-t/${year}/${week}`;
}

function dateInSaoPaulo(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function midweekTargetDate(date) {
  const monday = mondayOf(date);
  if (date.getUTCDay() === 0 || date.getUTCDay() >= 5) monday.setUTCDate(monday.getUTCDate() + 7);
  return monday;
}

function dailyHeadingPattern(date) {
  const weekday = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][date.getUTCDay()];
  return new RegExp(`${weekday}, ${date.getUTCDate()}(?:\\.º)? de ${months[date.getUTCMonth()]}`);
}

async function getDaily(date) {
  const year = date.getUTCFullYear();
  const mediaUrl = `https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?pub=es${String(year).slice(-2)}&langwritten=T&output=json`;
  const media = await (await fetchWithTimeout(mediaUrl)).json();
  const monthFile = media.files?.T?.RTF?.find((file) => file.track === date.getUTCMonth() + 1 && file.hasTrack);
  if (!monthFile?.file?.url) throw new Error(`Texto diário de ${months[date.getUTCMonth()]} não encontrado no JW.org.`);
  const rtf = await (await fetchWithTimeout(monthFile.file.url)).text();
  const text = rtfToParagraphs(rtf);
  const headingPattern = dailyHeadingPattern(date);
  const heading = text.match(headingPattern);
  if (heading?.index === undefined) throw new Error(`Texto diário de ${date.toISOString().slice(0, 10)} não localizado no arquivo oficial.`);
  const remaining = text.slice(heading.index + heading[0].length).trim();
  const nextHeading = remaining.match(/\n\n(?:Domingo|Segunda-feira|Terça-feira|Quarta-feira|Quinta-feira|Sexta-feira|Sábado), \d{1,2}(?:\.º)? de /)?.index;
  const section = normalizeReferences((nextHeading === undefined ? remaining : remaining.slice(0, nextHeading)).trim());
  const paragraphs = section.split(/\n\n+/).filter(Boolean);
  const devotional = paragraphs.shift() || '';
  const separator = devotional.lastIndexOf(' — ');
  const verse = separator > 0 ? devotional.slice(0, separator).trim() : devotional;
  const reference = separator > 0 ? devotional.slice(separator + 3).trim() : '';
  const content = paragraphs.join('\n\n');
  if (!verse || !reference || !content) throw new Error('Texto diário retornou formato inesperado no arquivo oficial.');
  return {
    date: date.toISOString().slice(0, 10), verse, reference, content,
    url: `https://wol.jw.org/pt/wol/h/r5/lp-t/${year}/${date.getUTCMonth() + 1}/${date.getUTCDate()}`
  };
}

function tuesdayOf(date) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const shift = (value.getUTCDay() - 2 + 7) % 7;
  value.setUTCDate(value.getUTCDate() - shift);
  return value;
}

function familyWorshipFor(date) {
  const tuesday = tuesdayOf(date);
  const weeks = Math.max(0, Math.floor((tuesday - familyStart) / (7 * 24 * 60 * 60 * 1000)));
  const item = familyCatalog[weeks % familyCatalog.length];
  return { ...item, weekOf: tuesday.toISOString().slice(0, 10), sequence: weeks + 1, scheduleThrough: familyEnd };
}

function familyUpcomingFor(date, count = 5) {
  const current = tuesdayOf(date);
  return Array.from({ length: count }, (_, index) => {
    const next = new Date(current);
    next.setUTCDate(next.getUTCDate() + (index * 7));
    return familyWorshipFor(next);
  });
}

async function getOpenGraphImage(url) {
  const response = await fetchWithTimeout(url);
  const html = await response.text();
  const tags = html.match(/<meta\s+[^>]*>/gi) || [];
  const tag = tags.find((value) => /(?:property|name)=["']og:image["']/i.test(value));
  return tag?.match(/content=["']([^"']+)["']/i)?.[1] || null;
}

async function addFamilyVisuals(item) {
  const publicationImageUrl = item.coverUrl || await getOpenGraphImage(item.articleUrl).catch(() => null);
  const videoImageUrl = !item.videoUrl ? null : item.videoUrl === item.articleUrl
    ? publicationImageUrl
    : await getOpenGraphImage(item.videoUrl).catch(() => null);
  return { ...item, publicationImageUrl, videoImageUrl };
}

function issueCode(date, offset = 0) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
  return `${value.getUTCFullYear()}${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
}

function studyRange(title) {
  const match = decodeHtml(title).toLowerCase().match(/^(\d{1,2})(?: de ([a-zç]+))? a (\d{1,2}) de ([a-zç]+) de (\d{4})/i);
  if (!match) return null;
  const [, startDay, explicitStartMonth, endDay, endMonthName, endYearText] = match;
  const endMonth = months.indexOf(endMonthName);
  const startMonth = months.indexOf(explicitStartMonth || endMonthName);
  if (startMonth < 0 || endMonth < 0) return null;
  const endYear = Number(endYearText);
  const startYear = startMonth > endMonth ? endYear - 1 : endYear;
  return {
    start: new Date(Date.UTC(startYear, startMonth, Number(startDay))),
    end: new Date(Date.UTC(endYear, endMonth, Number(endDay)))
  };
}

function rangeIncludes(title, date) {
  const range = studyRange(title);
  return Boolean(range && date >= range.start && date <= range.end);
}

function workbookProgramOnly(completeText, title) {
  const paragraphs = completeText.split(/\n\n+/).filter(Boolean);
  const titleIndex = paragraphs.findIndex((paragraph) => paragraph === title);
  const body = titleIndex >= 0 ? paragraphs.slice(titleIndex + 1) : paragraphs;
  const itemIndexes = body
    .map((paragraph, index) => (/^(\d+)\.\s.*\(\d+\s+min\)/i.test(paragraph) ? index : -1))
    .filter((index) => index >= 0);
  const isProgramLabel = (paragraph) => /^(?:Cântico\b|Comentários (?:iniciais|finais)\b|Tesouros da Palavra de Deus$|Faça seu melhor no ministério$|Nossa vida cristã$)/i.test(paragraph);
  const result = [title, ...body.slice(0, itemIndexes[0]).filter(isProgramLabel)];

  function conciseTreasures(segment) {
    const visible = [];
    let chunk = [];
    for (const paragraph of segment) {
      if (/^\[Fim da matéria de referência\.\]$/i.test(paragraph)) {
        const marker = chunk.findIndex((item) => /^\[(?:Texto|Imagem)/i.test(item));
        visible.push(...(marker >= 0 ? chunk.slice(0, marker) : chunk.slice(0, 1)));
        chunk = [];
      } else {
        chunk.push(paragraph);
      }
    }
    const marker = chunk.findIndex((item) => /^\[(?:Texto|Imagem)/i.test(item));
    visible.push(...(marker >= 0 ? chunk.slice(0, marker) : chunk));
    return visible.filter((paragraph) => !/^\[/.test(paragraph));
  }

  itemIndexes.forEach((itemIndex, position) => {
    const heading = body[itemIndex];
    const itemNumber = Number(heading.match(/^(\d+)\./)?.[1]);
    const nextIndex = itemIndexes[position + 1] ?? body.length;
    const between = body.slice(itemIndex + 1, nextIndex);
    const labelIndex = between.findIndex(isProgramLabel);
    const details = labelIndex >= 0 ? between.slice(0, labelIndex) : between;
    const labels = labelIndex >= 0 ? between.slice(labelIndex).filter(isProgramLabel) : [];
    result.push(heading);
    if (itemNumber <= 2) result.push(...conciseTreasures(details));
    else {
      const firstDetail = details.find((paragraph) => !/^\[/.test(paragraph));
      if (firstDetail) result.push(firstDetail);
    }
    result.push(...labels);
  });

  return result.filter(Boolean).join('\n\n');
}

function zipEntries(buffer) {
  const minimumEocdOffset = Math.max(0, buffer.length - 65_557);
  let eocdOffset = buffer.length - 22;
  while (eocdOffset >= minimumEocdOffset && buffer.readUInt32LE(eocdOffset) !== 0x06054b50) eocdOffset -= 1;
  if (eocdOffset < minimumEocdOffset) throw new Error('Arquivo JWPUB invalido.');

  const entries = [];
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);
  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Diretorio JWPUB invalido.');
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    entries.push({
      name: buffer.toString('utf8', offset + 46, offset + 46 + nameLength),
      compression: buffer.readUInt16LE(offset + 10),
      compressedSize: buffer.readUInt32LE(offset + 20),
      localOffset: buffer.readUInt32LE(offset + 42),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function unzipEntry(buffer, entryName) {
  const entry = zipEntries(buffer).find(({ name }) => name === entryName);
  if (!entry) throw new Error(`Arquivo ${entryName} nao encontrado no JWPUB.`);
  const nameLength = buffer.readUInt16LE(entry.localOffset + 26);
  const extraLength = buffer.readUInt16LE(entry.localOffset + 28);
  const dataStart = entry.localOffset + 30 + nameLength + extraLength;
  const data = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.compression === 0) return data;
  if (entry.compression === 8) return inflateRawSync(data);
  throw new Error(`Compactacao JWPUB nao suportada: ${entry.compression}.`);
}

async function workbookContentImages(media, track) {
  const jwpubUrl = media.files?.T?.JWPUB?.[0]?.file?.url;
  if (!jwpubUrl) return [];
  const jwpub = Buffer.from(await (await fetchWithTimeout(jwpubUrl)).arrayBuffer());
  const contents = unzipEntry(jwpub, 'contents');
  const documentIds = [...new Set(zipEntries(contents)
    .map(({ name }) => name.match(/^(\d+)_univ_cnt_1\.jpg$/)?.[1])
    .filter(Boolean))].sort();
  const documentId = documentIds[track];
  if (!documentId) return [];
  return zipEntries(contents)
    .map(({ name }) => name)
    .filter((name) => new RegExp(`^${documentId}_univ_cnt_\\d+\\.jpg$`).test(name))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    .map((name) => `https://cms-imgp.jw-cdn.org/img/p/${documentId}/univ/art/${name.replace(/\.jpg$/, '_xl.jpg')}`);
}

async function getMeeting(date) {
  const monday = mondayOf(date);
  const startMonth = monday.getUTCMonth();
  const issueMonth = startMonth % 2 === 0 ? startMonth + 1 : startMonth;
  const issue = `${monday.getUTCFullYear()}${String(issueMonth).padStart(2, '0')}`;
  const mediaUrl = `https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?pub=mwb&issue=${issue}&langwritten=T&output=json`;
  const media = await (await fetchWithTimeout(mediaUrl)).json();
  const weeklyFiles = media.files?.T?.RTF?.filter((file) => file.hasTrack) || [];
  const prefix = `${monday.getUTCDate()} `;
  const current = weeklyFiles.find((file) => decodeHtml(file.title).toLowerCase().startsWith(prefix) && decodeHtml(file.title).toLowerCase().includes(`de ${months[startMonth]}`));
  if (!current) throw new Error('Apostila semanal não encontrada.');
  const title = decodeHtml(current.title);
  const reading = title.match(/\(([^)]+)\)/)?.[1]?.replace(/\s+a\s+/g, '–') || title;
  const rtf = await (await fetchWithTimeout(current.file.url)).text();
  const text = rtfToText(rtf);
  const completeText = normalizeReferences(rtfToParagraphs(rtf));
  const treasure = text.match(/1\.\s+(.+?)\s*\(10 min\)/i)?.[1] || 'Tesouros da Palavra de Deus';
  const points = extractStudyPoints(rtf, treasure);
  const content = workbookProgramOnly(completeText, title);
  const image = current.trackImage?.url || null;
  const contentImages = await workbookContentImages(media, current.track);
  const meeting = {
    weekOf: monday.toISOString().slice(0, 10), reading, treasure, points,
    sourceUrl: current.file.url, coverUrl: media.pubImage?.url || image
  };
  const midweekStudy = {
    weekOf: meeting.weekOf, title: reading.toUpperCase(), content,
    images: contentImages.length ? contentImages : (image ? [image] : []), coverUrl: meeting.coverUrl, url: wolMeetingUrl(monday)
  };
  return { meeting, midweekStudy };
}

async function getWatchtowerStudy(date) {
  const monday = mondayOf(date);
  const mediaResults = await Promise.allSettled(Array.from({ length: 7 }, (_, offset) => {
    const issue = issueCode(monday, -offset);
    const url = `https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?pub=w&issue=${issue}&langwritten=T&output=json`;
    return fetchWithTimeout(url).then((response) => response.json()).then((media) => ({ issue, media }));
  }));
  let selected;
  for (const result of mediaResults) {
    if (result.status !== 'fulfilled') continue;
    const file = result.value.media.files?.T?.RTF?.find((item) => item.hasTrack && rangeIncludes(item.title, monday));
    if (file) { selected = { ...result.value, file }; break; }
  }
  if (!selected) throw new Error(`Estudo de A Sentinela da semana de ${monday.toISOString().slice(0, 10)} não encontrado no JW.org.`);
  const fullTitle = decodeHtml(selected.file.title);
  const title = fullTitle.includes(':') ? fullTitle.split(':').slice(1).join(':').trim() : fullTitle;
  const rtf = await (await fetchWithTimeout(selected.file.file.url)).text();
  const paragraphs = normalizeReferences(rtfToParagraphs(rtf)).split(/\n\n+/);
  const titleIndex = paragraphs.findIndex((paragraph) => paragraph === fullTitle);
  const body = titleIndex >= 0 ? paragraphs.slice(titleIndex + 1) : paragraphs;
  const theme = body.find((paragraph) => paragraph.includes(' — ') && !/^Cântico/i.test(paragraph)) || '';
  const objectiveIndex = body.findIndex((paragraph) => /objetivo/i.test(paragraph));
  const objective = objectiveIndex >= 0 ? (body[objectiveIndex + 1] || '').replace(/\s*\[Fim do quadro\.\]\s*/i, '').trim() : '';
  const contentStart = body.findIndex((paragraph) => /\[Fim do quadro\.\]/i.test(paragraph));
  const content = body.slice(contentStart >= 0 ? contentStart + 1 : 0).join('\n\n');
  const image = selected.file.trackImage?.url || null;
  const issueYear = selected.issue.slice(0, 4);
  const issueMonth = months[Number(selected.issue.slice(4, 6)) - 1];
  const url = `https://www.jw.org/pt/biblioteca/revistas/sentinela-estudo-${issueMonth}-${issueYear}/`;
  if (!title || !theme || !objective || !content) throw new Error('Estudo de A Sentinela retornou formato inesperado no arquivo oficial.');
  return {
    weekOf: monday.toISOString().slice(0, 10), title, theme, objective, content,
    images: image ? [image] : [], coverUrl: selected.media.pubImage?.url || image, url
  };
}

if (process.env.SKIP_UPDATE_MAIN !== '1') {
const requestedDate = process.env.CONTENT_DATE;
const now = requestedDate ? new Date(`${requestedDate}T00:00:00Z`) : dateInSaoPaulo();
if (Number.isNaN(now.getTime())) throw new Error(`Data de validação inválida: ${requestedDate}.`);
const previous = JSON.parse(await readFile(contentFile, 'utf8'));
const meetingTarget = midweekTargetDate(now);
const watchtowerTarget = mondayOf(now);
const [daily, meetingBundle, watchtower] = await Promise.all([
  getDaily(now), getMeeting(meetingTarget), getWatchtowerStudy(watchtowerTarget)
]);
const { meeting, midweekStudy } = meetingBundle;
const expectedDaily = now.toISOString().slice(0, 10);
const expectedMeeting = meetingTarget.toISOString().slice(0, 10);
const expectedWatchtower = watchtowerTarget.toISOString().slice(0, 10);
if (daily.date !== expectedDaily) throw new Error(`Texto diário desatualizado: esperado ${expectedDaily}, recebido ${daily.date}.`);
if (meeting.weekOf !== expectedMeeting || midweekStudy.weekOf !== expectedMeeting) throw new Error(`Apostila desatualizada: esperada semana ${expectedMeeting}.`);
if (watchtower.weekOf !== expectedWatchtower) throw new Error(`A Sentinela desatualizada: esperada semana ${expectedWatchtower}.`);
const covers = { workbook: midweekStudy.coverUrl || meeting.coverUrl, watchtower: watchtower.coverUrl };
const familyUpcoming = await Promise.all(familyUpcomingFor(now).map(addFamilyVisuals));
const familyWorship = familyUpcoming[0];
const content = {
  updatedAt: new Date().toISOString(), timezone: 'America/Sao_Paulo',
  updateRules: { daily: 'todos os dias', midweek: 'toda sexta-feira para a próxima semana', watchtower: 'toda segunda-feira', familyWorship: 'toda terça-feira' },
  daily, meeting, midweekStudy, watchtower, covers, familyWorship, familyUpcoming,
  previousUpdatedAt: previous.updatedAt || null, errors: []
};
await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(contentFile, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
console.log(`Conteúdo validado: texto ${daily.date}; apostila ${meeting.weekOf}; Sentinela ${watchtower.weekOf}.`);
}

export { dailyHeadingPattern, dateInSaoPaulo, midweekTargetDate, mondayOf, tuesdayOf };
