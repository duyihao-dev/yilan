(function initYilanPopupThemeControls(global) {
  function createThemeControlsController(deps) {
    const $ = deps.$;
    const Theme = deps.theme;
    const I18n = deps.i18n;

  const THEME_PREFERENCE_LABELS = {
    system: I18n.get('popup_theme_system'),
    light: I18n.get('popup_theme_light'),
    dark: I18n.get('popup_theme_dark')
  };

  const THEME_EFFECTIVE_LABELS = {
    light: I18n.get('popup_theme_effective_light'),
    dark: I18n.get('popup_theme_effective_dark')
  };

  const THEME_PALETTE_LABELS = {
    jade: I18n.get('popup_palette_jade'),
    slate: I18n.get('popup_palette_slate'),
    copper: I18n.get('popup_palette_copper'),
    plum: I18n.get('popup_palette_plum')
  };

  const THEME_PALETTE_HINTS = {
    jade: I18n.get('popup_palette_hint_jade'),
    slate: I18n.get('popup_palette_hint_slate'),
    copper: I18n.get('popup_palette_hint_copper'),
    plum: I18n.get('popup_palette_hint_plum')
  };

  function renderThemeHint(preference, theme) {
    const normalizedPreference = Theme.normalizePreference(preference);
    const effectiveTheme = Theme.resolveTheme(normalizedPreference || theme);
    const preferenceLabel = THEME_PREFERENCE_LABELS[normalizedPreference] || THEME_PREFERENCE_LABELS.system;
    const effectiveLabel = THEME_EFFECTIVE_LABELS[effectiveTheme] || THEME_EFFECTIVE_LABELS.light;

    $('themeHint').textContent = normalizedPreference === 'system'
      ? I18n.get('popup_theme_hint_system', [preferenceLabel, effectiveLabel])
      : I18n.get('popup_theme_hint_fixed', [preferenceLabel, effectiveLabel]);
  }

  function syncThemePreferenceControl(preference, options = {}) {
    const result = Theme.applyPreference(preference, { force: options.force !== false });
    const field = $('themePreference');
    if (field) {
      field.value = result.preference;
    }
    renderThemeHint(result.preference, result.theme);
    return result;
  }

  function renderPaletteHint(palette) {
    const normalizedPalette = Theme.normalizePalette(palette);
    const label = THEME_PALETTE_LABELS[normalizedPalette] || THEME_PALETTE_LABELS.jade;
    const hint = THEME_PALETTE_HINTS[normalizedPalette] || THEME_PALETTE_HINTS.jade;
    const hintNode = $('paletteHint');
    if (!hintNode) return;

    hintNode.textContent = I18n.get('popup_palette_hint_render', [label, hint]);
  }

  function setPaletteControlState(palette) {
    const normalizedPalette = Theme.normalizePalette(palette);
    const field = $('themePalette');
    if (field) {
      field.value = normalizedPalette;
    }

    document.querySelectorAll('[data-palette-option]').forEach((button) => {
      const isSelected = button.dataset.paletteOption === normalizedPalette;
      button.classList.toggle('active', isSelected);
      button.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });

    renderPaletteHint(normalizedPalette);
  }

  function syncThemePaletteControl(palette, options = {}) {
    const result = Theme.applyPalette(palette, { force: options.force !== false });
    setPaletteControlState(result.palette);
    return result;
  }


    return {
      renderThemeHint,
      syncThemePreferenceControl,
      renderPaletteHint,
      setPaletteControlState,
      syncThemePaletteControl
    };
  }

  const api = {
    createThemeControlsController
  };

  global.YilanPopupThemeControls = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);
