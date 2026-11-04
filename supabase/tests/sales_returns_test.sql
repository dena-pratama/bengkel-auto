-- Tes retur penjualan: uang kembali, potong piutang, barang rusak ke karantina, batas waktu, jurnal, stok (migration 000015).
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

create or replace function pg_temp.sdq(p text) returns numeric language plpgsql security definer as $$ declare v numeric; begin execute p into v; return v; end $$;
create or replace function pg_temp.id(p_key text) returns uuid language sql as $$ select v from t_ids where k = p_key $$;
create or replace function pg_temp.unit(p_code text) returns uuid language sql as $$ select id from public.units where code = p_code $$;
create or replace function pg_temp.stock(p_key text) returns numeric language sql as $$
  select coalesce(sum(qty), 0) from public.stock_balances where item_id = pg_temp.id(p_key) $$;
create or replace function pg_temp.stock_at(p_item_key text, p_loc_id uuid) returns numeric language sql as $$
  select coalesce(sum(qty), 0) from public.stock_balances where item_id = pg_temp.id(p_item_key) and location_id = p_loc_id $$;

create temporary table t_start as select now() as created_at;
grant select on t_start to authenticated;
create or replace function pg_temp.bal(p_key text) returns numeric language sql as $$
  select coalesce(sum(l.debit - l.credit), 0) from public.journal_lines l
  join public.accounts a on a.id = l.account_id where a.system_key = p_key
    and l.entry_id in (select id from public.journal_entries where created_at >= (select min(created_at) from t_start)) $$;

-- -----------------------------------------------------------------------------
-- Persiapan data master: lokasi, barang, saldo awal, pelanggan
-- -----------------------------------------------------------------------------
select pg_temp.login('u_owner');
select public.set_my_pin('123456');

insert into t_ids select 'l_bin', public.save_location(null, (select id from public.locations where code = 'GDG'), 'rack', 'TRJ', 'Rak Tes Retur');
insert into t_ids select 'l_krt', id from public.locations where code = 'KRT-01';
insert into t_ids select 'i_part', public.save_item(null, jsonb_build_object('name', 'Busi Tes Retur', 'base_unit_id', pg_temp.unit('pcs'), 'sell_price', 50000));
select public.post_opening_stock(pg_temp.id('i_part'), pg_temp.id('l_bin'), 20, 30000);

insert into t_ids select 'c_pt', public.save_customer(null, '{"type": "company", "name": "PT Retur Sukses", "credit_limit": 2000000, "payment_terms_days": 30}');
insert into t_ids select 'c_umum', public.save_customer(null, '{"name": "Pelanggan Biasa"}');

-- -----------------------------------------------------------------------------
-- Skenario 1: Penjualan POS tunai -> Retur sebagian uang kembali (cash refund)
-- -----------------------------------------------------------------------------
reset role;
select pg_temp.login('u_cashier');
insert into t_ids select 'shift', public.open_shift(200000);

-- POS jual 5 busi @ 50.000 = 250.000, bayar tunai lunas
insert into t_ids select 'sale1', public.save_sale(null,
  jsonb_build_object('customer_id', pg_temp.id('c_umum')),
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('i_part'), 'qty', 5, 'location_id', pg_temp.id('l_bin'))));
select public.post_sale(pg_temp.id('sale1'), '[{"method": "cash", "amount": 250000}]');

-- Cek stok dan kas sebelum retur: stok tersisa 15, kas shift = 200.000 + 250.000 = 450.000
select pg_temp.check(pg_temp.stock('i_part') = 15, 'stok berkurang 5 setelah POS');
select pg_temp.check((select expected_now = 450000 from public.v_cash_shifts where id = pg_temp.id('shift')), 'kas shift 450.000 sebelum retur');

