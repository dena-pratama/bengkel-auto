-- =============================================================================
-- Pajak (PRD §12, §17.5-17.6): profil pajak, tarif PPN bertanggal, laporan PPN,
-- PPh Final UMKM bulanan (jurnal otomatis), setor pajak, dan estimasi PPh tarif umum (dihitung di aplikasi).
-- PPN tetap dihitung di invoice oleh app.compute_sale (saklar settings.ppn_enabled); migration ini
-- menjaga saklar itu lewat profil pajak (PPN hanya bisa aktif jika PKP).
-- =============================================================================

create table public.tax_settings (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid not null unique references public.branches(id),
  business_form   text not null default 'orang_pribadi'
                  check (business_form in ('orang_pribadi', 'pt_perorangan', 'koperasi', 'cv_firma_pt')),
  is_pkp          boolean not null default false,
  pph_mode        text not null default 'off' check (pph_mode in ('off', 'final', 'general')),
  pph_final_rate  numeric(5,3) not null default 0.5 check (pph_final_rate between 0 and 100),
  general_rate    numeric(5,2) not null default 22 check (general_rate between 0 and 100),
  annual_ceiling  numeric(18,2) not null default 4800000000 check (annual_ceiling > 0),   -- batas omzet PPh Final
  free_threshold  numeric(18,2) not null default 500000000 check (free_threshold >= 0),  -- omzet bebas PPh (Orang Pribadi)
  facility_end_date date,                                                                 -- akhir fasilitas PPh Final (CV/Firma/PT)
  pph_due_day     integer not null default 15 check (pph_due_day between 1 and 28),
  created_at      timestamptz not null default now(),
  created_by      uuid default auth.uid(),
  updated_at      timestamptz not null default now()
);
insert into public.tax_settings (branch_id) select id from public.branches where code = 'PST';

-- Ringkasan PPh Final per bulan yang sudah diposting
create table public.tax_period_summaries (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid not null references public.branches(id),
  period_year      integer not null,
  period_month     integer not null check (period_month between 1 and 12),
  omzet            numeric(18,2) not null,
  cumulative_omzet numeric(18,2) not null,
  taxable_omzet    numeric(18,2) not null check (taxable_omzet >= 0),
  pph_amount       numeric(18,2) not null check (pph_amount >= 0),
  journal_entry_id uuid references public.journal_entries(id),
  status           public.doc_status not null default 'posted',
  void_reason      text,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid(),
  updated_at       timestamptz not null default now()
);
create unique index uq_tax_summary_posted on public.tax_period_summaries (branch_id, period_year, period_month) where status = 'posted';

