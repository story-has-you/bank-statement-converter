# 计费渠道切换与验收

当前支持 Creem 和 PayPal 跳转结账。渠道适配器负责远端 API、验签和证据校验，通用计费模块负责账号、资格、权益、账期与数据库写入。配置见 [Creem 支付接入](creem-billing.md) 和 [PayPal 沙箱支付接入](paypal-billing.md)。

## 接口

- 创建：`POST /api/billing/subscriptions/create`，接受 `{ provider, tier }`，返回 `{ provider, checkoutId, checkoutUrl }`。
- 确认：`POST /api/billing/subscriptions/activate`，接受 `{ provider, checkoutId, tier }`；回调未落库时返回 `202 { status: "PENDING" }`，已激活返回 `200 { tier, status: "ACTIVE", subscriptionId }`。浏览器返回不写入权益。
- 取消：`POST /api/billing/subscriptions/cancel`，接受 `{ provider, subscriptionId }`，要求已认证且同源，返回 CANCELLATION_PENDING 或 CANCELLED；保留已付账期。
- 回调：`POST /api/billing/webhooks/{provider}`，无效签名返回 400，处理失败返回 502 供渠道重试。未知渠道返回 400。

`provider` 支持 `creem` 和 `paypal`。PayPal 的 checkoutId 使用渠道订阅 ID；原 `/api/paypal/*` 兼容入口不恢复。`handleSubscriptionRequest` 保持原实现，不包含渠道分支。

## 数据库切换（2026-10-16）

已在 `.env.local` 指向的 Supabase 项目中，通过已认证 CLI 执行单条增量迁移 `20261016071822_enable_paypal_billing.sql`。事务锁定计费表、检查同用户开放订阅冲突，再将 `billing_subscriptions_open_user_idx` 从 Creem 单渠道扩展为 Creem、PayPal 共用。存在冲突时中止并回滚，不自动删除或修改记录。

开放状态保持 APPROVAL_PENDING、APPROVED、ACTIVE、SUSPENDED、PAYMENT_FAILED；同一用户跨渠道最多一条开放订阅。取消后仍在已付周期内时，应用继续阻止新购。账户列表、额度和登录同步均查询两渠道。

执行前后回查：既有两条 ACTIVE Creem 记录的全部字段完全一致；RLS 仍启用，策略、表权限和其他索引未变。当前没有 PayPal 历史记录，因此不增加归档标记或历史恢复逻辑。目标库没有 `supabase_migrations.schema_migrations` 表，本次未创建该表或重跑其他迁移。历史 SQL 文件原样保留。

## 当前验收与发布边界

本地已通过 ESLint、TypeScript、生产构建；隔离 PostgreSQL 与真实应用模块、Supabase 客户端完成付款、并发、状态及索引场景验证。外部响应均为虚构数据，不发起付款。最终验收结果见 [PayPal 沙箱支付接入](paypal-billing.md)。

本次只配置本地 PayPal Sandbox，未修改 Vercel、未部署、未提交或推送 Git，未在 PayPal 后台修改 Webhook。已只读核实沙箱应用、三个计划及 Webhook 事件配置。真实审批、付款、回调落库和登录账户额度仍需专门验收；数据库迁移和隔离检查不能替代这些证据。

## 历史验证（2026-10-13，Creem 单渠道阶段）

- ESLint、TypeScript、生产构建、格式和 diff 检查通过，12 种语言的键与原有 ICU 占位符一致。
- 临时隔离 PostgreSQL 完成 12 项索引迁移检查；真实应用模块、官方 SDK、HMAC 和虚构支付响应完成 42 项隔离联调，覆盖付款、恢复、续费、取消与历史记录排除。不连接真实数据库，不发起真实付款。
- 复用已有 3000 服务完成 22 项 HTTP 检查：删除的旧入口返回 404，不支持渠道返回 400，未登录订阅操作返回 401，无签名回调返回 400，12 种语言返回页均可访问。浏览器检查匿名中文首页和返回页，未捕获页面错误，首页无旧渠道脚本或文案。
- Vercel ReAvid / bank-statement-converter 的旧渠道环境变量已删除：Production 9 条、Preview 9 条；重新列举为零，其余 21 条配置的 ID、键和环境范围不变，未读取密钥值。没有自定义环境，Development 和分支覆盖中未发现遗漏。
- 新索引迁移尚未在真实数据库执行，代码尚未部署，未提交或推送 Git；真实付款及登录账户验收仍未执行。
