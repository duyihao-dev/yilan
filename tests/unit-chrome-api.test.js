const { test, assert, freshRequire } = require('./harness');

function installChromeMock(options) {
  const failures = Object.assign({ get: '', set: '', remove: '', sendMessage: '', createTab: '' }, options?.failures || {});
  const calls = [];

  function run(message, callback) {
    global.chrome.runtime.lastError = message ? { message } : null;
    try {
      callback();
    } finally {
      global.chrome.runtime.lastError = null;
    }
  }

  global.chrome = {
    runtime: {
      lastError: null,
      sendMessage(message, callback) {
        calls.push({ type: 'sendMessage', message });
        run(failures.sendMessage, () => callback(options?.sendMessageResponse));
      }
    },
    tabs: {
      create(createProperties, callback) {
        calls.push({ type: 'createTab', createProperties });
        run(failures.createTab, () => callback(failures.createTab ? undefined : (options?.createdTab || { id: 7 })));
      }
    },
    storage: {
      sync: {
        get(keys, callback) {
          calls.push({ type: 'sync.get', keys });
          run(failures.get, () => callback({ themePreference: 'dark' }));
        },
        set(payload, callback) {
          calls.push({ type: 'sync.set', payload });
          run(failures.set, () => callback());
        },
        remove(keys, callback) {
          calls.push({ type: 'sync.remove', keys });
          run(failures.remove, () => callback());
        }
      },
      local: {
        get(keys, callback) {
          calls.push({ type: 'local.get', keys });
          run(failures.get, () => callback({ entrypointStatus: {} }));
        },
        set(payload, callback) {
          calls.push({ type: 'local.set', payload });
          run(failures.set, () => callback());
        },
        remove(keys, callback) {
          calls.push({ type: 'local.remove', keys });
          run(failures.remove, () => callback());
        }
      }
    }
  };

  return calls;
}

test('chrome api strict wrappers resolve payloads and reject on lastError', 'quality.chrome_api', async () => {
  const calls = installChromeMock({});
  const ChromeApi = freshRequire('shared/chrome-api.js');

  assert.deepStrictEqual(await ChromeApi.storageGet(['themePreference']), { themePreference: 'dark' });
  await ChromeApi.storageSet({ themePreference: 'light' });
  await ChromeApi.storageRemove('themePreference');
  assert.deepStrictEqual(await ChromeApi.storageLocalGet('entrypointStatus'), { entrypointStatus: {} });
  await ChromeApi.storageLocalSet({ entrypointStatus: {} });
  await ChromeApi.storageLocalRemove('entrypointStatus');
  assert.deepStrictEqual(
    calls.map((entry) => entry.type),
    ['sync.get', 'sync.set', 'sync.remove', 'local.get', 'local.set', 'local.remove']
  );

  installChromeMock({ failures: { get: 'sync read failed' } });
  const ChromeApiStrict = freshRequire('shared/chrome-api.js');
  await assert.rejects(() => ChromeApiStrict.storageGet(['themePreference']), /sync read failed/);
  await assert.rejects(() => ChromeApiStrict.storageLocalGet('x'), /sync read failed/);
});

test('chrome api lenient wrappers never reject on lastError', 'quality.chrome_api', async () => {
  installChromeMock({ failures: { get: 'boom', set: 'boom' } });
  const ChromeApi = freshRequire('shared/chrome-api.js');

  assert.deepStrictEqual(await ChromeApi.storageGetLenient(['a']), { themePreference: 'dark' });
  await ChromeApi.storageSetLenient({ a: 1 });
});

test('chrome api runtimeSendMessage converts lastError into failure response', 'quality.chrome_api', async () => {
  installChromeMock({ failures: { sendMessage: 'no receiver' } });
  const ChromeApi = freshRequire('shared/chrome-api.js');
  const failure = await ChromeApi.runtimeSendMessage({ action: 'ping' });
  assert.strictEqual(failure.success, false);
  assert.strictEqual(failure.error.message, 'no receiver');

  installChromeMock({ sendMessageResponse: { success: true, value: 1 } });
  const ChromeApiOk = freshRequire('shared/chrome-api.js');
  assert.deepStrictEqual(await ChromeApiOk.runtimeSendMessage({ action: 'ping' }), { success: true, value: 1 });
});

test('chrome api createTab reports success and error states', 'quality.chrome_api', async () => {
  installChromeMock({});
  const ChromeApi = freshRequire('shared/chrome-api.js');
  const ok = await ChromeApi.createTab('chrome://extensions/shortcuts');
  assert.strictEqual(ok.success, true);
  assert.strictEqual(ok.error, '');
  assert.deepStrictEqual(ok.tab, { id: 7 });

  installChromeMock({ failures: { createTab: 'cannot open' } });
  const ChromeApiFail = freshRequire('shared/chrome-api.js');
  const failed = await ChromeApiFail.createTab('chrome://extensions/shortcuts');
  assert.strictEqual(failed.success, false);
  assert.strictEqual(failed.error, 'cannot open');
  assert.strictEqual(failed.tab, null);
});

