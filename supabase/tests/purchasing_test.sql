-- Tes pembelian, hutang, & jurnal (migration 20261103000009–10).
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
    raise exception 'GAGAL: % — pesan tak terduga: %', p_name, sqlerrm;
  end if;
  raise notice 'OK   %', p_name;
end $$;

create or replace function pg_temp.id(p_key text) returns uuid language sql as $$ select v from t_ids where k = p_key $$;
create or replace function pg_temp.unit(p_code text) returns uuid language sql as $$ select id from public.units where code = p_code $$;
create or replace function pg_temp.outstanding(p_key text) returns numeric language sql as $$
  select outstanding from public.v_ap_receipts where receipt_id = pg_temp.id(p_key) $$;
-- HPP dibaca sebagai admin DB (pengguna gudang memang tidak boleh melihat HPP)
create or replace function pg_temp.avg(p_key text) returns numeric language sql security definer as $$
  select avg_cost from public.item_costs where item_id = pg_temp.id(p_key) $$;
create temporary table t_ids_start as select now() as created_at;
grant select on t_ids_start to authenticated;
-- Saldo akun sistem dari jurnal tes ini (debit − kredit)
create or replace function pg_temp.bal(p_key text) returns numeric language sql as $$
  select coalesce(sum(l.debit - l.credit), 0) from public.journal_lines l
  join public.accounts a on a.id = l.account_id where a.system_key = p_key
    and l.entry_id in (select id from public.journal_entries where created_at >= (select min(created_at) from t_ids_start)) $$;

-- ---------------------------------------------------------------------------
-- Persiapan master (owner)
-- ---------------------------------------------------------------------------
select pg_temp.login('u_owner');
insert into t_ids select 'l_bin', public.save_location(null, (select id from public.locations where code = 'GDG'), 'rack', 'TB', 'Rak Tes');
insert into t_ids select 'i_filter', public.save_item(null,
  jsonb_build_object('name', 'Filter Tes', 'base_unit_id', pg_temp.unit('pcs'), 'sell_price', 45000),
  jsonb_build_array(jsonb_build_object('unit_id', pg_temp.unit('box'), 'factor', 12)));
insert into t_ids select 'cash', id from public.cash_bank_accounts where name = 'Kas Laci';

-- ---------------------------------------------------------------------------
-- Supplier & PO
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('u_cashier');
select pg_temp.fails($q$ select public.save_supplier(null, '{"name": "PT Kasir"}') $q$, 'tidak punya izin', 'kasir: tidak bisa menambah supplier');

reset role;
select pg_temp.login('u_wh');
insert into t_ids select 's_part', public.save_supplier(null, '{"name": "PT Sumber Part", "payment_terms_days": 30, "phone": "0812111222"}');
select pg_temp.check((select code ~ '^SUP-[0-9]{3}$' and payment_terms_days = 30 from public.suppliers where id = pg_temp.id('s_part')),
  'gudang: tambah supplier (kode otomatis, termin 30 hari)');

reset role;
select pg_temp.login('u_admin');
insert into t_ids select 'po', public.save_purchase_order(null, jsonb_build_object('supplier_id', pg_temp.id('s_part')),
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('i_filter'), 'unit_id', pg_temp.unit('box'), 'qty', 2, 'unit_price', 120000)));
select pg_temp.check((select po_no like 'PO-%' and status = 'draft' from public.purchase_orders where id = pg_temp.id('po')), 'admin: PO draft');
select pg_temp.check((select factor = 12 from public.purchase_order_items where po_id = pg_temp.id('po')), 'PO: faktor box→pcs tersimpan');
select pg_temp.fails($q$ select public.set_purchase_order_status(pg_temp.id('po'), 'close') $q$, 'tidak bisa dilakukan', 'PO: draft tidak bisa ditutup');
select public.set_purchase_order_status(pg_temp.id('po'), 'send');
select pg_temp.fails($q$ select public.save_purchase_order(pg_temp.id('po'), jsonb_build_object('supplier_id', pg_temp.id('s_part')),
    jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('i_filter'), 'unit_id', pg_temp.unit('pcs'), 'qty', 1, 'unit_price', 1))) $q$,
  'Hanya PO draft', 'PO: yang sudah dikirim tidak bisa diubah');

