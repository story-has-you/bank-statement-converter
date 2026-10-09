create table if not exists public.billing_subscription_intents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null check (tier in ('standard', 'professional', 'enterprise')),
  paypal_plan_id text not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.billing_subscription_intents enable row level security;
revoke all on public.billing_subscription_intents from anon, authenticated;
grant all on public.billing_subscription_intents to service_role;

create table if not exists public.billing_webhook_events (
  event_id text primary key,
  event_at timestamptz not null,
  paypal_subscription_id text not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.billing_webhook_events enable row level security;
revoke all on public.billing_webhook_events from anon, authenticated;
grant all on public.billing_webhook_events to service_role;

create unique index if not exists billing_subscriptions_open_user_idx
  on public.billing_subscriptions (user_id)
  where status in ('APPROVAL_PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED');

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

revoke all on function public.apply_billing_webhook(
  text, timestamptz, text, text, text, text, timestamptz, timestamptz
)
  from public, anon, authenticated;
grant execute on function public.apply_billing_webhook(
  text, timestamptz, text, text, text, text, timestamptz, timestamptz
)
  to service_role;

create or replace function public.reserve_billing_subscription_intent(
  p_user_id uuid,
  p_tier text,
  p_plan_id text
)
returns boolean
language plpgsql
volatile
as $$
begin
  delete from public.billing_subscription_intents
   where user_id = p_user_id
     and created_at < timezone('utc', now()) - interval '10 minutes';

  insert into public.billing_subscription_intents (user_id, tier, paypal_plan_id)
  values (p_user_id, p_tier, p_plan_id)
  on conflict (user_id) do nothing;
  return found;
end;
$$;

create or replace function public.release_billing_subscription_intent(p_user_id uuid)
returns void
language sql
volatile
as $$
  delete from public.billing_subscription_intents where user_id = p_user_id;
$$;

create or replace function public.complete_billing_subscription_intent(
  p_user_id uuid,
  p_email text,
  p_tier text,
  p_plan_id text,
  p_subscription_id text,
  p_status text,
  p_payer_id text,
  p_subscriber_email text,
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns boolean
language plpgsql
volatile
as $$
declare
  intent public.billing_subscription_intents%rowtype;
begin
  select * into intent
    from public.billing_subscription_intents
   where user_id = p_user_id
   for update;

  if intent.user_id is null
     or intent.tier <> p_tier
     or intent.paypal_plan_id <> p_plan_id then
    return false;
  end if;

  insert into public.billing_subscriptions (
    user_id, email, tier, paypal_subscription_id, paypal_plan_id, status,
    payer_id, subscriber_email, current_period_start, current_period_end
  ) values (
    p_user_id, p_email, p_tier, p_subscription_id, p_plan_id, p_status,
    p_payer_id, p_subscriber_email, p_period_start, p_period_end
  );

  delete from public.billing_subscription_intents where user_id = p_user_id;
  return true;
exception when unique_violation then
  delete from public.billing_subscription_intents where user_id = p_user_id;
  return false;
end;
$$;

revoke all on function public.reserve_billing_subscription_intent(uuid, text, text),
  public.release_billing_subscription_intent(uuid),
  public.complete_billing_subscription_intent(
    uuid, text, text, text, text, text, text, text, timestamptz, timestamptz
  )
  from public, anon, authenticated;

grant execute on function public.reserve_billing_subscription_intent(uuid, text, text),
  public.release_billing_subscription_intent(uuid),
  public.complete_billing_subscription_intent(
    uuid, text, text, text, text, text, text, text, timestamptz, timestamptz
  )
  to service_role;

notify pgrst, 'reload schema';
