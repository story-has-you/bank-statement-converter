alter table public.billing_subscriptions
  add column amount numeric(18,6),
  add column currency_code text;

alter table public.billing_subscriptions
  add constraint billing_subscriptions_amount_check
    check (amount is null or amount > 0),
  add constraint billing_subscriptions_currency_code_check
    check (currency_code is null or currency_code ~ '^[A-Z]{3}$'),
  add constraint billing_subscriptions_payment_pair_check
    check ((amount is null) = (currency_code is null));

create function public.apply_billing_subscription_activation(
  p_event_id text,
  p_event_at timestamptz,
  p_subscription_id text,
  p_payer_id text,
  p_subscriber_email text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_user_id uuid,
  p_email text,
  p_tier text,
  p_plan_id text,
  p_amount numeric,
  p_currency_code text
)
returns text
language plpgsql
volatile
as $$
declare
  current_row public.billing_subscriptions%rowtype;
begin
  if nullif(p_event_id, '') is null or p_event_at is null
     or nullif(p_subscription_id, '') is null or p_user_id is null
     or nullif(p_email, '') is null or p_tier is null
     or p_tier not in ('standard', 'professional', 'enterprise')
     or nullif(p_plan_id, '') is null or p_amount is null or p_amount <= 0
     or p_currency_code is null or p_currency_code !~ '^[A-Z]{3}$'
     or p_current_period_start is null or p_current_period_end is null
     or p_current_period_start >= p_current_period_end
     or p_current_period_end <= now() then
    raise exception 'Incomplete PayPal subscription activation' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_subscription_id));

  select * into current_row
    from public.billing_subscriptions
   where paypal_subscription_id = p_subscription_id
   for update;

  if current_row.id is not null and
     (current_row.user_id <> p_user_id or current_row.paypal_plan_id <> p_plan_id
      or current_row.tier <> p_tier) then
    raise exception 'PayPal subscription identity mismatch' using errcode = '22023';
  end if;

  if current_row.id is not null and current_row.last_webhook_event_id = p_event_id then
    return 'ignored';
  end if;

  if current_row.id is not null and current_row.last_event_at is not null
     and p_event_at < current_row.last_event_at then
    return 'ignored';
  end if;

  if current_row.id is null then
    insert into public.billing_subscriptions (
      user_id, email, tier, paypal_subscription_id, paypal_plan_id, status,
      amount, currency_code, payer_id, subscriber_email,
      current_period_start, current_period_end, last_webhook_event_id, last_event_at
    ) values (
      p_user_id, p_email, p_tier, p_subscription_id, p_plan_id, 'ACTIVE',
      p_amount, p_currency_code, p_payer_id, p_subscriber_email,
      p_current_period_start, p_current_period_end, p_event_id, p_event_at
    );
  else
    update public.billing_subscriptions
       set status = 'ACTIVE',
           amount = coalesce(amount, p_amount),
           currency_code = coalesce(currency_code, p_currency_code),
           payer_id = coalesce(p_payer_id, payer_id),
           subscriber_email = coalesce(p_subscriber_email, subscriber_email),
           current_period_start = p_current_period_start,
           current_period_end = p_current_period_end,
           last_webhook_event_id = p_event_id,
           last_event_at = p_event_at
     where id = current_row.id;
  end if;

  return 'applied';
end;
$$;

revoke all on function public.apply_billing_subscription_activation(
  text, timestamptz, text, text, text, timestamptz, timestamptz,
  uuid, text, text, text, numeric, text
) from public, anon, authenticated;

grant execute on function public.apply_billing_subscription_activation(
  text, timestamptz, text, text, text, timestamptz, timestamptz,
  uuid, text, text, text, numeric, text
) to service_role;

drop function if exists public.apply_billing_webhook_event(
  text, timestamptz, text, text, text, text, text,
  timestamptz, timestamptz, uuid, text, text, text
);

notify pgrst, 'reload schema';