test('chrome api wait resolves after the requested delay', 'quality.chrome_api', async () => {
  installChromeMock({});
  const ChromeApi = freshRequire('shared/chrome-api.js');
  const startedAt = Date.now();
  await ChromeApi.wait(20);
  assert.ok(Date.now() - startedAt >= 15, 'wait should hold for roughly the requested time');
});

test('chrome api getRuntimeErrorMessage prefers raw messages and falls back to catalog', 'quality.chrome_api', async () => {
  installChromeMock({});
  const ChromeApi = freshRequire('shared/chrome-api.js');

  assert.strictEqual(ChromeApi.getRuntimeErrorMessage({ message: ' raw failure ' }), 'raw failure');
  assert.strictEqual(ChromeApi.getRuntimeErrorMessage('plain error'), 'plain error');
  assert.strictEqual(typeof ChromeApi.getRuntimeErrorMessage(null), 'string');
  assert.ok(ChromeApi.getRuntimeErrorMessage(null).length > 0);
  const coded = ChromeApi.getRuntimeErrorMessage({ code: 'UNKNOWN_ERROR', message: 'detail' });
  assert.strictEqual(typeof coded, 'string');
});

test('url utils build unified provider cache keys for popup and background', 'quality.models_cache_key', () => {
  const UrlUtils = freshRequire('shared/url-utils.js');

  // Empty base URL: popup and background now agree on the default OpenAI root.
  assert.strictEqual(
    UrlUtils.buildModelsCacheKey({ aiProvider: 'openai', aiBaseURL: '' }),
    'openai|https://api.openai.com/v1'
  );

  // Runtime base URL wins over the stored settings value.
  assert.strictEqual(
    UrlUtils.buildModelsCacheKey(
      { aiProvider: 'openai', aiBaseURL: 'https://example.com/v1' },
      { baseUrl: 'https://runtime.example.com/v1' }
    ),
    'openai|https://runtime.example.com/v1'
  );

  // Endpoint suffixes and casing collapse into one key.
  assert.strictEqual(
    UrlUtils.buildModelsCacheKey({ aiProvider: 'openai', aiBaseURL: 'HTTPS://Api.Example.com/v1/chat/completions' }),
    'openai|https://api.example.com/v1'
  );

  // Anthropic URLs drop the /v1/messages suffix for both surfaces.
  assert.strictEqual(
    UrlUtils.buildModelsCacheKey({ aiProvider: 'anthropic', aiBaseURL: 'https://api.anthropic.com/v1/messages' }),
    'anthropic|https://api.anthropic.com'
  );

  // Missing provider yields an empty key; custom providers keep their root.
  assert.strictEqual(UrlUtils.buildModelsCacheKey({ aiProvider: '', aiBaseURL: 'https://x.com' }), '');
  assert.strictEqual(
    UrlUtils.buildModelsCacheKey({ aiProvider: 'custom', aiBaseURL: 'gateway.example.com/v1/' }),
    'custom|https://gateway.example.com/v1'
  );
});

test('url utils openai helpers stay consistent with detection helpers', 'quality.models_cache_key', () => {
  const UrlUtils = freshRequire('shared/url-utils.js');

  assert.strictEqual(UrlUtils.looksLikeOpenAiEndpointUrl('https://a.com/v1/responses'), true);
  assert.strictEqual(UrlUtils.looksLikeOpenAiEndpointUrl('https://a.com/v1'), false);
  assert.strictEqual(UrlUtils.normalizeOpenAiBaseRoot('https://a.com/v1/completions'), 'https://a.com/v1');
  assert.strictEqual(UrlUtils.normalizeAnthropicBaseRoot('https://a.com/v1/messages'), 'https://a.com');
});

test('constants registry keeps storage keys stable for persisted user data', 'quality.storage_keys', () => {
  const Constants = freshRequire('shared/constants.js');

  assert.strictEqual(Constants.MODELS_CACHE_STORAGE_KEY, 'yilanModelsCacheV1');
  assert.strictEqual(Constants.AUTO_ENDPOINT_CACHE_STORAGE_KEY, 'yilanAutoEndpointModeCacheV1');
  assert.strictEqual(Constants.READER_SESSION_PREFIX, 'readerSession:');
  assert.strictEqual(Constants.READER_SESSION_MAX_AGE_MS, 24 * 60 * 60 * 1000);
  assert.ok(Array.isArray(Constants.SETTINGS_KEYS));
  assert.strictEqual(Constants.SETTINGS_KEYS.length, 20);
  ['apiKey', 'aiBaseURL', 'themePreference', 'uiLanguage', 'chunkConcurrency', 'privacyMode', 'entrypointReuseHistory'].forEach((key) => {
    assert.ok(Constants.SETTINGS_KEYS.includes(key), 'SETTINGS_KEYS missing ' + key);
  });

  const SidebarState = freshRequire('sidebar/state.js');
  assert.deepStrictEqual(SidebarState.SETTINGS_KEYS, Constants.SETTINGS_KEYS);
});
