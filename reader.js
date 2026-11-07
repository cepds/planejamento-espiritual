(function () {
  'use strict';
  const pageTitles = {
    today: 'Hoje',
    meetings: 'Reuniões',
    daily: 'Texto diário',
    family: 'Adoração em família',
    emergencies: 'Emergências'
  };

  const pages = [...document.querySelectorAll('[data-reader-page]')];
  const navItems = [...document.querySelectorAll('[data-reader-link]')];

  function selectMeeting(view) {
    const selection = view === 'weekend' ? 'weekend' : 'midweek';
    for (const panel of ['midweek', 'weekend']) {
      document.getElementById(panel).hidden = panel !== selection;
      const tab = document.querySelector('[data-meeting-tab="' + panel + '"]');
      tab.setAttribute('aria-selected', String(panel === selection));
      tab.tabIndex = panel === selection ? 0 : -1;
    }
  }

  function navigate() {
    const requested = location.hash.slice(1);
    const meetingsRoute = ['meetings', 'meetings-midweek', 'meetings-weekend'].includes(requested);
    const page = meetingsRoute ? 'meetings' : Object.hasOwn(pageTitles, requested) ? requested : 'today';
    for (const item of pages) item.hidden = item.dataset.readerPage !== page;
    for (const link of navItems) {
      if (link.dataset.readerLink === page) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (page === 'meetings') selectMeeting(requested === 'meetings-weekend' ? 'weekend' : 'midweek');
    if (page === 'meetings') {
      requestAnimationFrame(() => {
        if (document.querySelector('#weekend').hidden) resizeVisibleMidweekComments();
        else resizeVisibleWatchtowerComments();
      });
    }
    document.querySelector('#page-title').textContent = pageTitles[page];
    document.title = pageTitles[page] + ' · Planejamento Espiritual';
    window.scrollTo({ top: 0, behavior: 'instant' });
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

  const imageDialog = document.querySelector('#study-image-dialog');
  const fullImage = document.querySelector('#study-image-full');
  let activeImages = [];
  let activeIndex = 0;
  let previousImageTrigger = null;
  let activeStudyName = '';

  function imageList(study) {
    // Only official, distinct images from the study; never use magazine covers.
    const sources = [
      ...(Array.isArray(study?.images) ? study.images : []),
      study?.heroImageUrl
    ];
    return [...new Set(sources.map(officialUrl).filter(Boolean))];
  }

  function updateImageViewer() {
    if (!activeImages.length) return;
    fullImage.src = activeImages[activeIndex];
    fullImage.alt = 'Imagem ' + (activeIndex + 1) + ' de ' + activeImages.length +
      ' — ' + activeStudyName;
    document.querySelector('#study-image-title').textContent = activeStudyName;
    document.querySelector('#study-image-position').textContent =
      (activeIndex + 1) + ' de ' + activeImages.length;
    document.querySelector('#study-image-prev').disabled = activeImages.length <= 1;
    document.querySelector('#study-image-next').disabled = activeImages.length <= 1;
  }

  function openImageViewer(urls, index, name, trigger) {
    if (!urls.length) return;
    activeImages = urls;
    activeIndex = index;
    activeStudyName = name;
    previousImageTrigger = trigger;
    updateImageViewer();
    if (!imageDialog.open) imageDialog.showModal();
    document.querySelector('#study-image-close').focus();
  }

  function moveImage(step) {
    if (!activeImages.length) return;
    activeIndex = (activeIndex + step + activeImages.length) % activeImages.length;
    updateImageViewer();
  }

  function renderStudyGallery(group, study, name) {
    const container = document.querySelector('#' + group + '-images');
    const section = document.querySelector('#' + group + '-gallery');
    const urls = imageList(study);
    container.replaceChildren();
    section.hidden = urls.length === 0;
    document.querySelector('#' + group + '-image-count').textContent =
      urls.length === 1 ? '1 imagem' : urls.length + ' imagens';
    for (const [index, url] of urls.entries()) {
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'study-gallery-item';
      trigger.setAttribute('aria-label', 'Ampliar imagem ' + (index + 1) +
        ' de ' + urls.length + ' — ' + name);
      const picture = document.createElement('img');
      picture.src = url;
      picture.alt = 'Imagem ' + (index + 1) + ' — ' + name;
      picture.loading = 'lazy';
      picture.decoding = 'async';
      const marker = document.createElement('span');
      marker.className = 'study-gallery-number';
      marker.textContent = String(index + 1).padStart(2, '0');
      trigger.append(picture, marker);
      trigger.addEventListener('click', () => openImageViewer(urls, index, name, trigger));
      container.append(trigger);
    }
  }

  document.querySelector('#study-image-prev').addEventListener('click', () => moveImage(-1));
  document.querySelector('#study-image-next').addEventListener('click', () => moveImage(1));
  document.querySelector('#study-image-close').addEventListener('click', () => imageDialog.close());
  imageDialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveImage(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveImage(1);
    }
  });
  imageDialog.addEventListener('click', event => {
    if (event.target === imageDialog) imageDialog.close();
  });
  imageDialog.addEventListener('close', () => {
    fullImage.removeAttribute('src');
    previousImageTrigger?.focus();
    previousImageTrigger = null;
  });

  function studyRangeText(title, fallback) {
    const value = String(title || '');
    const range = value.match(/^(\d{1,2})\s+(?:a|[–—-])\s+(\d{1,2})\s+de\s+([a-zà-ÿ]+)\s+de\s+(\d{4})/i);
    return range ? range[1] + '–' + range[2] + ' de ' + range[3] + ' de ' + range[4]
      : fallback;
  }

  function midweekRangeText(study, fallback) {
    const first = studyParagraphs(study?.content)[0] || '';
    const match = first.match(/^(\d{1,2})\s+a\s+(\d{1,2})\s+de\s+([a-zà-ÿ]+)/i);
    const year = String(study?.weekOf || '').slice(0, 4);
    return match ? match[1] + '–' + match[2] + ' de ' + match[3] +
      (year ? ' de ' + year : '') : fallback;
  }

  function studyEl(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function studyParagraphs(value) {
    return String(value || '').split(/\n\s*\n/).map(text => text.trim()).filter(Boolean);
  }

  function studyIllustration(images, index, name, description, caption = '') {
    if (!images[index]) return null;
    const figure = studyEl('figure', 'study-inline-figure');
    const button = studyEl('button', 'study-inline-image');
    button.type = 'button';
    button.setAttribute('aria-label', 'Ampliar imagem ' + (index + 1) + ' de ' + images.length + ' de ' + name);
    const img = studyEl('img');
    img.src = images[index];
    img.alt = description || 'Ilustração ' + (index + 1) + ' do estudo';
    img.loading = 'lazy';
    img.decoding = 'async';
    button.append(img);
    button.addEventListener('click', () => openImageViewer(images, index, name, button));
    figure.append(button);
    if (caption) figure.append(studyEl('figcaption', '', caption));
    return figure;
  }

  // Comentários privados por estudo e parágrafo. Sem sincronização pública.
  const watchtowerCommentPrefix = 'planejamento-espiritual-watchtower-commentarios-v1:';
  let currentWatchtowerCommentKey = '';
  let currentWatchtowerComments = Object.create(null);

  function watchtowerCommentKey(study) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(study?.weekOf || ''))
      ? study.weekOf : 'sem-data';
    return watchtowerCommentPrefix + date + ':' + String(study?.title || 'sem-titulo').trim();
  }

  function loadWatchtowerComments(study) {
    currentWatchtowerCommentKey = watchtowerCommentKey(study);
    currentWatchtowerComments = Object.create(null);
    try {
      const saved = JSON.parse(localStorage.getItem(currentWatchtowerCommentKey) || '{}');
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        for (const [number, comment] of Object.entries(saved)) {
          if (/^\d{1,2}$/.test(number) && typeof comment === 'string') {
            currentWatchtowerComments[number] = comment;
          }
        }
      }
      setText('#watchtower-comment-status', 'Seus comentários ficam salvos apenas neste navegador.');
    } catch (error) {
      console.warn('Não foi possível ler os comentários locais:', error);
      setText('#watchtower-comment-status', 'Não foi possível carregar comentários salvos neste navegador.');
    }
  }

  function saveWatchtowerComment(number, value) {
    if (value.trim()) currentWatchtowerComments[number] = value;
    else delete currentWatchtowerComments[number];
    try {
      localStorage.setItem(currentWatchtowerCommentKey, JSON.stringify(currentWatchtowerComments));
      setText('#watchtower-comment-status', 'Comentários salvos neste navegador.');
    } catch (error) {
      console.warn('Não foi possível salvar o comentário:', error);
      setText('#watchtower-comment-status', 'Não foi possível salvar. Copie seu comentário antes de sair desta página.');
    }
  }

  function resizeWatchtowerComment(field) {
    // Deixe a caixa ocupar quantas linhas forem necessárias, sem barra de rolagem interna.
    if (!field.getClientRects().length) return;
    field.style.height = '0px';
    field.style.height = Math.max(76, field.scrollHeight) + 'px';
  }

  function createWatchtowerComment(number) {
    const wrapper = studyEl('div', 'study-comment-box');
    const label = studyEl('label', 'study-comment-label', 'Meu comentário · parágrafo ' + number);
    const field = studyEl('textarea', 'study-comment-input');
    const id = 'watchtower-comment-' + number;
    field.id = id;
    field.rows = 2;
    field.spellcheck = true;
    field.setAttribute('autocapitalize', 'sentences');
    field.setAttribute('aria-describedby', 'watchtower-comment-status');
    field.placeholder = 'Escreva seu comentário…';
    field.value = currentWatchtowerComments[number] || '';
    label.htmlFor = id;
    field.addEventListener('input', () => {
      resizeWatchtowerComment(field);
      saveWatchtowerComment(number, field.value);
    });
    wrapper.append(label, field);
    return wrapper;
  }

  function resizeVisibleWatchtowerComments() {
    document.querySelectorAll('#watchtower-content .study-comment-input').forEach(resizeWatchtowerComment);
  }

  function renderWatchtowerReading(study) {
    const container = document.querySelector('#watchtower-content');
    container.replaceChildren();
    loadWatchtowerComments(study);
    const paragraphs = studyParagraphs(study.content);
    const images = imageList(study);
    const articleName = 'Estudo de A Sentinela';
    if (images.length) {
      const hero = studyIllustration(images, 0, articleName, 'Ilustração de abertura do estudo');
      hero.classList.add('study-intro-figure');
      container.append(hero);
    }
    if (!paragraphs.length) {
      container.append(studyEl('p', 'study-empty', 'Texto indisponível. Consulte a publicação original.'));
      return;
    }
    let imageIndex = images.length ? 1 : 0;
    let review = null;
    let reviewList = null;
    for (let index = 0; index < paragraphs.length; index++) {
      const text = paragraphs[index];
      const question = text.match(/^Pergunta\s+(\d+(?:\s*(?:a|e|[-–])\s*\d+)?)\.\s*(.+)$/i);
      const numbered = text.match(/^(\d{1,2})\s+([\s\S]+)$/);
      if (/^\[Quadro\]\s*Como responderia\?/i.test(text)) {
        review = studyEl('section', 'study-review');
        review.append(studyEl('h3', '', 'Como responderia?'));
        reviewList = studyEl('ul', 'study-review-list');
        review.append(reviewList);
        container.append(review);
      } else if (review && /^[\uE000-\uF8FF•]\s*/u.test(text)) {
        const item = text.replace(/^[\uE000-\uF8FF•]\s*/u, '').replace(/\s*\[Fim do quadro\.\]\s*/gi, '').trim();
        if (item) reviewList.append(studyEl('li', '', item));
      } else if (question) {
        const card = studyEl('div', 'study-question');
        card.append(studyEl('span', 'study-question-number', question[1].replace(/\s+a\s+/i, '–')));
        card.append(studyEl('p', 'study-question-text', question[2]));
        container.append(card);
      } else if (/^\[Leitura do texto de\]/i.test(text)) {
        const scripture = studyEl('blockquote', 'study-scripture');
        const cleaned = text.replace(/^\[Leitura do texto de\]\s*/i, '');
        const separator = cleaned.indexOf(':');
        if (separator > 0) {
          scripture.append(studyEl('strong', '', cleaned.slice(0, separator)));
          scripture.append(studyEl('p', '', cleaned.slice(separator + 1).trim()));
        } else scripture.append(studyEl('p', '', cleaned));
        container.append(scripture);
      } else if (/^\[Imagem:\]/i.test(text)) {
        const description = text.replace(/^\[Imagem:\]\s*/i, '').trim();
        const hasCaption = /^Legenda:/i.test(paragraphs[index + 1] || '');
        const caption = hasCaption ? paragraphs[index + 1].replace(/^Legenda:\s*/i, '').trim() : '';
        const figure = studyIllustration(images, imageIndex, articleName, description, caption);
        if (figure) {
          container.append(figure);
          imageIndex += 1;
          if (hasCaption) index += 1;
        } else {
          // Preserve original captions if an image is not available in the source.
          container.append(studyEl('p', 'study-image-description', description));
        }
      } else if (/^Legenda:/i.test(text)) {
        container.append(studyEl('p', 'study-image-caption', text.replace(/^Legenda:\s*/i, '')));
      } else if (/^\[Nota\]/i.test(text)) {
        container.append(studyEl('aside', 'study-footnote',
          text.replace(/^\[Nota\]\s*/i, '').replace(/\s*\[Fim da nota\.\]\s*/gi, '').trim()));
      } else if (/^Destaque:\s*/i.test(text)) {
        container.append(studyEl('blockquote', 'study-emphasis', text.replace(/^Destaque:\s*/i, '')));
      } else if (/^Cântico\s+\d+/i.test(text)) {
        container.append(studyEl('p', 'study-song', text));
      } else if (numbered) {
        // O comentário aparece imediatamente antes do parágrafo correspondente.
        container.append(createWatchtowerComment(numbered[1]));
        const paragraph = studyEl('p', 'study-numbered-paragraph');
        paragraph.append(studyEl('span', 'study-paragraph-index', numbered[1]));
        paragraph.append(document.createTextNode(numbered[2]));
        container.append(paragraph);
      } else if (text.length < 120 && !/[.;:]$/.test(text) && !/^[\[\d]/.test(text)) {
        container.append(studyEl('h3', 'study-section-title', text));
      } else {
        container.append(studyEl('p', 'study-body-paragraph', text));
      }
    }
  }

  // Joias espirituais: comentário pessoal guardado somente no navegador.
  function jewelCommentKey(study) {
    return 'planejamento-espiritual-joias-v1:' + String(study.weekOf || 'sem-data');
  }

  function createJewelComment(study) {
    const block = studyEl('div', 'study-comment-box study-jewels-comment');
    const label = studyEl('label', 'study-comment-label', 'Meu comentário · Joias espirituais');
    const field = studyEl('textarea', 'study-comment-input');
    const status = studyEl('p', 'study-jewels-save-state');
    field.id = 'midweek-jewels-comment';
    field.rows = 2;
    field.placeholder = 'Anote suas joias espirituais…';
    field.spellcheck = true;
    field.setAttribute('autocapitalize', 'sentences');
    label.htmlFor = field.id;
    try {
      field.value = localStorage.getItem(jewelCommentKey(study)) || '';
      status.textContent = 'Comentário pessoal salvo neste navegador.';
    } catch (error) {
      console.warn('Comentário de Joias indisponível:', error);
      status.textContent = 'Não foi possível recuperar o comentário deste navegador.';
    }
    field.addEventListener('input', () => {
      resizeWatchtowerComment(field);
      try {
        if (field.value.trim()) localStorage.setItem(jewelCommentKey(study), field.value);
        else localStorage.removeItem(jewelCommentKey(study));
        status.textContent = 'Salvo neste navegador.';
      } catch (error) {
        console.warn('Falha ao guardar comentário de Joias:', error);
        status.textContent = 'Não foi possível salvar. Copie o comentário antes de sair.';
      }
    });
    block.append(label, field, status);
    return block;
  }

  // Comentários exclusivos de cada capítulo e pergunta. Não usam o Firestore público.
  function congregationCommentKey(study, chapter, questionIndex) {
    const book = study.congregationStudy?.bookCode || 'livro';
    const week = /^\d{4}-\d{2}-\d{2}$/.test(String(study.weekOf || '')) ? study.weekOf : 'sem-semana';
    return 'planejamento-espiritual-congregacao-comentarios-v1:' +
      week + ':' + book + ':' + chapter.number + ':' + questionIndex;
  }

  function createCongregationComment(study, chapter, questionIndex) {
    const wrapper = studyEl('div', 'study-comment-box congregation-comment-box');
    const id = 'congregation-comment-' + chapter.number + '-' + questionIndex;
    const label = studyEl('label', 'study-comment-label', 'Meu comentário');
    label.htmlFor = id;
    const field = studyEl('textarea', 'study-comment-input congregation-comment-input');
    field.id = id;
    field.rows = 2;
    field.spellcheck = true;
    field.placeholder = 'Escreva sua resposta ou comentário…';
    field.setAttribute('autocapitalize', 'sentences');
    const status = studyEl('p', 'congregation-comment-status');
    status.id = id + '-status';
    field.setAttribute('aria-describedby', status.id);
    const key = congregationCommentKey(study, chapter, questionIndex);
    try {
      field.value = localStorage.getItem(key) || '';
      status.textContent = 'Comentário pessoal salvo neste navegador.';
    } catch (error) {
      console.warn('Não foi possível ler o comentário do estudo bíblico:', error);
      status.textContent = 'Não foi possível ler o comentário salvo.';
    }
    field.addEventListener('input', () => {
      resizeWatchtowerComment(field);
      try {
        if (field.value.trim()) localStorage.setItem(key, field.value);
        else localStorage.removeItem(key);
        status.textContent = 'Salvo neste navegador.';
      } catch (error) {
        console.warn('Falha ao salvar comentário de congregação:', error);
        status.textContent = 'Não foi possível salvar. Copie seu comentário antes de sair.';
      }
    });
    wrapper.append(label, field, status);
    return wrapper;
  }

  // Um único painel recolhível comporta um ou mais capítulos da publicação indicada.
  function createCongregationReading(study, referenceText) {
    const data = study.congregationStudy;
    const chapters = Array.isArray(data?.chapters) ? data.chapters : [];
    const accordion = studyEl('details', 'congregation-accordion');
    const toggle = studyEl('summary', 'congregation-toggle');
    const heading = studyEl('span', 'congregation-toggle-heading', 'Abrir estudo bíblico de congregação');
    const subtitle = studyEl('span', 'congregation-toggle-subtitle',
      referenceText || data?.reference || 'Consulta da publicação oficial');
    toggle.append(heading, subtitle);
    accordion.append(toggle);

    const panel = studyEl('div', 'congregation-panel');
    if (data?.bookTitle) panel.append(studyEl('p', 'congregation-book-name', data.bookTitle));
    if (!chapters.length) {
      panel.append(studyEl('p', 'congregation-fallback', 'A leitura deste estudo está disponível na publicação oficial.'));
      const original = officialUrl(study.url);
      if (original) {
        const link = studyEl('a', 'inline-link', 'Abrir programação no JW.org ↗');
        link.href = original;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        panel.append(link);
      }
    } else {
      const count = chapters.length;
      panel.append(studyEl('p', 'congregation-chapter-count',
        count === 1 ? '1 capítulo nesta reunião' : count + ' capítulos nesta reunião'));
      for (const chapter of chapters) {
        let questionIndex = 0;
        const section = studyEl('section', 'congregation-chapter');
        section.append(studyEl('span', 'congregation-chapter-label', 'Capítulo ' + chapter.number));
        section.append(studyEl('h5', 'congregation-chapter-title', chapter.title || ('Capítulo ' + chapter.number)));
        const blocks = Array.isArray(chapter.content) ? chapter.content : [];
        if (blocks.length) {
          for (const block of blocks) {
            if (!block || typeof block.text !== 'string') continue;
            if (block.kind === 'heading') {
              section.append(studyEl('h6', 'congregation-content-heading', block.text));
            } else if (block.kind === 'question') {
              questionIndex += 1;
              section.append(studyEl('p', 'congregation-content-question', block.text));
              // Cada pergunta tem seu próprio comentário imediatamente abaixo.
              section.append(createCongregationComment(study, chapter, questionIndex));
            } else {
              section.append(studyEl('p', 'congregation-content-paragraph', block.text));
            }
          }
        } else {
          section.append(studyEl('p', 'congregation-fallback',
            'O texto completo não foi carregado nesta atualização. Consulte a publicação original.'));
        }
        const source = officialUrl(chapter.url);
        if (source) {
          const link = studyEl('a', 'congregation-source', 'Ler capítulo na publicação oficial ↗');
          link.href = source;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          section.append(link);
        }
        panel.append(section);
      }
    }
    accordion.append(panel);
    accordion.addEventListener('toggle', () => {
      if (accordion.open) requestAnimationFrame(resizeVisibleMidweekComments);
    });
    return accordion;
  }

  function resizeVisibleMidweekComments() {
    document.querySelectorAll('#midweek-content .study-comment-input')
      .forEach(resizeWatchtowerComment);
  }

  // A leitura bíblica sempre abre na publicação oficial do JW.org.
  // Apenas a referência aparece neste site; o texto não é reproduzido.
  const bibleBookNames = [
    'Gênesis', 'Êxodo', 'Levítico', 'Números', 'Deuteronômio', 'Josué',
    'Juízes', 'Rute', '1 Samuel', '2 Samuel', '1 Reis', '2 Reis',
    '1 Crônicas', '2 Crônicas', 'Esdras', 'Neemias', 'Ester', 'Jó',
    'Salmos', 'Provérbios', 'Eclesiastes', 'Cântico de Salomão',
    'Isaías', 'Jeremias', 'Lamentações', 'Ezequiel', 'Daniel',
    'Oseias', 'Joel', 'Amós', 'Obadias', 'Jonas', 'Miqueias',
    'Naum', 'Habacuque', 'Sofonias', 'Ageu', 'Zacarias',
    'Malaquias', 'Mateus', 'Marcos', 'Lucas', 'João', 'Atos',
    'Romanos', '1 Coríntios', '2 Coríntios', 'Gálatas', 'Efésios',
    'Filipenses', 'Colossenses', '1 Tessalonicenses', '2 Tessalonicenses',
    '1 Timóteo', '2 Timóteo', 'Tito', 'Filêmon', 'Hebreus',
    'Tiago', '1 Pedro', '2 Pedro', '1 João', '2 João', '3 João',
    'Judas', 'Apocalipse'
  ];

  function normalizeBibleBook(name) {
    return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[.]/g, '').replace(/\s+/g, ' ').trim();
  }

  function parseOfficialBibleReference(reference) {
    const original = String(reference || '').trim();
    const match = original.match(/^(.+?)\s+(\d{1,3}):(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?/);
    if (!match) return null;
    let book = normalizeBibleBook(match[1]);
    if (book === 'salmo') book = 'salmos';
    if (book === 'revelacao') book = 'apocalipse';
    if (book === 'canticos') book = 'cantico de salomao';
    const index = bibleBookNames.findIndex(name => normalizeBibleBook(name) === book);
    const chapter = Number(match[2]);
    const firstVerse = Number(match[3]);
    const lastVerse = match[4] ? Number(match[4]) : null;
    if (index < 0 || chapter < 1 || chapter > 150 ||
        firstVerse < 1 || firstVerse > 176 ||
        (lastVerse && (lastVerse < firstVerse || lastVerse > 176))) return null;
    const bookName = bibleBookNames[index];
    const slug = normalizeBibleBook(bookName).replace(/ /g, '-');
    const url = 'https://www.jw.org/pt/biblioteca/biblia/nwt/livros/' + slug + '/' + chapter + '/';
    return {
      title: bookName + ' ' + chapter + ':' + firstVerse +
        (lastVerse ? '–' + lastVerse : ''),
      url, chapter, start: firstVerse, end: lastVerse,
      lesson: original.match(/\((th\s+[^)]+)\)/i)?.[1] || ''
    };
  }

  function createOfficialBibleReading(referenceText) {
    const reference = parseOfficialBibleReference(referenceText);
    const wrapper = studyEl('details', 'bible-reading-accordion');
    const summary = studyEl('summary', 'bible-reading-toggle');
    const title = studyEl('span', 'bible-reading-toggle-title',
      reference ? reference.title : String(referenceText || 'Leitura da Bíblia').trim());
    const description = studyEl('span', 'bible-reading-toggle-subtitle',
      'Tradução do Novo Mundo · JW.org');
    summary.append(title, description);
    wrapper.append(summary);

    const panel = studyEl('div', 'bible-reading-panel');
    panel.append(studyEl('p', 'bible-reading-source', 'Leia a passagem na Bíblia oficial, diretamente no JW.org.'));
    if (reference?.lesson) {
      panel.append(studyEl('p', 'bible-reading-lesson', 'Preparação: ' + reference.lesson));
    }
    const link = studyEl('a', 'bible-reading-link',
      reference ? 'Abrir ' + reference.title + ' no JW.org ↗' : 'Abrir a Bíblia no JW.org ↗');
    // Sem iframe: a página original pode restringir incorporações.
    // O link preserva todas as funções de leitura do próprio JW.org.
    link.href = officialUrl(reference?.url) ||
      'https://www.jw.org/pt/biblioteca/biblia/nwt/livros/';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    panel.append(link);
    wrapper.append(panel);
    return wrapper;
  }

  function renderMidweekReading(study) {
    const container = document.querySelector('#midweek-content');
    container.replaceChildren();
    const paragraphs = studyParagraphs(study.content);
    const images = imageList(study);
    if (!paragraphs.length) {
      container.append(studyEl('p', 'study-empty', 'Programa indisponível. Consulte a apostila oficial.'));
      return;
    }
    let currentSection = container;
    let currentItem = null;
    let mainIllustrationPlaced = false;
    for (const text of paragraphs) {
      const sectionNames = {
        'Tesouros da Palavra de Deus': 'treasures',
        'Faça seu melhor no ministério': 'ministry',
        'Nossa vida cristã': 'life'
      };
      const item = text.match(/^(\d+)\.\s+(.+?)\s+\((\d+)\s+min\)$/i);
      if (sectionNames[text]) {
        const section = studyEl('section', 'study-program-section study-program-section--' + sectionNames[text]);
        const heading = studyEl('h3', 'study-program-section-title', text);
        section.append(heading);
        const body = studyEl('div', 'study-program-section-body');
        section.append(body);
        container.append(section);
        currentSection = body;
        currentItem = null;
      } else if (item) {
        const block = studyEl('article', 'study-program-item');
        const heading = studyEl('header', 'study-program-item-heading');
        heading.append(studyEl('span', 'study-program-number', item[1]));
        const title = studyEl('h4', '', item[2]);
        heading.append(title);
        heading.append(studyEl('span', 'study-program-duration', item[3] + ' min'));
        block.append(heading);
        const body = studyEl('div', 'study-program-item-body');
        block.append(body);
        currentSection.append(block);
        currentItem = body;
        if (!mainIllustrationPlaced && images.length) {
          const figure = studyIllustration(images, 0, 'Reunião de meio de semana', 'Ilustração da programação semanal');
          if (figure) body.append(figure);
          mainIllustrationPlaced = true;
        }
      } else if (/^Cântico\s+\d+/i.test(text) || /^Comentários\s+(?:iniciais|finais)/i.test(text)) {
        container.append(studyEl('p', 'study-program-interlude', text));
        currentItem = null;
      } else if (/^\d{1,2}\s+a\s+\d{1,2}\s+de\s+/i.test(text)) {
        // Already shown in the date band above.
      } else {
        const target = currentItem || currentSection;
        target.append(studyEl('p', text.includes('?') ? 'study-program-question' : 'study-program-paragraph', text));
      }
    }
    // Adiciona os recursos somente às partes corretas da apostila.
    for (const item of container.querySelectorAll('.study-program-item')) {
      const title = item.querySelector('.study-program-item-heading h4')?.textContent || '';
      const body = item.querySelector('.study-program-item-body');
      if (!body) continue;
      if (/^Joias espirituais$/i.test(title)) {
        body.append(createJewelComment(study));
      } else if (/^Leitura da Bíblia$/i.test(title)) {
        const readingReference = body.textContent.trim();
        body.replaceChildren(createOfficialBibleReading(readingReference));
      } else if (/^Estudo bíblico de congregação$/i.test(title)) {
        const source = body.textContent.trim();
        body.replaceChildren(createCongregationReading(study, source));
      }
    }
    requestAnimationFrame(resizeVisibleMidweekComments);
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
    setText('#midweek-date', midweekRangeText(midweek, asDate(midweek.weekOf || meeting.weekOf)));
    renderMidweekReading(midweek);
    renderStudyGallery('midweek', midweek, 'Reunião de meio de semana');
    setSource('#midweek-original', midweek.url);

    setText('#watchtower-title', studyTitle(watchtower.title) || 'Estudo de A Sentinela');
    setText('#watchtower-date', studyRangeText(watchtower.title, 'Semana de ' + (asDate(watchtower.weekOf) || 'data indisponível')));
    setText('#watchtower-theme', watchtower.theme);
    setText('#watchtower-objective', watchtower.objective || '');
    setVisible('#watchtower-goal', !!watchtower.objective);
    renderWatchtowerReading(watchtower);
    renderStudyGallery('watchtower', watchtower, 'Estudo de A Sentinela');
    requestAnimationFrame(resizeVisibleWatchtowerComments);
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

  document.querySelectorAll('[data-meeting-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      const next = '#meetings-' + tab.dataset.meetingTab;
      if (location.hash === next) selectMeeting(tab.dataset.meetingTab);
      else location.hash = next;
    });
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 'midweek'
        : event.key === 'End' ? 'weekend'
        : tab.dataset.meetingTab === 'midweek' ? 'weekend' : 'midweek';
      const selected = document.querySelector('[data-meeting-tab="' + next + '"]');
      selected.focus();
      const hash = '#meetings-' + next;
      if (location.hash === hash) selectMeeting(next);
      else location.hash = hash;
    });
  });
  addEventListener('resize', () => {
    resizeVisibleWatchtowerComments();
    resizeVisibleMidweekComments();
  });
  addEventListener('hashchange', navigate);
  navigate();
  load();

})();
