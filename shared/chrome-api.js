(function initYilanChromeApi(/** @type {any} */ global) {
  /**
   * Centralized Chrome API promise wrappers.
   *
   * Two semantics are provided on purpose:
   * - strict (default): reject with an Error when chrome.runtime.lastError is set.
   * - lenient: resolve anyway; used by surfaces where a storage hiccup should
   *   not break the UI flow (e.g. the sidebar reading settings).
   */
  function resolveErrors() {
    return global.AISummaryErrors || (typeof require === 'function' ? require('./errors.js') : null);
  }

  function readRuntimeLastErrorMessage() {
    return typeof chrome !== 'undefined' ? (chrome.runtime.lastError?.message || '') : '';
  }

  function rejectOnLastError(reject) {
    const message = readRuntimeLastErrorMessage();
    if (!message) return false;
    reject(new Error(message));
    return true;
  }

  function storageGet(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(keys, (items) => {
        if (rejectOnLastError(reject)) return;
        resolve(items || {});
      });
    });
  }

  function storageSet(payload) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set(payload, () => {
        if (rejectOnLastError(reject)) return;
        resolve();
      });
    });
  }

  function storageRemove(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.remove(keys, () => {
        if (rejectOnLastError(reject)) return;
        resolve();
      });
    });
  }

  function storageLocalGet(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (items) => {
        if (rejectOnLastError(reject)) return;
        resolve(items || {});
      });
    });
  }

  function storageLocalSet(payload) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(payload, () => {
        if (rejectOnLastError(reject)) return;
        resolve();
      });
    });
  }

  function storageLocalRemove(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(keys, () => {
        if (rejectOnLastError(reject)) return;
        resolve();
      });
    });
  }

  function storageGetLenient(keys) {
    return new Promise((resolve) => {
      chrome.storage.sync.get(keys, (items) => resolve(items || {}));
    });
  }

  function storageSetLenient(payload) {
    return new Promise((resolve) => {
      chrome.storage.sync.set(payload, resolve);
    });
  }

  function runtimeSendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        const error = readRuntimeLastErrorMessage();
        if (error) {
          resolve({ success: false, error: { message: error } });
          return;
        }
        resolve(response || {});
      });
    });
  }

  function createTab(url) {
    return new Promise((resolve) => {
      chrome.tabs.create({ url }, (tab) => {
        const error = readRuntimeLastErrorMessage();
        resolve({
          success: !error,
          error,
          tab: tab || null
        });
      });
    });
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getRuntimeErrorMessage(errorLike) {
    const Errors = resolveErrors();
    const fallbackMessage = typeof Errors?.getUserMessage === 'function'
      ? Errors.getUserMessage(null)
      : 'Unknown error.';

    if (!errorLike) {
      return fallbackMessage;
    }
    if (typeof errorLike === 'string') {
      return errorLike || fallbackMessage;
    }

    const hasMessage = typeof errorLike?.message === 'string' && errorLike.message.trim();
    const hasCode = typeof errorLike?.code === 'string' && errorLike.code.trim();

    // Prefer raw messages for plain `{ message: string }` objects (e.g. chrome.runtime.lastError),
    // otherwise Errors.getUserMessage() falls back to a generic catalog message.
    if (hasMessage && !hasCode) return errorLike.message.trim();

    if (typeof Errors?.getUserMessage === 'function') {
      return Errors.getUserMessage(errorLike);
    }
    if (hasMessage) return errorLike.message.trim();
    return String(errorLike);
  }

  const api = {
    readRuntimeLastErrorMessage,
    storageGet,
    storageSet,
    storageRemove,
    storageLocalGet,
    storageLocalSet,
    storageLocalRemove,
    storageGetLenient,
    storageSetLenient,
    runtimeSendMessage,
    createTab,
    wait,
    getRuntimeErrorMessage
  };

  global.YilanChromeApi = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : {});
