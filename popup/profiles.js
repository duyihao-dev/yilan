(function initYilanPopupProfiles(global) {
  function createProfilesController(deps) {
    const $ = deps.$;
    const I18n = deps.i18n;
    const ProviderPresets = deps.providerPresets;
    const storageGet = deps.storageGet;
    const storageSet = deps.storageSet;
    const storageRemove = deps.storageRemove;
    const collectSettings = deps.collectSettings;
    const applySettingsToForm = deps.applySettingsToForm;
    const persistSettings = deps.persistSettings;
    const setStatus = deps.setStatus;
    const setStatusDetails = deps.setStatusDetails;

  const PROFILES_INDEX_KEY = 'yilanProfilesIndexV1';
  const ACTIVE_PROFILE_ID_KEY = 'yilanActiveProfileIdV1';
  const PROFILE_KEY_PREFIX = 'yilanProfileV1:';

  const profileState = {
    activeId: '',
    index: []
  };

  function createProfileId() {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return 'prof_' + crypto.randomUUID();
      }
    } catch {}

    return 'prof_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function getProfileStorageKey(id) {
    const safeId = String(id || '').trim();
    return safeId ? PROFILE_KEY_PREFIX + safeId : '';
  }

  function normalizeProfilesIndex(value) {
    if (!Array.isArray(value)) return [];

    const output = [];
    const seen = new Set();
    value.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const id = String(item.id || '').trim();
      if (!id || seen.has(id)) return;
      seen.add(id);

      const name = String(item.name || '').trim() || I18n.get('popup_unnamed_profile');
      output.push({
        id,
        name,
        updatedAt: String(item.updatedAt || ''),
        lastUsedAt: String(item.lastUsedAt || ''),
        providerPreset: String(item.providerPreset || ''),
        aiProvider: String(item.aiProvider || '')
      });
    });

    return output;
  }

  function upsertProfilesIndexEntry(index, entry, options = {}) {
    const next = [];
    const id = String(entry?.id || '').trim();
    if (!id) return normalizeProfilesIndex(index);

    const allowReorder = options.prepend === true;
    let replaced = false;

    (index || []).forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const itemId = String(item.id || '').trim();
      if (!itemId) return;
      if (itemId === id) {
        next.push(Object.assign({}, item, entry));
        replaced = true;
      } else {
        next.push(item);
      }
    });

    if (!replaced) {
      if (allowReorder) next.unshift(entry);
      else next.push(entry);
    }

    return normalizeProfilesIndex(next);
  }

  function removeProfilesIndexEntry(index, id) {
    const targetId = String(id || '').trim();
    if (!targetId) return normalizeProfilesIndex(index);
    return normalizeProfilesIndex((index || []).filter((item) => String(item?.id || '').trim() !== targetId));
  }

  function findProfileIndexEntry(id) {
    const safeId = String(id || '').trim();
    if (!safeId) return null;
    return (profileState.index || []).find((entry) => entry && entry.id === safeId) || null;
  }

  function renderProfileSelector() {
    const select = $('profileSelect');
    if (!select) return;

    const activeId = profileState.activeId || '';
    select.innerHTML = '';

    const unboundOption = document.createElement('option');
    unboundOption.value = '';
    unboundOption.textContent = I18n.get('popup_profile_unbound_option');
    select.appendChild(unboundOption);

    (profileState.index || []).forEach((entry) => {
      const option = document.createElement('option');
      option.value = entry.id;

      const presetLabel = ProviderPresets?.getPreset?.(entry.providerPreset)?.label || entry.providerPreset || 'custom';
      option.textContent = entry.name + ' · ' + presetLabel;

      select.appendChild(option);
    });

    select.value = activeId;
    renderProfileHint();
  }

  function renderProfileHint() {
    const hint = $('profileHint');
    if (!hint) return;

    const activeId = profileState.activeId || '';
    const activeEntry = findProfileIndexEntry(activeId);

    hint.textContent = activeId && activeEntry
      ? I18n.get('popup_profile_bound_hint', [activeEntry.name])
      : I18n.get('popup_profile_hint_default');

    const renameBtn = $('profileRenameBtn');
    const deleteBtn = $('profileDeleteBtn');
    if (renameBtn) renameBtn.disabled = !activeId;
    if (deleteBtn) deleteBtn.disabled = !activeId;
  }

  async function updateProfilesStorage(index, activeId) {
    const payload = {
      [PROFILES_INDEX_KEY]: normalizeProfilesIndex(index)
    };
    if (typeof activeId !== 'undefined') {
      payload[ACTIVE_PROFILE_ID_KEY] = String(activeId || '').trim();
    }
    await storageSet(payload);
  }

  async function activateProfile(profileId) {
    const id = String(profileId || '').trim();
    const select = $('profileSelect');

    if (!id) {
      profileState.activeId = '';
      await updateProfilesStorage(profileState.index, '');
      renderProfileSelector();
      setStatus(I18n.get('popup_switched_to_unbound'), 'success');
      setStatusDetails('');
      return;
    }

    const key = getProfileStorageKey(id);
    if (!key) return;

    const items = await storageGet([key]);
    const profileSettings = items?.[key] && typeof items[key] === 'object' ? items[key] : null;
    if (!profileSettings) {
      if (select) select.value = profileState.activeId || '';
      setStatus(I18n.get('popup_profile_not_found'), 'error');
      return;
    }

    applySettingsToForm(profileSettings);
    await persistSettings({ force: true, silentStatus: true, skipSuccessStatus: true });

    profileState.activeId = id;
    const now = new Date().toISOString();
    profileState.index = upsertProfilesIndexEntry(profileState.index, Object.assign({}, findProfileIndexEntry(id) || { id, name: I18n.get('popup_unnamed_profile') }, {
      id,
      lastUsedAt: now,
      providerPreset: profileSettings.providerPreset || '',
      aiProvider: profileSettings.aiProvider || ''
    }));

    await updateProfilesStorage(profileState.index, id);
    renderProfileSelector();
    setStatus(I18n.get('popup_profile_switched'), 'success');
    setStatusDetails('');
  }

  async function createOrCloneProfile(name, settings, options = {}) {
    const safeName = String(name || '').trim();
    if (!safeName) return null;

    const payloadSettings = Object.assign({}, settings || {});
    const id = createProfileId();
    const now = new Date().toISOString();
    const key = getProfileStorageKey(id);
    if (!key) return null;

    const entry = {
      id,
      name: safeName,
      updatedAt: now,
      lastUsedAt: now,
      providerPreset: payloadSettings.providerPreset || '',
      aiProvider: payloadSettings.aiProvider || ''
    };

    const nextIndex = upsertProfilesIndexEntry(profileState.index, entry, { prepend: true });
    const nextActiveId = options.activate === false ? (profileState.activeId || '') : id;

    await storageSet(Object.assign({
      [key]: payloadSettings,
      [PROFILES_INDEX_KEY]: nextIndex,
      [ACTIVE_PROFILE_ID_KEY]: nextActiveId
    }, options.writeSettings !== false ? payloadSettings : {}));

    profileState.index = nextIndex;
    profileState.activeId = nextActiveId;
    renderProfileSelector();
    return id;
  }

  function bindProfileControls() {
    const select = $('profileSelect');
    const actionsBtn = $('profileActionsBtn');
    const actionsMenu = $('profileActionsMenu');
    let actionsMenuOpen = false;

    function setActionsMenuOpen(nextOpen) {
      if (!actionsBtn || !actionsMenu) return;
      actionsMenuOpen = !!nextOpen;
      actionsMenu.hidden = !actionsMenuOpen;
      actionsBtn.setAttribute('aria-expanded', actionsMenuOpen ? 'true' : 'false');
    }

    if (actionsBtn && actionsMenu) {
      setActionsMenuOpen(false);

      actionsBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setActionsMenuOpen(!actionsMenuOpen);
      });

      actionsMenu.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (!target.closest('button')) return;
        setActionsMenuOpen(false);
      });

      document.addEventListener('click', (event) => {
        if (!actionsMenuOpen) return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (actionsBtn.contains(target) || actionsMenu.contains(target)) return;
        setActionsMenuOpen(false);
      });

      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (!actionsMenuOpen) return;
        setActionsMenuOpen(false);
        actionsBtn.focus();
      });
    }

    if (select) {
      select.addEventListener('change', () => {
        setActionsMenuOpen(false);
        activateProfile(select.value).catch((error) => {
          setStatus(I18n.get('popup_switch_profile_failed', [String(error?.message || error || I18n.get('popup_unknown_error'))]), 'error');
          setStatusDetails('');
        });
      });
    }

    const newBtn = $('profileNewBtn');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        setActionsMenuOpen(false);
        const name = String(window.prompt(I18n.get('popup_prompt_new_profile'), '') || '').trim();
        if (!name) return;
        createOrCloneProfile(name, collectSettings(), { activate: true, writeSettings: true })
          .then(() => {
            setStatus(I18n.get('popup_profile_created', [name]), 'success');
            setStatusDetails('');
          })
          .catch((error) => {
            setStatus(I18n.get('popup_create_profile_failed', [String(error?.message || error || I18n.get('popup_unknown_error'))]), 'error');
            setStatusDetails('');
          });
      });
    }

    const saveAsBtn = $('profileSaveAsBtn');
    if (saveAsBtn) {
      saveAsBtn.addEventListener('click', () => {
        setActionsMenuOpen(false);
        const baseName = findProfileIndexEntry(profileState.activeId)?.name || I18n.get('popup_default_profile_name');
        const name = String(window.prompt(I18n.get('popup_prompt_save_as'), I18n.get('popup_copy_suffix', [baseName])) || '').trim();
        if (!name) return;
        createOrCloneProfile(name, collectSettings(), { activate: true, writeSettings: true })
          .then(() => {
            setStatus(I18n.get('popup_profile_saved_as', [name]), 'success');
            setStatusDetails('');
          })
          .catch((error) => {
            setStatus(I18n.get('popup_save_as_failed', [String(error?.message || error || I18n.get('popup_unknown_error'))]), 'error');
            setStatusDetails('');
          });
      });
    }

    const renameBtn = $('profileRenameBtn');
    if (renameBtn) {
      renameBtn.addEventListener('click', () => {
        setActionsMenuOpen(false);
        const activeId = profileState.activeId || '';
        const entry = findProfileIndexEntry(activeId);
        if (!activeId || !entry) return;

        const nextName = String(window.prompt(I18n.get('popup_prompt_rename'), entry.name) || '').trim();
        if (!nextName || nextName === entry.name) return;

        const nextIndex = upsertProfilesIndexEntry(profileState.index, Object.assign({}, entry, { name: nextName }));
        updateProfilesStorage(nextIndex, activeId)
          .then(() => {
            profileState.index = nextIndex;
            renderProfileSelector();
            setStatus(I18n.get('popup_profile_renamed'), 'success');
            setStatusDetails('');
          })
          .catch((error) => {
            setStatus(I18n.get('popup_rename_failed', [String(error?.message || error || I18n.get('popup_unknown_error'))]), 'error');
            setStatusDetails('');
          });
      });
    }

    const deleteBtn = $('profileDeleteBtn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        setActionsMenuOpen(false);
        const activeId = profileState.activeId || '';
        const entry = findProfileIndexEntry(activeId);
        if (!activeId || !entry) return;
        if (!window.confirm(I18n.get('popup_confirm_delete', [entry.name]))) return;

        const key = getProfileStorageKey(activeId);
        const nextIndex = removeProfilesIndexEntry(profileState.index, activeId);

        Promise.resolve()
          .then(() => (key ? storageRemove([key]) : null))
          .then(() => updateProfilesStorage(nextIndex, ''))
          .then(() => {
            profileState.index = nextIndex;
            profileState.activeId = '';
            renderProfileSelector();
            setStatus(I18n.get('popup_profile_deleted'), 'success');
            setStatusDetails('');
          })
          .catch((error) => {
            setStatus(I18n.get('popup_delete_failed', [String(error?.message || error || I18n.get('popup_unknown_error'))]), 'error');
            setStatusDetails('');
          });
      });
    }
  }


    return {
      PROFILES_INDEX_KEY,
      ACTIVE_PROFILE_ID_KEY,
      PROFILE_KEY_PREFIX,
      profileState,
      createProfileId,
      getProfileStorageKey,
      normalizeProfilesIndex,
      upsertProfilesIndexEntry,
      removeProfilesIndexEntry,
      findProfileIndexEntry,
      renderProfileSelector,
      renderProfileHint,
      updateProfilesStorage,
      activateProfile,
      createOrCloneProfile,
      bindProfileControls
    };
  }

  const api = {
    createProfilesController
  };

  global.YilanPopupProfiles = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);
