-- =============================================================================
-- Penggajian sederhana & kasbon (PRD §10.3-10.4, §11.3)
-- Profil gaji per karyawan -> periode gaji (bulanan/mingguan) -> slip per karyawan.
-- Alur: draft -> review -> disetujui -> dibayar. Jurnal dibuat saat dibayar:
--   Dr Beban Gaji, Dr Beban Komisi | Cr Kas/Bank (gaji bersih), Cr Kasbon Karyawan (potongan kasbon),
--   Cr Hutang Gaji/Potongan (potongan lain: BPJS, PPh 21, denda).
-- Komisi yang sudah diakui (invoice lunas) masuk slip otomatis; status komisi menjadi 'paid' saat gaji dibayar.
-- =============================================================================

alter type public.commission_status add value if not exists 'paid';

create type public.pay_type as enum ('monthly', 'daily');
create type public.payroll_status as enum ('draft', 'review', 'approved', 'paid', 'void');

-- Profil gaji: gaji pokok bulanan atau tarif harian + tunjangan tetap [{name, amount}]
create table public.employee_pay_profiles (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid not null references public.branches(id),
  employee_id      uuid not null unique references public.employees(id),
  pay_type         public.pay_type not null default 'monthly',
  base_salary      numeric(18,2) not null default 0 check (base_salary >= 0),   -- bulanan, atau tarif per hari
  fixed_allowances jsonb not null default '[]',
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid(),
  updated_at       timestamptz not null default now()
);

create table public.payroll_periods (
  id                   uuid primary key default gen_random_uuid(),
  branch_id            uuid not null references public.branches(id),
  period_no            text not null,
  label                text not null,
  period_type          text not null check (period_type in ('monthly', 'weekly')),
  start_date           date not null,
  end_date             date not null,
  status               public.payroll_status not null default 'draft',
  approved_by          uuid references public.employees(id),
  approved_at          timestamptz,
  paid_date            date,
  cash_bank_account_id uuid references public.cash_bank_accounts(id),
  journal_entry_id     uuid references public.journal_entries(id),
  void_reason          text,
  created_at           timestamptz not null default now(),
  created_by           uuid default auth.uid(),
  updated_at           timestamptz not null default now(),
  unique (branch_id, period_no),
  check (end_date >= start_date)
);

create table public.payslips (
  id                   uuid primary key default gen_random_uuid(),
  branch_id            uuid not null references public.branches(id),
  period_id            uuid not null references public.payroll_periods(id),
  employee_id          uuid not null references public.employees(id),
  slip_no              text not null,
  pay_type             public.pay_type not null,
  base_salary          numeric(18,2) not null,            -- salinan profil: bulanan atau tarif harian
  days_worked          numeric(6,2) not null default 0 check (days_worked >= 0),
  base_amount          numeric(18,2) not null default 0,
  allowance_details    jsonb not null default '[]',
  allowance_amount     numeric(18,2) not null default 0,
  overtime_hours       numeric(8,2) not null default 0 check (overtime_hours >= 0),
  overtime_rate        numeric(18,2) not null default 0 check (overtime_rate >= 0),
  overtime_amount      numeric(18,2) not null default 0,
  commission_amount    numeric(18,2) not null default 0,
  bonus_amount         numeric(18,2) not null default 0 check (bonus_amount >= 0),
  loan_deduction       numeric(18,2) not null default 0 check (loan_deduction >= 0),
  other_deduction      numeric(18,2) not null default 0 check (other_deduction >= 0),
  other_deduction_note text,
  gross_amount         numeric(18,2) not null default 0,
  net_amount           numeric(18,2) not null default 0 check (net_amount >= 0),
  notes                text,
  created_at           timestamptz not null default now(),
  created_by           uuid default auth.uid(),
  updated_at           timestamptz not null default now(),
  unique (period_id, employee_id),
  unique (branch_id, slip_no)
);
create index idx_payslips_employee on public.payslips (employee_id);

alter table public.commissions add column payslip_id uuid references public.payslips(id);
create index idx_commissions_payslip on public.commissions (payslip_id);

