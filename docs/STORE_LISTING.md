# Chrome Web Store Listing（商店列表文案与提交素材）

Last updated: 2026-09-04

说明：商店条目名称来自 manifest.json 的 `name`，改标题需要改包（或等 i18n 批次用 `_locales` 落地）；简短描述、详细描述、截图、分类可直接在 CWS 后台随时更新，零代码。

## 标题（≤45 字符，随下个版本包更新）

当前线上：`一览 - AI 阅读工作台`

建议改为（品牌在前，补齐高频搜索词）：

```
一览 - AI 摘要 · 网页 / YouTube / B 站视频总结
```

备选：`一览 Yilan - AI 网页与视频摘要（YouTube / B站总结）`

理由：CWS 搜索里标题权重最高，"AI 摘要 / 总结 / YouTube / B站" 是目标用户最可能输入的词；"AI 阅读工作台" 是品牌叙事，不是搜索词。

## 简短描述（Short Description，≤132 字符，立即可改）

```
用你自己的 AI Key 总结网页、YouTube 与 B 站视频：字幕级来源、结构化摘要、二次生成、本地历史与专注阅读。BYOK 本地优先。
```

## 详细描述（立即可改）

```
一览（Yilan）是一款本地优先的 AI 阅读工作台浏览器扩展：把网页、YouTube 视频和 B 站视频变成结构化摘要，支持继续加工、本地沉淀与专注阅读。

—— 核心能力 ——
• 网页 AI 摘要：自动抽取正文、标题、作者与发布时间，长文自动分段；简短总结 / 标准总结 / 详细分析 / 关键要点四种模式
• YouTube 总结：优先读取字幕与翻译字幕，多级来源回退，支持字幕导出
• B 站总结：优先使用 B 站官方 AI 总结，字幕回退，支持字幕导出
• 二次生成：行动项、术语表、问答卡片
• 历史与收藏：结果存入本地，可搜索、按站点筛选、收藏与回看
• 专注阅读：独立阅读页带文档导航，Markdown 导出与长截图分享卡

—— BYOK：自带 API Key，支持 11+ 厂商预设 ——
OpenAI、Anthropic Claude、DeepSeek、Google Gemini、xAI Grok、通义千问 Qwen、智谱 GLM、MiniMax、豆包、腾讯混元、小米 MiMo，以及任意 OpenAI 兼容接口。内置连接测试与 Endpoint 自动探测，配置一次长期可用。

—— 本地优先，边界说清楚 ——
• 无账号体系，无内置统计与跟踪
• 页面内容只发送给你自己配置的模型服务商
• 历史仅存本地，可随时删除；无痕模式不写入历史
• 完全开源：https://github.com/mutuyihao/yilan

—— 使用方式 ——
在任意网页右键选择「用一览总结此页」，或按 Alt + S，侧栏自动开始工作。

适合需要高效读长文、视频学习、资料整理与知识沉淀的用户。
```

理由：厂商名（DeepSeek / GLM / Qwen / 豆包等）是真实支持的预设，写进描述能命中"XX 总结""XX 摘要"这类搜索；无账号、无跟踪、开源是可信度卖点，前置。

## 截图顺序（CWS 后台可改）

素材在 `store-assets/chrome-web-store/`（`scripts/generate-store-assets.js` 生成）：

1. [ ] 第一张放「视频摘要」场景（YouTube 或 B 站侧栏摘要图）——视频总结是最高频搜索意图，若现成 5 张里没有，用生成脚本补一张
2. [ ] 第二张放网页摘要工作台（现 screenshot-01）
3. [ ] 后续依次：二次生成模式 → 历史收藏 → 厂商配置 → 主题
4. [ ] 宣传图（marquee 440x280）确认含"AI 摘要 / YouTube / B站"字样

## 分类与语言

- [ ] 分类确认：Productivity（工具效率类是此类扩展的主流分类）
- [ ] 语言：中文（简体）为主；英文 listing 等完成 i18n 批次后新增，不要提前

---

以下为提交表单用的英文素材（权限说明、隐私答案等保持英文，便于直接粘贴）。

## Version Update Notes

Paste-ready Chrome Web Store update text:

