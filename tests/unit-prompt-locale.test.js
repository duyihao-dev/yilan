const {
  test,
  assert,
  freshRequire
} = require('./harness');

const Strings = freshRequire('shared/strings.js');
const ArticleUtils = freshRequire('shared/article-utils.js');

const SAMPLE_ARTICLE = {
  title: 'Sample Article',
  subtitle: '',
  sourceType: 'news',
  cleanText: 'Sample body text for the prompt.',
  chunkCount: 1
};

test('prompt locale chain follows target language, then UI locale, then Chinese', ['prompt.locale'], () => {
  assert.strictEqual(Strings.pickPromptLocale('en', 'zh'), 'en');
  assert.strictEqual(Strings.pickPromptLocale('zh', 'en'), 'zh');
  assert.strictEqual(Strings.pickPromptLocale('auto', 'en'), 'en');
  assert.strictEqual(Strings.pickPromptLocale(undefined, 'en'), 'en');
  assert.strictEqual(Strings.pickPromptLocale('ja', 'en'), 'en');
  assert.strictEqual(Strings.pickPromptLocale('ja', 'zh'), 'zh');
  assert.strictEqual(Strings.pickPromptLocale('auto', ''), 'zh');
  assert.strictEqual(Strings.pickPromptLocale('auto', 'fr'), 'zh');
});

test('prompt catalogs stay in parity across locales', ['prompt.locale'], () => {
  const zh = Strings.getPromptCatalog('zh');
  const en = Strings.getPromptCatalog('en');

  assert.deepStrictEqual(Object.keys(en.modes).sort(), Object.keys(zh.modes).sort());
  Object.keys(zh.modes).forEach((key) => {
    assert.ok(en.modes[key].prompt.trim(), 'en mode prompt is empty: ' + key);
    assert.ok(en.modes[key].formatHint.trim(), 'en mode formatHint is empty: ' + key);
  });
  assert.deepStrictEqual(Object.keys(en.glue).sort(), Object.keys(zh.glue).sort());
  Object.keys(zh.glue).forEach((key) => {
    assert.ok(String(en.glue[key]).trim(), 'en glue entry is empty: ' + key);
  });
  assert.ok(en.markdownRules.trim(), 'en markdownRules is empty');
});

test('primary prompt stays Chinese by default and localizes with the UI locale', ['prompt.locale'], () => {
  const zhPrompt = ArticleUtils.buildPrimaryPrompt({
    article: SAMPLE_ARTICLE,
    summaryMode: 'medium'
  });
  assert.ok(zhPrompt.includes('# 正文'), 'default prompt should use the zh content header');
  assert.ok(zhPrompt.includes('# 页面上下文'), 'default prompt should use the zh context header');

  const enPrompt = ArticleUtils.buildPrimaryPrompt({
    article: SAMPLE_ARTICLE,
    summaryMode: 'medium',
    uiLocale: 'en'
  });
  assert.ok(enPrompt.includes('# Article content'), 'en prompt should use the en content header');
  assert.ok(enPrompt.includes('# Page context'), 'en prompt should use the en context header');
  assert.ok(enPrompt.includes('## Core takeaway'), 'en prompt should use the en format hint skeleton');
  assert.ok(!enPrompt.includes('# 正文'), 'en prompt should not leak the zh content header');
});

test('explicit output language overrides the UI locale for prompt copy', ['prompt.locale'], () => {
  const zhPrompt = ArticleUtils.buildPrimaryPrompt({
    article: SAMPLE_ARTICLE,
    summaryMode: 'medium',
    uiLocale: 'en',
    targetLanguage: 'zh'
  });
  assert.ok(zhPrompt.includes('# 正文'), 'targetLanguage=zh must win over the en UI locale');
  assert.ok(zhPrompt.includes('请使用中文输出。'), 'language instruction should stay for zh');

  const mixedPrompt = ArticleUtils.buildPrimaryPrompt({
    article: SAMPLE_ARTICLE,
    summaryMode: 'medium',
    uiLocale: 'en',
    targetLanguage: 'ja'
  });
  assert.ok(mixedPrompt.includes('# Article content'), 'unsupported output language falls back to the UI locale catalog');
  assert.ok(mixedPrompt.includes('日本語で出力してください。'), 'language instruction should carry the ja output request');
});

test('chunk, synthesis, and secondary prompts localize strategy focus copy', ['prompt.locale'], () => {
  const chunkPrompt = ArticleUtils.buildChunkPrompt({
    article: SAMPLE_ARTICLE,
    chunk: { index: 0, content: 'chunk body' },
    summaryMode: 'medium',
    uiLocale: 'en'
  });
  assert.ok(chunkPrompt.includes('Page strategy: News brief'), 'en chunk prompt should use the en strategy label');
  assert.ok(chunkPrompt.includes('# Current chunk content'), 'en chunk prompt should use the en chunk header');

  const synthesisPrompt = ArticleUtils.buildSynthesisPrompt({
    article: SAMPLE_ARTICLE,
    partialSummaries: ['part one'],
    summaryMode: 'medium',
    uiLocale: 'en'
  });
  assert.ok(synthesisPrompt.includes('# Chunk summaries'), 'en synthesis prompt should use the en chunk summaries header');
  assert.ok(synthesisPrompt.includes('## Chunk 1'), 'en synthesis prompt should label chunks in English');

  const secondaryPrompt = ArticleUtils.buildSecondaryPrompt({
    article: SAMPLE_ARTICLE,
    summaryMode: 'action_items',
    summaryMarkdown: 'original summary',
    uiLocale: 'en'
  });
  assert.ok(secondaryPrompt.includes('# Original summary'), 'en secondary prompt should use the en raw summary header');
  assert.ok(secondaryPrompt.includes('## Do now'), 'en secondary prompt should use the en action items skeleton');
});
