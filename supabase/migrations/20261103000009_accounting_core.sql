-- =============================================================================
-- Inti akuntansi (PRD §11.2-11.3): bagan akun, jurnal double-entry, akun kas/bank.
-- Jurnal hanya ditulis lewat app.post_journal() dari fungsi modul (penerimaan barang,
-- pembayaran, dll.) di transaksi yang sama dengan dokumen & stoknya (aturan #1, #9).
-- Jurnal tidak bisa diedit; koreksi lewat pembatalan dokumen / jurnal pembalik.
-- =============================================================================

create type public.account_type as enum ('asset', 'liability', 'equity', 'revenue', 'cogs', 'expense', 'other');
create type public.cash_bank_kind as enum ('cash', 'bank');

create table public.accounts (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid not null references public.branches(id),
  code           text not null check (code ~ '^[1-7]-[0-9]{4}$'),
  name           text not null check (length(btrim(name)) between 2 and 80),
  type           public.account_type not null,
  normal_balance text not null check (normal_balance in ('debit', 'credit')),
  system_key     text,            -- dipakai jurnal otomatis; akun sistem tidak bisa dinonaktifkan
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  updated_at     timestamptz not null default now(),
  unique (branch_id, code),
  unique (branch_id, system_key)
);

create table public.cash_bank_accounts (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid not null references public.branches(id),
  name           text not null check (length(btrim(name)) between 2 and 60),
  kind           public.cash_bank_kind not null,
  account_id     uuid not null references public.accounts(id),
  bank_name      text,
  account_number text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  updated_at     timestamptz not null default now()
);
create unique index uq_cash_bank_accounts_name on public.cash_bank_accounts (branch_id, lower(name));

create table public.journal_entries (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches(id),
  entry_no    text not null,
  entry_date  date not null,
  source_type text not null,          -- goods_receipt, supplier_payment, purchase_return, manual, ...
  source_id   uuid,
  description text not null,
  reversal_of uuid references public.journal_entries(id),
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now(),
  unique (branch_id, entry_no)
);
create index idx_journal_entries_source on public.journal_entries (source_type, source_id);
create index idx_journal_entries_date on public.journal_entries (branch_id, entry_date);

create table public.journal_lines (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id),
  entry_id   uuid not null references public.journal_entries(id),
  account_id uuid not null references public.accounts(id),
  debit      numeric(18,2) not null default 0 check (debit >= 0),
  credit     numeric(18,2) not null default 0 check (credit >= 0),
  memo       text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  check ((debit > 0) <> (credit > 0))
);
create index idx_journal_lines_entry on public.journal_lines (entry_id);
create index idx_journal_lines_account on public.journal_lines (account_id);

-- Jurnal append-only
create trigger trg_journal_entries_immutable before update or delete on public.journal_entries
  for each row execute function app.prevent_modification();
create trigger trg_journal_lines_immutable before update or delete on public.journal_lines
  for each row execute function app.prevent_modification();
create trigger trg_journal_entries_no_truncate before truncate on public.journal_entries
  for each statement execute function app.prevent_modification();
create trigger trg_journal_lines_no_truncate before truncate on public.journal_lines
  for each statement execute function app.prevent_modification();

do $$
declare
  t text;
