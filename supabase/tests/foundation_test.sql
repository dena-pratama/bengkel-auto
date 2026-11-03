-- Tes fondasi: RLS, izin per role, penomoran, audit log, status karyawan, PIN.
-- Berjalan dalam satu transaksi dan di-ROLLBACK, jadi tidak meninggalkan data.
-- Jalankan: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/foundation_test.sql

\set QUIET on
\o /dev/null
begin;

-- ---------------------------------------------------------------------------
-- Data uji: 3 akun (owner, kasir, mekanik)
-- ---------------------------------------------------------------------------
create temporary table t_ids (k text primary key, v uuid);
grant select on t_ids to authenticated, anon;
insert into t_ids values
  ('u_owner', gen_random_uuid()), ('u_cashier', gen_random_uuid()), ('u_mech', gen_random_uuid());

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', k || '@test.local', now(), now()
from t_ids;

do $$
declare
  b uuid := (select id from public.branches where code = 'PST');
  e uuid;
  r record;
begin
  for r in select * from (values ('u_owner','owner','T-OWN'), ('u_cashier','cashier','T-KSR'), ('u_mech','mechanic','T-MKN')) x(k, role_code, code) loop
    insert into public.employees (branch_id, code, full_name) values (b, r.code, 'Uji ' || r.role_code) returning id into e;
    insert into public.profiles (id, branch_id, employee_id, email)
      values ((select v from t_ids where k = r.k), b, e, r.k || '@test.local');
    insert into public.employee_roles (branch_id, employee_id, role_id)
      values (b, e, (select id from public.roles where code = r.role_code));
    insert into t_ids values ('e_' || substr(r.k, 3), e);
  end loop;
end $$;

-- "Login" sebagai user tertentu
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

-- ---------------------------------------------------------------------------
-- Kasir
-- ---------------------------------------------------------------------------
select pg_temp.login('u_cashier');
select pg_temp.check(app.current_employee_id() = (select v from t_ids where k = 'e_cashier'), 'kasir: current_employee_id terisi');
select pg_temp.check(app.has_permission('sales', 'create'), 'kasir: boleh buat penjualan');
select pg_temp.check(app.has_permission('cash_shift', 'update'), 'kasir: boleh kelola kas shift');
select pg_temp.check(not app.has_permission('finance_reports', 'view'), 'kasir: TIDAK boleh lihat laporan keuangan');
select pg_temp.check(not app.has_permission('transaction_void', 'approve'), 'kasir: TIDAK boleh menyetujui batal transaksi');
select pg_temp.check((select count(*) from public.employees) = 1, 'kasir: hanya melihat data karyawan dirinya');
select pg_temp.check((select count(*) from public.audit_logs) = 0, 'kasir: tidak bisa membaca audit log');
select pg_temp.check((select count(*) from public.roles) = 5, 'kasir: bisa membaca daftar role (untuk menu)');

do $$ begin
  perform pin_hash from public.employees;
  raise exception 'GAGAL: kasir bisa membaca pin_hash';
exception when insufficient_privilege then raise notice 'OK   kasir: kolom pin_hash tidak bisa dibaca';
end $$;

do $$ begin
  update public.settings set value = 'true' where key = 'allow_negative_stock';
  if found then raise exception 'GAGAL: kasir bisa ubah setting'; end if;
  raise notice 'OK   kasir: tidak bisa mengubah setting';
end $$;

select pg_temp.check(app.next_document_number('DOC', date '2099-01-01') = 'DOC-9901-0001', 'penomoran: pertama -0001');
select pg_temp.check(app.next_document_number('DOC', date '2099-01-01') = 'DOC-9901-0002', 'penomoran: kedua -0002');
select pg_temp.check(app.next_document_number('WO', date '2026-12-15') = 'WO-2612-0001', 'penomoran: WO per periode bulan');

