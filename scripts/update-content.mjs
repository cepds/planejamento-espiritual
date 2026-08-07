import { mkdir, readFile, writeFile } from 'node:fs/promises';

const contentFile = new URL('../data/content.json', import.meta.url);
const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const familyCatalog = [
  { topic: 'Casamento', title: 'Como ser feliz no casamento? — Mostre respeito', prompt: 'Conversem sobre uma maneira prática de mostrar respeito no casamento nesta semana.', articleUrl: 'https://www.jw.org/pt/ensinos-biblicos/familia/casamento-mostrar-respeito/', videoUrl: 'https://www.jw.org/pt/ensinos-biblicos/familia/casamento-mostrar-respeito/' },
  { topic: 'Família', title: 'Como desenvolver uma família espiritualmente forte', prompt: 'Identifiquem uma prioridade que pode fortalecer a espiritualidade da família.', articleUrl: 'https://www.jw.org/pt/biblioteca/revistas/w20010515/Como-desenvolver-uma-fam%C3%ADlia-espiritualmente-forte/', videoUrl: null },
  { topic: 'Fortalecimento espiritual', title: 'Famílias cristãs — “fiquem despertas”', prompt: 'Escolham uma ação simples para manter a família espiritualmente desperta.', articleUrl: 'https://www.jw.org/pt/biblioteca/revistas/w20110515/Fam%C3%ADlias-crist%C3%A3s-fiquem-despertas/', videoUrl: null },
  { topic: 'Amor', title: 'Um amor de verdade', prompt: 'Assistam juntos e conversem sobre como demonstrar amor nas atitudes diárias.', articleUrl: 'https://www.jw.org/pt/biblioteca/videos/amor-de-verdade/', videoUrl: 'https://www.jw.org/pt/biblioteca/videos/amor-de-verdade/' },
  { topic: 'Bondade', title: 'Bondade — Uma qualidade que mostramos em palavras e ações', prompt: 'Pensem em uma ação bondosa que cada pessoa da família pode fazer nesta semana.', articleUrl: 'https://www.jw.org/pt/biblioteca/revistas/sentinela-estudo-novembro-2018/fruto-do-espirito-bondade/', videoUrl: null },
  { topic: 'Luto e perda', title: 'Como lidar com a morte de alguém que eu amo?', prompt: 'Conversem com sensibilidade sobre como oferecer consolo a quem está sofrendo uma perda.', articleUrl: 'https://www.jw.org/pt/ensinos-biblicos/jovens/perguntam/lidar-morte-alguem-que-amo/', videoUrl: 'https://www.jw.org/pt-pt/biblioteca/videos/torna-te-amigo-jeova/lidar-com-a-morte-de-alguem-que-amamos/' }
];
const familyStart = new Date(Date.UTC(2026, 7, 4));
const familyEnd = '2027-08-31';

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try { return await fetch(url, { signal: controller.signal }); }
  finally { clearTimeout(timeout); }
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

async function getDaily(date) {
  const response = await fetchWithTimeout(`https://wol.jw.org/wol/dt/r5/lp-t/${date.getUTCFullYear()}/${date.getUTCMonth() + 1}/${date.getUTCDate()}`);
  if (!response.ok) throw new Error(`Texto diário indisponível: ${response.status}`);
  const item = (await response.json()).items?.[0];
  const sourceMatch = item?.content?.match(/class="themeScrp"[^>]*>([\s\S]*?)<\/p>/i);
  const referenceMatch = item?.content?.match(/<a[^>]*class="b"[^>]*>([\s\S]*?)<\/a>/i);
  const verse = decodeHtml(sourceMatch?.[1] || '');
  const reference = decodeHtml(referenceMatch?.[1] || '');
  if (!verse || !reference) throw new Error('Texto diário retornou formato inesperado.');
  return { date: date.toISOString().slice(0, 10), verse, reference, url: `https://wol.jw.org${item.url}` };
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

function familyUpcomingFor(date, count = 4) {
  const current = tuesdayOf(date);
  return Array.from({ length: count }, (_, index) => {
    const next = new Date(current);
    next.setUTCDate(next.getUTCDate() + (index * 7));
    return familyWorshipFor(next);
  });
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
  const treasure = text.match(/1\.\s+(.+?)\s*\(10 min\)/i)?.[1] || 'Tesouros da Palavra de Deus';
  const points = extractStudyPoints(rtf, treasure);
  return { weekOf: monday.toISOString().slice(0, 10), reading, treasure, points, sourceUrl: current.file.url, coverUrl: media.pubImage?.url || null };
}

async function getWatchtowerCover(date) {
  const issue = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  const url = `https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?pub=w&issue=${issue}&langwritten=T&output=json`;
  const media = await (await fetchWithTimeout(url)).json();
  if (!media.pubImage?.url) throw new Error('Capa da Sentinela não encontrada.');
  return media.pubImage.url;
}

const now = new Date();
const previous = JSON.parse(await readFile(contentFile, 'utf8'));
const results = await Promise.allSettled([getDaily(now), getMeeting(now), getWatchtowerCover(now)]);
const daily = results[0].status === 'fulfilled' ? results[0].value : previous.daily;
const meeting = results[1].status === 'fulfilled' ? results[1].value : previous.meeting;
if (!daily || !meeting) throw new Error('Não há conteúdo válido disponível para publicação.');
const errors = results.filter((result) => result.status === 'rejected').map((result) => result.reason.message);
const covers = { workbook: meeting.coverUrl || previous.covers?.workbook || null, watchtower: results[2].status === 'fulfilled' ? results[2].value : previous.covers?.watchtower || null };
const familyWorship = familyWorshipFor(now);
const content = { updatedAt: new Date().toISOString(), daily, meeting, covers, familyWorship, familyUpcoming: familyUpcomingFor(now), previousUpdatedAt: previous.updatedAt || null, errors };
await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(contentFile, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
console.log(`Conteúdo atualizado: ${daily.date}; semana de ${meeting.weekOf}.`);
