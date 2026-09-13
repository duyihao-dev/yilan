# 下一轮优化路线图（增长优先）

Last updated: 2026-09-04

Status: approved（方案已确认：增长优先 + 完整 i18n）

这份文档回答"下一步做什么优化、收益最大"。排序逻辑是增长漏斗：获客 → 转化 → 留存 → 口碑，工程项只保留"敢快速迭代"所需的最小基建。产品方向仍以 [UPGRADE_DESIGN.md](UPGRADE_DESIGN.md) 为准，本文只排它的执行时机。

## 核心结论

最大收益不是单点，而是一条链：

1. **第一梯队·速赢包**（约 1 天）：收尾已开的 SEO 工作 + 商店列表关键词 + 一个 CI 门禁。全是小时级改动，本周可完成。
2. **第二梯队·出海主线**（1-2 周）：完整 i18n + 英文落地页 + 商店英文 listing。UI 纯中文是当前增长的硬闸门，YouTube 摘要是全球需求，这是单项最大的天花板。
3. **第三梯队·留存与口碑**（2-3 周，切片进行）：记忆库最小切片（标签/备注/稍后读）+ 内容 SEO。让用户有回访理由和传播素材。

---

## 背景事实（已核实，2026-09-04）

- 落地页 SEO 任务单（landing-page-seo-plan.md）已随 `e7a8428` 执行完毕，但留有尾巴：
  - `history-reader` / `settings-panel` 两张截图仍是 PNG（各 375–500KB，合计约 1.8MB）；hero / workflow 已转 WebP（888KB → 26KB，效果已验证）
  - 下方截图无 `loading="lazy"`，hero 图无 `fetchpriority="high"`
  - `og:image` 用的是 1280x800 全屏截图（原 PNG 888KB），没有专门的 1200x630 分享图
  - `robots.txt` 只有 `User-agent: *` + Sitemap，任务单里的 GPTBot / ClaudeBot / Google-Extended 拦截段没提交
  - favicon 只有 SVG，无 favicon.ico 回退、无 apple-touch-icon
  - `theme.js` 的 updateThemeShots 切换主题时会把 og:image 的 content 换成相对路径（爬虫不执行 JS，影响小，但不规范）
- 工程现状：零 CI（无 `.github/`）、零 lint、`tsconfig` 宽松模式；版本号需手动同步 4 处（package.json / package-lock.json / manifest.json / shared/version.js 的 FALLBACK_VERSION），无任何机器校验
- 文案基础：提示词/模式/标签已集中在 `shared/strings.js`、`shared/ui-labels.js`，但 popup/sidebar 仍有大量内联中文文案（如 popup.js:1072「保存失败：…」、popup.js:1450「切换配置失败：…」）；无 `_locales`，manifest name/description 硬编码中文
- 产品：`summaryRecords` 已有 `tags` / `notes` / `pinned` 字段但无编辑与筛选 UI（UPGRADE_DESIGN Phase 4 已埋点未产品化）
- 商店已上架：`https://chromewebstore.google.com/detail/一览-ai-阅读工作台/danicaalimfiaednaiellfgbkihjlanh`；官网 https://www.yilan.app；`store-assets/chrome-web-store/` 有现成宣传图与截图（`scripts/generate-store-assets.js` 生成）

---

## 第一梯队：速赢包（约 1 天，本周）

### 1. Landing page SEO 收尾（P0，约 2-3 小时）

延续 `e7a8428` 的工作，全部小时级改动：

- [ ] `history-reader` / `settings-panel` 两张 PNG 转 WebP（quality 82，保持 1280x800，`src` 与 `data-light-src`/`data-dark-src` 成对同步替换）
- [ ] 下方截图加 `loading="lazy"`；hero 图加 `fetchpriority="high"`
- [ ] 制作专属 1200x630 og:image 分享图（可从 `store-assets/chrome-web-store/` 现成 promo 裁切），替换当前全屏截图；og:image 的 width/height 同步改为 1200/630
- [ ] `robots.txt` 补 GPTBot / ClaudeBot / Google-Extended 拦截段（与 landing-page-seo-plan.md 第 6 项对齐）
- [ ] 补 favicon.ico 回退 + apple-touch-icon
- [ ] 修 `theme.js` 切主题把 og:image 写成相对路径的瑕疵
- [ ] Google Search Console / Bing 站长验证并提交 sitemap（账号操作需本人完成，步骤见文末清单）

