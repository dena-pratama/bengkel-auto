-- Tes pajak: profil pajak, tarif PPN bertanggal, PPh Final UMKM, setor pajak, laporan PPN (migration 20261103000018).
-- Berjalan dalam satu transaksi dan di-ROLLBACK. Data uji bertanggal 2018-2020 agar tidak tercampur data nyata.

\set QUIET on
\o /dev/null
begin;

create temporary table t_ids (k text primary key, v uuid);
grant select, insert on t_ids to authenticated;
insert into t_ids values ('u_owner', gen_random_uuid()), ('u_admin', gen_random_uuid()), ('u_mech', gen_random_uuid());

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', k || '@test.local', now(), now() from t_ids;

do $$
declare
  b uuid := (select id from public.branches where code = 'PST');
  e uuid;
  r record;
begin
  for r in select * from (values ('u_owner', 'owner', 'T-OWN'), ('u_admin', 'admin', 'T-ADM'), ('u_mech', 'mechanic', 'T-MKN')) x(k, role_code, code) loop
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
-- Pendapatan jasa bertanggal (Dr Kas, Cr Pendapatan Jasa) lewat jurnal manual
create or replace function pg_temp.revenue(p_date date, p_amount numeric) returns uuid language sql as $$
  select public.post_manual_journal(p_date, 'Pendapatan uji ' || p_date,
    jsonb_build_array(jsonb_build_object('account_id', pg_temp.acc('1-1001'), 'debit', p_amount),
                      jsonb_build_object('account_id', pg_temp.accsys('service_revenue'), 'credit', p_amount))) $$;

insert into t_ids select 'kas', id from public.cash_bank_accounts where name = 'Kas Laci';

-- ---------------------------------------------------------------------------
-- Akses
-- ---------------------------------------------------------------------------
select pg_temp.login('u_admin');
select pg_temp.fails($q$ select public.save_tax_settings('{"business_form": "orang_pribadi", "pph_mode": "off"}') $q$, 'tidak punya izin', 'admin: tidak bisa mengubah profil pajak');
select pg_temp.fails($q$ select * from public.tax_overview(2020) $q$, 'tidak punya izin', 'admin: tidak bisa melihat ringkasan PPh');
select pg_temp.fails($q$ select * from public.report_ppn(date '2020-01-01', date '2020-12-31') $q$, 'tidak punya izin', 'admin: tidak bisa melihat laporan PPN');
select pg_temp.check((select count(*) = 0 from public.tax_settings), 'admin: tidak melihat pengaturan pajak');
reset role;
select pg_temp.login('u_mech');
select pg_temp.check((select count(*) = 0 from public.tax_period_summaries), 'mekanik: tidak melihat ringkasan pajak');

-- ---------------------------------------------------------------------------
-- Profil pajak
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('u_owner');
select pg_temp.fails($q$ select public.save_tax_settings('{"business_form": "orang_pribadi", "is_pkp": false, "ppn_enabled": true, "pph_mode": "off"}') $q$, 'berstatus PKP', 'PPN tidak bisa aktif jika bukan PKP');
select pg_temp.fails($q$ select public.save_tax_settings('{"business_form": "cv_firma_pt", "pph_mode": "final"}') $q$, 'tanggal akhir fasilitas', 'CV/Firma/PT: PPh Final wajib tanggal akhir fasilitas');
select pg_temp.fails($q$ select public.save_tax_settings('{"business_form": "lainnya", "pph_mode": "off"}') $q$, 'Bentuk usaha', 'bentuk usaha tidak valid ditolak');
select public.save_tax_settings('{"business_form": "orang_pribadi", "is_pkp": true, "ppn_enabled": true, "prices_include_ppn": false, "pph_mode": "final"}');
reset role;
select pg_temp.check((select value = 'true'::jsonb from public.settings where key = 'ppn_enabled' and branch_id = (select id from public.branches where code = 'PST')), 'PKP: saklar PPN aktif di setting yang dibaca invoice');
select pg_temp.login('u_owner');
select public.save_tax_settings('{"business_form": "orang_pribadi", "is_pkp": true, "ppn_enabled": false, "pph_mode": "final"}');
reset role;
select pg_temp.check((select value = 'false'::jsonb from public.settings where key = 'ppn_enabled' and branch_id = (select id from public.branches where code = 'PST')), 'saklar PPN dimatikan dari profil pajak');
select pg_temp.login('u_owner');

