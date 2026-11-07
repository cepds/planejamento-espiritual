(function () {
  'use strict';
  // Agenda pública: qualquer visitante pode ver, adicionar, editar e excluir eventos.
  // Eventos locais antigos só são compartilhados após confirmação explícita.
  const legacyKey = 'planejamento-espiritual-20-events';
  const types = new Set(['Congresso', 'Assembleia', 'Visita', 'Outro']);
  const dialog = document.getElementById('event-dialog');
  const form = document.getElementById('event-form');
  const submit = form.querySelector('button[type="submit"]');
  const add = document.getElementById('event-open');
  const importButton = document.getElementById('event-import');
  const status = document.getElementById('event-sync-status');
  const widget = document.querySelector('.event-widget');
  const mobileToggle = document.getElementById('event-mobile-toggle');
  const mobileSummary = document.getElementById('event-mobile-summary');
  const currentDate = () => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date()).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    return parts.year + '-' + parts.month + '-' + parts.day;
  };
  let collection = null;
  let connected = false;
  let sharedEvents = [];
  let editingId = null;
  let saving = false;

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00Z');
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }

  function dateLabel(value) {
    if (!validDate(value)) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric'
    }).format(new Date(value + 'T00:00:00Z'));
  }

  function until(value) {
    return Math.round((Date.parse(value + 'T00:00:00Z') -
      Date.parse(currentDate() + 'T00:00:00Z')) / 86400000);
  }

  function setMobileExpanded(expanded) {
    widget.classList.toggle('is-expanded', expanded);
    mobileToggle.setAttribute('aria-expanded', String(expanded));
    mobileToggle.setAttribute('aria-label', expanded
      ? 'Fechar agenda de eventos' : 'Abrir ' + mobileSummary.textContent);
  }

  mobileToggle.addEventListener('click', () => {
    setMobileExpanded(!widget.classList.contains('is-expanded'));
  });
  document.addEventListener('pointerdown', event => {
    if (widget.classList.contains('is-expanded') && !widget.contains(event.target) && !dialog.open) {
      setMobileExpanded(false);
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !dialog.open) setMobileExpanded(false);
  });
  window.addEventListener('hashchange', () => setMobileExpanded(false));

  function message(text, error = false) {
    status.textContent = text;
    status.classList.toggle('error', error);
  }

  function setConnected(value) {
    connected = value;
    add.disabled = !value;
    importButton.disabled = !value;
  }

  function fromDoc(doc) {
    const item = doc.data() || {};
    return {
      id: doc.id,
      type: types.has(item.type) ? item.type : 'Outro',
      title: typeof item.title === 'string' ? item.title.slice(0, 100) : '',
      date: validDate(item.date) ? item.date : '',
      location: typeof item.location === 'string' ? item.location.slice(0, 120) : ''
    };
  }

  function legacyEvents() {
    try {
      const items = JSON.parse(localStorage.getItem(legacyKey) || '[]');
      return Array.isArray(items) ? items.filter(item =>
        item && typeof item.title === 'string' && validDate(item.date) &&
        item.date >= currentDate()).slice(0, 50) : [];
    } catch {
      return [];
    }
  }

  function titleOf(item) {
    return item.title || item.type || 'Evento';
  }

  function render() {
    const ordered = sharedEvents.filter(item => item.date)
      .sort((a, b) => a.date.localeCompare(b.date) || titleOf(a).localeCompare(titleOf(b)));
    const next = ordered.find(item => until(item.date) >= 0);
    document.getElementById('event-empty').hidden = Boolean(next);
    document.getElementById('event-next').hidden = !next;
    const shortDate = next ? next.date.slice(8, 10) + '/' + next.date.slice(5, 7) : '';
    mobileSummary.textContent = !connected ? 'Agenda · indisponível'
      : next ? 'Agenda · ' + titleOf(next) + ' · ' + shortDate : 'Agenda · sem eventos';
    if (!widget.classList.contains('is-expanded')) {
      mobileToggle.setAttribute('aria-label', 'Abrir ' + mobileSummary.textContent);
    }
    if (next) {
      document.getElementById('event-next-type').textContent = next.type;
      document.getElementById('event-next-title').textContent = titleOf(next);
      const remaining = until(next.date);
      const distance = remaining === 0 ? 'Hoje' : remaining === 1 ? 'Amanhã' : 'Em ' + remaining + ' dias';
      document.getElementById('event-next-date').textContent = dateLabel(next.date) + ' · ' + distance;
      const location = document.getElementById('event-next-location');
      location.textContent = next.location;
      location.hidden = !next.location;
    }

    const wrapper = document.getElementById('event-all');
    const list = document.getElementById('event-list');
    wrapper.hidden = ordered.length === 0;
    list.replaceChildren();
    for (const item of ordered) {
      const row = document.createElement('li');
      const info = document.createElement('span');
      const title = document.createElement('strong');
      title.textContent = titleOf(item);
      const meta = document.createElement('small');
      meta.textContent = dateLabel(item.date) + (until(item.date) < 0 ? ' · encerrado' : '');
      info.append(title, meta);
      const actions = document.createElement('div');
      actions.className = 'event-list-actions';

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Editar';
      edit.disabled = !connected;
      edit.addEventListener('click', () => openDialog(item));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Excluir';
      remove.disabled = !connected;
      remove.addEventListener('click', async () => {
        if (!collection || !confirm('Excluir "' + titleOf(item) + '" da agenda de todos?')) return;
        remove.disabled = true;
        try {
          await collection.doc(item.id).delete();
          message('Evento excluído para todos.');
        } catch (error) {
          console.error('Erro ao excluir evento público:', error);
          remove.disabled = false;
          message('Não foi possível excluir o evento.', true);
        }
      });

      actions.append(edit, remove);
      row.append(info, actions);
      list.append(row);
    }

    const unsent = legacyEvents().filter(local =>
      !ordered.some(remote => remote.title === local.title && remote.date === local.date));
    importButton.hidden = !connected || unsent.length === 0;
    importButton.textContent = 'Publicar ' + unsent.length + ' evento(s) antigo(s)';
  }

  function openDialog(item = null) {
    if (!connected || !collection) return;
    form.reset();
    editingId = item ? item.id : null;
    document.getElementById('event-dialog-title').textContent =
      item ? 'Editar evento' : 'Adicionar evento';
    submit.textContent = item ? 'Salvar alterações' : 'Salvar evento';
    const inputDate = document.getElementById('event-form-date');
    inputDate.min = item && item.date < currentDate() ? '' : currentDate();
    if (item) {
      document.getElementById('event-form-type').value = item.type;
      document.getElementById('event-form-title').value = item.title;
      inputDate.value = item.date;
      document.getElementById('event-form-location').value = item.location;
    }
    dialog.showModal();
  }

  add.addEventListener('click', () => openDialog());
  document.getElementById('event-cancel').addEventListener('click', () => dialog.close());
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving || !connected || !collection || !form.reportValidity()) return;
    const type = document.getElementById('event-form-type').value;
    const title = document.getElementById('event-form-title').value.trim() || type;
    const date = document.getElementById('event-form-date').value;
    const location = document.getElementById('event-form-location').value.trim();
    if (!types.has(type) || !validDate(date) || (!editingId && date < currentDate())) {
      message('Selecione um tipo e uma data válida.', true);
      return;
    }
    if (title.length > 100 || location.length > 120) {
      message('Título ou local ultrapassa o limite.', true);
      return;
    }
    if (!editingId && sharedEvents.some(item => item.title === title && item.date === date)) {
      message('Este evento já está cadastrado.', true);
      return;
    }
    saving = true;
    submit.disabled = true;
    try {
      const payload = { type, title, date, location };
      if (editingId) await collection.doc(editingId).update(payload);
      else await collection.add(payload);
      dialog.close();
      message('Evento salvo para todos.');
    } catch (error) {
      console.error('Erro ao salvar evento público:', error);
      message('Falha ao salvar. Confira a conexão e o Firestore.', true);
    } finally {
      saving = false;
      submit.disabled = false;
    }
  });

  importButton.addEventListener('click', async () => {
    if (!connected || !collection) return;
    const unsent = legacyEvents().filter(local =>
      !sharedEvents.some(remote => remote.title === local.title && remote.date === local.date));
    if (!unsent.length || !confirm('Publicar ' + unsent.length +
      ' evento(s) antigos deste navegador para todos?')) return;
    importButton.disabled = true;
    try {
      for (const item of unsent) {
        const type = types.has(item.type) ? item.type
          : types.has(item.title) ? item.title : 'Outro';
        await collection.add({
          type, title: item.title.slice(0, 100), date: item.date,
          location: typeof item.location === 'string' ? item.location.slice(0, 120) : ''
        });
      }
      message('Eventos antigos publicados para todos.');
    } catch (error) {
      console.error('Falha ao publicar eventos antigos:', error);
      message('Alguns eventos podem não ter sido publicados.', true);
    } finally {
      importButton.disabled = false;
    }
  });

  function connect() {
    setConnected(false);
    message('Conectando agenda compartilhada…');
    try {
      if (!window.firebase || !window.firebase.apps.length ||
          typeof window.firebase.firestore !== 'function') {
        throw new Error('Firebase não inicializado.');
      }
      collection = window.firebase.firestore().collection('eventosPublicos');
      collection.orderBy('date', 'desc').limit(200).onSnapshot(snapshot => {
        sharedEvents = snapshot.docs.map(fromDoc);
        setConnected(true);
        render();
        message('Agenda compartilhada · tempo real');
      }, error => {
        console.error('Falha ao ler agenda pública:', error);
        setConnected(false);
        render();
        message('Agenda indisponível. Confira a configuração do Firestore.', true);
      });
    } catch (error) {
      console.error('Erro ao conectar agenda pública:', error);
      setConnected(false);
      render();
      message('Agenda indisponível. Confira a configuração do Firebase.', true);
    }
  }

  connect();
})();
