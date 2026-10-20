-- 发布时暂停创建结账，确认旧实例退出后再开放；存量外部结账须补录或确认失效。
begin;

-- 部分现有环境未保留早期占位表，先补齐历史结构，再统一执行以下增量。
create table if not exists public.billing_subscription_intents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null check (tier in ('standard', 'professional', 'enterprise')),
  paypal_plan_id text not null,
  created_at timestamptz not null default now()
);

lock table public.billing_subscription_intents in share row exclusive mode;

alter table public.billing_subscription_intents
  rename column paypal_plan_id to provider_plan_id;

-- 遗留记录缺少渠道结账证据，保持 UNKNOWN，禁止按创建时间自动释放。
alter table public.billing_subscription_intents
  add column provider text not null default 'paypal'
    check (provider in ('creem', 'paypal', 'waffo')),
  add column attempt_id uuid not null default gen_random_uuid() unique,
  add column status text not null default 'UNKNOWN'
    check (status in ('CREATING', 'READY', 'UNKNOWN', 'COMPLETED', 'CLOSED')),
  add column checkout_id text,
  add column checkout_url text,
  add column expires_at timestamptz,
  add column updated_at timestamptz not null default now(),
  add constraint billing_subscription_intents_ready_checkout_check
    check (status <> 'READY' or (checkout_id is not null and checkout_url is not null));

alter table public.billing_subscription_intents
  alter column provider drop default,
  alter column status drop default;

create unique index billing_subscription_intents_checkout_idx
  on public.billing_subscription_intents (provider, checkout_id)
  where checkout_id is not null;

alter table public.billing_subscription_intents enable row level security;
revoke all on public.billing_subscription_intents from public, anon, authenticated;
grant select, insert, update on public.billing_subscription_intents to service_role;

notify pgrst, 'reload schema';
commit;