1.4.1 adds a default compact sidebar mode setting, keeps the full standard sidebar layout for source details and diagnostics, and polishes theme-linked colors across compact controls, summary scrollbars, reader backgrounds, and footer status text. Since the 1.0.0 store version, Yilan also added YouTube and Bilibili video summaries, subtitle export, a reader document navigation panel, redesigned provider setup, MiMo route/key validation improvements, broader diagnostics, and updated release gates.

Full user-visible changes since the 1.0.0 store version:

- 1.4.1: Added a popup setting for default compact sidebar mode, preserved standard sidebar mode as the full information layout, and improved theme-linked colors for compact controls, summary scrollbars, standalone reader backgrounds, and footer status text.
- 1.3.0: Added YouTube video summaries using captions where available, with DOM player response, watch HTML, InnerTube, JSON/XML caption parsing, translated caption candidates, stale SPA response handling, metadata fallback, diagnostics persistence, and summary-selected subtitle export.
- 1.2.0: Added Bilibili video summaries using video metadata, official Bilibili AI summaries when available, subtitle fallback, diagnostics, and Bilibili subtitle export.
- 1.1.1: Added a floating document navigation panel to the standalone reader, heading anchors, active-section highlighting, and better long-title handling.
- 1.1.0: Redesigned provider setup around provider selection, recommended Base URL routes, API Key entry, connection testing, generated provider catalog governance, and clearer automatic/manual endpoint modes.
- 1.0.1: Added Xiaomi MiMo provider presets, MiMo Token Plan regional routes, endpoint inference, and API-key validation for incompatible MiMo credential types.
- Quality and release readiness: Expanded Node/unit/static/E2E coverage, documented platform limitations, refreshed release metadata, and updated Chrome Web Store packaging guidance.

## Permission Rationale

- `activeTab`: reads the current tab only after the user triggers summarization.
- `scripting`: injects the content extraction script and sidebar iframe.
- `storage`: stores provider settings, preferences, entry state, and local runtime caches.
- `contextMenus`: adds the right-click entry point.
- `clipboardWrite`: copies summaries and export text.
- `host_permissions: <all_urls>`: required because users can summarize arbitrary web pages, fetch YouTube/Bilibili video and subtitle source data when triggered on supported video pages, and configure arbitrary AI-compatible API endpoints.

## Privacy Answers

- Yilan does not collect analytics or telemetry.
- Yilan does not operate a server that receives page content, API keys, or history.
- Page content, YouTube/Bilibili video metadata, or subtitle text is sent directly from the browser to the user's configured AI provider when model generation is needed.
- On Bilibili video pages, Yilan may request Bilibili metadata, official AI summary, player, and subtitle endpoints from the browser. If an official Bilibili AI summary is available, the primary result can use it without an extra AI-provider request.
- On YouTube video pages, Yilan may read player response data from the page and request YouTube watch/player/caption endpoints from the browser to locate captions or fallback metadata.
- API keys are stored in `chrome.storage.sync`, which may sync through the user's browser account depending on browser settings.
- Summary history is stored locally in IndexedDB and can be deleted by the user.

## Privacy Policy URL

- Use `https://github.com/mutuyihao/yilan/blob/master/PRIVACY_POLICY.md` in the Chrome Web Store privacy policy field.

## Known Limitations

- Browser internal pages, extension store pages, and other restricted URLs cannot be injected due to Chromium security rules.
- Provider compatibility depends on the chosen API endpoint and its CORS behavior.
- Custom API endpoints must use HTTPS unless they point to localhost or a LAN address.
- YouTube captions, translated captions, and player-response fallbacks depend on YouTube page/API availability and may degrade to metadata-only summaries.
- Bilibili official summaries and subtitles depend on Bilibili page/API availability, video support, and the current browser login state.
- Bilibili support currently targets `bilibili.com/video/BV...` video pages and may degrade to title/description-only summaries when official summaries or subtitles are unavailable.
- No-trace mode prevents local history writes but does not prevent sending page content to the configured model provider.

## Disclaimer Notes

- Yilan is not an official Bilibili product and is not affiliated with, endorsed by, or warranted by Bilibili.
- Summaries and exported subtitles are personal reading aids, not official transcripts, complete substitutes for source videos, or guarantees of factual accuracy.
- Users should follow copyright rules, platform terms, and creator rights when using or sharing exported text.
