-- Tes finance: transaksi kas, biaya rutin, jurnal manual, bagan akun, tutup buku, laporan (migration 20261103000017).
-- Berjalan dalam satu transaksi dan di-ROLLBACK. Data uji bertanggal 2020 agar laporan tepat dan tidak tercampur data nyata.

\set QUIET on
\o /dev/null
begin;

create temporary table t_ids (k text primary key, v uuid);
grant select, insert on t_ids to authenticated;
insert into t_ids values ('u_owner', gen_random_uuid()), ('u_admin', gen_random_uuid()), ('u_cashier', gen_random_uuid()), ('u_mech', gen_random_uuid());

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', k || '@test.local', now(), now()
from t_ids;

do $$
declare
  b uuid := (select id from public.branches where code = 'PST');
  e uuid;
  r record;
begin
  for r in select * from (values ('u_owner', 'owner', 'T-OWN'), ('u_admin', 'admin', 'T-ADM'), ('u_cashier', 'cashier', 'T-KSR'), ('u_mech', 'mechanic', 'T-MKN')) x(k, role_code, code) loop
    insert into public.employees (branch_id, code, full_name) values (b, r.code, 'Uji ' || r.code) returning id into e;
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
create or replace function pg_temp.acc(p_code text) returns uuid language sql as $$ select id from public.accounts where code = p_code $$;
create or replace function pg_temp.accsys(p_key text) returns uuid language sql as $$ select id from public.accounts where system_key = p_key $$;

insert into t_ids select 'kas', id from public.cash_bank_accounts where name = 'Kas Laci';
insert into t_ids select 'bank', id from public.cash_bank_accounts where name = 'Bank';

-- ---------------------------------------------------------------------------
-- Akun kas/bank & bagan akun
-- ---------------------------------------------------------------------------
select pg_temp.login('u_admin');
select pg_temp.fails($q$ select public.save_cash_bank_account(null, '{"name": "Bank BCA", "kind": "bank"}') $q$, 'tidak punya izin', 'admin: tidak bisa menambah akun bank');
select pg_temp.fails($q$ select public.save_account(null, '{"code": "6-9001", "name": "Beban Parkir", "type": "expense"}') $q$, 'tidak punya izin', 'admin: tidak bisa mengubah bagan akun');
reset role;
select pg_temp.login('u_owner');
-- Saldo awal kas/bank sebelum tes (untuk selisih)
create temporary table t_cash0 as select name, balance from public.report_cash_bank_balances(date '2019-12-31');
insert into t_ids select 'bca', public.save_cash_bank_account(null, '{"name": "Bank BCA", "kind": "bank", "bank_name": "BCA", "account_number": "123"}');
select pg_temp.check((select a.type = 'asset' and a.code ~ '^1-10[0-9]{2}$' and a.name = 'Bank BCA' from public.cash_bank_accounts cb join public.accounts a on a.id = cb.account_id
                      where cb.id = pg_temp.id('bca')), 'akun bank baru: akun buku besar dibuat otomatis');
insert into t_ids select 'a_parkir', public.save_account(null, '{"code": "6-9001", "name": "Beban Parkir", "type": "expense"}');
select pg_temp.check((select normal_balance = 'debit' and type = 'expense' from public.accounts where id = pg_temp.id('a_parkir')), 'akun baru: saldo normal mengikuti jenis');
select pg_temp.fails($q$ select public.save_account(null, '{"code": "6-9001", "name": "Dobel", "type": "expense"}') $q$, 'sudah dipakai', 'akun: kode dobel ditolak');
select pg_temp.fails($q$ select public.save_account(null, '{"code": "4-9001", "name": "Salah awalan", "type": "expense"}') $q$, 'Awalan kode', 'akun: awalan kode harus sesuai jenis');
select pg_temp.fails($q$ select public.set_account_active(pg_temp.accsys('cash'), false) $q$, 'Akun sistem', 'akun sistem tidak bisa dinonaktifkan');
select public.set_account_active(pg_temp.id('a_parkir'), false);
select pg_temp.check((select not is_active from public.accounts where id = pg_temp.id('a_parkir')), 'akun kosong bisa dinonaktifkan');
select public.set_account_active(pg_temp.id('a_parkir'), true);

