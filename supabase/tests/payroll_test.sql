-- Tes penggajian & kasbon (migration 20261103000019).
-- Berjalan dalam satu transaksi dan di-ROLLBACK. Data uji bertanggal 2020 agar tidak tercampur data nyata.

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
  for r in select * from (values ('u_owner', 'owner', 'T-OWN'), ('u_admin', 'admin', 'T-ADM'), ('u_mech', 'mechanic', 'T-MK1')) x(k, role_code, code) loop
    insert into public.employees (branch_id, code, full_name) values (b, r.code, 'Uji ' || r.code) returning id into e;
    insert into t_ids values ('e_' || substr(r.k, 3), e);
    insert into public.profiles (id, branch_id, employee_id, email) values ((select v from t_ids where k = r.k), b, e, r.k || '@test.local');
    insert into public.employee_roles (branch_id, employee_id, role_id) values (b, e, (select id from public.roles where code = r.role_code));
  end loop;
  -- Mekanik kedua tanpa akun login (gaji harian)
  insert into public.employees (branch_id, code, full_name) values (b, 'T-MK2', 'Uji T-MK2') returning id into e;
  insert into t_ids values ('e_mech2', e);
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
create or replace function pg_temp.slip(p_period text, p_emp text) returns uuid language sql as $$
  select id from public.payslips where period_id = pg_temp.id(p_period) and employee_id = pg_temp.id(p_emp) $$;

insert into t_ids select 'kas', id from public.cash_bank_accounts where name = 'Kas Laci';

-- Komisi yang sudah diakui (disisipkan langsung; relasi ke penjualan dilewati untuk tes ini)
-- Lepas relasi ke penjualan hanya selama tes (DDL ikut di-rollback)
alter table public.commissions drop constraint commissions_sale_id_fkey, drop constraint commissions_sale_item_id_fkey, drop constraint commissions_work_order_id_fkey;
insert into public.commissions (branch_id, sale_id, sale_item_id, work_order_id, employee_id, base_amount, commission_type, commission_value, share_percent, amount, status, recognized_at)
select b.id, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), pg_temp.id('e_mech'), x.base, 'percent', 10, 100, x.amt, x.st::public.commission_status, x.at::timestamptz
from public.branches b, (values (1000000, 100000, 'recognized', '2020-06-20 10:00+07'), (500000, 50000, 'recognized', '2020-06-25 10:00+07'),
                                (700000, 70000, 'pending', null), (300000, 30000, 'recognized', '2020-07-05 10:00+07')) x(base, amt, st, at)
where b.code = 'PST';

-- ---------------------------------------------------------------------------
-- Akses
-- ---------------------------------------------------------------------------
select pg_temp.login('u_admin');
select pg_temp.fails(format($q$ select public.save_pay_profile('%s', '{"pay_type": "monthly", "base_salary": 1000}') $q$, pg_temp.id('e_mech')), 'tidak punya izin', 'admin: tidak bisa mengatur profil gaji');
select pg_temp.fails($q$ select public.create_payroll_period('{"start_date": "2020-06-01", "end_date": "2020-06-30"}') $q$, 'tidak punya izin', 'admin: tidak bisa membuat periode gaji');
select pg_temp.check((select count(*) = 0 from public.employee_pay_profiles) and (select count(*) = 0 from public.payslips), 'admin: tidak melihat gaji');

-- ---------------------------------------------------------------------------
-- Profil gaji & kasbon
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('u_owner');
select pg_temp.fails(format($q$ select public.save_pay_profile('%s', '{"pay_type": "monthly", "base_salary": -1}') $q$, pg_temp.id('e_mech')), 'tidak boleh minus', 'gaji pokok minus ditolak');
select pg_temp.fails(format($q$ select public.save_pay_profile('%s', '{"pay_type": "monthly", "base_salary": 1000, "fixed_allowances": [{"name": "", "amount": 10}]}') $q$, pg_temp.id('e_mech')), 'Tunjangan', 'tunjangan tanpa nama ditolak');
select public.save_pay_profile(pg_temp.id('e_mech'), '{"pay_type": "monthly", "base_salary": 5000000, "fixed_allowances": [{"name": "Makan", "amount": 300000}, {"name": "Transport", "amount": 200000}]}');
select public.save_pay_profile(pg_temp.id('e_mech2'), '{"pay_type": "daily", "base_salary": 150000}');
select pg_temp.check((select count(*) = 2 from public.employee_pay_profiles where employee_id in (pg_temp.id('e_mech'), pg_temp.id('e_mech2'))), 'profil gaji: bulanan dan harian tersimpan');

