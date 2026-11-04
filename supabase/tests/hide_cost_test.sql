-- Tes kolom HPP tersembunyi (migration 20261103000021). Berjalan dalam satu transaksi dan di-ROLLBACK.
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

select pg_temp.login('u_admin');
select pg_temp.fails($q$ select cogs_total from public.sales $q$, 'permission denied', 'sales.cogs_total tidak terbaca');
select pg_temp.fails($q$ select cost_total from public.sale_items $q$, 'permission denied', 'sale_items.cost_total tidak terbaca');
select pg_temp.fails($q$ select cogs_total from public.sale_returns $q$, 'permission denied', 'sale_returns.cogs_total tidak terbaca');
select pg_temp.fails($q$ select unit_cost from public.sale_return_items $q$, 'permission denied', 'sale_return_items.unit_cost tidak terbaca');
select pg_temp.fails($q$ select cost_total from public.sale_return_items $q$, 'permission denied', 'sale_return_items.cost_total tidak terbaca');
select pg_temp.fails($q$ select * from public.sales $q$, 'permission denied', 'select * pada sales ditolak (hindari wildcard)');
select pg_temp.check((select count(*) >= 0 from (select id, sale_no, total from public.sales limit 1) x), 'kolom non-HPP sales tetap terbaca');
select pg_temp.check((select count(*) >= 0 from (select * from public.v_sales limit 1) x), 'v_sales tetap bisa select *');
select pg_temp.check((select count(*) >= 0 from (select * from public.v_sale_returns limit 1) x), 'v_sale_returns tetap bisa select *');
select pg_temp.check(not exists (select 1 from information_schema.columns where table_name = 'v_sale_returns' and column_name = 'cogs_total'), 'v_sale_returns tanpa cogs_total');

reset role;
rollback;
\o
\echo SEMUA TES KOLOM HPP LULUS
