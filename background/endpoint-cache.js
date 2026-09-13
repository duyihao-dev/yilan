(function initYilanAutoEndpointCache(global) {
  /**
   * Auto endpoint-mode probe cache.
   *
   * Remembers which endpoint mode succeeded for a given provider+base URL so
   * the auto-resolution probe does not re-run on every request. Persisted in
   * chrome.storage.local under Constants.AUTO_ENDPOINT_CACHE_STORAGE_KEY and
   * memoized in memory for the service worker lifetime.
   */
  const ChromeApi = global.YilanChromeApi || (typeof require === 'function' ? require('../shared/chrome-api.js') : null);
  const Constants = global.AISummaryConstants || (typeof require === 'function' ? require('../shared/constants.js') : null);
  const UrlUtils = global.AISummaryUrlUtils || (typeof require === 'function' ? require('../shared/url-utils.js') : null);

  const STORAGE_KEY = Constants.AUTO_ENDPOINT_CACHE_STORAGE_KEY;

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
        console.warn('[Yilan] Failed to load auto endpoint cache.', error);
        return {};
      });

    return cacheLoadPromise;
  }

  function getCacheKey(settings) {
    const provider = String(settings?.aiProvider || '').toLowerCase();
    if (provider !== 'openai') return '';

    return UrlUtils.buildProviderCacheKey(provider, settings?.aiBaseURL);
  }

  async function getCachedMode(cacheKey) {
    if (!cacheKey) return '';
    const cache = await loadCache();
    const value = cache?.[cacheKey];
    return typeof value === 'string' ? value : '';
  }

  async function setCachedMode(cacheKey, mode) {
    if (!cacheKey || !mode) return;
    const cache = normalizeStoredCacheRecord(await loadCache());
    if (cache[cacheKey] === mode) return;

    const nextCache = Object.assign({}, cache, { [cacheKey]: mode });
    try {
      await ChromeApi.storageLocalSet({ [STORAGE_KEY]: nextCache });
      cacheRecord = nextCache;
    } catch (error) {
      console.warn('[Yilan] Failed to persist auto endpoint cache.', error);
    }
  }

  const api = {
    STORAGE_KEY,
    getCacheKey,
    getCachedMode,
    setCachedMode
  };

  global.YilanAutoEndpointCache = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof self !== 'undefined' ? self : globalThis);
