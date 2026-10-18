-- 三个支付渠道共用用户开放订阅约束；保留记录、RLS、策略及权限。
begin;

lock table public.billing_subscriptions in share row exclusive mode;

do $$
begin
  if exists (
    select 1 from public.billing_subscriptions
    where provider in ('creem', 'paypal', 'waffo')
      and status in ('APPROVAL_PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'PAYMENT_FAILED')
    group by user_id having count(*) > 1
  ) then
    raise exception 'Open subscription conflicts must be resolved before enabling Waffo';
  end if;
end;
$$;

drop index public.billing_subscriptions_open_user_idx;

create unique index billing_subscriptions_open_user_idx
  on public.billing_subscriptions (user_id)
  where provider in ('creem', 'paypal', 'waffo')
    and status in ('APPROVAL_PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'PAYMENT_FAILED');

commit;
