# 写作 Brief：Bank of America Statement to Excel（StatementXL / bankstatementconverter.xyz）

> 这是给写手的 brief，不是正文。结构和 Chase brief 一样（套用其中第 11 节模板）。英文版本按本文目标词和标题编写，页面同时提供现有 12 种语言的完整本地化版本。不使用任何搜索量或排名数字。

## 1. 目标与搜索意图

- **目标**：承接 “Bank of America statement to Excel” 一类搜索，让用户当场上传 PDF 转换，再引导注册或订阅。
- **意图**：交易型为主；其次是信息型（怎么下载 BofA 的 PDF，怎么拿到更早的账单）。
- **受众**：做报税、贷款或审计的美国个人；替客户补账的记账员；小企业主（BofA Business Advantage）。

## 2. URL

`/banks/bank-of-america-statement-to-excel`。用 “bank-of-america” 而不是 “bofa”，“BofA” 作为次要词放在正文里。

## 3. 目标词

- **主词**：bank of america statement to excel; convert bank of america statement to excel
- **次要词**：bofa statement to excel; bank of america pdf statement to csv; bank of america credit card statement to excel; download bank of america statement pdf; bank of america statements older than 18 months
- **相关实体**：Online Banking、Mobile Banking app、Statements & Documents、Request statements、checking、savings、credit card、Account Summary、beginning/ending balance

## 4. Title 和 Meta

- **Title**：`Bank of America Statement to Excel – Convert BofA PDFs | StatementXL`
- **Meta description**：`Convert a Bank of America statement PDF to Excel with StatementXL. 1 free page a day without signing in, 5 when signed in. No file history kept. Review flagged rows before download.`

## 5. H1 和大纲

**H1**：`Convert a Bank of America Statement to Excel`

1. **首屏**：上传组件，加 40–60 词的直接回答和免费额度。
2. **H2 `Where Bank of America statements live (and how far back)`**：依据 BofA 官方帮助（info.bankofamerica.com/en/digital-banking）：
   - 账单（含支票图像）可以直接查看和下载最近 18 个月。
   - 更早的账单（最多 7 年）要通过 “Request statements” 申请，免费，电子版 24–36 小时后可用，之后保留 7 天。
   - 写作重点：提醒用户拿到后尽快保存。这是 BofA 独有的内容，Chase 页没有。
3. **H2 `How to download your Bank of America statement PDF`**：
   - 网页版：Log in → Accounts 标签 → Statements & Documents → 选账户和周期 → 下载 PDF。
   - 旧账单：Statements & Documents → Request statements。
   - App：首版不提供尚未核实的具体菜单路径。
4. **H2 `Convert the PDF to Excel in three steps`**：通用段落（上传 → 检查风险标记 → 下载 Excel）。
5. **H2 `Reading a Bank of America checking statement`**：账单开头有 Account Summary（期初和期末余额）和账单周期（写之前用真实脱敏样例核实）。说明转换后用期初、期末余额核对 Excel 合计。不承诺我们对 BofA 版式有专门处理。
6. **H2 `Bank of America credit card statements`**：同样从 Statements & Documents 下载 PDF。信用卡的在线保留期限 BofA 官方页没有单独说明，不要写具体年限。
7. **H2 `Scanned, paper or password-protected statements`**：
   - 纸质副本可以邮寄（7–10 个工作日，官方说法），但收到后要扫描，只有 Professional/Enterprise 会尝试 AI 处理扫描件，所以优先申请电子版。
   - 加密 PDF 不支持，先另存一份无密码副本。
8. **H2 `Using the Excel file in QuickBooks or Google Sheets`**：通用段落（QBO 接受 3 列或 4 列 CSV，需要用户自己整理）。
9. **H2 `Pricing and limits`**、**H2 `FAQ`**、**H2 `Other banks`**。

## 6. FAQ

- Can I download Bank of America statements as Excel?（账单是 PDF；需要转换。）
- How far back can I get Bank of America statements?（直接下载 18 个月；申请最多 7 年。）
- How long does a requested older statement take?（24–36 小时，可下载 7 天。）
- How do I convert a BofA credit card statement to Excel?
- Is it safe to upload my Bank of America statement?
- Can I convert a scanned or mailed BofA statement?
- Is it free?

## 7. 可以引用的产品事实（2026-10-13 按当前代码与配置校准）

- 输入：单个 PDF，不超过 4 MB、50 页；不支持加密 PDF（任何套餐都不支持）。
- 输出：Excel、CSV、JSON、Markdown、TSV、HTML；CSV/TSV 每个逻辑表单独导出并附风险与来源字段。不提供 QBO/Xero 专用文件或自动对接。以当前代码和配置为准。
- 免费：未登录每天 1 页，登录每天 5 页，按 UTC 每天重置。
- 付费：Standard $19.90 / 500 页；Professional $49.90 / 1000 页；Enterprise $79.90 / 2000 页。每月通过 Creem 续费。转换失败不扣额度。
- Professional 和 Enterprise：常规解析失败时用 AI 兜底，可以尝试扫描件。
- 每行都有风险标记：OK、DISCREPANCY、UNVERIFIABLE；OK 也不代表一定准确。
- 不在数据库、对象存储或文件历史里保存 PDF、交易或导出内容；AI 处理时 PDF 会发给第三方 AI 解析服务。

## 8. 内链

- 链出：首页、Chase 页、Wells Fargo 页、/pdf-bank-statement-to-excel、QuickBooks 教程、扫描件页、价格页、隐私页。
- 上线后把 URL 加进 llms.txt 和 /ai/en/site.md。

## 9. AEO 写法

- 每个 H2 下第一段是 40–60 词的事实型回答，例如 “Bank of America lets you download up to 18 months of statements directly and request older copies up to 7 years back.”
- 加 FAQPage 和 HowTo schema，写“最后更新”日期。

## 10. 不能写的说法

- 不要写 “verified/optimized for Bank of America”。网站资料没有列出支持哪些银行。
- 可以写支持 CSV 下载；不要写直接生成 QBO/Xero 专用文件、自动对接记账系统，或支持批量上传、加密 PDF。
- 不要写 “files are never sent anywhere”。AI 处理时会发给第三方。
- 不要写 “100% accurate”。
- 不要用银行 logo，也不要暗示是官方合作。可以加一句 “Bank of America is a trademark of its owner; StatementXL is not affiliated.”
- 不要编造搜索量、排名或用户数。
- 不要写 App 的具体菜单路径，除非已经截图核实。

## 参考来源（官方）（2026-10-13 查看）

- https://info.bankofamerica.com/en/digital-banking

## 第一批实施状态（2026-10-13）

已实现、待部署。页面覆盖 12 种语言，复用上传、套餐和结果下载链路。产品限制与额度读取现有配置。首版仅链接首页、价格锚点、隐私与条款、核心落地页和本批银行页，不链接扫描件或 QuickBooks 等待建页；两者留到下一批。未验证真实银行版式、支付、收录或排名。
