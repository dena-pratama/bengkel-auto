-- =============================================================================
-- Finance (PRD §11): kas & bank, pemasukan/pengeluaran, transfer, modal & prive, biaya rutin,
-- jurnal manual, bagan akun, tutup buku, dan laporan keuangan (laba rugi, neraca, arus kas,
-- buku besar, margin). Semua jurnal tetap append-only; koreksi lewat jurnal pembalik.
-- =============================================================================

create type public.cash_txn_kind as enum ('income', 'expense', 'transfer', 'capital', 'drawing');

-- -----------------------------------------------------------------------------
-- Tutup buku bulanan: bulan yang ditutup terkunci dari jurnal baru bertanggal di bulan itu
-- -----------------------------------------------------------------------------
create table public.fiscal_periods (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references public.branches(id),
  period_year   integer not null check (period_year between 2000 and 2100),
  period_month  integer not null check (period_month between 1 and 12),
  is_closed     boolean not null default true,
  closed_at     timestamptz not null default now(),
  closed_by     uuid references public.employees(id),
  reopen_reason text,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  updated_at    timestamptz not null default now(),
  unique (branch_id, period_year, period_month)
);

-- -----------------------------------------------------------------------------
-- Transaksi kas: pemasukan lain, pengeluaran operasional, transfer antar akun, setoran modal, prive
-- -----------------------------------------------------------------------------
create table public.cash_transactions (
  id                   uuid primary key default gen_random_uuid(),
  branch_id            uuid not null references public.branches(id),
  txn_no               text not null,
  txn_date             date not null,
  kind                 public.cash_txn_kind not null,
  cash_bank_account_id uuid not null references public.cash_bank_accounts(id),
  to_cash_bank_account_id uuid references public.cash_bank_accounts(id),   -- khusus transfer
  account_id           uuid references public.accounts(id),                -- akun lawan (beban / pendapatan / modal)
  amount               numeric(18,2) not null check (amount > 0),
  description          text not null check (length(btrim(description)) >= 3),
  recurring_id         uuid,
  status               public.doc_status not null default 'posted',
  void_reason          text,
  created_at           timestamptz not null default now(),
  created_by           uuid default auth.uid(),
  updated_at           timestamptz not null default now(),
  unique (branch_id, txn_no),
  check ((kind = 'transfer') = (to_cash_bank_account_id is not null)),
  check (kind = 'transfer' or account_id is not null),
  check (to_cash_bank_account_id is null or to_cash_bank_account_id <> cash_bank_account_id)
);
create index idx_cash_transactions_date on public.cash_transactions (branch_id, txn_date desc);

-- Template biaya rutin bulanan (sewa, listrik, internet) yang tinggal dikonfirmasi
create table public.recurring_expenses (
  id                   uuid primary key default gen_random_uuid(),
  branch_id            uuid not null references public.branches(id),
  name                 text not null check (length(btrim(name)) between 2 and 80),
  account_id           uuid not null references public.accounts(id),
  cash_bank_account_id uuid not null references public.cash_bank_accounts(id),
  amount               numeric(18,2) not null check (amount > 0),
  day_of_month         integer not null default 1 check (day_of_month between 1 and 28),
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  created_by           uuid default auth.uid(),
  updated_at           timestamptz not null default now()
);
alter table public.cash_transactions add constraint cash_transactions_recurring_fkey
  foreign key (recurring_id) references public.recurring_expenses(id);

do $$
declare
  t text;
