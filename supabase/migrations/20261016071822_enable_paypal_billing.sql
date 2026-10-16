-- 跨 Creem、PayPal 保持每个用户最多一条开放订阅，保留全部既有数据及权限。
begin;

lock table public.billing_subscriptions in share row exclusive mode;

do $$
begin
  if exists (
    select 1 from public.billing_subscriptions
    where provider in ('creem', 'paypal')
      and status in ('APPROVAL_PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'PAYMENT_FAILED')
    group by user_id having count(*) > 1
  ) then
    raise exception 'Open subscription conflicts must be resolved before enabling PayPal';
  end if;
end;
$$;

drop index public.billing_subscriptions_open_user_idx;

create unique index billing_subscriptions_open_user_idx
  on public.billing_subscriptions (user_id)
  where provider in ('creem', 'paypal')
    and status in ('APPROVAL_PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'PAYMENT_FAILED');

commit;
