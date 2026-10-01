(function (root) {
  const prefix = 'planejamento-espiritual-study-v1:';
  function read(storage, key, fallback = {}) {
    try {
      const value = JSON.parse(storage.getItem(prefix + key));
      return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
    } catch { return fallback; }
  }
  function patch(storage, key, changes) {
    const value = { ...read(storage, key), ...changes };
    storage.setItem(prefix + key, JSON.stringify(value));
    return value;
  }
  function meetingKey(kind, week) {
    if (!['midweek', 'weekend'].includes(kind) || !/^\d{4}-\d{2}-\d{2}$/.test(week)) throw new Error('Semana inválida.');
    return `meeting:${kind}:${week}`;
  }
  function progress(record, items) {
    return { done: items.filter((item) => record.checked?.[item.id] === true).length, total: items.length };
  }
  function savedWeeks(storage, kind) {
    const start = prefix + `meeting:${kind}:`;
    const weeks = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(start) && /^\d{4}-\d{2}-\d{2}$/.test(key.slice(start.length))) weeks.push(key.slice(start.length));
    }
    return weeks.sort().reverse();
  }
  const api = { prefix, read, patch, meetingKey, progress, savedWeeks };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.StudyState = api;
})(typeof window === 'undefined' ? globalThis : window);