select pg_temp.fails(format($q$ select public.create_employee_loan('{"employee_id": "%s", "principal": 100000, "installment_amount": 200000, "cash_bank_account_id": "%s"}') $q$, pg_temp.id('e_mech'), pg_temp.id('kas')),
  'Cicilan', 'cicilan melebihi kasbon ditolak');
insert into t_ids select 'loan', public.create_employee_loan(jsonb_build_object('employee_id', pg_temp.id('e_mech'), 'loan_date', '2020-05-10', 'principal', 1000000,
  'installment_amount', 400000, 'cash_bank_account_id', pg_temp.id('kas'), 'note', 'Kasbon motor'));
select pg_temp.check((select balance = 1000000 and status = 'active' and loan_no like 'KB-%' from public.v_employee_loans where id = pg_temp.id('loan')), 'kasbon: saldo 1.000.000, nomor KB');
select pg_temp.check((select count(*) = 2 from public.journal_lines l join public.journal_entries e on e.id = l.entry_id where e.source_type = 'employee_loan' and e.source_id = pg_temp.id('loan')), 'kasbon: jurnal Dr Kasbon Karyawan, Cr Kas');

-- ---------------------------------------------------------------------------
-- Periode gaji Juni 2020
-- ---------------------------------------------------------------------------
insert into t_ids select 'per', public.create_payroll_period('{"period_type": "monthly", "start_date": "2020-06-01", "end_date": "2020-06-30"}');
select pg_temp.check((select count(*) = 2 from public.payslips where period_id = pg_temp.id('per')), 'periode: slip dibuat untuk dua karyawan berprofil');
select pg_temp.check((select base_amount = 5000000 and allowance_amount = 500000 and commission_amount = 150000 and loan_deduction = 400000
                             and gross_amount = 5650000 and net_amount = 5250000 and slip_no like 'SG-%'
                      from public.payslips where id = pg_temp.slip('per', 'e_mech')),
  'slip bulanan: pokok 5.000.000 + tunjangan 500.000 + komisi 150.000, kasbon 400.000, bersih 5.250.000');
select pg_temp.check((select count(*) = 2 and bool_and(payslip_id = pg_temp.slip('per', 'e_mech')) from public.commissions
                      where employee_id = pg_temp.id('e_mech') and amount in (100000, 50000)), 'komisi diakui sampai akhir periode masuk slip');
select pg_temp.check((select count(*) = 0 from public.commissions where payslip_id is not null and amount in (70000, 30000)), 'komisi tertunda dan setelah periode tidak ikut');
select pg_temp.fails($q$ select public.create_payroll_period('{"period_type": "monthly", "start_date": "2020-06-15", "end_date": "2020-07-14"}') $q$, 'tumpang tindih', 'periode tumpang tindih ditolak');

select public.update_payslip(pg_temp.slip('per', 'e_mech2'), '{"days_worked": 20}');
select pg_temp.check((select base_amount = 3000000 and net_amount = 3000000 from public.payslips where id = pg_temp.slip('per', 'e_mech2')), 'slip harian: 20 hari x 150.000 = 3.000.000');
select public.update_payslip(pg_temp.slip('per', 'e_mech'), '{"overtime_hours": 5, "overtime_rate": 20000, "bonus_amount": 100000, "other_deduction": 150000, "other_deduction_note": "BPJS"}');
select pg_temp.check((select overtime_amount = 100000 and gross_amount = 5850000 and net_amount = 5300000 and other_deduction_note = 'BPJS' from public.payslips where id = pg_temp.slip('per', 'e_mech')),
  'lembur 5 jam x 20.000, bonus 100.000, potongan BPJS 150.000: bersih 5.300.000');
select pg_temp.fails(format($q$ select public.update_payslip('%s', '{"loan_deduction": 2000000}') $q$, pg_temp.slip('per', 'e_mech')), 'melebihi sisa kasbon', 'potongan kasbon melebihi sisa ditolak');
select pg_temp.fails(format($q$ select public.update_payslip('%s', '{"other_deduction": 99000000}') $q$, pg_temp.slip('per', 'e_mech')), 'melebihi gaji kotor', 'potongan melebihi gaji kotor ditolak');

