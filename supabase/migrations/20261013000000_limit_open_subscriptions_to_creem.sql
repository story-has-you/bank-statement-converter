-- 保留历史渠道记录，仅对当前支持的渠道限制每个用户最多一条开放订阅。
-- 本迁移需在发布应用前执行；不删除记录，也不修改权益、RLS 或权限。
begin;

lock table public.billing_subscriptions in share row exclusive mode;

do $$
begin
  if exists (
    select 1 from public.billing_subscriptions
    where provider = 'creem'
      and status in ('APPROVAL_PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'PAYMENT_FAILED')
    group by user_id having count(*) > 1
  ) then
    raise exception 'Open Creem subscription conflicts must be resolved before migration';
  end if;
end;
$$;

drop index public.billing_subscriptions_open_user_idx;

create unique index billing_subscriptions_open_user_idx
  on public.billing_subscriptions (user_id)
  where provider = 'creem'
    and status in ('APPROVAL_PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'PAYMENT_FAILED');

commit;
