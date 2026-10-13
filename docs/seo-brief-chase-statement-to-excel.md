# 写作 Brief：Chase Statement to Excel（bankstatementconverter.xyz）

> 这是给写手的 brief，不是正文。英文版本按本文目标词和标题编写；页面同时提供现有 12 种语言的完整本地化版本。本文说明用中文。不使用任何搜索量或排名数字。

## 1. 目标与搜索意图

- **目标**：让搜 “Chase statement to Excel” 一类词的用户落到一个专门的 Chase 页面，当场上传 PDF 转换（首次免费 1 页），再引导注册（每天 5 页）或订阅。
- **意图**：交易型为主。用户手里已经有（或正准备下载）Chase 的 PDF 账单，想要表格。其次是信息型：怎么从 chase.com 下载 PDF、为什么 Chase 自带的 CSV 不够用。
- **受众**：做报税、贷款申请、年度整理的美国个人；替客户补账的记账员；小企业主（Chase Business Complete 等）。

## 2. URL

- 推荐：`/banks/chase-statement-to-excel`
- 模板：`/banks/{bank}-statement-to-excel`，所有银行页统一放在 /banks/ 目录下。
- 多语言：覆盖现有 12 种语言，完整翻译页面与 metadata；canonical 指向当前语言页面，hreflang 对应全部语言版本。

## 3. 目标词

- **主词**：chase statement to excel; convert chase bank statement to excel
- **次要词**：chase bank statement pdf to excel; chase statement to csv; chase credit card statement to excel; export chase statements to excel; download chase statement pdf; chase statements older than 2 years
- **相关实体**（自然出现即可）：chase.com、Chase Mobile app、Statements & documents、checking、savings、credit card（Sapphire、Freedom、Ink）、running balance、QuickBooks、Google Sheets

## 4. Title 和 Meta

- **Title**（约 60 字符）：`Chase Statement to Excel – Convert Chase PDF Statements | StatementXL`
  - 品牌名统一用 StatementXL，不要只写 “Bank Statement Converter”。
- **Meta description**：`Convert a Chase bank statement PDF to Excel in your browser. 1 free page a day without signing in, 5 when signed in. No file history kept. Review flagged rows before you download.`

## 5. H1 和大纲（各段必须写到的内容）

**H1**：`Convert a Chase Bank Statement to Excel`

1. **上传区 + 一句话答案**（首屏）：上传组件；用 40–60 词说明“下载 Chase PDF → 上传 → 检查标出问题的行 → 下载 Excel”，并写明免费额度。
2. **H2 `Chase CSV export vs. PDF statements: which do you need?`**：对比表。PDF 账单最多保留 7 年，视账户类型而定（Chase 官方 FAQ）。Activity 下载与月度 PDF 账单是不同资料；首版未核实其时间范围，不写固定期限或“只能导出近期”的结论。不要断言更早的月份只能通过 PDF 获取；实际导出范围以账户当前可用选项为准。
3. **H2 `How to download your Chase statement PDF`**：两组步骤，依据 chase.com 官方帮助页。网页版：Main Menu → Statements & documents → 选年份和账户 → Open/Save。App 版：Profile & Settings → Document manager → Statements & documents → Statements → 选账户、年份、账单。提醒用户下载的是原生 PDF，不要截图或打印后再扫描。
4. **H2 `Convert the PDF to Excel in three steps`**：上传（单个 PDF，不超过 4 MB / 50 页）→ 检查（OK / DISCREPANCY / UNVERIFIABLE 三种标记）→ 下载 Excel。首版不放未经脱敏样本验证的截图。
5. **H2 `Chase checking and savings statements`**：首版没有已核实的脱敏样例，省略具体版式描述和截图；说明转换后要对照原 PDF 核对，不承诺对每种版式有专门处理。
6. **H2 `Chase credit card statements (Sapphire, Freedom, Ink)`**：信用卡账单同样以 PDF 提供。信用卡能不能从 Activity 页导出 CSV 没有官方说明，所以写成“Activity 页的下载可能只覆盖近期，完整的已出账单要用 PDF”。
7. **H2 `Scanned or mailed Chase statements`**：Standard 及以下套餐需要 PDF 有文本层；Professional 和 Enterprise 会尝试用 AI 处理扫描件，但不保证成功。说明 AI 处理会把 PDF 发给第三方 AI 解析服务。
8. **H2 `Password-protected PDFs`**：我们不支持加密 PDF。告诉用户先用 PDF 阅读器“打印/另存为”一份无密码的副本。Chase 一般不给 PDF 加密，但不确定，不要写成肯定句。
9. **H2 `Using the Excel file in QuickBooks or Google Sheets`**：简要说明 QuickBooks Online 接受 3 列（Date、Description、Amount）或 4 列（Date、Description、Credit、Debit）CSV（以 Intuit 官方帮助为准，写之前核实）。当前可以下载 Excel 或 CSV，导入记账软件前仍需按目标系统要求整理列。首版不展开 QuickBooks 教程，不链接尚未创建的页面。
10. **H2 `Pricing and limits`**：价格表（见第 7 节）。
11. **H2 `FAQ`**（见第 6 节），加 FAQPage schema。
12. **H2 `Other banks`**：内链区。

