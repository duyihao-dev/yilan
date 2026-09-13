const recordStore = window.db;
const UiFormat = window.AISummaryUiFormat;
const UiLabels = window.AISummaryUiLabels;
const ReaderView = window.AISummaryReaderView;
const Constants = window.AISummaryConstants;
const ChromeApi = window.YilanChromeApi;
const I18n = window.YilanI18n;

const READER_SESSION_PREFIX = Constants.READER_SESSION_PREFIX;

const $ = (id) => document.getElementById(id);

const storageLocalGet = ChromeApi.storageLocalGet;

function setStatus(text, tone) {
  const node = $('statusLine');
  node.textContent = text || '';
  node.className = 'status-line' + (tone ? ' ' + tone : '');
}

const escapeHtml = UiFormat.escapeHtml;
const normalizeExternalUrl = ReaderView.normalizeExternalUrl;
const mergeSnapshotWithRecord = ReaderView.mergeSnapshotWithRecord;

let readerTocScrollHandler = null;
let readerTocFrame = 0;
let readerTocLinks = [];
let readerHeaderHeight = null;

function getStatusLabel(status) {
  return UiLabels.getRecordStatusLabel(status, { variant: 'reader', fallback: I18n.get('label_status_completed') });
}

function estimateReadMinutes(text) {
  const plain = String(text || '').trim();
  if (!plain) return I18n.get('reader_read_minutes_short');
  const minutes = Math.max(1, Math.round(plain.length / 500));
  return I18n.get('reader_read_minutes', [minutes]);
}

function buildBadge(label, tone) {
  return `<span class="badge${tone ? ' ' + tone : ''}">${escapeHtml(label)}</span>`;
}

function buildDetail(label, value) {
  return `<span class="detail-pill">${escapeHtml(label)}<strong>${escapeHtml(value)}</strong></span>`;
}

function parseSessionId() {
  const url = new URL(window.location.href);
  return String(url.searchParams.get('session') || '').trim();
}

async function loadReaderSnapshot() {
  const sessionId = parseSessionId();
  if (!sessionId) {
    throw new Error(I18n.get('reader_error_no_session'));
  }

  const storageKey = READER_SESSION_PREFIX + sessionId;
  const items = await storageLocalGet(storageKey);
  const snapshot = items?.[storageKey]?.snapshot || null;
  if (!snapshot) {
    throw new Error(I18n.get('reader_error_expired_session'));
  }

  if (snapshot.recordId && snapshot.allowHistory !== false) {
    try {
      const record = await recordStore.getRecordById(snapshot.recordId);
      if (record) {
        return mergeSnapshotWithRecord(snapshot, record);
      }
    } catch (error) {
      // Fall back to the passed snapshot when DB lookup fails.
    }
  }

  return snapshot;
}

function renderEmpty(title, detail) {
  $('readerLayout').classList.add('hidden');
  $('readerHero').classList.add('hidden');
  $('readerContent').classList.add('hidden');
  $('readerDiagnostics').classList.add('hidden');
  clearReaderToc();
  $('emptyTitle').textContent = title;
  $('emptyDetail').textContent = detail;
  $('emptyState').classList.remove('hidden');
}

