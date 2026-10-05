create table if not exists public.conversion_usage (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('anonymous', 'user')),
  actor_key text not null,
  email text,
  period text not null check (period in ('day', 'month')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  used_pages integer not null default 0 check (used_pages >= 0),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint conversion_usage_period_order check (period_start < period_end),
  constraint conversion_usage_actor_key_unique unique (actor_type, actor_key)
);

create index if not exists conversion_usage_updated_at_idx
  on public.conversion_usage (updated_at);

alter table public.conversion_usage enable row level security;

revoke all on public.conversion_usage from anon, authenticated;
grant all on public.conversion_usage to service_role;

create or replace function public.consume_conversion_quota(
  p_actor_type text,
  p_actor_key text,
  p_email text,
  p_period text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_page_count integer,
  p_limit_pages integer
)
returns jsonb
language plpgsql
volatile
as $$
declare
  current_row public.conversion_usage%rowtype;
  current_used_pages integer := 0;
  next_used_pages integer;
begin
  if p_actor_type not in ('anonymous', 'user') then
    raise exception 'Invalid usage actor type';
  end if;

  if p_period not in ('day', 'month') then
    raise exception 'Invalid usage period';
  end if;

  if p_actor_key is null or length(trim(p_actor_key)) = 0 then
    raise exception 'Usage actor key is required';
  end if;

  if p_period_start >= p_period_end then
    raise exception 'Usage period is invalid';
  end if;

  if p_page_count <= 0 or p_limit_pages <= 0 then
    raise exception 'Usage page values are invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_actor_type || ':' || p_actor_key, 0));

  select *
    into current_row
    from public.conversion_usage
   where actor_type = p_actor_type
     and actor_key = p_actor_key
   for update;

  if current_row.id is not null
     and current_row.period = p_period
     and current_row.period_start = p_period_start
     and current_row.period_end = p_period_end then
    current_used_pages := current_row.used_pages;
  end if;

  next_used_pages := current_used_pages + p_page_count;

  if next_used_pages > p_limit_pages then
    return jsonb_build_object(
      'allowed', false,
      'period', p_period,
      'usedPages', current_used_pages,
      'remainingPages', greatest(p_limit_pages - current_used_pages, 0),
      'limitPages', p_limit_pages
    );
  end if;

  if current_row.id is null then
    insert into public.conversion_usage (
      actor_type,
      actor_key,
      email,
      period,
      period_start,
      period_end,
      used_pages
    ) values (
      p_actor_type,
      p_actor_key,
      p_email,
      p_period,
      p_period_start,
      p_period_end,
      next_used_pages
    );
  else
    update public.conversion_usage
       set email = p_email,
           period = p_period,
           period_start = p_period_start,
           period_end = p_period_end,
           used_pages = next_used_pages,
           updated_at = timezone('utc', now())
     where id = current_row.id;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'period', p_period,
    'usedPages', next_used_pages,
    'remainingPages', p_limit_pages - next_used_pages,
    'limitPages', p_limit_pages
  );
end;
$$;

revoke all on function public.consume_conversion_quota(
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  integer,
  integer
) from public, anon, authenticated;

grant execute on function public.consume_conversion_quota(
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  integer,
  integer
) to service_role;