-- ---------------------------------------------------------------------------
-- Transaksi kas (semua bertanggal Juni 2020)
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('u_mech');
select pg_temp.fails(format($q$ select public.post_cash_transaction('{"kind": "expense", "txn_date": "2020-06-12", "cash_bank_account_id": "%s", "account_id": "%s", "amount": 1000, "description": "Tes"}') $q$,
  pg_temp.id('kas'), pg_temp.acc('6-1200')), 'tidak punya izin', 'mekanik: tidak bisa mencatat pengeluaran');
select pg_temp.check((select count(*) = 0 from public.cash_transactions), 'mekanik: tidak melihat transaksi kas');

reset role;
select pg_temp.login('u_admin');
insert into t_ids select 'exp', public.post_cash_transaction(jsonb_build_object('kind', 'expense', 'txn_date', '2020-06-12',
  'cash_bank_account_id', pg_temp.id('kas'), 'account_id', pg_temp.acc('6-1200'), 'amount', 100000, 'description', 'Listrik Mei'));
select pg_temp.check((select txn_no like 'KK-%' and status = 'posted' from public.cash_transactions where id = pg_temp.id('exp')), 'admin: pengeluaran bernomor KK');
select pg_temp.fails(format($q$ select public.post_cash_transaction('{"kind": "expense", "txn_date": "2020-06-12", "cash_bank_account_id": "%s", "account_id": "%s", "amount": 1000, "description": "Salah akun"}') $q$,
  pg_temp.id('kas'), pg_temp.acc('4-1001')), 'akun beban', 'pengeluaran ke akun pendapatan ditolak');
select pg_temp.fails(format($q$ select public.post_cash_transaction('{"kind": "expense", "txn_date": "2099-01-01", "cash_bank_account_id": "%s", "account_id": "%s", "amount": 1000, "description": "Masa depan"}') $q$,
  pg_temp.id('kas'), pg_temp.acc('6-1200')), 'masa depan', 'tanggal masa depan ditolak');
select pg_temp.fails(format($q$ select public.post_cash_transaction('{"kind": "expense", "txn_date": "2020-06-12", "cash_bank_account_id": "%s", "account_id": "%s", "amount": 0, "description": "Nol"}') $q$,
  pg_temp.id('kas'), pg_temp.acc('6-1200')), 'lebih dari nol', 'jumlah nol ditolak');
insert into t_ids select 'inc', public.post_cash_transaction(jsonb_build_object('kind', 'income', 'txn_date', '2020-06-10',
  'cash_bank_account_id', pg_temp.id('bank'), 'account_id', pg_temp.acc('7-1001'), 'amount', 50000, 'description', 'Jual oli bekas'));
select pg_temp.check((select txn_no like 'KM-%' from public.cash_transactions where id = pg_temp.id('inc')), 'admin: pemasukan lain bernomor KM');
select pg_temp.fails(format($q$ select public.post_cash_transaction('{"kind": "capital", "txn_date": "2020-06-05", "cash_bank_account_id": "%s", "amount": 5000000, "description": "Setoran modal"}') $q$,
  pg_temp.id('bank')), 'tidak punya izin', 'admin: tidak bisa mencatat setoran modal');
insert into t_ids select 'tf', public.post_cash_transaction(jsonb_build_object('kind', 'transfer', 'txn_date', '2020-06-11',
  'cash_bank_account_id', pg_temp.id('kas'), 'to_cash_bank_account_id', pg_temp.id('bank'), 'amount', 300000, 'description', 'Setor kas ke bank'));
select pg_temp.fails(format($q$ select public.post_cash_transaction('{"kind": "transfer", "txn_date": "2020-06-11", "cash_bank_account_id": "%s", "to_cash_bank_account_id": "%s", "amount": 1000, "description": "Sama"}') $q$,
  pg_temp.id('kas'), pg_temp.id('kas')), 'tidak boleh sama', 'transfer ke akun yang sama ditolak');
select pg_temp.check((select count(*) = 0 from public.journal_entries), 'admin: tidak melihat jurnal (tanpa izin jurnal)');

reset role;
select pg_temp.login('u_cashier');
select pg_temp.check(public.post_cash_transaction(jsonb_build_object('kind', 'expense', 'txn_date', '2020-06-12', 'cash_bank_account_id', pg_temp.id('kas'),
  'account_id', pg_temp.acc('6-1200'), 'amount', 1000, 'description', 'Kas kecil kasir')) is not null, 'kasir: boleh mencatat pengeluaran kecil');
