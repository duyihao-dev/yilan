(function (global) {
  const Domain = global.AISummaryDomain || (typeof require === 'function' ? require('./domain.js') : null);
  const Strings = global.AISummaryStrings || (typeof require === 'function' ? require('./strings.js') : null);
  const PageStrategy = global.AISummaryPageStrategy || (typeof require === 'function' ? require('./page-strategy.js') : null);

  const DEFAULT_MAX_CAPTURE_CHARS = 28000;
  const DEFAULT_CHUNK_SIZE = 3600;
  const DEFAULT_MIN_CHUNK_SIZE = 1400;

  function readMetaContent(doc, selectors) {
    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (!element) continue;
      const content = element.getAttribute('content') || element.textContent || '';
      if (String(content).trim()) {
        return String(content).trim();
      }
    }
    return '';
  }

  function splitLargeParagraph(paragraph, maxChars) {
    const sentences = paragraph.split(/(?<=[。！？.!?])\s+/);
    if (sentences.length <= 1) {
      const parts = [];
      let index = 0;
      while (index < paragraph.length) {
        parts.push(paragraph.slice(index, index + maxChars));
        index += maxChars;
      }
      return parts;
    }

    const output = [];
    let current = '';
    for (const sentence of sentences) {
      const candidate = current ? `${current} ${sentence}` : sentence;
      if (candidate.length > maxChars && current) {
        output.push(current.trim());
        current = sentence;
      } else {
        current = candidate;
      }
    }
    if (current.trim()) {
      output.push(current.trim());
    }
    return output;
  }

  function splitTextIntoChunks(text, options) {
    const normalized = Domain.normalizeWhitespace(text || '');
    if (!normalized) return [];

    const maxChars = options?.maxChars || DEFAULT_CHUNK_SIZE;
    const minChunkChars = options?.minChunkChars || DEFAULT_MIN_CHUNK_SIZE;
    const paragraphs = normalized
      .split(/\n\n+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .flatMap((paragraph) => (paragraph.length > maxChars ? splitLargeParagraph(paragraph, maxChars) : [paragraph]));

    const chunks = [];
    let buffer = [];
    let size = 0;

    function flush() {
      if (!buffer.length) return;
      const content = buffer.join('\n\n').trim();
      chunks.push({
        chunkId: Domain.createRuntimeId('chunk'),
        index: chunks.length,
        content,
        charLength: content.length
      });
      buffer = [];
      size = 0;
    }

    for (const paragraph of paragraphs) {
      const candidateSize = size ? size + paragraph.length + 2 : paragraph.length;
      if (candidateSize > maxChars && size >= minChunkChars) {
        flush();
      }
      buffer.push(paragraph);
      size = size ? size + paragraph.length + 2 : paragraph.length;
    }

    flush();

    return chunks.length ? chunks : [{
      chunkId: Domain.createRuntimeId('chunk'),
      index: 0,
      content: normalized,
      charLength: normalized.length
    }];
  }

  function computeWarnings(snapshot) {
    const warnings = [];
    if (!snapshot.title) warnings.push('missing_title');
    if (!snapshot.cleanText) warnings.push('empty_content');
    if (snapshot.cleanText && snapshot.cleanText.length < 200) warnings.push('very_short_content');
    if (snapshot.isTruncated) warnings.push('content_truncated');
    return warnings;
  }

  function computeQualityScore(snapshot) {
    let score = 100;
    if (!snapshot.title) score -= 10;
    if (!snapshot.cleanText) score -= 60;
    if (snapshot.cleanText.length < 500) score -= 20;
    if (snapshot.isTruncated) score -= 15;
    if (snapshot.sourceType === 'unknown') score -= 5;
    return Math.max(0, score);
  }

  function buildStrategyHints(article) {
    const strategy = article?.sourceStrategy || PageStrategy.resolveStrategy({ sourceType: article?.sourceType });
    return [
      `页面类型: ${(Strings.SITE_TYPE_LABELS[article?.sourceType] || article?.sourceType || '通用网页')}`,
      `页面策略: ${strategy.label}`,
      `策略说明: ${strategy.description}`,
      `来源站点: ${article?.siteName || article?.sourceHost || '未知'}`,
      article?.author ? `作者: ${article.author}` : '',
      article?.publishedAt ? `发布时间: ${article.publishedAt}` : ''
    ].filter(Boolean).join('\n');
  }

  function buildArticleSnapshot(input) {
    const sourceUrl = input.sourceUrl || '';
    const canonicalUrl = input.meta?.canonicalUrl || '';
    const normalizedUrl = Domain.normalizeUrl(canonicalUrl || sourceUrl);
    const sourceHost = Domain.getSourceHost(normalizedUrl || sourceUrl);
    const rawText = Domain.normalizeWhitespace(input.text || '');
    const captureLimit = input.maxChars || DEFAULT_MAX_CAPTURE_CHARS;

    let cleanText = rawText;
    let isTruncated = false;
    let truncationReason = '';
    if (cleanText.length > captureLimit) {
      cleanText = cleanText.slice(0, captureLimit);
      isTruncated = true;
      truncationReason = `capture_limit_${captureLimit}`;
    }
    cleanText = Domain.normalizeWhitespace(cleanText);

    const title = Domain.pickFirstNonEmpty([
      input.title,
      input.meta?.ogTitle,
      input.meta?.htmlTitle,
      sourceHost,
      '未命名页面'
    ]);
    const language = Domain.pickFirstNonEmpty([
      input.meta?.language,
      Domain.inferLanguage(cleanText, 'zh')
    ]);
    const sourceType = input.sourceType || Domain.detectSiteType({
      url: normalizedUrl || sourceUrl,
      host: sourceHost,
      title,
      text: cleanText
    });
    const sourceStrategy = PageStrategy.resolveStrategy({
      sourceType,
      url: normalizedUrl || sourceUrl,
      host: sourceHost,
      title,
      text: cleanText
    });

    const contentHash = Domain.hashString(cleanText);
    const articleId = Domain.createDeterministicId('art', `${normalizedUrl}|${contentHash}`);
    const chunks = splitTextIntoChunks(cleanText, {
      maxChars: sourceStrategy.chunkMaxChars || DEFAULT_CHUNK_SIZE,
      minChunkChars: sourceStrategy.minChunkChars || DEFAULT_MIN_CHUNK_SIZE
    });

    const snapshot = {
      articleId,
      canonicalUrl,
      normalizedUrl,
      sourceUrl,
      sourceHost,
      sourceType,
      sourceStrategy,
      sourceStrategyId: sourceStrategy.strategyId,
      preferredSummaryMode: sourceStrategy.preferredSummaryMode || 'medium',
      title,
      subtitle: input.meta?.description || '',
      author: input.meta?.author || '',
      siteName: input.meta?.siteName || sourceHost,
      publishedAt: Domain.toIsoString(input.meta?.publishedAt),
      language,
      rawText,
      cleanText,
      content: cleanText,
      excerpt: input.excerpt || '',
      contentHash,
      extractor: input.extractor || 'body_fallback',
      extractedAt: new Date().toISOString(),
      contentLength: cleanText.length,
      isTruncated,
      truncationReason,
      chunkingStrategy: chunks.length > 1 ? (sourceStrategy.chunkingMode || 'paragraph_split') : 'none',
      chunkCount: chunks.length,
      chunks,
      allowHistory: true,
      allowShare: true,
      retentionHint: 'persistent',
      diagnostics: Object.assign({
        rawLength: rawText.length,
        captureLimit,
        sourceType,
        sourceStrategyId: sourceStrategy.strategyId,
        strategyLabel: sourceStrategy.label,
        chunkMaxChars: sourceStrategy.chunkMaxChars,
        minChunkChars: sourceStrategy.minChunkChars
      }, input.diagnostics || {})
    };

    snapshot.warnings = computeWarnings(snapshot);
    snapshot.qualityScore = computeQualityScore(snapshot);
    return snapshot;
  }

  function buildLanguageInstruction(targetLanguage) {
    if (!targetLanguage || targetLanguage === 'auto') return '';
    const map = {
      zh: '请使用中文输出。',
      en: 'Please answer in English.',
      ja: '日本語で出力してください。',
      ko: '한국어로 출력해 주세요.',
      fr: 'Veuillez répondre en français.'
    };
    return map[targetLanguage] || `请使用 ${targetLanguage} 输出。`;
  }

  // Prompt locale chain: explicit target language (zh/en) wins, then the UI
  // locale, then Chinese. Other output languages keep the zh/en prompt body
  // plus the language instruction line above.
  function resolvePromptLocale(targetLanguage, uiLocale) {
    const ui = uiLocale
      || (global.YilanI18n && typeof global.YilanI18n.getUILanguage === 'function' ? global.YilanI18n.getUILanguage() : '')
      || 'zh';
    return Strings.pickPromptLocale(targetLanguage, ui);
  }

  function resolvePromptStrategy(article, locale) {
    if (locale === 'en') {
      return PageStrategy.resolveStrategy({ sourceType: article?.sourceType, locale: 'en' });
    }
    return article?.sourceStrategy || PageStrategy.resolveStrategy({ sourceType: article?.sourceType });
  }

  function buildMarkdownOutputGuidance(mode, options) {
    const includeTemplate = options?.includeTemplate !== false;
    const glue = options?.glue || Strings.getPromptCatalog('zh').glue;
    return [
      glue.markdownGuidanceTitle,
      options?.markdownRules || '',
      includeTemplate && mode?.formatHint ? glue.templateTitle + '\n' + mode.formatHint : ''
    ].filter(Boolean).join('\n\n');
  }

  function buildChunkOutputGuidance(glue) {
    const g = glue || Strings.getPromptCatalog('zh').glue;
    return [g.chunkGuidanceTitle].concat(g.chunkGuidanceLines).join('\n');
  }

  function buildPrimaryPrompt(options) {
    const locale = resolvePromptLocale(options.targetLanguage, options.uiLocale);
    const catalog = Strings.getPromptCatalog(locale);
    const glue = catalog.glue;
    const modeKey = options.summaryMode || 'medium';
    const mode = catalog.modes[modeKey] || catalog.modes.medium;
    const article = options.article;
    const strategy = resolvePromptStrategy(article, locale);
    const languageInstruction = buildLanguageInstruction(options.targetLanguage);

    return [
      mode.prompt,
      languageInstruction,
      buildMarkdownOutputGuidance(mode, { glue, markdownRules: catalog.markdownRules }),
      glue.primaryKeep,
      strategy.promptFocus,
      glue.contextTitle + '\n' + buildStrategyHints(article),
      `${glue.titleHeader}\n${article.title}`,
      article.subtitle ? `${glue.subtitleHeader}\n${article.subtitle}` : '',
      `${glue.contentHeader}\n` + (article.cleanText || article.content || '')
    ].filter(Boolean).join('\n\n');
  }

  function buildChunkPrompt(options) {
    const locale = resolvePromptLocale(options.targetLanguage, options.uiLocale);
    const catalog = Strings.getPromptCatalog(locale);
    const glue = catalog.glue;
    const modeKey = options.summaryMode || 'medium';
    const mode = catalog.modes[modeKey] || catalog.modes.medium;
    const article = options.article;
    const chunk = options.chunk;
    const strategy = resolvePromptStrategy(article, locale);
    const languageInstruction = buildLanguageInstruction(options.targetLanguage);

    return [
      glue.chunkIntro,
      mode.prompt,
      languageInstruction,
      buildChunkOutputGuidance(glue),
      strategy.chunkPromptFocus,
      glue.chunkKeep,
      `${glue.strategyLabel}: ${strategy.label}`,
      `${glue.currentChunk}: ${chunk.index + 1}/${article.chunkCount}`,
      `${glue.articleTitle}: ${article.title}`,
      `${glue.chunkContentHeader}\n` + chunk.content
    ].filter(Boolean).join('\n\n');
  }

  function buildSynthesisPrompt(options) {
    const locale = resolvePromptLocale(options.targetLanguage, options.uiLocale);
    const catalog = Strings.getPromptCatalog(locale);
    const glue = catalog.glue;
    const modeKey = options.summaryMode || 'medium';
    const mode = catalog.modes[modeKey] || catalog.modes.medium;
    const article = options.article;
    const strategy = resolvePromptStrategy(article, locale);
    const languageInstruction = buildLanguageInstruction(options.targetLanguage);
    const partialSummaries = options.partialSummaries || [];

    return [
      glue.synthesisIntro,
      mode.prompt,
      languageInstruction,
      buildMarkdownOutputGuidance(mode, { glue, markdownRules: catalog.markdownRules }),
      strategy.synthesisPromptFocus,
      glue.synthesisDedupe,
      `${glue.strategyLabel}: ${strategy.label}`,
      `${glue.articleTitle}: ${article.title}`,
      `${glue.chunksSection}\n` + partialSummaries.map((item, index) => `## ${glue.chunkSection} ${index + 1}\n${item}`).join('\n\n')
    ].join('\n\n');
  }

  function buildSecondaryPrompt(options) {
    const locale = resolvePromptLocale(options.targetLanguage, options.uiLocale);
    const catalog = Strings.getPromptCatalog(locale);
    const glue = catalog.glue;
    const modeKey = options.summaryMode || 'action_items';
    const mode = catalog.modes[modeKey] || catalog.modes.action_items;
    const article = options.article || {};
    const strategy = resolvePromptStrategy(article, locale);
    const languageInstruction = buildLanguageInstruction(options.targetLanguage);

    return [
      glue.secondaryIntro,
      mode.prompt,
      languageInstruction,
      buildMarkdownOutputGuidance(mode, { glue, markdownRules: catalog.markdownRules }),
      strategy.secondaryPromptFocus,
      article.title ? `${glue.articleTitle}: ${article.title}` : '',
      article.sourceHost ? `${glue.sourceSite}: ${article.sourceHost}` : '',
      strategy.label ? `${glue.strategyLabel}: ${strategy.label}` : '',
      `${glue.rawSummarySection}\n` + (options.summaryMarkdown || '')
    ].filter(Boolean).join('\n\n');
  }

  function getSummaryModeOptions() {
    return Object.entries(Strings.SUMMARY_MODES).map(([value, config]) => ({
      value,
      label: config.label,
      description: config.description
    }));
  }

  const api = {
    DEFAULT_MAX_CAPTURE_CHARS,
    readMetaContent,
    splitTextIntoChunks,
    buildArticleSnapshot,
    buildPrimaryPrompt,
    buildChunkPrompt,
    buildSynthesisPrompt,
    buildSecondaryPrompt,
    getSummaryModeOptions
  };

  global.AISummaryArticle = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);
