-- 先发布业务代码并确认旧实例不再调用 RPC，再执行本迁移。
-- 仅清理自定义业务函数及其触发器，保留表、数据、约束、索引和权限。

drop trigger if exists billing_subscriptions_updated_at
  on public.billing_subscriptions;

drop function if exists public.set_billing_subscriptions_updated_at();

drop function if exists public.consume_conversion_quota(
  text, text, text, text, timestamptz, timestamptz, integer, integer
);

drop function if exists public.apply_billing_subscription_activation(
  text, timestamptz, text, text, text, timestamptz, timestamptz,
  uuid, text, text, text, numeric, text
);

drop function if exists public.apply_billing_webhook(
  text, timestamptz, text, text, text, text, timestamptz, timestamptz
);

drop function if exists public.reserve_billing_subscription_intent(uuid, text, text);

drop function if exists public.release_billing_subscription_intent(uuid);

drop function if exists public.complete_billing_subscription_intent(
  uuid, text, text, text, text, text, text, text, timestamptz, timestamptz
);

notify pgrst, 'reload schema';
