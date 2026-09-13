const { test, assert, freshRequire } = require('./harness');

function createPort() {
  const listeners = {
    message: [],
    disconnect: []
  };
  const posted = [];
  let disconnected = 0;
  const port = {
    onMessage: {
      addListener(listener) {
        listeners.message.push(listener);
      }
    },
    onDisconnect: {
      addListener(listener) {
        listeners.disconnect.push(listener);
      }
    },
    postMessage(message) {
      posted.push(message);
    },
    disconnect() {
      disconnected += 1;
    }
  };

  return {
    port,
    posted,
    listeners,
    get disconnected() {
      return disconnected;
    }
  };
}

function createController(overrides) {
  const SidebarGeneration = freshRequire('sidebar/generation.js');
  const state = Object.assign({
    generating: true,
    cancelRequested: false,
    runAbortController: new AbortController(),
    activeRunIds: new Set(['run_existing']),
    activePort: null,
    activeStreamRunId: '',
    summaryMarkdown: '',
    visibleRecord: null
  }, overrides?.state || {});
  const calls = {
    messages: [],
    statuses: [],
    refreshes: 0,
    scheduled: 0
  };
  const portBundle = overrides?.portBundle || createPort();

  const controller = SidebarGeneration.createGenerationController({
    getState: () => state,
    getElements: () => ({ historyPanel: { classList: { contains: () => true } } }),
    recordStore: {
      saveRecord: async (record) => Object.assign({}, record, { saved: true })
    },
    domain: overrides?.domain || {
      createRuntimeId: () => 'run_generated',
      hashString: (value) => 'hash_' + String(value || '').length
    },
    errors: {
      ERROR_CODES: {
        CONFIG_MISSING_API_KEY: 'CONFIG_MISSING_API_KEY',
        NETWORK_STREAM_DISCONNECTED: 'NETWORK_STREAM_DISCONNECTED',
        RUN_CANCELLED: 'RUN_CANCELLED'
      },
      createError: (code, payload) => Object.assign(new Error(code), { code }, payload || {})
    },
    articleUtils: overrides?.articleUtils || {},
    runUtils: overrides?.runUtils || {},
    trust: overrides?.trust || {},
    loadRuntimeSettings: overrides?.loadRuntimeSettings || (async () => ({ apiKey: 'test' })),
    ensureArticleReady: overrides?.ensureArticleReady || (() => {}),
    withCustomPrompt: (prompt) => prompt,
    getTargetLanguage: () => 'auto',
    createDraftRecord: overrides?.createDraftRecord || (() => ({})),
    finalizeRecord: overrides?.finalizeRecord || ((record, updates) => Object.assign({}, record, updates)),
    normalizeUiError: (error) => error,
    composeDiagnostics: overrides?.composeDiagnostics || (() => ({})),
    markdownToPlainText: (value) => String(value || ''),
    extractBullets: () => [],
    getModeLabel: (mode) => mode,
    renderErrorBox: () => {},
    renderDiagnostics: () => {},
    renderArticleMeta: () => {},
    renderInlineNote: () => {},
    setStatus: (text, tone) => {
      calls.statuses.push({ text, tone });
    },
    refreshActionStates: () => {
      calls.refreshes += 1;
    },
    renderChunkProgress: () => {},
    scheduleMarkdownRender: () => {
      calls.scheduled += 1;
    },
    bindVisibleRecord: () => {},
    getHistoryController: () => ({ refresh: async () => {} }),
    applyPendingNavigationPayload: async () => {},
    runtimeSendMessage: async (message) => {
      calls.messages.push(message);
      return { success: true };
    },
    connectStream: () => portBundle.port,
    readRuntimeLastErrorMessage: () => ''
  });

  return { SidebarGeneration, controller, state, calls, portBundle };
}

