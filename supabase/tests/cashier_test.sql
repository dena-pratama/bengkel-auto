-- Tes kasir: shift, POS, invoice WO, pembayaran, DP, piutang, PPN, komisi (migration 20261103000014).
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
create or replace function pg_temp.line(p_wo text, p_n int) returns uuid language sql as $$
  select id from public.work_order_items where work_order_id = pg_temp.id(p_wo) and sort_order = p_n $$;
create temporary table t_start as select now() as created_at;
grant select on t_start to authenticated;
-- Saldo akun sistem dari jurnal tes ini (debit - kredit), dibaca sebagai admin DB
create or replace function pg_temp.bal(p_key text) returns numeric language sql as $$
  select coalesce(sum(l.debit - l.credit), 0) from public.journal_lines l
  join public.accounts a on a.id = l.account_id where a.system_key = p_key
    and l.entry_id in (select id from public.journal_entries where created_at >= (select min(created_at) from t_start)) $$;

-- ---------------------------------------------------------------------------
-- Persiapan: oli 10 pcs @ 40.000 (jual 60.000), jasa 50.000 komisi 10%, WO siap diambil
-- ---------------------------------------------------------------------------
select pg_temp.login('u_owner');
select public.set_my_pin('123456');
insert into t_ids select 'l_bin', public.save_location(null, (select id from public.locations where code = 'GDG'), 'rack', 'TKS', 'Rak Tes Kasir');
insert into t_ids select 'i_oil', public.save_item(null, jsonb_build_object('name', 'Oli Tes Kasir', 'base_unit_id', pg_temp.unit('pcs'), 'sell_price', 60000));
select public.post_opening_stock(pg_temp.id('i_oil'), pg_temp.id('l_bin'), 10, 40000);
insert into t_ids select 's_oli', public.save_service(null, '{"name": "Jasa Oli Tes Kasir", "price": 50000, "duration_minutes": 30, "commission_value": 10}');
insert into t_ids select 'c_budi', public.save_customer(null, '{"name": "Budi Kasir"}');
insert into t_ids select 'c_pt', public.save_customer(null, '{"type": "company", "name": "PT Kredit Tes", "credit_limit": 1000000, "payment_terms_days": 30}');
insert into t_ids select 'v_avz', public.save_vehicle(null, '{"plate_no": "B 5511 KSR", "make": "Toyota", "model": "Avanza"}', pg_temp.id('c_budi'));
insert into t_ids select 'cash_acc', id from public.cash_bank_accounts where name = 'Kas Laci';
insert into t_ids select 'acc_exp', id from public.accounts where code = '6-1200';

reset role;
select pg_temp.login('u_admin');
insert into t_ids select 'est', public.save_estimate(null, jsonb_build_object('vehicle_id', pg_temp.id('v_avz')),
  jsonb_build_array(jsonb_build_object('type', 'service', 'service_id', pg_temp.id('s_oli')),
                    jsonb_build_object('type', 'part', 'item_id', pg_temp.id('i_oil'), 'qty', 2)));
insert into t_ids select 'wo', public.approve_estimate(pg_temp.id('est'), 'phone', null, '{}');
select public.set_work_order_mechanics(pg_temp.line('wo', 1), jsonb_build_array(jsonb_build_object('employee_id', pg_temp.id('e_mech'))));
select public.set_work_order_status(pg_temp.id('wo'), 'in_progress');
reset role;
select pg_temp.login('u_wh');
select public.issue_work_order_part(pg_temp.line('wo', 2), 2, pg_temp.id('l_bin'));
reset role;
select pg_temp.login('u_admin');
select public.set_work_order_status(pg_temp.id('wo'), 'quality_check');
select public.set_work_order_status(pg_temp.id('wo'), 'ready');

-- ---------------------------------------------------------------------------
-- Shift: wajib terbuka untuk menerima uang
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('u_cashier');
select pg_temp.fails($q$ select public.post_work_order_invoice(pg_temp.id('wo'), '[{"method": "cash", "amount": 170000}]') $q$,
  'Buka shift', 'kasir: tanpa shift tidak bisa menerima pembayaran');
