(function (global) {
  const SITE_STRATEGIES = {
    unknown: {
      strategyId: 'general_reader',
      label: '通用精读',
      description: '平衡提炼结构、关键事实、核心结论与后续价值。',
      promptFocus: '请优先提炼页面结构、关键事实、核心结论与可复用信息。',
      chunkPromptFocus: '请只保留当前分段的核心信息、事实和结论，避免跨段推测。',
      synthesisPromptFocus: '请把分段结果整合成一份结构清晰、适合快速回看的总结。',
      secondaryPromptFocus: '二次生成时请严格基于已有摘要，不补充摘要中不存在的事实。',
      preferredSummaryMode: 'medium',
      chunkMaxChars: 3600,
      minChunkChars: 1200,
      chunkingMode: 'paragraph_split'
    },
    news: {
      strategyId: 'news_briefing',
      label: '新闻速读',
      description: '优先时间线、事件主体、关键事实、直接影响与未决问题。',
      promptFocus: '请优先整理事件背景、关键时间线、涉及主体、重要事实、直接影响和后续观察点，避免无依据推测。',
      chunkPromptFocus: '请只总结当前分段中的事实、引用、时间点和影响，不要外推。',
      synthesisPromptFocus: '请整合成一份适合快速了解事件的简报，按背景、事实、影响、待观察问题组织。',
      secondaryPromptFocus: '二次生成时请把事实转成更便于复盘或执行的形式，但不要改变事实边界。',
      preferredSummaryMode: 'short',
      chunkMaxChars: 3800,
      minChunkChars: 1200,
      chunkingMode: 'timeline_split'
    },
    blog: {
      strategyId: 'blog_insight',
      label: '博客洞察',
      description: '优先作者观点、论证逻辑、案例与可迁移经验。',
      promptFocus: '请提炼作者的核心观点、论证过程、案例支撑、经验总结与适用边界。',
      chunkPromptFocus: '请抓住当前分段中的观点、论据、案例和作者判断。',
      synthesisPromptFocus: '请整合成一份有逻辑层次的观点总结，保留主要论证链路和启发。',
      secondaryPromptFocus: '二次生成时优先提炼方法、启发和适用条件。',
      preferredSummaryMode: 'medium',
      chunkMaxChars: 3600,
      minChunkChars: 1200,
      chunkingMode: 'paragraph_split'
    },
    doc: {
      strategyId: 'doc_reference',
      label: '文档精读',
      description: '优先目标、前置条件、步骤、接口、限制与示例。',
      promptFocus: '请优先整理目标、前置条件、关键步骤、接口或参数、限制、示例与注意事项，保留术语准确性。',
      chunkPromptFocus: '请只总结当前分段中出现的步骤、接口、参数、限制或示例，不要漏掉技术细节。',
      synthesisPromptFocus: '请按目标、前置条件、步骤、接口或参数、限制、示例整理成结构化结果。',
      secondaryPromptFocus: '二次生成时优先保留参数名、接口名、步骤顺序和注意事项。',
      preferredSummaryMode: 'long',
      chunkMaxChars: 3200,
      minChunkChars: 1000,
      chunkingMode: 'section_split'
    },
    forum: {
      strategyId: 'forum_distillation',
      label: '问答归纳',
      description: '优先问题背景、约束条件、候选方案、最佳答案与分歧。',
      promptFocus: '请整理提问背景、关键约束、主要回答、推荐方案、争议点和适用条件。',
      chunkPromptFocus: '请只保留当前分段中的问题、回答、建议或反例，明确是谁在表达什么。',
      synthesisPromptFocus: '请合成为一份问题导向的总结，按问题、候选方案、推荐方案、风险或争议组织。',
      secondaryPromptFocus: '二次生成时优先把结论转成问答卡片、风险清单或执行建议。',
      preferredSummaryMode: 'qa',
      chunkMaxChars: 3000,
      minChunkChars: 1000,
      chunkingMode: 'thread_split'
    },
    repo: {
      strategyId: 'repo_walkthrough',
      label: 'README 导读',
      description: '优先项目目标、安装方式、核心能力、使用路径与限制。',
      promptFocus: '请优先整理项目目标、安装方式、核心能力、使用路径、关键模块、约束与适用场景。',
      chunkPromptFocus: '请只总结当前分段中的安装、配置、使用、架构或限制信息。',
      synthesisPromptFocus: '请整合成一份便于快速上手的导读，按项目目标、安装、使用、结构、限制组织。',
      secondaryPromptFocus: '二次生成时优先输出上手步骤、关键概念和风险提醒。',
      preferredSummaryMode: 'key_points',
      chunkMaxChars: 3200,
      minChunkChars: 1000,
      chunkingMode: 'section_split'
    },
    video: {
      strategyId: 'video_digest',
      label: '视频速览',
      description: '优先视频主题、官方 AI 总结、字幕要点、时间线与可复看片段。',
      promptFocus: '请优先整理视频主题、核心观点、关键事实、分段时间线和可复看的重点片段；如果内容来自 Bilibili 官方 AI 总结、B 站字幕或 YouTube 字幕，请说明依据边界，不要补充视频中没有的信息。',
      chunkPromptFocus: '请只总结当前字幕或视频片段中的观点、事实、例子和时间点，保留重要时间戳。',
      synthesisPromptFocus: '请把分段结果整合成一份视频速览，按核心结论、时间线、关键片段和后续可复看点组织。',
      secondaryPromptFocus: '二次生成时优先把视频内容转成行动项、问答卡片或复盘清单，并保留必要时间戳。',
      preferredSummaryMode: 'medium',
      chunkMaxChars: 4200,
      minChunkChars: 1400,
      chunkingMode: 'timeline_split'
    }
  };

  function cloneStrategy(sourceType, config) {
    return Object.assign({ sourceType: sourceType || 'unknown' }, config || SITE_STRATEGIES.unknown);
  }

  // English strategy copy for prompt localization. Structural config
  // (modes, chunking limits) always comes from the zh table.
  const SITE_STRATEGIES_EN = {
    unknown: {
      label: 'General reading',
      description: 'Balanced extraction of structure, key facts, conclusions, and future value.',
      promptFocus: "Prioritize the page's structure, key facts, core conclusions, and reusable information.",
      chunkPromptFocus: 'Keep only the core information, facts, and conclusions of this chunk; do not speculate across chunks.',
      synthesisPromptFocus: 'Consolidate the chunk results into a clearly structured summary suitable for quick review.',
      secondaryPromptFocus: 'When reworking, stay strictly based on the existing summary; do not add facts absent from it.'
    },
    news: {
      label: 'News brief',
      description: 'Prioritizes the timeline, actors, key facts, direct impact, and open questions.',
      promptFocus: 'Organize the event background, key timeline, involved parties, important facts, direct impact, and follow-up watchpoints; avoid unsupported speculation.',
      chunkPromptFocus: 'Summarize only the facts, quotes, timestamps, and impacts in this chunk; do not extrapolate.',
      synthesisPromptFocus: 'Consolidate into a briefing for quickly understanding the event, organized by background, facts, impact, and open questions.',
      secondaryPromptFocus: 'When reworking, convert facts into forms that are easier to review or act on without changing factual boundaries.'
    },
    blog: {
      label: 'Blog insight',
      description: 'Prioritizes the author’s viewpoints, reasoning, examples, and transferable lessons.',
      promptFocus: 'Extract the author’s core arguments, reasoning, supporting examples, lessons, and applicability boundaries.',
      chunkPromptFocus: 'Capture the viewpoints, evidence, examples, and author judgments in this chunk.',
      synthesisPromptFocus: 'Consolidate into a logically layered summary of viewpoints, preserving the main argument chain and insights.',
      secondaryPromptFocus: 'When reworking, prioritize methods, lessons, and applicability conditions.'
    },
    doc: {
      label: 'Doc deep-read',
      description: 'Prioritizes goals, prerequisites, steps, APIs, limitations, and examples.',
      promptFocus: 'Organize goals, prerequisites, key steps, APIs or parameters, limitations, examples, and caveats; keep terminology accurate.',
      chunkPromptFocus: 'Summarize only the steps, APIs, parameters, limitations, or examples appearing in this chunk; do not drop technical details.',
      synthesisPromptFocus: 'Organize into a structured result by goals, prerequisites, steps, APIs or parameters, limitations, and examples.',
      secondaryPromptFocus: 'When reworking, preserve parameter names, API names, step order, and caveats.'
    },
    forum: {
      label: 'Q&A roundup',
      description: 'Prioritizes the question background, constraints, candidate answers, and disagreements.',
      promptFocus: 'Organize the question background, key constraints, main answers, recommended solutions, points of contention, and applicability conditions.',
      chunkPromptFocus: 'Keep only the questions, answers, advice, or counterexamples in this chunk; make clear who is saying what.',
      synthesisPromptFocus: 'Consolidate into a question-oriented summary organized by the problem, candidate solutions, recommendation, and risks or controversies.',
      secondaryPromptFocus: 'When reworking, convert conclusions into Q&A cards, risk lists, or execution advice.'
    },
    repo: {
      label: 'README guide',
      description: 'Prioritizes the project goal, installation, core capabilities, usage path, and limitations.',
      promptFocus: 'Organize the project goal, installation, core capabilities, usage path, key modules, constraints, and applicable scenarios.',
      chunkPromptFocus: 'Summarize only the installation, configuration, usage, architecture, or limitation information in this chunk.',
      synthesisPromptFocus: 'Consolidate into a quick-start guide organized by goal, installation, usage, structure, and limitations.',
      secondaryPromptFocus: 'When reworking, prioritize getting-started steps, key concepts, and risk reminders.'
    },
    video: {
      label: 'Video digest',
      description: 'Prioritizes the video topic, official AI summary, subtitle points, timeline, and rewatchable moments.',
      promptFocus: 'Organize the video topic, core viewpoints, key facts, chapter timeline, and rewatchable moments; if the content comes from Bilibili’s official AI summary, Bilibili subtitles, or YouTube captions, state that boundary and do not add information absent from the video.',
      chunkPromptFocus: 'Summarize only the viewpoints, facts, examples, and timestamps in this subtitle or video segment; keep important timestamps.',
      synthesisPromptFocus: 'Consolidate the chunk results into a video digest organized by core takeaway, timeline, key moments, and rewatch points.',
      secondaryPromptFocus: 'When reworking, convert video content into action items, Q&A cards, or review checklists, keeping necessary timestamps.'
    }
  };

  function resolveStrategy(input) {
    const sourceType = String(input?.sourceType || 'unknown');
    const table = input?.locale === 'en' ? SITE_STRATEGIES_EN : SITE_STRATEGIES;
    const fallback = input?.locale === 'en' ? SITE_STRATEGIES_EN.unknown : SITE_STRATEGIES.unknown;
    const base = cloneStrategy(sourceType, SITE_STRATEGIES[sourceType] || SITE_STRATEGIES.unknown);
    if (input?.locale === 'en') {
      return Object.assign(base, table[sourceType] || fallback);
    }
    return base;
  }

  const api = {
    SITE_STRATEGIES,
    resolveStrategy
  };

  global.AISummaryPageStrategy = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : self);
