# 写作 Brief：Wells Fargo Statement to Excel（StatementXL / bankstatementconverter.xyz）

> 这是给写手的 brief，不是正文。结构同 Chase brief。英文版本按本文目标词和标题编写，页面同时提供现有 12 种语言的完整本地化版本。不使用任何搜索量或排名数字。

## 1. 目标与搜索意图

- **目标**：承接 “Wells Fargo statement to Excel” 一类搜索，让用户当场转换，再引导注册或订阅。
- **意图**：交易型为主；其次是信息型（怎么下载、不同产品能查多少年）。
- **受众**：美国个人（报税、房贷申请）、记账员、小企业主（Wells Fargo Business）。

## 2. URL

`/banks/wells-fargo-statement-to-excel`

## 3. 目标词

- **主词**：wells fargo statement to excel; convert wells fargo bank statement to excel
- **次要词**：wells fargo statement to csv; wells fargo credit card statement to excel; download wells fargo statement pdf; wells fargo business statement to excel
- **相关实体**：Wells Fargo Online、Wells Fargo Mobile app、Statements & Documents、checking、savings、credit card、Business Online

## 4. Title 和 Meta

- **Title**：`Wells Fargo Statement to Excel – Convert PDF Statements | StatementXL`
- **Meta description**：`Convert a Wells Fargo statement PDF to Excel with StatementXL. 1 free page a day, 5 when signed in. No file history kept. Check flagged rows before you download.`

## 5. H1 和大纲

**H1**：`Convert a Wells Fargo Statement to Excel`

1. **首屏**：上传组件，加 40–60 词的直接回答和免费额度。
2. **H2 `How long Wells Fargo keeps statements online (by account type)`**：这是 Wells Fargo 页的核心独有内容，依据官方 FAQ（wellsfargo.com/help/online-banking/statement-faqs/），做成表格：
   - 存款账户、房贷、信托和托管投资账户：最多 7 年。
   - 信用卡、房屋净值信用额度、个人贷款和信用额度：最多 2 年。
   - 车贷：最多 12 个月。
   - 账户关闭后，在线账单大约还能看 90 天。
   - 写作重点：信用卡账单要早点下载保存。
3. **H2 `How to download your Wells Fargo statement PDF`**：
   - 网页版：Sign on → Accounts → Statements & Documents → 选账户和周期 → 打开 PDF 后另存（官方 FAQ 建议用描述性文件名，例如 CheckingMarch2019.pdf）。
   - App：税务文档 FAQ 不能证明账单菜单路径，首版省略具体路径。
4. **H2 `Convert the PDF to Excel in three steps`**：通用段落。
5. **H2 `Wells Fargo checking and savings statements`**：说明对照期初、期末余额核对 Excel。版式细节要先拿真实脱敏样例核实再写，不要凭空描述。
6. **H2 `Wells Fargo credit card statements`**：强调在线最多 2 年。
7. **H2 `Business statements`**：Business Online 提供符合条件账户的文件；最多 7 年仍受产品类型限制，不能泛指所有商业账单（官方 biz 页面及其脚注）。
8. **H2 `Scanned or password-protected PDFs`**、**H2 `QuickBooks / Google Sheets`**：通用段落。
9. **H2 `Pricing and limits`**、**H2 `FAQ`**、**H2 `Other banks`**。

## 6. FAQ

- Can I export Wells Fargo statements to Excel?
- How far back can I download Wells Fargo statements?（按产品不同：7 年、2 年或 12 个月。）
- Can I get statements for a closed Wells Fargo account?（约 90 天内可以在线获取；之后联系客服。）
- How do I convert a Wells Fargo credit card statement to Excel?
- Is it safe to upload my Wells Fargo statement?
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

- 链出：首页、Chase 页、BofA 页、/pdf-bank-statement-to-excel、QuickBooks 教程、扫描件页、价格页、隐私页。
- 上线后加入 llms.txt。

## 9. AEO 写法

- 用事实句，例如 “Wells Fargo keeps credit card statements online for up to 2 years and checking statements for up to 7 years.”
- 加 FAQPage 和 HowTo schema，写“最后更新”日期。

## 10. 不能写的说法

- 不要写 “verified for Wells Fargo”。
- 不要写 “Wells Fargo keeps all statements for 7 years”。这和官方说法不一致。
- 可以写支持 CSV 下载；不要写直接生成 QBO/Xero 专用文件、自动对接记账系统，或支持批量上传、加密 PDF。
- 不要写 “files are never sent anywhere”。AI 处理时会发给第三方。
- 不要写 “100% accurate”。
- 不要用银行 logo，也不要暗示是官方合作。可以加一句 “Wells Fargo is a trademark of its owner; StatementXL is not affiliated.”
- 不要编造搜索量、排名或用户数。

## 参考来源（官方）（2026-10-13 查看）

- https://www.wellsfargo.com/help/online-banking/statement-faqs/
- https://www.wellsfargo.com/mobile-online-banking/statements/
- https://www.wellsfargo.com/biz/online-banking/statements/
- https://www.wellsfargo.com/tax-center/tax-document-faqs/

## 第一批实施状态（2026-10-13）

已实现、待部署。页面覆盖 12 种语言，复用上传、套餐和结果下载链路。产品限制与额度读取现有配置。首版仅链接首页、价格锚点、隐私与条款、核心落地页和本批银行页，不链接扫描件或 QuickBooks 等待建页；两者留到下一批。未验证真实银行版式、支付、收录或排名。