select pg_temp.fails($q$ select public.record_deposit(pg_temp.id('wo'), '{"method": "cash", "amount": 50000}') $q$, 'Buka shift', 'kasir: DP juga butuh shift');
reset role;
select pg_temp.login('u_admin');
select pg_temp.fails($q$ select public.open_shift(100000) $q$, 'tidak punya izin', 'admin: tidak membuka shift (hanya menyetujui)');
reset role;
select pg_temp.login('u_cashier');
insert into t_ids select 'shift', public.open_shift(100000);
select pg_temp.check((select status = 'open' and shift_no like 'SH-%' and opening_cash = 100000 from public.cash_shifts where id = pg_temp.id('shift')), 'kasir: buka shift dengan modal awal');
select pg_temp.fails($q$ select public.open_shift(1) $q$, 'masih punya shift', 'kasir: tidak boleh dua shift terbuka');

-- ---------------------------------------------------------------------------
-- DP lalu invoice WO dengan pembayaran split
-- ---------------------------------------------------------------------------
select public.record_deposit(pg_temp.id('wo'), '{"method": "cash", "amount": 50000}');
reset role;
select pg_temp.check(pg_temp.bal('customer_deposit') = -50000, 'DP: jurnal Cr Uang Muka Pelanggan 50.000');
select pg_temp.login('u_cashier');
select pg_temp.check(public.preview_work_order_invoice(pg_temp.id('wo')) = 170000 and not exists (select 1 from public.sales where work_order_id = pg_temp.id('wo')), 'pratinjau invoice: total tepat dan tidak menyimpan apa pun');
select pg_temp.fails($q$ select public.post_work_order_invoice(pg_temp.id('wo'), '[{"method": "cash", "amount": 999999}]') $q$,
  'melebihi sisa tagihan', 'invoice: bayar melebihi tagihan ditolak');
insert into t_ids select 'inv', public.post_work_order_invoice(pg_temp.id('wo'),
  '[{"method": "cash", "amount": 100000}, {"method": "qris", "amount": 20000, "reference": "QR-1"}]');
select pg_temp.check((select sale_no like 'INV-%' and status = 'posted' and total = 170000 and paid = 170000 and outstanding = 0
                             and source = 'work_order' and plate_no = 'B 5511 KSR' and wo_no is not null
                      from public.v_sales where id = pg_temp.id('inv')), 'invoice WO: total 170.000 lunas (DP 50.000 + tunai + QRIS)');
select pg_temp.check((select count(*) = 3 and count(*) filter (where method = 'deposit') = 1 from public.payments where sale_id = pg_temp.id('inv')),
  'invoice WO: DP dipakai otomatis sebagai pembayaran');
reset role;
select pg_temp.check(pg_temp.bal('service_revenue') = -50000 and pg_temp.bal('parts_revenue') = -120000, 'jurnal: pendapatan jasa 50.000 dan sparepart 120.000');
select pg_temp.check(pg_temp.bal('cogs') = 80000 and pg_temp.bal('wip') = 0, 'jurnal: HPP 80.000 dari Persediaan dalam Pengerjaan (saldo WIP nol)');
select pg_temp.check(pg_temp.bal('ar') = 0 and pg_temp.bal('customer_deposit') = 0, 'jurnal: piutang dan uang muka lunas');
select pg_temp.check((select count(*) = 1 and bool_and(status = 'recognized') and bool_and(amount = 5000) and bool_and(base_amount = 50000)
                      from public.commissions where sale_id = pg_temp.id('inv')), 'komisi: 10% x 50.000 = 5.000 diakui karena invoice lunas');
select pg_temp.login('u_cashier');
select pg_temp.check((select expected_now = 250000 and cash_in = 150000 and qris_in = 20000 from public.v_cash_shifts where id = pg_temp.id('shift')),
  'shift: kas seharusnya 100.000 + DP 50.000 + tunai 100.000; QRIS terpisah');
select pg_temp.fails($q$ select public.post_work_order_invoice(pg_temp.id('wo'), '[]') $q$, 'sudah punya invoice', 'WO diinvoice tidak bisa diinvoice lagi');

reset role;
select pg_temp.login('u_admin');
select pg_temp.fails($q$ select public.add_work_order_work(pg_temp.id('wo'),
  jsonb_build_array(jsonb_build_object('type', 'service', 'service_id', pg_temp.id('s_oli')))) $q$, 'sudah diinvoice', 'WO diinvoice: terkunci dari perubahan');
select pg_temp.fails($q$ select public.set_work_order_status(pg_temp.id('wo'), 'quality_check') $q$, 'sudah diinvoice', 'WO diinvoice: status tidak bisa mundur');
select public.set_work_order_status(pg_temp.id('wo'), 'delivered');
select pg_temp.check((select status = 'delivered' from public.work_orders where id = pg_temp.id('wo')), 'WO diinvoice: bisa diserahkan');

