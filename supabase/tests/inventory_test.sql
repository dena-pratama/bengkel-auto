-- Tes master data & ledger stok (migration 20261103000006-07).
-- Berjalan dalam satu transaksi dan di-ROLLBACK, jadi tidak meninggalkan data.

\set QUIET on
\o /dev/null
begin;

create temporary table t_ids (k text primary key, v uuid);
grant select, insert on t_ids to authenticated;
insert into t_ids values ('u_owner', gen_random_uuid()), ('u_admin', gen_random_uuid()),
  ('u_wh', gen_random_uuid()), ('u_cashier', gen_random_uuid());

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
                                 ('u_wh', 'warehouse', 'T-GDG'), ('u_cashier', 'cashier', 'T-KSR')) x(k, role_code, code) loop
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
create or replace function pg_temp.unit(p_code text) returns uuid language sql as $$
  select id from public.units where code = p_code $$;
create or replace function pg_temp.qty(p_item text, p_loc text) returns numeric language sql as $$
  select coalesce((select qty from public.stock_balances where item_id = pg_temp.id(p_item) and location_id = pg_temp.id(p_loc)), 0) $$;

-- ---------------------------------------------------------------------------
-- Master kecil
-- ---------------------------------------------------------------------------
select pg_temp.login('u_owner');
insert into t_ids select 'c_mesin', public.save_item_category(null, 'Mesin');
insert into t_ids select 'c_filter', public.save_item_category(null, 'Filter', pg_temp.id('c_mesin'));
select pg_temp.fails($q$ select public.save_item_category(null, 'Filter Oli', pg_temp.id('c_filter')) $q$,
  'dua tingkat', 'kategori: maksimal dua tingkat');
select pg_temp.fails($q$ select public.save_item_category(null, 'mesin') $q$, 'sudah dipakai', 'kategori: nama unik (tanpa beda huruf besar)');
insert into t_ids select 'b_toyota', public.save_brand(null, 'Toyota Genuine');
select pg_temp.fails($q$ select public.save_unit(null, 'Pcs Besar', 'x') $q$, 'Kode satuan', 'satuan: kode tidak valid ditolak');

insert into t_ids select 'l_area', id from public.locations where code = 'GDG';
insert into t_ids select 'l_rak', public.save_location(null, pg_temp.id('l_area'), 'rack', 'a', 'Rak A');
insert into t_ids select 'l_bin1', public.save_location(null, pg_temp.id('l_rak'), 'bin', 'a-01', 'A-01');
insert into t_ids select 'l_bin2', public.save_location(null, pg_temp.id('l_rak'), 'bin', 'A-02', 'A-02');
select pg_temp.check((select code = 'A-01' from public.locations where id = pg_temp.id('l_bin1')), 'lokasi: kode dinormalisasi huruf besar');
select pg_temp.fails($q$ select public.save_location(null, null, 'bin', 'X-1', 'Bin lepas') $q$,
  'Area > Rak', 'lokasi: bin harus di bawah rak');

-- ---------------------------------------------------------------------------
-- Barang
-- ---------------------------------------------------------------------------
insert into t_ids select 'i_filter', public.save_item(null,
  jsonb_build_object('name', 'Filter Oli Avanza', 'category_id', pg_temp.id('c_filter'), 'brand_id', pg_temp.id('b_toyota'),
                     'base_unit_id', pg_temp.unit('pcs'), 'sell_price', 45000, 'min_stock', 25,
                     'default_location_id', pg_temp.id('l_bin1'), 'warranty_days', 30),
  jsonb_build_array(jsonb_build_object('unit_id', pg_temp.unit('box'), 'factor', 12, 'is_purchase', true)),
  jsonb_build_array(jsonb_build_object('part_number', ' 90915-yzzd4 ', 'is_oem', true), jsonb_build_object('part_number', 'FO-1234')));