-- Kasbon karyawan dan cicilannya
create table public.employee_loans (
  id                   uuid primary key default gen_random_uuid(),
  branch_id            uuid not null references public.branches(id),
  loan_no              text not null,
  employee_id          uuid not null references public.employees(id),
  loan_date            date not null,
  principal            numeric(18,2) not null check (principal > 0),
  installment_amount   numeric(18,2) not null check (installment_amount > 0),   -- cicilan per periode gaji
  cash_bank_account_id uuid not null references public.cash_bank_accounts(id),
  note                 text,
  status               text not null default 'active' check (status in ('active', 'paid_off', 'void')),
  void_reason          text,
  created_at           timestamptz not null default now(),
  created_by           uuid default auth.uid(),
  updated_at           timestamptz not null default now(),
  unique (branch_id, loan_no),
  check (installment_amount <= principal)
);
create index idx_employee_loans_employee on public.employee_loans (employee_id);

create table public.employee_loan_payments (
  id                   uuid primary key default gen_random_uuid(),
  branch_id            uuid not null references public.branches(id),
  loan_id              uuid not null references public.employee_loans(id),
  amount               numeric(18,2) not null check (amount > 0),
  paid_date            date not null,
  kind                 text not null check (kind in ('payroll', 'manual')),
  payslip_id           uuid references public.payslips(id),
  cash_bank_account_id uuid references public.cash_bank_accounts(id),
  status               public.doc_status not null default 'posted',
  void_reason          text,
  created_at           timestamptz not null default now(),
  created_by           uuid default auth.uid(),
  updated_at           timestamptz not null default now()
);
create index idx_loan_payments_loan on public.employee_loan_payments (loan_id);

do $$
declare
  t text;