-- Tarif PPN bertanggal
select public.add_tax_rate('{"rate_percent": 13, "dpp_numerator": 11, "dpp_denominator": 12, "valid_from": "2099-01-01"}');
select pg_temp.check((select valid_to = date '2098-12-31' from public.tax_rates where rate_percent = 12 and valid_from = date '2025-01-01'), 'tarif baru: tarif lama berakhir sehari sebelumnya');
select pg_temp.fails($q$ select public.add_tax_rate('{"rate_percent": 14, "valid_from": "2050-01-01"}') $q$, 'setelah tarif terakhir', 'tarif baru harus bertanggal setelah tarif terakhir');
select pg_temp.check((select count(*) = 2 from public.tax_rates), 'dua tarif tersimpan (riwayat tarif utuh)');

-- ---------------------------------------------------------------------------
-- PPh Final: Orang Pribadi, Rp500 juta pertama bebas (contoh PRD §17.6)
-- ---------------------------------------------------------------------------
select pg_temp.revenue(date '2020-01-15', 300000000);
select pg_temp.revenue(date '2020-02-15', 400000000);
select pg_temp.check((select omzet = 300000000 and taxable = 0 and pph = 0 from public.tax_overview(2020) where month = 1), 'Jan: omzet 300 juta masih di bawah batas bebas, PPh 0');
select pg_temp.check((select omzet = 400000000 and cumulative = 700000000 and taxable = 200000000 and pph = 1000000 from public.tax_overview(2020) where month = 2),
  'Feb: kumulatif 700 juta, kena pajak 200 juta, PPh Final 0,5% = 1.000.000');
select pg_temp.check((select count(*) = 12 from public.tax_overview(2020)), 'ringkasan memuat 12 bulan');

insert into t_ids select 'sum1', public.post_pph_final(2020, 1);
select pg_temp.check((select pph_amount = 0 and journal_entry_id is null from public.tax_period_summaries where id = pg_temp.id('sum1')), 'posting Jan: PPh 0, tanpa jurnal');
insert into t_ids select 'sum2', public.post_pph_final(2020, 2);
select pg_temp.check((select pph_amount = 1000000 and journal_entry_id is not null and taxable_omzet = 200000000 from public.tax_period_summaries where id = pg_temp.id('sum2')), 'posting Feb: ringkasan + jurnal');
select pg_temp.check((select e.entry_date = date '2020-02-29' from public.journal_entries e join public.tax_period_summaries t on t.journal_entry_id = e.id where t.id = pg_temp.id('sum2')), 'jurnal PPh Final bertanggal akhir bulan');
select pg_temp.check((select sum(amount) filter (where section = 'tax') = 1000000 from public.report_profit_loss(date '2020-02-01', date '2020-02-29')), 'laba rugi: beban PPh Final 1.000.000 tampil sebagai pajak');
select pg_temp.check((select posted and posted_pph = 1000000 from public.tax_overview(2020) where month = 2), 'ringkasan menandai Feb sudah diposting');
select pg_temp.fails($q$ select public.post_pph_final(2020, 2) $q$, 'sudah diposting', 'posting ganda ditolak');
select pg_temp.fails(format($q$ select public.post_pph_final(%s, %s) $q$, extract(year from app.today_wib()), extract(month from app.today_wib())), 'sudah berakhir', 'bulan berjalan belum bisa diposting');

select public.save_tax_settings('{"business_form": "orang_pribadi", "is_pkp": true, "pph_mode": "off"}');
select pg_temp.fails($q$ select public.post_pph_final(2020, 3) $q$, 'belum diaktifkan', 'PPh Final OFF: posting ditolak');
select public.save_tax_settings('{"business_form": "orang_pribadi", "is_pkp": true, "pph_mode": "final"}');

-- Bentuk usaha lain: seluruh omzet kena pajak
select pg_temp.revenue(date '2019-03-10', 100000000);
select pg_temp.check((select pph = 0 from public.tax_overview(2019) where month = 3), 'Orang Pribadi: omzet 100 juta di bawah batas bebas, PPh 0');
select public.save_tax_settings('{"business_form": "pt_perorangan", "is_pkp": true, "pph_mode": "final"}');
select pg_temp.check((select taxable = 100000000 and pph = 500000 from public.tax_overview(2019) where month = 3), 'PT Perorangan: seluruh omzet kena pajak, PPh 500.000');
select public.save_tax_settings('{"business_form": "cv_firma_pt", "is_pkp": true, "pph_mode": "final", "facility_end_date": "2019-02-28"}');
select pg_temp.fails($q$ select public.post_pph_final(2019, 3) $q$, 'Fasilitas PPh Final', 'CV/Firma/PT: bulan setelah fasilitas berakhir ditolak');
select public.save_tax_settings('{"business_form": "orang_pribadi", "is_pkp": true, "pph_mode": "final"}');

-- Pembatalan dan posting ulang
select public.void_pph_final(pg_temp.id('sum2'), 'Omzet Februari dikoreksi');
select pg_temp.check((select status = 'void' from public.tax_period_summaries where id = pg_temp.id('sum2')) and
                     (select count(*) = 1 from public.journal_entries where source_id = pg_temp.id('sum2') and reversal_of is not null), 'batal PPh Final: jurnal dibalik');
