-- Tes kompatibilitas kendaraan pada barang (migration 20261103000028). Berjalan dalam satu transaksi dan di-ROLLBACK.
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

select pg_temp.login('u_owner');
insert into t_ids select 'i_busi', public.save_item(null, jsonb_build_object('name', 'Busi Uji Kompat', 'base_unit_id', (select id from public.units where code = 'pcs'), 'sell_price', 30000), '[]', '[]');
select public.save_item_compatibilities(pg_temp.id('i_busi'), '[
  {"make": "toyota", "model": "Avanza", "year_from": 2012, "year_to": 2018, "engine": "1.3 VVT-i"},
  {"make": "Toyota", "model": "avanza", "year_from": 2012, "year_to": 2018, "engine": "1.3 vvt-i"},
  {"make": "Daihatsu", "model": "Xenia"}]');
select pg_temp.check((select count(*) = 2 from public.item_compatibilities where item_id = pg_temp.id('i_busi')), 'kompat: dua kendaraan tersimpan, baris kembar diabaikan');
select pg_temp.check((select count(distinct m.make_id) = 2 from public.item_compatibilities c join public.vehicle_models m on m.id = c.model_id where c.item_id = pg_temp.id('i_busi')), 'kompat: merek baru dibuat otomatis (Toyota dan Daihatsu)');
select pg_temp.check((select count(*) = 1 from public.vehicle_models where lower(name) = 'avanza' and make_id = (select id from public.vehicle_makes where lower(name) = 'toyota' limit 1)), 'kompat: model memakai master yang sudah ada tanpa duplikat');
select public.save_item_compatibilities(pg_temp.id('i_busi'), '[{"make": "Honda", "model": "Jazz", "year_from": 2015}]');
select pg_temp.check((select count(*) = 1 from public.item_compatibilities where item_id = pg_temp.id('i_busi')), 'kompat: simpan ulang mengganti seluruh daftar');
select public.save_item_compatibilities(pg_temp.id('i_busi'), '[]');
select pg_temp.check((select count(*) = 0 from public.item_compatibilities where item_id = pg_temp.id('i_busi')), 'kompat: daftar kosong menghapus semua');

select pg_temp.fails(format($q$ select public.save_item_compatibilities('%s', '[{"make": "Honda", "model": ""}]') $q$, pg_temp.id('i_busi')), 'wajib diisi', 'kompat: model kosong ditolak');
select pg_temp.fails(format($q$ select public.save_item_compatibilities('%s', '[{"make": "Honda", "model": "Jazz", "year_from": 2020, "year_to": 2015}]') $q$, pg_temp.id('i_busi')), 'Tahun akhir', 'kompat: tahun terbalik ditolak');
select pg_temp.fails(format($q$ select public.save_item_compatibilities('%s', '[{"make": "Honda", "model": "Jazz", "year_from": 1900}]') $q$, pg_temp.id('i_busi')), 'Tahun harus', 'kompat: tahun di luar rentang ditolak');
select pg_temp.check(exists (select 1 from public.audit_logs where table_name = 'item_compatibilities' and actor_employee_id = pg_temp.id('e_owner')), 'kompat: perubahan tercatat di audit log');

reset role;
rollback;
\o
\echo SEMUA TES KOMPATIBILITAS LULUS