select pg_temp.check((select sku ~ '^BRG-[0-9]{5}$' from public.items where id = pg_temp.id('i_filter')), 'barang: SKU otomatis BRG-00001');
select pg_temp.check((select factor = 12 from public.item_units where item_id = pg_temp.id('i_filter')), 'barang: konversi 1 box = 12 pcs');
select pg_temp.check((select count(*) = 2 and bool_or(part_number = '90915-YZZD4' and is_oem)
                      from public.item_part_numbers where item_id = pg_temp.id('i_filter')), 'barang: part number OEM & alternatif');
select pg_temp.check((select count(*) = 1 from public.price_history where entity_id = pg_temp.id('i_filter')), 'barang: harga awal masuk riwayat');
select pg_temp.check((select count(*) = 1 from public.item_costs where item_id = pg_temp.id('i_filter')), 'barang: baris HPP dibuat otomatis');
select pg_temp.fails($q$ select public.save_item(null, jsonb_build_object('name', 'Salah', 'base_unit_id', pg_temp.unit('pcs')),
    jsonb_build_array(jsonb_build_object('unit_id', pg_temp.unit('pcs'), 'factor', 1))) $q$,
  'Satuan dasar tidak perlu', 'barang: satuan dasar tidak boleh di konversi');

-- Gudang: boleh buat barang, tidak boleh pasang harga
reset role;
select pg_temp.login('u_wh');
select pg_temp.fails($q$ select public.save_item(null, jsonb_build_object('name', 'Busi', 'base_unit_id', pg_temp.unit('pcs'), 'sell_price', 30000)) $q$,
  'mengubah harga jual', 'gudang: tidak bisa memasang harga jual');
insert into t_ids select 'i_busi', public.save_item(null, jsonb_build_object('name', 'Busi Iridium', 'base_unit_id', pg_temp.unit('pcs')));
select pg_temp.check((select sell_price = 0 from public.items where id = pg_temp.id('i_busi')), 'gudang: buat barang tanpa harga');
-- Beri gudang izin ubah barang (tanpa izin harga) untuk menguji penjaga harga
reset role;
insert into public.role_permissions (branch_id, role_id, permission_id)
select r.branch_id, r.id, p.id from public.roles r, public.permissions p
where r.code = 'warehouse' and p.module = 'master_data' and p.action = 'update';
select pg_temp.login('u_wh');
select pg_temp.fails($q$ select public.save_item(pg_temp.id('i_filter'), jsonb_build_object('name', 'Filter Oli Avanza', 'base_unit_id', pg_temp.unit('pcs'), 'sell_price', 0)) $q$,
  'mengubah harga jual', 'gudang: tidak bisa mengosongkan harga barang yang ada');
select public.save_item(pg_temp.id('i_filter'), jsonb_build_object('name', 'Filter Oli Avanza', 'base_unit_id', pg_temp.unit('pcs'), 'sell_price', 45000, 'min_stock', 25));
select pg_temp.check((select sell_price = 45000 from public.items where id = pg_temp.id('i_filter')), 'gudang: ubah data lain dengan harga tetap boleh');

reset role;
select pg_temp.login('u_cashier');
select pg_temp.fails($q$ select public.save_brand(null, 'Merek Kasir') $q$, 'tidak punya izin', 'kasir: tidak bisa menambah master');
select pg_temp.check((select count(*) >= 2 from public.items), 'kasir: bisa melihat daftar barang');

-- Admin: boleh ubah harga → tercatat di riwayat
reset role;
select pg_temp.login('u_admin');
select public.save_item(pg_temp.id('i_busi'), jsonb_build_object('name', 'Busi Iridium', 'base_unit_id', pg_temp.unit('pcs'), 'sell_price', 85000));
-- (satu transaksi → created_at sama; cek isi baris, bukan urutan)
select pg_temp.check(exists (select 1 from public.price_history
                             where entity_id = pg_temp.id('i_busi') and old_price = 0 and new_price = 85000),
  'admin: ubah harga tercatat di riwayat');

-- ---------------------------------------------------------------------------
-- Stok & HPP rata-rata tertimbang
-- ---------------------------------------------------------------------------
select pg_temp.fails($q$ select public.post_opening_stock(pg_temp.id('i_filter'), pg_temp.id('l_bin1'), 10, 10000) $q$,
  'Hanya Owner', 'admin: tidak bisa mengisi saldo awal');

