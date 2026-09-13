const { test, assert, freshRequire } = require('./harness');

const PROFILES_INDEX_KEY = 'yilanProfilesIndexV1';
const ACTIVE_PROFILE_ID_KEY = 'yilanActiveProfileIdV1';
const PROFILE_KEY_PREFIX = 'yilanProfileV1:';

function setupProfileController() {
  const storage = new Map();
  let formState = {};

  const controller = freshRequire('popup/profiles.js').createProfilesController({
    $: () => null,
    i18n: { get: (key) => key },
    providerPresets: { getPreset: () => null },
    storageGet: async (keys) => {
      const items = {};
      keys.forEach((key) => {
        if (storage.has(key)) items[key] = storage.get(key);
      });
      return items;
    },
    storageSet: async (payload) => {
      Object.keys(payload).forEach((key) => storage.set(key, payload[key]));
    },
    storageRemove: async (keys) => {
      keys.forEach((key) => storage.delete(key));
    },
    collectSettings: () => Object.assign({}, formState),
    applySettingsToForm: (settings) => {
      formState = Object.assign({}, settings);
    },
    // Mirrors popup.js persistSettings: the form content goes to the main settings
    // keys plus the slot of whatever profile is active while it runs.
    persistSettings: async (options = {}) => {
      const payload = Object.assign({}, formState);
      const activeProfileId = String(controller.profileState.activeId || '').trim();
      if (activeProfileId && !options.skipProfileSync) {
        payload[PROFILE_KEY_PREFIX + activeProfileId] = Object.assign({}, formState);
      }
      Object.keys(payload).forEach((key) => storage.set(key, payload[key]));
    },
    setStatus: () => {},
    setStatusDetails: () => {}
  });

  return { controller, storage, setForm: (settings) => { formState = Object.assign({}, settings); } };
}

test('switching profiles does not overwrite the previous profile payload', async () => {
  const { controller, storage, setForm } = setupProfileController();

  const profileA = { apiKey: 'key-a', modelName: 'model-a', providerPreset: 'preset-a' };
  const profileB = { apiKey: 'key-b', modelName: 'model-b', providerPreset: 'preset-b' };

  storage.set(PROFILE_KEY_PREFIX + 'prof_a', Object.assign({}, profileA));
  storage.set(PROFILE_KEY_PREFIX + 'prof_b', Object.assign({}, profileB));
  storage.set(PROFILES_INDEX_KEY, [
    { id: 'prof_a', name: 'A' },
    { id: 'prof_b', name: 'B' }
  ]);

  controller.profileState.index = [
    { id: 'prof_a', name: 'A' },
    { id: 'prof_b', name: 'B' }
  ];
  controller.profileState.activeId = 'prof_a';
  setForm(Object.assign({}, profileA));

  await controller.activateProfile('prof_b');

  assert.equal(storage.get(PROFILE_KEY_PREFIX + 'prof_a').apiKey, 'key-a');
  assert.equal(storage.get(PROFILE_KEY_PREFIX + 'prof_a').modelName, 'model-a');
  assert.equal(storage.get(PROFILE_KEY_PREFIX + 'prof_b').apiKey, 'key-b');
  assert.equal(storage.get('apiKey'), 'key-b');
  assert.equal(controller.profileState.activeId, 'prof_b');
  assert.equal(storage.get(ACTIVE_PROFILE_ID_KEY), 'prof_b');

  await controller.activateProfile('prof_a');

  assert.equal(storage.get(PROFILE_KEY_PREFIX + 'prof_b').apiKey, 'key-b');
  assert.equal(storage.get(PROFILE_KEY_PREFIX + 'prof_b').modelName, 'model-b');
  assert.equal(storage.get('apiKey'), 'key-a');
  assert.equal(controller.profileState.activeId, 'prof_a');
});

test('switching to an unbound state keeps profile payloads untouched', async () => {
  const { controller, storage, setForm } = setupProfileController();

  storage.set(PROFILE_KEY_PREFIX + 'prof_a', { apiKey: 'key-a', modelName: 'model-a' });
  controller.profileState.index = [{ id: 'prof_a', name: 'A' }];
  controller.profileState.activeId = 'prof_a';
  setForm({ apiKey: 'key-a', modelName: 'model-a' });

  await controller.activateProfile('');

  assert.equal(storage.get(PROFILE_KEY_PREFIX + 'prof_a').apiKey, 'key-a');
  assert.equal(controller.profileState.activeId, '');
  assert.equal(storage.get(ACTIVE_PROFILE_ID_KEY), '');
});
