const {
  test,
  assert,
  readJson,
  freshRequire
} = require('./harness');

const zhCatalog = readJson('_locales/zh_CN/messages.json');
const enCatalog = readJson('_locales/en/messages.json');

test('i18n catalogs stay complete and consistent across locales', ['quality.i18n_catalog'], () => {
  const zhKeys = Object.keys(zhCatalog);
  assert.ok(zhKeys.length >= 100, 'zh_CN catalog is unexpectedly small: ' + zhKeys.length);

  zhKeys.forEach((key) => {
    assert.ok(Object.prototype.hasOwnProperty.call(enCatalog, key), 'en catalog missing key: ' + key);
    assert.strictEqual(typeof zhCatalog[key].message, 'string', 'zh message must be a string: ' + key);
    assert.ok(zhCatalog[key].message.trim(), 'zh message is empty: ' + key);
    assert.ok(enCatalog[key].message.trim(), 'en message is empty: ' + key);

    const zhPlaceholders = Object.keys(zhCatalog[key].placeholders || {}).sort();
    const enPlaceholders = Object.keys(enCatalog[key].placeholders || {}).sort();
    assert.deepStrictEqual(
      zhPlaceholders,
      enPlaceholders,
      'placeholder mismatch for key: ' + key
    );
  });

  Object.keys(enCatalog).forEach((key) => {
    assert.ok(Object.prototype.hasOwnProperty.call(zhCatalog, key), 'en catalog has extra key not in zh: ' + key);
  });

  // Chrome rejects the whole extension at load time when a message references
  // a $name$ placeholder that has no matching placeholders entry.
  [zhCatalog, enCatalog].forEach((catalog, index) => {
    const locale = index === 0 ? 'zh_CN' : 'en';
    Object.keys(catalog).forEach((key) => {
      const used = Array.from(String(catalog[key].message || '').matchAll(/\$([A-Za-z0-9_]+)\$/g), (m) => m[1]);
      const defined = catalog[key].placeholders || {};
      used.forEach((name) => {
        const hasPlaceholder = Object.keys(defined).some((candidate) => candidate.toLowerCase() === name.toLowerCase());
        assert.ok(hasPlaceholder, locale + ' message uses undefined placeholder $' + name + '$: ' + key);
      });
    });
  });

  ['extName', 'extDescription', 'shortcutDescription'].forEach((key) => {
    assert.ok(zhCatalog[key], 'manifest key missing from zh catalog: ' + key);
    assert.ok(enCatalog[key], 'manifest key missing from en catalog: ' + key);
  });
});

test('YilanI18n resolves catalog messages with substitutions', ['quality.i18n_catalog'], () => {
  freshRequire('shared/i18n.js');
  const i18n = global.YilanI18n;
  assert.ok(i18n && typeof i18n.get === 'function', 'YilanI18n global is missing');

  i18n.setCatalog(zhCatalog);
  assert.strictEqual(i18n.get('popup_idle_status'), '设置修改后会自动保存。');
  assert.strictEqual(i18n.get('popup_save_failed', 'boom'), '保存失败：boom');
  assert.strictEqual(i18n.get('popup_connected', ['gpt-test', '（x）']), '连接成功，当前模型：gpt-test（x）');
  assert.strictEqual(i18n.get('popup_not_a_real_key'), '');
  assert.strictEqual(i18n.get(''), '');
  assert.strictEqual(i18n.get('popup_models_loaded', [3]), '已加载 3 个模型。');

  i18n.setCatalog(enCatalog);
  assert.strictEqual(i18n.get('popup_idle_status'), 'Changes are saved automatically.');
  assert.strictEqual(i18n.get('popup_copy_suffix', ['Work']), 'Work copy');

  i18n.setCatalog(null);
  assert.strictEqual(i18n.get('popup_idle_status'), '');
});

test('YilanI18n uiLanguage override pins the interface language', ['quality.i18n_catalog'], () => {
  freshRequire('shared/i18n.js');
  const i18n = global.YilanI18n;

  i18n.setCatalog(zhCatalog);
  assert.strictEqual(i18n.getUILanguage(), '');

  i18n.setOverride('en', enCatalog);
  assert.strictEqual(i18n.get('popup_idle_status'), 'Changes are saved automatically.');
  assert.strictEqual(i18n.get('popup_idle_status') !== zhCatalog.popup_idle_status.message, true);
  assert.strictEqual(i18n.getUILanguage(), 'en');

  i18n.setOverride('zh', zhCatalog);
  assert.strictEqual(i18n.get('popup_idle_status'), '设置修改后会自动保存。');
  assert.strictEqual(i18n.getUILanguage(), 'zh');

  i18n.setOverride('auto', null);
  assert.strictEqual(i18n.get('popup_idle_status'), '设置修改后会自动保存。');
  assert.strictEqual(i18n.getUILanguage(), '');

  // An override whose catalog is missing must degrade fully to the browser
  // locale (which is unavailable in Node, so lookups resolve to nothing).
  i18n.setCatalog(null);
  i18n.setOverride('en', null);
  assert.strictEqual(i18n.getUILanguage(), '');
  assert.strictEqual(i18n.get('popup_idle_status'), '');
});

test('provider catalog presets, routes, and endpoint modes stay localized', ['quality.i18n_catalog'], () => {
  const catalog = freshRequire('shared/provider-catalog.generated.js');
  const routeKey = (routeId) => 'provider_route_' + String(routeId).replace(/-/g, '_');

  const required = [];
  for (const preset of catalog.listProviders()) {
    required.push('provider_preset_' + preset.id + '_label');
    if (preset.hint) required.push('provider_preset_' + preset.id + '_hint');
    for (const route of preset.routes || []) {
      required.push(routeKey(route.routeId) + '_label');
      if (route.hint) required.push(routeKey(route.routeId) + '_hint');
      if (route.keyHint) required.push(routeKey(route.routeId) + '_key_hint');
      if (route.keyRule && route.keyRule.message) required.push(routeKey(route.routeId) + '_key_rule');
    }
  }
  for (const [mode, meta] of Object.entries(catalog.ENDPOINT_MODE_META)) {
    required.push('provider_endpoint_mode_' + mode + '_label');
    if (meta.description) required.push('provider_endpoint_mode_' + mode + '_description');
  }

  assert.ok(required.length >= 100, 'unexpectedly small provider catalog key set: ' + required.length);
  [zhCatalog, enCatalog].forEach((catalogJson, index) => {
    const locale = index === 0 ? 'zh_CN' : 'en';
    required.forEach((key) => {
      const entry = catalogJson[key];
      assert.ok(
        entry && typeof entry.message === 'string' && entry.message.trim(),
        locale + ' catalog missing provider catalog key: ' + key
      );
    });
  });
});
