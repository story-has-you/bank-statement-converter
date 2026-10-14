# Creem 计费切换与验收

网站仅使用 Creem 托管结账，接口保持现有渠道字段。支付配置和既有测试证据见 [Creem 支付接入](creem-billing.md)。历史渠道订阅记录保留，应用只读取 Creem 记录，不提供历史渠道的购买、确认、取消、同步或权益。

## 接口

- `POST /api/billing/subscriptions/create`：`{ provider: "creem", tier }`，返回 `{ provider: "creem", checkoutId, checkoutUrl }`。
- `POST /api/billing/subscriptions/activate`：`{ provider: "creem", checkoutId, tier }`；等待付款回调落库时返回 `202 { status: "PENDING" }`，已激活返回 `200 { tier, status: "ACTIVE", subscriptionId }`。浏览器返回不写入权益。
- `POST /api/billing/subscriptions/cancel`：`{ provider: "creem", subscriptionId }`，接受同站点、已认证的请求，返回 `CANCELLATION_PENDING` 或 `CANCELLED`。
- `POST /api/billing/webhooks/creem`：消费原始请求体，验证签名并核实远端付款、身份和账期；无效格式或签名返回 400，处理失败返回 502，等待渠道重试。
- 其他渠道返回 `400 invalidProvider`；原有渠道专用兼容入口已删除。

## 发布前数据库迁移

`20261013000000_limit_open_subscriptions_to_creem.sql` 只新增到仓库，尚未执行真实数据库。

1. 核实目标数据库已使用通用渠道列，保留全部历史迁移；不要重跑历史迁移或恢复辅助表、RPC、触发器。
2. 在发布新应用前执行该迁移。它在事务中锁定计费表，检查同用户的 Creem 开放订阅冲突，再替换 `billing_subscriptions_open_user_idx`，限定 `provider = 'creem'`。开放状态仍包括 APPROVAL_PENDING、APPROVED、ACTIVE、SUSPENDED、PAYMENT_FAILED。
3. 存在冲突时迁移中止并回滚，不自动清理记录。核对前后记录、RLS、权限及渠道订阅唯一约束不变。
4. 发布应用后，账户、权益、额度、开放订阅检查及登录同步仅使用 Creem。历史渠道开放记录不再阻止 Creem 写入。

未执行索引迁移时，应用查询虽忽略历史记录，数据库唯一约束仍可能阻止新订阅写入。环境变量删除只影响后续部署；现有部署需发布新代码后才完成渠道移除。

## 验收

静态检查执行 ESLint、TypeScript、生产构建、12 种语言键与占位符检查和 diff 检查，不新增单元测试。

临时隔离数据库验证历史开放记录与 Creem 开放记录共存、同用户第二条 Creem 开放记录被拒绝、冲突迁移回滚、历史数据不变。隔离验证不能证明真实数据库已迁移。

复用现有本地 3000 服务检查匿名套餐页、付款返回页、未登录及同源限制、已删除接口和不支持的渠道；不发起付款。

Creem 付款与取消仍须使用专用测试账号单独验收：只有已验签且核实付款交易的事件授予权益；取消保留当前已付周期，失败扣款不延长账期；重复、乱序、并发及迟到付款不得重复创建或恢复取消／到期订阅。既有真实支付验收限制见 [Creem 支付接入](creem-billing.md)。

## 本次验证（2026-10-13）

- ESLint、TypeScript、生产构建、格式和 diff 检查通过，12 种语言的键与原有 ICU 占位符一致。
- 临时隔离 PostgreSQL 完成 12 项索引迁移检查；真实应用模块、官方 SDK、HMAC 和虚构支付响应完成 42 项隔离联调，覆盖付款、恢复、续费、取消与历史记录排除。不连接真实数据库，不发起真实付款。
- 复用已有 3000 服务完成 22 项 HTTP 检查：删除的旧入口返回 404，不支持渠道返回 400，未登录订阅操作返回 401，无签名回调返回 400，12 种语言返回页均可访问。浏览器检查匿名中文首页和返回页，未捕获页面错误，首页无旧渠道脚本或文案。
- Vercel ReAvid / bank-statement-converter 的旧渠道环境变量已删除：Production 9 条、Preview 9 条；重新列举为零，其余 21 条配置的 ID、键和环境范围不变，未读取密钥值。没有自定义环境，Development 和分支覆盖中未发现遗漏。
- 新索引迁移尚未在真实数据库执行，代码尚未部署，未提交或推送 Git；真实付款及登录账户验收仍未执行。
