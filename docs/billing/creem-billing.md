# Creem 支付接入

套餐页仅提供 Creem 入口。Creem 使用官方 `creem@1.13.0` SDK 和现有统一计费接口；仅测试环境已配置，正式环境未启用。

## 产品与配置

| 档位         | USD/月，含税 | 每周期页数 | 测试产品                    |
| ------------ | ------------ | ---------- | --------------------------- |
| standard     | 19.90        | 500        | prod_5IYIEWGuZmWrhe618cqmxW |
| professional | 49.90        | 1000       | prod_2G18Th0d0xoBwwm7soANf6 |
| enterprise   | 79.90        | 2000       | prod_5mKP5unObaD3P2rkjLa7gN |

Professional、Enterprise 支持配置中的 AI 解析回退。价格与权益由 `src/config/plans.ts` 决定，Creem 产品说明不执行网站额度限制。

服务器变量参考根目录 README 的 [Vercel Next.js 配置](../../README.md#vercel-nextjs)。`CREEM_API_KEY`、`CREEM_WEBHOOK_SECRET` 不得公开或提交；环境默认 test，production 使用正式密钥及独立正式产品。配置不完整时该渠道不可购买。此次本地变量保存在被忽略的 `.env.local`，Vercel 的六个变量仅对 Preview 的 preview 分支生效。

## 接口与事件

- `POST /api/billing/subscriptions/create` 接受 `{ provider, tier }`；Creem 返回 `{ provider: "creem", checkoutId, checkoutUrl }`。用户、产品、数量和本地化返回地址在服务端确定，忽略客户端提交的价格、产品和身份。
- `POST /api/billing/subscriptions/activate` 为 Creem 接受 `{ provider: "creem", checkoutId, tier }`。查询 checkout 与订阅并核对归属；Webhook 未到返回 202，已落库 ACTIVE 返回 200。浏览器返回页不能创建记录。
- `POST /api/billing/subscriptions/cancel` 按订阅的渠道执行取消；Creem 使用 scheduled，取消响应不提前修改本地状态，等回调或权威终态同步确认。
- `POST /api/billing/webhooks/creem` 对原始请求体验证 HMAC-SHA256。`subscription.paid` 远端核对已付款交易、身份、套餐和账期，创建首条记录或续期；active、checkout.completed 不授予权益。
- scheduled_cancel、canceled 映射 CANCELLED 并保留本期权益；past_due、unpaid 映射 PAYMENT_FAILED，保留已付周期但不增加额度；paused、expired 分别映射 SUSPENDED、EXPIRED。只有已核实付款能恢复失败状态；同周期恢复不重置额度，迟到付款不恢复取消或到期记录。

暂不支持门户、试用、退款或套餐升级。网站发起的购买固定数量为 1；无折扣付款核对套餐原价，优惠券付款核对实付与优惠金额之和等于套餐含税原价。

## 优惠券付款与首次快照

用户在 Creem 托管结账页输入优惠码，网站不增加输入框或优惠码白名单。支持百分比、固定金额和 100% 折扣；优惠券有效期、兑换次数及适用周期由 Creem 控制，不因回调接收时券已到期或兑换次数已用完而拒绝成功付款。

折扣交易必须提供非负整数美分 `amountPaid`、正整数美分 `discountAmount` 和远端订阅的优惠券 ID，且实付加优惠等于对应含税月价；不再重复叠加税额。没有折扣时仍核对原价；订阅上保留的优惠券信息不会将后续原价付款标为优惠。0 元交易也必须满足 `subscription.paid`、交易 `paid` 状态、环境、身份、套餐及账期核验，缺少证据时不激活。

`billing_subscriptions` 新增 `original_amount`、`discount_amount`、`provider_discount_id`，与现有 `amount` 一同保存首次付款快照，续费和状态变化不覆盖。账户显示首次实付；正优惠金额显示优惠券标记、原价和优惠金额，不保存券码。历史记录保持新增字段为空。

`20261013055431_add_subscription_coupon_snapshot.sql` 已于 2026-10-13 按曦授权，通过 Supabase CLI 在项目 `mwxqsfkywlvfzbrmutkm` 的事务中执行。迁移允许具有完整 Creem 全额抵扣证据的 0 元首次实付，并约束快照金额闭合。三个可空字段及两个金额约束已回读确认，约束均已验证；前后订阅数量均为 0、原记录校验值相同，RLS、权限、策略、索引及其他约束不变。临时表复制实际约束，验证 4 个合法案例和 8 个应拒绝案例后回滚，未向业务表写入测试记录。目标库没有迁移历史表，此次未创建历史表或重跑其他迁移；应用部署及真实免费订单验收仍待完成。

执行前后 Supabase 安全检查均为三项既有告警：`rls_auto_enable()` 可由 anon／authenticated 执行，以及 Auth 泄露密码保护未启用。本次没有新增告警，也未改动这些设置。

2026-10-13 优惠券改动已通过 ESLint、TypeScript、生产构建、改动文件格式、12 种语言键及 ICU 占位符一致性和 diff 检查。临时隔离环境使用真实应用模块、官方 SDK、HMAC 与 PGlite PostgreSQL 完成 45 项联调、约束及账户组件渲染检查，覆盖原价、部分优惠、全额优惠、续费、恢复、重复与并发回调、异常金额及身份、历史记录和 RLS 保留。外部 API 响应为虚构数据，不连接真实数据库，不发起付款；账户展示仅验证组件渲染，未执行已登录浏览器验收。真实 0 元交易是否产生可查询的 `paid` 交易及 `subscription.paid` 仍需实际兑换确认，证据缺失时保持待确认，不降低核验要求。

## 本次外部配置与迁移

- Vercel：ReAvid / bank-statement-converter；Preview 域名为 https://preview.bankstatementconverter.xyz。
- Creem 测试 Webhook：`wh_test_2pQhiuZUF0WtvJrstchzyz`，注册付款、更新、取消、失败、暂停、到期事件。端点 URL 的自动化绕过凭据仅保存在私有本地记录和 Creem 端点配置，不写入本文；仍需 Creem 签名。
- Supabase：`mwxqsfkywlvfzbrmutkm`。2026-10-12 已在事务中执行 `20261012041440_include_failed_subscriptions_in_open_constraint.sql`，将 PAYMENT_FAILED 纳入用户开放订阅唯一索引。执行前冲突用户 0，前后订阅数量均为 2、完整记录校验值相同、RLS 仍启用。目标库无 Supabase migration history 表，本次通过已认证 CLI 的 db query 执行单条迁移，未创建迁移历史表或重跑历史迁移。

## 验证与待完成验收

已完成 ESLint、TypeScript、生产构建、12 种语言键一致性和 diff 检查。临时目录中的 39 项隔离联调使用真实应用模块、官方 SDK、HMAC 和 PGlite PostgreSQL，提供虚构的外部 API 响应；覆盖首次付款、重复/并发处理、乱序、跨渠道唯一约束、恢复、续费、取消和失败账期，不是实际付款证据。迁移冲突检查可中止并保留旧索引。

已有本地 3000 服务通过 23 项 HTTP 检查，包括未登录、跨域、签名错误、合法未知通知和 12 个语言返回页。Preview 已部署并绑定域名；正确签名的无业务连通通知返回 200，错误签名返回 400。这个检查证明公网可达、绕过保护和验签配置，不证明 Creem 已投递真实付款事件。

真实付款、取消及账户额度验收需专用测试账号，由曦操作。首次测试顺序：登录 Preview → 选择 Creem 套餐 → 使用 Creem 测试付款 → 返回网站等待激活 → 核对 provider=creem 的单条订阅及额度 → 在账户页取消 → 核对 CANCELLED 且保留本期权益、阻止重订。真实续费和扣款失败尚未执行，不以隔离验证替代。

最终 Preview 部署为 `dpl_21DFxowZDx5pMYkJjjEFd65a3b2p`（READY），已绑定上述 Preview 域名。浏览器检查了匿名中文首页和付款返回页，未捕获页面错误；未登录时显示登录提示。当前尚未进行已登录 Creem 按钮或托管结账的真实付款验收。

## 单渠道应用边界

应用只查询 provider=creem 的订阅；历史渠道记录保留，不展示、不同步，也不参与额度或购买限制。旧渠道兼容入口已删除。`20261013000000_limit_open_subscriptions_to_creem.sql` 仅新增到仓库，尚未执行；发布前需要完成该索引迁移，避免历史开放记录阻止新订阅写入。当前部署及真实付款验收状态仍以上述已执行证据为准。
