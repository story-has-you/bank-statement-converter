# 文档目录

按主题查阅项目文档。开发与部署入口见仓库根目录的 [README](../README.md)，业务术语见 [GLOSSARY](../GLOSSARY.md)。文档中以 `src/`、`services/`、`supabase/` 或 `docs/` 开头的代码路径均相对于仓库根目录。

| 目录          | 内容                                  |
| ------------- | ------------------------------------- |
| `product/`    | 产品范围、转换契约与数据边界          |
| `conversion/` | 转换流程的交付与验收                  |
| `billing/`    | 支付接入、计费切换与验收              |
| `seo/`        | SEO/AEO 选题、写作 brief 与实施验证   |
| `marketing/`  | 推广文案、Product Hunt 发布资料与素材 |
| `adr/`        | 架构与业务决策记录                    |
| `agents/`     | 代理工作流、Issue 管理与文档约定      |

## 产品与转换

- [产品边界](product/product-boundary.md)
- [解析记录交付与验收](conversion/parse-records-verification.md)
- [商户别名归一化验收](conversion/merchant-normalization-verification.md)

## 支付与计费

- [Creem 支付接入](billing/creem-billing.md)
- [PayPal 沙箱支付接入](billing/paypal-billing.md)
- [Waffo 支付接入与验收](billing/waffo-billing.md)
- [计费渠道切换与验收](billing/billing-provider-cutover.md)

## SEO/AEO

- [选题看板](seo/seo-ideas-board.md)
- [Chase 写作 brief 与银行页模板](seo/seo-brief-chase-statement-to-excel.md)
- [Bank of America 写作 brief](seo/seo-brief-bofa-statement-to-excel.md)
- [Wells Fargo 写作 brief](seo/seo-brief-wells-fargo-statement-to-excel.md)
- [第一批实施与验证](seo/seo-first-wave-verification.md)
- [第二批实施与验证](seo/seo-second-wave-verification.md)
- [第三批内容、工具、实测及静态渲染](seo/seo-third-wave-verification.md)

## 推广与发布

- [推广文案](marketing/promotion-copy.md)
- [Product Hunt 发布资料](marketing/producthunt-launch.md)
- [Product Hunt 展示素材与提交记录](marketing/producthunt-assets/)

## 决策记录

- [0001：允许带风险标注下载部分转换结果](adr/0001-partial-results-with-risk-markers.md)
- [0002：多语言消息与风险原因在展示层本地化](adr/0002-localized-message-contract.md)
- [0003：高阶套餐采用千问回退及结果页流式预览](adr/0003-qwen-fallback-and-streamed-preview.md)
- [0004：解析记录只保存运维元数据并异步写入](adr/0004-asynchronous-parse-records.md)
- [0005：计费流程与支付渠道适配器分离](adr/0005-payment-provider-adapters.md)
- [0006：Creem 以已付款事件确认订阅权益](adr/0006-creem-paid-subscription-evidence.md)

## 代理工作流

- [Issue tracker](agents/issue-tracker.md)
- [Triage labels](agents/triage-labels.md)
- [Domain docs](agents/domain.md)

验收文档按各自记录的日期与范围阅读；其中的本地、模拟或静态检查不能代替真实数据库、支付、模型调用或部署验收。
