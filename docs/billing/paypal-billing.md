# PayPal 沙箱支付接入

PayPal 与 Creem 共用订阅路由、资格检查、权益、额度及数据库写入。PayPal 的五个渠道模块位于 `src/lib/billing/providers/paypal/`，实现现有 `PaymentProvider` 接口，不直接访问 Supabase。`handleSubscriptionRequest` 保持原有实现。

## 本地配置

以下配置写入被 Git 忽略的 `.env.local`；凭据、访问令牌和原始支付响应不写入仓库或日志。

| 配置                          | 用途                                                       |
| ----------------------------- | ---------------------------------------------------------- |
| `PAYPAL_PAYMENT_ENABLED`      | 设置为 `true` 展示购买入口；独立于 `CREEM_PAYMENT_ENABLED` |
| `PAYPAL_ENVIRONMENT`          | 本次使用 `sandbox`                                         |
| `PAYPAL_CLIENT_ID`            | 沙箱应用 Client ID，仅服务端使用                           |
| `PAYPAL_CLIENT_SECRET`        | 沙箱应用 Secret，仅服务端使用                              |
| `PAYPAL_WEBHOOK_ID`           | 同一沙箱应用的 Webhook ID                                  |
| `PAYPAL_PLAN_ID_STANDARD`     | Standard，USD 19.90/月，500 页                             |
| `PAYPAL_PLAN_ID_PROFESSIONAL` | Professional，USD 49.90/月，1,000 页                       |
| `PAYPAL_PLAN_ID_ENTERPRISE`   | Enterprise，USD 79.90/月，2,000 页                         |

创建前读取远端计划，要求 ACTIVE、单一无限期月付周期、对应 USD 定价、无试用、无设置费和额外税率。2026-10-16 已通过沙箱只读 API 核实三个计划满足这些条件，未创建订阅或发起付款。

## 创建与返回

- `POST /api/billing/subscriptions/create`：`{ provider: "paypal", tier }`，返回 `{ provider: "paypal", checkoutId, checkoutUrl }`；`checkoutId` 是 PayPal 订阅 ID。服务器选择计划，以当前登录用户 ID 填写 `custom_id`，忽略客户端价格和身份。
- 使用 PayPal 返回的沙箱 `approve` 链接跳转；不加载浏览器支付 SDK。成功与取消地址指向本地化的 `/billing/return`，成功地址携带 `provider=paypal&tier=...`，PayPal 返回 `subscription_id`；取消地址另含 `cancelled=true`。
- 返回页向现有 activate 接口提交 `{ provider: "paypal", checkoutId, tier }`。接口核对远端归属并读取本地已确认付款状态，回调未落库返回 `202 PENDING`。浏览器返回和 `BILLING.SUBSCRIPTION.ACTIVATED` 均不会写入权益。
- 账户中的取消操作复用现有 cancel 接口，向渠道取消后等待签名回调或已有账户同步确认；本地已付账期不变。

## Webhook 与付款证据

公网 HTTPS 回调必须完整指向 `/api/billing/webhooks/paypal`，并属于配置中的同一沙箱应用。localhost 不能接收 PayPal 投递。当前已配置的 Webhook URL 指向已有 devtunnel 根路径，尚未改为该接口；本次没有修改 PayPal 后台。

在沙箱应用中订阅以下事件；当前应用已订阅 `*`：

- `PAYMENT.SALE.COMPLETED`：首付款和续费。
- `BILLING.SUBSCRIPTION.CANCELLED`：取消自动续费。
- `BILLING.SUBSCRIPTION.PAYMENT.FAILED`、`BILLING.SUBSCRIPTION.SUSPENDED`、`BILLING.SUBSCRIPTION.EXPIRED`：失败、暂停及到期。

处理前将签名头、Webhook ID 及事件提交给 PayPal 验签，要求 `verification_status=SUCCESS`。付款后重新读取订阅、计划和所属交易，要求对应交易为 COMPLETED，交易 ID、事件金额、USD 价格和账号套餐一致。账期从原始起始日按自然月推导，每次保留原始日期锚点；最新正常付款还核对下一扣款时间，不用固定 30 天或将首次起始日当作所有周期起点。

失败和取消不推进账期，同期恢复不重置额度；重复、乱序、并发和迟到付款沿用通用计费保护。无效签名返回 400，证据尚未同步或处理失败返回 502，等待渠道重试。忽略的事件在验签后返回成功。

## 验收边界

真实 Supabase 索引迁移及保留既有记录的回查见 [计费渠道切换与验收](billing-provider-cutover.md)。静态、隔离付款和本地 HTTP 检查不代表真实付款成功。完整沙箱验收仍需正确的公网回调地址、沙箱买家审批、真实签名事件落库及账户额度核对；本次不代为付款，不部署或修改 Vercel。

2026-10-16 本地验证：ESLint、TypeScript、生产构建、格式及 diff 检查通过，12 种语言键及 ICU 参数一致，原有转换文案保持不变。临时隔离环境通过 23 个计费及迁移场景和 60 次多语言组件渲染；使用真实应用模块、Supabase 客户端及 PGlite PostgreSQL，所有支付与数据库网络响应均被拦截。已有 3000 服务通过 28 项 HTTP 检查，浏览器检查匿名中文套餐页未捕获页面错误；未验证登录后的浏览器付款。实际应用的 PayPal REST 模块还通过三个真实沙箱计划的只读校验。