-- ---------------------------------------------------------------------------
-- Penerimaan dari PO (gudang)
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('u_wh');
insert into t_ids select 'gr1', public.post_goods_receipt(
  jsonb_build_object('supplier_id', pg_temp.id('s_part'), 'po_id', pg_temp.id('po'), 'invoice_no', 'INV-SUP-001'),
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('i_filter'), 'unit_id', pg_temp.unit('box'), 'qty', 1, 'unit_price', 120000,
                                       'location_id', pg_temp.id('l_bin'),
                                       'po_item_id', (select id from public.purchase_order_items where po_id = pg_temp.id('po')))));
select pg_temp.check((select qty = 12 from public.stock_balances where item_id = pg_temp.id('i_filter')), 'terima: 1 box = +12 pcs stok');
select pg_temp.check(pg_temp.avg('i_filter') = 10000, 'terima: HPP 120.000 / 12 = 10.000 per pcs');
select pg_temp.check((select status = 'partial' from public.purchase_orders where id = pg_temp.id('po')), 'PO: diterima sebagian');
select pg_temp.check((select due_date = receipt_date + 30 from public.goods_receipts where id = pg_temp.id('gr1')), 'hutang: jatuh tempo = tanggal + termin supplier');
select pg_temp.fails($q$ select public.post_goods_receipt(
    jsonb_build_object('supplier_id', pg_temp.id('s_part'), 'po_id', pg_temp.id('po')),
    jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('i_filter'), 'unit_id', pg_temp.unit('box'), 'qty', 2, 'unit_price', 120000,
                      'location_id', pg_temp.id('l_bin'), 'po_item_id', (select id from public.purchase_order_items where po_id = pg_temp.id('po'))))) $q$,
  'melebihi sisa pesanan', 'terima: melebihi sisa PO ditolak');

-- PPN tidak PKP → masuk HPP
insert into t_ids select 'gr2', public.post_goods_receipt(
  jsonb_build_object('supplier_id', pg_temp.id('s_part'), 'po_id', pg_temp.id('po'), 'ppn_amount', 13200),
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('i_filter'), 'unit_id', pg_temp.unit('box'), 'qty', 1, 'unit_price', 132000,
                                       'location_id', pg_temp.id('l_bin'),
                                       'po_item_id', (select id from public.purchase_order_items where po_id = pg_temp.id('po')))));
select pg_temp.check((select cost_total = 145200 from public.goods_receipt_items where receipt_id = pg_temp.id('gr2')),
  'PPN (tidak PKP): 132.000 + 13.200 masuk nilai persediaan');
select pg_temp.check(pg_temp.avg('i_filter') = 11050, 'HPP rata-rata: (12×10.000 + 12×12.100) / 24 = 11.050');
select pg_temp.check((select status = 'received' from public.purchase_orders where id = pg_temp.id('po')), 'PO: diterima penuh');

-- PPN PKP → PPN Masukan terpisah
reset role;
update public.settings set value = 'true' where key = 'ppn_enabled';
select pg_temp.login('u_wh');
insert into t_ids select 'gr3', public.post_goods_receipt(
  jsonb_build_object('supplier_id', pg_temp.id('s_part'), 'ppn_amount', 11000, 'due_date', '2026-12-31'),
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('i_filter'), 'unit_id', pg_temp.unit('pcs'), 'qty', 10, 'unit_price', 10500,
                                       'discount_amount', 5000, 'location_id', pg_temp.id('l_bin'))));
select pg_temp.check((select subtotal = 100000 and total = 111000 and not ppn_capitalized from public.goods_receipts where id = pg_temp.id('gr3')),
  'PKP: subtotal 100.000 (setelah diskon) + PPN 11.000 = hutang 111.000');
select pg_temp.check((select cost_total = 100000 from public.goods_receipt_items where receipt_id = pg_temp.id('gr3')), 'PKP: PPN tidak masuk HPP');

reset role;
select pg_temp.check(pg_temp.bal('ppn_in') = 11000, 'jurnal: PPN Masukan 11.000');
select pg_temp.check(pg_temp.bal('inventory') = 365200, 'jurnal: Persediaan 120.000 + 145.200 + 100.000');
select pg_temp.check(pg_temp.bal('ap') = -376200, 'jurnal: Hutang Usaha 376.200 (kredit)');