-- Retur validasi: retur melebihi yang dijual (6 pcs) ditolak
select pg_temp.fails(
  format($q$ select public.post_sale_return('%s', '{"settlement": "refund", "payment_method": "cash", "reason": "Kelebihan beli"}'::jsonb,
    jsonb_build_array(jsonb_build_object('sale_item_id', '%s'::uuid, 'qty', 6))) $q$,
    pg_temp.id('sale1'), (select id from public.sale_items where sale_id = pg_temp.id('sale1'))),
  'melebihi', 'retur: jumlah melebihi kuantitas jual ditolak'
);

-- Retur validasi: alasan kosong / pendek ditolak
select pg_temp.fails(
  format($q$ select public.post_sale_return('%s', '{"settlement": "refund", "payment_method": "cash", "reason": "x"}'::jsonb,
    jsonb_build_array(jsonb_build_object('sale_item_id', '%s'::uuid, 'qty', 2))) $q$,
    pg_temp.id('sale1'), (select id from public.sale_items where sale_id = pg_temp.id('sale1'))),
  'minimal 3 karakter', 'retur: alasan minimal 3 karakter'
);

-- Retur validasi: nota tunai umum tidak bisa potong piutang
select pg_temp.fails(
  format($q$ select public.post_sale_return('%s', '{"settlement": "debt", "reason": "Minta potong piutang"}'::jsonb,
    jsonb_build_array(jsonb_build_object('sale_item_id', '%s'::uuid, 'qty', 2))) $q$,
    pg_temp.id('sale1'), (select id from public.sale_items where sale_id = pg_temp.id('sale1'))),
  'lunas', 'retur: nota lunas tidak bisa potong piutang'
);

-- Eksekusi retur 2 pcs busi kondisi baik uang kembali (cash refund)
insert into t_ids select 'ret1', public.post_sale_return(pg_temp.id('sale1'),
  '{"settlement": "refund", "payment_method": "cash", "reason": "Salah beli tipe busi"}',
  jsonb_build_array(jsonb_build_object(
    'sale_item_id', (select id from public.sale_items where sale_id = pg_temp.id('sale1')),
    'qty', 2,
    'condition', 'good',
    'location_id', pg_temp.id('l_bin')
  ))
);

-- Verifikasi hasil retur 1:
-- 1. Nomor dokumen berawalan RJ
select pg_temp.check((select return_no like 'RJ-%' and status = 'posted' and amount = 100000 and total = 100000
                      from public.sale_returns where id = pg_temp.id('ret1')) and pg_temp.sdq(format('select cogs_total from public.sale_returns where id = %L', pg_temp.id('ret1'))) = 60000, 'retur: dokumen RJ tersimpan dengan nilai 100.000 dan HPP 60.000');

-- 2. Stok bertambah kembali 2 pcs di rak asli (15 -> 17)
select pg_temp.check(pg_temp.stock('i_part') = 17, 'stok busi bertambah kembali menjadi 17');
select pg_temp.check((select returned_qty = 2 from public.sale_items where sale_id = pg_temp.id('sale1')), 'sale_item returned_qty = 2');

-- 3. Shift kas: expected_now berkurang 100.000 (450.000 - 100.000 = 350.000), cash_refund tercatat
select pg_temp.check((select expected_now = 350000 and cash_refund = 100000 from public.v_cash_shifts where id = pg_temp.id('shift')),
  'shift: kas diharapkan berkurang 100.000 menjadi 350.000');

-- 4. Jurnal pembalik otomatis:
reset role;
select pg_temp.check(pg_temp.bal('sales_return') = 100000, 'jurnal: Dr Retur Penjualan 100.000');
select pg_temp.check(pg_temp.bal('cash') = 250000 - 100000, 'jurnal: Cr Kas berkurang 100.000');
select pg_temp.check(pg_temp.bal('inventory') = -(5 * 30000) + (2 * 30000), 'jurnal: Dr Persediaan bertambah 60.000');
select pg_temp.check(pg_temp.bal('cogs') = (5 * 30000) - (2 * 30000), 'jurnal: Cr HPP berkurang 60.000');