select pg_temp.fails(format($q$ select public.void_cash_transaction('%s', 'salah catat') $q$, pg_temp.id('exp')), 'tidak punya izin', 'kasir: tidak bisa membatalkan transaksi kas');

reset role;
select pg_temp.login('u_owner');
insert into t_ids select 'cap', public.post_cash_transaction(jsonb_build_object('kind', 'capital', 'txn_date', '2020-06-05',
  'cash_bank_account_id', pg_temp.id('bank'), 'amount', 5000000, 'description', 'Setoran modal awal'));
insert into t_ids select 'drw', public.post_cash_transaction(jsonb_build_object('kind', 'drawing', 'txn_date', '2020-06-20',
  'cash_bank_account_id', pg_temp.id('bank'), 'amount', 200000, 'description', 'Prive owner'));
select pg_temp.check((select count(*) = 4 from public.journal_entries e join public.journal_lines l on l.entry_id = e.id
                      where e.source_type = 'cash_txn' and e.source_id in (pg_temp.id('cap'), pg_temp.id('drw'))) and
                     (select sum(debit) = sum(credit) from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
                      where e.source_id in (pg_temp.id('cap'), pg_temp.id('drw'))), 'modal & prive: dua jurnal seimbang (2 baris per jurnal)');

-- Biaya rutin
insert into t_ids select 'rec', public.save_recurring_expense(null, jsonb_build_object('name', 'Sewa bengkel', 'account_id', pg_temp.acc('6-1300'),
  'cash_bank_account_id', pg_temp.id('bank'), 'amount', 1500000, 'day_of_month', 5));
select pg_temp.check((select not confirmed_this_month from public.v_recurring_expenses where id = pg_temp.id('rec')), 'biaya rutin: belum dikonfirmasi bulan ini');
select pg_temp.fails(format($q$ select public.save_recurring_expense(null, '{"name": "Xx", "account_id": "%s", "cash_bank_account_id": "%s", "amount": 1000, "day_of_month": 31}') $q$,
  pg_temp.acc('6-1300'), pg_temp.id('bank')), '1-28', 'biaya rutin: tanggal harus 1-28');
select pg_temp.fails(format($q$ select public.save_recurring_expense(null, '{"name": "Salah", "account_id": "%s", "cash_bank_account_id": "%s", "amount": 1000, "day_of_month": 1}') $q$,
  pg_temp.acc('1-1001'), pg_temp.id('bank')), 'akun beban', 'biaya rutin: harus akun beban');
insert into t_ids select 'rec_txn', public.confirm_recurring_expense(pg_temp.id('rec'), date '2020-06-05');
select pg_temp.check((select amount = 1500000 and recurring_id = pg_temp.id('rec') and description like 'Sewa bengkel%' from public.cash_transactions where id = pg_temp.id('rec_txn')),
  'biaya rutin: konfirmasi membuat pengeluaran sesuai template');
select pg_temp.fails(format($q$ select public.confirm_recurring_expense('%s', date '2020-06-20') $q$, pg_temp.id('rec')), 'sudah dikonfirmasi', 'biaya rutin: sekali per bulan');
insert into t_ids select 'rec_txn2', public.confirm_recurring_expense(pg_temp.id('rec'), date '2020-07-05', 1600000);
select pg_temp.check((select amount = 1600000 from public.cash_transactions where id = pg_temp.id('rec_txn2')), 'biaya rutin: bulan berikutnya boleh dengan jumlah berbeda');

-- ---------------------------------------------------------------------------
-- Jurnal manual
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('u_admin');
select pg_temp.fails(format($q$ select public.post_manual_journal(date '2020-06-15', 'Tes', '[{"account_id": "%s", "debit": 100}, {"account_id": "%s", "credit": 100}]') $q$,
  pg_temp.acc('1-1001'), pg_temp.acc('4-1001')), 'tidak punya izin', 'admin: tidak bisa membuat jurnal manual');
reset role;
select pg_temp.login('u_owner');
select pg_temp.fails(format($q$ select public.post_manual_journal(date '2020-06-15', 'Tidak seimbang', '[{"account_id": "%s", "debit": 100}, {"account_id": "%s", "credit": 90}]') $q$,
  pg_temp.acc('1-1001'), pg_temp.acc('4-1001')), 'tidak seimbang', 'jurnal manual tidak seimbang ditolak');