-- ---------------------------------------------------------------------------
-- Pembayaran hutang
-- ---------------------------------------------------------------------------
select pg_temp.login('u_admin');
select pg_temp.fails($q$ select public.post_supplier_payment(jsonb_build_object('supplier_id', pg_temp.id('s_part'), 'cash_bank_account_id', pg_temp.id('cash')),
    jsonb_build_array(jsonb_build_object('receipt_id', pg_temp.id('gr1'), 'amount', 1000))) $q$,
  'tidak punya izin', 'admin: hanya bisa melihat hutang, tidak membayar');

reset role;
select pg_temp.login('u_owner');
insert into t_ids select 'pay1', public.post_supplier_payment(
  jsonb_build_object('supplier_id', pg_temp.id('s_part'), 'cash_bank_account_id', pg_temp.id('cash')),
  jsonb_build_array(jsonb_build_object('receipt_id', pg_temp.id('gr1'), 'amount', 50000), jsonb_build_object('receipt_id', pg_temp.id('gr2'), 'amount', 145200)));
select pg_temp.check(pg_temp.outstanding('gr1') = 70000 and pg_temp.outstanding('gr2') = 0, 'bayar: sebagian + lunas dua faktur sekaligus');
select pg_temp.fails($q$ select public.post_supplier_payment(jsonb_build_object('supplier_id', pg_temp.id('s_part'), 'cash_bank_account_id', pg_temp.id('cash')),
    jsonb_build_array(jsonb_build_object('receipt_id', pg_temp.id('gr1'), 'amount', 70001))) $q$,
  'melebihi sisa hutang', 'bayar: melebihi sisa hutang ditolak');
select public.void_supplier_payment(pg_temp.id('pay1'), 'Salah input');
select pg_temp.check(pg_temp.outstanding('gr1') = 120000 and pg_temp.outstanding('gr2') = 145200, 'batal bayar: hutang kembali utuh');
reset role;
select pg_temp.check((select count(distinct e.id) = 2 and sum(l.debit) = sum(l.credit)
                      from public.journal_entries e join public.journal_lines l on l.entry_id = e.id
                      where e.source_id = pg_temp.id('pay1') group by e.source_id), 'batal bayar: jurnal pembalik dibuat');
select pg_temp.check(pg_temp.bal('cash') = 0, 'batal bayar: saldo kas kembali 0');

-- ---------------------------------------------------------------------------
-- Retur ke supplier
-- ---------------------------------------------------------------------------
select pg_temp.login('u_wh');
insert into t_ids select 'rt1', public.post_purchase_return(pg_temp.id('gr1'), '{"settlement": "debt", "reason": "Filter penyok"}',
  jsonb_build_array(jsonb_build_object('receipt_item_id', (select id from public.goods_receipt_items where receipt_id = pg_temp.id('gr1')), 'base_qty', 2)));
select pg_temp.check((select amount = 20000 from public.purchase_returns where id = pg_temp.id('rt1')), 'retur: dinilai harga faktur 2 × 10.000');
select pg_temp.check(pg_temp.outstanding('gr1') = 100000, 'retur potong hutang: 120.000 − 20.000');
select pg_temp.fails($q$ select public.post_purchase_return(pg_temp.id('gr1'), '{"settlement": "debt", "reason": "lagi"}',
    jsonb_build_array(jsonb_build_object('receipt_item_id', (select id from public.goods_receipt_items where receipt_id = pg_temp.id('gr1')), 'base_qty', 11))) $q$,
  'melebihi jumlah yang diterima', 'retur: melebihi jumlah diterima ditolak');
select pg_temp.fails($q$ select public.post_purchase_return(pg_temp.id('gr1'), '{"settlement": "debt", "reason": ""}',
    jsonb_build_array(jsonb_build_object('receipt_item_id', (select id from public.goods_receipt_items where receipt_id = pg_temp.id('gr1')), 'base_qty', 1))) $q$,
  'Alasan retur', 'retur: alasan wajib');

-- Retur uang kembali dengan PPN terpisah
insert into t_ids select 'rt2', public.post_purchase_return(pg_temp.id('gr3'),
  jsonb_build_object('settlement', 'refund', 'cash_bank_account_id', pg_temp.id('cash'), 'reason', 'Salah kirim'),
  jsonb_build_array(jsonb_build_object('receipt_item_id', (select id from public.goods_receipt_items where receipt_id = pg_temp.id('gr3')), 'base_qty', 1)));
