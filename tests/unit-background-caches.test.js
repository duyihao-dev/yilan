const { test, assert, freshRequire } = require('./harness');

function installStorageMock(seed, options) {
  const store = Object.assign({}, seed || {});
  const writes = [];
  const failOnce = options?.failFirstRead === true;
  let reads = 0;

  global.chrome = {
    runtime: { lastError: null },
    storage: {
      local: {
        get(key, callback) {
          reads += 1;
          const fail = failOnce && reads === 1;
          global.chrome.runtime.lastError = fail ? { message: 'read failed' } : null;
          try {
            if (key === null) {
              callback(Object.assign({}, store));
              return;
            }
            const keys = Array.isArray(key) ? key : [key];
            const result = {};
            keys.forEach((item) => {
              if (Object.prototype.hasOwnProperty.call(store, item)) result[item] = store[item];
            });
            callback(result);
          } finally {
            global.chrome.runtime.lastError = null;
          }
        },
        set(payload, callback) {
          writes.push(Object.assign({}, payload));
          Object.assign(store, payload || {});
          callback?.();
        },
        remove(keys, callback) {
          (Array.isArray(keys) ? keys : [keys]).forEach((item) => {
            delete store[item];
          });
          callback?.();
        }
      }
    }
  };

  return { store, writes };
}

test('auto endpoint cache resolves keys only for openai and round-trips modes', 'quality.background_caches', async () => {
  const { store } = installStorageMock({});
  const AutoEndpointCache = freshRequire('background/endpoint-cache.js');

  assert.strictEqual(AutoEndpointCache.getCacheKey({ aiProvider: 'anthropic', aiBaseURL: 'https://a.com' }), '');
  const key = AutoEndpointCache.getCacheKey({ aiProvider: 'openai', aiBaseURL: 'https://gateway.example.com/v1' });
  assert.strictEqual(key, 'openai|https://gateway.example.com/v1');

  assert.strictEqual(await AutoEndpointCache.getCachedMode(''), '');
  assert.strictEqual(await AutoEndpointCache.getCachedMode(key), '');

  await AutoEndpointCache.setCachedMode(key, 'chat_completions');
  assert.strictEqual(await AutoEndpointCache.getCachedMode(key), 'chat_completions');
  assert.deepStrictEqual(store[AutoEndpointCache.STORAGE_KEY], { [key]: 'chat_completions' });

  // Same-value writes are skipped but reads still hit the memoized record.
  await AutoEndpointCache.setCachedMode(key, 'chat_completions');
  assert.strictEqual(await AutoEndpointCache.getCachedMode(key), 'chat_completions');
});

test('auto endpoint cache seeds from storage and survives read failures', 'quality.background_caches', async () => {
  const seeded = installStorageMock({
    yilanAutoEndpointModeCacheV1: { 'openai|https://api.openai.com/v1': 'responses' }
  });
  const AutoEndpointCache = freshRequire('background/endpoint-cache.js');
  assert.strictEqual(await AutoEndpointCache.getCachedMode('openai|https://api.openai.com/v1'), 'responses');
  assert.deepStrictEqual(Object.keys(seeded.store), ['yilanAutoEndpointModeCacheV1']);

  installStorageMock({}, { failFirstRead: true });
  const FallbackCache = freshRequire('background/endpoint-cache.js');
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    assert.strictEqual(await FallbackCache.getCachedMode('openai|x'), '');
  } finally {
    console.warn = originalWarn;
  }
});

test('models cache normalizes entries, trims to the newest 20, and persists', 'quality.background_caches', async () => {
  const { store, writes } = installStorageMock({});
  const ModelsCache = freshRequire('background/models-cache.js');

  assert.strictEqual(ModelsCache.getKey({ aiProvider: 'openai', aiBaseURL: '' }), 'openai|https://api.openai.com/v1');
  assert.strictEqual(ModelsCache.normalizeEntry({ models: [] }), null);
  assert.deepStrictEqual(
    ModelsCache.normalizeEntry({ fetchedAt: 123, models: [' gpt-5 ', '', 'gpt-4o'] }),
    { fetchedAt: '123', models: [' gpt-5 ', 'gpt-4o'] }
  );

  const key = ModelsCache.getKey({ aiProvider: 'openai', aiBaseURL: 'https://gateway.example.com/v1' });
  await ModelsCache.setModels(key, { fetchedAt: '2026-09-12T00:00:00.000Z', models: ['gpt-5'] });
  assert.deepStrictEqual(store[ModelsCache.STORAGE_KEY][key].models, ['gpt-5']);
  assert.strictEqual(writes.length, 1);

  // Invalid entries are ignored.
  await ModelsCache.setModels(key, { models: [] });
  assert.strictEqual(writes.length, 1);
  await ModelsCache.setModels('', { fetchedAt: 'x', models: ['m'] });
  assert.strictEqual(writes.length, 1);
});

test('models cache trim actually evicts oldest entries in storage', 'quality.background_caches', async () => {
  const bulk = {};
  for (let index = 0; index < 25; index += 1) {
    bulk['openai|https://host-' + String(index).padStart(2, '0') + '.example.com'] = {
      fetchedAt: '2026-08-' + String(index + 1).padStart(2, '0') + 'T00:00:00.000Z',
      models: ['m']
    };
  }
  const { store } = installStorageMock({ [freshRequire('background/models-cache.js').STORAGE_KEY]: bulk });
  const ModelsCache = freshRequire('background/models-cache.js');

  await ModelsCache.setModels('openai|https://newest.example.com', { fetchedAt: '2026-09-12T00:00:00.000Z', models: ['m'] });

  const record = store[ModelsCache.STORAGE_KEY];
  const keys = Object.keys(record);
  assert.strictEqual(keys.length, 20);
  assert.ok(keys.includes('openai|https://newest.example.com'), 'newest entry must be kept');
  assert.ok(!keys.includes('openai|https://host-00.example.com'), 'oldest entry must be evicted');
});
