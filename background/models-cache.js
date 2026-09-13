(function initYilanModelsCache(global) {
  /**
   * Provider model-list cache.
   *
   * Caches `/models` responses per provider+base URL so the popup can offer
   * model ID suggestions without re-fetching. Persisted in
   * chrome.storage.local under Constants.MODELS_CACHE_STORAGE_KEY, memoized
   * in memory, and trimmed to the 20 most recently fetched entries.
   */
  const ChromeApi = global.YilanChromeApi || (typeof require === 'function' ? require('../shared/chrome-api.js') : null);
  const Constants = global.AISummaryConstants || (typeof require === 'function' ? require('../shared/constants.js') : null);
  const UrlUtils = global.AISummaryUrlUtils || (typeof require === 'function' ? require('../shared/url-utils.js') : null);

  const STORAGE_KEY = Constants.MODELS_CACHE_STORAGE_KEY;
  const MAX_ENTRIES = 20;

  let cacheRecord = null;
  let cacheLoadPromise = null;

  function normalizeStoredCacheRecord(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return Object.assign({}, raw);
  }

  function loadCache() {
    if (cacheRecord) return Promise.resolve(cacheRecord);
    if (cacheLoadPromise) return cacheLoadPromise;

    cacheLoadPromise = ChromeApi.storageLocalGet([STORAGE_KEY])
      .then((items) => {
        cacheRecord = normalizeStoredCacheRecord(items?.[STORAGE_KEY]);
        return cacheRecord;
      })
      .catch((error) => {
        cacheLoadPromise = null;
        console.warn('[Yilan] Failed to load models cache.', error);
        return {};
      });

    return cacheLoadPromise;
  }

  function getKey(settings, runtime) {
    return UrlUtils.buildModelsCacheKey(settings, runtime);
  }

  function normalizeEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const models = Array.isArray(entry.models) ? entry.models.filter((id) => typeof id === 'string' && id.trim()) : [];
    if (!models.length) return null;

    return {
      fetchedAt: String(entry.fetchedAt || ''),
      models
    };
  }

  async function setModels(cacheKey, entry) {
    if (!cacheKey) return;

    const normalized = normalizeEntry(entry);
    if (!normalized) return;

    const cache = normalizeStoredCacheRecord(await loadCache());
    const nextCache = Object.assign({}, cache, { [cacheKey]: normalized });

    const entries = Object.entries(nextCache);
    if (entries.length > MAX_ENTRIES) {
      entries
        .sort((a, b) => String(b?.[1]?.fetchedAt || '').localeCompare(String(a?.[1]?.fetchedAt || '')))
        .slice(MAX_ENTRIES)
        .forEach(([key]) => {
          delete nextCache[key];
        });
    }

    try {
      await ChromeApi.storageLocalSet({ [STORAGE_KEY]: nextCache });
      cacheRecord = nextCache;
    } catch (error) {
      console.warn('[Yilan] Failed to persist models cache.', error);
    }
  }

  const api = {
    STORAGE_KEY,
    MAX_ENTRIES,
    getKey,
    normalizeEntry,
    setModels
  };

  global.YilanModelsCache = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof self !== 'undefined' ? self : globalThis);
