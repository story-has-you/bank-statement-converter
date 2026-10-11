begin;

create table public.conversion_parse_records (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  parse_method text not null check (parse_method in ('code', 'llm')),
  status text not null check (status in ('success', 'partial', 'failed', 'cancelled')),
  python_error_code text,
  python_error_reason text,
  llm_trigger_category text check (llm_trigger_category in ('parsing', 'service', 'response', 'unknown')),
  error_code text
);

create index conversion_parse_records_user_created_at_idx
  on public.conversion_parse_records (user_id, created_at desc);

alter table public.conversion_parse_records enable row level security;

revoke all on public.conversion_parse_records from public, anon, authenticated, service_role;
grant select, insert on public.conversion_parse_records to service_role;
revoke all on sequence public.conversion_parse_records_id_seq from public, anon, authenticated, service_role;
grant usage on sequence public.conversion_parse_records_id_seq to service_role;

comment on table public.conversion_parse_records is
  '登录用户解析尝试的运维记录，仅保存身份、解析方式、结局及安全的失败原因；不保存 PDF、文件名、流水明细、导出内容或模型输出。异步尽力写入，不提供历史结果下载。';
comment on column public.conversion_parse_records.id is
  '解析记录唯一标识。';
comment on column public.conversion_parse_records.created_at is
  '记录写入时间，使用带时区的时间戳。';
comment on column public.conversion_parse_records.user_id is
  '发起本次解析的登录用户 ID；关联 auth.users，删除账号时级联删除记录。';
comment on column public.conversion_parse_records.email is
  '发起解析时的账号邮箱快照；账号没有邮箱时为空。';
comment on column public.conversion_parse_records.parse_method is
  '最后选择的解析方式：code 表示 Python 代码解析，llm 表示大模型解析；不代表解析成功，也不保证已完成外部模型调用。';
comment on column public.conversion_parse_records.status is
  '本次转换结果：success 成功、partial 部分成功、failed 失败、cancelled 取消；不代表下载完成或后台额度扣减结果。';
comment on column public.conversion_parse_records.python_error_code is
  'Python 阶段失败的稳定错误码；Python 成功或在该阶段取消时为空；未知错误归一化为 UNKNOWN。';
comment on column public.conversion_parse_records.python_error_reason is
  '根据 Python 错误码生成的固定原因说明，不包含文件内容或原始异常文本；未知原因明确标记，不推测具体版式问题。';
comment on column public.conversion_parse_records.llm_trigger_category is
  '大模型回退原因分类：parsing 解析能力问题、service 服务故障、response 响应异常、unknown 原因未知；未回退时为空。';
comment on column public.conversion_parse_records.error_code is
  '本次转换最终失败的稳定错误码，与 Python 回退原因分开保存；成功、部分成功或取消时为空，未知错误归一化为 UNKNOWN。';

commit;