select pg_temp.fails(format($q$ select public.post_manual_journal(date '2020-06-15', 'Satu baris', '[{"account_id": "%s", "debit": 100}]') $q$, pg_temp.acc('1-1001')), 'minimal dua baris', 'jurnal manual minimal dua baris');
insert into t_ids select 'mj1', public.post_manual_journal(date '2020-06-15', 'Pendapatan jasa penyesuaian',
  jsonb_build_array(jsonb_build_object('account_id', pg_temp.acc('1-1001'), 'debit', 1000000), jsonb_build_object('account_id', pg_temp.accsys('service_revenue'), 'credit', 1000000)));
insert into t_ids select 'mj2', public.post_manual_journal(date '2020-06-15', 'HPP penyesuaian',
  jsonb_build_array(jsonb_build_object('account_id', pg_temp.accsys('cogs'), 'debit', 300000), jsonb_build_object('account_id', pg_temp.accsys('inventory'), 'credit', 300000)));
select pg_temp.check((select source_type = 'manual' and entry_no like 'JU-%' from public.journal_entries where id = pg_temp.id('mj1')), 'jurnal manual: nomor JU, sumber manual');
select pg_temp.fails(format($q$ select public.reverse_manual_journal((select id from public.journal_entries where source_id = '%s'), 'coba balik') $q$, pg_temp.id('exp')),
  'Jurnal otomatis', 'jurnal otomatis tidak bisa dibalik manual');

-- Pembalik jurnal manual (dibuat terpisah agar laporan Juni tetap tepat)
insert into t_ids select 'mj3', public.post_manual_journal(date '2020-08-16', 'Jurnal salah',
  jsonb_build_array(jsonb_build_object('account_id', pg_temp.acc('1-1001'), 'debit', 777), jsonb_build_object('account_id', pg_temp.accsys('service_revenue'), 'credit', 777)));
select public.reverse_manual_journal(pg_temp.id('mj3'), 'salah input');
select pg_temp.check((select count(*) = 1 from public.journal_entries where reversal_of = pg_temp.id('mj3')), 'jurnal manual: pembalik tercatat');
select pg_temp.fails(format($q$ select public.reverse_manual_journal('%s', 'dobel') $q$, pg_temp.id('mj3')), 'sudah dibalik', 'jurnal manual: tidak bisa dibalik dua kali');
select pg_temp.check((select is_reversed from public.v_journal_entries where id = pg_temp.id('mj3')), 'v_journal_entries: penanda sudah dibalik');
select pg_temp.fails(format($q$ update public.journal_entries set description = 'ubah' where id = '%s' $q$, pg_temp.id('mj1')), 'permission denied', 'jurnal tidak bisa diedit lewat API');

-- Batal transaksi kas (owner), saldo beban kembali
select public.void_cash_transaction(pg_temp.id('rec_txn2'), 'Sewa Juli salah jumlah');
select pg_temp.check((select status = 'void' from public.cash_transactions where id = pg_temp.id('rec_txn2')), 'batal transaksi kas: status void');
select pg_temp.fails(format($q$ select public.void_cash_transaction('%s', 'dobel') $q$, pg_temp.id('rec_txn2')), 'sudah dibatalkan', 'batal transaksi kas dua kali ditolak');
select pg_temp.check((select count(*) = 1 from public.journal_entries where source_id = pg_temp.id('rec_txn2') and reversal_of is not null), 'batal transaksi kas: jurnal pembalik dibuat');

-- ---------------------------------------------------------------------------
-- Laporan Juni 2020 (pendapatan 1.000.000, HPP 300.000, beban listrik 100.000 + 1.000 + sewa 1.500.000, lain-lain 50.000)
-- ---------------------------------------------------------------------------
select pg_temp.check((select sum(amount) filter (where section = 'revenue') = 1000000 from public.report_profit_loss(date '2020-06-01', date '2020-06-30')), 'laba rugi: pendapatan jasa 1.000.000');
select pg_temp.check((select sum(amount) filter (where section = 'cogs') = 300000 from public.report_profit_loss(date '2020-06-01', date '2020-06-30')), 'laba rugi: HPP 300.000');
select pg_temp.check((select sum(amount) filter (where section = 'expense') = 1601000 from public.report_profit_loss(date '2020-06-01', date '2020-06-30')),
  'laba rugi: beban 1.601.000 (listrik 100.000 + kas kecil 1.000 + sewa 1.500.000)');
