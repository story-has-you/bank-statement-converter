create table public.billing_checkout_analytics (
  checkout_id text primary key,
  client_id text not null check (client_id ~ '^[0-9]{1,20}[.][0-9]{1,20}$'),
  session_id bigint not null check (session_id between 1 and 9007199254740991),
  locale text not null,
  created_at timestamptz not null default now()
);

alter table public.billing_checkout_analytics enable row level security;
revoke all on public.billing_checkout_analytics from public, anon, authenticated, service_role;
grant select, insert, delete on public.billing_checkout_analytics to service_role;
