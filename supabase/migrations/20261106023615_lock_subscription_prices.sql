begin;

alter table public.billing_subscription_intents
  add column quoted_amount_usd numeric(12,2)
    check (quoted_amount_usd > 0 and quoted_amount_usd <> 'NaN'::numeric);

alter table public.billing_subscriptions
  add column recurring_amount_usd numeric(12,2)
    check (recurring_amount_usd > 0 and recurring_amount_usd <> 'NaN'::numeric);

notify pgrst, 'reload schema';
commit;
