# 第三批 SEO/GEO 实施与验证

日期：2026-10-19。状态：已落盘、本地验收，未提交、推送或部署。曦已取消站外推广，本轮不准备社区回复、平台推广资料，不操作第三方后台。

## 页面与发布门槛

新增 13 个主题、完整 12 语，共 156 个页面 URL：

- 三个对比/替代品页：StatementXL 与 DocuClipper、DocuClipper alternatives、StatementXL 与 Nanonets。
- 六个用途页：Xero、Wave、英国 Sage Accounting、贷款材料、报税资料、补账。
- 三个独立页：关于品牌、免费余额核对器与 Excel 模板、公开样本报告。
- 一个银行页：HSBC 英国个人 GBP 往来账户，依据官方账单说明描述汇总区域、页码和缩写，不承诺版式已通过解析验收，也不推断固定交易列序。

公共内容清单包含 7 个既有/新增转换主题和 12 个新独立内容主题。加首页、隐私和条款，第三批初版为 22 × 12 = 264 个 HTML URL；加 84 个 AI 文档 URL，共 348 个 URL。随后新增 12 语资源目录，当前 sitemap 合计 **360 个唯一 URL**。其余六个银行主题仍须通过资料门槛后才能加入。

以下银行页未注册路由内容，不进入内链、sitemap 或 hreflang，访问相应路径返回 404：