test('sidebar generation helpers format stream progress and retry statuses', [
  'generation.primary',
  'generation.secondary',
  'transport.streaming'
], () => {
  const SidebarGeneration = freshRequire('sidebar/generation.js');

  assert.strictEqual(SidebarGeneration.buildStreamStartStatus({ stage: 'synthesis' }), '\u6b63\u5728\u6c47\u603b\u6700\u7ec8\u7ed3\u679c...');
  assert.strictEqual(SidebarGeneration.buildStreamStartStatus({ stage: 'chunk', chunkIndex: 1, chunkCount: 3 }), '\u6b63\u5728\u603b\u7ed3\u7b2c 2/3 \u6bb5...');
  assert.strictEqual(SidebarGeneration.buildStreamStartStatus({ stage: 'chunk' }), '\u6b63\u5728\u603b\u7ed3\u5f53\u524d\u5206\u6bb5...');
  assert.strictEqual(SidebarGeneration.buildStreamStartStatus({ stage: 'primary' }), '\u6b63\u5728\u751f\u6210\u603b\u7ed3...');
  assert.strictEqual(SidebarGeneration.buildStreamRetryStatus({ stage: 'chunk', chunkIndex: 0, chunkCount: 2 }, 2), '\u6b63\u5728\u603b\u7ed3\u7b2c 1/2 \u6bb5\uff0c\u63a5\u53e3\u6ce2\u52a8\uff0c\u6b63\u5728\u8fdb\u884c\u7b2c 2 \u6b21\u91cd\u8bd5...');
});

test('sidebar generation controller cancels active stream and runtime runs', [
  'run.cancellation',
  'transport.streaming'
], async () => {
  const portBundle = createPort();
  const { controller, state, calls } = createController({
    portBundle,
    state: {
      activePort: portBundle.port,
      activeStreamRunId: 'run_stream'
    }
  });

  await controller.cancelGeneration();

  assert.strictEqual(state.cancelRequested, true);
  assert.deepStrictEqual(portBundle.posted, [
    { action: 'cancelRun', runId: 'run_stream' }
  ]);
  assert.deepStrictEqual(calls.messages, [
    { action: 'cancelRun', runId: 'run_existing' }
  ]);
  assert.strictEqual(state.activePort, null);
  assert.strictEqual(state.activeStreamRunId, '');
  assert.strictEqual(calls.statuses[0].text, '\u6b63\u5728\u53d6\u6d88\u672c\u6b21\u751f\u6210...');
  assert.strictEqual(calls.statuses[0].tone, 'warning');
  assert.strictEqual(calls.refreshes, 1);
});

test('sidebar generation stream runner posts startStream and resolves streamed text', [
  'generation.primary',
  'transport.streaming'
], async () => {
  const portBundle = createPort();
  const { controller, state, calls } = createController({ portBundle });

  const stream = controller.runPromptViaStream({ modelName: 'm' }, 'Prompt', { stage: 'primary' }, null, {
    onToken(token) {
      state.summaryMarkdown += token;
      calls.scheduled += 1;
    }
  });

  assert.deepStrictEqual(portBundle.posted, [
    {
      action: 'startStream',
      settings: { modelName: 'm' },
      prompt: 'Prompt',
      runId: 'run_generated',
      meta: { stage: 'primary' }
    }
  ]);
  assert.ok(state.activeRunIds.has('run_generated'));

  portBundle.listeners.message[0]({ runId: 'run_generated', type: 'token', token: 'Hello ' });
  portBundle.listeners.message[0]({
    runId: 'run_generated',
    type: 'done',
    diagnostics: { runId: 'run_generated' },
    usage: { totalTokens: 3 }
  });

  const result = await stream;
  assert.deepStrictEqual(result, {
    text: 'Hello ',
    diagnostics: { runId: 'run_generated' },
    usage: { totalTokens: 3 }
  });
  assert.strictEqual(state.summaryMarkdown, 'Hello ');
  assert.strictEqual(state.activeRunIds.has('run_generated'), false);
  assert.strictEqual(state.activePort, null);
  assert.strictEqual(portBundle.disconnected, 1);
  assert.strictEqual(calls.scheduled, 1);
});

