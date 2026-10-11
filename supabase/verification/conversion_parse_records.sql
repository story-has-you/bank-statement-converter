-- 建表后由管理员执行。以下查询只读，不显示用户 ID、邮箱或逐条记录。
-- 预期：rls_enabled=true；表和全部 10 个字段均有中文注释。
select c.relrowsecurity as rls_enabled,
       obj_description(c.oid, 'pg_class') as table_comment
from pg_class c
where c.oid = 'public.conversion_parse_records'::regclass;

select a.attname as column_name,
       format_type(a.atttypid, a.atttypmod) as data_type,
       a.attnotnull as not_null,
       a.attidentity as identity_kind,
       pg_get_expr(d.adbin, d.adrelid) as column_default,
       col_description(a.attrelid, a.attnum) as column_comment
from pg_attribute a
left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
where a.attrelid = 'public.conversion_parse_records'::regclass
  and a.attnum > 0
  and not a.attisdropped
order by a.attnum;

-- 预期：主键、用户外键 ON DELETE CASCADE，以及方式、状态、分类 CHECK 约束。
select conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.conversion_parse_records'::regclass
order by contype, conname;

-- 预期：主键索引及 (user_id, created_at DESC) 索引。
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'conversion_parse_records'
order by indexname;

-- 预期：anon/authenticated 全为 false；service_role 只有 SELECT/INSERT 为 true。
select role_name,
       has_table_privilege(role_name, 'public.conversion_parse_records', 'SELECT') as can_select,
       has_table_privilege(role_name, 'public.conversion_parse_records', 'INSERT') as can_insert,
       has_table_privilege(role_name, 'public.conversion_parse_records', 'UPDATE') as can_update,
       has_table_privilege(role_name, 'public.conversion_parse_records', 'DELETE') as can_delete,
       has_table_privilege(role_name, 'public.conversion_parse_records', 'TRUNCATE') as can_truncate,
       has_sequence_privilege(role_name, 'public.conversion_parse_records_id_seq', 'USAGE') as can_use_sequence,
       has_sequence_privilege(role_name, 'public.conversion_parse_records_id_seq', 'SELECT') as can_select_sequence,
       has_sequence_privilege(role_name, 'public.conversion_parse_records_id_seq', 'UPDATE') as can_update_sequence
from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name);

-- 预期：没有 PUBLIC 的显式授权，也没有客户端访问策略。
select c.relname, privileges.privilege_type
from pg_class c
cross join lateral aclexplode(c.relacl) as privileges
where c.oid in (
  'public.conversion_parse_records'::regclass,
  'public.conversion_parse_records_id_seq'::regclass
) and privileges.grantee = 0;

select policyname, roles, cmd
from pg_policies
where schemaname = 'public' and tablename = 'conversion_parse_records';

-- 完成转换场景验收后检查聚合结果，不输出个人信息。
select parse_method, status, llm_trigger_category, python_error_code, error_code, count(*) as record_count
from public.conversion_parse_records
group by parse_method, status, llm_trigger_category, python_error_code, error_code
order by parse_method, status, llm_trigger_category, python_error_code, error_code;

-- 预期：以下逻辑不一致的记录数量全部为 0。
select count(*) filter (
         where (python_error_code is null) <> (python_error_reason is null)
       ) as incomplete_python_reasons,
       count(*) filter (
         where (parse_method = 'code' and llm_trigger_category is not null)
            or (parse_method = 'llm' and (llm_trigger_category is null or python_error_code is null))
       ) as inconsistent_fallback_records,
       count(*) filter (
         where (status = 'failed' and error_code is null)
            or (status <> 'failed' and error_code is not null)
       ) as inconsistent_final_errors
from public.conversion_parse_records;
