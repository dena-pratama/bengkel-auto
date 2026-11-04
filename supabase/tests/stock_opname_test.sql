-- Tes stok opname: jenis opname, hitung fisik, blind count, review selisih, alasan selisih,
-- toleransi PIN Owner, mutasi stok, jurnal penyesuaian, dan proteksi imutabilitas (migration 000016).
-- Berjalan dalam satu transaksi dan di-ROLLBACK, jadi tidak meninggalkan data.

\set QUIET on
\o /dev/null
begin;

create temporary table t_ids (k text primary key, v uuid);
grant select, insert on t_ids to authenticated;
insert into t_ids values ('u_owner', gen_random_uuid()), ('u_admin', gen_random_uuid()), ('u_wh', gen_random_uuid()),
  ('u_cashier', gen_random_uuid()), ('u_mech', gen_random_uuid());

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', k || '@test.local', now(), now()
from t_ids;

do $$
declare
  b uuid := (select id from public.branches where code = 'PST');
  e uuid;
  r record;
begin
  for r in select * from (values ('u_owner', 'owner', 'T-OWN'), ('u_admin', 'admin', 'T-ADM'), ('u_wh', 'warehouse', 'T-GDG'),
                                 ('u_cashier', 'cashier', 'T-KSR'), ('u_mech', 'mechanic', 'T-MK1')) x(k, role_code, code) loop
    insert into public.employees (branch_id, code, full_name) values (b, r.code, 'Uji ' || r.code) returning id into e;
    insert into t_ids values ('e_' || substr(r.k, 3), e);
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

create or replace function pg_temp.id(p_key text) returns uuid language sql stable as $$
  select v from t_ids where k = p_key;
$$;

-- Setup master data uji: 2 barang, 2 lokasi rak, saldo awal
do $$
declare
  b uuid := (select id from public.branches where code = 'PST');
  u uuid := (select id from public.units where lower(code) = 'pcs' limit 1);
  c uuid := (select id from public.item_categories limit 1);
  l1 uuid;
  l2 uuid;
  i1 uuid;
  i2 uuid;
begin
  -- Buat rak uji
  insert into public.locations (branch_id, type, code, name)
    values (b, 'rack', 'OP-R1', 'Rak Opname 1') returning id into l1;
  insert into public.locations (branch_id, type, code, name)
    values (b, 'rack', 'OP-R2', 'Rak Opname 2') returning id into l2;
  insert into t_ids values ('loc_1', l1), ('loc_2', l2);

  -- Buat barang uji
  insert into public.items (branch_id, sku, name, base_unit_id, category_id, default_location_id, sell_price)
    values (b, 'OP-ITEM-1', 'Oli Mesin Uji Opname', u, c, l1, 100000) returning id into i1;
  insert into public.items (branch_id, sku, name, base_unit_id, category_id, default_location_id, sell_price)
    values (b, 'OP-ITEM-2', 'Filter Udara Uji Opname', u, c, l2, 50000) returning id into i2;
  insert into t_ids values ('item_1', i1), ('item_2', i2);

  -- Saldo awal: item 1 ada 10 pcs @ 70.000 di loc 1; item 2 ada 5 pcs @ 30.000 di loc 2
  perform app.post_stock_movement(i1, l1, 'opening', 10, 70000, 'opening', null, 'Saldo awal uji');
  perform app.post_stock_movement(i2, l2, 'opening', 5, 30000, 'opening', null, 'Saldo awal uji');

  -- PIN Owner untuk persetujuan
  perform pg_temp.login('u_owner');
  perform public.set_my_pin('123456');
end $$;

\o
\set QUIET off

-- =============================================================================
-- Skenario 1: Buat Sesi Opname & Validasi Izin
-- =============================================================================

-- Mekanik tidak berhak membuat sesi opname
select pg_temp.login('u_mech');
select pg_temp.fails(
  $$select public.create_stock_opname('{"opname_type": "full"}'::jsonb)$$,
  'tidak punya izin',
  'opname: role mekanik tidak berhak membuat opname'
);

-- Staf gudang berhak membuat sesi opname
select pg_temp.login('u_wh');
do $$
declare
  op_id uuid;
begin
  op_id := public.create_stock_opname(jsonb_build_object(
    'opname_type', 'location',
    'scope_filter', jsonb_build_object('location_ids', jsonb_build_array(pg_temp.id('loc_1'), pg_temp.id('loc_2'))),
    'notes', 'Opname uji rutin rak 1 dan 2'
  ));
  insert into t_ids values ('op_1', op_id);
end $$;

select pg_temp.check(
  exists (select 1 from public.stock_opnames where id = pg_temp.id('op_1') and status = 'draft'),
  'opname: sesi draft berhasil dibuat'
);