| 待发布主题                   | 本次取得的证据                                                                                                                                                                                            | 缺少的材料                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Citi 美国个人支票账户        | [Online Bank Statements](https://online.citibank.com/US/JRS/pands/detail.do?ID=OnlineState)；检索还出现 CitiDirect 商业报告                                                                               | 符合个人支票账户范围的公开版式；不把商业报告套用到个人账户 |
| Capital One 美国个人支票账户 | [官方 sample-estatement.pdf](https://ecm.capitalone.com/WCM/bank/pdfs/sample-estatement.pdf)，已渲染核实为 2013 年 360 Savings 示例                                                                       | 当前个人支票账户版式；不能用旧储蓄样本冒充                 |
| Barclays 英国个人 GBP        | [官方下载说明](https://www.barclays.co.uk/help/accounts/statements-balances/print-online-statements/)                                                                                                     | 可核实的目标账单交易区域、列及余额说明                     |
| Revolut 英国个人 GBP         | [官方币种账单帮助](https://help.revolut.com/help/profile-and-plan/managing-my-account/account-statement-per-chosen-currency/)，浏览器读取确认原生 PDF/Excel、余额汇总、待处理/已完成/已撤销交易及 Pockets | 可核实的目标 PDF 交易版式，不能仅凭功能列表写列序          |
| Wise 英国个人 GBP            | [官方下载说明](https://wise.com/help/articles/2736049/how-do-i-download-a-statement)，确认币种/Jar、365 天范围、原生 CSV/XLSX、费用单列选项                                                               | 目标 GBP 版式材料，不能拿导出选项推断 PDF 列序             |
| Monzo 英国个人 GBP           | 检索取得社区讨论，但不是可直接使用的官方个人 GBP 账单版式                                                                                                                                                 | 官方版式说明或获准使用的脱敏样本；不采用不明来历的个人账单 |

## 内容证据与品牌

- DocuClipper：[官方价格/功能](https://www.docuclipper.com/pricing/)。确认多种财务文档、QBO、API/Webhooks、批量流程。对比保留对方优势，没有复述其准确率宣传作为独立结论。
- Nanonets：[官方价格](https://nanonets.com/pricing)、[银行流水入口](https://nanonets.com/bank-statement-converter/)。确认 API、邮件、云连接、工作流模块计费及高阶 ERP 等能力；不把积分换算为 PDF 页数。
- Xero：[CSV 导入正文](https://central.xero.com/0/article/Import-a-CSV-bank-statement)，浏览器展开正文核实 Date/Amount、正负金额、移除余额/账号/空行、列映射及日期格式；明确其他导入方式也存在。
- Wave：[CSV 上传正文](https://support.waveapps.com/hc/en-us/articles/208621626-Upload-a-bank-or-credit-card-statement-in-csv-format)，浏览器核实目标账户、日期/金额/摘要预览，区分支票账户存款与卡消费。
- Sage：[当前格式要求](https://gb-kb.sage.com/portal/app/portlets/results/viewsolution.jsp?solutionid=240718093942637)，正文标注 2026-08-20 更新；展开 CSV 区核实 Date/Description/Money in/Money out 顺序及日期、单行摘要和数字要求。范围为英国 Sage Accounting。
- HSBC：[账单说明](https://www.hsbc.co.uk/help/banking-made-easy/understanding-your-statement/)、[在线账单](https://www.hsbc.co.uk/help/banking-made-easy/online-statements/)。前者明确右上汇总、sheet number、CR/DR/DD/SO/TRF 含义。
- 报税：[IRS 记录保存](https://www.irs.gov/businesses/small-businesses-self-employed/recordkeeping)。只讲记录整理，不把银行交易自动视为可抵扣项目。

品牌 Organization 的固定 ID 为正式站点 `/#organization`，与 WebSite、WebApplication、内容作者和发布者关联。作者统一 StatementXL。当前 sameAs 只有已核实的 [DEV 品牌主页](https://dev.to/statementxl)；不添加未经核实的 GitHub、F6S、Hashnode、LinkedIn，不推断创始人或法律主体。旧指南保留原核实日期，新增页采用实际本次复核日期，构建不刷新日期。

## 实测报告与模板

报告使用 [Carson 官方样本](https://www.carsonbank.com/wp-content/uploads/2021/01/Sample-Statement.pdf)原第 1–2 页和 [BHW 官方指南](https://www.bhw.de/dam/bhwde/pdf/Jahreskontoauszuege_koop_2024.pdf)原第 12 页，渲染后独立转录有日期的交易，排除期初/期末余额。BHW 选页作为独立输入。原始公开 PDF 不复制发布在仓库。

| 样本   | 参考交易 | 提取行 | OK / DISCREPANCY / UNVERIFIABLE | 未匹配参考行 | 额外行 | 字段差异 |
| ------ | -------: | -----: | ------------------------------- | -----------: | -----: | -------: |
| Carson |       47 |     47 | 47 / 0 / 0                      |            0 |      0 |       11 |
| BHW    |       30 |     31 | 30 / 0 / 1                      |            0 |      1 |        0 |

Carson 的 11 处都是摘要中 ACH 与 DEBIT 之间空格丢失，仍被标记 OK。BHW 额外一行是期末余额，因无日期标为 UNVERIFIABLE。77 笔参考交易均按日期、金额、方向匹配；额外余额不算交易。程序状态分布以 78 个提取行为分母，77/78 = 98.7%，**不代表准确率**。匹配采用每行最多一次的日期/金额/方向比对，字段只规范空白；一般情况下未匹配参考行不必然已证明漏行。

复现（仅公开样本下载和本地解析，不使用真实账户、模型或额度）：

```bash
services/parser/.venv/bin/python scripts/seo/benchmark.py \
  --cache-dir /tmp/statementxl-public-samples \
  --output /tmp/statementxl-public-report.json
```

Python 环境需现有解析器依赖及 `pypdf`（仅用于测评选页，不是新增线上服务依赖）。参考转录位于 `docs/seo/benchmark/reference.json`；发布数据为 `public/research/bank-statement-parsing-benchmark.json`，包含原文件和参考数据哈希、选页、实际测量时间、解析器提交及源码哈希。网页直接读取该数据，避免手工维护两套统计。没有为改善报告修改解析器。

核对器采用整数分、一个账户/币种/期间、最多两位小数；期初期末可负，收入支出非负，输入上限 12 位整数以保持中间计算精确。接受点或逗号作小数分隔符，不接受千位分组。输入只放在页面内存，无登录或上传。

`public/templates/balance-checker-{locale}.xlsx` 为 12 份完整本地化模板。表内含空白输入、有效性条件、期末余额、差额和结果公式；无效或缺失输入不显示相符。已使用 Artifact Tool 重算代表输入、检查零值/负余额/小数/无效/空输入，并渲染检查全部语言。没有在原生 Excel 或 Google Sheets 中验收。

## 缓存、账户与索引准备

- 页眉不再在服务端读 Cookie；报价区保留静态价格、文案和额度，将当前套餐、取消后账期及购买入口状态下沉到客户端。全局共享一次账户状态订阅；会话变化清除旧状态，迟到响应不会恢复旧账户信息。
- 新增只读 `GET /api/account/summary`，只验证用户并读取订阅，返回展示信息、有效套餐、是否已有有效/开放订阅和取消后到期时间；不调用渠道同步，不写库。正常、匿名及失败响应均 `private, no-store`。加载、读取失败时无购买入口；有效或待处理订阅继续隐藏购买入口。
- 公共路径在 proxy 中仅作语言路由与 GEO 链接，不刷新会话或写认证 Cookie；账户等动态页面保留原认证流程，API 继续自行校验身份。
- 构建产物确认公共 HTML 全部静态生成；没有覆盖公共响应头来伪装缓存，也没有给账户或支付接口开启公共缓存。未部署，因此未声明生产缓存或 TTFB 改善已验证。
- 可选服务器配置：`GOOGLE_SITE_VERIFICATION` → Google 验证 metadata；`BING_SITE_VERIFICATION` → `msvalidate.01`。未配置时不输出验证值；没有绑定后台，也没有真实收录数据。
- IndexNow 公共验证键位于 `src/config/indexnow.json`，对应根目录 `.txt` 文件随静态资源部署。它是公开的站点验证值，不是账户凭据。工具默认仅预览：

```bash
# 先产生正式域名的本地 sitemap；不会部署或通知搜索引擎
VERCEL_ENV=production pnpm build
node scripts/seo/indexnow.mjs
# 仅预览选定 canonical；也可指定 --sitemap FILE
node scripts/seo/indexnow.mjs --url https://bankstatementconverter.xyz/about
```

仅未来另行授权提交时使用 `--submit`。脚本只接受正式域名、sitemap 中的公共 HTML canonical；先检查已部署根键文件，再发送 IndexNow 通知。构建不发送，预览不发送；收到 200/202 也只表示通知被接受，不证明收录。

## 本地验证与边界

- TypeScript、ESLint、修改范围 Prettier、生产构建、差异空白检查；未新增单元测试。
- 静态审计：264 份公共 HTML、12 语 H1/lang/canonical/13 个 hreflang、Organization、可见 FAQ 与 JSON-LD 一致；348 个唯一 sitemap URL；36 份 llms/llms-full/site 文档覆盖公开内容；六个未核实银行路径不进入索引清单。
- 使用已有 3000 服务：156 个新增页面返回 200；12 语的未发布银行及未知路径共 108 次检查返回 404。浏览器检查 12 语手机深色核对器、手机浅色对比页、桌面浅色报告共 36 组，H1/语言/主要控件或表格正确，无页面横向溢出或框架错误层。
- 核对器浏览器操作覆盖相符、正负差额、负余额、零流水、点/逗号小数、负收入、三位小数、空值、金额边界及重置；语言切换保留路径、查询和锚点。实际下载的中文模板与发布资源哈希一致；保存后的 12 份 XLSX 都含所需公式且无公式错误单元格。
- 临时模拟覆盖匿名、已登录无订阅、有效订阅、待处理订阅、取消后仍有效、读取失败及加载状态，检查只读 API 响应和实际组件渲染，不创建支付或写入数据库。没有真实账单上传、真实登录/订阅或模型调用。
- 以 code-simplifier 复核：复用现有转换清单、组件、next-intl 和订阅选择规则；未引入 CMS、数据库迁移、银行连接、会计集成或新运行依赖。
- 未执行：Git 提交/推送、部署、GSC/Bing 绑定、IndexNow 通知、真实支付/订阅/登录验收、会计软件实际导入、搜索收录/排名/AI 引用验证。站外推广已按曦最新要求取消。

## 首页资源区调整（2026-10-19）

- 首页顺序调整为上传、功能、套餐、FAQ、精选指南与工具、页脚；精选区保留 PDF 转 Excel、扫描件、QuickBooks 和余额核对器四个短标题。桌面实测区域高度由 993 px 降至约 343 px。
- 新增 `/resources`，覆盖完整 12 语；以转换基础、银行账单、软件导入、记账资料、产品对比、工具与报告六组提供 18 个内容入口。关于品牌保留在页脚，不混入指南目录。
- 所有专题页共享推荐区改为最多四个相关主题，排除当前页，并链接完整资源目录；页脚也提供目录入口。所有链接在初始 HTML 中可见，不依赖客户端加载。
- 资源目录接入公共清单，自动进入 sitemap、hreflang、llms/llms-full/site 文档及 proxy 的公共静态路径。新增 CollectionPage、ItemList 和 BreadcrumbList，条目与可见目录一致。
- 删除仅用于旧全量推荐区的三个已无调用翻译键，完整保留正文、metadata 和其他既有翻译。
- TypeScript、ESLint、生产构建及修改范围格式检查通过；十二个目录全部预渲染，sitemap 360 个唯一 URL。静态审计覆盖 12 语首页精选及顺序、目录的 18 个唯一链接与 6 组、228 个专题推荐区、36 份 AI 文档；目录 12 语 HTTP 均为 200。手机浏览器检查 24 组首页/目录，均无横向溢出或框架错误层。未新增单元测试，未提交、推送或部署。
