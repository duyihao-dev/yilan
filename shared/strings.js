(function (global) {
  const MARKDOWN_OUTPUT_RULES = [
    '请遵守以下 Markdown 输出要求：',
    '- 只输出 Markdown 正文，不要写“下面是总结”之类的前言或解释。',
    '- 不要把整篇答案包在 ```markdown``` 或其他代码块里。',
    '- 不要重复文章标题作为一级标题，优先从二级标题开始组织。',
    '- 优先使用简洁的标题和列表；每个列表项尽量只表达一个信息点。',
    '- 每个段落尽量控制在 1-2 句，避免形成大段文字墙。',
    '- 信息不足时宁可省略，也不要编造、外推或补全原文没有明确给出的事实。',
    '- 除非这个模式确实需要，否则不要使用表格；优先使用标题和列表。'
  ].join('\n');

  const SUMMARY_MODES = {
    short: {
      label: '简短总结',
      description: '适合快速扫读，输出 3-5 个重点。',
      prompt: '请将以下网页压缩成一份适合 30 秒内扫完的摘要，先给出一句话结论，再列出最值得记住的 3-5 个要点。优先保留结论、关键事实、数字、对象和判断，不要展开成大段分析。',
      formatHint: [
        '## 一句话结论',
        '用 1 句话概括全文最核心的信息。',
        '',
        '## 关键要点',
        '- 输出 3-5 条高信息密度要点。'
      ].join('\n')
    },
    medium: {
      label: '标准总结',
      description: '兼顾完整性与可读性。',
      prompt: '请输出一份兼顾完整性与可读性的结构化总结，覆盖主题、关键信息、论证或事实依据、最终结论和值得关注的细节。',
      formatHint: [
        '## 核心结论',
        '用 1-2 句概括全文主题与主要结论。',
        '',
        '## 关键信息',
        '- 归纳核心事实、观点、论据或步骤。',
        '',
        '## 值得关注',
        '- 提炼风险、限制、启发或后续观察点。'
      ].join('\n')
    },
    long: {
      label: '详细分析',
      description: '适合深入理解长文。',
      prompt: '请对以下网页做一份适合深入阅读和回顾的详细分析，说明背景、结构脉络、关键观点或步骤、重要事实或数据、结论与启发。',
      formatHint: [
        '## 背景与主题',
        '## 关键内容拆解',
        '## 重要事实 / 数据',
        '## 结论与启发'
      ].join('\n')
    },
    key_points: {
      label: '关键要点',
      description: '提取最值得记住的信息。',
      prompt: '请只提炼最值得记住和复用的高价值信息，宁少勿杂。优先保留结论、风险、反常识点、可迁移经验和关键判断。',
      formatHint: [
        '## 最重要的要点',
        '- 输出 5-8 条高价值要点。',
        '',
        '## 风险与提醒',
        '- 只有存在明确风险、限制或前提时再写。'
      ].join('\n')
    },
    action_items: {
      label: '行动项',
      description: '转成可执行清单。',
      prompt: '请把内容转成可直接执行的行动清单。每项都要明确动作、对象或产出；如果有前置依赖、优先级、风险，也一起点明。',
      formatHint: [
        '## 可立即执行',
        '1. 每项以动词开头，写清动作和产出。',
        '',
        '## 后续跟进',
        '1. 列出需要后续推进、观察或补充的信息。',
        '',
        '## 风险与注意事项',
        '- 只保留真正影响执行的限制或风险。'
      ].join('\n')
    },
    glossary: {
      label: '术语表',
      description: '整理概念与术语。',
      prompt: '请整理成便于速查的术语卡，不要用大表格，优先用短列表。每个术语都要包含简明定义和它在本文中的意义。',
      formatHint: [
        '## 核心术语',
        '- 术语：简明定义。补一句它在本文中的作用或上下文。',
        '',
        '## 易混点',
        '- 只有存在容易混淆的概念时再写。'
      ].join('\n')
    },
    qa: {
      label: '问答卡片',
      description: '转成便于复习的 Q&A。',
      prompt: '请整理成便于复习和转发的问答卡片。问题要短、答案要准，覆盖文章最重要的概念、结论、限制和细节。',
      formatHint: [
        '## Q1. 问题',
        'A: 用 1-3 句回答。',
        '',
        '## Q2. 问题',
        'A: 继续补充关键卡片，避免重复。'
      ].join('\n')
    }
  };

  const SECONDARY_MODE_KEYS = ['action_items', 'glossary', 'qa'];

  const SITE_TYPE_LABELS = {
    unknown: '通用网页',
    news: '新闻',
    blog: '博客',
    doc: '文档',
    forum: '社区问答',
    repo: '代码仓库',
    video: '视频'
  };

  const STATUS_TEXT = {
    idle: '就绪',
    loadingArticle: '正在提取网页内容...',
    generating: '正在生成总结...',
    chunking: '正在分段分析长文...',
    finalizing: '正在汇总最终结果...',
    cancelled: '已取消生成',
    completed: '生成完成',
    failed: '生成失败'
  };

  // Prompt bodies are prompt engineering, not UI copy: only ship locales with
  // reviewed templates (zh is the original; en is the reviewed translation).
  // Output for other target languages is still handled by the explicit
  // language instruction line appended in article-utils.
  const PROMPT_GLUE_ZH = {
    markdownGuidanceTitle: '# 输出格式要求',
    templateTitle: '# 推荐输出骨架',
    chunkGuidanceTitle: '# 分段输出要求',
    chunkGuidanceLines: [
      '请把当前分段压缩成便于后续汇总的中间结果。',
      '- 只保留当前分段中最重要的信息，不要补全其它分段内容。',
      '- 优先使用 3-6 条简洁要点；只有在确有必要时再加 1-2 个小标题。',
      '- 如果当前分段主要是背景、过渡或例子，请用更短篇幅概括，不要硬凑结构。',
      '- 不要重复文章标题，不要写前言，不要把整篇答案包在代码块里。'
    ],
    primaryKeep: '请尽量保留文章的结构和关键事实，避免空泛表述。',
    chunkIntro: '你正在帮助总结一篇长网页，这是其中一个分段。',
    chunkKeep: '请只总结当前分段，并保留该分段中最关键的信息，避免重复其它分段可能出现的背景信息。',
    synthesisIntro: '以下是同一篇长网页分段总结后的结果，请把它们合成为一份完整、去重、结构清晰的最终总结。',
    synthesisDedupe: '请消除重复，补齐上下文，并确保最终输出像直接总结整篇文章一样自然。',
    secondaryIntro: '以下是网页原始摘要，请基于摘要内容进行二次加工。必要时可参考文章标题和来源。',
    contextTitle: '# 页面上下文',
    titleHeader: '# 标题',
    subtitleHeader: '# 摘要说明',
    contentHeader: '# 正文',
    chunkContentHeader: '# 当前分段正文',
    strategyLabel: '页面策略',
    currentChunk: '当前分段',
    articleTitle: '文章标题',
    sourceSite: '来源站点',
    chunkSection: '分段',
    chunksSection: '# 分段总结',
    rawSummarySection: '# 原始摘要'
  };

  const PROMPT_GLUE_EN = {
    markdownGuidanceTitle: '# Output format requirements',
    templateTitle: '# Suggested outline',
    chunkGuidanceTitle: '# Chunk output requirements',
    chunkGuidanceLines: [
      'Compress the current chunk into an intermediate result that is easy to consolidate later.',
      '- Keep only the most important information in this chunk; do not fill in content belonging to other chunks.',
      '- Prefer 3-6 concise bullets; add 1-2 small headings only when truly necessary.',
      '- If the chunk is mostly background, transitions, or examples, summarize it more briefly instead of forcing the structure.',
      '- Do not repeat the article title, do not write a preamble, and do not wrap the whole answer in a code block.'
    ],
    primaryKeep: "Preserve the article's structure and key facts; avoid vague filler.",
    chunkIntro: 'You are helping summarize a long web page. This is one chunk of it.',
    chunkKeep: 'Summarize only this chunk and keep its most critical information; do not repeat background that other chunks may already cover.',
    synthesisIntro: 'Below are the chunk summaries of the same long web page. Consolidate them into one complete, deduplicated, clearly structured final summary.',
    synthesisDedupe: 'Remove duplication, restore missing context, and make the final output read as naturally as a direct summary of the whole article.',
    secondaryIntro: "Below is the page's original summary. Rework it based on that content; refer to the article title and source when helpful.",
    contextTitle: '# Page context',
    titleHeader: '# Title',
    subtitleHeader: '# Summary note',
    contentHeader: '# Article content',
    chunkContentHeader: '# Current chunk content',
    strategyLabel: 'Page strategy',
    currentChunk: 'Current chunk',
    articleTitle: 'Article title',
    sourceSite: 'Source site',
    chunkSection: 'Chunk',
    chunksSection: '# Chunk summaries',
    rawSummarySection: '# Original summary'
  };

  const SUMMARY_MODES_EN = {
    short: {
      prompt: 'Compress the following web page into a summary readable in 30 seconds: start with a one-sentence takeaway, then list the 3-5 most memorable points. Prioritize conclusions, key facts, numbers, actors, and judgments; do not expand into extended analysis.',
      formatHint: [
        '## One-sentence takeaway',
        'Capture the core of the article in 1 sentence.',
        '',
        '## Key points',
        '- Output 3-5 high-density points.'
      ].join('\n')
    },
    medium: {
      prompt: 'Produce a structured summary that balances completeness and readability, covering the topic, key information, evidence or factual basis, final conclusions, and noteworthy details.',
      formatHint: [
        '## Core takeaway',
        'Summarize the topic and main conclusion in 1-2 sentences.',
        '',
        '## Key information',
        '- Consolidate core facts, viewpoints, evidence, or steps.',
        '',
        '## Worth noting',
        '- Extract risks, limitations, insights, or follow-up watchpoints.'
      ].join('\n')
    },
    long: {
      prompt: 'Write a detailed analysis of the following web page suitable for in-depth reading and later review, explaining the background, structure, key viewpoints or steps, important facts or data, conclusions, and implications.',
      formatHint: [
        '## Background & topic',
        '## Key content breakdown',
        '## Important facts / data',
        '## Conclusions & implications'
      ].join('\n')
    },
    key_points: {
      prompt: 'Extract only the highest-value, most reusable information; prefer fewer, denser points. Prioritize conclusions, risks, counterintuitive findings, transferable lessons, and key judgments.',
      formatHint: [
        '## Most important points',
        '- Output 5-8 high-value points.',
        '',
        '## Risks & caveats',
        '- Include only when there are explicit risks, limitations, or preconditions.'
      ].join('\n')
    },
    action_items: {
      prompt: 'Turn the content into a directly executable action list. Each item must state the action and its target or deliverable; flag prerequisites, priorities, and risks where relevant.',
      formatHint: [
        '## Do now',
        '1. Start each item with a verb; be specific about the action and the deliverable.',
        '',
        '## Follow-up',
        '1. List items that need later follow-up, observation, or additional information.',
        '',
        '## Risks & caveats',
        '- Keep only limitations or risks that genuinely affect execution.'
      ].join('\n')
    },
    glossary: {
      prompt: 'Organize the content into quick-reference term cards; avoid large tables and prefer short lists. Each term needs a concise definition plus its meaning within this article.',
      formatHint: [
        '## Key terms',
        '- Term: concise definition. Add one line on its role or context in this article.',
        '',
        '## Easily confused',
        '- Include only when genuinely confusable concepts exist.'
      ].join('\n')
    },
    qa: {
      prompt: "Organize the content into Q&A cards suited for review and sharing. Keep questions short and answers precise, covering the article's most important concepts, conclusions, limitations, and details.",
      formatHint: [
        '## Q1. Question',
        'A: Answer in 1-3 sentences.',
        '',
        '## Q2. Question',
        'A: Continue with the key cards; avoid repetition.'
      ].join('\n')
    }
  };

  const PROMPT_CATALOGS = {
    zh: {
      markdownRules: MARKDOWN_OUTPUT_RULES,
      modes: SUMMARY_MODES,
      glue: PROMPT_GLUE_ZH
    },
    en: {
      markdownRules: [
        'Follow these Markdown output rules:',
        '- Output Markdown body only; do not write preambles such as "Here is a summary" or any explanation.',
        '- Do not wrap the whole answer in ```markdown``` or any other code block.',
        '- Do not repeat the article title as an H1; organize from H2 headings.',
        '- Prefer concise headings and lists; each list item should convey one point.',
        '- Keep paragraphs to 1-2 sentences; avoid walls of text.',
        '- When information is insufficient, omit it rather than inventing, extrapolating, or completing facts the source does not state.',
        '- Avoid tables unless the mode truly needs them; prefer headings and lists.'
      ].join('\n'),
      modes: SUMMARY_MODES_EN,
      glue: PROMPT_GLUE_EN
    }
  };

  const PROMPT_LOCALES = ['zh', 'en'];

  function pickPromptLocale(targetLanguage, uiLocale) {
    if (targetLanguage === 'zh' || targetLanguage === 'en') return targetLanguage;
    if (uiLocale === 'en') return 'en';
    return 'zh';
  }

  function getPromptCatalog(locale) {
    return PROMPT_CATALOGS[locale] || PROMPT_CATALOGS.zh;
  }

  const api = {
    MARKDOWN_OUTPUT_RULES,
    SUMMARY_MODES,
    SECONDARY_MODE_KEYS,
    SITE_TYPE_LABELS,
    STATUS_TEXT,
    PROMPT_LOCALES,
    pickPromptLocale,
    getPromptCatalog
  };

  global.AISummaryStrings = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);