test('sidebar generation uses Bilibili official summary without model streaming', [
  'generation.primary',
  'generation.bilibili_official',
  'content.extraction'
], async () => {
  const portBundle = createPort();
  const article = {
    articleId: 'art_bili',
    title: 'Bili Video',
    cleanText: '# Bilibili 官方 AI 总结\n官方总结正文',
    content: '# Bilibili 官方 AI 总结\n官方总结正文',
    chunkCount: 1,
    diagnostics: {
      videoSource: 'bilibili',
      videoSourceKind: 'official_ai_summary',
      bilibili: {
        sourceKind: 'official_ai_summary',
        debug: {
          selectedSource: 'official_ai_summary',
          officialAiSummary: {
            called: true,
            summary: '官方总结正文'
          },
          subtitles: {
            attempted: false
          }
        }
      }
    }
  };
  const { controller, state, calls } = createController({
    portBundle,
    state: {
      generating: false,
      article
    },
    loadRuntimeSettings: async () => ({ apiKey: '' }),
    trust: {
      buildTrustPolicy: () => ({ allowHistory: true })
    },
    runUtils: {
      pickTerminalRun: (finalRun) => finalRun || null,
      buildTerminalRecordPatch: (record, diagnostics, status, updates) => Object.assign({}, updates, {
        status,
        diagnostics
      }),
      sanitizeDiagnosticsForPersistence: (diagnostics) => diagnostics
    },
    createDraftRecord: () => ({
      runId: 'direct_run',
      allowHistory: true
    }),
    composeDiagnostics: (inputArticle, chunkRuns, finalRun) => ({
      article: { diagnostics: inputArticle.diagnostics },
      finalRun,
      provider: finalRun?.provider || ''
    })
  });

  await controller.startPrimarySummary('medium');

  assert.strictEqual(state.summaryMarkdown, '# Bilibili 官方 AI 总结\n官方总结正文');
  assert.strictEqual(state.generating, false);
  assert.deepStrictEqual(portBundle.posted, []);
  assert.ok(calls.statuses.some((item) => String(item.text || '').includes('B 站官方 AI 总结')));
});

test('sidebar stream run drops tokens from the aborted attempt on retry', [
  'transport.streaming',
  'generation.primary'
], async () => {
  const portBundle = createPort();
  const { controller, state, calls } = createController({ portBundle });

  const pending = controller.runPromptViaStream({ apiKey: 'k' }, 'prompt', { stage: 'primary' }, null, {
    onToken(token) {
      state.summaryMarkdown += token;
    }
  });

  const [messageListener] = portBundle.listeners.message;
  messageListener({ runId: 'run_generated', type: 'started' });
  messageListener({ runId: 'run_generated', type: 'token', token: 'A' });
  messageListener({ runId: 'run_generated', type: 'retry', retry: { attempt: 2 } });
  messageListener({ runId: 'run_generated', type: 'token', token: 'B' });
  messageListener({ runId: 'run_generated', type: 'done', text: 'B', usage: null });

  const result = await pending;
  assert.strictEqual(result.text, 'B');
  assert.strictEqual(state.summaryMarkdown, 'B');
  assert.ok(calls.scheduled >= 1, 'markdown render is rescheduled after the retry reset');
});

