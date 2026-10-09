alter table public.billing_subscription_intents
  add column if not exists paypal_subscription_id text;

create unique index if not exists billing_subscription_intents_paypal_subscription_id_idx
  on public.billing_subscription_intents (paypal_subscription_id)
  where paypal_subscription_id is not null;

create or replace function public.bind_billing_subscription_intent(
  p_user_id uuid,
  p_subscription_id text
)
returns boolean
language plpgsql
volatile
as $$
begin
  update public.billing_subscription_intents
     set paypal_subscription_id = p_subscription_id
   where user_id = p_user_id
     and paypal_subscription_id is null;

  if found then
    if exists (
      select 1 from public.billing_subscriptions
       where user_id = p_user_id
         and paypal_subscription_id = p_subscription_id
    ) then
      delete from public.billing_subscription_intents
       where user_id = p_user_id
         and paypal_subscription_id = p_subscription_id;
    end if;
    return true;
  end if;

  -- A payment webhook can arrive before the create request finishes binding its intent.
  return exists (
    select 1 from public.billing_subscriptions
     where user_id = p_user_id
       and paypal_subscription_id = p_subscription_id
  );
end;
$$;

create or replace function public.release_billing_subscription_intent_for_subscription(
  p_user_id uuid,
  p_subscription_id text
)
returns void
language sql
volatile
as $$
  delete from public.billing_subscription_intents
   where user_id = p_user_id
     and paypal_subscription_id = p_subscription_id;
$$;

create or replace function public.apply_billing_webhook_event(
  p_event_id text,
  p_event_at timestamptz,
  p_event_type text,
  p_subscription_id text,
  p_status text,
  p_payer_id text,
  p_subscriber_email text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_user_id uuid,
  p_email text,
  p_tier text,
  p_plan_id text
)
returns text
language plpgsql
volatile
as $$
declare
  current_row public.billing_subscriptions%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext(p_subscription_id));

  insert into public.billing_webhook_events (event_id, event_at, paypal_subscription_id)
  values (p_event_id, p_event_at, p_subscription_id)
  on conflict (event_id) do nothing;

  if not found then
    return 'ignored';
  end if;

  select * into current_row
    from public.billing_subscriptions
   where paypal_subscription_id = p_subscription_id
   for update;

  if p_status = 'PAYMENT_FAILED'
     or p_event_type in ('BILLING.SUBSCRIPTION.CANCELLED', 'BILLING.SUBSCRIPTION.EXPIRED') then
    delete from public.billing_subscription_intents
     where paypal_subscription_id = p_subscription_id;
  end if;

  if current_row.id is null then
    if p_event_type <> 'PAYMENT.SALE.COMPLETED' or p_status <> 'ACTIVE' then
      return 'ignored';
    end if;

    if p_user_id is null or nullif(p_email, '') is null or p_tier is null or p_plan_id is null
       or p_current_period_start is null or p_current_period_end is null
       or p_current_period_start >= p_current_period_end
       or p_current_period_end <= now() then
      raise exception 'Incomplete paid PayPal subscription' using errcode = '22023';
    end if;

    insert into public.billing_subscriptions (
      user_id, email, tier, paypal_subscription_id, paypal_plan_id, status,
      payer_id, subscriber_email, current_period_start, current_period_end,
      last_webhook_event_id, last_event_at
    ) values (
      p_user_id, p_email, p_tier, p_subscription_id, p_plan_id, 'ACTIVE',
      p_payer_id, p_subscriber_email, p_current_period_start, p_current_period_end,
      p_event_id, p_event_at
    );

    delete from public.billing_subscription_intents
     where paypal_subscription_id = p_subscription_id;
    return 'applied';
  end if;

  if current_row.last_event_at is not null and p_event_at < current_row.last_event_at then
    return 'ignored';
  end if;

  if p_event_type <> 'PAYMENT.SALE.COMPLETED' and p_status = 'ACTIVE'
     and current_row.status <> 'ACTIVE' then
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

revoke all on function public.bind_billing_subscription_intent(uuid, text),
  public.release_billing_subscription_intent_for_subscription(uuid, text),
  public.apply_billing_webhook_event(
    text, timestamptz, text, text, text, text, text,
    timestamptz, timestamptz, uuid, text, text, text
  )
  from public, anon, authenticated;

grant execute on function public.bind_billing_subscription_intent(uuid, text),
  public.release_billing_subscription_intent_for_subscription(uuid, text),
  public.apply_billing_webhook_event(
    text, timestamptz, text, text, text, text, text,
    timestamptz, timestamptz, uuid, text, text, text
  )
  to service_role;

drop function if exists public.complete_billing_subscription_intent(
  uuid, text, text, text, text, text, text, text, timestamptz, timestamptz
);

drop function if exists public.apply_billing_webhook(
  text, timestamptz, text, text, text, text, timestamptz, timestamptz
);

notify pgrst, 'reload schema';
