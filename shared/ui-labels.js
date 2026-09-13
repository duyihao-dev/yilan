(function (global) {
  const Strings = global.AISummaryStrings || (typeof require === 'function' ? require('./strings.js') : null);
  // Resolved lazily so this file may load before shared/i18n.js and so a
  // runtime uiLanguage override applies to later label() calls.
  const I18n = () => global.YilanI18n || (typeof require === 'function' ? require('./i18n.js') : null);

  // Labels resolve through YilanI18n first (so the UI follows the browser
  // locale); the escaped-Chinese constants below are the fallback when no
  // catalog is available (e.g. standalone Node usage before tests inject one).

  function label(key, fallback) {
    const i18n = I18n();
    const message = i18n ? i18n.get(key) : '';
    return message || fallback;
  }

  const PROVIDER_LABELS = {
    openai: 'OpenAI Compatible',
    anthropic: 'Anthropic',
    legacy: 'Legacy'
  };

  const PROVIDER_LABEL_KEYS = {
    openai: 'popup_provider_openai',
    anthropic: 'popup_provider_anthropic'
  };

  const FALLBACK_SUMMARY_MODE_LABELS = {
    short: '\u7b80\u77ed\u603b\u7ed3',
    medium: '\u6807\u51c6\u603b\u7ed3',
    long: '\u8be6\u7ec6\u5206\u6790',
    key_points: '\u5173\u952e\u8981\u70b9',
    qa: '\u95ee\u7b54\u5361\u7247',
    glossary: '\u672f\u8bed\u8868',
    action_items: '\u884c\u52a8\u9879'
  };

  const READER_MODE_KEY_OVERRIDES = {
    long: 'label_mode_long_reader'
  };

  const RECORD_STATUS_LABEL_KEYS = {
    completed: 'label_status_completed',
    failed: 'label_status_failed',
    cancelled: 'label_status_cancelled',
    running: 'label_status_running'
  };

  const READER_STATUS_KEY_OVERRIDES = {
    running: 'label_status_reader_running'
  };

  const STATUS_FALLBACKS = {
    completed: '\u5df2\u5b8c\u6210',
    failed: '\u5931\u8d25',
    cancelled: '\u5df2\u53d6\u6d88',
    running: '\u8fdb\u884c\u4e2d'
  };

  const WARNING_LABEL_KEYS = {
    missing_title: 'label_warning_missing_title',
    empty_content: 'label_warning_empty_content',
    very_short_content: 'label_warning_short_content',
    content_truncated: 'label_warning_truncated',
    legacy_import: 'label_warning_legacy_import'
  };

  const WARNING_FALLBACKS = {
    missing_title: '\u6807\u9898\u4e0d\u5b8c\u6574',
    empty_content: '\u6b63\u6587\u4e3a\u7a7a',
    very_short_content: '\u6b63\u6587\u504f\u77ed',
    content_truncated: '\u6b63\u6587\u5df2\u622a\u65ad',
    legacy_import: '\u6765\u81ea\u65e7\u7248\u5386\u53f2\u8fc1\u79fb'
  };

  const STRATEGY_LABEL_KEYS = {
    news: 'label_strategy_news',
    blog: 'label_strategy_blog',
    doc: 'label_strategy_doc',
    forum: 'label_strategy_forum',
    repo: 'label_strategy_repo'
  };

  const STRATEGY_FALLBACKS = {
    news: '\u65b0\u95fb\u901f\u8bfb',
    blog: '\u535a\u5ba2\u6d1e\u5bdf',
    doc: '\u6587\u6863\u7cbe\u8bfb',
    forum: '\u95ee\u7b54\u5f52\u7eb3',
    repo: 'README \u5bfc\u8bfb'
  };

  const CHUNKING_STRATEGY_LABEL_KEYS = {
    none: 'label_chunking_none',
    paragraph_split: 'label_chunking_paragraph',
    section_split: 'label_chunking_section'
  };

  const CHUNKING_FALLBACKS = {
    none: '\u5355\u6bb5',
    paragraph_split: '\u6bb5\u843d',
    section_split: '\u7ae0\u8282'
  };

  function normalizeKey(value) {
    return String(value || '').trim().toLowerCase();
  }

  function getProviderLabel(provider, options) {
    const key = normalizeKey(provider);
    const fallback = Object.prototype.hasOwnProperty.call(options || {}, 'fallback')
      ? options.fallback
      : '\u672a\u77e5';

    if (options?.variant === 'settings') {
      const localized = label(PROVIDER_LABEL_KEYS[key], '');
      if (localized) return localized;
      const legacySettings = {
        openai: 'OpenAI / OpenAI \u517c\u5bb9\u63a5\u53e3',
        anthropic: 'Anthropic / Claude \u517c\u5bb9\u63a5\u53e3'
      };
      return legacySettings[key] || provider || fallback;
    }

    return PROVIDER_LABELS[key] || provider || fallback;
  }

  function getSummaryModeLabel(mode, options) {
    const key = normalizeKey(mode);
    const fallback = Object.prototype.hasOwnProperty.call(options || {}, 'fallback')
      ? options.fallback
      : label('label_mode_medium', '\u6807\u51c6\u603b\u7ed3');

    const labelKey = options?.variant === 'reader' && READER_MODE_KEY_OVERRIDES[key]
      ? READER_MODE_KEY_OVERRIDES[key]
      : 'label_mode_' + key;
    const localized = label(labelKey, '');
    if (localized) return localized;

    const labels = options?.variant === 'reader'
      ? null
      : (Strings?.SUMMARY_MODES || FALLBACK_SUMMARY_MODE_LABELS);
    const entry = options?.variant === 'reader'
      ? Object.assign({}, FALLBACK_SUMMARY_MODE_LABELS, { long: '\u6df1\u5ea6\u603b\u7ed3' })[key]
      : labels[key];

    return (typeof entry === 'string' ? entry : entry?.label) || mode || fallback;
  }

  function getRecordStatusLabel(status, options) {
    const key = normalizeKey(status);
    const isReader = options?.variant === 'reader';
    const labelKey = isReader && READER_STATUS_KEY_OVERRIDES[key]
      ? READER_STATUS_KEY_OVERRIDES[key]
      : RECORD_STATUS_LABEL_KEYS[key];
    const fallbackKey = isReader ? (key === 'running' ? '\u751f\u6210\u4e2d' : STATUS_FALLBACKS[key]) : STATUS_FALLBACKS[key];
    const fallback = Object.prototype.hasOwnProperty.call(options || {}, 'fallback')
      ? options.fallback
      : label('label_status_completed', '\u5df2\u5b8c\u6210');

    const localized = labelKey ? label(labelKey, '') : '';
    if (localized) return localized;

    return (typeof fallbackKey === 'string' ? fallbackKey : '') || status || fallback;
  }

  function getStrategyLabel(sourceStrategy, sourceType) {
    if (sourceStrategy?.label) return sourceStrategy.label;
    const key = normalizeKey(sourceType);
    return label(STRATEGY_LABEL_KEYS[key], STRATEGY_FALLBACKS[key] || '\u901a\u7528\u7cbe\u8bfb');
  }

  function getChunkingStrategyLabel(strategy, options) {
    const key = normalizeKey(strategy);
    const fallback = Object.prototype.hasOwnProperty.call(options || {}, 'fallback')
      ? options.fallback
      : label('label_chunking_auto', '\u81ea\u52a8');

    const localized = label(CHUNKING_STRATEGY_LABEL_KEYS[key], '');
    if (localized) return localized;
    return CHUNKING_FALLBACKS[key] || strategy || fallback;
  }

  function getWarningLabel(warning) {
    const key = String(warning || '');
    return label(WARNING_LABEL_KEYS[key], WARNING_FALLBACKS[key] || warning);
  }

  function summarizeWarnings(warnings) {
    return (warnings || []).map(getWarningLabel);
  }

  const api = {
    getProviderLabel,
    getSummaryModeLabel,
    getRecordStatusLabel,
    getStrategyLabel,
    getChunkingStrategyLabel,
    getWarningLabel,
    summarizeWarnings
  };

  global.AISummaryUiLabels = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);
