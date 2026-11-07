// Resolve as partes do Estudo Bíblico de Congregação nas publicações oficiais.
// Apenas o livro "wcg" possui mapeamento WOL conhecido; outros livros permanecem
// com a referência e o link da programação, sem inventar capítulos/endereços.
const WC_G_BOOK = 'Ande Corajosamente com Deus';
const WC_G_TOC = 'https://www.jw.org/pt/biblioteca/livros/ande-corajosamente-com-deus/';
const VERIFIED_WCG_CHAPTERS = {
  16: {
    title: '“Certamente irei com você”',
    url: 'https://www.jw.org/pt/biblioteca/livros/ande-corajosamente-com-deus/dos-patriarcas-ao-tempo-dos-juizes/baraque-e-debora-certamente-irei-com-voce/'
  },
  17: {
    title: '“A mais abençoada das mulheres”',
    url: 'https://wol.jw.org/pt/wol/d/r5/lp-t/1102025917'
  }
};

function parseCongregationReference(raw) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  const match = text.match(/\b([a-z]{2,8})\s+cap(?:[íi]tulos?|s)?\.?\s*(\d{1,3})(.*)$/i);
  if (!match) return null;
  const bookCode = match[1].toLowerCase();
  const first = Number(match[2]);
  if (!first || first > 999) return null;
  const chapters = [first];
  const tail = match[3];
  const continued = tail.match(/^\s*(?:-|–|—|a|e|,|&)\s*(\d{1,3})(?=\s|$|[.;)])/i);
  if (continued) {
    const second = Number(continued[1]);
    if (second && second !== first) {
      if (/^\s*(?:-|–|—|a)(?=\s*\d)/i.test(tail.trim()) && second > first) {
        // A range like "16–17" includes every chapter in the range.
        for (let n = first + 1; n <= second && chapters.length < 5; n++) chapters.push(n);
      } else chapters.push(second);
    }
  }
  return { bookCode, chapters, reference: text };
}

function decodeHtmlText(value) {
  return String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, digits) => String.fromCodePoint(Number(digits)))
    .replace(/&(?:nbsp|thinsp);/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&ldquo;/gi, '“').replace(/&rdquo;/gi, '”')
    .replace(/&lsquo;/gi, '‘').replace(/&rsquo;/gi, '’')
    .replace(/&mdash;/gi, '—').replace(/&ndash;/gi, '–')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractElementByClass(html, className) {
  const start = new RegExp('<(div|article|section)\\b[^>]*class=["\\x27][^"\\x27]*\\b' + className +
    '\\b[^"\\x27]*["\\x27][^>]*>', 'i').exec(html);
  if (!start) return '';
  const tag = start[1].toLowerCase();
  const pattern = new RegExp('<\\/?' + tag + '\\b[^>]*>', 'gi');
  pattern.lastIndex = start.index + start[0].length;
  let nesting = 1;
  let token;
  while ((token = pattern.exec(html))) {
    if (/^<\//.test(token[0])) nesting -= 1;
    else if (!/\/>$/.test(token[0])) nesting += 1;
    if (!nesting) return html.slice(start.index + start[0].length, token.index);
  }
  return '';
}

function extractWolChapter(html, bookCode, number, url) {
  const entire = decodeHtmlText(html);
  if (bookCode !== 'wcg' ||
      !new RegExp('\\bwcg\\s+cap\\.?\\s*' + number + '\\b', 'i').test(entire)) return null;
  const body = extractElementByClass(html, 'bodyTxt') ||
    extractElementByClass(html, 'document') ||
    extractElementByClass(html, 'article');
  if (!body) return null;
  const chapters = [];
  const blocks = /<(p|h[1-4]|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let block;
  let inQuestionSection = false;
  while ((block = blocks.exec(body))) {
    const content = decodeHtmlText(block[2]);
    if (!content || /^(?:Sua resposta|REPRODUZIR|Edição impressa|Compartilhar)$/i.test(content)) continue;
    if (content.length > 10000) continue;
    let kind;
    if (/^h/i.test(block[1])) {
      kind = 'heading';
      inQuestionSection = /^(?:Para considerar|Analise mais a fundo|Medite no que aprendeu|Pense no quadro completo)$/i.test(content);
    } else {
      const hasQuestion = /\?/.test(content) && content.length < 700;
      const questionFormat = block[1] === 'li' || /^\d{1,2}\.\s/.test(content);
      kind = hasQuestion && (questionFormat || inQuestionSection) ? 'question' : 'paragraph';
    }
    if (!chapters.length || chapters[chapters.length - 1].text !== content) {
      chapters.push({ kind, text: content });
    }
    if (chapters.length >= 180) break;
  }
  const title = decodeHtmlText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  if (chapters.length < 5 || !title || chapters.every(item => item.kind === 'heading')) return null;
  return { number, title, url, content: chapters };
}

async function loadCongregationStudy(raw, fallbackUrl, fetchPage = fetch) {
  const reference = parseCongregationReference(raw);
  if (!reference) return null;
  const supported = reference.bookCode === 'wcg';
  const collection = supported ? WC_G_BOOK : null;
  const chapters = [];
  for (const number of reference.chapters) {
    const known = supported ? VERIFIED_WCG_CHAPTERS[number] : null;
    const fallback = {
      number, title: known?.title || ('Capítulo ' + number),
      url: known?.url || (supported ? WC_G_TOC : fallbackUrl),
      content: []
    };
    if (supported && number >= 1 && number <= 54) {
      const wolUrl = 'https://wol.jw.org/pt/wol/d/r5/lp-t/' + (1102025900 + number);
      try {
        const response = await fetchPage(wolUrl, { signal: AbortSignal.timeout(17000) });
        if (response.ok) {
          const resolved = extractWolChapter(await response.text(), 'wcg', number, wolUrl);
          if (resolved) {
            chapters.push({
              ...resolved,
              url: known?.url || wolUrl
            });
            continue;
          }
        }
      } catch (error) {
        console.warn('Capítulo oficial não carregado:', number, error.message);
      }
    }
    chapters.push(fallback);
  }
  return {
    bookCode: reference.bookCode,
    reference: reference.reference,
    bookTitle: collection || ('Publicação ' + reference.bookCode),
    chapters,
    bookUrl: supported ? WC_G_TOC : fallbackUrl,
    sourceUrl: fallbackUrl
  };
}

export { parseCongregationReference, extractWolChapter, loadCongregationStudy };