-- ---------------------------------------------------------------------------
-- Mekanik
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('u_mech');
select pg_temp.check(app.has_permission('service_board', 'update', 'own'), 'mekanik: update status WO miliknya');
select pg_temp.check(not app.has_permission('service_board', 'update'), 'mekanik: TIDAK update status WO orang lain');
select pg_temp.check(app.has_permission('commissions', 'view', 'own'), 'mekanik: lihat komisi sendiri');
select pg_temp.check(not app.has_permission('sales', 'view'), 'mekanik: TIDAK akses penjualan');

-- ---------------------------------------------------------------------------
-- Owner
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('u_owner');
select pg_temp.check(app.is_superuser(), 'owner: superuser');
select pg_temp.check(app.has_permission('finance_reports', 'view') and app.has_permission('tax_settings', 'update'), 'owner: akses keuangan & pajak');
select pg_temp.check((select count(*) from public.employees where code like 'T-%') = 3, 'owner: melihat semua karyawan');
select pg_temp.check((select count(*) from public.audit_logs where table_name = 'employees') >= 3, 'owner: membaca audit log');

select app.set_my_pin('123456');
update public.settings set value = '14' where key = 'sales_return_days';
select pg_temp.check(exists (select 1 from public.audit_logs where table_name = 'settings' and action = 'update'
                             and new_data ->> 'value' = '14' and actor_employee_id = app.current_employee_id()),
                     'audit: ubah setting tercatat dengan pelaku');
select pg_temp.check(not exists (select 1 from public.audit_logs where new_data ? 'pin_hash' or old_data ? 'pin_hash'),
                     'audit: pin_hash tidak pernah masuk audit log');

-- PIN persetujuan dipakai dari sesi kasir
reset role;
select pg_temp.login('u_cashier');
select pg_temp.check(app.verify_approval_pin('123456', 'discount_override') = (select v from t_ids where k = 'e_owner'), 'PIN: PIN owner benar menyetujui diskon');
select pg_temp.check(app.verify_approval_pin('000000', 'discount_override') is null, 'PIN: PIN salah ditolak');

-- Owner menonaktifkan kasir
reset role;
select pg_temp.login('u_owner');
update public.employees set status = 'inactive' where id = (select v from t_ids where k = 'e_cashier');
select pg_temp.check(exists (select 1 from public.employee_status_history
                             where employee_id = (select v from t_ids where k = 'e_cashier') and new_status = 'inactive'),
                     'status: riwayat perubahan tercatat');
reset role;
select pg_temp.check((select banned_until from auth.users where id = (select v from t_ids where k = 'u_cashier')) = 'infinity',
                     'status: login akun Nonaktif diblokir (banned_until)');
select pg_temp.login('u_cashier');
select pg_temp.check(app.current_employee_id() is null, 'status: karyawan Nonaktif kehilangan akses data');
select pg_temp.check((select count(*) from public.branches) = 0, 'status: karyawan Nonaktif tidak melihat data apa pun');

-- ---------------------------------------------------------------------------
-- Integritas
-- ---------------------------------------------------------------------------
reset role;
do $$ begin
  update public.audit_logs set note = 'x';
  raise exception 'GAGAL: audit log bisa diubah';
exception when raise_exception then
  if sqlerrm like 'GAGAL%' then raise; end if;
  raise notice 'OK   integritas: audit log tidak bisa diubah (bahkan oleh superuser DB)';
end $$;

do $$ begin
  delete from public.employees where code = 'T-MKN';
  raise exception 'GAGAL: karyawan bisa dihapus permanen';
exception when raise_exception then
  if sqlerrm like 'GAGAL%' then raise; end if;
  raise notice 'OK   integritas: karyawan tidak bisa dihapus permanen';
end $$;

set local role anon;
do $$ begin
  perform 1 from public.branches;
  raise exception 'GAGAL: anon bisa membaca branches';
exception when insufficient_privilege then raise notice 'OK   anon: tidak punya akses ke tabel bisnis';
end $$;
reset role;

select pg_temp.check(not exists (
  select 1 from pg_tables where schemaname = 'public' and not rowsecurity
), 'RLS: aktif di semua tabel public');

rollback;
\o
\echo SEMUA TES LULUS
