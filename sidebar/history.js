(function (global) {
  const I18n = () => global.YilanI18n;

  const SEARCH_DEBOUNCE_MS = 250;

  function createHistoryController(deps) {
    const elements = deps.elements;
    const state = deps.state;
    const recordStore = deps.recordStore;
    const renderPlaceholder = deps.renderPlaceholder;
    const bindVisibleRecord = deps.bindVisibleRecord;
    const refreshActionStates = deps.refreshActionStates;
    const setStatus = deps.setStatus;
    const closeDiagnostics = deps.closeDiagnostics;
    const formatDateTime = deps.formatDateTime;
    const escapeHtml = deps.escapeHtml;
    const buildHistoryItemView = deps.buildHistoryItemView;
    const buildHistoryGroupView = deps.buildHistoryGroupView;

    let searchTimer = null;
    let refreshSeq = 0;

    function reportHistoryError(error, fallbackMessage) {
      const message = String(error?.message || error || fallbackMessage || I18n().get('sidebar_action_failed'));
      console.error('[Yilan] History action failed.', error);
      if (typeof setStatus === 'function') {
        setStatus(message, 'error');
      }
    }

    function renderEmpty(message) {
      elements.historySiteFilters.innerHTML = '';
      elements.historyList.innerHTML = '<div class="history-empty">' + escapeHtml(message) + '</div>';
    }

    function createSiteChip(label, count, active, onClick, title) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'history-site-chip' + (active ? ' active' : '');
      if (title) button.title = title;

      const text = document.createElement('span');
      text.textContent = label;

      const countBadge = document.createElement('span');
      countBadge.className = 'history-site-chip-count';
      countBadge.textContent = String(count);

      button.appendChild(text);
      button.appendChild(countBadge);
      button.addEventListener('click', onClick);
      return button;
    }

    function renderSiteFilters(buckets, totalCount) {
      const fragment = document.createDocumentFragment();

      const allChip = createSiteChip(
        I18n().get('sidebar_all_sites'),
        totalCount,
        !state.selectedSiteHost,
        () => {
          if (!state.selectedSiteHost) return;
          state.selectedSiteHost = '';
          refresh().catch(console.error);
        },
        I18n().get('sidebar_all_sites_title')
      );
      fragment.appendChild(allChip);

      buckets.forEach((bucket) => {
        const tip = [
          bucket.host,
          I18n().get('sidebar_site_record_count', [bucket.count]),
          bucket.favoriteCount ? I18n().get('sidebar_site_favorite_count', [bucket.favoriteCount]) : '',
          bucket.latestUpdatedAt ? I18n().get('sidebar_site_last_updated', [formatDateTime(bucket.latestUpdatedAt)]) : ''
        ].filter(Boolean).join(' · ');

        const chip = createSiteChip(
          bucket.host,
          bucket.count,
          state.selectedSiteHost === bucket.host,
          () => {
            if (state.selectedSiteHost === bucket.host) return;
            state.selectedSiteHost = bucket.host;
            refresh().catch(console.error);
          },
          tip
        );

        fragment.appendChild(chip);
      });

      elements.historySiteFilters.replaceChildren(fragment);
    }

    function createItemElement(item) {
      const view = buildHistoryItemView(item);
      const container = document.createElement('div');
      container.className = 'history-item';

      const header = document.createElement('div');
      header.className = 'history-item-header';

      const title = document.createElement('div');
      title.className = 'history-item-title';
      title.textContent = view.title;

      const meta = document.createElement('div');
      meta.className = 'history-meta';
      meta.textContent = view.meta;

      const preview = document.createElement('div');
      preview.className = 'history-preview';
      preview.textContent = view.preview;

      const footer = document.createElement('div');
      footer.className = 'history-item-footer';

      const tags = document.createElement('div');
      tags.className = 'history-tags';
      view.badges.forEach((value) => {
        const tag = document.createElement('span');
        tag.className = 'badge';
        tag.textContent = value;
        tags.appendChild(tag);
      });

      const actions = document.createElement('div');
      actions.className = 'history-tags';

      const favoriteBtn = document.createElement('button');
      favoriteBtn.className = 'history-mini-btn';
      favoriteBtn.textContent = item.favorite ? I18n().get('sidebar_remove_favorite') : I18n().get('sidebar_favorite');
      favoriteBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        try {
          const updated = await recordStore.toggleFavorite(item.recordId);
          if (state.visibleRecord?.recordId === updated?.recordId) {
            bindVisibleRecord(updated, { preserveCurrentArticle: state.visibleRecordUsesCurrentArticle });
          }
          await refresh();
        } catch (error) {
          reportHistoryError(error, I18n().get('sidebar_favorite_update_failed'));
        }
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'history-mini-btn';
      deleteBtn.textContent = I18n().get('sidebar_delete');
      deleteBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        try {
          await recordStore.deleteRecord(item.recordId);
          if (state.visibleRecord?.recordId === item.recordId) {
            state.visibleRecord = null;
            state.visibleRecordUsesCurrentArticle = false;
            state.summaryMarkdown = '';
            renderPlaceholder(I18n().get('sidebar_record_deleted_title'), I18n().get('sidebar_record_deleted_body'));
          }
          await refresh();
          refreshActionStates();
        } catch (error) {
          reportHistoryError(error, I18n().get('sidebar_record_delete_failed'));
        }
      });

      actions.appendChild(favoriteBtn);
      actions.appendChild(deleteBtn);

      header.appendChild(title);
      footer.appendChild(tags);
      footer.appendChild(actions);

      container.appendChild(header);
      container.appendChild(meta);
      container.appendChild(preview);
      container.appendChild(footer);
      container.addEventListener('click', () => {
        bindVisibleRecord(item);
        close();
      });

      return container;
    }

    async function refresh() {
      const seq = ++refreshSeq;
      const items = await recordStore.searchRecords(state.historyQuery, { favoritesOnly: state.favoritesOnly });

      // Drop stale responses: only the latest refresh may paint the panel.
      if (seq !== refreshSeq) return;

      if (!items.length) {
        renderEmpty(I18n().get('sidebar_history_empty'));
        return;
      }

      const siteBuckets = recordStore.buildSiteBuckets(items);
      if (state.selectedSiteHost && !siteBuckets.some((bucket) => bucket.host === state.selectedSiteHost)) {
        state.selectedSiteHost = '';
      }

      renderSiteFilters(siteBuckets, items.length);

      const filteredItems = recordStore.filterRecordsBySite(items, state.selectedSiteHost);
      const siteGroups = recordStore.groupRecordsBySite(filteredItems);

      // Build the whole list off-DOM and paint once to avoid layout thrash.
      const fragment = document.createDocumentFragment();

      siteGroups.forEach((group) => {
        const groupView = buildHistoryGroupView(group, { selected: !!state.selectedSiteHost });
        const section = document.createElement('section');
        section.className = 'history-site-group';

        const header = document.createElement('div');
        header.className = 'history-site-group-header';

        const titleWrap = document.createElement('div');
        titleWrap.className = 'history-site-group-title';

        const title = document.createElement('strong');
        title.textContent = groupView.title;

        const meta = document.createElement('div');
        meta.className = 'history-site-group-meta';
        meta.textContent = groupView.meta;

        const badge = document.createElement('span');
        badge.className = 'badge badge-soft';
        badge.textContent = groupView.badge;

        titleWrap.appendChild(title);
        titleWrap.appendChild(meta);
        header.appendChild(titleWrap);
        header.appendChild(badge);

        const list = document.createElement('div');
        list.className = 'history-site-group-list';
        group.records.forEach((item) => {
          list.appendChild(createItemElement(item));
        });

        section.appendChild(header);
        section.appendChild(list);
        fragment.appendChild(section);
      });

      elements.historyList.replaceChildren(fragment);
    }

    function open() {
      if (typeof closeDiagnostics === 'function') {
        closeDiagnostics();
      }
      elements.historyPanel.classList.remove('hidden');
      refresh().catch((error) => {
        elements.historySiteFilters.innerHTML = '';
        elements.historyList.innerHTML = '<div class="history-empty">' + escapeHtml(I18n().get('sidebar_history_load_failed') + String(error?.message || error || 'unknown')) + '</div>';
      });
    }

    function close() {
      if (searchTimer) {
        clearTimeout(searchTimer);
        searchTimer = null;
      }
      elements.historyPanel.classList.add('hidden');
    }

    function isOpen() {
      return !elements.historyPanel.classList.contains('hidden');
    }

    elements.historyCloseBtn.addEventListener('click', close);
    elements.historySearch.addEventListener('input', () => {
      state.historyQuery = elements.historySearch.value || '';
      // Debounce keystrokes so each key does not trigger a full IndexedDB scan.
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        searchTimer = null;
        refresh().catch((error) => {
          reportHistoryError(error, I18n().get('sidebar_history_refresh_failed'));
        });
      }, SEARCH_DEBOUNCE_MS);
    });
    elements.favoritesOnly.addEventListener('change', () => {
      state.favoritesOnly = !!elements.favoritesOnly.checked;
      refresh().catch((error) => {
        reportHistoryError(error, I18n().get('sidebar_history_refresh_failed'));
      });
    });

    return {
      open,
      close,
      refresh,
      isOpen
    };
  }

  const api = {
    createHistoryController
  };

  global.YilanSidebarHistory = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