-- Setor pajak ke kas negara
create table public.tax_payments (
  id                   uuid primary key default gen_random_uuid(),
  branch_id            uuid not null references public.branches(id),
  tax_type             text not null check (tax_type in ('pph_final', 'ppn')),
  period_year          integer,
  period_month         integer check (period_month between 1 and 12),
  amount               numeric(18,2) not null check (amount > 0),
  pay_date             date not null,
  cash_bank_account_id uuid not null references public.cash_bank_accounts(id),
  reference            text,
  status               public.doc_status not null default 'posted',
  void_reason          text,
  created_at           timestamptz not null default now(),
  created_by           uuid default auth.uid(),
  updated_at           timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array['tax_settings', 'tax_period_summaries', 'tax_payments'] loop
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$I
                    for each row execute function app.set_updated_at()', t);
    execute format('create trigger trg_audit after insert or update or delete on public.%I
                    for each row execute function app.audit_row_change()', t);
    execute format('create trigger trg_no_delete before delete on public.%I
                    for each row execute function app.prevent_modification()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy %1$s_select on public.%1$I for select to authenticated
                    using (branch_id = app.current_branch_id() and (app.has_permission(''tax_settings'', ''view'') or app.has_permission(''finance_reports'', ''view'')))', t);
  end loop;
end $$;

-- =============================================================================
-- Profil pajak
-- p_data: business_form, is_pkp, ppn_enabled, prices_include_ppn, pph_mode, pph_final_rate, general_rate,
--         annual_ceiling, free_threshold, facility_end_date?, pph_due_day
-- =============================================================================
create or replace function public.save_tax_settings(p_data jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_form   text := p_data ->> 'business_form';
  v_pkp    boolean := coalesce((p_data ->> 'is_pkp')::boolean, false);
  v_ppn    boolean := coalesce((p_data ->> 'ppn_enabled')::boolean, false);
  v_incl   boolean := coalesce((p_data ->> 'prices_include_ppn')::boolean, false);
  v_mode   text := coalesce(p_data ->> 'pph_mode', 'off');
  v_facility date := nullif(p_data ->> 'facility_end_date', '')::date;
begin
  perform app.assert_permission('tax_settings', 'update');
  if v_form not in ('orang_pribadi', 'pt_perorangan', 'koperasi', 'cv_firma_pt') then raise exception 'Bentuk usaha tidak valid' using errcode = '22023'; end if;
  if v_mode not in ('off', 'final', 'general') then raise exception 'Pilihan PPh tidak valid' using errcode = '22023'; end if;
  if v_ppn and not v_pkp then raise exception 'PPN hanya bisa diaktifkan jika bengkel berstatus PKP' using errcode = '22023'; end if;
  if v_mode = 'final' and v_form = 'cv_firma_pt' and v_facility is null then
    raise exception 'CV/Firma/PT wajib mengisi tanggal akhir fasilitas PPh Final' using errcode = '22023';
  end if;

  update public.tax_settings
     set business_form = v_form, is_pkp = v_pkp, pph_mode = v_mode,
         pph_final_rate = coalesce(nullif(p_data ->> 'pph_final_rate', '')::numeric, pph_final_rate),
         general_rate = coalesce(nullif(p_data ->> 'general_rate', '')::numeric, general_rate),
         annual_ceiling = coalesce(nullif(p_data ->> 'annual_ceiling', '')::numeric, annual_ceiling),
         free_threshold = coalesce(nullif(p_data ->> 'free_threshold', '')::numeric, free_threshold),
         facility_end_date = v_facility,
         pph_due_day = coalesce(nullif(p_data ->> 'pph_due_day', '')::int, pph_due_day)
   where branch_id = v_branch;

  -- Saklar yang dibaca invoice & penerimaan barang
  update public.settings set value = to_jsonb(v_ppn) where branch_id = v_branch and key = 'ppn_enabled';
  update public.settings set value = to_jsonb(v_incl) where branch_id = v_branch and key = 'prices_include_ppn';
end;
$$;

-- Tarif PPN baru berlaku mulai tanggal tertentu; tarif lama otomatis berakhir sehari sebelumnya
-- p_data: rate_percent, dpp_numerator, dpp_denominator, valid_from
create or replace function public.add_tax_rate(p_data jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_from   date := (p_data ->> 'valid_from')::date;
  v_last   public.tax_rates%rowtype;
  v_id     uuid;
begin
  perform app.assert_permission('tax_settings', 'create');
  select * into v_last from public.tax_rates where branch_id = v_branch and tax_type = 'ppn' order by valid_from desc limit 1;
  if found and v_from <= v_last.valid_from then
    raise exception 'Tanggal berlaku harus setelah tarif terakhir (%)', to_char(v_last.valid_from, 'DD/MM/YYYY') using errcode = '22023';
  end if;
  if found then update public.tax_rates set valid_to = v_from - 1 where id = v_last.id and (valid_to is null or valid_to >= v_from); end if;
  insert into public.tax_rates (branch_id, rate_percent, dpp_numerator, dpp_denominator, valid_from)
  values (v_branch, (p_data ->> 'rate_percent')::numeric, coalesce(nullif(p_data ->> 'dpp_numerator', '')::int, 11),
          coalesce(nullif(p_data ->> 'dpp_denominator', '')::int, 12), v_from)
  returning id into v_id;
  return v_id;
end;
$$;

-- =============================================================================
-- PPh Final UMKM (PRD §17.6)
-- =============================================================================

-- Omzet sebulan: pendapatan (akun jenis pendapatan, sudah memuat diskon dan retur) tanpa PPN
create or replace function app.month_omzet(p_year integer, p_month integer)
returns numeric
language sql stable security definer
set search_path = ''
as $$
  select coalesce(sum(l.credit - l.debit), 0)::numeric
  from public.journal_lines l
  join public.journal_entries e on e.id = l.entry_id
  join public.accounts a on a.id = l.account_id
  where a.branch_id = app.current_branch_id() and a.type = 'revenue'
    and e.entry_date between make_date(p_year, p_month, 1) and (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date
$$;

-- Omzet, kumulatif, omzet kena pajak, dan PPh Final per bulan untuk satu tahun
create or replace function public.tax_overview(p_year integer)
returns table (month integer, omzet numeric, cumulative numeric, taxable numeric, pph numeric,
               summary_id uuid, posted boolean, posted_pph numeric)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  s       public.tax_settings%rowtype;
  v_thr   numeric;
  v_cum   numeric := 0;
  v_prev  numeric := 0;
  m       integer;
  om      numeric;
  tx      numeric;
begin
  perform app.assert_any_permission(array['tax_settings:view', 'finance_reports:view']);
  select * into s from public.tax_settings where branch_id = app.current_branch_id();
  -- Rp500 juta pertama bebas hanya untuk Orang Pribadi
  v_thr := case when s.business_form = 'orang_pribadi' then s.free_threshold else 0 end;
  for m in 1..12 loop
    om := app.month_omzet(p_year, m);
    v_prev := v_cum;
    v_cum := v_cum + om;
    tx := greatest(greatest(v_cum - v_thr, 0) - greatest(v_prev - v_thr, 0), 0);
    return query
      select m, om, v_cum, tx, round(tx * s.pph_final_rate / 100, 0)::numeric, ps.id, ps.id is not null, ps.pph_amount::numeric
      from (select 1) x
      left join public.tax_period_summaries ps
        on ps.branch_id = app.current_branch_id() and ps.period_year = p_year and ps.period_month = m and ps.status = 'posted';
  end loop;
end;
$$;

-- Posting PPh Final bulan yang sudah berakhir: Dr Beban PPh Final, Cr Hutang PPh Final (jurnal akhir bulan)
create or replace function public.post_pph_final(p_year integer, p_month integer)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  s        public.tax_settings%rowtype;
  v_first  date := make_date(p_year, p_month, 1);
  v_last   date := (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date;
  r        record;
  v_id     uuid;
  v_je     uuid;
begin
  perform app.assert_permission('tax_settings', 'update');
  select * into s from public.tax_settings where branch_id = v_branch;
  if s.pph_mode <> 'final' then raise exception 'PPh Final belum diaktifkan di pengaturan pajak' using errcode = '22023'; end if;
  if v_first >= date_trunc('month', app.today_wib())::date then
    raise exception 'Hanya bulan yang sudah berakhir yang bisa diposting' using errcode = '22023';
  end if;
  if exists (select 1 from public.tax_period_summaries where branch_id = v_branch and period_year = p_year and period_month = p_month and status = 'posted') then
    raise exception 'PPh Final bulan ini sudah diposting' using errcode = '22023';
  end if;
  if s.business_form = 'cv_firma_pt' and (s.facility_end_date is null or v_last > s.facility_end_date) then
    raise exception 'Fasilitas PPh Final tidak berlaku untuk bulan ini (CV/Firma/PT); gunakan tarif umum' using errcode = '22023';
  end if;

  select * into r from public.tax_overview(p_year) where month = p_month;
  insert into public.tax_period_summaries (branch_id, period_year, period_month, omzet, cumulative_omzet, taxable_omzet, pph_amount)
  values (v_branch, p_year, p_month, r.omzet, r.cumulative, r.taxable, r.pph) returning id into v_id;

  if r.pph > 0 then
    v_je := app.post_journal(v_last, 'pph_final', v_id, 'PPh Final ' || to_char(v_first, 'MM/YYYY'),
      jsonb_build_array(jsonb_build_object('account', 'pph_final_expense', 'debit', r.pph),
                        jsonb_build_object('account', 'pph_final_payable', 'credit', r.pph)));
    update public.tax_period_summaries set journal_entry_id = v_je where id = v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.void_pph_final(p_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row public.tax_period_summaries%rowtype;
begin
  perform app.assert_permission('tax_settings', 'update');
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Alasan pembatalan wajib diisi' using errcode = '22023'; end if;
  select * into v_row from public.tax_period_summaries where id = p_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Ringkasan PPh tidak ditemukan' using errcode = 'P0002'; end if;
  if v_row.status = 'void' then raise exception 'Sudah dibatalkan' using errcode = '22023'; end if;
  update public.tax_period_summaries set status = 'void', void_reason = btrim(p_reason) where id = p_id;
  perform app.reverse_journals('pph_final', p_id, app.today_wib(), 'Batal PPh Final ' || to_char(make_date(v_row.period_year, v_row.period_month, 1), 'MM/YYYY') || ': ' || btrim(p_reason));
end;
$$;

-- =============================================================================
-- Setor pajak. p_data: tax_type (pph_final|ppn), period_year?, period_month?, amount, pay_date?, cash_bank_account_id, reference?
-- PPh Final: Dr Hutang PPh Final, Cr Kas/Bank. PPN: Dr PPN Keluaran, Cr Kas/Bank.
-- =============================================================================
create or replace function public.post_tax_payment(p_data jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_type   text := p_data ->> 'tax_type';
  v_amount numeric(18,2) := round(coalesce(nullif(p_data ->> 'amount', '')::numeric, 0), 2);
  v_date   date := coalesce(nullif(p_data ->> 'pay_date', '')::date, app.today_wib());
  v_cash   uuid;
  v_owed   numeric;
  v_id     uuid;
begin
  perform app.assert_permission('tax_settings', 'create');
  if v_type not in ('pph_final', 'ppn') then raise exception 'Jenis pajak tidak valid' using errcode = '22023'; end if;
  if v_amount <= 0 then raise exception 'Jumlah harus lebih dari nol' using errcode = '22023'; end if;
  if v_date > app.today_wib() then raise exception 'Tanggal tidak boleh di masa depan' using errcode = '22023'; end if;
  select account_id into v_cash from public.cash_bank_accounts
   where id = (p_data ->> 'cash_bank_account_id')::uuid and branch_id = v_branch and is_active;
  if v_cash is null then raise exception 'Pilih akun kas/bank yang aktif' using errcode = '22023'; end if;

  if v_type = 'pph_final' then
    select coalesce(sum(l.credit - l.debit), 0) into v_owed from public.journal_lines l
     where l.account_id = app.account_id('pph_final_payable');
    if v_amount > v_owed then raise exception 'Jumlah melebihi hutang PPh Final (%)', v_owed using errcode = '23514'; end if;
  end if;

  insert into public.tax_payments (branch_id, tax_type, period_year, period_month, amount, pay_date, cash_bank_account_id, reference)
  values (v_branch, v_type, nullif(p_data ->> 'period_year', '')::int, nullif(p_data ->> 'period_month', '')::int, v_amount, v_date,
          (p_data ->> 'cash_bank_account_id')::uuid, nullif(btrim(p_data ->> 'reference'), ''))
  returning id into v_id;

  perform app.post_journal(v_date, 'tax_payment', v_id, case when v_type = 'pph_final' then 'Setor PPh Final' else 'Setor PPN' end,
    jsonb_build_array(jsonb_build_object('account', case when v_type = 'pph_final' then 'pph_final_payable' else 'ppn_out' end, 'debit', v_amount),
                      jsonb_build_object('account_id', v_cash, 'credit', v_amount)));
  return v_id;
end;
$$;

create or replace function public.void_tax_payment(p_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform app.assert_permission('tax_settings', 'update');
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Alasan pembatalan wajib diisi' using errcode = '22023'; end if;
  update public.tax_payments set status = 'void', void_reason = btrim(p_reason)
   where id = p_id and branch_id = app.current_branch_id() and status = 'posted';
  if not found then raise exception 'Setoran tidak ditemukan atau sudah dibatalkan' using errcode = 'P0002'; end if;
  perform app.reverse_journals('tax_payment', p_id, app.today_wib(), 'Batal setor pajak: ' || btrim(p_reason));
end;
$$;

-- =============================================================================
-- Laporan PPN: ringkasan Keluaran, Masukan, selisih (dari jurnal) dan daftar dokumen (untuk Excel)
-- =============================================================================
create or replace function public.report_ppn(p_from date, p_to date)
returns table (line text, amount numeric)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_out  numeric;
  v_in   numeric;
  v_paid numeric;
begin
  perform app.assert_any_permission(array['tax_settings:view', 'finance_reports:view']);
  select coalesce(sum(l.credit - l.debit), 0) into v_out from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
   where l.account_id = app.account_id('ppn_out') and e.entry_date between p_from and p_to and e.source_type <> 'tax_payment';
  select coalesce(sum(l.debit - l.credit), 0) into v_in from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
   where l.account_id = app.account_id('ppn_in') and e.entry_date between p_from and p_to;
  select coalesce(sum(tp.amount), 0) into v_paid from public.tax_payments tp
   where tp.branch_id = app.current_branch_id() and tp.tax_type = 'ppn' and tp.status = 'posted' and tp.pay_date between p_from and p_to;
  return query values ('keluaran'::text, v_out), ('masukan'::text, v_in), ('selisih'::text, v_out - v_in), ('disetor'::text, v_paid);
end;
$$;

create or replace function public.report_ppn_documents(p_from date, p_to date)
returns table (kind text, doc_id uuid, doc_no text, doc_date date, party text, npwp text, dpp numeric, ppn numeric, total numeric)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform app.assert_any_permission(array['tax_settings:view', 'finance_reports:view']);
  return query
  select 'keluaran'::text, s.id, s.sale_no, s.sale_date, coalesce(c.name, 'Umum'), c.npwp, (s.total - s.ppn_amount)::numeric, s.ppn_amount::numeric, s.total::numeric
  from public.sales s left join public.customers c on c.id = s.customer_id
  where s.branch_id = app.current_branch_id() and s.status = 'posted' and s.ppn_amount > 0 and s.sale_date between p_from and p_to
  union all
  select 'retur_keluaran'::text, r.id, r.return_no, r.return_date, coalesce(c.name, 'Umum'), c.npwp, (-r.amount)::numeric, (-r.ppn_amount)::numeric, (-r.total)::numeric
  from public.sale_returns r left join public.customers c on c.id = r.customer_id
  where r.branch_id = app.current_branch_id() and r.status = 'posted' and r.ppn_amount > 0 and r.return_date between p_from and p_to
  union all
  select 'masukan'::text, g.id, g.gr_no, g.receipt_date, sp.name, sp.npwp, g.subtotal::numeric, g.ppn_amount::numeric, g.total::numeric
  from public.goods_receipts g join public.suppliers sp on sp.id = g.supplier_id
  where g.branch_id = app.current_branch_id() and g.status = 'posted' and g.ppn_amount > 0 and not g.ppn_capitalized
    and g.receipt_date between p_from and p_to
  order by 4, 3;
end;
$$;

revoke all on function app.month_omzet(integer, integer) from public, anon, authenticated;
revoke all on function public.save_tax_settings(jsonb), public.add_tax_rate(jsonb), public.tax_overview(integer),
  public.post_pph_final(integer, integer), public.void_pph_final(uuid, text), public.post_tax_payment(jsonb),
  public.void_tax_payment(uuid, text), public.report_ppn(date, date), public.report_ppn_documents(date, date) from public, anon;
grant execute on function public.save_tax_settings(jsonb), public.add_tax_rate(jsonb), public.tax_overview(integer),
  public.post_pph_final(integer, integer), public.void_pph_final(uuid, text), public.post_tax_payment(jsonb),
  public.void_tax_payment(uuid, text), public.report_ppn(date, date), public.report_ppn_documents(date, date) to authenticated;