test('chunked primary summary runs chunks with bounded concurrency and keeps synthesis order', [
  'generation.primary',
  'transport.streaming'
], async () => {
  const portBundle = createPort();
  let runCounter = 0;
  const { controller, state, calls } = createController({
    portBundle,
    state: {
      generating: false,
      article: {
        articleId: 'art_1',
        chunkCount: 2,
        chunks: [
          { index: 0, content: 'c1' },
          { index: 1, content: 'c2' }
        ]
      }
    },
    domain: {
      createRuntimeId: (prefix) => prefix + '_' + (++runCounter),
      hashString: (value) => 'hash_' + String(value || '').length
    },
    articleUtils: {
      buildChunkPrompt: ({ chunk }) => 'chunk_prompt_' + chunk.index,
      buildSynthesisPrompt: ({ partialSummaries }) => 'synth_' + partialSummaries.join('|')
    },
    runUtils: {
      mapWithConcurrency: freshRequire('shared/run-utils.js').mapWithConcurrency,
      buildTerminalRecordPatch: (record, diagnostics, status, updates) => Object.assign({}, updates, { status })
    },
    trust: {
      buildTrustPolicy: () => ({ allowHistory: true })
    }
  });

  const pending = controller.startPrimarySummary('medium');
  await new Promise((resolve) => setTimeout(resolve, 0));

  const startMessages = () => portBundle.posted.filter((message) => message.action === 'startStream');
  const chunkRunIds = startMessages().map((message) => message.runId);
  assert.strictEqual(chunkRunIds.length, 2, 'both chunk runs start concurrently');

  const listeners = portBundle.listeners.message;
  const deliver = (runId, message) => {
    listeners.forEach((listener) => listener(Object.assign({ runId }, message)));
  };

  // Complete chunk 2 first; aggregation must stay in chunk order.
  deliver(chunkRunIds[1], { type: 'done', text: 'SUMMARY_2' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  deliver(chunkRunIds[0], { type: 'done', text: 'SUMMARY_1' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const synthesisMessage = startMessages().find((message) => String(message.prompt).startsWith('synth_'));
  assert.ok(synthesisMessage, 'synthesis starts after both chunks settle');
  assert.strictEqual(synthesisMessage.prompt, 'synth_SUMMARY_1|SUMMARY_2');

  deliver(synthesisMessage.runId, { type: 'token', token: 'SYNTHESIS_OUTPUT' });
  deliver(synthesisMessage.runId, { type: 'done', text: 'SYNTHESIS_OUTPUT', usage: null });

  await pending;
  assert.strictEqual(state.summaryMarkdown, 'SYNTHESIS_OUTPUT');
});

test('chunkConcurrency setting of 1 runs chunks strictly one by one', [
  'generation.primary',
  'transport.streaming'
], async () => {
  const portBundle = createPort();
  let runCounter = 0;
  const { controller, state } = createController({
    portBundle,
    state: {
      generating: false,
      article: {
        articleId: 'art_1',
        chunkCount: 2,
        chunks: [
          { index: 0, content: 'c1' },
          { index: 1, content: 'c2' }
        ]
      }
    },
    loadRuntimeSettings: async () => ({ apiKey: 'test', chunkConcurrency: 1 }),
    domain: {
      createRuntimeId: (prefix) => prefix + '_' + (++runCounter),
      hashString: (value) => 'hash_' + String(value || '').length
    },
    articleUtils: {
      buildChunkPrompt: ({ chunk }) => 'chunk_prompt_' + chunk.index,
      buildSynthesisPrompt: ({ partialSummaries }) => 'synth_' + partialSummaries.join('|')
    },
    runUtils: {
      mapWithConcurrency: freshRequire('shared/run-utils.js').mapWithConcurrency,
      buildTerminalRecordPatch: (record, diagnostics, status, updates) => Object.assign({}, updates, { status })
    },
    trust: {
      buildTrustPolicy: () => ({ allowHistory: true })
    }
  });

  const pending = controller.startPrimarySummary('medium');
  await new Promise((resolve) => setTimeout(resolve, 0));

  const startMessages = () => portBundle.posted.filter((message) => message.action === 'startStream');
  assert.strictEqual(startMessages().length, 1, 'concurrency 1 starts only the first chunk');

  const listeners = portBundle.listeners.message;
  const firstRunId = startMessages()[0].runId;
  listeners.forEach((listener) => listener({ runId: firstRunId, type: 'done', text: 'SUMMARY_1' }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.strictEqual(startMessages().length, 2, 'the second chunk starts only after the first settles');

  const secondRunId = startMessages()[1].runId;
  listeners.forEach((listener) => listener({ runId: secondRunId, type: 'done', text: 'SUMMARY_2' }));
  await new Promise((resolve) => setTimeout(resolve, 0));

  const synthesisMessage = startMessages().find((message) => String(message.prompt).startsWith('synth_'));
  assert.ok(synthesisMessage, 'synthesis starts after both chunks settle');
  assert.strictEqual(synthesisMessage.prompt, 'synth_SUMMARY_1|SUMMARY_2');

  listeners.forEach((listener) => listener({ runId: synthesisMessage.runId, type: 'done', text: 'SYNTHESIS_OUTPUT', usage: null }));
  await pending;
  assert.strictEqual(state.summaryMarkdown, 'SYNTHESIS_OUTPUT');
});
