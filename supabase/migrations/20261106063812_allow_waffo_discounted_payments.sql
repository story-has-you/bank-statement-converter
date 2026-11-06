begin;

alter table public.billing_subscriptions
  drop constraint billing_subscriptions_amount_check,
  add constraint billing_subscriptions_amount_check check (
    amount is null
    or amount > 0
    or (
      amount = 0
      and provider in ('creem', 'waffo')
      and original_amount is not null and original_amount > 0
      and discount_amount is not null and discount_amount = original_amount
      and provider_discount_id is not null and btrim(provider_discount_id) <> ''
    )
  );

commit;