## 6. FAQ（来自 PAA 和 AI 助手常见提问）

- Can I download Chase statements as Excel directly?（不能直接下载 Excel 格式的账单。Activity 下载的范围按当前账户选项确认；账单本身是 PDF。）
- How far back can I get Chase statements?（最多 7 年，视账户类型而定，来自 Chase 官方。）
- How do I convert a Chase credit card statement to Excel?
- How do I get Chase statements older than 2 years into a spreadsheet?
- Is it safe to upload my Chase statement?（我们不保存 PDF、Excel 或交易的历史记录；AI 处理时会把 PDF 发给第三方，受该方条款约束。）
- Can I convert a scanned Chase statement?
- Can I import a Chase statement into QuickBooks?
- Is the conversion free?

## 7. 可以引用的产品事实（2026-10-13 按当前代码与配置校准）

- 输入：单个 PDF，不超过 4 MB、50 页；不支持加密 PDF（任何套餐都不支持）。
- 输出：Excel、CSV、JSON、Markdown、TSV、HTML；CSV/TSV 每个逻辑表单独导出并附风险与来源字段。不提供 QBO/Xero 专用文件或自动对接。以当前代码和配置为准。
- 免费：未登录每天 1 页，登录每天 5 页，按 UTC 每天重置。
- 付费：Standard $19.90 / 500 页；Professional $49.90 / 1000 页；Enterprise $79.90 / 2000 页。每月通过 Creem 续费。转换失败不扣额度。
- Professional 和 Enterprise：常规解析失败时用 AI 兜底，可以尝试扫描件。
- 每行都有风险标记：OK、DISCREPANCY、UNVERIFIABLE；OK 也不代表一定准确。
- 不在数据库、对象存储或文件历史里保存 PDF、交易或导出内容；AI 处理时 PDF 会发给第三方 AI 解析服务。

## 8. 内链

- 链出：首页（锚文本 bank statement converter）、/pdf-bank-statement-to-excel（待建）、QuickBooks 教程（待建）、扫描件页（待建）、价格页、隐私页、其他银行页（BoA、Wells Fargo 等，待建）。
- 链入：首页加一个 “Popular banks” 模块；llms.txt 和 /ai/en/site.md 加上这个页面。

## 9. AEO 写法

- 每个 H2 下面第一段是 40–60 词的直接回答，用事实句，主语写清楚（例如 “Chase keeps up to 7 years of statements…”），方便 AI 助手原样引用。
- 价格、额度用表格，数字要和 llms.txt 完全一致。
- 加 FAQPage 和 HowTo schema。页面上线后把 URL 加进 llms.txt。
- 写清“最后更新”日期。

## 10. 不能写的说法

- 不要写 “Verified/optimized for Chase”、“supports all Chase formats” 或 “100% accurate”。网站资料没有列出支持哪些银行，Chase 也没有经过验证。
- 可以写支持 CSV 下载；不要写直接生成 QBO/Xero 专用文件、自动对接记账系统，或支持批量上传、加密 PDF。
- 不要写 “files are never sent anywhere”。AI 处理时会发给第三方。
- 不要写 Chase Activity 导出的具体时间范围或行数上限，除非已在 chase.com 核实。
- 不要用 Chase 的 logo，也不要暗示是官方合作。可以加一句 “Chase is a trademark of JPMorgan Chase & Co.; not affiliated”。

## 11. 可复用的银行页模板

1. 首屏：上传区 + 一句话答案
2. `{Bank} CSV export vs. PDF statements`：写清该行的导出范围和 PDF 保留年限，引用该行官方帮助页
3. `How to download your {Bank} statement PDF`：网页版 + App 步骤
4. `Convert the PDF to Excel in three steps`：通用段落
5. `{Bank} checking/savings statement layout`：这家银行的版式特点
6. `{Bank} credit card statements`：如果有
7. `Scanned`、`Password-protected`、`QuickBooks / Sheets`：通用段落，可复用
8. `Pricing`、`FAQ`、`Other banks`：通用

- 每个银行页必须包含有来源支持的独有内容（下载路径、保留期限、申请旧账单等），首版不凭空填充版式特点。

## 参考来源（官方）

- Chase 官方：https://www.chase.com/personal/mobile-online-banking/login-paperless

## 第一批实施状态（2026-10-13）

已实现、待部署。页面覆盖 12 种语言，复用上传、套餐和结果下载链路。产品限制与额度读取现有配置。首版仅链接首页、价格锚点、隐私与条款、核心落地页和本批银行页，不链接扫描件或 QuickBooks 等待建页；两者留到下一批。未验证真实银行版式、支付、收录或排名。
