# Waffo 测试支付接入

Waffo 与 Creem、PayPal 共用订阅资格、账户、权益和额度流程，使用官方 `@waffo/pancake-ts@0.26.0` SDK。适配器位于 `src/lib/billing/providers/waffo/`，不直接访问 Supabase。只启用本地测试环境，未部署或发布生产商品。

## 测试资源与配置

商户：`MER_5ADMqZQhnbzjjKvaCM3Nzl`；店铺：`STO_1gKB048XrnkCO1cHwT0Lwj`。

| 套餐         | USD/月，税前 | 每周期页数 | 已复用测试商品              |
| ------------ | ------------ | ---------- | --------------------------- |
| Standard     | 19.90        | 500        | PROD_062erb4H1vvsRpUdlcHVLy |
| Professional | 49.90        | 1,000      | PROD_4oEnEWn6Uqk4Nst0CABP8G |
| Enterprise   | 79.90        | 2,000      | PROD_53gsd2GEigjTX0int75SKe |

三个商品均为 active、monthly、USD、saas，无试用配置，未发布生产版本。新建测试商品组 `StatementXL Monthly Plans`，ID 为 `67a5223e-42ae-43c0-8db1-e3ccc0c6cd94`，关闭 sharedTrial、selfServicePlanChange。

Waffo 官网 Skill 的 `taxIncluded` 示例与 SDK 不一致。[SDK 更新记录](https://github.com/waffo-com/waffo-pancake-sdk-ts/blob/main/CHANGELOG.md)说明该字段已移除，平台按税前价格计价。2026-10-18 经曦确认，Waffo 使用上述税前价，在购买入口提示税费于结账时计算；Creem、PayPal 计价不变。首次实付保存含税渠道扣款总额，零优惠时原价快照等于实付。

以下变量仅用于服务端，已写入被 Git 忽略的 `.env.local`：

```text
WAFFO_MERCHANT_ID
WAFFO_PRIVATE_KEY
WAFFO_STORE_ID
WAFFO_ENVIRONMENT=test
WAFFO_PAYMENT_ENABLED=true
WAFFO_PRODUCT_ID_STANDARD
WAFFO_PRODUCT_ID_PROFESSIONAL
WAFFO_PRODUCT_ID_ENTERPRISE
WAFFO_RETURN_BASE_URL=https://l6sscc6p-3000.jpe1.devtunnels.ms
```

私钥不写入源码、日志、本文或 `NEXT_PUBLIC_*`。SDK 自动规范原始 Base64 私钥并签名 API 请求；商户 API 的实际 test/prod 环境由密钥决定。`WAFFO_ENVIRONMENT` 用于本地核对订单环境和限定 Webhook 验签环境，不会把生产密钥变成测试密钥。渠道开关关闭只禁止新购，不影响回调、确认和取消。

## 结账与权益

- create 请求为 `{ provider: "waffo", tier }`，响应仍为 `{ provider, checkoutId, checkoutUrl }`。服务端选商品、USD 和登录用户，调用 `checkout.authenticated.create`，以 Supabase 用户 ID 作为 buyerIdentity；邮箱仅用于预填。
- 每次结账生成 `wco_<UUID>` 作为业务引用，设置 orderMerchantExternalId，并作为本项目 checkoutId；渠道 checkout session ID 不用于账号归属。相同引用用于 SDK 结账请求幂等键。结账禁止试用，会话有效期一小时。
- 复用当前页跳转。成功地址保留语言路径、tier、provider 和 checkout_id，使用上述公网 HTTPS 基址。Waffo 成功页需要用户点击 Done 才返回，放弃付款不会跳转回网站，也不产生付款回调。
- activate 按业务引用查询远端订单，并核对账号、店铺、环境和产品。数据库 provider_subscription_id 保存 `ORD_…`。浏览器返回仅确认回调已写入状态，尚未确认时返回 202 PENDING，不能创建权益。
- 只支持三档固定月付，不提供试用、折扣、退款、套餐切换或门户入口。

## Webhook 与状态

测试 HTTP 回调 ID：`c2950a0e-6306-4042-9754-a7897497daff`。

```text
https://l6sscc6p-3000.jpe1.devtunnels.ms/api/billing/webhooks/waffo
```

订阅事件：subscription.payment_succeeded、subscription.canceling、subscription.canceled、subscription.past_due、subscription.uncanceled。

读取原始请求体，通过 SDK verifyWebhook 验证 x-waffo-signature，限定 test 密钥并检查 mode、storeId。保留 SDK 默认 45 分钟重放窗口和 1 分钟未来偏差，未配置自定义公钥。处理完成后返回 JSON 200，验签或环境错误返回 400，业务处理失败沿用 502 供 Waffo 自动重试。

只有 subscription.payment_succeeded 可以创建或续期权益。订阅订单与付款并行查询，核对订单 ID、用户、业务引用、测试环境、成功付款、USD、月度商品、无试用、税前套餐价、税额闭合及 pspAmountDetails 的实际扣款。按订单和 periodNumber 对齐当前账期，不使用 subscription.activated 的报价作为实付，不推算缺失的金额或账期。付款事件可能先于账期更新到达，此时返回可重试错误。

canceling 映射 CANCELLED，保留已付周期；past_due 映射 PAYMENT_FAILED，不延长账期；canceled、closed、expired 归一为 EXPIRED。网站取消只发起远端操作，等待回调或既有权威状态同步。uncanceled 使用标准化 subscription-resumed 事件，仅在远端仍为 ACTIVE、当前付款已核实且账期与本地完全一致时恢复，不重置额度。不改变 Creem、PayPal 已有取消处理。

同一 delivery ID 重复不再查询远端；同周期付款、乱序事件和并发写入复用通用幂等与乐观并发控制。未知事件返回 200，不授予权益。

## 数据库迁移记录（2026-10-18）

已在项目 `mwxqsfkywlvfzbrmutkm` 通过 Supabase CLI 执行单条 `20261018092942_enable_waffo_billing.sql`。事务锁定计费表、检查冲突，再把 billing_subscriptions_open_user_idx 从 Creem、PayPal 扩展到三个渠道，开放状态不变。

迁移前后均为 1 条订阅、0 个开放订阅冲突。完整记录摘要相同，列、约束、RLS、策略、表权限及其他索引保持一致。目标库没有 Supabase migration history 表，本次未创建该表、未重跑历史迁移、未向业务表插入测试记录。此迁移已执行，不要重复运行；后续发布前只需核对目标索引。

## 已验证与待验收

已通过 ESLint、TypeScript、生产构建、12 语言键／ICU／参数一致性和 diff 检查。临时隔离环境用实际应用模块、官方 SDK、临时 RSA 验签密钥、Supabase 客户端和复制实际表结构的 PGlite 完成 33 项集成检查：付款及税额、身份、环境、试用拒绝、续费、失败恢复、重复与并发、取消与撤销取消、额度窗口和跨渠道唯一约束，以及迁移冲突回滚。支付 API 响应均为虚构数据，无真实付款；没有新增仓库单元测试。

实际 Waffo GraphQL 已接受适配器使用的字段与筛选。测试商品、商品组和回调已回读。已有 3000 服务完成 8 项 HTTP 检查：未登录 create/activate/cancel 返回 401，跨域创建返回 403，本地及 devtunnel 对缺失／错误签名返回 JSON 400。浏览器检查匿名中文首页及 Waffo 返回页；登录后的三渠道入口通过真实组件静态渲染验证，未执行登录浏览器验收。

真实测试付款、Waffo 签名投递、付款后数据库写入和账户额度、真实续费及取消仍未验证。由曦在同一 devtunnel 域名登录专用测试账号后选择 Waffo，使用官方成功测试卡 `4576750000000110`（未来有效期、任意 CVC），检查最终税额并完成付款；付款后点击 Done 返回网站，再核对 provider=waffo 的单条订阅、实际扣款和套餐额度。随后由曦发起取消，核对 CANCELLED、保留本期权益及阻止重订。不能使用已有开放订阅的账号测试新购，也不要手动插入权益记录绕过付款。

本次未改动 Vercel 配置、未部署、未提交或推送 Git。devtunnel 需要保持在线；生产接入需独立密钥、生产商品和单独配置。
