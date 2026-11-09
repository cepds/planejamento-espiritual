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
          if (/^(?:\d{1,2}|review-\d{1,2})$/.test(number) && typeof comment === 'string') {
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

  function createWatchtowerReviewComment(index) {
    const key = 'review-' + index;
    const wrapper = studyEl('div', 'study-comment-box study-review-comment');
    const id = 'watchtower-review-comment-' + index;
    const label = studyEl('label', 'study-comment-label', 'Meu comentário · pergunta ' + index);
    label.htmlFor = id;
    const field = studyEl('textarea', 'study-comment-input study-review-comment-input');
    field.id = id;
    field.rows = 2;
    field.spellcheck = true;
    field.placeholder = 'Escreva sua resposta ou comentário…';
    field.setAttribute('autocapitalize', 'sentences');
    field.setAttribute('aria-describedby', 'watchtower-comment-status');
    field.value = currentWatchtowerComments[key] || '';
    field.addEventListener('input', () => {
      resizeWatchtowerComment(field);
      saveWatchtowerComment(key, field.value);
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
    let reviewQuestionIndex = 0;
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
        const questionText = text.replace(/^[\uE000-\uF8FF•]\s*/u, '')
          .replace(/\s*\[Fim do quadro\.\]\s*/gi, '').trim();
        if (questionText) {
          reviewQuestionIndex += 1;
          const item = studyEl('li', 'study-review-item');
          item.append(studyEl('p', 'study-review-question', questionText));
          item.append(createWatchtowerReviewComment(reviewQuestionIndex));
          reviewList.append(item);
        }
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

  // Planejamento familiar personalizado, mantido apenas no navegador.
  // Uma troca permuta as duas datas; não duplica nem perde nenhum estudo.
  const familyPlanStorageKey = 'planejamento-espiritual-family-agenda-v1';
  let familySchedule = [];
  let familyWeeks = new Map();
  let familyAssignments = Object.create(null);
  let familyCurrentWeek = '';
  let familyFallback = null;

  function familyStudyForDate(date) {
    const sourceWeek = familyAssignments[date] || date;
    return familyWeeks.get(sourceWeek) || familyWeeks.get(date) || null;
  }

  function loadFamilyAssignments() {
    familyAssignments = Object.create(null);
    try {
      const saved = JSON.parse(localStorage.getItem(familyPlanStorageKey) || '{}');
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return;
      const weeks = [...familyWeeks.keys()];
      const allWeeks = new Set(weeks);
      const sourceWeeks = weeks.map(date =>
        allWeeks.has(saved[date]) ? saved[date] : date);
      // Accept only full permutations; never display duplicate assignments.
      if (new Set(sourceWeeks).size !== weeks.length) return;
      for (const date of weeks) {
        if (saved[date] && saved[date] !== date && allWeeks.has(saved[date])) {
          familyAssignments[date] = saved[date];
        }
      }
    } catch (error) {
      console.warn('Não foi possível carregar o calendário pessoal:', error);
    }
  }

  function familyPlanStatus(message, isError = false) {
    const element = document.querySelector('#family-plan-status');
    element.textContent = message;
    element.classList.toggle('error', isError);
  }

  function formatFamilyWeek(week) {
    return asDate(week) || week;
  }

  function renderFamilyStudy(study) {
    if (!study) return;
    setText('#family-topic', study.topic || study.category || 'Tema da semana');
    setText('#family-title', study.title || 'Adoração em família');
    setText('#family-date', 'Semana de ' + formatFamilyWeek(familyCurrentWeek));
    setText('#family-prompt', study.prompt);
    setText('#family-reading', study.reading);
    setVisible('#family-reading-wrap', Boolean(study.reading));
    setText('#family-do', study.doThis);
    setText('#family-avoid', study.avoidThis);
    setText('#family-action', study.action);
    setCover('#family-cover', study.publicationImageUrl, 'Imagem da publicação do estudo selecionado');
    const questions = document.querySelector('#family-questions');
    questions.replaceChildren();
    for (const question of Array.isArray(study.questions) ? study.questions : []) {
      const item = document.createElement('li');
      item.textContent = question;
      questions.append(item);
    }
    setVisible('#family-questions-wrap', questions.children.length > 0);
    setSource('#family-original', study.articleUrl);
    setText('#family-source-title', study.sourceTitle || 'Material oficial no JW.org');
  }

  function renderFamilySchedule() {
    const category = document.querySelector('#family-category-filter').value;
    const list = document.querySelector('#family-plan-list');
    list.replaceChildren();
    const selected = familySchedule.filter(entry => category === 'Todos' ||
      familyStudyForDate(entry.weekOf)?.category === category);
    for (const planned of selected) {
      const date = planned.weekOf;
      const item = familyStudyForDate(date) || planned;
      const row = document.createElement('li');
      row.className = 'family-plan-item' + (date === familyCurrentWeek ? ' is-current' : '');
      const info = document.createElement('div');
      info.className = 'family-plan-item-info';
      const meta = document.createElement('span');
      meta.className = 'family-plan-item-date';
      meta.textContent = (date === familyCurrentWeek ? 'Esta semana · ' : '') + formatFamilyWeek(date);
      const tag = document.createElement('span');
      tag.className = 'family-plan-item-category';
      tag.textContent = item.category || 'Estudo';
      const title = document.createElement('strong');
      title.textContent = item.title || 'Estudo';
      info.append(meta, tag, title);
      if (familyAssignments[date]) {
        const edited = document.createElement('small');
        edited.className = 'family-plan-edited';
        edited.textContent = 'Data personalizada';
        info.append(edited);
      }
      const actions = document.createElement('div');
      actions.className = 'family-plan-item-actions';
      if (date === familyCurrentWeek) {
        const current = document.createElement('span');
        current.className = 'family-plan-current-label';
        current.textContent = 'Estudo de hoje';
        actions.append(current);
      } else {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'family-plan-swap';
        button.textContent = 'Trocar com hoje';
        button.setAttribute('aria-label', 'Trocar o estudo da semana de ' +
          formatFamilyWeek(date) + ' com o estudo de hoje');
        button.addEventListener('click', () => swapFamilyStudy(date));
        actions.append(button);
      }
      const url = officialUrl(item.articleUrl);
      if (url) {
        const original = document.createElement('a');
        original.className = 'family-plan-source';
        original.href = url;
        original.target = '_blank';
        original.rel = 'noopener noreferrer';
        original.textContent = 'Fonte oficial ↗';
        actions.append(original);
      }
      row.append(info, actions);
      list.append(row);
    }
    document.querySelector('#family-library-count').textContent =
      familySchedule.length + ' datas';
    document.querySelector('#family-plan-reset').hidden =
      Object.keys(familyAssignments).length === 0;
    if (!selected.length) {
      const empty = document.createElement('li');
      empty.className = 'family-plan-empty';
      empty.textContent = 'Nenhum estudo neste filtro.';
      list.append(empty);
    }
  }

  function swapFamilyStudy(otherDate) {
    if (otherDate === familyCurrentWeek || !familyWeeks.has(otherDate) ||
        !familyWeeks.has(familyCurrentWeek)) return;
    const next = { ...familyAssignments };
    const todaySource = next[familyCurrentWeek] || familyCurrentWeek;
    const otherSource = next[otherDate] || otherDate;
    if (otherSource === familyCurrentWeek) delete next[familyCurrentWeek];
    else next[familyCurrentWeek] = otherSource;
    if (todaySource === otherDate) delete next[otherDate];
    else next[otherDate] = todaySource;
    try {
      localStorage.setItem(familyPlanStorageKey, JSON.stringify(next));
    } catch (error) {
      console.warn('Não foi possível salvar a troca de datas:', error);
      familyPlanStatus('Não foi possível salvar a alteração neste navegador.', true);
      return;
    }
    familyAssignments = Object.assign(Object.create(null), next);
    renderFamilyStudy(familyStudyForDate(familyCurrentWeek));
    renderFamilySchedule();
    familyPlanStatus('Estudos trocados e salvos neste navegador.');
    document.querySelector('#family-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function initializeFamilyPlan(content) {
    familySchedule = Array.isArray(content.familySchedule) && content.familySchedule.length
      ? content.familySchedule.filter(entry => entry?.weekOf && entry.title)
      : [content.familyWorship, ...(content.familyUpcoming || [])].filter(entry => entry?.weekOf && entry.title);
    familyWeeks = new Map(familySchedule.map(entry => [entry.weekOf, entry]));
    familyCurrentWeek = content.familyWorship?.weekOf || familySchedule[0]?.weekOf || '';
    familyFallback = content.familyWorship || null;
    loadFamilyAssignments();
    renderFamilyStudy(familyStudyForDate(familyCurrentWeek) || familyFallback);
    renderFamilySchedule();
    familyPlanStatus('Trocas pessoais: os estudos ficam salvos somente neste navegador.');
  }

  document.querySelector('#family-category-filter').addEventListener('change', renderFamilySchedule);
  document.querySelector('#family-plan-reset').addEventListener('click', () => {
    if (!confirm('Restaurar todas as datas originais da Adoração em família neste navegador?')) return;
    try {
      localStorage.removeItem(familyPlanStorageKey);
    } catch (error) {
      familyPlanStatus('Não foi possível restaurar o calendário neste navegador.', true);
      return;
    }
    familyAssignments = Object.create(null);
    renderFamilyStudy(familyStudyForDate(familyCurrentWeek) || familyFallback);
    renderFamilySchedule();
    familyPlanStatus('Programação original restaurada neste navegador.');
  });

  let latestContent = null;
  let displayedBrazilDay = '';
  let dailyNeedsRefresh = false;
  let lastDailyRequest = 0;

  function brazilDay(now = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now).filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]));
    return parts.year + '-' + parts.month + '-' + parts.day;
  }

  function officialDailyLink(date) {
    const [year, month, day] = date.split('-').map(Number);
    return 'https://wol.jw.org/pt/wol/h/r5/lp-t/' + year + '/' + month + '/' + day;
  }

  function renderDailyOnly(content) {
    const today = brazilDay();
    displayedBrazilDay = today;
    const readings = [...(Array.isArray(content?.dailyReadings) ? content.dailyReadings : []), content?.daily];
    const selected = readings.find(item => item?.date === today &&
      item.verse && item.reference && item.content);
    dailyNeedsRefresh = !selected;
    setText('#today-date', asDate(today));
    setText('#daily-date', asDate(today));
    setText('#today-verse', selected?.verse || 'Texto diário de hoje ainda não disponível neste site.');
    setText('#today-reference', selected?.reference || '');
    setText('#daily-verse', selected?.verse || 'Texto diário de hoje ainda não disponível neste site.');
    setText('#daily-reference', selected?.reference || '');
    appendParagraphs('#daily-content', selected?.content ||
      'Abra o texto de hoje diretamente na Biblioteca Online da Torre de Vigia pelo link abaixo.');
    setSource('#daily-original', selected?.url || officialDailyLink(today));
  }

  async function refreshDailyFromSite() {
    const now = Date.now();
    if (now - lastDailyRequest < 60000) return;
    lastDailyRequest = now;
    try {
      const response = await fetch('data/content.json?at=' + now, { cache: 'no-store' });
      if (!response.ok) return;
      const incoming = await response.json();
      if (!incoming?.daily) return;
      latestContent = incoming;
      renderDailyOnly(incoming);
    } catch (error) {
      console.warn('Não foi possível atualizar o texto diário neste momento:', error);
    }
  }

  function checkDailyDate() {
    const today = brazilDay();
    if (!latestContent) return;
    if (displayedBrazilDay !== today) {
      // Troca instantaneamente para a leitura pré-publicada, mesmo com atraso no GitHub Actions.
      renderDailyOnly(latestContent);
      void refreshDailyFromSite();
    } else if (dailyNeedsRefresh && Date.now() - lastDailyRequest >= 300000) {
      void refreshDailyFromSite();
    }
  }

  function scheduleDailyMidnightCheck() {
    // Alinha à virada do minuto; também confere ao retornar ao app no celular.
    const next = 60000 - (Date.now() % 60000) + 100;
    setTimeout(() => {
      checkDailyDate();
      scheduleDailyMidnightCheck();
    }, next);
  }

  function render(content) {
    const meeting = content.meeting || {};
    const midweek = content.midweekStudy || {};
    const watchtower = content.watchtower || {};
    const family = content.familyWorship || {};

    renderDailyOnly(content);

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

    initializeFamilyPlan(content);

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
      latestContent = data;
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
  addEventListener('focus', checkDailyDate);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkDailyDate();
  });
  scheduleDailyMidnightCheck();
  navigate();
  load();

})();