reset role;
select pg_temp.login('u_owner');
select public.post_opening_stock(pg_temp.id('i_filter'), pg_temp.id('l_bin1'), 10, 10000);
select public.post_opening_stock(pg_temp.id('i_filter'), pg_temp.id('l_bin1'), 10, 13000);
select pg_temp.check(pg_temp.qty('i_filter', 'l_bin1') = 20, 'stok: saldo awal 10 + 10 = 20');
select pg_temp.check((select avg_cost = 11500 from public.item_costs where item_id = pg_temp.id('i_filter')),
  'HPP: rata-rata tertimbang (10×10.000 + 10×13.000) / 20 = 11.500');

select public.transfer_stock(pg_temp.id('i_filter'), pg_temp.id('l_bin1'), pg_temp.id('l_bin2'), 4, 'Rak penuh');
select pg_temp.check(pg_temp.qty('i_filter', 'l_bin1') = 16 and pg_temp.qty('i_filter', 'l_bin2') = 4, 'pindah: 16 di A-01, 4 di A-02');
select pg_temp.check((select qty = 20 from public.v_stock_on_hand where item_id = pg_temp.id('i_filter')), 'pindah: total stok tetap 20');
select pg_temp.check((select count(*) = 2 and count(distinct transfer_group_id) = 1 and sum(qty) = 0
                      from public.stock_movements where item_id = pg_temp.id('i_filter') and movement_type in ('transfer_out', 'transfer_in')),
  'pindah: mutasi keluar + masuk berpasangan');
select pg_temp.check((select avg_cost = 11500 from public.item_costs where item_id = pg_temp.id('i_filter')), 'pindah: HPP tidak berubah');
select pg_temp.fails($q$ select public.transfer_stock(pg_temp.id('i_filter'), pg_temp.id('l_bin2'), pg_temp.id('l_bin1'), 5) $q$,
  'Stok tidak cukup', 'pindah: melebihi stok lokasi ditolak');
select pg_temp.check((select exists (select 1 from public.v_low_stock where item_id = pg_temp.id('i_filter'))),
  'stok minimum: 20 ≤ 25 muncul di peringatan');

-- Keluar (dipakai modul penjualan nanti): HPP keluar = rata-rata; tidak boleh minus
reset role;
select app.post_stock_movement(pg_temp.id('i_filter'), pg_temp.id('l_bin1'), 'sale', -6, null, 'test', null);
select pg_temp.check((select unit_cost = 11500 from public.stock_movements where item_id = pg_temp.id('i_filter') and movement_type = 'sale'),
  'keluar: dinilai dengan HPP rata-rata');
select pg_temp.fails($q$ select app.post_stock_movement(pg_temp.id('i_filter'), pg_temp.id('l_bin1'), 'sale', -11) $q$,
  'Stok tidak cukup', 'keluar: stok minus ditolak');
select pg_temp.fails($q$ select app.post_stock_movement(pg_temp.id('i_filter'), pg_temp.id('l_bin1'), 'sale', 3) $q$,
  'Arah jumlah', 'keluar: arah jumlah salah ditolak');
update public.settings set value = 'true' where key = 'allow_negative_stock';
select app.post_stock_movement(pg_temp.id('i_filter'), pg_temp.id('l_bin1'), 'sale', -12, null, 'test', null);
select pg_temp.check(pg_temp.qty('i_filter', 'l_bin1') = -2, 'jual dulu terima menyusul: stok boleh minus jika diizinkan Owner');
update public.settings set value = 'false' where key = 'allow_negative_stock';

select pg_temp.fails($q$ update public.stock_movements set qty = 1 where item_id = pg_temp.id('i_filter') $q$,
  'append-only', 'ledger: mutasi tidak bisa diubah');
select pg_temp.fails($q$ delete from public.stock_movements where item_id = pg_temp.id('i_filter') $q$,
  'append-only', 'ledger: mutasi tidak bisa dihapus');