function renderReader(snapshot) {
  document.title = `${snapshot.title || I18n.get('reader_default_title')} - 一览`;

  $('emptyState').classList.add('hidden');
  $('readerLayout').classList.remove('hidden');
  $('readerHero').classList.remove('hidden');
  $('readerContent').classList.remove('hidden');

  $('readerTitle').textContent = snapshot.title || I18n.get('sidebar_unnamed_page');

  const sourceUrl = normalizeExternalUrl(snapshot.sourceUrl);
  const sourceLink = $('readerSourceLink');
  sourceLink.href = sourceUrl || '#';
  sourceLink.textContent = sourceUrl || I18n.get('reader_no_source_link');
  sourceLink.setAttribute('aria-disabled', sourceUrl ? 'false' : 'true');
  sourceLink.tabIndex = sourceUrl ? 0 : -1;
  sourceLink.classList.toggle('is-disabled', !sourceUrl);

  const openSourceBtn = $('openSourceBtn');
  openSourceBtn.href = sourceUrl || '#';
  openSourceBtn.setAttribute('aria-disabled', sourceUrl ? 'false' : 'true');
  openSourceBtn.tabIndex = sourceUrl ? 0 : -1;
  openSourceBtn.classList.toggle('is-disabled', !sourceUrl);

  $('badgeRow').innerHTML = [
    snapshot.sourceHost ? buildBadge(snapshot.sourceHost) : '',
    snapshot.sourceTypeLabel ? buildBadge(snapshot.sourceTypeLabel) : '',
    snapshot.strategyLabel ? buildBadge(snapshot.strategyLabel) : '',
    snapshot.summaryModeLabel ? buildBadge(snapshot.summaryModeLabel, 'accent') : '',
    snapshot.privacyMode ? buildBadge(I18n.get('reader_badge_private')) : '',
    snapshot.favorite ? buildBadge(I18n.get('reader_badge_favorited')) : ''
  ].filter(Boolean).join('');

  $('detailRow').innerHTML = [
    buildDetail(I18n.get('reader_detail_status'), getStatusLabel(snapshot.status)),
    buildDetail(I18n.get('reader_detail_reading'), estimateReadMinutes(snapshot.summaryPlainText || snapshot.summaryMarkdown || '')),
    snapshot.author ? buildDetail(I18n.get('sidebar_meta_author'), snapshot.author) : '',
    snapshot.completedAtLabel && snapshot.completedAtLabel !== I18n.get('popup_not_recorded') ? buildDetail(I18n.get('reader_detail_generated_at'), snapshot.completedAtLabel) : '',
    // snapshot.providerLabel ? buildDetail('模型供应商', snapshot.providerLabel) : '',
    snapshot.model ? buildDetail(I18n.get('reader_detail_model'), snapshot.model) : ''
  ].filter(Boolean).join('');

  $('summaryArticle').dataset.markdown = snapshot.summaryMarkdown || '';
  renderSanitizedMarkdownFragment($('summaryArticle'), snapshot.summaryMarkdown || '');
  initializeReaderToc($('summaryArticle'));

  const diagnosticsBlock = $('readerDiagnostics');
  const diagnosticsPre = $('diagnosticsPre');
  if (snapshot.diagnostics) {
    diagnosticsPre.textContent = JSON.stringify(snapshot.diagnostics, null, 2);
    diagnosticsBlock.classList.remove('hidden');
  } else {
    diagnosticsBlock.classList.add('hidden');
  }

  setStatus(snapshot.allowHistory === false ? I18n.get('reader_temp_view_status') : I18n.get('reader_ready_status'));
}

async function copyMarkdown() {
  const content = $('summaryArticle').dataset.markdown || '';
  if (!content) return;

  await navigator.clipboard.writeText(content);
  setStatus(I18n.get('reader_copied'), 'success');
}

const MARKDOWN_SANITIZE_OPTIONS = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['class', 'target', 'rel', 'align']
};

function renderSanitizedMarkdownFragment(container, markdown) {
  const fragment = DOMPurify.sanitize(marked.parse(markdown || ''), {
    ...MARKDOWN_SANITIZE_OPTIONS,
    RETURN_DOM_FRAGMENT: true
  });
  container.replaceChildren(fragment);
}

function clearReaderToc() {
  const toc = $('readerToc');
  const tocList = $('readerTocList');
  readerTocLinks = [];

  if (readerTocScrollHandler) {
    window.removeEventListener('scroll', readerTocScrollHandler);
    readerTocScrollHandler = null;
  }

  if (readerTocFrame) {
    cancelAnimationFrame(readerTocFrame);
    readerTocFrame = 0;
  }

  if (tocList) {
    tocList.replaceChildren();
  }

  if (toc) {
    toc.classList.add('hidden');
  }
}

function getHeadingLevel(heading) {
  return Number(String(heading.tagName || '').replace(/^H/i, '')) || 2;
}

