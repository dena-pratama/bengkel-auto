-- =============================================================================
-- Kasir: shift kas, penjualan part (POS), invoice work order, pembayaran, DP, piutang, komisi
-- (PRD §8, §10.3, §11.3, §12.2, §17.4-17.5)
-- Semua tagihan masuk Piutang Usaha lebih dulu; tiap pembayaran/DP yang dipakai melunasi piutang itu.
-- Jadi saldo Piutang Usaha selalu = total tagihan belum lunas.
--   Invoice : Dr Piutang; Dr HPP Sparepart; Cr Pendapatan Jasa / Penjualan Sparepart / PPN Keluaran;
--             Cr Persediaan (POS) atau Persediaan dalam Pengerjaan (WO)
--   Bayar   : Dr Kas/Bank, Cr Piutang        DP diterima: Dr Kas/Bank, Cr Uang Muka Pelanggan
--   DP dipakai: Dr Uang Muka Pelanggan, Cr Piutang
-- Retur penjualan menyusul di versi berikutnya.
-- =============================================================================

create type public.sale_status as enum ('draft', 'posted', 'void');
create type public.sale_source as enum ('pos', 'work_order');
create type public.payment_method as enum ('cash', 'transfer', 'qris', 'card', 'deposit');
create type public.payment_kind as enum ('sale', 'deposit');
create type public.shift_status as enum ('open', 'closed', 'approved');
create type public.commission_status as enum ('pending', 'recognized', 'void');

-- -----------------------------------------------------------------------------
-- Tarif pajak bertanggal (PRD §12, aturan teknis #8). Saklar PPN tetap di settings.ppn_enabled.
-- -----------------------------------------------------------------------------
create table public.tax_rates (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid not null references public.branches(id),
  tax_type     text not null default 'ppn' check (tax_type = 'ppn'),
  rate_percent numeric(6,3) not null check (rate_percent >= 0),       -- 12 = 12%
  dpp_numerator   integer not null default 11 check (dpp_numerator > 0),
  dpp_denominator integer not null default 12 check (dpp_denominator > 0),
  valid_from   date not null,
  valid_to     date,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  updated_at   timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from),
  unique (branch_id, tax_type, valid_from)
);

insert into public.tax_rates (branch_id, rate_percent, dpp_numerator, dpp_denominator, valid_from)
select id, 12, 11, 12, date '2025-01-01' from public.branches where code = 'PST';

insert into public.settings (branch_id, key, value, description)
select id, s.key, s.value::jsonb, s.description
from public.branches, (values
  ('prices_include_ppn',     'false', 'Harga jual sudah termasuk PPN (berlaku jika PPN aktif)'),
  ('discount_limit_cashier', '5',     'Batas diskon Kasir (% dari harga normal); di atasnya perlu PIN'),
  ('discount_limit_admin',   '10',    'Batas diskon Admin (% dari harga normal); di atasnya perlu PIN Owner')
) as s(key, value, description)
where code = 'PST';

-- -----------------------------------------------------------------------------
-- Shift kas
-- -----------------------------------------------------------------------------
create table public.cash_shifts (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid not null references public.branches(id),
  shift_no       text not null,
  cashier_id     uuid not null references public.employees(id),
  opened_at      timestamptz not null default now(),
  opening_cash   numeric(18,2) not null check (opening_cash >= 0),
  status         public.shift_status not null default 'open',
  closed_at      timestamptz,
  expected_cash  numeric(18,2),
  counted_cash   numeric(18,2) check (counted_cash >= 0),
  variance       numeric(18,2),
  denominations  jsonb,
  close_note     text,
  approved_by    uuid references public.employees(id),
  approved_at    timestamptz,
  approval_note  text,
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  updated_at     timestamptz not null default now(),
  unique (branch_id, shift_no)
);
create unique index uq_cash_shift_open on public.cash_shifts (cashier_id) where status = 'open';

-- Kas keluar kecil (bensin, parkir, makan) langsung di shift, dengan akun beban
create table public.cash_movements (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id),
  shift_id   uuid not null references public.cash_shifts(id),
  account_id uuid not null references public.accounts(id),
  amount     numeric(18,2) not null check (amount > 0),
  note       text not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
create index idx_cash_movements_shift on public.cash_movements (shift_id);

-- -----------------------------------------------------------------------------
-- Penjualan / invoice
-- -----------------------------------------------------------------------------
create table public.sales (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid not null references public.branches(id),
  sale_no          text,                                  -- diberikan saat diposting
  source           public.sale_source not null,
  work_order_id    uuid references public.work_orders(id),
  customer_id      uuid references public.customers(id),  -- null = Umum
  plate_no         text,
  sale_date        date not null default app.today_wib(),
  due_date         date,
  status           public.sale_status not null default 'draft',
  subtotal         numeric(18,2) not null default 0 check (subtotal >= 0),         -- jumlah baris setelah diskon baris
  discount_amount  numeric(18,2) not null default 0 check (discount_amount >= 0),  -- diskon tingkat dokumen
  ppn_amount       numeric(18,2) not null default 0 check (ppn_amount >= 0),
  ppn_included     boolean not null default false,
  total            numeric(18,2) not null default 0 check (total >= 0),
  service_revenue  numeric(18,2) not null default 0,
  parts_revenue    numeric(18,2) not null default 0,
  cogs_total       numeric(18,2) not null default 0,
  notes            text,
  discount_approved_by uuid references public.employees(id),
  credit_approved_by   uuid references public.employees(id),
  void_reason      text,
  posted_at        timestamptz,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid(),
  updated_at       timestamptz not null default now(),
  check (source <> 'work_order' or work_order_id is not null),
  check (status <> 'posted' or sale_no is not null)
);
create unique index uq_sales_no on public.sales (branch_id, sale_no) where sale_no is not null;
create unique index uq_sales_wo_invoice on public.sales (work_order_id) where status = 'posted' and work_order_id is not null;
create index idx_sales_customer on public.sales (customer_id, sale_date desc);
create index idx_sales_status on public.sales (branch_id, status, sale_date desc);

create table public.sale_items (
  id                 uuid primary key default gen_random_uuid(),
  branch_id          uuid not null references public.branches(id),
  sale_id            uuid not null references public.sales(id),
  line_type          public.service_line_type not null,
  service_id         uuid references public.services(id),
  item_id            uuid references public.items(id),
  work_order_item_id uuid references public.work_order_items(id),
  description        text not null,
  qty                numeric(14,3) not null check (qty > 0),
  unit_price         numeric(18,2) not null check (unit_price >= 0),
  discount_amount    numeric(18,2) not null default 0 check (discount_amount >= 0),
  line_total         numeric(18,2) not null check (line_total >= 0),        -- setelah diskon baris
  doc_discount       numeric(18,2) not null default 0 check (doc_discount >= 0), -- jatah diskon dokumen
  net_amount         numeric(18,2) not null default 0,                       -- line_total - doc_discount
  is_taxable         boolean not null default true,
  location_id        uuid references public.locations(id),                   -- POS: rak asal stok
  cost_total         numeric(18,2) not null default 0,                       -- HPP saat diposting
  sort_order         integer not null default 0,
  created_at         timestamptz not null default now(),
  created_by         uuid default auth.uid(),
  updated_at         timestamptz not null default now(),
  check ((line_type = 'service') = (service_id is not null)),
  check ((line_type = 'part') = (item_id is not null))
);
create index idx_sale_items_sale on public.sale_items (sale_id);

