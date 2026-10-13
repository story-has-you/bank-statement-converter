# StatementXL 第一批 SEO/AEO 实施与验证

日期：2026-10-13。状态：已实现、待部署。

## 已实现

- 首页增加说明、核心转换指南与三个银行指南入口；12 种语言的产品品牌统一为 StatementXL，域名、logo 与 ReAvid Ltd 法律主体不变。
- 新增 `/pdf-bank-statement-to-excel` 及 Chase、Bank of America、Wells Fargo 三个银行页，全部覆盖现有 12 种语言，共 48 个页面 URL。页面直接复用上传、结果和套餐组件。
- 新页面独立 metadata、canonical、hreflang、WebPage、BreadcrumbList、FAQPage 和 HowTo；可见步骤、FAQ 与结构化数据使用同一内容源。
- sitemap、根目录 TXT 文档和各语言 AI 文档接入本批页面；新页面响应加入当前语言 llms.txt 描述链接，不声称存在页面正文的 Markdown 镜像。
- 更新选题看板与三份 brief：当前支持 Excel、CSV、JSON、Markdown、TSV、HTML；不承诺 QBO/Xero 专用文件、银行官方合作、全部版式支持或准确率。

## 已执行的检查

- 修改范围 ESLint、Prettier、TypeScript 无输出类型检查和 `pnpm build` 均通过。构建生成 188 个静态页面/资源；新转换入口与现有首页一样按请求渲染。
- 临时静态审计检查全部 48 组内容与 metadata、12 个语言资源的键结构、ICU 参数、富文本标签、空文案与新增英文占位；全部通过。
- 在模拟翻译上下文下，用实际 next-intl 翻译器和 React 静态渲染检查新页面内容组件及 JSON-LD；FAQ 与 HowTo 对应可见内容。未知 slug/locale 的拒绝逻辑检查通过。此检查不等同于 HTTP 或浏览器验收。
- 直接检查构建产物：sitemap 共 168 个唯一 URL，包含 48 个新 URL，每个带 13 个语言关系（12 种语言及 x-default）。36 份本地化 llms.txt、llms-full.txt、site.md，以及两份根目录 TXT 文档均包含新页面链接和 StatementXL 品牌。
- 按 code-simplifier 检查本轮实现：复用现有套餐、文件限制、风险与隐私说明，页面清单只维护当前四个入口，不增加 CMS、依赖或数据库变更。不新增单元测试。

## 待验收

实施前后均未发现 3000 端口监听服务，按约定没有自行启动服务。因此以下项目尚未实际执行：

- 首页及四类页面在桌面、移动端、深浅主题下的布局、溢出、语言切换和控制台检查。
- 浏览器合成文件与模拟转换响应：文件校验、进入当前语言结果页、成功/部分结果/失败、下载以及离开结果页的状态清理。
- 未知银行路径的实际 HTTP 404、新页面响应 Link 头及完整 HTTP metadata 验收。

没有运行真实解析、支付或生产数据操作，没有提交、推送或部署。实际银行版式支持、真实支付、搜索收录与排名、部署后的生产域名效果均未验证。