function resolveHeadingId(heading, index, usedIds) {
  const currentId = String(heading.id || '').trim();
  const currentOwner = currentId ? document.getElementById(currentId) : null;
  if (currentId && !usedIds.has(currentId) && (!currentOwner || currentOwner === heading)) {
    usedIds.add(currentId);
    return currentId;
  }

  let serial = index + 1;
  let id = `reader-section-${serial}`;
  while (usedIds.has(id)) {
    serial += 1;
    id = `reader-section-${serial}`;
  }

  heading.id = id;
  usedIds.add(id);
  return id;
}

function collectReaderHeadings(container) {
  const usedIds = new Set();
  return Array.from(container.querySelectorAll('h1, h2, h3, h4'))
    .map((heading, index) => {
      const label = String(heading.textContent || '').replace(/\s+/g, ' ').trim();
      if (!label) return null;
      return {
        id: resolveHeadingId(heading, index, usedIds),
        label,
        level: getHeadingLevel(heading),
        node: heading
      };
    })
    .filter(Boolean);
}

function setActiveTocLink(id) {
  // Uses the cached link list captured when the TOC was built, so scroll
  // frames do not re-query the DOM.
  readerTocLinks.forEach((link) => {
    const active = link.dataset.targetId === id;
    link.classList.toggle('active', active);
    if (active) {
      link.setAttribute('aria-current', 'true');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

function getReaderActivationLine() {
  // The header height comes from a static CSS var; read it once instead of
  // forcing getComputedStyle on every scroll frame.
  if (readerHeaderHeight === null) {
    const rawValue = getComputedStyle(/** @type {any} */ (document.documentElement)).getPropertyValue('--reader-header-height');
    readerHeaderHeight = Number.parseFloat(rawValue) || 64;
  }
  return readerHeaderHeight + Math.min(360, Math.max(180, window.innerHeight * 0.28));
}

function syncActiveTocLink(headings) {
  if (!headings.length) return;

  const activationLine = getReaderActivationLine();
  let activeHeading = headings[0];
  headings.forEach((heading) => {
    if (heading.node.getBoundingClientRect().top <= activationLine) {
      activeHeading = heading;
    }
  });
  setActiveTocLink(activeHeading.id);
}

function initializeReaderToc(container) {
  clearReaderToc();

  const toc = $('readerToc');
  const tocList = $('readerTocList');
  const headings = collectReaderHeadings(container);
  if (!toc || !tocList || headings.length < 2) {
    return;
  }

  headings.forEach((heading) => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    item.className = 'reader-toc-item';
    link.className = `reader-toc-link level-${Math.min(Math.max(heading.level, 1), 4)}`;
    link.href = '#' + heading.id;
    link.dataset.targetId = heading.id;
    link.textContent = heading.label;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      heading.node.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start'
      });
      history.replaceState(null, '', '#' + encodeURIComponent(heading.id));
      setActiveTocLink(heading.id);
    });
    item.append(link);
    tocList.appendChild(/** @type {any} */ (item));
  });
  readerTocLinks = Array.from(tocList.querySelectorAll('.reader-toc-link'));

  toc.classList.remove('hidden');
  readerTocScrollHandler = () => {
    if (readerTocFrame) return;
    readerTocFrame = requestAnimationFrame(() => {
      readerTocFrame = 0;
      syncActiveTocLink(headings);
    });
  };
  window.addEventListener('scroll', readerTocScrollHandler, { passive: true });
  syncActiveTocLink(headings);
}

function initializeReaderChromeState() {
  const syncChromeState = () => {
    document.body.classList.toggle('reader-is-scrolled', window.scrollY > 8);
  };

  window.addEventListener('scroll', syncChromeState, { passive: true });
  syncChromeState();
}

window.addEventListener('DOMContentLoaded', async () => {
  marked.setOptions({
    breaks: true,
    gfm: true,
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    }
  });

  try {
    const snapshot = await loadReaderSnapshot();
    renderReader(snapshot);
  } catch (error) {
    renderEmpty(I18n.get('reader_error_title'), String(error?.message || error || I18n.get('reader_unknown_error')));
  }

  $('copyBtn').addEventListener('click', () => {
    copyMarkdown().catch((error) => {
      setStatus(String(error?.message || error || I18n.get('reader_copy_failed')), 'error');
    });
  });

  initializeReaderChromeState();
});
