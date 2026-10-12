# PayPal 和 Creem 支付开关实施计划

**目标：** 两种支付独立开关；关闭时隐藏按钮，可见按钮在同一行排列，服务端拒绝新建结账。

**实现：** 在服务端渠道注册模块读取 `PAYPAL_PAYMENT_ENABLED` 和 `CREEM_PAYMENT_ENABLED`，过滤关闭的渠道。创建订阅前检查同一开关，取消、确认和回调继续使用原配置。按钮区域使用横向自动列，按可见渠道数量均分宽度。

**约束：** 不新增依赖、不写单元测试、不启动服务、不调用支付提供方、不修改真实数据库。未设置开关时兼容现有行为；已设置时仅 `true` 开启，忽略首尾空白及大小写。

- [x] 修改 `src/lib/billing/providers.ts`，新增 `isPaymentProviderEnabled(provider: PaymentProviderId): boolean`，并在 `getCheckoutConfigs()` 过滤关闭的渠道。
- [x] 修改 `src/lib/billing/subscriptions.ts`，在 `createSubscription()` 首先拒绝关闭的渠道，返回 `paymentDisabled`、HTTP 503。
- [x] 修改 `src/components/billing/subscription-options.tsx`，按钮保持单行，只有一个时占满整行，全部关闭时返回空。
- [x] 修改 `src/components/billing/subscription-button.tsx`，开启但配置不可用时渲染禁用按钮，仅在无障碍标签和 title 中显示本地化提示，不挂载支付会话。
- [x] 在全部 12 个 `messages/*.json` 增加 API 的 `paymentDisabled`，将 `providerUnavailable` 调整为渠道暂不可用提示。
- [x] 更新 `README.md` 以及 PayPal、Creem 环境变量模板，说明默认值、开启条件、关闭范围及重新部署要求。
- [x] 执行定向 ESLint、TypeScript、文案键和占位符校验、`git diff --check`；按 `code-simplifier` 检查清晰度和范围。

实施在当前会话继续进行，实际支付和部署环境验收另行确认。

**验证结果：** 定向 ESLint、`pnpm exec tsc --noEmit`、12 种 Billing 文案键与占位符检查、`git diff --check` 均通过。已按 code-simplifier 检查，保留单一开关判断函数，在服务端过滤关闭渠道；单行布局根据可见按钮数量分配宽度，未新增支付状态或组件抽象。真实支付、登录页面按钮及部署环境未验证。