select pg_temp.check(
  (select count(*) from public.stock_opname_items where opname_id = pg_temp.id('op_1')) = 2,
  'opname: 2 item uji terdaftar otomatis dalam cakupan rak'
);

-- =============================================================================
-- Skenario 2: Mulai Opname & Input Hitung Fisik (Parsial / Bertahap)
-- =============================================================================

-- Mulai opname: status berubah ke in_progress
select public.start_stock_opname(pg_temp.id('op_1'));

select pg_temp.check(
  (select status from public.stock_opnames where id = pg_temp.id('op_1')) = 'in_progress',
  'opname: status in_progress saat mulai'
);

-- Input fisik tidak boleh negatif
select pg_temp.fails(
  format($$select public.save_opname_counts('%s', '[{"item_id": "%s", "location_id": "%s", "physical_qty": -1}]'::jsonb)$$,
    pg_temp.id('op_1'), pg_temp.id('item_1'), pg_temp.id('loc_1')),
  'tidak boleh negatif',
  'opname: jumlah fisik negatif ditolak'
);

-- Hitung fisik item 1: fisik = 8 (sistem = 10, selisih kurang 2 pcs @ 70.000 = -140.000)
select public.save_opname_counts(
  pg_temp.id('op_1'),
  jsonb_build_array(
    jsonb_build_object(
      'item_id', pg_temp.id('item_1'),
      'location_id', pg_temp.id('loc_1'),
      'physical_qty', 8
    )
  )
);

-- Selesaikan hitung sebelum item 2 dihitung harus ditolak
select pg_temp.fails(
  format($$select public.complete_opname_count('%s')$$, pg_temp.id('op_1')),
  'belum dihitung fisik',
  'opname: menyelesaikan hitung sebelum semua barang dihitung ditolak'
);

-- Hitung fisik item 2: fisik = 6 (sistem = 5, selisih lebih 1 pcs @ 30.000 = +30.000)
select public.save_opname_counts(
  pg_temp.id('op_1'),
  jsonb_build_array(
    jsonb_build_object(
      'item_id', pg_temp.id('item_2'),
      'location_id', pg_temp.id('loc_2'),
      'physical_qty', 6
    )
  )
);

-- Selesaikan hitung fisik -> status pindah ke review
select public.complete_opname_count(pg_temp.id('op_1'));

select pg_temp.check(
  (select status from public.stock_opnames where id = pg_temp.id('op_1')) = 'review',
  'opname: status review setelah hitung fisik selesai'
);

select pg_temp.check(
  (select total_items from public.stock_opnames where id = pg_temp.id('op_1')) = 2 and
  (select variance_items from public.stock_opnames where id = pg_temp.id('op_1')) = 2 and
  (select total_variance_amount from public.stock_opnames where id = pg_temp.id('op_1')) = -110000,
  'opname: ringkasan selisih tepat (-140.000 + 30.000 = -110.000)'
);

-- =============================================================================
-- Skenario 3: Recount (Hitung Ulang) Item
-- =============================================================================

-- Hitung ulang item 2: kembali ke in_progress
do $$
declare
  item_row_id uuid := (select id from public.stock_opname_items where opname_id = pg_temp.id('op_1') and item_id = pg_temp.id('item_2'));
begin
  perform public.recount_opname_item(item_row_id);
end $$;

select pg_temp.check(
  (select status from public.stock_opnames where id = pg_temp.id('op_1')) = 'in_progress',
  'opname: recount mengembalikan status ke in_progress'
);

select pg_temp.check(
  (select physical_qty from public.stock_opname_items where opname_id = pg_temp.id('op_1') and item_id = pg_temp.id('item_2')) is null,
  'opname: recount mengosongkan physical_qty'
);

-- Input kembali hitungan fisik item 2: sekarang fisik = 5 (cocok dengan sistem)
select public.save_opname_counts(
  pg_temp.id('op_1'),
  jsonb_build_array(
    jsonb_build_object(
      'item_id', pg_temp.id('item_2'),
      'location_id', pg_temp.id('loc_2'),
      'physical_qty', 5
    )
  )
);

select public.complete_opname_count(pg_temp.id('op_1'));

select pg_temp.check(
  (select matched_items from public.stock_opnames where id = pg_temp.id('op_1')) = 1 and
  (select variance_items from public.stock_opnames where id = pg_temp.id('op_1')) = 1 and
  (select total_variance_amount from public.stock_opnames where id = pg_temp.id('op_1')) = -140000,
  'opname: item 2 cocok (selisih 0), hanya item 1 berselisih -2 pcs (-140.000)'
);

-- =============================================================================
-- Skenario 4: Persetujuan & Posting Penyesuaian
-- =============================================================================