-- Penyerahan tanpa invoice ditolak
reset role;
select pg_temp.login('u_admin');
insert into t_ids select 'est2', public.save_estimate(null, jsonb_build_object('vehicle_id', pg_temp.id('v_avz')),
  jsonb_build_array(jsonb_build_object('type', 'service', 'service_id', pg_temp.id('s_oli'))));
insert into t_ids select 'wo2', public.approve_estimate(pg_temp.id('est2'), 'chat', null, '{}');
select public.set_work_order_status(pg_temp.id('wo2'), 'in_progress');
select public.set_work_order_status(pg_temp.id('wo2'), 'quality_check');
select public.set_work_order_status(pg_temp.id('wo2'), 'ready');
select pg_temp.fails($q$ select public.set_work_order_status(pg_temp.id('wo2'), 'delivered') $q$, 'Buat invoice', 'serah kendaraan tanpa invoice ditolak');

-- Invoice tempo: pelanggan perorangan tanpa batas kredit butuh PIN
reset role;
select pg_temp.login('u_cashier');
select pg_temp.fails($q$ select public.post_work_order_invoice(pg_temp.id('wo2'), '[]') $q$, 'batas kredit', 'tempo: melebihi batas kredit butuh PIN');
select pg_temp.fails($q$ select public.post_work_order_invoice(pg_temp.id('wo2'), '[]', '000000') $q$, 'PIN persetujuan kredit salah', 'tempo: PIN salah ditolak');
insert into t_ids select 'inv2', public.post_work_order_invoice(pg_temp.id('wo2'), '[{"method": "cash", "amount": 20000}]', '123456');
select pg_temp.check((select outstanding = 30000 and credit_approved_by is not null from public.v_sales v join public.sales s on s.id = v.id where v.id = pg_temp.id('inv2')),
  'tempo: PIN Owner menyetujui, sisa 30.000 jadi piutang');
select pg_temp.check((select outstanding = 30000 from public.v_ar_customers where customer_id = pg_temp.id('c_budi')), 'piutang per pelanggan');
select public.pay_sale(pg_temp.id('inv2'), '[{"method": "transfer", "amount": 30000}]');
select pg_temp.check((select outstanding = 0 from public.v_sales where id = pg_temp.id('inv2')), 'pelunasan piutang lewat transfer');

-- ---------------------------------------------------------------------------
-- POS: draft, batas diskon, tempo perusahaan
-- ---------------------------------------------------------------------------
insert into t_ids select 'pos1', public.save_sale(null, '{}', jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('i_oil'), 'qty', 3)));
select pg_temp.check((select status = 'draft' and sale_no is null and subtotal = 180000 and total = 180000 from public.sales where id = pg_temp.id('pos1')),
  'POS: transaksi ditahan sebagai draft (harga dari master)');
select pg_temp.check(pg_temp.stock('i_oil') = 8, 'POS: draft belum mengurangi stok');
select public.post_sale(pg_temp.id('pos1'), '[{"method": "cash", "amount": 180000}]');
select pg_temp.check((select status = 'posted' and sale_no like 'INV-%' and paid = 180000 and outstanding = 0 from public.v_sales where id = pg_temp.id('pos1')), 'POS: posting + bayar tunai');
select pg_temp.check(pg_temp.stock('i_oil') = 5, 'POS: stok berkurang 3');
select pg_temp.check(pg_temp.sdq(format('select cogs_total from public.sales where id = %L', pg_temp.id('pos1'))) = 120000, 'POS: HPP rata-rata 3 x 40.000');
reset role;
select pg_temp.check(pg_temp.bal('inventory') = -80000 - 120000, 'jurnal POS: Persediaan berkurang 120.000 (di luar WO)');
select pg_temp.login('u_cashier');
select pg_temp.fails($q$ select public.post_sale(pg_temp.id('pos1'), '[]') $q$, 'sudah diposting', 'POS: tidak bisa diposting dua kali');

