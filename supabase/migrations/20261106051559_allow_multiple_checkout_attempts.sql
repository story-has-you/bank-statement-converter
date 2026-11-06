begin;

alter table public.billing_subscription_intents
  drop constraint billing_subscription_intents_pkey,
  drop constraint billing_subscription_intents_attempt_id_key,
  add primary key (attempt_id);

create index billing_subscription_intents_user_id_idx
  on public.billing_subscription_intents (user_id);

notify pgrst, 'reload schema';
commit;
