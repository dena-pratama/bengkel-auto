-- Tes pelanggan & kendaraan (migration 20261103000012).
-- Berjalan dalam satu transaksi dan di-ROLLBACK, jadi tidak meninggalkan data.

\set QUIET on
\o /dev/null
begin;

create temporary table t_ids (k text primary key, v uuid);
grant select, insert on t_ids to authenticated;
insert into t_ids values ('u_owner', gen_random_uuid()), ('u_admin', gen_random_uuid()),
  ('u_wh', gen_random_uuid()), ('u_cashier', gen_random_uuid()), ('u_mech', gen_random_uuid());

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', k || '@test.local', now(), now()
from t_ids;

do $$
declare
  b uuid := (select id from public.branches where code = 'PST');
  e uuid;
  r record;
begin
  for r in select * from (values ('u_owner', 'owner', 'T-OWN'), ('u_admin', 'admin', 'T-ADM'),
                                 ('u_wh', 'warehouse', 'T-GDG'), ('u_cashier', 'cashier', 'T-KSR'), ('u_mech', 'mechanic', 'T-MKN')) x(k, role_code, code) loop
    insert into public.employees (branch_id, code, full_name) values (b, r.code, 'Uji ' || r.role_code) returning id into e;
    insert into public.profiles (id, branch_id, employee_id, email)
      values ((select v from t_ids where k = r.k), b, e, r.k || '@test.local');
    insert into public.employee_roles (branch_id, employee_id, role_id)
      values (b, e, (select id from public.roles where code = r.role_code));
  end loop;
end $$;

create or replace function pg_temp.login(p_key text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select v from t_ids where k = p_key), 'role', 'authenticated')::text, true);
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
  if position(p_expect in sqlerrm) = 0 then
    raise exception 'GAGAL: %: pesan tak terduga: %', p_name, sqlerrm;
  end if;
  raise notice 'OK   %', p_name;
end $$;

create or replace function pg_temp.id(p_key text) returns uuid language sql as $$ select v from t_ids where k = p_key $$;
-- ---------------------------------------------------------------------------
-- Pelanggan
-- ---------------------------------------------------------------------------
select pg_temp.login('u_admin');
insert into t_ids select 'c_budi', public.save_customer(null, '{"name": "Budi Santoso", "phone": "+62 812-3456-7890", "credit_limit": 5000000}');
select pg_temp.check((select code ~ '^CUS-[0-9]{5}$' and phone = '081234567890' and credit_limit = 0 and type = 'individual'
                      from public.customers where id = pg_temp.id('c_budi')), 'pelanggan: kode otomatis, HP diseragamkan, perorangan tanpa kredit');
insert into t_ids select 'c_pt', public.save_customer(null, '{"type": "company", "name": "PT Armada Jaya", "credit_limit": 10000000, "payment_terms_days": 30}');
select pg_temp.check((select credit_limit = 10000000 and payment_terms_days = 30 from public.customers where id = pg_temp.id('c_pt')),
  'pelanggan perusahaan: batas kredit & termin');
select pg_temp.fails($q$ select public.save_customer(null, '{"name": "Ani", "phone": "12345"}') $q$, 'tidak valid', 'pelanggan: HP salah ditolak');

reset role;
select pg_temp.login('u_cashier');
insert into t_ids select 'c_kasir', public.save_customer(null, '{"name": "Pelanggan Kasir"}');
select pg_temp.check(pg_temp.id('c_kasir') is not null, 'kasir: boleh menambah pelanggan');
select pg_temp.fails($q$ select public.save_customer(pg_temp.id('c_budi'), '{"name": "Diubah Kasir"}') $q$, 'tidak punya izin', 'kasir: tidak boleh mengubah pelanggan');

reset role;
select pg_temp.login('u_wh');
select pg_temp.check((select count(*) = 0 from public.customers), 'gudang: tidak melihat data pelanggan');

-- ---------------------------------------------------------------------------
-- Kendaraan & kepemilikan
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('u_admin');
insert into t_ids select 'v_avz', public.save_vehicle(null,
  '{"plate_no": "b1234kjt", "make": "toyota", "model": "Avanza", "year": "2019", "transmission": "manual", "fuel": "gasoline", "last_odometer": "45000"}',
  pg_temp.id('c_budi'));
select pg_temp.check((select plate_no = 'B 1234 KJT' and make_name = 'Toyota' and model_name = 'Avanza' and customer_id = pg_temp.id('c_budi')
                      from public.v_vehicles where id = pg_temp.id('v_avz')), 'kendaraan: plat diseragamkan, merek/model dibuat, pemilik tercatat');
select pg_temp.fails($q$ select public.save_vehicle(null, '{"plate_no": "B 1234 KJT"}', pg_temp.id('c_pt')) $q$, 'sudah terdaftar', 'kendaraan: plat dobel ditolak');
select pg_temp.fails($q$ select public.save_vehicle(null, '{"plate_no": "B 9 X"}') $q$, 'Pilih pemilik', 'kendaraan: baru wajib punya pemilik');
select pg_temp.fails($q$ select public.save_vehicle(null, '{"plate_no": "1234 B"}', pg_temp.id('c_pt')) $q$, 'Nomor polisi tidak valid', 'kendaraan: format plat salah ditolak');

select public.save_vehicle(pg_temp.id('v_avz'), '{"plate_no": "B 1234 KJT", "make": "Toyota", "model": "Avanza", "last_odometer": "30000"}');
select pg_temp.check((select last_odometer = 45000 from public.vehicles where id = pg_temp.id('v_avz')), 'kendaraan: kilometer tidak bisa mundur');

select public.transfer_vehicle(pg_temp.id('v_avz'), pg_temp.id('c_pt'), null, 'Dijual ke perusahaan');
select pg_temp.check((select customer_id = pg_temp.id('c_pt') from public.v_vehicles where id = pg_temp.id('v_avz')), 'pindah pemilik: pemilik baru aktif');
select pg_temp.check((select count(*) = 2 and count(*) filter (where ended_at is not null) = 1
                      from public.vehicle_ownerships where vehicle_id = pg_temp.id('v_avz')), 'pindah pemilik: riwayat pemilik lama tersimpan');
select pg_temp.fails($q$ select public.transfer_vehicle(pg_temp.id('v_avz'), pg_temp.id('c_pt')) $q$, 'sudah menjadi pemilik', 'pindah pemilik: ke pemilik yang sama ditolak');

reset role;
select pg_temp.login('u_mech');
select pg_temp.check((select count(*) >= 1 from public.v_vehicles), 'mekanik: bisa melihat kendaraan');
select pg_temp.fails($q$ select public.save_customer(null, '{"name": "Mekanik"}') $q$, 'tidak punya izin', 'mekanik: tidak bisa menambah pelanggan');

reset role;
select pg_temp.fails($q$ delete from public.vehicle_ownerships where vehicle_id = pg_temp.id('v_avz') $q$, 'append-only', 'riwayat pemilik tidak bisa dihapus');

reset role;
rollback;
\o
\echo SEMUA TES PELANGGAN LULUS
