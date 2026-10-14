# StatementXL（bankstatementconverter.xyz）SEO/AEO 选题看板（2026-10-14 更新）

> 说明：本看板只围绕我们自己的网站和产品，不做竞品对比类内容。没有使用任何搜索量、难度或排名数字。“搜索结果观察”一栏只记录这些词搜出来的页面类型，作为中性参考。首批页面覆盖现有 12 种语言；本看板以英文目标词描述选题，各语言正文和 metadata 分别本地化。

## 网站现状

- 实施前的 sitemap 已包含首页、隐私、条款和 AI 文档的语言版本；第一批新增核心落地页和 3 个银行页，共 48 个 URL；第二批新增扫描件与 QuickBooks 教程共 24 个 URL，合计 72 个内容页 URL。
- 已有 llms.txt、llms-full.txt 和 /ai/en/*.md（产品、价格、隐私、FAQ），AEO 基础不错；新页面上线后要同步加进去。
- 首页 Title、页眉页脚、结构化数据和 AI 文档中的产品品牌统一为 StatementXL；域名与法律主体不变。

## 选题排名

| 排名 | 选题                                                      | 目标词（英文）                                                                         | 受众                           | 意图      | 为什么排在这里 / 搜索结果观察                                                                                                          | 状态           |
| ---- | --------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1    | 首页优化 + 新建 /pdf-bank-statement-to-excel 落地页       | bank statement converter; bank statement to excel; convert bank statement pdf to excel | 记账员、小企业主、个人         | 交易型    | 这是核心产品词，所有其他页面都会链回这里。这些词的搜索结果主要是可以直接上传使用的工具页。                                             | 已实现、待部署 |
| 2    | 美国大银行专页：Chase、Bank of America、Wells Fargo       | chase / bank of america / wells fargo statement to excel                               | 美国个人、记账员               | 交易型    | 用户已经拿着某家银行的 PDF，离转换最近。内容可以用银行官方帮助页做依据，用一套模板批量复制。搜索结果以单个银行的转换页和下载教程为主。 | 已实现、待部署 |
| 3    | 扫描件流水转 Excel（AI 处理）                             | scanned bank statement to excel; bank statement ocr                                    | 手里只有扫描件或纸质账单的用户 | 交易型    | 对应 Professional/Enterprise 的 AI 兜底功能，直接带动高档套餐。搜索结果多为工具页。                                                    | 已实现、待部署 |
| 4    | 转 QuickBooks 教程（Excel → 3/4 列 CSV）                  | convert bank statement to quickbooks; pdf bank statement to quickbooks online          | 记账员、QuickBooks Online 用户 | 信息+交易 | 记账员是付费主力。搜索结果以操作教程为主。当前可下载 Excel 或 CSV，但需要按 QBO 要求整理列；不能宣称直接生成 QBO 专用文件或自动导入。  | 已实现、待部署 |
| 5    | 更多银行专页：Capital One、Citi                           | capital one / citi statement to excel                                                  | 美国个人                       | 交易型    | 直接复用第 2 条的模板。                                                                                                                | idea           |
| 6    | 信用卡账单转 Excel（Amex、Apple Card、Chase 卡）          | credit card statement to excel; amex statement to excel                                | 个人、报销用户                 | 交易型    | 很多信用卡只提供 PDF 账单；可以和银行页互相内链。                                                                                      | idea           |
| 7    | PDF 流水转 CSV（Excel → CSV 的操作说明）                  | pdf bank statement to csv; convert bank statement to csv                               | 记账员、开发者                 | 交易/信息 | 需求和 Excel 很接近。当前已支持 CSV 下载；CSV/TSV 每个逻辑表单独导出，包含风险和来源字段。教程应解释如何检查和使用结果。               | idea           |
| 8    | 如何去掉流水 PDF 的密码再转换                             | password protected bank statement pdf; unlock bank statement pdf                       | 被加密 PDF 卡住的用户          | 信息型    | 我们不支持加密 PDF；这篇教程能减少转换失败，也能带来流量。                                                                             | idea           |
| 9    | 隐私与数据处理说明页                                      | is it safe to upload bank statements online; bank statement converter privacy          | 谨慎型用户、AI 助手提问        | 信息型    | 我们不保存文件历史，AI 处理时会发给第三方，这些都是真实可写的事实，AI 助手常被问到安全问题。                                           | idea           |
| 10   | 准确性与风险标记说明（OK / DISCREPANCY / UNVERIFIABLE）   | bank statement converter accuracy; check converted bank statement                      | 记账员                         | 信息型    | 解释我们自己的逐行标记，教用户怎么用期初、期末余额核对。                                                                               | idea           |
| 11   | 流水转 Xero 教程                                          | bank statement to xero; import bank statement into xero                                | 英、澳、新西兰的 Xero 用户     | 信息型    | 和 QuickBooks 教程同一套写法，写成“从 Excel 整理成 Xero 能导入的格式”。                                                                | idea           |
| 12   | 英、澳、加银行合集页（Barclays、HSBC、CommBank、RBC、TD） | barclays statement to excel; commbank statement to csv                                 | 美国以外的英语用户             | 交易型    | 美国银行页验证过模板后再扩展。                                                                                                         | idea           |

## 下一步建议

1. 第 1 条和第 2 条已实现，新增 URL 已接入 sitemap、llms.txt 和各语言 AI 文档，已完成本地浏览器及 HTTP 验收，当前待部署与线上复核。代码实现不代表已上线、已收录或银行版式已验证。
2. 第 3 条和第 4 条已实现：扫描件入口说明高阶套餐权益，QuickBooks 教程承接补账与 CSV 整理需求；均覆盖 12 种语言，已接入 sitemap 和 AI 文档。待部署后观察真实搜索与订阅转化，不以页面实现推断效果。

## 第一批验收边界

不运行真实解析或支付，不修改数据库，不提交、推送或部署。2026-10-14 已使用现有 3000 端口服务完成第一批浏览器、模拟转换和 HTTP 验收。未自行启动新服务。静态检查与构建结论见 `seo-first-wave-verification.md`。

## 第二批验收

扫描件与 QuickBooks 教程复用现有转换和套餐链路；没有增加真实导入或金融操作。官方资料、静态检查与本地模拟验收记录见 `seo-second-wave-verification.md`。
