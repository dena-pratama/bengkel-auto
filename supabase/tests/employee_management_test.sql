-- Tes pengelolaan karyawan & role (migration 20261103000005).
-- Berjalan dalam satu transaksi dan di-ROLLBACK, jadi tidak meninggalkan data.

\set QUIET on
\o /dev/null
begin;

-- ---------------------------------------------------------------------------
-- Data uji: owner, admin (izin karyawan = lihat), hr (role buatan: lihat/buat/ubah karyawan)
-- ---------------------------------------------------------------------------
create temporary table t_ids (k text primary key, v uuid);
grant select, insert on t_ids to authenticated;
insert into t_ids values ('u_owner', gen_random_uuid()), ('u_admin', gen_random_uuid()), ('u_hr', gen_random_uuid());

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', k || '@test.local', now(), now()
from t_ids;

do $$
declare
  b uuid := (select id from public.branches where code = 'PST');
  hr_role uuid;
  e uuid;
  r record;
begin
  insert into public.roles (branch_id, code, name) values (b, 't_hr', 'Uji HR') returning id into hr_role;
  insert into public.role_permissions (branch_id, role_id, permission_id)
  select b, hr_role, id from public.permissions where module = 'employees' and action in ('view', 'create', 'update');
  insert into t_ids values ('r_hr', hr_role);

  for r in select * from (values ('u_owner', 'owner', 'T-OWN'), ('u_admin', 'admin', 'T-ADM'), ('u_hr', 't_hr', 'T-HR')) x(k, role_code, code) loop
    insert into public.employees (branch_id, code, full_name) values (b, r.code, 'Uji ' || r.role_code) returning id into e;
    insert into public.profiles (id, branch_id, employee_id, email)
      values ((select v from t_ids where k = r.k), b, e, r.k || '@test.local');
    insert into public.employee_roles (branch_id, employee_id, role_id)
      values (b, e, (select id from public.roles where code = r.role_code));
    insert into t_ids values ('e_' || substr(r.k, 3), e);
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

-- Pernyataan harus gagal dengan pesan yang memuat p_expect
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
create or replace function pg_temp.role(p_code text) returns uuid language sql as $$
  select id from public.roles where code = p_code $$;

-- ---------------------------------------------------------------------------
-- Owner: buat & ubah karyawan
-- ---------------------------------------------------------------------------
select pg_temp.login('u_owner');

insert into t_ids select 'e_new', public.create_employee(
  '{"full_name": "  Budi Santoso ", "nik": "3171 0101 0101 0001", "phone": "0812-3456-7890", "position": "Mekanik", "hire_date": "2026-11-01"}',
  array[pg_temp.role('mechanic'), pg_temp.role('mechanic')]);

select pg_temp.check((select full_name = 'Budi Santoso' and nik = '3171010101010001' and phone = '081234567890'
                        and code like 'EMP-%' and status = 'active'
                      from public.employees where id = pg_temp.id('e_new')), 'owner: buat karyawan (data dinormalisasi, kode EMP otomatis)');
select pg_temp.check((select count(*) from public.employee_roles where employee_id = pg_temp.id('e_new')) = 1,
  'owner: role dobel disimpan sekali');
select pg_temp.check(exists (select 1 from public.employee_status_history where employee_id = pg_temp.id('e_new') and new_status = 'active'),
  'owner: riwayat status awal tercatat');
select pg_temp.check(exists (select 1 from public.audit_logs where table_name = 'employees' and record_id = pg_temp.id('e_new') and action = 'insert'),
  'owner: pembuatan karyawan masuk audit log');

select pg_temp.fails($q$ select public.create_employee('{"full_name": "Ani", "nik": "123"}', array[pg_temp.role('cashier')]) $q$,
  'NIK harus 16 digit', 'validasi: NIK salah ditolak');
select pg_temp.fails($q$ select public.create_employee('{"full_name": "Ani", "phone": "12345"}', array[pg_temp.role('cashier')]) $q$,
  'Nomor HP tidak valid', 'validasi: nomor HP salah ditolak');
select pg_temp.fails($q$ select public.create_employee('{"full_name": "Ani"}', '{}') $q$,
  'minimal satu role', 'validasi: tanpa role ditolak');

select public.update_employee(pg_temp.id('e_new'), '{"full_name": "Budi S.", "position": "Kepala Mekanik"}');
select pg_temp.check((select full_name = 'Budi S.' and position = 'Kepala Mekanik' and nik is null
                      from public.employees where id = pg_temp.id('e_new')), 'owner: ubah data karyawan');