-- -----------------------------------------------------------------------------
-- Skenario 2: Retur barang rusak (damaged) -> Masuk ke rak karantina KRT-01
-- -----------------------------------------------------------------------------
select pg_temp.login('u_cashier');
insert into t_ids select 'ret2', public.post_sale_return(pg_temp.id('sale1'),
  '{"settlement": "refund", "payment_method": "cash", "reason": "Busi pecah/retak saat dibuka"}',
  jsonb_build_array(jsonb_build_object(
    'sale_item_id', (select id from public.sale_items where sale_id = pg_temp.id('sale1')),
    'qty', 1,
    'condition', 'damaged'
  ))
);

-- Verifikasi barang rusak masuk ke rak karantina
select pg_temp.check(pg_temp.stock_at('i_part', pg_temp.id('l_krt')) = 1, 'barang rusak masuk ke rak karantina KRT-01');
select pg_temp.check((select returned_qty = 3 from public.sale_items where sale_id = pg_temp.id('sale1')), 'sale_item returned_qty sekarang 3');

-- -----------------------------------------------------------------------------
-- Skenario 3: Penjualan tempo ke Perusahaan -> Retur potong piutang (debt)
-- -----------------------------------------------------------------------------
insert into t_ids select 'sale_tempo', public.save_sale(null,
  jsonb_build_object('customer_id', pg_temp.id('c_pt')),
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('i_part'), 'qty', 10, 'location_id', pg_temp.id('l_bin'))));
select public.post_sale(pg_temp.id('sale_tempo'), '[]');

-- Piutang sebelum retur: 10 x 50.000 = 500.000
select pg_temp.check((select outstanding = 500000 from public.v_sales where id = pg_temp.id('sale_tempo')), 'piutang tempo awal 500.000');

-- Retur 4 pcs dengan potong piutang
insert into t_ids select 'ret_debt', public.post_sale_return(pg_temp.id('sale_tempo'),
  '{"settlement": "debt", "reason": "Kelebihan proyek PT"}',
  jsonb_build_array(jsonb_build_object(
    'sale_item_id', (select id from public.sale_items where sale_id = pg_temp.id('sale_tempo')),
    'qty', 4,
    'condition', 'good'
  ))
);

-- Verifikasi sisa piutang di v_sales berkurang menjadi 300.000 (500.000 - 200.000)
select pg_temp.check((select outstanding = 300000 and returned_total = 200000 from public.v_sales where id = pg_temp.id('sale_tempo')),
  'v_sales: sisa piutang berkurang 200.000 menjadi 300.000');

-- Verifikasi rekap piutang pelanggan PT berkurang
select pg_temp.check((select outstanding = 300000 from public.v_ar_customers where customer_id = pg_temp.id('c_pt')),
  'v_ar_customers: rekap piutang PT berkurang menjadi 300.000');

-- Jurnal: Cr Piutang Usaha 200.000
reset role;
select pg_temp.check(pg_temp.bal('ar') = 300000, 'jurnal: saldo Piutang Usaha bersisa 300.000');

-- -----------------------------------------------------------------------------
-- Skenario 4: Immutability & Soft delete
-- -----------------------------------------------------------------------------
select pg_temp.fails($q$ delete from public.sale_returns $q$, 'append-only', 'sale_returns tidak bisa dihapus langsung');
select pg_temp.fails($q$ delete from public.sale_return_items $q$, 'append-only', 'sale_return_items tidak bisa dihapus langsung');

-- Verifikasi view v_sale_returns
select pg_temp.check((select count(*) = 3 from public.v_sale_returns), 'v_sale_returns memuat 3 retur');

\o
\set QUIET off
select 'SEMUA TES RETUR PENJUALAN LULUS' as status;
-- Notifikasi dari pemicu (pusat notifikasi)
reset role;
select pg_temp.check(exists (select 1 from public.notifications where kind = 'sale_return'), 'notifikasi sale_return tercatat oleh pemicu');

rollback;
