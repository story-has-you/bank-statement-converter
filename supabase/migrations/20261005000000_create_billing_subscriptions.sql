create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  tier text not null check (tier in ('standard', 'professional', 'enterprise')),
  paypal_subscription_id text not null unique,
  paypal_plan_id text not null,
  status text not null check (
    status in (
      'APPROVAL_PENDING',
      'APPROVED',
      'ACTIVE',
      'SUSPENDED',
      'CANCELLED',
      'EXPIRED',
      'PAYMENT_FAILED'
    )
  ),
  payer_id text,
  subscriber_email text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  last_webhook_event_id text,
  last_event_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists billing_subscriptions_user_id_idx
  on public.billing_subscriptions (user_id);

create index if not exists billing_subscriptions_status_idx
  on public.billing_subscriptions (status);

alter table public.billing_subscriptions enable row level security;

create policy "Users can view their own billing subscriptions"
  on public.billing_subscriptions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_billing_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger billing_subscriptions_updated_at
before update on public.billing_subscriptions
for each row execute function public.set_billing_subscriptions_updated_at();