begin
  foreach t in array array['employee_pay_profiles', 'payroll_periods', 'payslips', 'employee_loans', 'employee_loan_payments'] loop
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$I
                    for each row execute function app.set_updated_at()', t);
    execute format('create trigger trg_audit after insert or update or delete on public.%I
                    for each row execute function app.audit_row_change()', t);
  end loop;
  foreach t in array array['employee_pay_profiles', 'payroll_periods', 'payslips', 'employee_loans', 'employee_loan_payments'] loop
    execute format('create trigger trg_no_delete before delete on public.%I
                    for each row execute function app.prevent_modification()', t);
  end loop;
end $$;

-- =============================================================================
-- Helper
-- =============================================================================
create or replace function app.loan_balance(p_loan_id uuid)
returns numeric
language sql stable security definer
set search_path = ''
as $$
  select l.principal - coalesce((select sum(p.amount) from public.employee_loan_payments p where p.loan_id = l.id and p.status = 'posted'), 0)
  from public.employee_loans l where l.id = p_loan_id
$$;

-- Total sisa kasbon aktif karyawan dan cicilan yang disarankan untuk satu periode
create or replace function app.employee_loan_totals(p_employee_id uuid)
returns table (balance numeric, suggested numeric)
language sql stable security definer
set search_path = ''
as $$
  select coalesce(sum(b), 0)::numeric, coalesce(sum(least(l.installment_amount, b)), 0)::numeric
  from public.employee_loans l, lateral (select app.loan_balance(l.id) as b) x
  where l.employee_id = p_employee_id and l.status = 'active' and b > 0
$$;

-- Hitung ulang slip dari komponennya
create or replace function app.recalc_payslip(p_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  s       public.payslips%rowtype;
  per     public.payroll_periods%rowtype;
  v_base  numeric(18,2);
  v_allow numeric(18,2);
  v_ot    numeric(18,2);
  v_comm  numeric(18,2);
  v_gross numeric(18,2);
  v_net   numeric(18,2);
begin
  select * into s from public.payslips where id = p_id for update;
  select * into per from public.payroll_periods where id = s.period_id;
  v_base := case when s.pay_type = 'daily' then round(s.base_salary * s.days_worked, 2)
                 when per.period_type = 'weekly' then round(s.base_salary * 7 / 30, 2)
                 else s.base_salary end;
  v_allow := coalesce((select sum((x ->> 'amount')::numeric) from jsonb_array_elements(s.allowance_details) x), 0);
  v_ot := round(s.overtime_hours * s.overtime_rate, 2);
  select coalesce(sum(c.amount), 0) into v_comm from public.commissions c where c.payslip_id = p_id and c.status in ('recognized', 'paid');
  v_gross := v_base + v_allow + v_ot + v_comm + s.bonus_amount;
  v_net := v_gross - s.loan_deduction - s.other_deduction;
  if v_net < 0 then raise exception 'Potongan melebihi gaji kotor %', s.slip_no using errcode = '23514'; end if;
  update public.payslips
     set base_amount = v_base, allowance_amount = v_allow, overtime_amount = v_ot, commission_amount = v_comm,
         gross_amount = v_gross, net_amount = v_net
   where id = p_id;
end;
$$;

-- Kunci periode gaji yang masih bisa diubah (draft)
create or replace function app.lock_draft_period(p_id uuid)
returns public.payroll_periods
language plpgsql security definer
set search_path = ''
as $$
declare
  v_per public.payroll_periods%rowtype;
begin
  select * into v_per from public.payroll_periods where id = p_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Periode gaji tidak ditemukan' using errcode = 'P0002'; end if;
  if v_per.status <> 'draft' then raise exception 'Hanya periode berstatus Draft yang bisa diubah' using errcode = '22023'; end if;
  return v_per;
end;
$$;

-- Akses baca slip & periode milik sendiri hanya setelah gaji disetujui (hindari rekursi RLS lewat fungsi definer)
create or replace function app.period_released(p_period_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.payroll_periods where id = p_period_id and status in ('approved', 'paid'))
$$;
create or replace function app.has_own_slip(p_period_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.payslips where period_id = p_period_id and employee_id = app.current_employee_id())
$$;
grant execute on function app.period_released(uuid), app.has_own_slip(uuid) to authenticated, service_role;

-- =============================================================================
-- Profil gaji. p_data: pay_type, base_salary, fixed_allowances [{name, amount}]
-- =============================================================================
create or replace function public.save_pay_profile(p_employee_id uuid, p_data jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_allow  jsonb := coalesce(p_data -> 'fixed_allowances', '[]');
  x        jsonb;
  v_id     uuid;
begin
  perform app.assert_permission('payroll', 'update');
  if not exists (select 1 from public.employees where id = p_employee_id and branch_id = v_branch) then
    raise exception 'Karyawan tidak ditemukan' using errcode = 'P0002';
  end if;
  if coalesce((p_data ->> 'base_salary')::numeric, -1) < 0 then raise exception 'Gaji pokok tidak boleh minus' using errcode = '22023'; end if;
  for x in select * from jsonb_array_elements(v_allow) loop
    if length(btrim(coalesce(x ->> 'name', ''))) < 2 or coalesce((x ->> 'amount')::numeric, -1) < 0 then
      raise exception 'Tunjangan harus punya nama dan jumlah tidak minus' using errcode = '22023';
    end if;
  end loop;
  insert into public.employee_pay_profiles (branch_id, employee_id, pay_type, base_salary, fixed_allowances)
  values (v_branch, p_employee_id, coalesce(nullif(p_data ->> 'pay_type', ''), 'monthly')::public.pay_type,
          round((p_data ->> 'base_salary')::numeric, 2), v_allow)
  on conflict (employee_id) do update
    set pay_type = excluded.pay_type, base_salary = excluded.base_salary, fixed_allowances = excluded.fixed_allowances
  returning id into v_id;
  return v_id;
end;
$$;

-- =============================================================================
-- Periode gaji. p_data: period_type (monthly|weekly), start_date, end_date, label?
-- Slip dibuat untuk semua karyawan aktif/cuti yang punya profil gaji.
-- =============================================================================
create or replace function public.create_payroll_period(p_data jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_type   text := coalesce(nullif(p_data ->> 'period_type', ''), 'monthly');
  v_start  date := (p_data ->> 'start_date')::date;
  v_end    date := (p_data ->> 'end_date')::date;
  v_factor numeric;
  v_id     uuid;
  v_slip   uuid;
  v_loans  record;
  r        record;
begin
  perform app.assert_permission('payroll', 'create');
  if v_type not in ('monthly', 'weekly') then raise exception 'Jenis periode tidak valid' using errcode = '22023'; end if;
  if v_start is null or v_end is null or v_end < v_start then raise exception 'Tanggal periode tidak valid' using errcode = '22023'; end if;
  if exists (select 1 from public.payroll_periods p where p.branch_id = v_branch and p.status <> 'void' and p.start_date <= v_end and p.end_date >= v_start) then
    raise exception 'Periode ini tumpang tindih dengan periode gaji lain' using errcode = '22023';
  end if;
  if not exists (select 1 from public.employee_pay_profiles pp join public.employees e on e.id = pp.employee_id
                 where pp.branch_id = v_branch and e.status <> 'inactive') then
    raise exception 'Belum ada karyawan dengan profil gaji' using errcode = '22023';
  end if;
  v_factor := case when v_type = 'weekly' then 7.0 / 30 else 1 end;

  insert into public.payroll_periods (branch_id, period_no, label, period_type, start_date, end_date)
  values (v_branch, app.next_document_number('PG', v_end, v_branch),
          coalesce(nullif(btrim(p_data ->> 'label'), ''), 'Gaji ' || to_char(v_start, 'DD/MM/YYYY') || ' s/d ' || to_char(v_end, 'DD/MM/YYYY')),
          v_type, v_start, v_end)
  returning id into v_id;

  for r in select pp.*, e.full_name from public.employee_pay_profiles pp join public.employees e on e.id = pp.employee_id
           where pp.branch_id = v_branch and e.status <> 'inactive' order by e.full_name loop
    select * into v_loans from app.employee_loan_totals(r.employee_id);
    insert into public.payslips (branch_id, period_id, employee_id, slip_no, pay_type, base_salary, allowance_details, loan_deduction)
    values (v_branch, v_id, r.employee_id, app.next_document_number('SG', v_end, v_branch), r.pay_type, r.base_salary,
            coalesce((select jsonb_agg(jsonb_build_object('name', x ->> 'name', 'amount', round((x ->> 'amount')::numeric * v_factor, 2)))
                      from jsonb_array_elements(r.fixed_allowances) x), '[]'),
            coalesce(v_loans.suggested, 0))
    returning id into v_slip;
    -- Komisi yang sudah diakui sampai akhir periode dan belum pernah dibayar
    update public.commissions set payslip_id = v_slip
     where employee_id = r.employee_id and status = 'recognized' and payslip_id is null
       and (recognized_at at time zone 'Asia/Jakarta')::date <= v_end;
    perform app.recalc_payslip(v_slip);
  end loop;
  return v_id;
end;
$$;

-- Input per slip selama Draft.
-- p_data: days_worked?, overtime_hours?, overtime_rate?, bonus_amount?, other_deduction?, other_deduction_note?, loan_deduction?, notes?
create or replace function public.update_payslip(p_id uuid, p_data jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  s        public.payslips%rowtype;
  v_loans  record;
  v_ded    numeric(18,2);
begin
  perform app.assert_permission('payroll', 'update');
  select * into s from public.payslips where id = p_id and branch_id = app.current_branch_id();
  if not found then raise exception 'Slip gaji tidak ditemukan' using errcode = 'P0002'; end if;
  perform app.lock_draft_period(s.period_id);

  select * into v_loans from app.employee_loan_totals(s.employee_id);
  v_ded := round(coalesce(nullif(p_data ->> 'loan_deduction', '')::numeric, s.loan_deduction), 2);
  if v_ded > coalesce(v_loans.balance, 0) then
    raise exception 'Potongan kasbon melebihi sisa kasbon (%)', coalesce(v_loans.balance, 0) using errcode = '23514';
  end if;

  update public.payslips
     set days_worked = coalesce(nullif(p_data ->> 'days_worked', '')::numeric, days_worked),
         overtime_hours = coalesce(nullif(p_data ->> 'overtime_hours', '')::numeric, overtime_hours),
         overtime_rate = coalesce(nullif(p_data ->> 'overtime_rate', '')::numeric, overtime_rate),
         bonus_amount = round(coalesce(nullif(p_data ->> 'bonus_amount', '')::numeric, bonus_amount), 2),
         other_deduction = round(coalesce(nullif(p_data ->> 'other_deduction', '')::numeric, other_deduction), 2),
         other_deduction_note = case when p_data ? 'other_deduction_note' then nullif(btrim(p_data ->> 'other_deduction_note'), '') else other_deduction_note end,
         loan_deduction = v_ded,
         notes = case when p_data ? 'notes' then nullif(btrim(p_data ->> 'notes'), '') else notes end
   where id = p_id;
  perform app.recalc_payslip(p_id);
end;
$$;

-- Alur status
create or replace function public.submit_payroll(p_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform app.assert_permission('payroll', 'update');
  perform app.lock_draft_period(p_id);
  update public.payroll_periods set status = 'review' where id = p_id;
end;
$$;

create or replace function public.reopen_payroll(p_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_per public.payroll_periods%rowtype;
begin
  perform app.assert_permission('payroll', 'update');
  select * into v_per from public.payroll_periods where id = p_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Periode gaji tidak ditemukan' using errcode = 'P0002'; end if;
  if v_per.status not in ('review', 'approved') then raise exception 'Hanya periode Review atau Disetujui yang bisa dikembalikan ke Draft' using errcode = '22023'; end if;
  update public.payroll_periods set status = 'draft', approved_by = null, approved_at = null where id = p_id;
end;
$$;

create or replace function public.approve_payroll(p_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_per public.payroll_periods%rowtype;
begin
  perform app.assert_permission('payroll', 'approve');
  select * into v_per from public.payroll_periods where id = p_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Periode gaji tidak ditemukan' using errcode = 'P0002'; end if;
  if v_per.status <> 'review' then raise exception 'Hanya periode berstatus Review yang bisa disetujui' using errcode = '22023'; end if;
  update public.payroll_periods set status = 'approved', approved_by = app.current_employee_id(), approved_at = now() where id = p_id;
end;
$$;

-- Bayar gaji: jurnal beban gaji & komisi, potong kasbon, komisi jadi 'paid'
create or replace function public.pay_payroll(p_id uuid, p_cash_bank_account_id uuid, p_date date default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_per    public.payroll_periods%rowtype;
  v_date   date := coalesce(p_date, app.today_wib());
  v_cash   uuid;
  v_salary numeric(18,2);
  v_comm   numeric(18,2);
  v_net    numeric(18,2);
  v_loan   numeric(18,2);
  v_other  numeric(18,2);
  v_je     uuid;
  s        public.payslips%rowtype;
  l        record;
  v_left   numeric(18,2);
  v_take   numeric(18,2);
begin
  perform app.assert_permission('payroll', 'update');
  select * into v_per from public.payroll_periods where id = p_id and branch_id = v_branch for update;
  if not found then raise exception 'Periode gaji tidak ditemukan' using errcode = 'P0002'; end if;
  if v_per.status <> 'approved' then raise exception 'Gaji hanya bisa dibayar setelah disetujui Owner' using errcode = '22023'; end if;
  if v_date > app.today_wib() then raise exception 'Tanggal bayar tidak boleh di masa depan' using errcode = '22023'; end if;
  select account_id into v_cash from public.cash_bank_accounts where id = p_cash_bank_account_id and branch_id = v_branch and is_active;
  if v_cash is null then raise exception 'Pilih akun kas/bank yang aktif' using errcode = '22023'; end if;

  select coalesce(sum(base_amount + allowance_amount + overtime_amount + bonus_amount), 0), coalesce(sum(commission_amount), 0),
         coalesce(sum(net_amount), 0), coalesce(sum(loan_deduction), 0), coalesce(sum(other_deduction), 0)
    into v_salary, v_comm, v_net, v_loan, v_other from public.payslips where period_id = p_id;
  if v_salary + v_comm = 0 then raise exception 'Total gaji nol; tidak ada yang dibayar' using errcode = '22023'; end if;

  -- Potongan kasbon dialokasikan ke kasbon tertua lebih dulu
  for s in select * from public.payslips where period_id = p_id and loan_deduction > 0 loop
    v_left := s.loan_deduction;
    for l in select ln.id from public.employee_loans ln where ln.employee_id = s.employee_id and ln.status = 'active' order by ln.loan_date, ln.created_at loop
      exit when v_left <= 0;
      v_take := least(v_left, app.loan_balance(l.id));
      if v_take > 0 then
        insert into public.employee_loan_payments (branch_id, loan_id, amount, paid_date, kind, payslip_id)
        values (v_branch, l.id, v_take, v_date, 'payroll', s.id);
        v_left := v_left - v_take;
        if app.loan_balance(l.id) <= 0 then update public.employee_loans set status = 'paid_off' where id = l.id; end if;
      end if;
    end loop;
    if v_left > 0 then raise exception 'Potongan kasbon % melebihi sisa kasbon karyawan', s.slip_no using errcode = '23514'; end if;
  end loop;

  update public.commissions set status = 'paid' where payslip_id in (select id from public.payslips where period_id = p_id) and status = 'recognized';

  v_je := app.post_journal(v_date, 'payroll', p_id, 'Gaji ' || v_per.label,
    jsonb_build_array(jsonb_build_object('account', 'salary_expense', 'debit', v_salary),
                      jsonb_build_object('account', 'commission_expense', 'debit', v_comm),
                      jsonb_build_object('account_id', v_cash, 'credit', v_net),
                      jsonb_build_object('account', 'employee_loan', 'credit', v_loan),
                      jsonb_build_object('account', 'payroll_payable', 'credit', v_other)));
  update public.payroll_periods
     set status = 'paid', paid_date = v_date, cash_bank_account_id = p_cash_bank_account_id, journal_entry_id = v_je
   where id = p_id;
end;
$$;

-- Batalkan periode. Yang sudah dibayar: jurnal dibalik, cicilan kasbon dibatalkan, komisi kembali bisa dibayar.
create or replace function public.void_payroll(p_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_per public.payroll_periods%rowtype;
begin
  perform app.assert_permission('payroll', 'void');
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Alasan pembatalan wajib diisi' using errcode = '22023'; end if;
  select * into v_per from public.payroll_periods where id = p_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Periode gaji tidak ditemukan' using errcode = 'P0002'; end if;
  if v_per.status = 'void' then raise exception 'Periode sudah dibatalkan' using errcode = '22023'; end if;

  if v_per.status = 'paid' then
    perform app.reverse_journals('payroll', p_id, app.today_wib(), 'Batal gaji ' || v_per.label || ': ' || btrim(p_reason));
    update public.employee_loan_payments set status = 'void', void_reason = 'Gaji dibatalkan'
     where payslip_id in (select id from public.payslips where period_id = p_id) and status = 'posted';
    update public.employee_loans ln set status = 'active'
     where ln.status = 'paid_off' and app.loan_balance(ln.id) > 0;
    update public.commissions set status = 'recognized' where payslip_id in (select id from public.payslips where period_id = p_id) and status = 'paid';
  end if;
  -- Komisi dilepas dari slip agar bisa masuk periode lain
  update public.commissions set payslip_id = null where payslip_id in (select id from public.payslips where period_id = p_id);
  update public.payroll_periods set status = 'void', void_reason = btrim(p_reason) where id = p_id;
end;
$$;

-- =============================================================================
-- Kasbon. p_data: employee_id, loan_date?, principal, installment_amount, cash_bank_account_id, note?
-- Pencairan: Dr Kasbon Karyawan, Cr Kas/Bank.
-- =============================================================================
create or replace function public.create_employee_loan(p_data jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_date   date := coalesce(nullif(p_data ->> 'loan_date', '')::date, app.today_wib());
  v_amount numeric(18,2) := round(coalesce(nullif(p_data ->> 'principal', '')::numeric, 0), 2);
  v_inst   numeric(18,2) := round(coalesce(nullif(p_data ->> 'installment_amount', '')::numeric, 0), 2);
  v_cash   uuid;
  v_id     uuid;
  v_no     text;
begin
  perform app.assert_permission('payroll', 'create');
  if v_amount <= 0 then raise exception 'Jumlah kasbon harus lebih dari nol' using errcode = '22023'; end if;
  if v_inst <= 0 or v_inst > v_amount then raise exception 'Cicilan harus lebih dari nol dan tidak melebihi kasbon' using errcode = '22023'; end if;
  if v_date > app.today_wib() then raise exception 'Tanggal tidak boleh di masa depan' using errcode = '22023'; end if;
  if not exists (select 1 from public.employees where id = (p_data ->> 'employee_id')::uuid and branch_id = v_branch and status <> 'inactive') then
    raise exception 'Karyawan tidak ditemukan atau nonaktif' using errcode = '22023';
  end if;
  select account_id into v_cash from public.cash_bank_accounts where id = (p_data ->> 'cash_bank_account_id')::uuid and branch_id = v_branch and is_active;
  if v_cash is null then raise exception 'Pilih akun kas/bank yang aktif' using errcode = '22023'; end if;

  v_no := app.next_document_number('KB', v_date, v_branch);
  insert into public.employee_loans (branch_id, loan_no, employee_id, loan_date, principal, installment_amount, cash_bank_account_id, note)
  values (v_branch, v_no, (p_data ->> 'employee_id')::uuid, v_date, v_amount, v_inst, (p_data ->> 'cash_bank_account_id')::uuid, nullif(btrim(p_data ->> 'note'), ''))
  returning id into v_id;
  perform app.post_journal(v_date, 'employee_loan', v_id, 'Kasbon ' || v_no,
    jsonb_build_array(jsonb_build_object('account', 'employee_loan', 'debit', v_amount), jsonb_build_object('account_id', v_cash, 'credit', v_amount)));
  return v_id;
end;
$$;

-- Bayar kasbon tunai di luar potongan gaji. p_data: amount, pay_date?, cash_bank_account_id
create or replace function public.repay_employee_loan(p_loan_id uuid, p_data jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_loan   public.employee_loans%rowtype;
  v_amount numeric(18,2) := round(coalesce(nullif(p_data ->> 'amount', '')::numeric, 0), 2);
  v_date   date := coalesce(nullif(p_data ->> 'pay_date', '')::date, app.today_wib());
  v_cash   uuid;
  v_id     uuid;
begin
  perform app.assert_permission('payroll', 'create');
  select * into v_loan from public.employee_loans where id = p_loan_id and branch_id = v_branch for update;
  if not found then raise exception 'Kasbon tidak ditemukan' using errcode = 'P0002'; end if;
  if v_loan.status <> 'active' then raise exception 'Kasbon tidak aktif' using errcode = '22023'; end if;
  if v_amount <= 0 then raise exception 'Jumlah harus lebih dari nol' using errcode = '22023'; end if;
  if v_amount > app.loan_balance(p_loan_id) then raise exception 'Jumlah melebihi sisa kasbon (%)', app.loan_balance(p_loan_id) using errcode = '23514'; end if;
  if v_date > app.today_wib() then raise exception 'Tanggal tidak boleh di masa depan' using errcode = '22023'; end if;
  select account_id into v_cash from public.cash_bank_accounts where id = (p_data ->> 'cash_bank_account_id')::uuid and branch_id = v_branch and is_active;
  if v_cash is null then raise exception 'Pilih akun kas/bank yang aktif' using errcode = '22023'; end if;

  insert into public.employee_loan_payments (branch_id, loan_id, amount, paid_date, kind, cash_bank_account_id)
  values (v_branch, p_loan_id, v_amount, v_date, 'manual', (p_data ->> 'cash_bank_account_id')::uuid) returning id into v_id;
  perform app.post_journal(v_date, 'loan_repayment', v_id, 'Pelunasan kasbon ' || v_loan.loan_no,
    jsonb_build_array(jsonb_build_object('account_id', v_cash, 'debit', v_amount), jsonb_build_object('account', 'employee_loan', 'credit', v_amount)));
  if app.loan_balance(p_loan_id) <= 0 then update public.employee_loans set status = 'paid_off' where id = p_loan_id; end if;
  return v_id;
end;
$$;

-- Batalkan kasbon yang belum pernah dicicil
create or replace function public.void_employee_loan(p_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_loan public.employee_loans%rowtype;
begin
  perform app.assert_permission('payroll', 'void');
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Alasan pembatalan wajib diisi' using errcode = '22023'; end if;
  select * into v_loan from public.employee_loans where id = p_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Kasbon tidak ditemukan' using errcode = 'P0002'; end if;
  if v_loan.status = 'void' then raise exception 'Kasbon sudah dibatalkan' using errcode = '22023'; end if;
  if exists (select 1 from public.employee_loan_payments where loan_id = p_id and status = 'posted') then
    raise exception 'Kasbon sudah dicicil; tidak bisa dibatalkan' using errcode = '22023';
  end if;
  update public.employee_loans set status = 'void', void_reason = btrim(p_reason) where id = p_id;
  perform app.reverse_journals('employee_loan', p_id, app.today_wib(), 'Batal kasbon ' || v_loan.loan_no || ': ' || btrim(p_reason));
end;
$$;

-- =============================================================================
-- Tampilan
-- =============================================================================
create view public.v_payslips with (security_invoker = true) as
  select s.*, e.full_name as employee_name, e.position as employee_position, p.label as period_label, p.period_no, p.period_type,
         p.start_date, p.end_date, p.status as period_status, p.paid_date
  from public.payslips s
  join public.employees e on e.id = s.employee_id
  join public.payroll_periods p on p.id = s.period_id;

create view public.v_employee_loans with (security_invoker = true) as
  select l.id, l.branch_id, l.loan_no, l.employee_id, e.full_name as employee_name, l.loan_date, l.principal, l.installment_amount,
         l.note, l.status, l.void_reason, cb.name as cash_bank_name,
         app.loan_balance(l.id)::numeric(18,2) as balance
  from public.employee_loans l
  join public.employees e on e.id = l.employee_id
  join public.cash_bank_accounts cb on cb.id = l.cash_bank_account_id;

-- =============================================================================
-- RLS & hak akses
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array['employee_pay_profiles', 'payroll_periods', 'payslips', 'employee_loans', 'employee_loan_payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

create policy pay_profiles_select on public.employee_pay_profiles for select to authenticated
  using (branch_id = app.current_branch_id()
         and (app.has_permission('payroll', 'view') or (employee_id = app.current_employee_id() and app.has_permission('payroll', 'view', 'own'))));
create policy payroll_periods_select on public.payroll_periods for select to authenticated
  using (branch_id = app.current_branch_id()
         and (app.has_permission('payroll', 'view')
              or (app.has_permission('payroll', 'view', 'own') and status in ('approved', 'paid') and app.has_own_slip(id))));
create policy payslips_select on public.payslips for select to authenticated
  using (branch_id = app.current_branch_id()
         and (app.has_permission('payroll', 'view')
              or (employee_id = app.current_employee_id() and app.has_permission('payroll', 'view', 'own') and app.period_released(period_id))));
create policy employee_loans_select on public.employee_loans for select to authenticated
  using (branch_id = app.current_branch_id()
         and (app.has_permission('payroll', 'view') or (employee_id = app.current_employee_id() and app.has_permission('payroll', 'view', 'own'))));
create policy loan_payments_select on public.employee_loan_payments for select to authenticated
  using (branch_id = app.current_branch_id()
         and (app.has_permission('payroll', 'view')
              or exists (select 1 from public.employee_loans l where l.id = loan_id and l.employee_id = app.current_employee_id()
                         and app.has_permission('payroll', 'view', 'own'))));

grant select on public.v_payslips, public.v_employee_loans to authenticated;

revoke all on function app.loan_balance(uuid), app.employee_loan_totals(uuid), app.recalc_payslip(uuid), app.lock_draft_period(uuid)
  from public, anon, authenticated;
-- Dipakai view v_employee_loans (security_invoker), jadi harus bisa dieksekusi pemanggil
grant execute on function app.loan_balance(uuid) to authenticated, service_role;

revoke all on function public.save_pay_profile(uuid, jsonb), public.create_payroll_period(jsonb), public.update_payslip(uuid, jsonb),
  public.submit_payroll(uuid), public.reopen_payroll(uuid), public.approve_payroll(uuid), public.pay_payroll(uuid, uuid, date),
  public.void_payroll(uuid, text), public.create_employee_loan(jsonb), public.repay_employee_loan(uuid, jsonb),
  public.void_employee_loan(uuid, text) from public, anon;
grant execute on function public.save_pay_profile(uuid, jsonb), public.create_payroll_period(jsonb), public.update_payslip(uuid, jsonb),
  public.submit_payroll(uuid), public.reopen_payroll(uuid), public.approve_payroll(uuid), public.pay_payroll(uuid, uuid, date),
  public.void_payroll(uuid, text), public.create_employee_loan(jsonb), public.repay_employee_loan(uuid, jsonb),
  public.void_employee_loan(uuid, text) to authenticated;
