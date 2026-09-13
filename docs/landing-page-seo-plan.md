# 落地页 SEO 与转化优化任务单（ZCode 执行）

> 来源：2026-09-04 落地页调研（实测 www.yilan.app 线上状态 + landing-page/index.html 源码）
> 目标：补齐 SEO 基础配置、修正分享元数据、提升商店转化，不改动现有视觉设计与整体布局。

## 背景事实（已核实）

- 线上域名：`yilan.app` → 307 → `www.yilan.app`（Cloudflare + Vercel 静态托管，cleanUrls 已开）
- 扩展已上架 Chrome Web Store：
  `https://chromewebstore.google.com/detail/%E4%B8%80%E8%A7%88-ai-%E9%98%85%E8%AF%BB%E5%B7%A5%E4%BD%9C%E5%8F%B0/danicaalimfiaednaiellfgbkihjlanh`
- 当前页面截图素材是真实产品图（landing-page/assets/screens/*.png，约 375–915KB），但 alt 文案仍写着「占位图」
- robots.txt 目前由 Cloudflare 托管生成（search=yes，拦截 AI 爬虫）；仓库 landing-page/ 下没有 robots.txt / sitemap.xml
- 站点暂无 Google Search Console 接入记录、无统计（用户后续自行处理，本单不做）

## 任务清单

### 1. index.html `<head>` 补齐（P0）

在现有 `<meta name="theme-color">` 之后、主题切换 `<script>` 之前插入：

```html
<link rel="canonical" href="https://www.yilan.app/">
<meta property="og:url" content="https://www.yilan.app/">
<meta property="og:site_name" content="一览 Yilan">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="一览 Yilan | 网页、YouTube 与 B 站视频的 AI 摘要浏览器扩展">
<meta name="twitter:description" content="BYOK 本地优先：网页抽取、YouTube 字幕、B 站官方 AI 总结、结构化摘要、历史沉淀与专注阅读。">
<meta name="twitter:image" content="https://www.yilan.app/assets/screens/hero-main-light.png">
```

同时把现有两处改掉：
- `og:image` 的 `content` 从相对路径 `./assets/screens/hero-main-light.png` 改为绝对地址 `https://www.yilan.app/assets/screens/hero-main-light.png`（`data-light-src`/`data-dark-src` 保持相对路径不动，那是页面主题切换用的）
- `og:title` / `og:description` 与新的 twitter 文案对齐即可，不必完全相同

### 2. JSON-LD 结构化数据（P0）

`</head>` 前插入三块（合并成一个 `<script type="application/ld+json">` 数组输出）：

- `SoftwareApplication`（name=一览 Yilan，applicationCategory=BrowserApplication，operatingSystem=Chrome/Edge 等 Chromium，offers 价格 0，url 官网，sameAs GitHub 仓库，aggregateRating 不填占位假数据）
- `WebSite`（name=一览 Yilan，url=https://www.yilan.app/）
- `FAQPage`（把页面现有 6 条 FAQ 逐字映射成 question/answer，答案与页面上显示的一致，含 kbd 的写纯文本）

### 3. title 与 description 优化（P0）

- `<title>` 改为：`一览 Yilan - 网页 / YouTube / B 站 AI 摘要浏览器扩展（BYOK 本地优先）`
- `description` 改为：`一览是一款本地优先的 Chromium 浏览器扩展：网页正文智能抽取、YouTube 字幕与翻译字幕总结、Bilibili 官方 AI 总结或字幕回退、结构化摘要与二次生成、历史收藏与专注阅读。BYOK，自带 API Key 即用。`

### 4. 图片 alt 文案替换（P0）

把四处「占位图」alt 改为描述性文案：
- hero：`一览侧栏生成 YouTube 视频结构化摘要的产品界面`
- workflow：`一览工作流：网页触发、结构化总结、历史沉淀三步流程界面`
- history-reader：`一览历史列表与独立阅读器界面`
- settings-panel：`一览设置页：模型厂商预设与 API Key 配置界面`

### 5. CTA 换成 Chrome 商店直达（P0，转化关键）

- hero 区 `开始使用` 主按钮：href 改为商店地址 `https://chromewebstore.google.com/detail/%E4%B8%80%E8%A7%88-ai-%E9%98%85%E8%AF%BB%E5%B7%A5%E4%BD%9C%E5%8F%B0/danicaalimfiaednaiellfgbkihjlanh`，加 `target="_blank" rel="noreferrer noopener"`，文案改为 `从 Chrome 商店安装`
- cta-band 主按钮 `打开仓库` 保持 GitHub 不动；在其下方/旁边新增一个次按钮 `Chrome 商店安装` 指向商店地址
- 页头 `GitHub` 按钮保持不动；`反馈` 保持 issues 链接
- FAQ 第一条或新增一条 FAQ：「怎么安装？」答案指向商店链接与 GitHub Releases（如有）。若加新 FAQ，同步更新 JSON-LD FAQPage

### 6. sitemap.xml + robots.txt（P0）

新建 `landing-page/sitemap.xml`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>https://www.yilan.app/</loc>
    <lastmod>2026-09-04</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
    <image:image>
      <image:loc>https://www.yilan.app/assets/screens/hero-main-light.png</image:loc>
    </image:image>
  </url>
</urlset>
```

新建 `landing-page/robots.txt`（让 Vercel 提供自有 robots，覆盖 Cloudflare 托管版；保持 search 允许、AI 训练拒绝的意图一致）：

```
User-agent: *
Allow: /
Disallow: /api/

User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

Sitemap: https://www.yilan.app/sitemap.xml
```

### 7. 截图体积优化（P1，可选但建议）

8 张 PNG 共约 5MB，首屏 hero 888KB。若环境有 `npx sharp-cli` 或 ImageMagick/cwebp：
- hero / workflow 转 WebP（quality 82，保持 1280x800 尺寸与 data-light-src/data-dark-src 成对结构，`src` 换成 webp、`data-light-src`/`data-dark-src` 同步换成 .webp）
- 若工具不可用，跳过并在交付说明中注明，由用户后续手动处理；**不要**为了压缩而改变现有 HTML 结构或用 base64 内嵌

### 8. 其他（P1）

- `og:image` 建议同时给 `width`/`height`（1280/800）属性（可选）
- 检查 `meta name="robots"` 不存在即为默认放行，无需添加

## 交付与验证清单

改完后在 `landing-page/` 内自查：

1. `index.html` 无 HTML 结构错误（可用 `npx html-validate` 或目检），三处 JSON-LD 用 https://validator.schema.org 或本地解析检查语法
2. `curl -sL https://www.yilan.app/ | grep -o '<link rel="canonical"[^>]*>'` 应输出 canonical 且为 www 域名
3. 所有 og:image / twitter:image / sitemap 里的图片地址均为 `https://www.yilan.app/...` 绝对路径
4. 商店地址可访问（HTTP 200）
5. git diff 只涉及 landing-page/ 目录内文件（index.html、新增 sitemap.xml、robots.txt、assets/screens/*.webp 若转换），不触碰扩展本体代码
6. 若部署流程是推 GitHub 后 Vercel 自动发布，则本次只提交不改动仓库其他区域；提交信息建议：`chore(landing): add SEO meta, JSON-LD, sitemap and store CTA`

## 明确不做

- 不动 styles.css / premium.css / theme.js / vercel.json（除非确有必要且理由充分）
- 不改扩展本体（manifest.json、popup、sidebar、background、content）
- 不做英文版 / hreflang / 多页面
- 不接统计代码（用户另行决定）