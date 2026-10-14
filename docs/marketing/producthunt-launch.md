# StatementXL — Product Hunt 发布资料

准备日期：2026-10-14（Asia/Shanghai）。

状态：已在 Product Hunt 提交并完成排期，后台已确认 `Launch status: Scheduled`。

- 上线时间：2026-10-15 15:01（Asia/Shanghai）；平台确认页显示 October 15 at 12:01am PT (03:01pm GMT+8)，持续 24 小时。
- 产品链接：https://www.producthunt.com/products/statementxl?launch=statementxl
- 发布后台：https://www.producthunt.com/products/statementxl/statementxl/prelaunch
- Maker / Hunter：当前登录账号 reavid（@fangxisama）。

## 产品信息

- Name: StatementXL
- Website: https://bankstatementconverter.xyz
- Tagline: Bank statement PDFs to Excel, with risky rows flagged
- Pricing: Paid (with a free trial or plan)，产品页显示 Free Options
- Platform: Web
- 已选择 Launch tags：Productivity、Accounting。
- 发布入口：https://www.producthunt.com/posts/new

## Description

```text
Turn bank statement PDFs into Excel or CSV, with row-level risk flags and source references to help you check the results. Export JSON, Markdown, TSV or HTML too. Try 1 free page daily without an account, or 5 when signed in. Paid plans start at $19.90/month. Professional and Enterprise can attempt scanned PDFs with AI fallback. No persistent file history on our site. Review exports against the original statement.
```

## First comment

```text
Hi Product Hunt!

StatementXL converts bank statement PDFs into spreadsheets for review and bookkeeping. The focus is making the extracted transactions easier to check against the original PDF.

Each extracted row includes a status: OK, DISCREPANCY or UNVERIFIABLE. Risk reasons and source page references help you investigate rows that need attention. An OK status does not guarantee that every transaction was captured correctly, so please review the export against your statement.

You can preview the results and download Excel, CSV, JSON, Markdown, TSV or HTML. The interface is available in 12 languages.

Try 1 page per day without signing in, or 5 pages per day with a free account. Paid plans start at $19.90/month for 500 pages. Uploads are limited to one PDF at a time, up to 4 MB and 50 pages. Free and Standard access require a text-based PDF; Professional and Enterprise can attempt scanned PDFs through AI fallback. Password-protected PDFs are not supported.

Our site does not keep a persistent history of PDFs, exports or transaction details. Higher-tier AI fallback sends the PDF to a third-party provider, whose terms and privacy policy apply.

I'd love to hear which statement layouts you work with and what would make the review process more useful. Please remove personal and financial information before sharing any examples.
```

## 展示素材

- `product-icon.png`：基于网站现有 `public/logo.svg` 导出的 240 × 240 PNG。
- `01-convert.png`：正式网站英文首页上传区域的实际截图。
- `02-review-features.png`：正式网站功能说明区域的实际截图。
- `03-pricing.png`：正式网站免费额度与套餐区域的实际截图。

素材位于 [Product Hunt 素材目录](producthunt-assets/)。截图只展示公开页面，不包含用户账单、账号或交易数据。

## 核对依据与范围

- 正式官网：https://bankstatementconverter.xyz
- 产品范围：[产品边界](../product/product-boundary.md)。
- 免费额度与价格：`src/config/plans.ts`。
- 导出范围：`README.md` 与 `messages/en.json`。
- 已实际打开正式网站，核对首页、上传限制、风险说明、免费额度和套餐展示。
- 未在本次执行真实 PDF 转换、支付或第三方 AI 解析；这些能力按现有代码、文档及网站公开说明描述。
- 不宣称通用银行兼容性、百分之百准确率、专用 QBO 文件或直接连接会计软件。
- 没有设置上线折扣或优惠码。

## 提交记录

- 用户在 Safari 登录并开启 Apple Events JavaScript 后，使用现有登录状态完成发布表单。
- Name 11/40、Tagline 53/60、Description 417/500；首条评论已填写并保存。
- 图标和三张截图已上传，图片列表中核实成功；必填项检查显示 100% Complete。
- Maker 与 Hunter 使用当前登录账号；融资、促销、第三方产品评论和投资者联络信息未填写。
- 平台当前提供 Create draft 与 Schedule launch for later，最早可选 2026-10-15。
- 创建草稿后选择 2026-10-15，并点击 Confirm scheduled date 完成提交。
- 已进入 Pre-Launch Dashboard，实际读取到 Launch status: Scheduled；当前是已排期状态，尚未到上线时间。
- 后台确认记录保存在 [submission-confirmation.json](producthunt-assets/submission-confirmation.json)。