begin
  foreach t in array array['accounts', 'cash_bank_accounts'] loop
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$I
                    for each row execute function app.set_updated_at()', t);
    execute format('create trigger trg_audit after insert or update or delete on public.%I
                    for each row execute function app.audit_row_change()', t);
    execute format('create trigger trg_no_delete before delete on public.%I
                    for each row execute function app.prevent_modification()', t);
  end loop;
end $$;
create trigger trg_audit after insert on public.journal_entries
  for each row execute function app.audit_row_change();

-- =============================================================================
-- Data awal: bagan akun default (PRD §11.2) & akun kas/bank
-- =============================================================================
insert into public.accounts (branch_id, code, name, type, normal_balance, system_key)
select b.id, a.code, a.name, a.type::public.account_type,
       case when a.type in ('asset', 'cogs', 'expense') then 'debit' else 'credit' end, a.key
from public.branches b, (values
  ('1-1001', 'Kas', 'asset', 'cash'),
  ('1-1002', 'Bank', 'asset', 'bank'),
  ('1-1100', 'Piutang Usaha', 'asset', 'ar'),
  ('1-1200', 'Persediaan Sparepart', 'asset', 'inventory'),
  ('1-1210', 'Persediaan dalam Pengerjaan', 'asset', 'wip'),
  ('1-1300', 'PPN Masukan', 'asset', 'ppn_in'),
  ('1-1400', 'Kasbon Karyawan', 'asset', 'employee_loan'),
  ('1-2000', 'Aset Tetap', 'asset', 'fixed_asset'),
  ('2-1001', 'Hutang Usaha', 'liability', 'ap'),
  ('2-1100', 'PPN Keluaran', 'liability', 'ppn_out'),
  ('2-1200', 'Hutang PPh Final', 'liability', 'pph_final_payable'),
  ('2-1300', 'Uang Muka Pelanggan', 'liability', 'customer_deposit'),
  ('2-1400', 'Hutang Gaji/Potongan', 'liability', 'payroll_payable'),
  ('3-1001', 'Modal Pemilik', 'equity', 'owner_equity'),
  ('3-1100', 'Prive', 'equity', 'drawing'),
  ('3-1200', 'Laba Ditahan', 'equity', 'retained_earnings'),
  ('3-1300', 'Laba Tahun Berjalan', 'equity', 'current_earnings'),
  ('4-1001', 'Pendapatan Jasa', 'revenue', 'service_revenue'),
  ('4-1100', 'Penjualan Sparepart', 'revenue', 'parts_revenue'),
  ('4-1200', 'Diskon Penjualan', 'revenue', 'sales_discount'),
  ('4-1300', 'Retur Penjualan', 'revenue', 'sales_return'),
  ('5-1001', 'HPP Sparepart', 'cogs', 'cogs'),
  ('6-1001', 'Beban Gaji', 'expense', 'salary_expense'),
  ('6-1100', 'Beban Komisi', 'expense', 'commission_expense'),
  ('6-1200', 'Beban Listrik', 'expense', null),
  ('6-1300', 'Beban Sewa', 'expense', null),
  ('6-1400', 'Beban Garansi', 'expense', 'warranty_expense'),
  ('6-1500', 'Selisih Persediaan', 'expense', 'inventory_variance'),
  ('6-1600', 'Selisih Kas', 'expense', 'cash_variance'),
  ('6-1700', 'Beban PPh Final', 'expense', 'pph_final_expense'),
  ('7-1001', 'Pendapatan Lain', 'other', 'other_income'),
  ('7-1100', 'Beban Lain', 'other', 'other_expense')
) as a(code, name, type, key)
where b.code = 'PST';

-- Pendapatan lain bersaldo normal kredit
update public.accounts set normal_balance = 'credit' where code = '7-1001';

insert into public.cash_bank_accounts (branch_id, name, kind, account_id)
select a.branch_id, x.name, x.kind::public.cash_bank_kind, a.id
from public.accounts a
join (values ('Kas Laci', 'cash', 'cash'), ('Bank', 'bank', 'bank')) as x(name, kind, key) on x.key = a.system_key;

-- PPN: OFF sampai bengkel PKP (PRD §12). Saat OFF, PPN dari supplier ikut masuk HPP (PRD baris "tidak PKP").
insert into public.settings (branch_id, key, value, description)
select id, 'ppn_enabled', 'false', 'PPN aktif (bengkel PKP): PPN Masukan dicatat terpisah, tidak masuk HPP'
from public.branches where code = 'PST';

-- =============================================================================
-- Fungsi inti
-- =============================================================================
create or replace function app.account_id(p_key text, p_branch_id uuid default null)
returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.accounts
   where branch_id = coalesce(p_branch_id, app.current_branch_id()) and system_key = p_key;
  if v_id is null then
    raise exception 'Akun sistem "%" belum ada di bagan akun', p_key using errcode = 'P0002';
  end if;
  return v_id;
end;
$$;

create or replace function app.setting_bool(p_key text, p_branch_id uuid default null)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select (value)::text::boolean from public.settings
                   where branch_id = coalesce(p_branch_id, app.current_branch_id()) and key = p_key), false)
$$;