select pg_temp.check((select sum(amount) filter (where section = 'other') = 50000 from public.report_profit_loss(date '2020-06-01', date '2020-06-30')), 'laba rugi: pendapatan lain 50.000');
select pg_temp.check((select coalesce(sum(amount) filter (where section in ('revenue', 'other')), 0) - coalesce(sum(amount) filter (where section in ('cogs', 'expense', 'tax')), 0) = -851000
                      from public.report_profit_loss(date '2020-06-01', date '2020-06-30')), 'laba rugi: rugi bersih 851.000');
select pg_temp.check((select count(*) = 0 from public.report_profit_loss(date '2020-09-01', date '2020-09-30') where section = 'revenue'), 'laba rugi: periode lain tidak tercampur');

select pg_temp.check((select abs(sum(amount) filter (where section = 'asset') - sum(amount) filter (where section in ('liability', 'equity'))) < 0.005
                      from public.report_balance_sheet(date '2020-06-30')), 'neraca: aset = kewajiban + modal (termasuk laba berjalan)');
select pg_temp.check((select amount = -851000 from public.report_balance_sheet(date '2020-06-30') where code = '3-9999'), 'neraca: laba berjalan kumulatif -851.000 per akhir Juni 2020');
select pg_temp.check((select abs(sum(amount) filter (where section = 'asset') - sum(amount) filter (where section in ('liability', 'equity'))) < 0.005
                      from public.report_balance_sheet(app.today_wib())), 'neraca hari ini: seimbang');

select pg_temp.check((select coalesce(sum(inflow) filter (where category = 'operating'), 0) = 1050000 and coalesce(sum(outflow) filter (where category = 'operating'), 0) = 1601000
                      from public.report_cash_flow(date '2020-06-01', date '2020-06-30')), 'arus kas: operasi masuk 1.050.000, keluar 1.601.000');
select pg_temp.check((select sum(inflow) filter (where category = 'financing') = 5000000 and sum(outflow) filter (where category = 'financing') = 200000
                      from public.report_cash_flow(date '2020-06-01', date '2020-06-30')), 'arus kas: pendanaan masuk modal 5.000.000, keluar prive 200.000');
select pg_temp.check((select count(*) = 0 from public.report_cash_flow(date '2020-06-01', date '2020-06-30') where source_type = 'transfer'), 'arus kas: transfer antar kas tidak muncul');

select pg_temp.check((select (select balance from public.report_cash_bank_balances(date '2020-06-30') where name = 'Kas Laci')
                           - (select balance from t_cash0 where name = 'Kas Laci') = 1000000 - 100000 - 1000 - 300000
                          and (select balance from public.report_cash_bank_balances(date '2020-06-30') where name = 'Bank')
                           - (select balance from t_cash0 where name = 'Bank') = 50000 + 300000 + 5000000 - 200000 - 1500000), 'saldo kas & bank per 30 Jun 2020 sesuai transaksi');

select pg_temp.check((select count(*) = 3 and (select balance from public.report_ledger(pg_temp.acc('6-1200'), date '2020-06-01', date '2020-06-30') order by ord desc limit 1) = 101000
                      from public.report_ledger(pg_temp.acc('6-1200'), date '2020-06-01', date '2020-06-30')), 'buku besar: saldo awal + 2 mutasi, saldo akhir 101.000');
select pg_temp.check((select balance = 0 and description = 'Saldo awal' from public.report_ledger(pg_temp.acc('6-1200'), date '2020-06-01', date '2020-06-30') where ord = 0), 'buku besar: saldo awal 0 sebelum Juni 2020');
select pg_temp.check((select closing = 101000 and period_debit = 101000 and opening = 0 from public.report_account_balances(date '2020-06-01', date '2020-06-30') where code = '6-1200'), 'saldo akun: awal, mutasi, akhir');
select pg_temp.check((select count(*) >= 0 from public.report_margin('service', date '2020-06-01', date '2020-06-30')), 'margin per jasa: bisa dipanggil owner');

reset role;
select pg_temp.login('u_admin');
select pg_temp.fails($q$ select * from public.report_profit_loss(date '2020-06-01', date '2020-06-30') $q$, 'tidak punya izin', 'admin: tidak boleh melihat laba rugi');
select pg_temp.fails($q$ select * from public.report_margin('item', date '2020-06-01', date '2020-06-30') $q$, 'tidak punya izin', 'admin: tidak boleh melihat margin (HPP)');
select pg_temp.check((select count(*) >= 2 from public.report_cash_bank_balances(app.today_wib())), 'admin: boleh melihat saldo kas & bank');
reset role;
select pg_temp.login('u_mech');
select pg_temp.fails($q$ select * from public.report_cash_bank_balances(app.today_wib()) $q$, 'tidak punya izin', 'mekanik: tidak boleh melihat saldo kas');

