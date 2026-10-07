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

create unique index if not exists billing_subscriptions_open_user_idx
  on public.billing_subscriptions (user_id)
  where status in ('APPROVAL_PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED');

create table if not exists public.billing_webhook_events (
  event_id text primary key,
  event_at timestamptz not null,
  paypal_subscription_id text not null,
  created_at timestamptz not null default timezone('utc', now())
);

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

create or replace function public.apply_billing_webhook(
  p_event_id text,
  p_event_at timestamptz,
  p_subscription_id text,
  p_status text,
  p_payer_id text,
  p_subscriber_email text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz
)
returns text
language plpgsql
volatile
as $$
declare
  current_row public.billing_subscriptions%rowtype;
begin
  select * into current_row
    from public.billing_subscriptions
   where paypal_subscription_id = p_subscription_id
   for update;

  if current_row.id is null then
    return 'not_found';
  end if;

  insert into public.billing_webhook_events (event_id, event_at, paypal_subscription_id)
  values (p_event_id, p_event_at, p_subscription_id)
  on conflict (event_id) do nothing;

  if not found then
    return 'ignored';
  end if;

  if current_row.last_event_at is not null and p_event_at < current_row.last_event_at then
    return 'ignored';
  end if;

  update public.billing_subscriptions
     set status = p_status,
         payer_id = coalesce(p_payer_id, payer_id),
         subscriber_email = coalesce(p_subscriber_email, subscriber_email),
         current_period_start = coalesce(p_current_period_start, current_period_start),
         current_period_end = coalesce(p_current_period_end, current_period_end),
         last_webhook_event_id = p_event_id,
         last_event_at = p_event_at
   where id = current_row.id;

  return 'applied';
end;
$$;

revoke all on function public.apply_billing_webhook(text, timestamptz, text, text, text, text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_billing_webhook(text, timestamptz, text, text, text, text, timestamptz, timestamptz)
  to service_role;
