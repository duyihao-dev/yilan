(function initYilanI18n(global) {
  const globalAny = /** @type {any} */ (global);
  // Browser contexts resolve messages through chrome.i18n (which follows the
  // browser UI locale and falls back to default_locale). Node tests inject a
  // flat catalog via setCatalog() instead. A user-selected UI language (the
  // `uiLanguage` setting) overrides both through a catalog fetched from the
  // packaged _locales directory.
  let injectedCatalog = null;
  let overrideLocale = '';
  let overrideCatalog = null;
  let syncToken = 0;

  const UI_LANGUAGE_FILES = {
    zh: '_locales/zh_CN/messages.json',
    en: '_locales/en/messages.json'
  };
  const LOCALE_CHANGED_EVENT = 'yilan-locale-changed';

  function normalizeSubstitutions(substitutions) {
    if (substitutions === undefined || substitutions === null) return [];
    const list = Array.isArray(substitutions) ? substitutions : [substitutions];
    return list.map((item) => (item === undefined || item === null ? '' : String(item)));
  }

  function interpolateEntry(entry, substitutions) {
    const placeholders = entry && typeof entry.placeholders === 'object' && entry.placeholders
      ? entry.placeholders
      : {};
    return String(entry.message || '').replace(/\$(\w+)\$/g, (match, name) => {
      const placeholder = placeholders[name];
      const content = placeholder && typeof placeholder.content === 'string' ? placeholder.content : name;
      const index = Number.parseInt(String(content).replace(/\$/g, ''), 10);
      if (Number.isInteger(index) && substitutions[index - 1] !== undefined) {
        return substitutions[index - 1];
      }
      return match;
    });
  }

  function resolveFromCatalog(catalog, safeKey, substitutionsList) {
    if (!catalog) return '';
    const entry = catalog[safeKey];
    const template = entry && typeof entry.message === 'string' ? entry : (typeof entry === 'string' ? { message: entry } : null);
    return template ? interpolateEntry(template, substitutionsList) : '';
  }

  function getMessage(key, substitutions) {
    const safeKey = String(key || '').trim();
    if (!safeKey) return '';

    const substitutionsList = normalizeSubstitutions(substitutions);

    // The user-selected UI language wins over the browser locale so the
    // interface can be pinned independently of chrome.i18n.
    const overrideMessage = resolveFromCatalog(overrideCatalog, safeKey, substitutionsList);
    if (overrideMessage) return overrideMessage;

    const api = globalAny.chrome && globalAny.chrome.i18n;
    if (api && typeof api.getMessage === 'function') {
      try {
        const message = api.getMessage(safeKey, substitutionsList);
        if (message) return message;
      } catch (error) {
        // Fall through to the injected catalog (test/Node environments).
      }
    }

    const injectedMessage = resolveFromCatalog(injectedCatalog, safeKey, substitutionsList);
    if (injectedMessage) return injectedMessage;

    return '';
  }

  function applyDom(root) {
    const scope = root || globalAny.document;
    if (!scope || typeof scope.querySelectorAll !== 'function') return;

    scope.querySelectorAll('[data-i18n]').forEach((node) => {
      const message = getMessage(node.getAttribute('data-i18n'));
      if (message) node.textContent = message;
    });

    [
      ['data-i18n-placeholder', 'placeholder'],
      ['data-i18n-title', 'title'],
      ['data-i18n-aria-label', 'aria-label']
    ].forEach(([binding, attribute]) => {
      scope.querySelectorAll('[' + binding + ']').forEach((node) => {
        const message = getMessage(node.getAttribute(binding));
        if (message) node.setAttribute(attribute, message);
      });
    });
  }

  function setCatalog(catalog) {
    injectedCatalog = catalog && typeof catalog === 'object' ? catalog : null;
  }

  // Selects the effective UI language: 'zh' | 'en' pin the interface through
  // the packaged catalogs, '' / 'auto' follows the browser locale. The pin
  // only takes effect once its catalog is available; until then everything
  // falls back to the browser locale so UI copy and prompt locale stay
  // consistent. Exposed for tests and for the storage bootstrap below.
  function setOverride(locale, catalog) {
    const normalized = locale === 'zh' || locale === 'en' ? locale : '';
    const activeCatalog = normalized && catalog && typeof catalog === 'object' ? catalog : null;
    overrideLocale = activeCatalog ? normalized : '';
    overrideCatalog = activeCatalog;
  }

  // Normalized UI locale ('zh' | 'en' | other base tag; '' when unavailable,
  // e.g. Node tests). Used by the prompt builders to pick the prompt locale.
  // The user-selected override wins over the browser locale.
  function getUILanguage() {
    if (overrideLocale) return overrideLocale;
    try {
      const api = globalAny.chrome && globalAny.chrome.i18n;
      const raw = api && typeof api.getUILanguage === 'function' ? api.getUILanguage() : '';
      const normalized = String(raw || '').trim().toLowerCase();
      if (!normalized) return '';
      if (normalized.startsWith('zh')) return 'zh';
      if (normalized.startsWith('en')) return 'en';
      return normalized.split('-')[0];
    } catch (error) {
      return '';
    }
  }

  function readUiLanguageSetting() {
    const storage = globalAny.chrome && globalAny.chrome.storage;
    if (!storage || !storage.sync || typeof storage.sync.get !== 'function') {
      return Promise.resolve('');
    }
    return new Promise((resolve) => {
      try {
        storage.sync.get({ uiLanguage: 'auto' }, (items) => {
          const lastError = globalAny.chrome && globalAny.chrome.runtime && globalAny.chrome.runtime.lastError;
          if (lastError) {
            resolve('');
            return;
          }
          resolve(String((items && items.uiLanguage) || 'auto'));
        });
      } catch (error) {
        resolve('');
      }
    });
  }

  async function loadOverrideCatalog(locale) {
    const file = UI_LANGUAGE_FILES[locale];
    const runtime = globalAny.chrome && globalAny.chrome.runtime;
    if (!file || !runtime || typeof runtime.getURL !== 'function' || typeof globalAny.fetch !== 'function') {
      return null;
    }
    try {
      const response = await fetch(runtime.getURL(file));
      if (!response || !response.ok) return null;
      const catalog = await response.json();
      return catalog && typeof catalog === 'object' ? catalog : null;
    } catch (error) {
      return null;
    }
  }

  function notifyLocaleChanged() {
    if (!globalAny.document) return;
    if (overrideLocale) {
      globalAny.document.documentElement.lang = overrideLocale === 'zh' ? 'zh-CN' : 'en';
    }
    applyDom(globalAny.document);
    try {
      globalAny.document.dispatchEvent(new CustomEvent(LOCALE_CHANGED_EVENT, {
        detail: { locale: overrideLocale || 'auto' }
      }));
    } catch (error) {
      // CustomEvent unavailable (e.g. very old environments); DOM is already repainted.
    }
  }

  async function syncLocaleOverride() {
    const token = ++syncToken;
    const setting = await readUiLanguageSetting();
    if (token !== syncToken) return;

    const next = setting === 'zh' || setting === 'en' ? setting : '';
    if (next === overrideLocale && (next === '' || overrideCatalog)) return;

    setOverride(next, null);
    if (!next) {
      notifyLocaleChanged();
      return;
    }

    const catalog = await loadOverrideCatalog(next);
    if (token !== syncToken) return;
    setOverride(next, catalog);
    notifyLocaleChanged();
  }

  function listenForSettingChanges() {
    const storage = globalAny.chrome && globalAny.chrome.storage;
    if (storage && storage.onChanged && typeof storage.onChanged.addListener === 'function') {
      storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes && Object.prototype.hasOwnProperty.call(changes, 'uiLanguage')) {
          syncLocaleOverride();
        }
      });
    }
  }

  globalAny.YilanI18n = {
    get: getMessage,
    applyDom,
    setCatalog,
    setOverride,
    getUILanguage
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = globalAny.YilanI18n;
  }

  applyOnReady();

  const storage = globalAny.chrome && globalAny.chrome.storage;
  if (storage && storage.sync) {
    listenForSettingChanges();
    syncLocaleOverride().catch(() => {});
  }

  function applyOnReady() {
    if (!globalAny.document) return;
    if (globalAny.document.readyState === 'loading') {
      globalAny.document.addEventListener('DOMContentLoaded', () => applyDom(globalAny.document), { once: true });
    } else {
      applyDom(globalAny.document);
    }
  }
})(globalThis);