-- Pembayaran & DP (append-only; koreksi lewat batal)
create table public.payments (
  id                   uuid primary key default gen_random_uuid(),
  branch_id            uuid not null references public.branches(id),
  kind                 public.payment_kind not null default 'sale',
  sale_id              uuid references public.sales(id),
  work_order_id        uuid references public.work_orders(id),     -- DP: WO tujuan
  customer_id          uuid references public.customers(id),
  shift_id             uuid references public.cash_shifts(id),     -- null untuk DP yang dipakai
  method               public.payment_method not null,
  cash_bank_account_id uuid references public.cash_bank_accounts(id),
  amount               numeric(18,2) not null check (amount > 0),
  reference            text,
  applied_sale_id      uuid references public.sales(id),           -- DP: invoice tempat DP dipakai
  applied_deposit_id   uuid references public.payments(id),        -- baris pemakaian: DP asalnya
  status               public.doc_status not null default 'posted',
  void_reason          text,
  created_at           timestamptz not null default now(),
  created_by           uuid default auth.uid(),
  updated_at           timestamptz not null default now(),
  check ((kind = 'sale') = (sale_id is not null) or kind = 'deposit'),
  check (method = 'deposit' or (shift_id is not null and cash_bank_account_id is not null))
);
create index idx_payments_sale on public.payments (sale_id);
create index idx_payments_shift on public.payments (shift_id);
create index idx_payments_deposit_wo on public.payments (work_order_id) where kind = 'deposit';

-- Komisi mekanik: tercatat saat invoice, diakui saat invoice lunas (PRD §10.3). Dibayar lewat penggajian.
create table public.commissions (
  id                 uuid primary key default gen_random_uuid(),
  branch_id          uuid not null references public.branches(id),
  sale_id            uuid not null references public.sales(id),
  sale_item_id       uuid not null references public.sale_items(id),
  work_order_id      uuid not null references public.work_orders(id),
  employee_id        uuid not null references public.employees(id),
  base_amount        numeric(18,2) not null check (base_amount >= 0),   -- harga jasa setelah diskon, tanpa PPN
  commission_type    public.commission_type not null,
  commission_value   numeric(18,2) not null,
  share_percent      numeric(5,2) not null,
  amount             numeric(18,2) not null check (amount >= 0),
  status             public.commission_status not null default 'pending',
  recognized_at      timestamptz,
  created_at         timestamptz not null default now(),
  created_by         uuid default auth.uid(),
  updated_at         timestamptz not null default now()
);
create index idx_commissions_employee on public.commissions (employee_id, status);
create index idx_commissions_sale on public.commissions (sale_id);

do $$
declare
  t text;