select public.set_employee_roles(pg_temp.id('e_new'), array[pg_temp.role('mechanic'), pg_temp.role('warehouse')]);
select pg_temp.check((select count(*) from public.employee_roles where employee_id = pg_temp.id('e_new')) = 2,
  'owner: role ganda (mekanik + gudang)');

-- ---------------------------------------------------------------------------
-- Status
-- ---------------------------------------------------------------------------
select pg_temp.fails($q$ select public.set_employee_status(pg_temp.id('e_new'), 'inactive') $q$,
  'Alasan wajib', 'status: nonaktif tanpa alasan ditolak');
select pg_temp.fails($q$ select public.set_employee_status(pg_temp.id('e_owner'), 'on_leave', 'cuti') $q$,
  'akun sendiri', 'status: tidak bisa mengubah status diri sendiri');

select public.set_employee_status(pg_temp.id('e_new'), 'on_leave', 'Cuti tahunan');
select pg_temp.check((select reason = 'Cuti tahunan' from public.employee_status_history
                      where employee_id = pg_temp.id('e_new') and new_status = 'on_leave'), 'status: alasan tersimpan di riwayat');

-- ---------------------------------------------------------------------------
-- Akun login
-- ---------------------------------------------------------------------------
reset role;
insert into t_ids values ('u_fresh', gen_random_uuid()), ('u_old', gen_random_uuid());
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
  (pg_temp.id('u_fresh'), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'budi@test.local', now(), now()),
  (pg_temp.id('u_old'), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lama@test.local', now() - interval '1 hour', now());
select pg_temp.login('u_owner');

select pg_temp.fails($q$ select public.link_employee_account(pg_temp.id('e_new'), pg_temp.id('u_old')) $q$,
  'tidak valid', 'akun: akun auth lama tidak bisa ditautkan');
select pg_temp.fails($q$ select public.link_employee_account(pg_temp.id('e_new'), pg_temp.id('u_admin')) $q$,
  'tidak valid', 'akun: akun yang sudah terhubung tidak bisa ditautkan');
select public.link_employee_account(pg_temp.id('e_new'), pg_temp.id('u_fresh'));
select pg_temp.check((select email = 'budi@test.local' from public.profiles where employee_id = pg_temp.id('e_new')),
  'akun: akun baru tertaut ke karyawan');
select pg_temp.fails($q$ select public.link_employee_account(pg_temp.id('e_new'), pg_temp.id('u_fresh')) $q$,
  'sudah punya akun', 'akun: karyawan tidak bisa punya dua akun');
select pg_temp.check(public.employee_account_for_reset(pg_temp.id('e_new')) = pg_temp.id('u_fresh'),
  'akun: id akun untuk atur ulang password');

select public.set_employee_status(pg_temp.id('e_new'), 'inactive', 'Resign');
reset role;
select pg_temp.check((select banned_until = 'infinity' from auth.users where id = pg_temp.id('u_fresh')),
  'status: nonaktif memblokir login akun karyawan');
select pg_temp.login('u_owner');
select public.set_employee_status(pg_temp.id('e_new'), 'active', 'Kembali bekerja');
reset role;
select pg_temp.check((select banned_until is null from auth.users where id = pg_temp.id('u_fresh')),
  'status: aktif kembali membuka blokir login');

-- ---------------------------------------------------------------------------
-- Minimal satu Owner aktif
-- ---------------------------------------------------------------------------
-- Owner lain di database (mis. akun asli) dinonaktifkan sementara; tetap ter-rollback
update public.employees set status = 'inactive'
 where id <> pg_temp.id('e_owner') and id in (
   select er.employee_id from public.employee_roles er join public.roles r on r.id = er.role_id where r.is_superuser);
select pg_temp.login('u_owner');
select pg_temp.fails($q$ select public.set_employee_roles(pg_temp.id('e_owner'), array[pg_temp.role('admin')]) $q$,
  'Minimal harus ada satu Owner aktif', 'owner: tidak bisa melepas role Owner terakhir');

-- ---------------------------------------------------------------------------
-- Admin (izin karyawan hanya lihat)
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('u_admin');
select pg_temp.fails($q$ select public.create_employee('{"full_name": "Ani"}', array[pg_temp.role('cashier')]) $q$,
  'tidak punya izin', 'admin: tidak bisa menambah karyawan');
select pg_temp.fails($q$ select public.save_role(null, 'Role Admin', null, '[]') $q$,
  'tidak punya izin', 'admin: tidak bisa membuat role');

-- ---------------------------------------------------------------------------
-- HR (lihat/buat/ubah karyawan, bukan Owner): tanpa eskalasi hak
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('u_hr');
select pg_temp.fails($q$ select public.create_employee('{"full_name": "Calon Owner"}', array[pg_temp.role('owner')]) $q$,
  'Hanya Owner yang boleh memberikan role Owner', 'hr: tidak bisa memberi role Owner');
select pg_temp.fails($q$ select public.update_employee(pg_temp.id('e_owner'), '{"full_name": "Diubah"}') $q$,
  'Hanya Owner yang boleh mengubah data Owner', 'hr: tidak bisa mengubah data Owner');
select pg_temp.fails($q$ select public.set_employee_status(pg_temp.id('e_owner'), 'inactive', 'kudeta') $q$,
  'Hanya Owner', 'hr: tidak bisa menonaktifkan Owner');
select pg_temp.fails($q$ select public.save_role(null, 'Akses Laporan', null,
    (select jsonb_agg(jsonb_build_object('permission_id', id)) from public.permissions where module = 'finance_reports' and action = 'view')) $q$,
  'tidak Anda miliki', 'hr: tidak bisa membuat role dengan izin yang tidak ia punya');
insert into t_ids select 'r_viewer', public.save_role(null, 'Pengamat Karyawan', 'Hanya lihat',
  (select jsonb_agg(jsonb_build_object('permission_id', id)) from public.permissions where module = 'employees' and action = 'view'));
select pg_temp.check((select code = 'pengamat_karyawan' and not is_system from public.roles where id = pg_temp.id('r_viewer')),
  'hr: buat role dengan izin yang ia punya (kode otomatis)');
select pg_temp.fails($q$ select public.save_role(pg_temp.role('t_hr'), 'Uji HR', null,
    (select jsonb_agg(jsonb_build_object('permission_id', id)) from public.permissions where module = 'employees')) $q$,
  'tidak Anda miliki', 'hr: tidak bisa menambah izin ke role-nya sendiri melebihi yang ia punya');

-- ---------------------------------------------------------------------------
-- Owner: kelola role
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('u_owner');
select public.save_role(pg_temp.id('r_viewer'), 'Pengamat Karyawan', 'Lihat + komisi sendiri',
  (select jsonb_agg(jsonb_build_object('permission_id', id, 'scope', case when module = 'commissions' then 'own' else 'all' end))
   from public.permissions where (module = 'employees' and action = 'view') or (module = 'commissions' and action = 'view')));
select pg_temp.check((select count(*) = 2 and bool_or(rp.scope = 'own')
                      from public.role_permissions rp where rp.role_id = pg_temp.id('r_viewer')), 'owner: ubah matriks izin role (lingkup sendiri)');
select public.save_role(pg_temp.id('r_viewer'), 'Pengamat Karyawan', null, '[]');
select pg_temp.check(not exists (select 1 from public.role_permissions where role_id = pg_temp.id('r_viewer')),
  'owner: cabut semua izin role');
select pg_temp.fails($q$ select public.save_role(pg_temp.role('owner'), 'Owner', null, '[]') $q$,
  'Role Owner selalu punya semua izin', 'owner: role Owner tidak bisa diubah');
select pg_temp.fails($q$ select public.save_role(null, 'kasir', null, '[]') $q$,
  'sudah dipakai', 'owner: nama role tidak boleh dobel');
select pg_temp.fails($q$ select public.set_role_active(pg_temp.role('cashier'), false) $q$,
  'Role bawaan', 'owner: role bawaan tidak bisa dinonaktifkan');
select public.set_role_active(pg_temp.id('r_viewer'), false);
select pg_temp.check((select not is_active from public.roles where id = pg_temp.id('r_viewer')), 'owner: nonaktifkan role buatan');
select pg_temp.fails($q$ select public.set_employee_roles(pg_temp.id('e_new'), array[pg_temp.id('r_viewer')]) $q$,
  'nonaktif', 'owner: role nonaktif tidak bisa diberikan');

-- ---------------------------------------------------------------------------
-- PIN
-- ---------------------------------------------------------------------------
select pg_temp.check(not public.employee_has_pin(pg_temp.id('e_owner')), 'pin: belum diatur');
select public.set_my_pin('123456');
select pg_temp.check(public.employee_has_pin(pg_temp.id('e_owner')), 'pin: sudah diatur lewat API publik');

reset role;
rollback;
\o
\echo SEMUA TES PENGELOLAAN KARYAWAN LULUS