insert into t_ids select 'pos_disc', public.save_sale(null, '{}', jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('i_oil'), 'qty', 1, 'discount_amount', 12000)));
select pg_temp.fails($q$ select public.post_sale(pg_temp.id('pos_disc'), '[{"method": "cash", "amount": 48000}]') $q$, 'melebihi batas', 'diskon 20% melebihi batas Kasir 5%');
select public.post_sale(pg_temp.id('pos_disc'), '[{"method": "cash", "amount": 48000}]', '123456');
select pg_temp.check((select discount_approved_by is not null and total = 48000 from public.sales where id = pg_temp.id('pos_disc')), 'diskon di atas batas disetujui PIN Owner');
insert into t_ids select 'pos_ok', public.save_sale(null, '{}', jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('i_oil'), 'qty', 1, 'discount_amount', 3000)));
select public.post_sale(pg_temp.id('pos_ok'), '[{"method": "cash", "amount": 57000}]');
select pg_temp.check((select status = 'posted' from public.sales where id = pg_temp.id('pos_ok')), 'diskon 5% masih dalam batas Kasir');

insert into t_ids select 'pos_none', public.save_sale(null, '{}', jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('i_oil'), 'qty', 1)));
select pg_temp.fails($q$ select public.post_sale(pg_temp.id('pos_none'), '[]') $q$, 'butuh pelanggan terdaftar', 'tempo: pelanggan Umum tidak bisa berutang');
select public.save_sale(pg_temp.id('pos_none'), jsonb_build_object('customer_id', pg_temp.id('c_pt')), jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('i_oil'), 'qty', 1)));
select public.post_sale(pg_temp.id('pos_none'), '[]');
select pg_temp.check((select outstanding = 60000 and due_date = sale_date + 30 from public.v_sales where id = pg_temp.id('pos_none')), 'tempo perusahaan: dalam batas kredit, jatuh tempo +30 hari');
select pg_temp.check((select outstanding = 60000 and invoices = 1 from public.v_ar_customers where customer_id = pg_temp.id('c_pt')), 'piutang PT tampil di rekap');

-- Batal: pembayaran dulu, lalu invoice (butuh persetujuan)
select pg_temp.fails($q$ select public.void_sale(pg_temp.id('pos1'), 'salah input') $q$, 'butuh persetujuan', 'batal invoice: kasir butuh PIN persetujuan');
select pg_temp.fails($q$ select public.void_sale(pg_temp.id('pos1'), 'salah input', '123456') $q$, 'Batalkan dulu pembayaran', 'batal invoice: pembayaran harus dibatalkan dulu');
select public.void_payment((select id from public.payments where sale_id = pg_temp.id('pos1')), 'salah input');
select pg_temp.check((select outstanding = 180000 from public.v_sales where id = pg_temp.id('pos1')), 'batal pembayaran: tagihan kembali terutang');
select public.void_sale(pg_temp.id('pos1'), 'salah input', '123456');
select pg_temp.check((select status = 'void' from public.sales where id = pg_temp.id('pos1')) and pg_temp.stock('i_oil') = 5 + 3 - 1 - 1 - 1, 'batal invoice POS: stok kembali');
reset role;
select pg_temp.check(pg_temp.bal('ar') = 60000, 'jurnal: piutang tersisa hanya tagihan PT (batal membalik jurnal)');

-- Batal draft tanpa persetujuan
select pg_temp.login('u_cashier');
insert into t_ids select 'pos_draft', public.save_sale(null, '{}', jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('i_oil'), 'qty', 1)));
select public.void_sale(pg_temp.id('pos_draft'), 'pelanggan batal');
select pg_temp.check((select status = 'void' from public.sales where id = pg_temp.id('pos_draft')), 'batal draft: tanpa persetujuan');

-- ---------------------------------------------------------------------------
-- PPN (tarif bertanggal): eksklusif dan inklusif
-- ---------------------------------------------------------------------------
reset role;
update public.settings set value = 'true' where key = 'ppn_enabled';
select pg_temp.login('u_cashier');
insert into t_ids select 'ppn1', public.save_sale(null, '{}', jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('i_oil'), 'qty', 1)));
select public.post_sale(pg_temp.id('ppn1'), '[{"method": "transfer", "amount": 66600}]');
select pg_temp.check((select ppn_amount = 6600 and total = 66600 and parts_revenue = 60000 from public.sales where id = pg_temp.id('ppn1')),
  'PPN eksklusif: DPP 11/12 x 60.000 = 55.000, PPN 12% = 6.600, total 66.600');
