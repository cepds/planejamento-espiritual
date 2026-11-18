import assert from 'node:assert/strict';
import test from 'node:test';
import { extractLifeVideoDiscussions, videoTitleFromInstruction, isVideoInstruction } from './midweek-videos.mjs';

const weekly = [
  '16 a 22 de novembro (Lamentações 1 a 2)',
  'Faça seu melhor no ministério',
  '5. Cultivando o interesse (4 min)',
  'Use um vídeo do Kit de Ensino e ofereça um estudo bíblico.',
  'Nossa vida cristã',
  'Cântico 90',
  '7. Não se esqueça de nossos irmãos e irmãs inativos (15 min)',
  'Consideração.',
  'Mostre o VÍDEO Ajudar os Inativos. Depois, pergunte:',
  'Que lições você aprendeu com esse vídeo?',
  '8. Estudo bíblico de congregação (30 min)',
  'wcg capítulo17',
  'Comentários finais (3 min)'
].join('\n\n');

test('identifica vídeo oficial e pergunta somente em Nossa Vida Cristã', () => {
  const result = extractLifeVideoDiscussions(weekly, 'https://wol.jw.org/pt/wol/meetings/r5/lp-t/2026/47');
  assert.equal(result.length, 1);
  assert.equal(result[0].partNumber, 7);
  assert.equal(result[0].videoTitle, 'Ajudar os Inativos');
  assert.deepEqual(result[0].questions, ['Que lições você aprendeu com esse vídeo?']);
  assert.equal(result[0].videoUrl, 'https://www.jw.org/open?lank=pub-jwbai_201511_1_VIDEO&wtlocale=T');
});

test('vídeo da pregação não é tratado como parte da Nossa Vida Cristã', () => {
  assert.equal(extractLifeVideoDiscussions('Faça seu melhor no ministério\n\nUse um vídeo', null).length, 0);
});

test('múltiplos vídeos e perguntas ficam associados à parte correta', () => {
  const text = [
    'Nossa vida cristã',
    '6. Um tema (12 min)',
    'Mostre o VÍDEO Uma apresentação. Depois, pergunte:',
    'O que você aprendeu?',
    'Que conselho vale a pena aplicar?',
    'Mostre o VÍDEO Outro exemplo. Depois, pergunte:',
    'Como usar esta lição?',
    '7. Estudo bíblico de congregação (30 min)',
    'wcg capítulo20',
    'Comentários finais (3 min)'
  ].join('\n\n');
  const result = extractLifeVideoDiscussions(text, 'https://wol.jw.org/pt/wol/meetings/r5/lp-t/2026/49');
  assert.equal(result.length, 2);
  assert.equal(result[0].partNumber, 6);
  assert.equal(result[1].partNumber, 6);
  assert.deepEqual(result[0].questions, ['O que você aprendeu?', 'Que conselho vale a pena aplicar?']);
  assert.deepEqual(result[1].questions, ['Como usar esta lição?']);
  assert.equal(result[1].videoUrl, null);
  assert.match(result[1].sourceUrl, /wol.jw.org/);
});

test('não inventa vídeos nem perguntas quando a programação não os menciona', () => {
  const text = 'Nossa vida cristã\n\n7. Uma consideração (15 min)\n\nConsideração.\n\n8. Estudo bíblico de congregação (30 min)';
  assert.deepEqual(extractLifeVideoDiscussions(text, null), []);
  assert.equal(isVideoInstruction('Use um vídeo do Kit de Ensino.'), false);
  assert.equal(videoTitleFromInstruction('Mostre o VÍDEO Ajudar os Inativos. Depois, pergunte:'), 'Ajudar os Inativos');
});