-- ---------------------------------------------------------------------------
-- Tutup buku (Januari 2020)
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('u_owner');
select public.post_manual_journal(date '2020-01-15', 'Jurnal Januari',
  jsonb_build_array(jsonb_build_object('account_id', pg_temp.acc('1-1001'), 'debit', 5000), jsonb_build_object('account_id', pg_temp.accsys('other_income'), 'credit', 5000)));
select pg_temp.fails($q$ select public.close_fiscal_period(extract(year from app.today_wib())::int, extract(month from app.today_wib())::int) $q$, 'sudah lewat', 'bulan berjalan tidak bisa ditutup');
select pg_temp.fails($q$ select public.close_fiscal_period(2020, 6) $q$, 'bulan-bulan sebelumnya', 'tutup buku harus berurutan');
reset role;
select pg_temp.login('u_admin');
select pg_temp.fails($q$ select public.close_fiscal_period(2020, 1) $q$, 'tidak punya izin', 'admin: tidak bisa menutup buku');
reset role;
select pg_temp.login('u_owner');
select public.close_fiscal_period(2020, 1);
select pg_temp.check((select is_closed from public.fiscal_periods where period_year = 2020 and period_month = 1), 'tutup buku: Januari 2020 terkunci');
select pg_temp.fails($q$ select public.post_manual_journal(date '2020-01-20', 'Mundur', '[]'::jsonb || jsonb_build_array(jsonb_build_object('account_id', (select id from public.accounts where code = '1-1001'), 'debit', 1), jsonb_build_object('account_id', (select id from public.accounts where code = '4-1001'), 'credit', 1))) $q$,
  'sudah ditutup', 'periode tertutup: jurnal bertanggal di bulan itu ditolak');
select pg_temp.fails(format($q$ select public.post_cash_transaction('{"kind": "expense", "txn_date": "2020-01-20", "cash_bank_account_id": "%s", "account_id": "%s", "amount": 1000, "description": "Mundur"}') $q$,
  pg_temp.id('kas'), pg_temp.acc('6-1200')), 'sudah ditutup', 'periode tertutup: transaksi kas bertanggal mundur ditolak');
select pg_temp.check(public.post_cash_transaction(jsonb_build_object('kind', 'expense', 'txn_date', '2020-02-10', 'cash_bank_account_id', pg_temp.id('kas'),
  'account_id', pg_temp.acc('6-1200'), 'amount', 1000, 'description', 'Februari masih terbuka')) is not null, 'bulan lain tetap bisa diposting');
reset role;
select pg_temp.login('u_admin');
select pg_temp.fails($q$ select public.reopen_fiscal_period(2020, 1, 'koreksi') $q$, 'Hanya Owner', 'admin: tidak bisa membuka periode');
reset role;
select pg_temp.login('u_owner');
select pg_temp.fails($q$ select public.reopen_fiscal_period(2020, 1, '') $q$, 'Alasan', 'buka periode wajib alasan');
select public.reopen_fiscal_period(2020, 1, 'Koreksi jurnal Januari');
select pg_temp.check((select not is_closed and reopen_reason = 'Koreksi jurnal Januari' from public.fiscal_periods where period_year = 2020 and period_month = 1), 'periode dibuka kembali dengan alasan');
select pg_temp.check(public.post_manual_journal(date '2020-01-20', 'Setelah dibuka',
  jsonb_build_array(jsonb_build_object('account_id', pg_temp.acc('1-1001'), 'debit', 1), jsonb_build_object('account_id', pg_temp.accsys('other_income'), 'credit', 1))) is not null, 'setelah dibuka, jurnal bertanggal Januari bisa diposting');

-- Akun bersaldo tidak bisa dinonaktifkan
select pg_temp.fails($q$ select public.set_account_active(pg_temp.acc('6-1200'), false) $q$, 'masih bersaldo', 'akun yang masih bersaldo tidak bisa dinonaktifkan');

reset role;
rollback;
\o
\echo SEMUA TES FINANCE LULUS
