(function (global) {
  // Resolved lazily so the error catalog picks up the runtime uiLanguage
  // override (messages below are evaluated when an error is created, not at
  // load time).
  const I18n = () => global.YilanI18n || (typeof require === 'function' ? require('./i18n.js') : null);

  function catalogMessage(key, fallback) {
    const i18n = I18n();
    const message = i18n ? i18n.get(key) : '';
    return message || fallback;
  }

  const ERROR_CODES = {
    CONFIG_MISSING_API_KEY: 'CONFIG_MISSING_API_KEY',
    CONFIG_INVALID_BASE_URL: 'CONFIG_INVALID_BASE_URL',
    EXTRACTION_EMPTY: 'EXTRACTION_EMPTY',
    ADAPTER_NOT_FOUND: 'ADAPTER_NOT_FOUND',
    NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
    NETWORK_ERROR: 'NETWORK_ERROR',
    NETWORK_CONNECTION_ERROR: 'NETWORK_CONNECTION_ERROR',
    NETWORK_CORS_ERROR: 'NETWORK_CORS_ERROR',
    NETWORK_DNS_ERROR: 'NETWORK_DNS_ERROR',
    NETWORK_TLS_ERROR: 'NETWORK_TLS_ERROR',
    NETWORK_STREAM_DISCONNECTED: 'NETWORK_STREAM_DISCONNECTED',
    HTTP_ERROR: 'HTTP_ERROR',
    PARSE_ERROR: 'PARSE_ERROR',
    ENDPOINT_NOT_SUPPORTED: 'ENDPOINT_NOT_SUPPORTED',
    UNSUPPORTED_RESPONSE_FORMAT: 'UNSUPPORTED_RESPONSE_FORMAT',
    RUN_CANCELLED: 'RUN_CANCELLED',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
  };

  const ERROR_CATALOG = {
    [ERROR_CODES.CONFIG_MISSING_API_KEY]: {
      get message() { return catalogMessage('error_config_missing_api_key', '请先在设置中配置 API Key。'); },
      retriable: false
    },
    [ERROR_CODES.CONFIG_INVALID_BASE_URL]: {
      get message() { return catalogMessage('popup_base_url_invalid', 'Base URL 仅支持 HTTPS；HTTP 仅允许本机或局域网地址。'); },
      retriable: false
    },
    [ERROR_CODES.EXTRACTION_EMPTY]: {
      get message() { return catalogMessage('error_extraction_empty', '当前页面未提取到足够的正文内容。'); },
      retriable: false
    },
    [ERROR_CODES.ADAPTER_NOT_FOUND]: {
      get message() { return catalogMessage('error_adapter_not_found', '未找到可用的模型适配器。'); },
      retriable: false
    },
    [ERROR_CODES.NETWORK_TIMEOUT]: {
      get message() { return catalogMessage('error_network_timeout', '请求超时，请稍后重试。'); },
      retriable: true
    },
    [ERROR_CODES.NETWORK_ERROR]: {
      get message() { return catalogMessage('error_network_error', '网络请求失败，请检查网络或接口地址。'); },
      retriable: true
    },
    [ERROR_CODES.NETWORK_CONNECTION_ERROR]: {
      get message() { return catalogMessage('error_network_connection', '无法建立到接口的网络连接，请检查网络、网关或代理。'); },
      retriable: true
    },
    [ERROR_CODES.NETWORK_CORS_ERROR]: {
      get message() { return catalogMessage('error_network_cors', '浏览器拦截了跨域请求，请检查接口的 CORS 或扩展权限。'); },
      retriable: false
    },
    [ERROR_CODES.NETWORK_DNS_ERROR]: {
      get message() { return catalogMessage('error_network_dns', '无法解析接口域名，请检查接口地址或 DNS。'); },
      retriable: true
    },
    [ERROR_CODES.NETWORK_TLS_ERROR]: {
      get message() { return catalogMessage('error_network_tls', '接口 TLS/证书握手失败，请检查 HTTPS 证书或代理。'); },
      retriable: true
    },
    [ERROR_CODES.NETWORK_STREAM_DISCONNECTED]: {
      get message() { return catalogMessage('error_network_stream_disconnected', '流式连接意外中断，请检查接口的流式支持或网关稳定性。'); },
      retriable: true
    },
    [ERROR_CODES.HTTP_ERROR]: {
      get message() { return catalogMessage('error_http_status', '接口返回错误状态码。'); },
      retriable: true
    },
    [ERROR_CODES.PARSE_ERROR]: {
      get message() { return catalogMessage('error_parse', '模型响应解析失败。'); },
      retriable: true
    },
    [ERROR_CODES.ENDPOINT_NOT_SUPPORTED]: {
      get message() { return catalogMessage('error_endpoint_not_supported', '当前接口可能不支持所选端点。'); },
      retriable: false
    },
    [ERROR_CODES.UNSUPPORTED_RESPONSE_FORMAT]: {
      get message() { return catalogMessage('error_unsupported_response_format', '接口响应格式无法识别。'); },
      retriable: true
    },
    [ERROR_CODES.RUN_CANCELLED]: {
      get message() { return catalogMessage('sidebar_run_cancelled', '本次生成已取消。'); },
      retriable: true
    },
    [ERROR_CODES.UNKNOWN_ERROR]: {
      get message() { return catalogMessage('reader_unknown_error', '发生未知错误。'); },
      retriable: true
    }
  };

  const CORE_FIELDS = new Set([
    'code',
    'message',
    'retriable',
    'detail',
    'stage',
    'provider',
    'endpointMode'
  ]);

  function copyExtraFields(target, source) {
    Object.keys(source || {}).forEach((key) => {
      if (CORE_FIELDS.has(key)) return;
      if (typeof source[key] === 'undefined') return;
      target[key] = source[key];
    });
    return target;
  }

  function createError(code, overrides) {
    const base = ERROR_CATALOG[code] || ERROR_CATALOG[ERROR_CODES.UNKNOWN_ERROR];
    const extra = overrides || {};

    const error = {
      code,
      message: extra.message || base.message,
      retriable: typeof extra.retriable === 'boolean' ? extra.retriable : base.retriable,
      detail: extra.detail || '',
      stage: extra.stage || '',
      provider: extra.provider || '',
      endpointMode: extra.endpointMode || ''
    };

    return copyExtraFields(error, extra);
  }

  function normalizeError(input, fallbackCode, overrides) {
    if (input && typeof input === 'object' && input.code && input.message) {
      return createError(input.code, Object.assign({}, input, overrides));
    }

    const fallback = fallbackCode || ERROR_CODES.UNKNOWN_ERROR;
    const detail = input && input.message ? input.message : String(input || '');
    return createError(fallback, Object.assign({ detail }, overrides));
  }

  // Only transient failures are worth retrying: request timeouts sent as
  // HTTP, rate limiting, and server-side errors. Client errors (bad key,
  // bad model, missing route) fail fast.
  function isRetriableHttpStatus(status) {
    const code = Number(status) || 0;
    return code === 408 || code === 429 || (code >= 500 && code <= 599);
  }

  function createHttpError(status, body, overrides) {
    const detail = String(body || '').trim().slice(0, 300);
    const message = detail
      ? catalogMessage('error_http_status_detail', '接口返回 $p1$：$p2$').replace('$p1$', String(status)).replace('$p2$', detail)
      : catalogMessage('error_http_status_short', '接口返回 $p1$').replace('$p1$', String(status));
    return createError(ERROR_CODES.HTTP_ERROR, Object.assign({
      message,
      detail,
      httpStatus: status,
      retriable: isRetriableHttpStatus(status)
    }, overrides));
  }

  function getUserMessage(errorLike) {
    const error = normalizeError(errorLike);
    return error.message;
  }

  const api = {
    ERROR_CODES,
    ERROR_CATALOG,
    isRetriableHttpStatus,
    createError,
    normalizeError,
    createHttpError,
    getUserMessage
  };

  global.AISummaryErrors = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);
