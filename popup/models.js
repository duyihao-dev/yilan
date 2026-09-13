(function initYilanPopupModels(global) {
  function createModelsController(deps) {
    const $ = deps.$;
    const I18n = deps.i18n;
    const UrlUtils = deps.urlUtils;
    const storageLocalGet = deps.storageLocalGet;
    const runtimeSendMessage = deps.runtimeSendMessage;
    const collectSettings = deps.collectSettings;
    const persistSettings = deps.persistSettings;
    const validateBaseURL = deps.validateBaseURL;
    const getProviderCredentialValidation = deps.getProviderCredentialValidation;
    const getRuntimeErrorMessage = deps.getRuntimeErrorMessage;
    const formatDateTime = deps.formatDateTime;
    const updateHints = deps.updateHints;
    // popup.js passes a resolver so the message follows a runtime uiLanguage switch.
    const resolveBaseUrlInvalidMessage = typeof deps.baseUrlInvalidMessage === 'function'
      ? deps.baseUrlInvalidMessage
      : () => deps.baseUrlInvalidMessage;
    const MODELS_CACHE_STORAGE_KEY = deps.modelsCacheStorageKey;

  function getModelsCacheKeyFromSettings(settings) {
    return UrlUtils.buildModelsCacheKey(settings);
  }

  function renderModelOptions(models, meta = {}) {
    const datalist = $('modelNameOptions');
    if (!datalist) return;

    datalist.innerHTML = '';
    const ids = Array.isArray(models) ? models.map((item) => (typeof item === 'string' ? item : item?.id)).filter(Boolean) : [];
    ids.forEach((id) => {
      const option = document.createElement('option');
      option.value = String(id);
      datalist.appendChild(option);
    });

    const hint = $('modelListHint');
    if (!hint) return;

    if (!ids.length) {
      hint.textContent = meta.message || '';
      return;
    }

    const fetchedAt = meta.fetchedAt ? formatDateTime(meta.fetchedAt) : '';
    hint.textContent = fetchedAt ? I18n.get('popup_models_loaded_count', [ids.length, fetchedAt]) : I18n.get('popup_models_loaded', [ids.length]);
  }

  async function loadCachedModelOptions(settings) {
    try {
      const cacheKey = getModelsCacheKeyFromSettings(settings);
      if (!cacheKey) return;

      const items = await storageLocalGet([MODELS_CACHE_STORAGE_KEY]);
      const cache = items?.[MODELS_CACHE_STORAGE_KEY];
      const entry = cache && typeof cache === 'object' ? cache?.[cacheKey] : null;
      const models = Array.isArray(entry?.models) ? entry.models : [];
      if (!models.length) return;

      renderModelOptions(models, { fetchedAt: entry?.fetchedAt || '' });
    } catch {
      // Ignore local cache failures.
    }
  }

  async function refreshModelOptions(options = {}) {
    const button = $('refreshModelsBtn');
    if (button) {
      button.disabled = true;
      button.textContent = I18n.get('popup_refreshing_models');
    }

    try {
      await persistSettings({ skipSuccessStatus: true, silentStatus: true });
      const settings = collectSettings();

      if (!settings.apiKey) {
        renderModelOptions([], { message: I18n.get('popup_models_need_key') });
        return;
      }

      if (settings.aiBaseURL && !validateBaseURL(settings.aiBaseURL)) {
        renderModelOptions([], { message: resolveBaseUrlInvalidMessage() });
        return;
      }

      const credentialValidation = getProviderCredentialValidation(settings);
      if (!credentialValidation.valid) {
        renderModelOptions([], { message: credentialValidation.message });
        return;
      }

      const response = await runtimeSendMessage({ action: 'listModels', settings });
      if (!response.success) {
        renderModelOptions([], { message: I18n.get('popup_models_fetch_failed', [getRuntimeErrorMessage(response.error)]) });
        return;
      }

      renderModelOptions(response.models || [], { fetchedAt: response.fetchedAt || '' });
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = I18n.get('popup_refresh_models_btn');
      }
    }
  }

  function bindModelControls() {
    const refreshBtn = $('refreshModelsBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        refreshModelOptions().catch((error) => {
          renderModelOptions([], { message: I18n.get('popup_models_fetch_failed', [String(error?.message || error || I18n.get('popup_unknown_error'))]) });
        });
      });
    }

    const modelField = $('modelName');
    if (modelField) {
      modelField.addEventListener('input', updateHints);
    }
  }


    return {
      getModelsCacheKeyFromSettings,
      renderModelOptions,
      loadCachedModelOptions,
      refreshModelOptions,
      bindModelControls
    };
  }

  const api = {
    createModelsController
  };

  global.YilanPopupModels = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);