begin
  foreach t in array array['tax_rates', 'cash_shifts', 'cash_movements', 'sales', 'sale_items', 'payments', 'commissions'] loop
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$I
                    for each row execute function app.set_updated_at()', t);
    execute format('create trigger trg_audit after insert or update or delete on public.%I
                    for each row execute function app.audit_row_change()', t);
  end loop;
  foreach t in array array['cash_shifts', 'cash_movements', 'sales', 'payments', 'commissions', 'tax_rates'] loop
    execute format('create trigger trg_no_delete before delete on public.%I
                    for each row execute function app.prevent_modification()', t);
  end loop;
end $$;

-- =============================================================================
-- Helper
-- =============================================================================
create or replace function app.my_open_shift()
returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.cash_shifts where cashier_id = app.current_employee_id() and status = 'open';
  if v_id is null then raise exception 'Buka shift kas dulu sebelum menerima pembayaran' using errcode = '22023'; end if;
  return v_id;
end;
$$;

-- Batas diskon (%) peran pemanggil; Owner tanpa batas
create or replace function app.my_discount_limit()
returns numeric
language sql stable security definer
set search_path = ''
as $$
  select case when app.is_superuser() then 100
              else coalesce((select max((s.value)::text::numeric)
                             from public.employee_roles er
                             join public.roles r on r.id = er.role_id and r.is_active
                             join public.settings s on s.branch_id = r.branch_id and s.key = 'discount_limit_' || r.code
                             where er.employee_id = app.current_employee_id()), 0) end
$$;

-- Akun kas/bank untuk metode bayar (kas -> akun kas; lainnya -> akun bank), atau yang dipilih
create or replace function app.payment_account(p_method public.payment_method, p_account_id uuid)
returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_account_id is not null then
    select id into v_id from public.cash_bank_accounts where id = p_account_id and branch_id = app.current_branch_id() and is_active;
  else
    select id into v_id from public.cash_bank_accounts
     where branch_id = app.current_branch_id() and is_active and kind::text = case when p_method = 'cash' then 'cash' else 'bank' end
     order by created_at limit 1;
  end if;
  if v_id is null then raise exception 'Akun kas/bank untuk metode ini belum ada' using errcode = '22023'; end if;
  return v_id;
end;
$$;

create or replace function app.sale_paid(p_sale_id uuid)
returns numeric
language sql stable security definer
set search_path = ''
as $$
  select coalesce(sum(amount), 0) from public.payments where sale_id = p_sale_id and kind = 'sale' and status = 'posted'
$$;

-- Jurnal PPN dll: tarif yang berlaku pada tanggal tertentu
create or replace function app.tax_rate_on(p_date date)
returns public.tax_rates
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_rate public.tax_rates%rowtype;
begin
  select * into v_rate from public.tax_rates
   where branch_id = app.current_branch_id() and tax_type = 'ppn' and valid_from <= p_date and (valid_to is null or valid_to >= p_date)
   order by valid_from desc limit 1;
  if not found then raise exception 'Tarif PPN untuk tanggal % belum diatur', p_date using errcode = '22023'; end if;
  return v_rate;
end;
$$;

-- Diskon di atas batas peran butuh PIN pemberi persetujuan. Mengembalikan employee_id penyetuju (atau null).
create or replace function app.check_discount(p_pct numeric, p_pin text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_approver uuid;
begin
  if p_pct <= app.my_discount_limit() then return null; end if;
  if nullif(p_pin, '') is null then
    raise exception 'Diskon % persen melebihi batas Anda (% persen); perlu PIN Owner/Admin', round(p_pct, 1), app.my_discount_limit() using errcode = '42501';
  end if;
  v_approver := app.verify_approval_pin(p_pin, 'discount_override');
  if v_approver is null then raise exception 'PIN persetujuan diskon salah' using errcode = '42501'; end if;
  return v_approver;
end;
$$;

-- Hitung ulang total dokumen dari baris: jatah diskon dokumen, PPN, pembagian pendapatan
create or replace function app.compute_sale(p_sale_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_sale     public.sales%rowtype;
  v_sum      numeric(18,2);
  v_net      numeric(18,2);
  v_taxable  numeric(18,2);
  v_ppn      numeric(18,2) := 0;
  v_svc      numeric(18,2);
  v_parts    numeric(18,2);
  v_rate     public.tax_rates%rowtype;
  v_enabled  boolean := app.setting_bool('ppn_enabled');
  v_incl     boolean := app.setting_bool('prices_include_ppn');
  v_dpp      numeric(18,2);
  v_svc_tax  numeric(18,2);
  v_svc_ppn  numeric(18,2) := 0;
begin
  select * into v_sale from public.sales where id = p_sale_id;
  select coalesce(sum(line_total), 0) into v_sum from public.sale_items where sale_id = p_sale_id;
  if v_sale.discount_amount > v_sum then raise exception 'Diskon melebihi total tagihan' using errcode = '22023'; end if;

  -- Jatah diskon dokumen proporsional; sisa pembulatan ke baris terakhir
  with t as (
    select id, line_total, row_number() over (order by sort_order, id) rn, count(*) over () n
    from public.sale_items where sale_id = p_sale_id
  ), a as (
    select id, case when rn = n then v_sale.discount_amount - coalesce(sum(round(v_sale.discount_amount * line_total / nullif(v_sum, 0), 2))
                                       over (order by rn rows between unbounded preceding and 1 preceding), 0)
                    else round(v_sale.discount_amount * line_total / nullif(v_sum, 0), 2) end as alloc
    from t
  )
  update public.sale_items i set doc_discount = coalesce(a.alloc, 0), net_amount = i.line_total - coalesce(a.alloc, 0)
    from a where a.id = i.id;

  select coalesce(sum(net_amount), 0), coalesce(sum(net_amount) filter (where is_taxable), 0),
         coalesce(sum(net_amount) filter (where line_type = 'service'), 0), coalesce(sum(net_amount) filter (where line_type = 'part'), 0),
         coalesce(sum(net_amount) filter (where line_type = 'service' and is_taxable), 0)
    into v_net, v_taxable, v_svc, v_parts, v_svc_tax
  from public.sale_items where sale_id = p_sale_id;

  if v_enabled and v_taxable > 0 then
    v_rate := app.tax_rate_on(v_sale.sale_date);
    if v_incl then
      -- harga sudah termasuk PPN: PPN = bruto - bruto / (1 + tarif x faktor DPP)
      v_ppn := v_taxable - round(v_taxable / (1 + v_rate.rate_percent / 100 * v_rate.dpp_numerator / v_rate.dpp_denominator), 0);
    else
      v_dpp := round(v_taxable * v_rate.dpp_numerator / v_rate.dpp_denominator, 0);
      v_ppn := round(v_dpp * v_rate.rate_percent / 100, 0);
    end if;
  end if;

  if v_incl and v_ppn > 0 then
    -- PPN yang melekat di harga mengurangi pendapatan, dibagi menurut porsi jasa kena pajak
    v_svc_ppn := round(v_ppn * v_svc_tax / v_taxable, 2);
    v_svc := v_svc - v_svc_ppn;
    v_parts := v_parts - (v_ppn - v_svc_ppn);
  end if;

  update public.sales
     set subtotal = v_sum, ppn_amount = v_ppn, ppn_included = v_incl and v_enabled,
         total = v_net + case when v_incl then 0 else v_ppn end,
         service_revenue = v_svc, parts_revenue = v_parts
   where id = p_sale_id;
end;
$$;

-- Komisi diakui saat invoice lunas; kembali tertunda jika pembayaran dibatalkan
create or replace function app.settle_sale(p_sale_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_total numeric(18,2);
  v_paid  numeric(18,2) := app.sale_paid(p_sale_id);
begin
  select total into v_total from public.sales where id = p_sale_id;
  if v_paid >= v_total then
    update public.commissions set status = 'recognized', recognized_at = now() where sale_id = p_sale_id and status = 'pending';
  else
    update public.commissions set status = 'pending', recognized_at = null where sale_id = p_sale_id and status = 'recognized';
  end if;
end;
$$;

-- Terima pembayaran untuk tagihan. p_payments: [{method, amount, reference?, cash_bank_account_id?}]
create or replace function app.apply_payments(p_sale_id uuid, p_payments jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_sale  public.sales%rowtype;
  v_shift uuid;
  v_acc   uuid;
  v_meth  public.payment_method;
  v_amt   numeric(18,2);
  v_id    uuid;
  x       jsonb;
begin
  select * into v_sale from public.sales where id = p_sale_id;
  for x in select * from jsonb_array_elements(coalesce(p_payments, '[]')) loop
    v_meth := (x ->> 'method')::public.payment_method;
    v_amt := round(coalesce((x ->> 'amount')::numeric, 0), 2);
    if v_amt = 0 then continue; end if;
    if v_amt < 0 then raise exception 'Jumlah bayar tidak boleh minus' using errcode = '22023'; end if;
    if v_meth = 'deposit' then raise exception 'DP dipakai otomatis saat invoice' using errcode = '22023'; end if;
    v_shift := app.my_open_shift();
    v_acc := app.payment_account(v_meth, nullif(x ->> 'cash_bank_account_id', '')::uuid);
    insert into public.payments (branch_id, kind, sale_id, customer_id, shift_id, method, cash_bank_account_id, amount, reference)
    values (v_sale.branch_id, 'sale', p_sale_id, v_sale.customer_id, v_shift, v_meth, v_acc, v_amt, nullif(btrim(x ->> 'reference'), ''))
    returning id into v_id;
    perform app.post_journal(app.today_wib(), 'payment', v_id, 'Pembayaran ' || v_sale.sale_no,
      jsonb_build_array(jsonb_build_object('account_id', (select account_id from public.cash_bank_accounts where id = v_acc), 'debit', v_amt),
                        jsonb_build_object('account', 'ar', 'credit', v_amt)));
  end loop;
  if app.sale_paid(p_sale_id) > v_sale.total then
    raise exception 'Pembayaran melebihi sisa tagihan' using errcode = '23514';
  end if;
  perform app.settle_sale(p_sale_id);
end;
$$;

-- Batas kredit (PRD §8.6): sisa tagihan butuh pelanggan dan batas kredit cukup, atau PIN Owner
create or replace function app.check_credit(p_sale_id uuid, p_pin text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_sale     public.sales%rowtype;
  v_cust     public.customers%rowtype;
  v_out      numeric(18,2);
  v_existing numeric(18,2);
  v_approver uuid;
begin
  select * into v_sale from public.sales where id = p_sale_id;
  v_out := v_sale.total - app.sale_paid(p_sale_id);
  if v_out <= 0 then return null; end if;
  if v_sale.customer_id is null then
    raise exception 'Bayar tempo butuh pelanggan terdaftar; lunasi tagihan atau pilih pelanggan' using errcode = '22023';
  end if;
  select * into v_cust from public.customers where id = v_sale.customer_id;
  select coalesce(sum(s.total - app.sale_paid(s.id)), 0) into v_existing
  from public.sales s where s.customer_id = v_sale.customer_id and s.status = 'posted' and s.id <> p_sale_id;
  if v_existing + v_out <= v_cust.credit_limit then return null; end if;
  if nullif(p_pin, '') is null then
    raise exception 'Melebihi batas kredit pelanggan (piutang sekarang + tagihan ini lebih besar dari batas); perlu PIN Owner' using errcode = '42501';
  end if;
  v_approver := app.verify_approval_pin(p_pin, 'receivables');
  if v_approver is null then raise exception 'PIN persetujuan kredit salah' using errcode = '42501'; end if;
  return v_approver;
end;
$$;

-- =============================================================================
-- Shift kas
-- =============================================================================
create or replace function public.open_shift(p_opening numeric, p_note text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_id     uuid;
begin
  perform app.assert_permission('cash_shift', 'create');
  if coalesce(p_opening, -1) < 0 then raise exception 'Modal awal tidak boleh minus' using errcode = '22023'; end if;
  if exists (select 1 from public.cash_shifts where cashier_id = app.current_employee_id() and status = 'open') then
    raise exception 'Anda masih punya shift yang terbuka' using errcode = '22023';
  end if;
  insert into public.cash_shifts (branch_id, shift_no, cashier_id, opening_cash, close_note)
  values (v_branch, app.next_document_number('SH', app.today_wib(), v_branch), app.current_employee_id(), round(p_opening, 2), null)
  returning id into v_id;
  return v_id;
end;
$$;

-- Kas keluar kecil di shift terbuka. Akun harus akun beban.
create or replace function public.add_cash_out(p_account_id uuid, p_amount numeric, p_note text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_shift uuid;
  v_id    uuid;
  v_cash  uuid;
begin
  perform app.assert_permission('cash_shift', 'create');
  v_shift := app.my_open_shift();
  if coalesce(p_amount, 0) <= 0 then raise exception 'Jumlah harus lebih dari nol' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_note, ''))) < 3 then raise exception 'Keterangan kas keluar wajib diisi' using errcode = '22023'; end if;
  if not exists (select 1 from public.accounts where id = p_account_id and branch_id = app.current_branch_id()
                 and type in ('expense', 'other') and is_active) then
    raise exception 'Pilih akun beban yang aktif' using errcode = '22023';
  end if;
  v_cash := app.payment_account('cash', null);
  insert into public.cash_movements (branch_id, shift_id, account_id, amount, note)
  values (app.current_branch_id(), v_shift, p_account_id, round(p_amount, 2), btrim(p_note)) returning id into v_id;
  perform app.post_journal(app.today_wib(), 'cash_out', v_id, 'Kas keluar: ' || btrim(p_note),
    jsonb_build_array(jsonb_build_object('account_id', p_account_id, 'debit', round(p_amount, 2)),
                      jsonb_build_object('account_id', (select account_id from public.cash_bank_accounts where id = v_cash), 'credit', round(p_amount, 2))));
  return v_id;
end;
$$;

-- Kas seharusnya di shift: modal + kas masuk (tunai, DP tunai) - kas keluar
create or replace function app.shift_expected_cash(p_shift_id uuid)
returns numeric
language sql stable security definer
set search_path = ''
as $$
  select s.opening_cash
         + coalesce((select sum(amount) from public.payments where shift_id = s.id and method = 'cash' and status = 'posted'), 0)
         - coalesce((select sum(amount) from public.cash_movements where shift_id = s.id), 0)
  from public.cash_shifts s where s.id = p_shift_id
$$;

-- Tutup shift: hitung uang fisik per pecahan. Selisih wajib diberi catatan.
-- p_denominations: [{value, qty}]; p_counted dipakai jika pecahan kosong.
create or replace function public.close_shift(p_counted numeric, p_denominations jsonb default '[]', p_note text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_shift    public.cash_shifts%rowtype;
  v_counted  numeric(18,2);
  v_expected numeric(18,2);
begin
  perform app.assert_permission('cash_shift', 'create');
  select * into v_shift from public.cash_shifts where cashier_id = app.current_employee_id() and status = 'open' for update;
  if not found then raise exception 'Tidak ada shift terbuka' using errcode = '22023'; end if;
  if jsonb_array_length(coalesce(p_denominations, '[]')) > 0 then
    select coalesce(sum((d ->> 'value')::numeric * (d ->> 'qty')::numeric), 0) into v_counted from jsonb_array_elements(p_denominations) d;
  else
    v_counted := p_counted;
  end if;
  if v_counted is null or v_counted < 0 then raise exception 'Isi uang fisik yang dihitung' using errcode = '22023'; end if;
  v_expected := app.shift_expected_cash(v_shift.id);
  if round(v_counted, 2) <> v_expected and length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'Ada selisih kas; catatan penyebab wajib diisi' using errcode = '22023';
  end if;
  update public.cash_shifts
     set status = 'closed', closed_at = now(), expected_cash = v_expected, counted_cash = round(v_counted, 2),
         variance = round(v_counted, 2) - v_expected, denominations = nullif(p_denominations, '[]'::jsonb), close_note = nullif(btrim(p_note), '')
   where id = v_shift.id;
  return v_shift.id;
end;
$$;

-- Admin/Owner menyetujui laporan shift; selisih dijurnal ke Selisih Kas
create or replace function public.approve_shift(p_id uuid, p_note text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_shift public.cash_shifts%rowtype;
  v_cash  uuid;
begin
  perform app.assert_permission('cash_shift', 'approve');
  select * into v_shift from public.cash_shifts where id = p_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Shift tidak ditemukan' using errcode = 'P0002'; end if;
  if v_shift.status <> 'closed' then raise exception 'Hanya shift yang sudah ditutup yang bisa disetujui' using errcode = '22023'; end if;
  if v_shift.cashier_id = app.current_employee_id() and not app.is_superuser() then
    raise exception 'Shift sendiri tidak bisa Anda setujui' using errcode = '42501';
  end if;
  update public.cash_shifts
     set status = 'approved', approved_by = app.current_employee_id(), approved_at = now(), approval_note = nullif(btrim(p_note), '')
   where id = p_id;
  if v_shift.variance <> 0 then
    v_cash := (select account_id from public.cash_bank_accounts where id = app.payment_account('cash', null));
    perform app.post_journal(app.today_wib(), 'shift_variance', p_id, 'Selisih kas ' || v_shift.shift_no,
      jsonb_build_array(jsonb_build_object('account', 'cash_variance', 'debit', greatest(-v_shift.variance, 0), 'credit', greatest(v_shift.variance, 0)),
                        jsonb_build_object('account_id', v_cash, 'debit', greatest(v_shift.variance, 0), 'credit', greatest(-v_shift.variance, 0))));
  end if;
end;
$$;

-- =============================================================================
-- Penjualan part langsung (POS)
-- p_data: customer_id?, discount_amount?, notes?   p_items: [{item_id, qty, discount_amount?, location_id?}]
-- Draft = transaksi ditahan. Harga dari master.
-- =============================================================================
create or replace function public.save_sale(p_id uuid, p_data jsonb, p_items jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_sale   public.sales%rowtype;
  v_id     uuid;
  v_item   public.items%rowtype;
  v_qty    numeric;
  v_disc   numeric;
  v_n      integer := 0;
  x        jsonb;
begin
  perform app.assert_permission('sales', case when p_id is null then 'create' else 'update' end::public.permission_action);
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then raise exception 'Tambahkan minimal satu barang' using errcode = '22023'; end if;
  perform app.assert_ref('customers', nullif(p_data ->> 'customer_id', '')::uuid, 'Pelanggan');

  if p_id is null then
    insert into public.sales (branch_id, source, customer_id, discount_amount, notes)
    values (v_branch, 'pos', nullif(p_data ->> 'customer_id', '')::uuid, round(coalesce(nullif(p_data ->> 'discount_amount', '')::numeric, 0), 2),
            nullif(btrim(p_data ->> 'notes'), ''))
    returning id into v_id;
  else
    select * into v_sale from public.sales where id = p_id and branch_id = v_branch for update;
    if not found then raise exception 'Transaksi tidak ditemukan' using errcode = 'P0002'; end if;
    if v_sale.status <> 'draft' or v_sale.source <> 'pos' then raise exception 'Hanya draft penjualan yang bisa diubah' using errcode = '22023'; end if;
    update public.sales
       set customer_id = nullif(p_data ->> 'customer_id', '')::uuid,
           discount_amount = round(coalesce(nullif(p_data ->> 'discount_amount', '')::numeric, 0), 2),
           notes = nullif(btrim(p_data ->> 'notes'), '')
     where id = p_id returning id into v_id;
    delete from public.sale_items where sale_id = v_id;
  end if;

  for x in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce(nullif(x ->> 'qty', '')::numeric, 0);
    v_disc := round(coalesce(nullif(x ->> 'discount_amount', '')::numeric, 0), 2);
    if v_qty <= 0 then raise exception 'Jumlah harus lebih dari nol' using errcode = '22023'; end if;
    if v_disc < 0 then raise exception 'Diskon tidak boleh minus' using errcode = '22023'; end if;
    select * into v_item from public.items where id = (x ->> 'item_id')::uuid and branch_id = v_branch and is_active;
    if not found then raise exception 'Barang tidak ditemukan atau nonaktif' using errcode = '22023'; end if;
    if v_disc > round(v_qty * v_item.sell_price, 2) then raise exception 'Diskon melebihi nilai baris' using errcode = '22023'; end if;
    perform app.assert_ref('locations', nullif(x ->> 'location_id', '')::uuid, 'Lokasi rak');
    v_n := v_n + 1;
    insert into public.sale_items (branch_id, sale_id, line_type, item_id, description, qty, unit_price, discount_amount, line_total,
                                   is_taxable, location_id, sort_order)
    values (v_branch, v_id, 'part', v_item.id, v_item.name, v_qty, v_item.sell_price, v_disc, round(v_qty * v_item.sell_price, 2) - v_disc,
            v_item.is_taxable, nullif(x ->> 'location_id', '')::uuid, v_n);
  end loop;
  perform app.compute_sale(v_id);
  return v_id;
end;
$$;

-- Posting penjualan POS: stok keluar (HPP rata-rata), jurnal, pembayaran. p_payments boleh kosong (seluruhnya tempo).
create or replace function public.post_sale(p_id uuid, p_payments jsonb default '[]', p_pin text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_sale     public.sales%rowtype;
  v_cust     public.customers%rowtype;
  v_gross    numeric(18,2);
  v_disc_pct numeric;
  v_approver uuid;
  v_loc      uuid;
  v_mov      uuid;
  v_cost     numeric(18,2);
  v_cogs     numeric(18,2) := 0;
  v_no       text;
  v_lines    jsonb;
  i          record;
begin
  perform app.assert_permission('sales', 'create');
  select * into v_sale from public.sales where id = p_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Transaksi tidak ditemukan' using errcode = 'P0002'; end if;
  if v_sale.status <> 'draft' or v_sale.source <> 'pos' then raise exception 'Transaksi ini sudah diposting' using errcode = '22023'; end if;
  perform app.assert_ref('customers', v_sale.customer_id, 'Pelanggan');
  perform app.compute_sale(p_id);
  select * into v_sale from public.sales where id = p_id;

  select coalesce(sum(qty * unit_price), 0) into v_gross from public.sale_items where sale_id = p_id;
  v_disc_pct := case when v_gross > 0 then (v_gross - v_sale.subtotal + v_sale.discount_amount) * 100 / v_gross else 0 end;
  v_approver := app.check_discount(v_disc_pct, p_pin);

  v_no := app.next_document_number('INV', app.today_wib(), v_sale.branch_id);
  select * into v_cust from public.customers where id = v_sale.customer_id;
  update public.sales
     set sale_no = v_no, status = 'posted', posted_at = now(), sale_date = app.today_wib(), discount_approved_by = v_approver,
         due_date = app.today_wib() + coalesce(v_cust.payment_terms_days, 0)
   where id = p_id;
  perform app.compute_sale(p_id);   -- tarif PPN mengikuti tanggal posting

  -- Stok keluar per baris
  for i in select * from public.sale_items where sale_id = p_id order by sort_order loop
    v_loc := coalesce(i.location_id, (select default_location_id from public.items where id = i.item_id),
                      (select b.location_id from public.stock_balances b where b.item_id = i.item_id and b.qty >= i.qty
                       order by b.qty desc limit 1));
    if v_loc is null then raise exception 'Pilih lokasi rak untuk % (stok tidak ditemukan)', i.description using errcode = '22023'; end if;
    v_mov := app.post_stock_movement(i.item_id, v_loc, 'sale', -i.qty, null, 'sale', p_id, v_no);
    select round(i.qty * unit_cost, 2) into v_cost from public.stock_movements where id = v_mov;
    update public.sale_items set location_id = v_loc, cost_total = v_cost where id = i.id;
    v_cogs := v_cogs + v_cost;
  end loop;
  update public.sales set cogs_total = v_cogs where id = p_id;
  select * into v_sale from public.sales where id = p_id;

  v_lines := jsonb_build_array(
    jsonb_build_object('account', 'ar', 'debit', v_sale.total),
    jsonb_build_object('account', 'cogs', 'debit', v_cogs),
    jsonb_build_object('account', 'parts_revenue', 'credit', v_sale.parts_revenue),
    jsonb_build_object('account', 'service_revenue', 'credit', v_sale.service_revenue),
    jsonb_build_object('account', 'ppn_out', 'credit', v_sale.ppn_amount),
    jsonb_build_object('account', 'inventory', 'credit', v_cogs));
  perform app.post_journal(v_sale.sale_date, 'sale', p_id, 'Penjualan ' || v_no, v_lines);

  perform app.apply_payments(p_id, p_payments);
  update public.sales set credit_approved_by = app.check_credit(p_id, p_pin) where id = p_id;
  return p_id;
end;
$$;

-- =============================================================================
-- Invoice work order (WO berstatus Siap Diambil). DP yang sudah diterima dipakai otomatis.
-- p_data: due_date? notes?
-- =============================================================================
create or replace function public.post_work_order_invoice(p_wo_id uuid, p_payments jsonb default '[]', p_pin text default null, p_data jsonb default '{}')
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_wo       public.work_orders%rowtype;
  v_cust     public.customers%rowtype;
  v_id       uuid;
  v_no       text;
  v_sale     public.sales%rowtype;
  v_gross    numeric(18,2);
  v_disc_pct numeric;
  v_approver uuid;
  v_cogs     numeric(18,2);
  v_dep      numeric(18,2) := 0;
  v_pid      uuid;
  i          record;
  d          record;
begin
  perform app.assert_permission('sales', 'create');
  select * into v_wo from public.work_orders where id = p_wo_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Work order tidak ditemukan' using errcode = 'P0002'; end if;
  if v_wo.is_warranty then raise exception 'WO klaim garansi tidak ditagih' using errcode = '22023'; end if;
  if v_wo.status <> 'ready' then raise exception 'Invoice dibuat setelah WO berstatus Siap Diambil' using errcode = '22023'; end if;
  if exists (select 1 from public.sales where work_order_id = p_wo_id and status = 'posted') then
    raise exception 'WO ini sudah punya invoice' using errcode = '22023';
  end if;
  if exists (select 1 from public.work_order_items where work_order_id = p_wo_id and not is_cancelled and line_type = 'part' and issued_qty < qty) then
    raise exception 'Masih ada part yang belum dikeluarkan' using errcode = '22023';
  end if;
  if v_wo.customer_id is not null then select * into v_cust from public.customers where id = v_wo.customer_id; end if;

  v_no := app.next_document_number('INV', app.today_wib(), v_wo.branch_id);
  insert into public.sales (branch_id, sale_no, source, work_order_id, customer_id, plate_no, status, posted_at, sale_date, due_date,
                            discount_amount, notes)
  values (v_wo.branch_id, v_no, 'work_order', v_wo.id, v_wo.customer_id, v_wo.plate_no, 'posted', now(), app.today_wib(),
          coalesce(nullif(p_data ->> 'due_date', '')::date, app.today_wib() + coalesce(v_cust.payment_terms_days, 0)),
          v_wo.discount_amount, nullif(btrim(p_data ->> 'notes'), ''))
  returning id into v_id;

  insert into public.sale_items (branch_id, sale_id, line_type, service_id, item_id, work_order_item_id, description, qty, unit_price,
                                 discount_amount, line_total, is_taxable, sort_order)
  select w.branch_id, v_id, w.line_type, w.service_id, w.item_id, w.id, w.description, w.qty, w.unit_price, w.discount_amount, w.line_total,
         coalesce(s.is_taxable, it.is_taxable, true), w.sort_order
  from public.work_order_items w
  left join public.services s on s.id = w.service_id
  left join public.items it on it.id = w.item_id
  where w.work_order_id = p_wo_id and not w.is_cancelled
  order by w.sort_order;
  if not exists (select 1 from public.sale_items where sale_id = v_id) then raise exception 'Work order belum berisi pekerjaan' using errcode = '22023'; end if;

  perform app.compute_sale(v_id);
  select * into v_sale from public.sales where id = v_id;
  if v_sale.total <= 0 then raise exception 'Total tagihan harus lebih dari nol' using errcode = '22023'; end if;

  select coalesce(sum(qty * unit_price), 0) into v_gross from public.sale_items where sale_id = v_id;
  v_disc_pct := case when v_gross > 0 then (v_gross - v_sale.subtotal + v_sale.discount_amount) * 100 / v_gross else 0 end;
  v_approver := app.check_discount(v_disc_pct, p_pin);

  -- HPP part dari pengeluaran/pengembalian part WO (sama dengan nilai yang dijurnal ke Persediaan dalam Pengerjaan)
  for i in select si.id, si.work_order_item_id from public.sale_items si where si.sale_id = v_id and si.line_type = 'part' loop
    update public.sale_items set cost_total = coalesce((
      select sum(case when p.kind = 'issue' then 1 else -1 end * round(p.qty * m.unit_cost, 2))
      from public.part_issues p join public.stock_movements m on m.id = p.movement_id
      where p.work_order_item_id = i.work_order_item_id), 0)
    where id = i.id;
  end loop;
  select coalesce(sum(cost_total), 0) into v_cogs from public.sale_items where sale_id = v_id;
  update public.sales set cogs_total = v_cogs, discount_approved_by = v_approver where id = v_id;
  select * into v_sale from public.sales where id = v_id;

  perform app.post_journal(v_sale.sale_date, 'sale', v_id, 'Invoice ' || v_no || ' (' || v_wo.wo_no || ')',
    jsonb_build_array(
      jsonb_build_object('account', 'ar', 'debit', v_sale.total),
      jsonb_build_object('account', 'cogs', 'debit', v_cogs),
      jsonb_build_object('account', 'service_revenue', 'credit', v_sale.service_revenue),
      jsonb_build_object('account', 'parts_revenue', 'credit', v_sale.parts_revenue),
      jsonb_build_object('account', 'ppn_out', 'credit', v_sale.ppn_amount),
      jsonb_build_object('account', 'wip', 'credit', v_cogs)));

  -- Komisi mekanik: dasar = harga jasa setelah semua diskon, tanpa PPN
  insert into public.commissions (branch_id, sale_id, sale_item_id, work_order_id, employee_id, base_amount, commission_type,
                                  commission_value, share_percent, amount)
  select v_sale.branch_id, v_id, si.id, p_wo_id, m.employee_id,
         base.amt, sv.commission_type, sv.commission_value, m.share_percent,
         round(case when sv.commission_type = 'percent' then base.amt * sv.commission_value / 100
                    else sv.commission_value * si.qty end * m.share_percent / 100, 2)
  from public.sale_items si
  join public.services sv on sv.id = si.service_id
  join public.work_order_mechanics m on m.work_order_item_id = si.work_order_item_id
  cross join lateral (
    select case when v_sale.ppn_included and si.is_taxable and v_sale.ppn_amount > 0
                then round(si.net_amount - si.net_amount * v_sale.ppn_amount /
                           nullif((select sum(net_amount) from public.sale_items where sale_id = v_id and is_taxable), 0), 2)
                else si.net_amount end as amt) base
  where si.sale_id = v_id and si.line_type = 'service';

  -- DP yang sudah diterima dipakai melunasi invoice
  for d in select * from public.payments
           where kind = 'deposit' and work_order_id = p_wo_id and status = 'posted' and applied_sale_id is null for update loop
    v_dep := v_dep + d.amount;
    if v_dep > v_sale.total then raise exception 'DP melebihi total invoice; batalkan sebagian DP dulu' using errcode = '23514'; end if;
    insert into public.payments (branch_id, kind, sale_id, customer_id, method, amount, applied_deposit_id, reference)
    values (v_sale.branch_id, 'sale', v_id, v_sale.customer_id, 'deposit', d.amount, d.id, 'DP dipakai') returning id into v_pid;
    update public.payments set applied_sale_id = v_id where id = d.id;
    perform app.post_journal(app.today_wib(), 'payment', v_pid, 'DP dipakai untuk ' || v_no,
      jsonb_build_array(jsonb_build_object('account', 'customer_deposit', 'debit', d.amount),
                        jsonb_build_object('account', 'ar', 'credit', d.amount)));
  end loop;

  perform app.apply_payments(v_id, p_payments);
  update public.sales set credit_approved_by = app.check_credit(v_id, p_pin) where id = v_id;
  return v_id;
end;
$$;

-- Pembayaran susulan (pelunasan piutang, beberapa metode). p_payments sama seperti di atas.
create or replace function public.pay_sale(p_sale_id uuid, p_payments jsonb, p_pin text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
begin
  perform app.assert_any_permission(array['sales:create', 'receivables:create']);
  select * into v_sale from public.sales where id = p_sale_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Tagihan tidak ditemukan' using errcode = 'P0002'; end if;
  if v_sale.status <> 'posted' then raise exception 'Tagihan berstatus % tidak bisa dibayar', v_sale.status using errcode = '22023'; end if;
  if jsonb_array_length(coalesce(p_payments, '[]')) = 0 then raise exception 'Isi pembayaran' using errcode = '22023'; end if;
  perform app.apply_payments(p_sale_id, p_payments);
end;
$$;

-- DP / uang muka untuk WO. p_data: method, amount, reference?, cash_bank_account_id?
create or replace function public.record_deposit(p_wo_id uuid, p_data jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_wo    public.work_orders%rowtype;
  v_meth  public.payment_method := (p_data ->> 'method')::public.payment_method;
  v_amt   numeric(18,2) := round(coalesce(nullif(p_data ->> 'amount', '')::numeric, 0), 2);
  v_acc   uuid;
  v_id    uuid;
begin
  perform app.assert_permission('sales', 'create');
  if v_amt <= 0 then raise exception 'Jumlah DP harus lebih dari nol' using errcode = '22023'; end if;
  if v_meth = 'deposit' then raise exception 'Metode tidak valid' using errcode = '22023'; end if;
  select * into v_wo from public.work_orders where id = p_wo_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Work order tidak ditemukan' using errcode = 'P0002'; end if;
  if v_wo.status in ('delivered', 'void') or v_wo.is_warranty then raise exception 'WO ini tidak bisa menerima DP' using errcode = '22023'; end if;
  if exists (select 1 from public.sales where work_order_id = p_wo_id and status = 'posted') then
    raise exception 'WO sudah diinvoice; bayar lewat invoice' using errcode = '22023';
  end if;
  v_acc := app.payment_account(v_meth, nullif(p_data ->> 'cash_bank_account_id', '')::uuid);
  insert into public.payments (branch_id, kind, work_order_id, customer_id, shift_id, method, cash_bank_account_id, amount, reference)
  values (v_wo.branch_id, 'deposit', p_wo_id, v_wo.customer_id, app.my_open_shift(), v_meth, v_acc, v_amt, nullif(btrim(p_data ->> 'reference'), ''))
  returning id into v_id;
  perform app.post_journal(app.today_wib(), 'payment', v_id, 'DP ' || v_wo.wo_no,
    jsonb_build_array(jsonb_build_object('account_id', (select account_id from public.cash_bank_accounts where id = v_acc), 'debit', v_amt),
                      jsonb_build_object('account', 'customer_deposit', 'credit', v_amt)));
  return v_id;
end;
$$;

-- Batalkan pembayaran/DP. Hanya selama shift-nya masih terbuka (setelah ditutup, koreksi lewat retur/jurnal).
create or replace function public.void_payment(p_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_pay   public.payments%rowtype;
  v_shift public.cash_shifts%rowtype;
begin
  perform app.assert_any_permission(array['transaction_void:create', 'transaction_void:approve']);
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Alasan pembatalan wajib diisi' using errcode = '22023'; end if;
  select * into v_pay from public.payments where id = p_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Pembayaran tidak ditemukan' using errcode = 'P0002'; end if;
  if v_pay.status = 'void' then raise exception 'Pembayaran sudah dibatalkan' using errcode = '22023'; end if;
  if v_pay.method = 'deposit' then raise exception 'DP yang sudah dipakai dibatalkan bersama invoice-nya' using errcode = '22023'; end if;
  if v_pay.kind = 'deposit' and v_pay.applied_sale_id is not null then
    raise exception 'DP sudah dipakai di invoice; batalkan invoice dulu' using errcode = '22023';
  end if;
  select * into v_shift from public.cash_shifts where id = v_pay.shift_id;
  if v_shift.status <> 'open' then
    raise exception 'Shift pembayaran ini sudah ditutup; koreksi lewat retur atau jurnal penyesuaian' using errcode = '22023';
  end if;
  if not app.has_permission('transaction_void', 'approve') and v_shift.cashier_id <> app.current_employee_id() then
    raise exception 'Pembayaran shift kasir lain hanya bisa dibatalkan Admin/Owner' using errcode = '42501';
  end if;
  update public.payments set status = 'void', void_reason = btrim(p_reason) where id = p_id;
  perform app.reverse_journals('payment', p_id, app.today_wib(), 'Batal pembayaran: ' || btrim(p_reason));
  if v_pay.sale_id is not null then perform app.settle_sale(v_pay.sale_id); end if;
end;
$$;

-- Batalkan invoice/penjualan. Pembayaran harus dibatalkan lebih dulu. Posted butuh persetujuan (izin approve atau PIN).
create or replace function public.void_sale(p_id uuid, p_reason text, p_pin text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_sale public.sales%rowtype;
  i      record;
begin
  perform app.assert_any_permission(array['transaction_void:create', 'transaction_void:approve']);
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Alasan pembatalan wajib diisi' using errcode = '22023'; end if;
  select * into v_sale from public.sales where id = p_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Transaksi tidak ditemukan' using errcode = 'P0002'; end if;
  if v_sale.status = 'void' then raise exception 'Transaksi sudah dibatalkan' using errcode = '22023'; end if;

  if v_sale.status = 'posted' then
    if not app.has_permission('transaction_void', 'approve') and app.verify_approval_pin(coalesce(p_pin, ''), 'transaction_void') is null then
      raise exception 'Membatalkan invoice butuh persetujuan Owner/Admin (PIN)' using errcode = '42501';
    end if;
    if exists (select 1 from public.payments where sale_id = p_id and kind = 'sale' and status = 'posted') then
      raise exception 'Batalkan dulu pembayaran invoice ini' using errcode = '22023';
    end if;
    -- DP yang sudah dipakai kembali menjadi DP milik WO
    for i in select * from public.payments where sale_id = p_id and method = 'deposit' and status = 'posted' loop
      update public.payments set status = 'void', void_reason = 'Invoice dibatalkan' where id = i.id;
      update public.payments set applied_sale_id = null where id = i.applied_deposit_id;
      perform app.reverse_journals('payment', i.id, app.today_wib(), 'Batal pakai DP: ' || btrim(p_reason));
    end loop;
    perform app.reverse_journals('sale', p_id, app.today_wib(), 'Batal ' || v_sale.sale_no || ': ' || btrim(p_reason));
    update public.commissions set status = 'void' where sale_id = p_id;
    if v_sale.source = 'pos' then
      for i in select * from public.sale_items where sale_id = p_id and line_type = 'part' loop
        perform app.post_stock_movement(i.item_id, i.location_id, 'sales_return', i.qty, round(i.cost_total / i.qty, 2), 'sale', p_id,
                                        'Batal ' || v_sale.sale_no);
      end loop;
    end if;
  end if;
  update public.sales set status = 'void', void_reason = btrim(p_reason) where id = p_id;
end;
$$;

-- =============================================================================
-- Perubahan work order: invoice mengunci WO; penyerahan butuh invoice
-- =============================================================================
create or replace function app.lock_open_wo(p_id uuid)
returns public.work_orders
language plpgsql security definer
set search_path = ''
as $$
declare
  v_wo public.work_orders%rowtype;
begin
  select * into v_wo from public.work_orders where id = p_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Work order tidak ditemukan' using errcode = 'P0002'; end if;
  if v_wo.status = 'delivered' then raise exception 'Work order sudah diserahkan dan terkunci' using errcode = '22023'; end if;
  if v_wo.status = 'void' then raise exception 'Work order sudah dibatalkan' using errcode = '22023'; end if;
  if exists (select 1 from public.sales where work_order_id = p_id and status = 'posted') then
    raise exception 'Work order sudah diinvoice; batalkan invoice dulu untuk mengubahnya' using errcode = '22023';
  end if;
  return v_wo;
end;
$$;

create or replace function public.set_work_order_status(p_id uuid, p_status public.work_order_status, p_note text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_wo       public.work_orders%rowtype;
  v_allowed  boolean;
  v_invoiced boolean;
begin
  if app.current_employee_id() is null then
    raise exception 'Sesi tidak valid: login sebagai karyawan aktif' using errcode = '42501';
  end if;
  select * into v_wo from public.work_orders where id = p_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Work order tidak ditemukan' using errcode = 'P0002'; end if;
  if v_wo.status = 'delivered' then raise exception 'Work order sudah diserahkan dan terkunci' using errcode = '22023'; end if;
  if v_wo.status = 'void' then raise exception 'Work order sudah dibatalkan' using errcode = '22023'; end if;
  if not (app.has_permission('service_board', 'update') or app.has_permission('service_orders', 'update')
          or (app.has_permission('service_board', 'update', 'own') and app.is_wo_mechanic(p_id) and p_status <> 'delivered')) then
    raise exception 'Anda tidak punya izin untuk tindakan ini' using errcode = '42501';
  end if;

  v_allowed := case v_wo.status
    when 'queued'        then p_status in ('in_progress')
    when 'in_progress'   then p_status in ('queued', 'waiting_parts', 'quality_check')
    when 'waiting_parts' then p_status in ('in_progress')
    when 'quality_check' then p_status in ('in_progress', 'ready')
    when 'ready'         then p_status in ('quality_check', 'delivered')
    else false end;
  if not v_allowed then
    raise exception 'Status % tidak bisa langsung diubah ke %', v_wo.status, p_status using errcode = '22023';
  end if;

  v_invoiced := exists (select 1 from public.sales where work_order_id = p_id and status = 'posted');
  if v_invoiced and p_status <> 'delivered' then
    raise exception 'Work order sudah diinvoice; batalkan invoice dulu untuk mengubah status' using errcode = '22023';
  end if;

  if p_status in ('quality_check', 'ready', 'delivered') then
    if not exists (select 1 from public.work_order_items where work_order_id = p_id and not is_cancelled) then
      raise exception 'Work order belum berisi pekerjaan' using errcode = '22023';
    end if;
    if exists (select 1 from public.work_order_items where work_order_id = p_id and not is_cancelled
               and line_type = 'part' and issued_qty < qty) then
      raise exception 'Masih ada part yang belum dikeluarkan gudang (atau batalkan barisnya)' using errcode = '22023';
    end if;
  end if;

  -- Kendaraan baru diserahkan setelah ditagih (WO garansi atau tanpa tagihan dikecualikan)
  if p_status = 'delivered' and not v_invoiced and not v_wo.is_warranty
     and (select coalesce(sum(line_total), 0) from public.work_order_items where work_order_id = p_id and not is_cancelled) - v_wo.discount_amount > 0 then
    raise exception 'Buat invoice di Kasir sebelum menyerahkan kendaraan' using errcode = '22023';
  end if;

  perform app.set_wo_status(p_id, p_status, p_note);
end;
$$;

-- =============================================================================
-- View
-- =============================================================================
create view public.v_sales with (security_invoker = true) as
  select s.id, s.branch_id, s.sale_no, s.source, s.work_order_id, w.wo_no, coalesce(w.plate_no, s.plate_no) as plate_no,
         s.customer_id, c.name as customer_name, c.phone as customer_phone, s.sale_date, s.due_date, s.status,
         s.subtotal, s.discount_amount, s.ppn_amount, s.ppn_included, s.total, s.service_revenue, s.parts_revenue,
         s.notes, s.void_reason, s.posted_at, s.created_at,
         coalesce(p.paid, 0)::numeric(18,2) as paid,
         case when s.status = 'posted' then (s.total - coalesce(p.paid, 0))::numeric(18,2) else 0::numeric(18,2) end as outstanding,
         case when s.status = 'posted' and s.due_date is not null then (app.today_wib() - s.due_date) end as days_overdue,
         case when s.status <> 'posted' then null
              when app.today_wib() - s.sale_date <= 30 then '0-30'
              when app.today_wib() - s.sale_date <= 60 then '31-60'
              else '>60' end as age_bucket,
         (select count(*) from public.sale_items i where i.sale_id = s.id)::integer as line_count
  from public.sales s
  left join public.customers c on c.id = s.customer_id
  left join public.work_orders w on w.id = s.work_order_id
  left join lateral (
    select sum(amount) as paid from public.payments x where x.sale_id = s.id and x.kind = 'sale' and x.status = 'posted'
  ) p on true;

create view public.v_cash_shifts with (security_invoker = true) as
  select s.*, app.employee_name(s.cashier_id) as cashier_name,
         coalesce(pm.cash_in, 0)::numeric(18,2) as cash_in,
         coalesce(cm.cash_out, 0)::numeric(18,2) as cash_out,
         coalesce(pm.transfer_in, 0)::numeric(18,2) as transfer_in,
         coalesce(pm.qris_in, 0)::numeric(18,2) as qris_in,
         coalesce(pm.card_in, 0)::numeric(18,2) as card_in,
         case when s.status = 'open' then (s.opening_cash + coalesce(pm.cash_in, 0) - coalesce(cm.cash_out, 0))::numeric(18,2)
              else s.expected_cash end as expected_now
  from public.cash_shifts s
  left join lateral (
    select sum(amount) filter (where method = 'cash') as cash_in, sum(amount) filter (where method = 'transfer') as transfer_in,
           sum(amount) filter (where method = 'qris') as qris_in, sum(amount) filter (where method = 'card') as card_in
    from public.payments where shift_id = s.id and status = 'posted'
  ) pm on true
  left join lateral (select sum(amount) as cash_out from public.cash_movements where shift_id = s.id) cm on true;

-- Piutang per pelanggan
create view public.v_ar_customers with (security_invoker = true) as
  select customer_id, customer_name, count(*)::integer as invoices, sum(outstanding)::numeric(18,2) as outstanding,
         sum(outstanding) filter (where age_bucket = '0-30')::numeric(18,2) as bucket_0_30,
         sum(outstanding) filter (where age_bucket = '31-60')::numeric(18,2) as bucket_31_60,
         sum(outstanding) filter (where age_bucket = '>60')::numeric(18,2) as bucket_60_plus,
         max(days_overdue) as max_days_overdue
  from public.v_sales where status = 'posted' and outstanding > 0 and customer_id is not null
  group by customer_id, customer_name;

-- =============================================================================
-- RLS & hak akses
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array['tax_rates', 'cash_shifts', 'cash_movements', 'sales', 'sale_items', 'payments', 'commissions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

create policy tax_rates_select on public.tax_rates for select to authenticated
  using (branch_id = app.current_branch_id());
create policy cash_shifts_select on public.cash_shifts for select to authenticated
  using (branch_id = app.current_branch_id() and (app.has_permission('cash_shift', 'view') or app.has_permission('cash_shift', 'approve')));
create policy cash_movements_select on public.cash_movements for select to authenticated
  using (branch_id = app.current_branch_id() and (app.has_permission('cash_shift', 'view') or app.has_permission('cash_shift', 'approve')));
create policy sales_select on public.sales for select to authenticated
  using (branch_id = app.current_branch_id() and (app.has_permission('sales', 'view') or app.has_permission('receivables', 'view')));
create policy sale_items_select on public.sale_items for select to authenticated
  using (branch_id = app.current_branch_id() and (app.has_permission('sales', 'view') or app.has_permission('receivables', 'view')));
create policy payments_select on public.payments for select to authenticated
  using (branch_id = app.current_branch_id()
         and (app.has_permission('sales', 'view') or app.has_permission('receivables', 'view') or app.has_permission('cash_shift', 'view')
              or app.has_permission('cash_shift', 'approve')));
-- Komisi: penuh, atau milik sendiri (mekanik)
create policy commissions_select on public.commissions for select to authenticated
  using (branch_id = app.current_branch_id()
         and (app.has_permission('commissions', 'view')
              or (employee_id = app.current_employee_id() and app.has_permission('commissions', 'view', 'own'))));

grant select on public.v_sales, public.v_cash_shifts, public.v_ar_customers to authenticated;

revoke all on function app.my_open_shift(), app.my_discount_limit(), app.payment_account(public.payment_method, uuid),
  app.sale_paid(uuid), app.tax_rate_on(date), app.check_discount(numeric, text), app.compute_sale(uuid), app.settle_sale(uuid),
  app.apply_payments(uuid, jsonb), app.check_credit(uuid, text), app.shift_expected_cash(uuid)
  from public, anon, authenticated;

revoke all on function public.open_shift(numeric, text), public.add_cash_out(uuid, numeric, text),
  public.close_shift(numeric, jsonb, text), public.approve_shift(uuid, text), public.save_sale(uuid, jsonb, jsonb),
  public.post_sale(uuid, jsonb, text), public.post_work_order_invoice(uuid, jsonb, text, jsonb), public.pay_sale(uuid, jsonb, text),
  public.record_deposit(uuid, jsonb), public.void_payment(uuid, text), public.void_sale(uuid, text, text) from public, anon;
grant execute on function public.open_shift(numeric, text), public.add_cash_out(uuid, numeric, text),
  public.close_shift(numeric, jsonb, text), public.approve_shift(uuid, text), public.save_sale(uuid, jsonb, jsonb),
  public.post_sale(uuid, jsonb, text), public.post_work_order_invoice(uuid, jsonb, text, jsonb), public.pay_sale(uuid, jsonb, text),
  public.record_deposit(uuid, jsonb), public.void_payment(uuid, text), public.void_sale(uuid, text, text) to authenticated;

-- =============================================================================
-- Pratinjau total invoice WO (termasuk PPN) tanpa menyimpan apa pun: dihitung dengan logika yang sama
-- di dalam sub-transaksi yang dibatalkan, supaya dialog bayar menampilkan angka yang persis sama dengan server.
-- =============================================================================
create or replace function public.preview_work_order_invoice(p_wo_id uuid)
returns numeric
language plpgsql security definer
set search_path = ''
as $$
declare
  v_wo    public.work_orders%rowtype;
  v_id    uuid;
  v_total numeric := null;
begin
  perform app.assert_permission('sales', 'create');
  select * into v_wo from public.work_orders where id = p_wo_id and branch_id = app.current_branch_id();
  if not found then raise exception 'Work order tidak ditemukan' using errcode = 'P0002'; end if;
  begin
    insert into public.sales (branch_id, source, work_order_id, customer_id, plate_no, discount_amount)
    values (v_wo.branch_id, 'work_order', v_wo.id, v_wo.customer_id, v_wo.plate_no, v_wo.discount_amount)
    returning id into v_id;
    insert into public.sale_items (branch_id, sale_id, line_type, service_id, item_id, work_order_item_id, description, qty, unit_price,
                                   discount_amount, line_total, is_taxable, sort_order)
    select w.branch_id, v_id, w.line_type, w.service_id, w.item_id, w.id, w.description, w.qty, w.unit_price, w.discount_amount, w.line_total,
           coalesce(s.is_taxable, it.is_taxable, true), w.sort_order
    from public.work_order_items w
    left join public.services s on s.id = w.service_id
    left join public.items it on it.id = w.item_id
    where w.work_order_id = p_wo_id and not w.is_cancelled;
    perform app.compute_sale(v_id);
    select total into v_total from public.sales where id = v_id;
    raise exception 'pratinjau' using errcode = 'P0009';
  exception when sqlstate 'P0009' then
    null;   -- semua perubahan di blok ini dibatalkan; v_total tetap terisi
  end;
  return v_total;
end;
$$;

revoke all on function public.preview_work_order_invoice(uuid) from public, anon;
grant execute on function public.preview_work_order_invoice(uuid) to authenticated;
