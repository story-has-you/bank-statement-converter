-- 一次协调切换：执行前停止所有旧实例对计费表的读写，Webhook 返回可重试错误。
-- 仅迁移列和唯一约束，保留原数据、RLS、权限以及用户开放订阅的部分唯一索引。
alter table public.billing_subscriptions
  rename column paypal_subscription_id to provider_subscription_id;

alter table public.billing_subscriptions
  rename column paypal_plan_id to provider_plan_id;

alter table public.billing_subscriptions
  add column provider text not null default 'paypal';

alter table public.billing_subscriptions
  alter column provider drop default,
  add constraint billing_subscriptions_provider_check check (provider <> ''),
  drop constraint billing_subscriptions_paypal_subscription_id_key,
  add constraint billing_subscriptions_provider_subscription_key
    unique (provider, provider_subscription_id);

notify pgrst, 'reload schema';
