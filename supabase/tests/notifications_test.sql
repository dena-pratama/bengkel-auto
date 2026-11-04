-- Tes pusat notifikasi (migration 20261103000031): visibilitas dua lapis, status baca, tidak bisa diubah. ROLLBACK di akhir.
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

-- Notifikasi dari beberapa modul (ditulis seperti oleh pemicu)
reset role;
insert into t_ids select 'branch', id from public.branches where code = 'PST';
select app.notify('t_sales', 'sales', 'info', 'Invoice uji diposting', 'Rp 100.000', '/kasir', 'sale', gen_random_uuid(), pg_temp.id('branch'));
select app.notify('t_payroll', 'payroll', 'info', 'Gaji uji dibayar', 'rahasia gaji', '/penggajian', 'payroll_period', gen_random_uuid(), pg_temp.id('branch'));
select app.notify('t_general', null, 'warn', 'Pengumuman umum uji', null, null, null, null, pg_temp.id('branch'));

select pg_temp.login('u_owner');
select pg_temp.check((select count(*) = 3 from public.notifications where kind like 't\_%'), 'owner melihat semua notifikasi');

-- admin: izin notifications bawaan, tetapi tanpa izin modul gaji
select pg_temp.login('u_admin');
select pg_temp.check((select count(*) = 2 from public.notifications where kind like 't\_%'), 'admin melihat penjualan dan umum, bukan gaji');
select pg_temp.check(not exists (select 1 from public.notifications where kind = 't_payroll'), 'notifikasi gaji tersaring untuk peran tanpa akses gaji');

-- Owner menonaktifkan notifikasi untuk peran admin
reset role;
delete from public.role_permissions rp using public.permissions p, public.roles r
 where rp.permission_id = p.id and p.module = 'notifications' and p.action = 'view' and rp.role_id = r.id and r.code = 'admin';
select pg_temp.login('u_admin');
select pg_temp.check((select count(*) = 0 from public.notifications), 'peran tanpa izin notifications tidak melihat apa pun');
reset role;

-- status baca
select pg_temp.login('u_owner');
select pg_temp.check((public.my_notification_summary() ->> 'unread')::int >= 3, 'ringkasan: belum dibaca terhitung');
select public.mark_notifications_read();
select pg_temp.check((public.my_notification_summary() ->> 'unread')::int = 0, 'tandai dibaca: belum dibaca menjadi nol');
reset role;
select app.notify('t_after', 'sales', 'info', 'Setelah dibaca', null, null, null, null, pg_temp.id('branch'));
select pg_temp.login('u_owner');
select pg_temp.check((public.my_notification_summary() ->> 'unread')::int = 1, 'notifikasi baru setelah dibaca terhitung sebagai belum dibaca');

-- tidak bisa diubah atau dihapus
select pg_temp.fails($q$ delete from public.notifications $q$, 'permission denied', 'notifikasi tidak bisa dihapus dari aplikasi');
select pg_temp.fails($q$ update public.notifications set title = 'x' $q$, 'permission denied', 'notifikasi tidak bisa diubah dari aplikasi');
select pg_temp.fails($q$ select app.notify('x', null, 'info', 't', null, null, null, null, gen_random_uuid()) $q$, 'permission denied', 'aplikasi tidak bisa menulis notifikasi langsung');

reset role;
select pg_temp.check(exists (select 1 from public.permissions where module = 'notifications' and action = 'view'), 'izin notifications tersedia di matriks peran');
select pg_temp.check(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications'), 'notifikasi disiarkan lewat realtime');
rollback;
\o
\echo SEMUA TES NOTIFIKASI LULUS