select pg_temp.login('u_owner');
select pg_temp.fails($q$ select public.save_item(pg_temp.id('i_filter'), jsonb_build_object('name', 'Filter Oli Avanza', 'base_unit_id', pg_temp.unit('set'), 'sell_price', 45000)) $q$,
  'Satuan dasar tidak bisa diganti', 'barang: satuan dasar terkunci setelah ada mutasi');
select pg_temp.check((select count(*) = 1 from public.item_costs where item_id = pg_temp.id('i_filter') and avg_cost > 0),
  'owner: bisa melihat HPP');

-- HPP rahasia untuk non-Owner
reset role;
select pg_temp.login('u_cashier');
select pg_temp.check((select count(*) = 0 from public.item_costs), 'kasir: HPP tidak terlihat');
do $$ begin
  perform unit_cost from public.stock_movements;
  raise exception 'GAGAL: kasir bisa membaca unit_cost';
exception when insufficient_privilege then raise notice 'OK   kasir: kolom nilai mutasi (unit_cost) tidak bisa dibaca';
end $$;
select pg_temp.check((select count(*) > 0 from public.stock_movements), 'kasir: tetap bisa melihat jumlah mutasi');
do $$ begin
  insert into public.stock_balances (branch_id, item_id, location_id, qty)
  select branch_id, item_id, location_id, 999 from public.stock_balances limit 1;
  raise exception 'GAGAL: kasir bisa menulis saldo stok';
exception when insufficient_privilege then raise notice 'OK   kasir: tidak bisa menulis saldo stok langsung';
end $$;

-- ---------------------------------------------------------------------------
-- Jasa & paket
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('u_owner');
insert into t_ids select 's_ganti_oli', public.save_service(null, jsonb_build_object(
  'name', 'Jasa Ganti Oli', 'category_id', (select id from public.service_categories where name = 'Servis berkala'),
  'price', 50000, 'duration_minutes', 30, 'commission_type', 'percent', 'commission_value', 10));
select pg_temp.check((select code ~ '^JS-[0-9]{3}$' from public.services where id = pg_temp.id('s_ganti_oli')), 'jasa: kode otomatis JS-001');

insert into t_ids select 'i_oli', public.save_item(null, jsonb_build_object('name', 'Oli Mesin 10W-40', 'base_unit_id', pg_temp.unit('liter'), 'sell_price', 75000));
-- Harga normal: 4 × 75.000 + 45.000 + 50.000 = 395.000; paket 350.000
insert into t_ids select 'p_oli', public.save_package(null, jsonb_build_object('name', 'Paket Ganti Oli', 'price', 350000),
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('i_oli'), 'qty', 4),
                    jsonb_build_object('item_id', pg_temp.id('i_filter'), 'qty', 1),
                    jsonb_build_object('service_id', pg_temp.id('s_ganti_oli'), 'qty', 1)));
select pg_temp.check((select sum(allocated_price) = 350000 and count(*) = 3 from public.package_components(pg_temp.id('p_oli'))),
  'paket: alokasi harga totalnya = harga paket');
select pg_temp.check((select allocated_price = 265822.78 from public.package_components(pg_temp.id('p_oli')) where item_id = pg_temp.id('i_oli')),
  'paket: alokasi proporsional (oli 300.000/395.000 × 350.000 + sisa pembulatan)');

select public.set_master_active('items', pg_temp.id('i_busi'), false);
select pg_temp.fails($q$ select public.save_package(null, jsonb_build_object('name', 'Paket Busi', 'price', 1),
    jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('i_busi'), 'qty', 4))) $q$,
  'Komponen paket tidak valid', 'paket: barang nonaktif tidak bisa jadi komponen');
select pg_temp.fails($q$ select public.set_master_active('employees', pg_temp.id('i_busi'), false) $q$,
  'Tabel tidak dikenal', 'nonaktif: hanya tabel master yang diizinkan');

reset role;
rollback;
\o
\echo SEMUA TES INVENTORY LULUS
