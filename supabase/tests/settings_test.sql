-- Tes pengaturan bengkel (migration 20261103000026). Berjalan dalam satu transaksi dan di-ROLLBACK.
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
select pg_temp.fails($q$ select public.save_settings('{"discount_limit_cashier": 8}') $q$, 'tidak punya izin', 'admin: tidak bisa mengubah pengaturan');

select pg_temp.login('u_owner');
select public.save_settings('{"discount_limit_cashier": 8, "discount_limit_admin": 15, "opname_pin_threshold": 750000, "sales_return_max_days": 14, "allow_negative_stock": true, "part_issue_require_scan": true}');
select pg_temp.check((select (value #>> '{}')::numeric = 8 from public.settings where key = 'discount_limit_cashier' and branch_id = (select id from public.branches where code = 'PST')), 'diskon kasir tersimpan');
select pg_temp.check((select (value #>> '{}')::int = 14 from public.settings where key = 'sales_return_max_days' and branch_id = (select id from public.branches where code = 'PST')), 'batas hari retur tersimpan');
reset role;
select pg_temp.check(app.setting_bool('part_issue_require_scan') and app.setting_bool('allow_negative_stock'), 'saklar boolean terbaca fungsi inti');
select pg_temp.login('u_owner');
select pg_temp.check(exists (select 1 from public.audit_logs where table_name = 'settings' and action in ('update', 'insert') and actor_employee_id = pg_temp.id('e_owner')), 'perubahan pengaturan tercatat di audit log');

select pg_temp.fails($q$ select public.save_settings('{"discount_limit_cashier": 150}') $q$, 'Batas diskon', 'diskon di atas 100 persen ditolak');
select pg_temp.fails($q$ select public.save_settings('{"sales_return_max_days": 3.5}') $q$, 'bilangan bulat', 'hari retur pecahan ditolak');
select pg_temp.fails($q$ select public.save_settings('{"opname_pin_threshold": -1}') $q$, 'tidak boleh minus', 'ambang minus ditolak');
select pg_temp.fails($q$ select public.save_settings('{"allow_negative_stock": "ya"}') $q$, 'ya atau tidak', 'boolean salah tipe ditolak');
select pg_temp.fails($q$ select public.save_settings('{"ppn_enabled": true}') $q$, 'tidak dikenal', 'setelan pajak tidak bisa diubah dari sini');
select pg_temp.fails($q$ select public.save_settings('{}') $q$, 'Tidak ada pengaturan', 'payload kosong ditolak');

reset role;
-- Notifikasi dari pemicu (pusat notifikasi)
reset role;
select pg_temp.check(exists (select 1 from public.notifications where kind = 'settings_changed'), 'notifikasi settings_changed tercatat oleh pemicu');

rollback;
\o
\echo SEMUA TES PENGATURAN LULUS