-- ---------------------------------------------------------------------------
-- Alur: draft -> review -> disetujui -> dibayar
-- ---------------------------------------------------------------------------
select pg_temp.fails(format($q$ select public.pay_payroll('%s', '%s', date '2020-07-01') $q$, pg_temp.id('per'), pg_temp.id('kas')), 'disetujui', 'bayar sebelum disetujui ditolak');
select pg_temp.fails(format($q$ select public.approve_payroll('%s') $q$, pg_temp.id('per')), 'Review', 'setujui sebelum review ditolak');
select public.submit_payroll(pg_temp.id('per'));
select pg_temp.fails(format($q$ select public.update_payslip('%s', '{"bonus_amount": 1}') $q$, pg_temp.slip('per', 'e_mech')), 'Draft', 'slip tidak bisa diubah setelah review');
select public.reopen_payroll(pg_temp.id('per'));
select public.update_payslip(pg_temp.slip('per', 'e_mech'), '{"notes": "Dikembalikan ke draft lalu diperbarui"}');
select public.submit_payroll(pg_temp.id('per'));
reset role;
select pg_temp.login('u_admin');
select pg_temp.fails(format($q$ select public.approve_payroll('%s') $q$, pg_temp.id('per')), 'tidak punya izin', 'admin: tidak bisa menyetujui gaji');
reset role;
select pg_temp.login('u_mech');
select pg_temp.check((select count(*) = 0 from public.payslips), 'mekanik: slip belum terlihat sebelum disetujui');
reset role;
select pg_temp.login('u_owner');
select public.approve_payroll(pg_temp.id('per'));
select pg_temp.check((select status = 'approved' and approved_by is not null from public.payroll_periods where id = pg_temp.id('per')), 'Owner menyetujui gaji');
reset role;
select pg_temp.login('u_mech');
select pg_temp.check((select count(*) = 1 and bool_and(employee_id = pg_temp.id('e_mech')) from public.payslips), 'mekanik: hanya melihat slip miliknya setelah disetujui');
select pg_temp.check((select count(*) = 1 from public.payroll_periods) and (select count(*) = 1 from public.employee_loans), 'mekanik: melihat periode dan kasbon miliknya');
select pg_temp.fails(format($q$ select public.pay_payroll('%s', '%s') $q$, pg_temp.id('per'), pg_temp.id('kas')), 'tidak punya izin', 'mekanik: tidak bisa membayar gaji');
reset role;
select pg_temp.login('u_owner');
select pg_temp.fails(format($q$ select public.pay_payroll('%s', '%s', date '2099-01-01') $q$, pg_temp.id('per'), pg_temp.id('kas')), 'masa depan', 'tanggal bayar masa depan ditolak');
select public.pay_payroll(pg_temp.id('per'), pg_temp.id('kas'), date '2020-07-01');
select pg_temp.check((select status = 'paid' and paid_date = date '2020-07-01' and journal_entry_id is not null from public.payroll_periods where id = pg_temp.id('per')), 'gaji dibayar: status paid + jurnal');
select pg_temp.check((select amount = 8700000 from public.report_profit_loss(date '2020-07-01', date '2020-07-31') where code = '6-1001')
                 and (select amount = 150000 from public.report_profit_loss(date '2020-07-01', date '2020-07-31') where code = '6-1100'), 'jurnal: Beban Gaji 8.700.000 dan Beban Komisi 150.000');
select pg_temp.check((select sum(l.debit) = 8850000 and sum(l.debit) = sum(l.credit)
                             and sum(l.credit) filter (where a.system_key = 'employee_loan') = 400000
                             and sum(l.credit) filter (where a.system_key = 'payroll_payable') = 150000
                      from public.journal_lines l join public.accounts a on a.id = l.account_id
                      join public.payroll_periods p on p.journal_entry_id = l.entry_id where p.id = pg_temp.id('per')),
  'jurnal gaji seimbang: kas 8.300.000, kasbon 400.000, hutang potongan 150.000');
select pg_temp.check((select balance = 600000 from public.v_employee_loans where id = pg_temp.id('loan')), 'kasbon berkurang 400.000 lewat potongan gaji (sisa 600.000)');
select pg_temp.check((select count(*) = 2 and bool_and(status = 'paid') from public.commissions where payslip_id = pg_temp.slip('per', 'e_mech')), 'komisi berstatus paid');
select pg_temp.fails(format($q$ select public.pay_payroll('%s', '%s') $q$, pg_temp.id('per'), pg_temp.id('kas')), 'disetujui', 'bayar dua kali ditolak');

