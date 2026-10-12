-- 续费失败仍可能重试扣款，属于开放订阅；在同一事务中替换现有唯一索引。
-- 如已有用户包含多条开放订阅，CREATE UNIQUE INDEX 将失败并回滚，禁止自动清理记录。
lock table public.billing_subscriptions in share row exclusive mode;
do $$
begin
  if exists (
    select 1 from public.billing_subscriptions
    where status in ('APPROVAL_PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'PAYMENT_FAILED')
    group by user_id having count(*) > 1
  ) then
    raise exception 'Open subscription conflicts must be resolved before migration';
  end if;
end;
$$;
drop index public.billing_subscriptions_open_user_idx;
create unique index billing_subscriptions_open_user_idx
  on public.billing_subscriptions (user_id)
  where status in ('APPROVAL_PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'PAYMENT_FAILED');
