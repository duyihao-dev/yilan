(function initYilanSidebarReaderSession(global) {
  const ChromeApi = global.YilanChromeApi || (typeof require === 'function' ? require('../shared/chrome-api.js') : null);

  const getRuntimeErrorMessage = ChromeApi.getRuntimeErrorMessage;

  function createReaderSessionController(deps) {
    const getState = deps.getState;
    const getElements = deps.getElements;
    const getCurrentArticle = deps.getCurrentArticle;
    const getCurrentRecord = deps.getCurrentRecord;
    const createArticleFromRecord = deps.createArticleFromRecord;
    const buildReaderSnapshot = deps.buildReaderSnapshot;
    const runtimeSendMessage = deps.runtimeSendMessage;
    const setStatus = deps.setStatus;

    function createReaderSnapshot() {
      const state = getState();
      const elements = getElements();
      const article = getCurrentArticle() || createArticleFromRecord(getCurrentRecord());
      const record = getCurrentRecord() || {};
      return buildReaderSnapshot({
        article,
        record,
        summaryMarkdown: state?.summaryMarkdown || '',
        currentSummaryMode: elements.summaryModeSelect.value,
        generating: !!state?.generating,
        diagnostics: state?.lastDiagnostics || null
      });
    }

    async function openReaderTab() {
      const snapshot = createReaderSnapshot();
      if (!snapshot) {
        setStatus(global.YilanI18n.get('sidebar_reader_no_content'), 'warning');
        return;
      }

      const response = await runtimeSendMessage({
        action: 'openReaderTab',
        snapshot
      });

      if (response.success) {
        setStatus(global.YilanI18n.get('sidebar_reader_opened'), 'success');
        return;
      }

      setStatus(getRuntimeErrorMessage(response.error) || global.YilanI18n.get('sidebar_reader_open_failed'), 'error');
    }

    return {
      createReaderSnapshot,
      openReaderTab
    };
  }

  const api = {
    createReaderSessionController
  };

  global.YilanSidebarReaderSession = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);