reset role;
update public.settings set value = 'true' where key = 'prices_include_ppn';
select pg_temp.login('u_cashier');
insert into t_ids select 'ppn2', public.save_sale(null, '{}', jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('i_oil'), 'qty', 1)));
select public.post_sale(pg_temp.id('ppn2'), '[{"method": "cash", "amount": 60000}]');
select pg_temp.check((select ppn_amount = 5946 and total = 60000 and parts_revenue = 54054 and ppn_included from public.sales where id = pg_temp.id('ppn2')),
  'PPN inklusif: total tetap 60.000, PPN 5.946, pendapatan 54.054');
reset role;
select pg_temp.check(pg_temp.bal('ppn_out') = -(6600 + 5946), 'jurnal: PPN Keluaran 12.546');

-- ---------------------------------------------------------------------------
-- Kas keluar, tutup shift, persetujuan selisih
-- ---------------------------------------------------------------------------
select pg_temp.login('u_cashier');
select pg_temp.fails($q$ select public.add_cash_out(pg_temp.id('cash_acc'), 5000, 'bensin') $q$, 'akun beban', 'kas keluar harus ke akun beban');
select public.add_cash_out(pg_temp.id('acc_exp'), 20000, 'Beli bensin operasional');
select pg_temp.check((select cash_out = 20000 and expected_now = 415000 from public.v_cash_shifts where id = pg_temp.id('shift')),
  'kas keluar tercatat; kas seharusnya 100.000 + 335.000 tunai - 20.000 = 415.000');
select pg_temp.fails($q$ select public.close_shift(1000) $q$, 'catatan penyebab', 'tutup shift: selisih tanpa catatan ditolak');
select public.close_shift(0, '[{"value": 100000, "qty": 3}, {"value": 50000, "qty": 2}, {"value": 10000, "qty": 1}]', 'Kurang uang kembalian');
select pg_temp.check((select status = 'closed' and counted_cash = 410000 and expected_cash = 415000 and variance = -5000 from public.cash_shifts where id = pg_temp.id('shift')),
  'tutup shift: uang fisik dihitung per pecahan, selisih = fisik - seharusnya');
insert into t_ids select 'pos_late', public.save_sale(null, '{}', jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('i_oil'), 'qty', 1)));
select pg_temp.fails($q$ select public.post_sale(pg_temp.id('pos_late'), '[{"method": "cash", "amount": 60000}]') $q$, 'Buka shift', 'setelah shift ditutup tidak bisa menerima uang');
select pg_temp.fails($q$ select public.void_payment((select id from public.payments where sale_id = pg_temp.id('ppn2')), 'koreksi') $q$,
  'sudah ditutup', 'pembayaran di shift tertutup tidak bisa dibatalkan');
select pg_temp.fails($q$ select public.approve_shift(pg_temp.id('shift')) $q$, 'tidak punya izin', 'kasir tidak bisa menyetujui shift');

reset role;
select pg_temp.login('u_admin');
select public.approve_shift(pg_temp.id('shift'), 'Disetujui, kurang kembalian');
select pg_temp.check((select status = 'approved' and approved_by is not null from public.cash_shifts where id = pg_temp.id('shift')), 'admin menyetujui laporan shift');
reset role;
select pg_temp.check(pg_temp.bal('cash_variance') = -(select variance from public.cash_shifts where id = pg_temp.id('shift')),
  'selisih kas dijurnal ke Selisih Kas');

-- ---------------------------------------------------------------------------
-- Hak akses & data
-- ---------------------------------------------------------------------------
select pg_temp.login('u_mech');
select pg_temp.check((select count(*) = 0 from public.sales), 'mekanik: tidak melihat penjualan');
select pg_temp.check((select count(*) = 1 and bool_and(employee_id = pg_temp.id('e_mech')) from public.commissions), 'mekanik: hanya melihat komisinya sendiri');
reset role;
select pg_temp.login('u_wh');
select pg_temp.check((select count(*) = 0 from public.sales) and (select count(*) = 0 from public.commissions), 'gudang: tidak melihat penjualan & komisi');
select pg_temp.fails($q$ select public.open_shift(1) $q$, 'tidak punya izin', 'gudang: tidak bisa membuka shift');
reset role;
select pg_temp.fails($q$ delete from public.payments $q$, 'append-only', 'pembayaran tidak bisa dihapus');
select pg_temp.fails($q$ delete from public.sales $q$, 'append-only', 'penjualan tidak bisa dihapus');

reset role;
rollback;
\o
\echo SEMUA TES KASIR LULUS