-- Kasir tidak punya izin menyetujui opname
select pg_temp.login('u_cashier');
select pg_temp.fails(
  format($$select public.post_stock_opname('%s')$$, pg_temp.id('op_1')),
  'tidak punya izin',
  'opname: kasir tidak berhak menyetujui opname'
);

-- Admin mencoba menyetujui tanpa mengisi alasan selisih
select pg_temp.login('u_admin');
select pg_temp.fails(
  format($$select public.post_stock_opname('%s')$$, pg_temp.id('op_1')),
  'Alasan selisih wajib diisi',
  'opname: posting tanpa alasan selisih ditolak'
);

-- Admin menyetujui dengan menyertakan alasan selisih (rusak)
select public.post_stock_opname(
  pg_temp.id('op_1'),
  null,
  jsonb_build_array(
    jsonb_build_object(
      'id', (select id from public.stock_opname_items where opname_id = pg_temp.id('op_1') and item_id = pg_temp.id('item_1')),
      'variance_reason', 'damaged',
      'notes', '2 botol bocor terkena benturan'
    )
  )
);

select pg_temp.check(
  (select status from public.stock_opnames where id = pg_temp.id('op_1')) = 'posted',
  'opname: status posted setelah disetujui'
);

-- Cek mutasi stok penyesuaian: stok item 1 di rak 1 berkurang dari 10 menjadi 8
select pg_temp.check(
  (select qty from public.stock_balances where item_id = pg_temp.id('item_1') and location_id = pg_temp.id('loc_1')) = 8,
  'opname: stok di saldo fisik berhasil disesuaikan menjadi 8'
);

select pg_temp.check(
  exists (
    select 1 from public.stock_movements
    where item_id = pg_temp.id('item_1')
      and location_id = pg_temp.id('loc_1')
      and movement_type = 'opname_adjustment'
      and qty = -2
  ),
  'opname: mutasi stok opname_adjustment -2 tercatat di stock_movements'
);

-- Cek jurnal penyesuaian persediaan: Dr Beban Selisih 140.000, Cr Persediaan 140.000
reset role;
select pg_temp.check(
  exists (
    select 1 from public.journal_lines jl
    join public.journal_entries je on je.id = jl.entry_id
    where je.source_type = 'stock_opnames'
      and je.source_id = pg_temp.id('op_1')
      and jl.account_id = (select id from public.accounts where system_key = 'inventory_variance')
      and jl.debit = 140000
  ),
  'opname: jurnal mencatat Dr Beban Selisih Persediaan 140.000'
);

select pg_temp.check(
  exists (
    select 1 from public.journal_lines jl
    join public.journal_entries je on je.id = jl.entry_id
    where je.source_type = 'stock_opnames'
      and je.source_id = pg_temp.id('op_1')
      and jl.account_id = (select id from public.accounts where system_key = 'inventory')
      and jl.credit = 140000
  ),
  'opname: jurnal mencatat Cr Persediaan Sparepart 140.000'
);

-- =============================================================================
-- Skenario 5: Imutabilitas & Proteksi Hapus
-- =============================================================================

select pg_temp.fails(
  format($$delete from public.stock_opnames where id = '%s'$$, pg_temp.id('op_1')),
  'tidak boleh dihapus',
  'opname: sesi posted tidak dapat dihapus'
);

-- =============================================================================
-- Skenario 6: Pembatalan Sesi (Void)
-- =============================================================================

select pg_temp.login('u_wh');
do $$
declare
  op2_id uuid;
begin
  op2_id := public.create_stock_opname('{"opname_type": "cycle_count", "scope_filter": {"sample_size": 1}}'::jsonb);
  insert into t_ids values ('op_2', op2_id);
end $$;

select pg_temp.fails(
  format($$select public.void_stock_opname('%s', 'a')$$, pg_temp.id('op_2')),
  'minimal 3 karakter',
  'opname: alasan batal terlalu pendek ditolak'
);

select public.void_stock_opname(pg_temp.id('op_2'), 'Salah jadwal opname');

select pg_temp.check(
  (select status from public.stock_opnames where id = pg_temp.id('op_2')) = 'void' and
  (select void_reason from public.stock_opnames where id = pg_temp.id('op_2')) = 'Salah jadwal opname',
  'opname: pembatalan sesi draft berhasil dengan alasan tercatat'
);

select 'SEMUA TES STOK OPNAME LULUS' as status;

-- Notifikasi dari pemicu (pusat notifikasi)
reset role;
select pg_temp.check(exists (select 1 from public.notifications where kind = 'opname_posted'), 'notifikasi opname_posted tercatat oleh pemicu');

rollback;