-- Periode Juli: komisi setelah Juni masuk, lalu dibatalkan saat draft
insert into t_ids select 'per_jul', public.create_payroll_period('{"period_type": "monthly", "start_date": "2020-07-01", "end_date": "2020-07-31"}');
select pg_temp.check((select commission_amount = 30000 and loan_deduction = 400000 from public.payslips where id = pg_temp.slip('per_jul', 'e_mech')), 'periode Juli: komisi 30.000 masuk, cicilan kasbon disarankan 400.000');
select public.void_payroll(pg_temp.id('per_jul'), 'Dibuat untuk uji');
select pg_temp.check((select payslip_id is null from public.commissions where amount = 30000 and employee_id = pg_temp.id('e_mech')), 'batal draft: komisi dilepas dari slip');

-- ---------------------------------------------------------------------------
-- Batal gaji yang sudah dibayar
-- ---------------------------------------------------------------------------
select pg_temp.fails(format($q$ select public.void_payroll('%s', '') $q$, pg_temp.id('per')), 'Alasan', 'batal gaji wajib alasan');
select public.void_payroll(pg_temp.id('per'), 'Salah hitung lembur');
select pg_temp.check((select status = 'void' from public.payroll_periods where id = pg_temp.id('per')), 'gaji dibatalkan');
select pg_temp.check((select count(*) = 1 from public.journal_entries where source_type = 'payroll' and source_id = pg_temp.id('per') and reversal_of is not null), 'batal gaji: jurnal dibalik');
select pg_temp.check((select balance = 1000000 and status = 'active' from public.v_employee_loans where id = pg_temp.id('loan')), 'batal gaji: kasbon kembali 1.000.000');
select pg_temp.check((select count(*) = 2 and bool_and(status = 'recognized' and payslip_id is null) from public.commissions where employee_id = pg_temp.id('e_mech') and amount in (100000, 50000)), 'batal gaji: komisi bisa dibayar lagi');
select pg_temp.fails(format($q$ select public.void_payroll('%s', 'dobel') $q$, pg_temp.id('per')), 'sudah dibatalkan', 'batal gaji dua kali ditolak');

-- ---------------------------------------------------------------------------
-- Kasbon manual & mingguan
-- ---------------------------------------------------------------------------
select pg_temp.fails(format($q$ select public.repay_employee_loan('%s', '{"amount": 2000000, "cash_bank_account_id": "%s"}') $q$, pg_temp.id('loan'), pg_temp.id('kas')), 'melebihi sisa', 'pelunasan melebihi sisa ditolak');
select public.repay_employee_loan(pg_temp.id('loan'), jsonb_build_object('amount', 100000, 'pay_date', '2020-08-01', 'cash_bank_account_id', pg_temp.id('kas')));
select pg_temp.check((select balance = 900000 from public.v_employee_loans where id = pg_temp.id('loan')), 'pelunasan tunai kasbon: sisa 900.000');
select pg_temp.fails(format($q$ select public.void_employee_loan('%s', 'salah') $q$, pg_temp.id('loan')), 'sudah dicicil', 'kasbon yang sudah dicicil tidak bisa dibatalkan');
insert into t_ids select 'loan2', public.create_employee_loan(jsonb_build_object('employee_id', pg_temp.id('e_mech2'), 'principal', 50000, 'installment_amount', 50000, 'cash_bank_account_id', pg_temp.id('kas')));
select public.void_employee_loan(pg_temp.id('loan2'), 'Salah orang');
select pg_temp.check((select status = 'void' from public.employee_loans where id = pg_temp.id('loan2')), 'kasbon belum dicicil bisa dibatalkan (jurnal dibalik)');

insert into t_ids select 'per_w', public.create_payroll_period('{"period_type": "weekly", "start_date": "2020-08-03", "end_date": "2020-08-09"}');
select pg_temp.check((select base_amount = 1166666.67 and allowance_amount = 116666.67 from public.payslips where id = pg_temp.slip('per_w', 'e_mech')), 'periode mingguan: gaji bulanan dan tunjangan dikali 7/30');

reset role;
rollback;
\o
\echo SEMUA TES PENGGAJIAN LULUS
