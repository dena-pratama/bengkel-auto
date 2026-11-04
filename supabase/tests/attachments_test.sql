-- Tes lampiran (migration 20261103000029). Berjalan dalam satu transaksi dan di-ROLLBACK.
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
insert into t_ids select 'i_foto', public.save_item(null, jsonb_build_object('name', 'Barang Foto Uji', 'base_unit_id', (select id from public.units where code = 'pcs'), 'sell_price', 10000), '[]', '[]');
reset role;
insert into t_ids select 'branch', id from public.branches where code = 'PST';
select pg_temp.login('u_owner');

select public.register_attachment('item', pg_temp.id('i_foto'),
  format('%s/item/%s/%s.jpg', pg_temp.id('branch'), pg_temp.id('i_foto'), gen_random_uuid()), 'depan.jpg', 'image/jpeg', 120000);
select pg_temp.check((select count(*) = 1 from public.attachments where entity_id = pg_temp.id('i_foto') and removed_at is null), 'lampiran tercatat dan terbaca pemilik');
select pg_temp.fails(format($q$ select public.register_attachment('item', '%s', 'cabang-lain/item/x/y.jpg', 'x.jpg', 'image/jpeg', 100) $q$, pg_temp.id('i_foto')), 'tidak valid', 'lokasi berkas di luar folder dokumen ditolak');
select pg_temp.fails(format($q$ select public.register_attachment('item', '%s', '%s/item/%s/a.gif', 'a.gif', 'image/gif', 100) $q$, pg_temp.id('i_foto'), pg_temp.id('branch'), pg_temp.id('i_foto')), 'check', 'tipe berkas tidak didukung ditolak');
select pg_temp.fails(format($q$ select public.register_attachment('item', '%s', '%s/item/%s/a.jpg', 'a.jpg', 'image/jpeg', 9999999) $q$, pg_temp.id('i_foto'), pg_temp.id('branch'), pg_temp.id('i_foto')), 'check', 'berkas di atas 5 MB ditolak');
select pg_temp.fails(format($q$ select public.register_attachment('item', gen_random_uuid(), '%s/item/x/a.jpg', 'a.jpg', 'image/jpeg', 100) $q$, pg_temp.id('branch')), 'tidak ditemukan', 'dokumen induk harus ada');
select pg_temp.fails(format($q$ select public.register_attachment('sales', '%s', 'x', 'a.jpg', 'image/jpeg', 100) $q$, pg_temp.id('i_foto')), 'tidak punya izin', 'jenis dokumen tidak dikenal ditolak');

-- batas 10 lampiran
do $$
declare i integer;
begin
  for i in 1..9 loop
    perform public.register_attachment('item', (select v from t_ids where k = 'i_foto'),
      format('%s/item/%s/%s.png', (select v from t_ids where k = 'branch'), (select v from t_ids where k = 'i_foto'), gen_random_uuid()), 'f' || i || '.png', 'image/png', 1000);
  end loop;
end $$;
select pg_temp.fails(format($q$ select public.register_attachment('item', '%s', '%s/item/%s/z.png', 'z.png', 'image/png', 1000) $q$, pg_temp.id('i_foto'), pg_temp.id('branch'), pg_temp.id('i_foto')), 'Maksimal 10', 'lampiran ke-11 ditolak');

-- peran tanpa izin
select pg_temp.login('u_admin');
select pg_temp.check((select count(*) = 10 from public.attachments where entity_id = pg_temp.id('i_foto')), 'admin (izin master data) bisa melihat lampiran barang');

-- lepas lampiran: ditandai, tidak dihapus
select pg_temp.login('u_owner');
select public.remove_attachment((select id from public.attachments where entity_id = pg_temp.id('i_foto') limit 1));
select pg_temp.check((select count(*) = 9 from public.attachments where entity_id = pg_temp.id('i_foto')), 'lampiran dilepas tidak terbaca lagi');
reset role;
select pg_temp.check((select count(*) = 10 from public.attachments where entity_id = pg_temp.id('i_foto')), 'baris lampiran tetap ada (ditandai removed_at)');
select pg_temp.fails($q$ delete from public.attachments $q$, 'append-only', 'lampiran tidak bisa dihapus permanen');
select pg_temp.check(exists (select 1 from storage.buckets where id = 'attachments' and not public and file_size_limit = 5242880), 'bucket attachments privat dengan batas 5 MB');

rollback;
\o
\echo SEMUA TES LAMPIRAN LULUS
