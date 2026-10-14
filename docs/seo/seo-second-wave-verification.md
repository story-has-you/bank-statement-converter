# StatementXL 第二批 SEO/AEO 实施与验证

日期：2026-10-14。状态：已实现、待部署。

## 实施范围

- `/scanned-bank-statement-to-excel`：扫描件转换指南，说明 Professional/Enterprise 与剩余额度要求、常规解析优先、条件式 AI 兜底、结果核对及外部数据处理。首屏套餐比较链接指向本页配置驱动的套餐区；上传区隐藏免费额度提示，避免暗示免费扫描权益。
- `/guides/bank-statement-to-quickbooks`：PDF 转换、交易核对、整理三/四列 CSV、在 QuickBooks Online 导入并对账的手动教程。提供虚构三/四列示例，明确风险与来源列保留作核对、从导入副本删除。没有增加 QBO 专用导出、账号连接、自动导入或批量解析能力。
- 两页覆盖现有 12 种语言，共 24 个 URL；复用现有上传、结果、套餐和页面区域。独立标题、metadata、canonical、hreflang、WebPage/BreadcrumbList/FAQPage/HowTo，步骤与 FAQ 使用同一内容源。
- 页面清单统一接入首页、既有银行页及核心页的相关导航、sitemap 和 AI 文档。银行 slug 白名单仍只有三个银行。

## 官方资料核实

通过浏览器读取以下 Intuit 美国版官方帮助，核实日期为 2026-10-14；没有登录 QuickBooks 或执行导入。

- [CSV 格式](https://quickbooks.intuit.com/learn-support/en-us/help-article/bank-transactions/format-csv-files-excel-bank-transactions-quickbooks/L4BjLWckq_US_en_US)：Date/Description/Amount 或 Date/Description/Credit/Debit。官方银行账户示例的支出在 Amount 为负数、四列 Credit 为正数；入账在 Amount 为正数、四列 Debit 为正数。信用卡需选择实际账户并核对方向。
- [手动上传交易](https://quickbooks.intuit.com/learn-support/en-us/help-article/import-transactions/manually-upload-transactions-quickbooks-online/L0rE9OXBz_US_en_US)：英文交易文件、350 KB 上限、最多 1,000 行交易、统一日期（官方建议 dd/mm/yyyy），正确账户与字段映射、检查重复、匹配分类和对账。
- 当前官方资料还提供 PDF/图片直接导入，因此本教程明确 CSV 是可选的核对整理流程，不声称 QuickBooks 无法接收 PDF。
- 示例表头和描述在全部语言中保留英文，以呈现官方要求的英文导入文件；说明、标题、无障碍文字和 metadata 均完整本地化。表头通过 next-intl 资源读取。

## 已执行验证

- 修改范围 ESLint、TypeScript、Prettier、生产构建通过；没有新增依赖或单元测试。
- 临时静态审计验证六类页面 × 12 种语言共 72 组内容/metadata/JSON-LD；12 个语言资源键结构、ICU 参数和完整译文通过，示例英文数据属于明确的导入格式内容。
- 构建 sitemap 为 192 个唯一 URL，本批新增 24 个。36 份本地化 llms.txt、llms-full.txt、site.md 均包含两个新页面。
- 使用现有 3000 服务，浏览器检查两个页面 × 12 种语言 × 手机/桌面及深/浅主题，共 96 次，单一 H1、HTML 语言、主题、metadata、无横向溢出和运行时异常检查通过。
- HTTP 检查 24 个新页面均为 200，canonical、13 个 hreflang、当前语言 llms.txt 描述链接正确；12 种语言的未知银行路径保持 404。
- 35 项浏览器交互通过：12 种语言切换保留路径/查询/锚点；非 PDF、空文件、超限、多文件校验；12 次模拟成功/部分结果、Excel 下载及英文 CSV 内容；离开确认取消保留、接受清除；模拟失败不下载、不保存；取消后迟到响应不恢复。
- 14 次转换请求全部由浏览器模拟响应，未发送真实解析、支付或扣额请求。模拟扫描入口只证明页面接入，不证明订阅权益校验或真实扫描识别效果。
- 24 个本地化套餐比较链接跳转到本页 #plans；12 种语言的 CSV 示例列与金额方向通过，扫描页上传区免费额度提示隐藏，首页完整展示六个内容入口。
- 中文 QuickBooks 页主内容 axe-core 4.12.1 自动检查零违规、零待确认项。
- 按 code-simplifier 复核：仅扩展当前页面清单和共享内容，复用已有套餐、限制、风险与隐私资源；不添加 CMS、抽象支付模块或导入 API。

## 验收边界

本轮未提交、推送或部署，没有更改套餐、数据库或真实财务数据。真实扫描件效果、已登录订阅与支付、QuickBooks 实际导入、生产域名及搜索收录/付费转化提升未验证。截图及机器检查记录保存在当前聊天本地成果目录。