select pg_temp.check((select amount = 10000 and ppn_amount = 1100 from public.purchase_returns where id = pg_temp.id('rt2')),
  'retur PKP: nilai 10.000 + PPN 1.100 dibalik');
select pg_temp.check(pg_temp.outstanding('gr3') = 111000, 'retur uang kembali: hutang tidak berubah');

reset role;
select pg_temp.check(pg_temp.bal('cash') = 11100, 'retur uang kembali: kas masuk 11.100');
select pg_temp.check(pg_temp.bal('ppn_in') = 9900, 'retur PKP: PPN Masukan 11.000 − 1.100');

-- Semua jurnal seimbang & persediaan GL = nilai stok + selisih
select pg_temp.check(not exists (
  select 1 from public.journal_entries e join public.journal_lines l on l.entry_id = e.id
  where e.created_at >= (select created_at from t_ids_start) group by e.id having sum(l.debit) <> sum(l.credit)
), 'jurnal: semua entri seimbang');
select pg_temp.check((select qty = 31 from public.v_stock_on_hand where item_id = pg_temp.id('i_filter')), 'stok akhir: 12 + 12 + 10 − 2 − 1 = 31');

-- Potong hutang melebihi sisa → harus uang kembali
select pg_temp.login('u_owner');
select public.post_supplier_payment(jsonb_build_object('supplier_id', pg_temp.id('s_part'), 'cash_bank_account_id', pg_temp.id('cash')),
  jsonb_build_array(jsonb_build_object('receipt_id', pg_temp.id('gr2'), 'amount', 145200)));
select pg_temp.fails($q$ select public.post_purchase_return(pg_temp.id('gr2'), '{"settlement": "debt", "reason": "Rusak"}',
    jsonb_build_array(jsonb_build_object('receipt_item_id', (select id from public.goods_receipt_items where receipt_id = pg_temp.id('gr2')), 'base_qty', 1))) $q$,
  'uang kembali', 'retur: potong hutang pada faktur lunas ditolak');

-- ---------------------------------------------------------------------------
-- Akses
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('u_cashier');
select pg_temp.check((select count(*) = 0 from public.purchase_orders), 'kasir: tidak melihat PO');
select pg_temp.check((select count(*) = 0 from public.journal_entries), 'kasir: tidak melihat jurnal');
select pg_temp.check((select count(*) = 2 from public.cash_bank_accounts), 'kasir: bisa melihat daftar kas/bank');
do $$ begin
  insert into public.journal_entries (branch_id, entry_no, entry_date, source_type, description)
  select branch_id, 'X', current_date, 'manual', 'x' from public.accounts limit 1;
  raise exception 'GAGAL: kasir bisa menulis jurnal';
exception when insufficient_privilege then raise notice 'OK   kasir: tidak bisa menulis jurnal langsung';
end $$;

reset role;
select pg_temp.fails($q$ update public.journal_lines set debit = 1 where id = (select id from public.journal_lines limit 1) $q$,
  'append-only', 'jurnal: tidak bisa diubah');
select pg_temp.fails($q$ select app.post_journal(current_date, 'manual', null, 'tidak seimbang',
    '[{"account": "cash", "debit": 100}, {"account": "ap", "credit": 90}]') $q$, 'tidak seimbang', 'jurnal: tidak seimbang ditolak');

select pg_temp.login('u_admin');
insert into t_ids select 'po2', public.save_purchase_order(null, jsonb_build_object('supplier_id', pg_temp.id('s_part')),
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('i_filter'), 'unit_id', pg_temp.unit('pcs'), 'qty', 5, 'unit_price', 10000)));
select pg_temp.fails($q$ select public.set_purchase_order_status(pg_temp.id('po2'), 'cancel') $q$, 'Alasan pembatalan', 'PO: batal wajib alasan');
select public.set_purchase_order_status(pg_temp.id('po2'), 'cancel', 'Tidak jadi');
select pg_temp.check((select status = 'cancelled' and cancel_reason = 'Tidak jadi' from public.purchase_orders where id = pg_temp.id('po2')), 'PO: dibatalkan dengan alasan');

reset role;
rollback;
\o
\echo SEMUA TES PEMBELIAN LULUS