**为什么值得**：分享卡片点击率、长尾收录基础、首屏性能三件事一次做完；且这是已开工工作的收尾，沉没成本最低。

**验收**：`curl -sL https://www.yilan.app/robots.txt` 含 AI 爬虫段；页面全部 og/twitter 图片为绝对路径且尺寸 1200x630；Lighthouse/DevTools 网络面板确认非首屏截图懒加载；git diff 只涉及 `landing-page/`。

### 2. CWS 商店列表关键词优化（P0，约 1-2 小时，零代码）

Chrome Web Store 搜索是扩展装机第一大来源：

- [ ] 对照当前商店标题/描述，补齐搜索词：「AI 摘要」「YouTube 总结」「B站 总结」「本地优先」「BYOK」「划词/侧边栏」
- [ ] 截图顺序调整：最强卖点（YouTube/B站视频摘要）排第一
- [ ] 简介首行写清差异化：本地优先、数据不出本机、自带 API Key

**为什么值得**：零代码、直接作用于装机转化；商店列表是可以随时 A/B 的低风险实验场。

**验收**：商店后台更新后，标题/描述/截图顺序符合上述要求。

### 3. GitHub Actions CI 门禁（P1，约半天）

对增长的意义是"单人敢快跑、防发版事故"：

- [ ] 新增 `.github/workflows/ci.yml`：push/PR 跑 `npm run typecheck`、`npm test`、`npm run test:e2e`（Playwright 已有，仅 chromium）
- [ ] 版本号 4 处一致性断言加进 `tests/static-contracts.test.js`（package.json / package-lock.json / manifest.json / shared/version.js）
- [ ]（可选）引入 eslint flat config，首批只开 `no-unused-vars`、`no-undef` 等低成本规则；`sidebar.js:46-55` 的 storage 包装不检查 `chrome.runtime.lastError`（会吞错）这类问题交给 lint 兜底，重构本身不进本批

**验收**：CI 在 GitHub 上绿；手动把 shared/version.js 改错版本号时 static contracts 能红。

---

## 第二梯队：出海主线（1-2 周，已确认做完整 i18n）

### 4. chrome.i18n + UI 多语言（P0，约 1 周，分批合入）

- [ ] 建 `_locales/zh_CN/` 与 `_locales/en/`，manifest 的 name/description/default_locale 走 chrome.i18n
- [ ] 页面文案：自建轻量 `shared/i18n.js` + JSON 词典（popup/sidebar/reader 都有自有 HTML，不需要框架）；`shared/strings.js`、`shared/ui-labels.js` 是现成收敛点，从它们开始
- [ ] 分批顺序：manifest + popup → sidebar → reader 与 background 通知；每批顺带收编内联文案（popup.js:1072、popup.js:1450 等）
- [ ] 每批同步适配静态契约测试与 E2E 断言（它们锁了 DOM 与部分文案）

**为什么值得**：这是出海的闸门——页面说英文、UI 全中文，转化必然很差，所以 4 → 5 必须串行。

**验收**：浏览器语言切到英文时，popup/sidebar/reader/通知全英文且无漏翻（抽查清单随批次维护）；中文环境显示与现状逐字一致；`npm test`、`npm run test:e2e` 通过。

### 5. 英文落地页 + 商店英文 listing（P0，约 2-3 天）

- [ ] `landing-page/en/` 复用现有单页结构与视觉，只做翻译与本地化（案例、FAQ）
- [ ] 中英页 `<link rel="alternate" hreflang>` 互指，sitemap 增加英文 URL
- [ ] og:image 用英文版分享图
- [ ] CWS 后台新增英文 listing（商店原生支持按语言）

