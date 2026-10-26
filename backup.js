(function (root) {
  const prefix = 'planejamento-espiritual-study-v1:';
  const events = 'planejamento-espiritual-20-events';
  const format = 'planejamento-espiritual-backup';
  function allowed(key) {
    return key === events || (key.startsWith(prefix) && key.length > prefix.length);
  }
  function validValue(key, value) {
    if (typeof value !== 'string' || value.length > 200000) return false;
    try {
      const data = JSON.parse(value);
      return key === events ? Array.isArray(data) : data !== null && typeof data === 'object' && !Array.isArray(data);
    } catch { return false; }
  }
  function exportData(storage) {
    const records = {};
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key || !allowed(key)) continue;
      const value = storage.getItem(key);
      if (validValue(key, value)) records[key] = value;
    }
    return { format, version: 1, exportedAt: new Date().toISOString(), records };
  }
  function importData(storage, data) {
    if (!data || data.format !== format || data.version !== 1 || !data.records ||
        typeof data.records !== 'object' || Array.isArray(data.records)) throw new Error('Arquivo de backup incompatível.');
    const entries = Object.entries(data.records);
    if (entries.length > 500 || entries.some(([key, value]) => !allowed(key) || !validValue(key, value))) {
      throw new Error('Backup contém registros inválidos.');
    }
    const old = entries.map(([key]) => [key, storage.getItem(key)]);
    try {
      for (const [key, value] of entries) storage.setItem(key, value);
    } catch (error) {
      for (const [key, value] of old) {
        try { if (value === null) storage.removeItem(key); else storage.setItem(key, value); }
        catch { /* Sem espaço suficiente para garantir reversão completa. */ }
      }
      throw new Error('Não foi possível restaurar os dados neste navegador.', { cause: error });
    }
    return entries.length;
  }
  const api = { exportData, importData };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PersonalBackup = api;
})(typeof window === 'undefined' ? globalThis : window);
