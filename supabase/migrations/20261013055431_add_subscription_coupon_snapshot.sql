begin;

alter table public.billing_subscriptions
  add column original_amount numeric(18,6),
  add column discount_amount numeric(18,6),
  add column provider_discount_id text;

-- 仅渠道已确认全额抵扣的 Creem 付款允许为零；历史金额不回填。
alter table public.billing_subscriptions
  drop constraint billing_subscriptions_amount_check,
  add constraint billing_subscriptions_amount_check check (
    amount is null
    or amount > 0
    or (
      amount = 0
      and provider = 'creem'
      and original_amount is not null and original_amount > 0
      and discount_amount is not null and discount_amount = original_amount
      and provider_discount_id is not null and btrim(provider_discount_id) <> ''
    )
  ),
  add constraint billing_subscriptions_discount_snapshot_check check (
    (original_amount is null and discount_amount is null and provider_discount_id is null)
    or (
      original_amount is not null and original_amount > 0
      and discount_amount is not null and discount_amount >= 0
      and amount is not null and amount >= 0
      and original_amount = amount + discount_amount
      and (
        (discount_amount = 0 and provider_discount_id is null)
        or (discount_amount > 0 and provider_discount_id is not null and btrim(provider_discount_id) <> '')
      )
    )
  );

comment on column public.billing_subscriptions.original_amount is '首次付款的套餐含税原价；历史记录未知时为空。';
comment on column public.billing_subscriptions.discount_amount is '首次付款经渠道核实的优惠券抵扣金额；续费不覆盖。';
comment on column public.billing_subscriptions.provider_discount_id is '首次付款使用的渠道优惠券 ID，不保存优惠码。';

notify pgrst, 'reload schema';

commit;
