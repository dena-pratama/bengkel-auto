-- Tes AI Analyst (migration 20261103000020): tool read-only, izin, token, log panggilan.
-- Berjalan dalam satu transaksi dan di-ROLLBACK.

\set QUIET on
\o /dev/null
begin;

create temporary table t_ids (k text primary key, v uuid);
grant select, insert on t_ids to authenticated;
insert into t_ids values ('u_owner', gen_random_uuid()), ('u_admin', gen_random_uuid());

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', k || '@test.local', now(), now() from t_ids;

do $$
declare
  b uuid := (select id from public.branches where code = 'PST');
  e uuid;
  r record;
begin
  for r in select * from (values ('u_owner', 'owner', 'T-OWN'), ('u_admin', 'admin', 'T-ADM')) x(k, role_code, code) loop
    insert into public.employees (branch_id, code, full_name) values (b, r.code, 'Uji ' || r.code) returning id into e;
    insert into t_ids values ('e_' || substr(r.k, 3), e);
    insert into public.profiles (id, branch_id, employee_id, email) values ((select v from t_ids where k = r.k), b, e, r.k || '@test.local');
    insert into public.employee_roles (branch_id, employee_id, role_id) values (b, e, (select id from public.roles where code = r.role_code));
  end loop;
end $$;

create or replace function pg_temp.login(p_key text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', (select v from t_ids where k = p_key), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create or replace function pg_temp.check(p_ok boolean, p_name text) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'GAGAL: %', p_name; end if;
  raise notice 'OK   %', p_name;
end $$;
create or replace function pg_temp.fails(p_sql text, p_expect text, p_name text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'GAGAL (tidak error): %', p_name;
exception when others then
  if sqlerrm like 'GAGAL%' then raise; end if;
  if position(p_expect in sqlerrm) = 0 then raise exception 'GAGAL: %: pesan tak terduga: %', p_name, sqlerrm; end if;
  raise notice 'OK   %', p_name;
end $$;

create or replace function pg_temp.id(p_key text) returns uuid language sql as $$ select v from t_ids where k = p_key $$;

-- Akses
select pg_temp.login('u_admin');
select pg_temp.fails($q$ select public.ai_run_tool('get_health_score') $q$, 'tidak punya izin', 'admin: tidak bisa memakai AI Analyst');
select pg_temp.fails($q$ select public.create_ai_token('x token') $q$, 'tidak punya izin', 'admin: tidak bisa membuat token');
select pg_temp.fails($q$ select public.ai_run_tool_token('abk_x', 'get_health_score') $q$, 'permission denied', 'authenticated tidak bisa memanggil fungsi token');

-- Semua tool jalan tanpa error
select pg_temp.login('u_owner');
do $$
declare
  t text; r jsonb; n integer := 0;
begin
  foreach t in array array['get_business_summary','get_health_score','get_sales_trend','get_stock_alerts','get_top_items','get_mechanic_performance',
                           'get_cash_position','get_receivables_payables','get_tax_summary','get_service_due_customers','get_inventory_accuracy'] loop
    r := public.ai_run_tool(t, '{}');
    if r ? 'error' then raise exception 'GAGAL: tool % error: %', t, r ->> 'error'; end if;
    n := n + 1;
  end loop;
  raise notice 'OK   % tool berjalan', n;
end $$;
select pg_temp.check((select count(*) = 11 from public.ai_tool_calls where ok and source = 'app' and employee_id = pg_temp.id('e_owner')), 'setiap panggilan tercatat di log');
select pg_temp.check((public.ai_run_tool('tool_palsu') ->> 'error') like '%tidak dikenal%', 'tool tak dikenal: error terkendali');
select pg_temp.check(exists (select 1 from public.ai_tool_calls where tool = 'tool_palsu' and not ok), 'panggilan gagal ikut tercatat');

-- Skor kesehatan
select pg_temp.check(jsonb_array_length(public.ai_run_tool('get_health_score') -> 'indicators') = 9, 'skor kesehatan: 9 indikator');
select pg_temp.check((public.ai_run_tool('get_business_summary', '{"from":"2020-01-01","to":"2020-01-31"}') ->> 'revenue')::numeric = 0, 'ringkasan periode kosong bernilai 0');
select pg_temp.check((public.ai_run_tool('get_sales_trend', '{"granularity":"year"}') ->> 'error') like '%granularity%', 'granularity salah ditolak');
select pg_temp.check(not (public.ai_run_tool('get_service_due_customers', '{"months":1}')::text ~* 'phone|whatsapp|address'), 'tool pelanggan tidak memuat HP/alamat');

-- Token
create temporary table t_tok (v text);
grant all on t_tok to authenticated;
insert into t_tok select public.create_ai_token('Claude Desktop');
select pg_temp.check((select v like 'abk_%' and length(v) = 52 from t_tok), 'token dibuat, format abk_ + 48 hex');
select pg_temp.check((select count(*) = 1 from public.ai_tokens where name = 'Claude Desktop' and token_prefix = (select left(v, 8) from t_tok)), 'token tercatat dengan prefix');
select pg_temp.fails($q$ select token_hash from public.ai_tokens $q$, 'permission denied', 'hash token tidak bisa dibaca');
reset role;
select pg_temp.check((select public.ai_run_tool_token((select v from t_tok), 'get_health_score') ? 'score'), 'token valid menjalankan tool sebagai pemilik');
select pg_temp.check(exists (select 1 from public.ai_tool_calls where source = 'mcp' and employee_id = pg_temp.id('e_owner')), 'log mcp mencatat pemilik token');
select pg_temp.check((select last_used_at is not null from public.ai_tokens where name = 'Claude Desktop'), 'last_used_at terisi');
select pg_temp.login('u_owner');
select public.revoke_ai_token((select id from public.ai_tokens where name = 'Claude Desktop'));
reset role;
select pg_temp.fails(format($q$ select public.ai_run_tool_token('%s', 'get_health_score') $q$, (select v from t_tok)), 'tidak valid', 'token dicabut ditolak');
select pg_temp.fails($q$ select public.ai_run_tool_token('abk_palsu', 'get_health_score') $q$, 'tidak valid', 'token palsu ditolak');
select pg_temp.login('u_owner');
select pg_temp.fails($q$ delete from public.ai_tool_calls $q$, 'permission denied', 'log panggilan tidak bisa dihapus');

reset role;
rollback;
\o
\echo SEMUA TES AI ANALYST LULUS
