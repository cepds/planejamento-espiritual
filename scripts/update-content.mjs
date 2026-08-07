import { mkdir, readFile, writeFile } from 'node:fs/promises';

const contentFile = new URL('../data/content.json', import.meta.url);
const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

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

function mondayOf(date) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const shift = (value.getUTCDay() + 6) % 7;
  value.setUTCDate(value.getUTCDate() - shift);
  return value;
}

async function getDaily(date) {
  const response = await fetch(`https://wol.jw.org/wol/dt/r5/lp-t/${date.getUTCFullYear()}/${date.getUTCMonth() + 1}/${date.getUTCDate()}`);
  if (!response.ok) throw new Error(`Texto diário indisponível: ${response.status}`);
  const item = (await response.json()).items?.[0];
  const sourceMatch = item?.content?.match(/class="themeScrp"[^>]*>([\s\S]*?)<\/p>/i);
  const referenceMatch = item?.content?.match(/<a[^>]*class="b"[^>]*>([\s\S]*?)<\/a>/i);
  const verse = decodeHtml(sourceMatch?.[1] || '');
  const reference = decodeHtml(referenceMatch?.[1] || '');
  if (!verse || !reference) throw new Error('Texto diário retornou formato inesperado.');
  return { date: date.toISOString().slice(0, 10), verse, reference, url: `https://wol.jw.org${item.url}` };
}

async function getMeeting(date) {
  const monday = mondayOf(date);
  const startMonth = monday.getUTCMonth();
  const issueMonth = startMonth % 2 === 0 ? startMonth + 1 : startMonth;
  const issue = `${monday.getUTCFullYear()}${String(issueMonth).padStart(2, '0')}`;
  const mediaUrl = `https://b.jw-cdn.org/apis/pub-media/GETPUBMEDIALINKS?pub=mwb&issue=${issue}&langwritten=T&output=json`;
  const media = await (await fetch(mediaUrl)).json();
  const weeklyFiles = media.files?.T?.RTF?.filter((file) => file.hasTrack) || [];
  const prefix = `${monday.getUTCDate()} `;
  const current = weeklyFiles.find((file) => decodeHtml(file.title).toLowerCase().startsWith(prefix) && decodeHtml(file.title).toLowerCase().includes(`de ${months[startMonth]}`));
  if (!current) throw new Error('Apostila semanal não encontrada.');
  const title = decodeHtml(current.title);
  const reading = title.match(/\(([^)]+)\)/)?.[1]?.replace(/\s+a\s+/g, '–') || title;
  const rtf = await (await fetch(current.file.url)).text();
  const text = rtfToText(rtf);
  const treasure = text.match(/1\.\s+(.+?)\s*\(10 min\)/i)?.[1] || 'Tesouros da Palavra de Deus';
  return { weekOf: monday.toISOString().slice(0, 10), reading, treasure, sourceUrl: current.file.url };
}

const now = new Date();
const previous = JSON.parse(await readFile(contentFile, 'utf8'));
const [daily, meeting] = await Promise.all([getDaily(now), getMeeting(now)]);
const content = { updatedAt: new Date().toISOString(), daily, meeting, previousUpdatedAt: previous.updatedAt || null };
await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(contentFile, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
console.log(`Conteúdo atualizado: ${daily.date}; semana de ${meeting.weekOf}.`);