-- Baris jurnal dari jsonb: [{account: system_key | account_id: uuid, debit, credit, memo}].
-- Baris bernilai 0 diabaikan (mis. PPN saat nol).
create or replace function app.journal_lines_from_json(p_lines jsonb, p_branch_id uuid)
returns table (account_id uuid, debit numeric, credit numeric, memo text)
language sql stable security definer
set search_path = ''
as $f$
  select x.account_id, x.debit, x.credit, x.memo
  from (
    select coalesce(nullif(l ->> 'account_id', '')::uuid, app.account_id(l ->> 'account', p_branch_id)) as account_id,
           round(coalesce((l ->> 'debit')::numeric, 0), 2) as debit,
           round(coalesce((l ->> 'credit')::numeric, 0), 2) as credit,
           l ->> 'memo' as memo
    from jsonb_array_elements(p_lines) l
  ) x
  where x.debit <> 0 or x.credit <> 0
$f$;

-- Jurnal seimbang (debit = kredit > 0) dengan nomor JU-YYMM-####
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

  select coalesce(sum(l.debit), 0), coalesce(sum(l.credit), 0),
         bool_or(l.debit < 0 or l.credit < 0 or (l.debit > 0 and l.credit > 0)
                 or not exists (select 1 from public.accounts a where a.id = l.account_id and a.branch_id = v_branch))
    into v_debit, v_credit, v_bad
  from app.journal_lines_from_json(p_lines, v_branch) l;

  if coalesce(v_bad, false) then raise exception 'Baris jurnal tidak valid' using errcode = '22023'; end if;
  if v_debit = 0 or v_debit <> v_credit then
    raise exception 'Jurnal tidak seimbang: debit % ≠ kredit %', v_debit, v_credit using errcode = '23514';
  end if;

  insert into public.journal_entries (branch_id, entry_no, entry_date, source_type, source_id, description, reversal_of)
  values (v_branch, app.next_document_number('JU', p_date, v_branch), p_date, p_source_type, p_source_id, p_description, p_reversal_of)
  returning id into v_id;

  insert into public.journal_lines (branch_id, entry_id, account_id, debit, credit, memo)
  select v_branch, v_id, l.account_id, l.debit, l.credit, l.memo from app.journal_lines_from_json(p_lines, v_branch) l;
  return v_id;
end;
$$;

-- Jurnal pembalik untuk semua jurnal dokumen sumber (dipakai saat dokumen dibatalkan)
create or replace function app.reverse_journals(p_source_type text, p_source_id uuid, p_date date, p_description text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  e record;
begin
  for e in select je.id from public.journal_entries je
           where je.source_type = p_source_type and je.source_id = p_source_id and je.reversal_of is null
             and not exists (select 1 from public.journal_entries r where r.reversal_of = je.id) loop
    perform app.post_journal(p_date, p_source_type, p_source_id, p_description,
      (select jsonb_agg(jsonb_build_object('account_id', jl.account_id, 'debit', jl.credit, 'credit', jl.debit, 'memo', jl.memo))
         from public.journal_lines jl where jl.entry_id = e.id),
      e.id);
  end loop;
end;
$$;

revoke all on function app.account_id(text, uuid), app.setting_bool(text, uuid), app.journal_lines_from_json(jsonb, uuid),
  app.post_journal(date, text, uuid, text, jsonb, uuid), app.reverse_journals(text, uuid, date, text)
  from public, anon, authenticated;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.accounts           enable row level security;
alter table public.cash_bank_accounts enable row level security;
alter table public.journal_entries    enable row level security;
alter table public.journal_lines      enable row level security;

revoke all on public.accounts, public.cash_bank_accounts, public.journal_entries, public.journal_lines from anon;
revoke insert, update, delete, truncate on public.accounts, public.cash_bank_accounts, public.journal_entries,
  public.journal_lines from authenticated;
grant select on public.accounts, public.cash_bank_accounts, public.journal_entries, public.journal_lines to authenticated;

-- Bagan akun & daftar kas/bank: semua karyawan aktif (untuk memilih metode bayar)
create policy accounts_select on public.accounts for select to authenticated
  using (branch_id = app.current_branch_id());
create policy cash_bank_accounts_select on public.cash_bank_accounts for select to authenticated
  using (branch_id = app.current_branch_id());
-- Jurnal: hanya izin jurnal / laporan keuangan
create policy journal_entries_select on public.journal_entries for select to authenticated
  using (branch_id = app.current_branch_id()
         and (app.has_permission('journal', 'view') or app.has_permission('finance_reports', 'view')));
create policy journal_lines_select on public.journal_lines for select to authenticated
  using (branch_id = app.current_branch_id()
         and (app.has_permission('journal', 'view') or app.has_permission('finance_reports', 'view')));
