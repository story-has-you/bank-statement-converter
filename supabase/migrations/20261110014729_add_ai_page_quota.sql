alter table public.conversion_usage
  add column used_ai_pages integer not null default 0
  check (used_ai_pages >= 0 and used_ai_pages <= used_pages);

notify pgrst, 'reload schema';