begin
  foreach t in array array['fiscal_periods', 'cash_transactions', 'recurring_expenses'] loop
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$I
                    for each row execute function app.set_updated_at()', t);
    execute format('create trigger trg_audit after insert or update or delete on public.%I
                    for each row execute function app.audit_row_change()', t);
    execute format('create trigger trg_no_delete before delete on public.%I
                    for each row execute function app.prevent_modification()', t);
  end loop;
end $$;

-- =============================================================================
-- Penguncian periode: semua jurnal lewat app.post_journal, jadi satu pemeriksaan cukup
-- =============================================================================
create or replace function app.post_journal(
  p_date        date,
  p_source_type text,
  p_source_id   uuid,
  p_description text,
  p_lines       jsonb,
  p_reversal_of uuid default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_id     uuid;
  v_debit  numeric(18,2);
  v_credit numeric(18,2);
  v_bad    boolean;
begin
  if v_branch is null then raise exception 'Cabang tidak diketahui' using errcode = '42501'; end if;

  if exists (select 1 from public.fiscal_periods fp
             where fp.branch_id = v_branch and fp.is_closed
               and fp.period_year = extract(year from p_date)::int and fp.period_month = extract(month from p_date)::int) then
    raise exception 'Periode % sudah ditutup; transaksi bertanggal % tidak bisa dibuat', to_char(p_date, 'MM/YYYY'), to_char(p_date, 'DD/MM/YYYY')
      using errcode = '22023';
  end if;

  select coalesce(sum(l.debit), 0), coalesce(sum(l.credit), 0),
         bool_or(l.debit < 0 or l.credit < 0 or (l.debit > 0 and l.credit > 0)
                 or not exists (select 1 from public.accounts a where a.id = l.account_id and a.branch_id = v_branch))
    into v_debit, v_credit, v_bad
  from app.journal_lines_from_json(p_lines, v_branch) l;

  if coalesce(v_bad, false) then raise exception 'Baris jurnal tidak valid' using errcode = '22023'; end if;
  if v_debit = 0 or v_debit <> v_credit then
    raise exception 'Jurnal tidak seimbang: debit % dan kredit %', v_debit, v_credit using errcode = '23514';
  end if;

  insert into public.journal_entries (branch_id, entry_no, entry_date, source_type, source_id, description, reversal_of)
  values (v_branch, app.next_document_number('JU', p_date, v_branch), p_date, p_source_type, p_source_id, p_description, p_reversal_of)
  returning id into v_id;

  insert into public.journal_lines (branch_id, entry_id, account_id, debit, credit, memo)
  select v_branch, v_id, l.account_id, l.debit, l.credit, l.memo from app.journal_lines_from_json(p_lines, v_branch) l;
  return v_id;
end;
$$;

-- =============================================================================
-- Bagan akun
-- p_data: code, name, type
-- =============================================================================
create or replace function public.save_account(p_id uuid, p_data jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_type   public.account_type;
  v_code   text := btrim(p_data ->> 'code');
  v_group  integer;
  v_id     uuid;
begin
  perform app.assert_permission('journal', case when p_id is null then 'create' else 'update' end::public.permission_action);
  if length(btrim(coalesce(p_data ->> 'name', ''))) < 2 then raise exception 'Nama akun minimal 2 karakter' using errcode = '22023'; end if;

  if p_id is null then
    v_type := (p_data ->> 'type')::public.account_type;
    if v_code !~ '^[1-7]-[0-9]{4}$' then raise exception 'Kode akun harus berformat 6-1234' using errcode = '22023'; end if;
    v_group := case v_type when 'asset' then 1 when 'liability' then 2 when 'equity' then 3 when 'revenue' then 4
                           when 'cogs' then 5 when 'expense' then 6 else 7 end;
    if left(v_code, 1)::int <> v_group then
      raise exception 'Awalan kode tidak sesuai jenis akun (1 aset, 2 kewajiban, 3 modal, 4 pendapatan, 5 HPP, 6 beban, 7 lain-lain)' using errcode = '22023';
    end if;
    insert into public.accounts (branch_id, code, name, type, normal_balance)
    values (v_branch, v_code, btrim(p_data ->> 'name'), v_type,
            case when v_type in ('asset', 'cogs', 'expense') then 'debit' else 'credit' end)
    returning id into v_id;
  else
    update public.accounts set name = btrim(p_data ->> 'name') where id = p_id and branch_id = v_branch returning id into v_id;
    if v_id is null then raise exception 'Akun tidak ditemukan' using errcode = 'P0002'; end if;
  end if;
  return v_id;
exception when unique_violation then
  raise exception 'Kode akun sudah dipakai' using errcode = '23505';
end;
$$;

-- Akun sistem (dipakai jurnal otomatis) tidak bisa dinonaktifkan; akun yang masih bersaldo juga tidak
create or replace function public.set_account_active(p_id uuid, p_active boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_acc public.accounts%rowtype;
  v_bal numeric;
begin
  perform app.assert_permission('journal', 'update');
  select * into v_acc from public.accounts where id = p_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Akun tidak ditemukan' using errcode = 'P0002'; end if;
  if not p_active then
    if v_acc.system_key is not null then raise exception 'Akun sistem dipakai jurnal otomatis dan tidak bisa dinonaktifkan' using errcode = '22023'; end if;
    select coalesce(sum(debit - credit), 0) into v_bal from public.journal_lines where account_id = p_id;
    if v_bal <> 0 then raise exception 'Akun masih bersaldo; nolkan dulu sebelum dinonaktifkan' using errcode = '22023'; end if;
    if exists (select 1 from public.cash_bank_accounts where account_id = p_id and is_active) then
      raise exception 'Akun ini dipakai akun kas/bank yang aktif' using errcode = '22023';
    end if;
  end if;
  update public.accounts set is_active = p_active where id = p_id;
end;
$$;

-- =============================================================================
-- Akun kas / bank (akun buku besar-nya dibuat otomatis)
-- p_data: name, kind (cash|bank), bank_name?, account_number?
-- =============================================================================
create or replace function public.save_cash_bank_account(p_id uuid, p_data jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_kind   public.cash_bank_kind;
  v_acc    uuid;
  v_code   text;
  v_n      integer;
  v_id     uuid;
begin
  perform app.assert_permission('journal', case when p_id is null then 'create' else 'update' end::public.permission_action);
  if length(btrim(coalesce(p_data ->> 'name', ''))) < 2 then raise exception 'Nama akun kas/bank minimal 2 karakter' using errcode = '22023'; end if;

  if p_id is null then
    v_kind := (p_data ->> 'kind')::public.cash_bank_kind;
    -- Akun buku besar baru di kelompok Kas (1-10xx) / Bank (1-10xx berikutnya)
    select coalesce(max(substr(code, 3)::int), 1002) + 1 into v_n from public.accounts
     where branch_id = v_branch and code ~ '^1-10[0-9]{2}$';
    v_code := '1-' || lpad(v_n::text, 4, '0');
    insert into public.accounts (branch_id, code, name, type, normal_balance)
    values (v_branch, v_code, btrim(p_data ->> 'name'), 'asset', 'debit') returning id into v_acc;
    insert into public.cash_bank_accounts (branch_id, name, kind, account_id, bank_name, account_number)
    values (v_branch, btrim(p_data ->> 'name'), v_kind, v_acc, nullif(btrim(p_data ->> 'bank_name'), ''), nullif(btrim(p_data ->> 'account_number'), ''))
    returning id into v_id;
  else
    update public.cash_bank_accounts
       set name = btrim(p_data ->> 'name'), bank_name = nullif(btrim(p_data ->> 'bank_name'), ''),
           account_number = nullif(btrim(p_data ->> 'account_number'), '')
     where id = p_id and branch_id = v_branch returning id, account_id into v_id, v_acc;
    if v_id is null then raise exception 'Akun kas/bank tidak ditemukan' using errcode = 'P0002'; end if;
    update public.accounts set name = btrim(p_data ->> 'name') where id = v_acc;
  end if;
  return v_id;
exception when unique_violation then
  raise exception 'Nama akun kas/bank sudah dipakai' using errcode = '23505';
end;
$$;

-- =============================================================================
-- Transaksi kas
-- p_data: kind, txn_date?, cash_bank_account_id, to_cash_bank_account_id? (transfer), account_id? (beban/pendapatan),
--         amount, description, recurring_id?
-- Jurnal: pengeluaran Dr beban Cr kas | pemasukan Dr kas Cr pendapatan | transfer Dr tujuan Cr asal
--         modal Dr kas Cr Modal Pemilik | prive Dr Prive Cr kas
-- =============================================================================
create or replace function public.post_cash_transaction(p_data jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_kind   public.cash_txn_kind := (p_data ->> 'kind')::public.cash_txn_kind;
  v_date   date := coalesce(nullif(p_data ->> 'txn_date', '')::date, app.today_wib());
  v_amount numeric(18,2) := round(coalesce(nullif(p_data ->> 'amount', '')::numeric, 0), 2);
  v_desc   text := btrim(coalesce(p_data ->> 'description', ''));
  v_from   uuid;
  v_to     uuid;
  v_acc    public.accounts%rowtype;
  v_account_id uuid;
  v_lines  jsonb;
  v_prefix text;
  v_id     uuid;
  v_no     text;
begin
  if v_kind in ('capital', 'drawing') then
    perform app.assert_permission('journal', 'create');
  else
    perform app.assert_permission('expenses', 'create');
  end if;
  if v_amount <= 0 then raise exception 'Jumlah harus lebih dari nol' using errcode = '22023'; end if;
  if length(v_desc) < 3 then raise exception 'Keterangan minimal 3 karakter' using errcode = '22023'; end if;
  if v_date > app.today_wib() then raise exception 'Tanggal tidak boleh di masa depan' using errcode = '22023'; end if;

  select account_id into v_from from public.cash_bank_accounts
   where id = (p_data ->> 'cash_bank_account_id')::uuid and branch_id = v_branch and is_active;
  if v_from is null then raise exception 'Pilih akun kas/bank yang aktif' using errcode = '22023'; end if;

  if v_kind = 'transfer' then
    select account_id into v_to from public.cash_bank_accounts
     where id = nullif(p_data ->> 'to_cash_bank_account_id', '')::uuid and branch_id = v_branch and is_active;
    if v_to is null then raise exception 'Pilih akun kas/bank tujuan yang aktif' using errcode = '22023'; end if;
    if (p_data ->> 'cash_bank_account_id') = (p_data ->> 'to_cash_bank_account_id') then
      raise exception 'Akun asal dan tujuan tidak boleh sama' using errcode = '22023';
    end if;
    v_lines := jsonb_build_array(jsonb_build_object('account_id', v_to, 'debit', v_amount),
                                 jsonb_build_object('account_id', v_from, 'credit', v_amount));
    v_prefix := 'TF';
  elsif v_kind = 'capital' then
    v_account_id := app.account_id('owner_equity');
    v_lines := jsonb_build_array(jsonb_build_object('account_id', v_from, 'debit', v_amount),
                                 jsonb_build_object('account_id', v_account_id, 'credit', v_amount));
    v_prefix := 'SM';
  elsif v_kind = 'drawing' then
    v_account_id := app.account_id('drawing');
    v_lines := jsonb_build_array(jsonb_build_object('account_id', v_account_id, 'debit', v_amount),
                                 jsonb_build_object('account_id', v_from, 'credit', v_amount));
    v_prefix := 'PV';
  else
    select * into v_acc from public.accounts where id = nullif(p_data ->> 'account_id', '')::uuid and branch_id = v_branch and is_active;
    if not found then raise exception 'Pilih akun %', case when v_kind = 'expense' then 'beban' else 'pendapatan' end using errcode = '22023'; end if;
    if v_kind = 'expense' and v_acc.type not in ('expense', 'other') then
      raise exception 'Pengeluaran harus ke akun beban' using errcode = '22023';
    end if;
    if v_kind = 'income' and v_acc.type not in ('revenue', 'other') then
      raise exception 'Pemasukan harus ke akun pendapatan' using errcode = '22023';
    end if;
    v_account_id := v_acc.id;
    if v_kind = 'expense' then
      v_lines := jsonb_build_array(jsonb_build_object('account_id', v_account_id, 'debit', v_amount),
                                   jsonb_build_object('account_id', v_from, 'credit', v_amount));
      v_prefix := 'KK';
    else
      v_lines := jsonb_build_array(jsonb_build_object('account_id', v_from, 'debit', v_amount),
                                   jsonb_build_object('account_id', v_account_id, 'credit', v_amount));
      v_prefix := 'KM';
    end if;
  end if;

  v_no := app.next_document_number(v_prefix, v_date, v_branch);
  insert into public.cash_transactions (branch_id, txn_no, txn_date, kind, cash_bank_account_id, to_cash_bank_account_id, account_id,
                                        amount, description, recurring_id)
  values (v_branch, v_no, v_date, v_kind, (p_data ->> 'cash_bank_account_id')::uuid, nullif(p_data ->> 'to_cash_bank_account_id', '')::uuid,
          v_account_id, v_amount, v_desc, nullif(p_data ->> 'recurring_id', '')::uuid)
  returning id into v_id;

  perform app.post_journal(v_date, 'cash_txn', v_id, v_no || ' ' || v_desc, v_lines);
  return v_id;
end;
$$;

create or replace function public.void_cash_transaction(p_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_txn public.cash_transactions%rowtype;
begin
  perform app.assert_any_permission(array['expenses:void', 'journal:void']);
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Alasan pembatalan wajib diisi' using errcode = '22023'; end if;
  select * into v_txn from public.cash_transactions where id = p_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Transaksi tidak ditemukan' using errcode = 'P0002'; end if;
  if v_txn.status = 'void' then raise exception 'Transaksi sudah dibatalkan' using errcode = '22023'; end if;
  if v_txn.kind in ('capital', 'drawing') then perform app.assert_permission('journal', 'void'); end if;
  update public.cash_transactions set status = 'void', void_reason = btrim(p_reason) where id = p_id;
  perform app.reverse_journals('cash_txn', p_id, app.today_wib(), 'Batal ' || v_txn.txn_no || ': ' || btrim(p_reason));
end;
$$;

-- =============================================================================
-- Biaya rutin bulanan
-- p_data: name, account_id, cash_bank_account_id, amount, day_of_month
-- =============================================================================
create or replace function public.save_recurring_expense(p_id uuid, p_data jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_amount numeric(18,2) := round(coalesce(nullif(p_data ->> 'amount', '')::numeric, 0), 2);
  v_day    integer := coalesce(nullif(p_data ->> 'day_of_month', '')::int, 1);
  v_id     uuid;
begin
  perform app.assert_permission('expenses', case when p_id is null then 'create' else 'update' end::public.permission_action);
  if length(btrim(coalesce(p_data ->> 'name', ''))) < 2 then raise exception 'Nama biaya minimal 2 karakter' using errcode = '22023'; end if;
  if v_amount <= 0 then raise exception 'Jumlah harus lebih dari nol' using errcode = '22023'; end if;
  if v_day not between 1 and 28 then raise exception 'Tanggal jatuh tempo 1-28' using errcode = '22023'; end if;
  if not exists (select 1 from public.accounts where id = (p_data ->> 'account_id')::uuid and branch_id = v_branch and is_active and type in ('expense', 'other')) then
    raise exception 'Pilih akun beban yang aktif' using errcode = '22023';
  end if;
  perform app.assert_ref('cash_bank_accounts', (p_data ->> 'cash_bank_account_id')::uuid, 'Akun kas/bank');

  if p_id is null then
    insert into public.recurring_expenses (branch_id, name, account_id, cash_bank_account_id, amount, day_of_month)
    values (v_branch, btrim(p_data ->> 'name'), (p_data ->> 'account_id')::uuid, (p_data ->> 'cash_bank_account_id')::uuid, v_amount, v_day)
    returning id into v_id;
  else
    update public.recurring_expenses
       set name = btrim(p_data ->> 'name'), account_id = (p_data ->> 'account_id')::uuid,
           cash_bank_account_id = (p_data ->> 'cash_bank_account_id')::uuid, amount = v_amount, day_of_month = v_day
     where id = p_id and branch_id = v_branch returning id into v_id;
    if v_id is null then raise exception 'Biaya rutin tidak ditemukan' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.set_recurring_expense_active(p_id uuid, p_active boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform app.assert_permission('expenses', 'update');
  update public.recurring_expenses set is_active = p_active where id = p_id and branch_id = app.current_branch_id();
  if not found then raise exception 'Biaya rutin tidak ditemukan' using errcode = 'P0002'; end if;
end;
$$;

-- Konfirmasi biaya rutin bulan ini (sekali per bulan). p_amount boleh diubah bila tagihan bulan ini berbeda.
create or replace function public.confirm_recurring_expense(p_id uuid, p_date date default null, p_amount numeric default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_rec  public.recurring_expenses%rowtype;
  v_date date := coalesce(p_date, app.today_wib());
begin
  perform app.assert_permission('expenses', 'create');
  select * into v_rec from public.recurring_expenses where id = p_id and branch_id = app.current_branch_id() and is_active for update;
  if not found then raise exception 'Biaya rutin tidak ditemukan atau nonaktif' using errcode = 'P0002'; end if;
  if exists (select 1 from public.cash_transactions t
             where t.recurring_id = p_id and t.status = 'posted'
               and to_char(t.txn_date, 'YYYY-MM') = to_char(v_date, 'YYYY-MM')) then
    raise exception 'Biaya % untuk bulan % sudah dikonfirmasi', v_rec.name, to_char(v_date, 'MM/YYYY') using errcode = '22023';
  end if;
  return public.post_cash_transaction(jsonb_build_object(
    'kind', 'expense', 'txn_date', v_date, 'cash_bank_account_id', v_rec.cash_bank_account_id, 'account_id', v_rec.account_id,
    'amount', coalesce(p_amount, v_rec.amount), 'description', v_rec.name || ' ' || to_char(v_date, 'MM/YYYY'), 'recurring_id', p_id));
end;
$$;

-- =============================================================================
-- Jurnal manual (penyesuaian) dan pembaliknya. p_lines: [{account_id, debit, credit, memo?}]
-- =============================================================================
create or replace function public.post_manual_journal(p_date date, p_description text, p_lines jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
begin
  perform app.assert_permission('journal', 'create');
  if length(btrim(coalesce(p_description, ''))) < 3 then raise exception 'Keterangan jurnal minimal 3 karakter' using errcode = '22023'; end if;
  if jsonb_array_length(coalesce(p_lines, '[]')) < 2 then raise exception 'Jurnal minimal dua baris' using errcode = '22023'; end if;
  if p_date is null or p_date > app.today_wib() then raise exception 'Tanggal jurnal tidak boleh kosong atau di masa depan' using errcode = '22023'; end if;
  return app.post_journal(p_date, 'manual', null, btrim(p_description), p_lines);
end;
$$;

create or replace function public.reverse_manual_journal(p_entry_id uuid, p_reason text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_entry public.journal_entries%rowtype;
begin
  perform app.assert_permission('journal', 'void');
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Alasan pembalikan wajib diisi' using errcode = '22023'; end if;
  select * into v_entry from public.journal_entries where id = p_entry_id and branch_id = app.current_branch_id();
  if not found then raise exception 'Jurnal tidak ditemukan' using errcode = 'P0002'; end if;
  if v_entry.source_type <> 'manual' then
    raise exception 'Jurnal otomatis dibalik dengan membatalkan dokumen sumbernya' using errcode = '22023';
  end if;
  if v_entry.reversal_of is not null or exists (select 1 from public.journal_entries where reversal_of = p_entry_id) then
    raise exception 'Jurnal ini sudah dibalik atau merupakan jurnal pembalik' using errcode = '22023';
  end if;
  return app.post_journal(app.today_wib(), 'manual', null, 'Pembalik ' || v_entry.entry_no || ': ' || btrim(p_reason),
    (select jsonb_agg(jsonb_build_object('account_id', l.account_id, 'debit', l.credit, 'credit', l.debit, 'memo', l.memo))
       from public.journal_lines l where l.entry_id = p_entry_id), p_entry_id);
end;
$$;

-- =============================================================================
-- Tutup buku
-- =============================================================================
create or replace function public.close_fiscal_period(p_year integer, p_month integer)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_first  date := make_date(p_year, p_month, 1);
begin
  perform app.assert_permission('journal', 'update');
  if v_first >= date_trunc('month', app.today_wib())::date then
    raise exception 'Hanya bulan yang sudah lewat yang bisa ditutup' using errcode = '22023';
  end if;
  -- Tutup berurutan: bulan sebelumnya yang sudah punya jurnal harus ditutup lebih dulu
  if exists (select 1 from public.journal_entries e
             where e.branch_id = v_branch and e.entry_date < v_first
               and not exists (select 1 from public.fiscal_periods fp
                               where fp.branch_id = v_branch and fp.is_closed
                                 and fp.period_year = extract(year from e.entry_date)::int
                                 and fp.period_month = extract(month from e.entry_date)::int)) then
    raise exception 'Tutup dulu bulan-bulan sebelumnya yang masih terbuka' using errcode = '22023';
  end if;
  insert into public.fiscal_periods (branch_id, period_year, period_month, closed_by)
  values (v_branch, p_year, p_month, app.current_employee_id())
  on conflict (branch_id, period_year, period_month)
  do update set is_closed = true, closed_at = now(), closed_by = app.current_employee_id(), reopen_reason = null;
end;
$$;

create or replace function public.reopen_fiscal_period(p_year integer, p_month integer, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not app.is_superuser() then raise exception 'Hanya Owner yang boleh membuka kembali periode' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Alasan membuka periode wajib diisi' using errcode = '22023'; end if;
  update public.fiscal_periods set is_closed = false, reopen_reason = btrim(p_reason)
   where branch_id = app.current_branch_id() and period_year = p_year and period_month = p_month and is_closed;
  if not found then raise exception 'Periode ini tidak dalam keadaan tertutup' using errcode = '22023'; end if;
end;
$$;

-- =============================================================================
-- Laporan (fungsi security definer dengan pemeriksaan izin; angka dalam orientasi saldo normal akun)
-- =============================================================================
create or replace function app.assert_report_access()
returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform app.assert_any_permission(array['finance_reports:view', 'journal:view']);
end;
$$;

-- Saldo per akun: awal (sebelum p_from), mutasi, akhir
create or replace function public.report_account_balances(p_from date, p_to date)
returns table (account_id uuid, code text, name text, type text, system_key text, normal_balance text,
               opening numeric, period_debit numeric, period_credit numeric, closing numeric)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform app.assert_report_access();
  return query
  select a.id, a.code, a.name, a.type::text, a.system_key, a.normal_balance,
         (case when a.normal_balance = 'debit' then 1 else -1 end * coalesce(o.net, 0))::numeric,
         coalesce(p.d, 0)::numeric, coalesce(p.c, 0)::numeric,
         (case when a.normal_balance = 'debit' then 1 else -1 end * (coalesce(o.net, 0) + coalesce(p.d, 0) - coalesce(p.c, 0)))::numeric
  from public.accounts a
  left join lateral (
    select sum(l.debit - l.credit) as net from public.journal_lines l
    join public.journal_entries e on e.id = l.entry_id where l.account_id = a.id and e.entry_date < p_from
  ) o on true
  left join lateral (
    select sum(l.debit) as d, sum(l.credit) as c from public.journal_lines l
    join public.journal_entries e on e.id = l.entry_id where l.account_id = a.id and e.entry_date between p_from and p_to
  ) p on true
  where a.branch_id = app.current_branch_id()
  order by a.code;
end;
$$;

-- Laba rugi: baris per akun menurut bagian (revenue, cogs, expense, tax, other)
create or replace function public.report_profit_loss(p_from date, p_to date)
returns table (section text, account_id uuid, code text, name text, amount numeric)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform app.assert_report_access();
  return query
  select case when a.system_key = 'pph_final_expense' then 'tax' else a.type::text end,
         a.id, a.code, a.name,
         (case when a.type in ('revenue', 'other') then coalesce(s.c, 0) - coalesce(s.d, 0) else coalesce(s.d, 0) - coalesce(s.c, 0) end)::numeric
  from public.accounts a
  join lateral (
    select sum(l.debit) as d, sum(l.credit) as c from public.journal_lines l
    join public.journal_entries e on e.id = l.entry_id where l.account_id = a.id and e.entry_date between p_from and p_to
  ) s on true
  where a.branch_id = app.current_branch_id() and a.type in ('revenue', 'cogs', 'expense', 'other')
    and (coalesce(s.d, 0) <> 0 or coalesce(s.c, 0) <> 0)
  order by a.code;
end;
$$;

-- Neraca per tanggal. Laba berjalan (kumulatif) ditampilkan sebagai baris modal sintetis.
create or replace function public.report_balance_sheet(p_date date)
returns table (section text, account_id uuid, code text, name text, amount numeric)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform app.assert_report_access();
  return query
  select a.type::text, a.id, a.code, a.name,
         (case when a.type = 'asset' then coalesce(s.d, 0) - coalesce(s.c, 0) else coalesce(s.c, 0) - coalesce(s.d, 0) end)::numeric
  from public.accounts a
  join lateral (
    select sum(l.debit) as d, sum(l.credit) as c from public.journal_lines l
    join public.journal_entries e on e.id = l.entry_id where l.account_id = a.id and e.entry_date <= p_date
  ) s on true
  where a.branch_id = app.current_branch_id() and a.type in ('asset', 'liability', 'equity')
    and (coalesce(s.d, 0) <> 0 or coalesce(s.c, 0) <> 0)
  union all
  select 'equity', null::uuid, '3-9999', 'Laba berjalan (kumulatif)',
         (select coalesce(sum(l.credit - l.debit), 0) from public.journal_lines l
          join public.journal_entries e on e.id = l.entry_id join public.accounts a on a.id = l.account_id
          where a.branch_id = app.current_branch_id() and a.type in ('revenue', 'cogs', 'expense', 'other') and e.entry_date <= p_date)::numeric
  order by 3;
end;
$$;

-- Arus kas metode langsung: dari jurnal yang menyentuh akun kas/bank, dikelompokkan operasi/investasi/pendanaan.
-- Transfer antar akun kas netto nol sehingga tidak muncul.
create or replace function public.report_cash_flow(p_from date, p_to date)
returns table (category text, source_type text, inflow numeric, outflow numeric)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform app.assert_report_access();
  return query
  with cash as (
    select l.entry_id, sum(l.debit - l.credit) as delta
    from public.journal_lines l
    join public.cash_bank_accounts cb on cb.account_id = l.account_id and cb.branch_id = app.current_branch_id()
    group by l.entry_id
  ), classified as (
    select e.source_type as src, c.delta,
           case when exists (select 1 from public.journal_lines x join public.accounts a on a.id = x.account_id
                             where x.entry_id = e.id and a.system_key = 'fixed_asset') then 'investing'
                when exists (select 1 from public.journal_lines x join public.accounts a on a.id = x.account_id
                             where x.entry_id = e.id and a.system_key in ('owner_equity', 'drawing')) then 'financing'
                else 'operating' end as cat
    from public.journal_entries e join cash c on c.entry_id = e.id
    where e.branch_id = app.current_branch_id() and e.entry_date between p_from and p_to and c.delta <> 0
  )
  select cl.cat, cl.src, coalesce(sum(cl.delta) filter (where cl.delta > 0), 0)::numeric,
         coalesce(-sum(cl.delta) filter (where cl.delta < 0), 0)::numeric
  from classified cl group by cl.cat, cl.src order by 1, 2;
end;
$$;

-- Saldo kas & bank per tanggal
create or replace function public.report_cash_bank_balances(p_date date)
returns table (cash_bank_account_id uuid, name text, kind text, bank_name text, account_number text, is_active boolean, balance numeric)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform app.assert_any_permission(array['finance_reports:view', 'journal:view', 'expenses:view']);
  return query
  select cb.id, cb.name, cb.kind::text, cb.bank_name, cb.account_number, cb.is_active, coalesce(s.net, 0)::numeric
  from public.cash_bank_accounts cb
  left join lateral (
    select sum(l.debit - l.credit) as net from public.journal_lines l
    join public.journal_entries e on e.id = l.entry_id where l.account_id = cb.account_id and e.entry_date <= p_date
  ) s on true
  where cb.branch_id = app.current_branch_id()
  order by cb.kind, cb.name;
end;
$$;

-- Buku besar satu akun dengan saldo berjalan
create or replace function public.report_ledger(p_account_id uuid, p_from date, p_to date)
returns table (ord bigint, entry_id uuid, entry_no text, entry_date date, description text, source_type text, memo text,
               debit numeric, credit numeric, balance numeric)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_sign    integer;
  v_opening numeric;
begin
  perform app.assert_report_access();
  select case when a.normal_balance = 'debit' then 1 else -1 end into v_sign from public.accounts a
   where a.id = p_account_id and a.branch_id = app.current_branch_id();
  if v_sign is null then raise exception 'Akun tidak ditemukan' using errcode = 'P0002'; end if;
  select v_sign * coalesce(sum(l.debit - l.credit), 0) into v_opening from public.journal_lines l
  join public.journal_entries e on e.id = l.entry_id where l.account_id = p_account_id and e.entry_date < p_from;

  return query
  select 0::bigint, null::uuid, null::text, null::date, 'Saldo awal'::text, null::text, null::text, 0::numeric, 0::numeric, v_opening
  union all
  select t.rn, t.eid, t.eno, t.edate, t.edesc, t.esrc, t.lmemo, t.ldebit, t.lcredit,
         v_opening + sum(v_sign * (t.ldebit - t.lcredit)) over (order by t.rn)
  from (
    select row_number() over (order by e.entry_date, e.entry_no, l.created_at, l.id) as rn,
           e.id as eid, e.entry_no as eno, e.entry_date as edate, e.description as edesc, e.source_type as esrc,
           l.memo as lmemo, l.debit as ldebit, l.credit as lcredit
    from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
    where l.account_id = p_account_id and e.entry_date between p_from and p_to
  ) t
  order by 1;
end;
$$;

-- Margin dari invoice yang diposting: p_group = service | item | wo. Biaya = HPP part (komisi belum dihitung).
create or replace function public.report_margin(p_group text, p_from date, p_to date)
returns table (key_id uuid, label text, sublabel text, qty numeric, revenue numeric, cost numeric, margin numeric)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform app.assert_permission('finance_reports', 'view');
  if p_group = 'service' then
    return query
    select si.service_id, sv.name, sv.code, sum(si.qty)::numeric, sum(si.net_amount)::numeric, sum(si.cost_total)::numeric,
           (sum(si.net_amount) - sum(si.cost_total))::numeric
    from public.sale_items si join public.sales s on s.id = si.sale_id join public.services sv on sv.id = si.service_id
    where s.status = 'posted' and s.branch_id = app.current_branch_id() and s.sale_date between p_from and p_to and si.service_id is not null
    group by si.service_id, sv.name, sv.code order by 7 desc;
  elsif p_group = 'item' then
    return query
    select si.item_id, it.name, it.sku, sum(si.qty)::numeric, sum(si.net_amount)::numeric, sum(si.cost_total)::numeric,
           (sum(si.net_amount) - sum(si.cost_total))::numeric
    from public.sale_items si join public.sales s on s.id = si.sale_id join public.items it on it.id = si.item_id
    where s.status = 'posted' and s.branch_id = app.current_branch_id() and s.sale_date between p_from and p_to and si.item_id is not null
    group by si.item_id, it.name, it.sku order by 7 desc;
  elsif p_group = 'wo' then
    return query
    select s.work_order_id, w.wo_no, w.plate_no, count(*)::numeric, sum(si.net_amount)::numeric, sum(si.cost_total)::numeric,
           (sum(si.net_amount) - sum(si.cost_total))::numeric
    from public.sale_items si join public.sales s on s.id = si.sale_id join public.work_orders w on w.id = s.work_order_id
    where s.status = 'posted' and s.branch_id = app.current_branch_id() and s.sale_date between p_from and p_to and s.work_order_id is not null
    group by s.work_order_id, w.wo_no, w.plate_no order by 7 desc;
  else
    raise exception 'Kelompok margin tidak dikenal' using errcode = '22023';
  end if;
end;
$$;

-- =============================================================================
-- Tampilan
-- =============================================================================
create view public.v_cash_transactions with (security_invoker = true) as
  select t.id, t.branch_id, t.txn_no, t.txn_date, t.kind, t.cash_bank_account_id, cb.name as cash_bank_name,
         t.to_cash_bank_account_id, tb.name as to_cash_bank_name, t.account_id, a.code as account_code, a.name as account_name,
         t.amount, t.description, t.recurring_id, t.status, t.void_reason, t.created_at
  from public.cash_transactions t
  join public.cash_bank_accounts cb on cb.id = t.cash_bank_account_id
  left join public.cash_bank_accounts tb on tb.id = t.to_cash_bank_account_id
  left join public.accounts a on a.id = t.account_id;

create view public.v_recurring_expenses with (security_invoker = true) as
  select r.id, r.branch_id, r.name, r.account_id, a.name as account_name, r.cash_bank_account_id, cb.name as cash_bank_name,
         r.amount, r.day_of_month, r.is_active,
         exists (select 1 from public.cash_transactions t where t.recurring_id = r.id and t.status = 'posted'
                 and to_char(t.txn_date, 'YYYY-MM') = to_char(app.today_wib(), 'YYYY-MM')) as confirmed_this_month,
         (select max(t.txn_date) from public.cash_transactions t where t.recurring_id = r.id and t.status = 'posted') as last_confirmed_on
  from public.recurring_expenses r
  join public.accounts a on a.id = r.account_id
  join public.cash_bank_accounts cb on cb.id = r.cash_bank_account_id;

-- Jurnal beserta jumlah dan status pembalik (tunduk RLS pemanggil)
create view public.v_journal_entries with (security_invoker = true) as
  select e.id, e.branch_id, e.entry_no, e.entry_date, e.source_type, e.source_id, e.description, e.reversal_of, e.created_at,
         coalesce(s.total, 0)::numeric(18,2) as total,
         exists (select 1 from public.journal_entries r where r.reversal_of = e.id) as is_reversed
  from public.journal_entries e
  left join lateral (select sum(l.debit) as total from public.journal_lines l where l.entry_id = e.id) s on true;

-- =============================================================================
-- RLS & hak akses
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array['fiscal_periods', 'cash_transactions', 'recurring_expenses'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

create policy fiscal_periods_select on public.fiscal_periods for select to authenticated
  using (branch_id = app.current_branch_id() and (app.has_permission('journal', 'view') or app.has_permission('finance_reports', 'view')));
create policy cash_transactions_select on public.cash_transactions for select to authenticated
  using (branch_id = app.current_branch_id()
         and (app.has_permission('expenses', 'view') or app.has_permission('journal', 'view') or app.has_permission('finance_reports', 'view')));
create policy recurring_expenses_select on public.recurring_expenses for select to authenticated
  using (branch_id = app.current_branch_id() and app.has_permission('expenses', 'view'));

grant select on public.v_cash_transactions, public.v_recurring_expenses, public.v_journal_entries to authenticated;

revoke all on function app.assert_report_access() from public, anon, authenticated;

revoke all on function public.save_account(uuid, jsonb), public.set_account_active(uuid, boolean),
  public.save_cash_bank_account(uuid, jsonb), public.post_cash_transaction(jsonb), public.void_cash_transaction(uuid, text),
  public.save_recurring_expense(uuid, jsonb), public.set_recurring_expense_active(uuid, boolean),
  public.confirm_recurring_expense(uuid, date, numeric), public.post_manual_journal(date, text, jsonb),
  public.reverse_manual_journal(uuid, text), public.close_fiscal_period(integer, integer),
  public.reopen_fiscal_period(integer, integer, text), public.report_account_balances(date, date),
  public.report_profit_loss(date, date), public.report_balance_sheet(date), public.report_cash_flow(date, date),
  public.report_cash_bank_balances(date), public.report_ledger(uuid, date, date), public.report_margin(text, date, date)
  from public, anon;
grant execute on function public.save_account(uuid, jsonb), public.set_account_active(uuid, boolean),
  public.save_cash_bank_account(uuid, jsonb), public.post_cash_transaction(jsonb), public.void_cash_transaction(uuid, text),
  public.save_recurring_expense(uuid, jsonb), public.set_recurring_expense_active(uuid, boolean),
  public.confirm_recurring_expense(uuid, date, numeric), public.post_manual_journal(date, text, jsonb),
  public.reverse_manual_journal(uuid, text), public.close_fiscal_period(integer, integer),
  public.reopen_fiscal_period(integer, integer, text), public.report_account_balances(date, date),
  public.report_profit_loss(date, date), public.report_balance_sheet(date), public.report_cash_flow(date, date),
  public.report_cash_bank_balances(date), public.report_ledger(uuid, date, date), public.report_margin(text, date, date)
  to authenticated;