**验收**：https://www.yilan.app/en 可访问，hreflang 双向有效（Rich Results Test / validator 检查），sitemap 含两个 URL。

### 6. 出海发布动作（P1，上线后一周内，零开发）

- [ ] Show HN（Show HN: Yilan – local-first AI reading workspace for Chrome）
- [ ] Product Hunt launch
- [ ] Reddit：r/chrome_extensions、r/LocalLLaMA、r/ArtificialInteligence 等，用 BYOK + 本地优先叙事
- [ ] README.en 加商店 badge；即刻/X 同步中文圈

**为什么值得**：BYOK + 本地优先在海外技术社区有天然受众，目前这个市场没人认领；发布动作本身免费，且只做一次。

---

## 第三梯队：留存与口碑（i18n 之后，切片进行 2-3 周）

### 7. 记忆库最小切片（P1，UPGRADE_DESIGN Phase 4 第一步）

- [ ] 「只保存 / 稍后读 / 保存并总结」三态入口（新增 `readStatus`/`captureMode` 字段，向后兼容旧记录）
- [ ] 标签/备注编辑 UI（复用现有 `tags`/`notes` 字段）
- [ ] 搜索覆盖 tags/notes（先评估性能，遵守"不把全文搜索和 UI 重构混批"的护栏）

**为什么值得**：从"摘要工具"变成"我的网页记忆库"才有回访理由和口碑传播素材——这是增长漏斗的留存端，也是产品差异化叙事。

**验收**：按 UPGRADE_DESIGN.md Phase 4 的验收标准执行（旧记录可读可删、字段缺失有默认值、导出可被外部识别）。

### 8. 内容 SEO（P2，持续，每周 1 篇）

- [ ] landing 站加 `/guides/` 内容页：如何用 AI 总结 YouTube 视频、B站 AI 总结工具对比、BYOK 配置教程等长尾词，中英各一份
- [ ] 每篇进 sitemap

**为什么值得**：sitemap 只有 1 个 URL 决定了自然流量的天花板，内容是复利项。

**验收**：每篇被 Google 收录（GSC 可查），内链回落地页与商店。

---

## 附：GSC / Bing 站长验证步骤（需本人账号操作）

1. Google Search Console → 添加资源 `https://www.yilan.app/` → 选"HTML 标记"验证 → 把给的 `<meta name="google-site-verification">` 加进 `landing-page/index.html` `<head>`
2. 同页提交 `https://www.yilan.app/sitemap.xml`
3. Bing Webmaster Tools 可直接从 GSC 导入
4. 之后在 GSC「效果」报告观察收录与点击

---

## 执行顺序总览

| 序 | 事项 | 成本 | 依赖 |
|---|---|---|---|
| 1 | Landing page SEO 收尾 | 2-3 小时 | 无 |
| 2 | CWS 中文列表关键词优化 | 1-2 小时 | 无 |
| 3 | GitHub Actions CI + 版本校验 | 半天 | 无 |
| 4 | chrome.i18n + UI 多语言 | 约 1 周（分批） | 无 |
| 5 | 英文落地页 + 英文商店 listing | 2-3 天 | 4 |
| 6 | 出海发布（HN/PH/Reddit） | 零开发 | 4、5 |
| 7 | 记忆库最小切片 | 2-3 周（切片） | 建议在 4 后 |
| 8 | 内容 SEO（/guides/） | 每周 1 篇，持续 | 5 后可中英并行 |

## 明确不建议现在做

- **构建工具 / wxt / vite / React 迁移推进**：走 TS_REACT_MIGRATION.md 专项，不和增长混批
- **Firefox 移植**：新战场，等出海站稳再评估
- **`<all_urls>` 权限收敛**：能减少安装警告页（对转化有实际影响），但迁移风险与测试量大，值得单独开专项
- **云同步 / 账号系统 / 公开内容流**：UPGRADE_DESIGN.md 已明确近期不做
