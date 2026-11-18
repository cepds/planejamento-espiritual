// Informações breves de vídeos e perguntas na programação semanal oficial.
// Apenas URLs conhecidas e verificadas são usadas como links diretos.
const verifiedVideoLinks = new Map([
  ['ajudar os inativos', 'https://www.jw.org/open?lank=pub-jwbai_201511_1_VIDEO&wtlocale=T']
]);

function normalizeVideoTitle(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

function isVideoInstruction(text) {
  return /(?:mostre|assista|veja|reproduza)\s+(?:(?:ao|a|o)\s+)?v[ií]deo\b/i.test(text);
}

function videoTitleFromInstruction(text) {
  const title = String(text).match(/(?:mostre|assista|veja|reproduza)\s+(?:(?:ao|a|o)\s+)?v[ií]deo\s*[:—–-]?\s*(.*?)(?=(?:\.\s*(?:depois|em seguida|a seguir)\b)|(?:\.\s*$)|(?:\]\s*$)|$)/i)?.[1]?.trim() || '';
  return title.replace(/^\[/, '').replace(/\]$/, '').replace(/[.]+$/, '').trim();
}

function isDiscussionQuestion(text) {
  const item = String(text || '').trim();
  if (!item.includes('?') || item.length > 320) return false;
  if (/^(?:sua resposta|\[|fim da matéria)/i.test(item)) return false;
  return true;
}

function extractLifeVideoDiscussions(fullText, sourceUrl) {
  const paragraphs = String(fullText || '').split(/\n\s*\n/).map(item => item.trim()).filter(Boolean);
  const sectionIndex = paragraphs.findIndex(item => /^Nossa vida cristã$/i.test(item));
  if (sectionIndex < 0) return [];
  const discussions = [];
  let number = null;
  let partTitle = '';
  let current = null;
  let afterSection = false;
  for (const paragraph of paragraphs.slice(sectionIndex + 1)) {
    if (/^(?:Comentários finais|Cântico\s+\d+ e oração|Tesouros da Palavra de Deus|Faça seu melhor no ministério)$/i.test(paragraph)) break;
    const part = paragraph.match(/^(\d{1,2})\.\s+(.+?)\s*\((\d+)\s+min\)$/i);
    if (part) {
      number = Number(part[1]);
      partTitle = part[2];
      current = null;
      afterSection = true;
      continue;
    }
    if (!afterSection || number === null || /^\[(?:Imagem|Texto|Fim)/i.test(paragraph)) continue;
    if (isVideoInstruction(paragraph)) {
      let title = videoTitleFromInstruction(paragraph);
      if (!title || /^(?:depois|em seguida|a seguir)\b/i.test(title)) title = '';
      current = {
        partNumber: number,
        partTitle,
        videoTitle: title,
        videoUrl: verifiedVideoLinks.get(normalizeVideoTitle(title)) || null,
        sourceUrl: sourceUrl || null,
        questions: []
      };
      discussions.push(current);
    } else if (current && isDiscussionQuestion(paragraph)) {
      const question = paragraph.replace(/^\s*[•\uE000-\uF8FF]\s*/u, '').replace(/\s+Sua resposta\s*$/i, '').trim();
      if (question && !current.questions.includes(question)) current.questions.push(question);
    }
  }
  return discussions.slice(0, 12);
}

export { extractLifeVideoDiscussions, videoTitleFromInstruction, isVideoInstruction };