select pg_temp.fails(format($q$ select public.void_pph_final('%s', 'dobel') $q$, pg_temp.id('sum2')), 'Sudah dibatalkan', 'batal ganda ditolak');
insert into t_ids select 'sum2b', public.post_pph_final(2020, 2);
select pg_temp.check((select pph_amount = 1000000 from public.tax_period_summaries where id = pg_temp.id('sum2b')), 'posting ulang setelah batal diizinkan');

-- ---------------------------------------------------------------------------
-- Setor pajak
-- ---------------------------------------------------------------------------
select pg_temp.fails(format($q$ select public.post_tax_payment('{"tax_type": "pph_final", "amount": 2000000, "pay_date": "2020-03-10", "cash_bank_account_id": "%s"}') $q$, pg_temp.id('kas')),
  'melebihi hutang', 'setor PPh melebihi hutang ditolak');
insert into t_ids select 'pay1', public.post_tax_payment(jsonb_build_object('tax_type', 'pph_final', 'period_year', 2020, 'period_month', 2, 'amount', 600000,
  'pay_date', '2020-03-10', 'cash_bank_account_id', pg_temp.id('kas'), 'reference', 'NTPN-1'));
select pg_temp.check((select count(*) = 2 from public.journal_lines l join public.journal_entries e on e.id = l.entry_id where e.source_type = 'tax_payment' and e.source_id = pg_temp.id('pay1')),
  'setor PPh: jurnal Dr Hutang PPh Final, Cr Kas');
select pg_temp.fails(format($q$ select public.post_tax_payment('{"tax_type": "pph_final", "amount": 500000, "pay_date": "2020-03-11", "cash_bank_account_id": "%s"}') $q$, pg_temp.id('kas')),
  'melebihi hutang', 'sisa hutang PPh Final dihitung setelah setoran pertama');
select public.void_tax_payment(pg_temp.id('pay1'), 'Salah rekening');
select pg_temp.check((select status = 'void' from public.tax_payments where id = pg_temp.id('pay1')), 'batal setoran');
select pg_temp.fails(format($q$ select public.void_tax_payment('%s', 'dobel') $q$, pg_temp.id('pay1')), 'sudah dibatalkan', 'batal setoran ganda ditolak');

-- ---------------------------------------------------------------------------
-- Laporan PPN (Juni 2018): Keluaran 120.000, Masukan 30.000
-- ---------------------------------------------------------------------------
select public.post_manual_journal(date '2018-06-10', 'Penjualan dengan PPN',
  jsonb_build_array(jsonb_build_object('account_id', pg_temp.acc('1-1001'), 'debit', 1120000),
                    jsonb_build_object('account_id', pg_temp.accsys('service_revenue'), 'credit', 1000000),
                    jsonb_build_object('account_id', pg_temp.accsys('ppn_out'), 'credit', 120000)));
select public.post_manual_journal(date '2018-06-12', 'PPN masukan pembelian',
  jsonb_build_array(jsonb_build_object('account_id', pg_temp.accsys('ppn_in'), 'debit', 30000),
                    jsonb_build_object('account_id', pg_temp.acc('1-1001'), 'credit', 30000)));
select pg_temp.check((select amount = 120000 from public.report_ppn(date '2018-06-01', date '2018-06-30') where line = 'keluaran')
                 and (select amount = 30000 from public.report_ppn(date '2018-06-01', date '2018-06-30') where line = 'masukan')
                 and (select amount = 90000 from public.report_ppn(date '2018-06-01', date '2018-06-30') where line = 'selisih'), 'laporan PPN: Keluaran 120.000, Masukan 30.000, kurang bayar 90.000');
select public.post_tax_payment(jsonb_build_object('tax_type', 'ppn', 'amount', 90000, 'pay_date', '2018-06-30', 'cash_bank_account_id', pg_temp.id('kas')));
select pg_temp.check((select amount = 90000 from public.report_ppn(date '2018-06-01', date '2018-06-30') where line = 'disetor')
                 and (select amount = 120000 from public.report_ppn(date '2018-06-01', date '2018-06-30') where line = 'keluaran'), 'setor PPN tercatat; PPN Keluaran periode tidak berubah oleh setoran');
select pg_temp.check((select count(*) >= 0 from public.report_ppn_documents(date '2018-06-01', date '2018-06-30')), 'daftar dokumen PPN bisa dipanggil');

reset role;
-- Notifikasi dari pemicu (pusat notifikasi)
reset role;
select pg_temp.check(exists (select 1 from public.notifications where kind = 'tax_paid'), 'notifikasi tax_paid tercatat oleh pemicu');

rollback;
\o
\echo SEMUA TES PAJAK LULUS
