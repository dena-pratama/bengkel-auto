-- =============================================================================
-- Pembelian, supplier, hutang (PRD §5, §11.3, §14.1)
-- Barang hanya bertambah lewat penerimaan barang. Setiap dokumen diposting atomik:
-- stok + HPP + hutang + jurnal dalam satu transaksi database.
-- =============================================================================

create type public.po_status as enum ('draft', 'sent', 'partial', 'received', 'closed', 'cancelled');
create type public.doc_status as enum ('posted', 'void');
create type public.return_settlement as enum ('debt', 'refund');

-- -----------------------------------------------------------------------------
-- Supplier
-- -----------------------------------------------------------------------------
create table public.suppliers (
  id                  uuid primary key default gen_random_uuid(),
  branch_id           uuid not null references public.branches(id),
  code                text not null,
  name                text not null check (length(btrim(name)) between 2 and 120),
  contact_name        text,
  phone               text,
  email               text,
  address             text,
  npwp                text,
  payment_terms_days  integer not null default 0 check (payment_terms_days between 0 and 365), -- 0 = tunai
  bank_name           text,
  bank_account_number text,
  bank_account_name   text,
  notes               text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  created_by          uuid default auth.uid(),
  updated_at          timestamptz not null default now(),
  unique (branch_id, code)
);
create unique index uq_suppliers_name on public.suppliers (branch_id, lower(name));

-- -----------------------------------------------------------------------------
-- Purchase order
-- -----------------------------------------------------------------------------
create table public.purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references public.branches(id),
  po_no         text not null,
  supplier_id   uuid not null references public.suppliers(id),
  order_date    date not null default app.today_wib(),
  expected_date date,
  status        public.po_status not null default 'draft',
  notes         text,
  cancel_reason text,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  updated_at    timestamptz not null default now(),
  unique (branch_id, po_no)
);

create table public.purchase_order_items (
  id                uuid primary key default gen_random_uuid(),
  branch_id         uuid not null references public.branches(id),
  po_id             uuid not null references public.purchase_orders(id),
  item_id           uuid not null references public.items(id),
  unit_id           uuid not null references public.units(id),
  factor            numeric(14,3) not null check (factor > 0),       -- ke satuan dasar
  qty               numeric(14,3) not null check (qty > 0),          -- dalam unit_id
  unit_price        numeric(18,2) not null check (unit_price >= 0),  -- per unit_id
  received_base_qty numeric(14,3) not null default 0 check (received_base_qty >= 0),
  created_at        timestamptz not null default now(),
  created_by        uuid default auth.uid(),
  updated_at        timestamptz not null default now()
);
create index idx_po_items_po on public.purchase_order_items (po_id);

-- -----------------------------------------------------------------------------
-- Penerimaan barang (faktur supplier)
-- -----------------------------------------------------------------------------
create table public.goods_receipts (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid not null references public.branches(id),
  gr_no           text not null,
  supplier_id     uuid not null references public.suppliers(id),
  po_id           uuid references public.purchase_orders(id),
  receipt_date    date not null,
  invoice_no      text,
  invoice_date    date,
  due_date        date not null,
  subtotal        numeric(18,2) not null check (subtotal >= 0),   -- setelah diskon baris
  ppn_amount      numeric(18,2) not null default 0 check (ppn_amount >= 0),
  ppn_capitalized boolean not null,                               -- true = PPN masuk HPP (tidak PKP)
  total           numeric(18,2) not null check (total >= 0),      -- = hutang awal
  invoice_photo_path text,
  notes           text,
  status          public.doc_status not null default 'posted',
  void_reason     text,
  created_at      timestamptz not null default now(),
  created_by      uuid default auth.uid(),
  updated_at      timestamptz not null default now(),
  unique (branch_id, gr_no)
);
create index idx_goods_receipts_supplier on public.goods_receipts (supplier_id, receipt_date desc);

create table public.goods_receipt_items (
  id                uuid primary key default gen_random_uuid(),
  branch_id         uuid not null references public.branches(id),
  receipt_id        uuid not null references public.goods_receipts(id),
  po_item_id        uuid references public.purchase_order_items(id),
  item_id           uuid not null references public.items(id),
  unit_id           uuid not null references public.units(id),
  factor            numeric(14,3) not null check (factor > 0),
  qty               numeric(14,3) not null check (qty > 0),
  unit_price        numeric(18,2) not null check (unit_price >= 0),
  discount_amount   numeric(18,2) not null default 0 check (discount_amount >= 0),
  line_total        numeric(18,2) not null check (line_total >= 0),
  base_qty          numeric(14,3) not null check (base_qty > 0),
  cost_total        numeric(18,2) not null check (cost_total >= 0),  -- nilai persediaan (+PPN jika dikapitalisasi)
  location_id       uuid not null references public.locations(id),
  returned_base_qty numeric(14,3) not null default 0 check (returned_base_qty >= 0),
  created_at        timestamptz not null default now(),
  created_by        uuid default auth.uid(),
  updated_at        timestamptz not null default now(),
  check (returned_base_qty <= base_qty)
);
create index idx_gr_items_receipt on public.goods_receipt_items (receipt_id);

-- -----------------------------------------------------------------------------
-- Retur ke supplier
-- -----------------------------------------------------------------------------
create table public.purchase_returns (
  id                   uuid primary key default gen_random_uuid(),
  branch_id            uuid not null references public.branches(id),
  return_no            text not null,
  receipt_id           uuid not null references public.goods_receipts(id),
  supplier_id          uuid not null references public.suppliers(id),
  return_date          date not null,
  settlement           public.return_settlement not null,
  cash_bank_account_id uuid references public.cash_bank_accounts(id),
  amount               numeric(18,2) not null check (amount >= 0),     -- nilai faktur barang yang diretur
  ppn_amount           numeric(18,2) not null default 0 check (ppn_amount >= 0),
  reason               text not null,
  status               public.doc_status not null default 'posted',
  created_at           timestamptz not null default now(),
  created_by           uuid default auth.uid(),
  updated_at           timestamptz not null default now(),
  unique (branch_id, return_no),
  check (settlement = 'debt' or cash_bank_account_id is not null)
);

create table public.purchase_return_items (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid not null references public.branches(id),
  return_id       uuid not null references public.purchase_returns(id),
  receipt_item_id uuid not null references public.goods_receipt_items(id),
  item_id         uuid not null references public.items(id),
  location_id     uuid not null references public.locations(id),
  base_qty        numeric(14,3) not null check (base_qty > 0),
  amount          numeric(18,2) not null check (amount >= 0),
  created_at      timestamptz not null default now(),
  created_by      uuid default auth.uid(),
  updated_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Pembayaran hutang supplier
-- -----------------------------------------------------------------------------
create table public.supplier_payments (
  id                   uuid primary key default gen_random_uuid(),
  branch_id            uuid not null references public.branches(id),
  payment_no           text not null,
  supplier_id          uuid not null references public.suppliers(id),
  payment_date         date not null,
  cash_bank_account_id uuid not null references public.cash_bank_accounts(id),
  amount               numeric(18,2) not null check (amount > 0),
  notes                text,
  status               public.doc_status not null default 'posted',
  void_reason          text,
  created_at           timestamptz not null default now(),
  created_by           uuid default auth.uid(),
  updated_at           timestamptz not null default now(),
  unique (branch_id, payment_no)
);

create table public.supplier_payment_allocations (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id),
  payment_id uuid not null references public.supplier_payments(id),
  receipt_id uuid not null references public.goods_receipts(id),
  amount     numeric(18,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (payment_id, receipt_id)
);
create index idx_payment_alloc_receipt on public.supplier_payment_allocations (receipt_id);

-- =============================================================================
-- Trigger standar
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array['suppliers', 'purchase_orders', 'purchase_order_items', 'goods_receipts', 'goods_receipt_items',
    'purchase_returns', 'purchase_return_items', 'supplier_payments', 'supplier_payment_allocations'] loop
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$I
                    for each row execute function app.set_updated_at()', t);
    execute format('create trigger trg_audit after insert or update or delete on public.%I
                    for each row execute function app.audit_row_change()', t);
  end loop;
  -- Dokumen & master: tanpa hapus permanen (baris PO draft boleh dihapus saat diedit)
  foreach t in array array['suppliers', 'purchase_orders', 'goods_receipts', 'goods_receipt_items', 'purchase_returns',
    'purchase_return_items', 'supplier_payments', 'supplier_payment_allocations'] loop
    execute format('create trigger trg_no_delete before delete on public.%I
                    for each row execute function app.prevent_modification()', t);
  end loop;
end $$;

-- =============================================================================
-- Hutang per faktur (view, tunduk RLS pemanggil)
-- =============================================================================
create view public.v_ap_receipts with (security_invoker = true) as
  select r.id as receipt_id, r.branch_id, r.gr_no, r.supplier_id, s.name as supplier_name, r.invoice_no,
         r.receipt_date, r.due_date, r.total,
         coalesce(p.paid, 0)::numeric(18,2) as paid,
         coalesce(rt.returned, 0)::numeric(18,2) as returned,
         (r.total - coalesce(p.paid, 0) - coalesce(rt.returned, 0))::numeric(18,2) as outstanding,
         (app.today_wib() - r.due_date) as days_overdue,
         case when app.today_wib() - r.receipt_date <= 30 then '0-30'
              when app.today_wib() - r.receipt_date <= 60 then '31-60'
              else '>60' end as age_bucket
  from public.goods_receipts r
  join public.suppliers s on s.id = r.supplier_id
  left join lateral (
    select sum(a.amount) as paid from public.supplier_payment_allocations a
    join public.supplier_payments sp on sp.id = a.payment_id and sp.status = 'posted'
    where a.receipt_id = r.id
  ) p on true
  left join lateral (
    select sum(pr.amount + pr.ppn_amount) as returned from public.purchase_returns pr
    where pr.receipt_id = r.id and pr.status = 'posted' and pr.settlement = 'debt'
  ) rt on true
  where r.status = 'posted';

-- =============================================================================
-- Helper
-- =============================================================================
create or replace function app.receipt_outstanding(p_receipt_id uuid)
returns numeric
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select outstanding from public.v_ap_receipts where receipt_id = p_receipt_id), 0)
$$;

-- Faktor konversi barang+satuan (satuan dasar = 1)
create or replace function app.unit_factor(p_item_id uuid, p_unit_id uuid)
returns numeric
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_factor numeric;
begin
  if exists (select 1 from public.items where id = p_item_id and base_unit_id = p_unit_id) then
    return 1;
  end if;
  select factor into v_factor from public.item_units where item_id = p_item_id and unit_id = p_unit_id;
  if v_factor is null then
    raise exception 'Satuan tidak terdaftar untuk barang ini' using errcode = '22023';
  end if;
  return v_factor;
end;
$$;

create or replace function app.cash_account(p_cash_bank_account_id uuid)
returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_acc uuid;
begin
  select account_id into v_acc from public.cash_bank_accounts
   where id = p_cash_bank_account_id and branch_id = app.current_branch_id() and is_active;
  if v_acc is null then raise exception 'Akun kas/bank tidak ditemukan atau nonaktif' using errcode = '22023'; end if;
  return v_acc;
end;
$$;

-- =============================================================================
-- Supplier
-- =============================================================================
create or replace function public.save_supplier(p_id uuid, p_data jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_terms integer := coalesce(nullif(p_data ->> 'payment_terms_days', '')::int, 0);
begin
  perform app.assert_permission('purchasing', case when p_id is null then 'create' else 'update' end::public.permission_action);
  if length(btrim(coalesce(p_data ->> 'name', ''))) < 2 then
    raise exception 'Nama supplier minimal 2 karakter' using errcode = '22023';
  end if;
  if v_terms < 0 or v_terms > 365 then raise exception 'Termin 0-365 hari' using errcode = '22023'; end if;

  if p_id is null then
    insert into public.suppliers (branch_id, code, name, contact_name, phone, email, address, npwp, payment_terms_days,
                                  bank_name, bank_account_number, bank_account_name, notes)
    values (app.current_branch_id(), app.next_master_code('SUP', 3), btrim(p_data ->> 'name'),
            nullif(btrim(p_data ->> 'contact_name'), ''), nullif(btrim(p_data ->> 'phone'), ''), nullif(lower(btrim(p_data ->> 'email')), ''),
            nullif(btrim(p_data ->> 'address'), ''), nullif(btrim(p_data ->> 'npwp'), ''), v_terms,
            nullif(btrim(p_data ->> 'bank_name'), ''), nullif(btrim(p_data ->> 'bank_account_number'), ''),
            nullif(btrim(p_data ->> 'bank_account_name'), ''), nullif(btrim(p_data ->> 'notes'), ''))
    returning id into v_id;
  else
    update public.suppliers
       set name = btrim(p_data ->> 'name'), contact_name = nullif(btrim(p_data ->> 'contact_name'), ''),
           phone = nullif(btrim(p_data ->> 'phone'), ''), email = nullif(lower(btrim(p_data ->> 'email')), ''),
           address = nullif(btrim(p_data ->> 'address'), ''), npwp = nullif(btrim(p_data ->> 'npwp'), ''),
           payment_terms_days = v_terms, bank_name = nullif(btrim(p_data ->> 'bank_name'), ''),
           bank_account_number = nullif(btrim(p_data ->> 'bank_account_number'), ''),
           bank_account_name = nullif(btrim(p_data ->> 'bank_account_name'), ''), notes = nullif(btrim(p_data ->> 'notes'), '')
     where id = p_id and branch_id = app.current_branch_id()
    returning id into v_id;
    if v_id is null then raise exception 'Supplier tidak ditemukan' using errcode = 'P0002'; end if;
  end if;
  return v_id;
exception when unique_violation then
  raise exception 'Nama supplier sudah dipakai' using errcode = '23505';
end;
$$;

create or replace function public.set_supplier_active(p_id uuid, p_active boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform app.assert_permission('purchasing', 'update');
  update public.suppliers set is_active = p_active where id = p_id and branch_id = app.current_branch_id();
  if not found then raise exception 'Supplier tidak ditemukan' using errcode = 'P0002'; end if;
end;
$$;

-- =============================================================================
-- Purchase order. p_items: [{item_id, unit_id, qty, unit_price}]
-- =============================================================================
create or replace function public.save_purchase_order(p_id uuid, p_data jsonb, p_items jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_id     uuid;
  v_status public.po_status;
  x        jsonb;
begin
  perform app.assert_permission('purchasing', case when p_id is null then 'create' else 'update' end::public.permission_action);
  perform app.assert_ref('suppliers', (p_data ->> 'supplier_id')::uuid, 'Supplier');
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then
    raise exception 'PO minimal berisi satu barang' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.purchase_orders (branch_id, po_no, supplier_id, order_date, expected_date, notes)
    values (v_branch, app.next_document_number('PO', coalesce(nullif(p_data ->> 'order_date', '')::date, app.today_wib()), v_branch),
            (p_data ->> 'supplier_id')::uuid, coalesce(nullif(p_data ->> 'order_date', '')::date, app.today_wib()),
            nullif(p_data ->> 'expected_date', '')::date, nullif(btrim(p_data ->> 'notes'), ''))
    returning id into v_id;
  else
    select status into v_status from public.purchase_orders where id = p_id and branch_id = v_branch for update;
    if v_status is null then raise exception 'PO tidak ditemukan' using errcode = 'P0002'; end if;
    if v_status <> 'draft' then raise exception 'Hanya PO draft yang bisa diubah' using errcode = '22023'; end if;
    update public.purchase_orders
       set supplier_id = (p_data ->> 'supplier_id')::uuid,
           order_date = coalesce(nullif(p_data ->> 'order_date', '')::date, order_date),
           expected_date = nullif(p_data ->> 'expected_date', '')::date, notes = nullif(btrim(p_data ->> 'notes'), '')
     where id = p_id returning id into v_id;
    delete from public.purchase_order_items where po_id = v_id;
  end if;

  for x in select * from jsonb_array_elements(p_items) loop
    perform app.assert_ref('items', (x ->> 'item_id')::uuid, 'Barang');
    if coalesce((x ->> 'qty')::numeric, 0) <= 0 or coalesce((x ->> 'unit_price')::numeric, -1) < 0 then
      raise exception 'Jumlah harus > 0 dan harga tidak boleh minus' using errcode = '22023';
    end if;
    insert into public.purchase_order_items (branch_id, po_id, item_id, unit_id, factor, qty, unit_price)
    values (v_branch, v_id, (x ->> 'item_id')::uuid, (x ->> 'unit_id')::uuid,
            app.unit_factor((x ->> 'item_id')::uuid, (x ->> 'unit_id')::uuid), (x ->> 'qty')::numeric, (x ->> 'unit_price')::numeric);
  end loop;
  return v_id;
end;
$$;

-- Aksi status PO: send (draft→sent), close (sent/partial→closed), cancel (draft/sent tanpa penerimaan)
create or replace function public.set_purchase_order_status(p_id uuid, p_action text, p_reason text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status public.po_status;
begin
  perform app.assert_permission('purchasing', 'update');
  select status into v_status from public.purchase_orders where id = p_id and branch_id = app.current_branch_id() for update;
  if v_status is null then raise exception 'PO tidak ditemukan' using errcode = 'P0002'; end if;

  if p_action = 'send' and v_status = 'draft' then
    update public.purchase_orders set status = 'sent' where id = p_id;
  elsif p_action = 'close' and v_status in ('sent', 'partial') then
    update public.purchase_orders set status = 'closed' where id = p_id;
  elsif p_action = 'cancel' and v_status in ('draft', 'sent') then
    if length(btrim(coalesce(p_reason, ''))) < 3 then
      raise exception 'Alasan pembatalan wajib diisi' using errcode = '22023';
    end if;
    update public.purchase_orders set status = 'cancelled', cancel_reason = btrim(p_reason) where id = p_id;
  else
    raise exception 'Aksi % tidak bisa dilakukan pada PO berstatus %', p_action, v_status using errcode = '22023';
  end if;
end;
$$;

-- =============================================================================
-- Pembayaran (dipakai juga oleh penerimaan yang dibayar langsung)
-- =============================================================================
create or replace function app.post_supplier_payment(
  p_supplier_id uuid, p_date date, p_cash_bank_account_id uuid, p_allocations jsonb, p_notes text
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_total  numeric(18,2);
  v_id     uuid;
  v_no     text;
  a        jsonb;
  v_cash   uuid := app.cash_account(p_cash_bank_account_id);
begin
  if jsonb_array_length(coalesce(p_allocations, '[]')) = 0 then
    raise exception 'Pilih minimal satu faktur yang dibayar' using errcode = '22023';
  end if;
  select sum(round((x ->> 'amount')::numeric, 2)) into v_total from jsonb_array_elements(p_allocations) x;
  if coalesce(v_total, 0) <= 0 then raise exception 'Jumlah bayar harus lebih dari nol' using errcode = '22023'; end if;

  v_no := app.next_document_number('BS', p_date, v_branch);
  insert into public.supplier_payments (branch_id, payment_no, supplier_id, payment_date, cash_bank_account_id, amount, notes)
  values (v_branch, v_no, p_supplier_id, p_date, p_cash_bank_account_id, v_total, nullif(btrim(p_notes), ''))
  returning id into v_id;

  for a in select * from jsonb_array_elements(p_allocations) loop
    -- Kunci faktur agar dua pembayaran bersamaan tidak melebihi sisa hutang
    perform 1 from public.goods_receipts
     where id = (a ->> 'receipt_id')::uuid and supplier_id = p_supplier_id and branch_id = v_branch and status = 'posted' for update;
    if not found then raise exception 'Faktur tidak ditemukan untuk supplier ini' using errcode = '22023'; end if;
    if round((a ->> 'amount')::numeric, 2) <= 0 then raise exception 'Jumlah per faktur harus lebih dari nol' using errcode = '22023'; end if;
    if round((a ->> 'amount')::numeric, 2) > app.receipt_outstanding((a ->> 'receipt_id')::uuid) then
      raise exception 'Pembayaran melebihi sisa hutang faktur' using errcode = '23514';
    end if;
    insert into public.supplier_payment_allocations (branch_id, payment_id, receipt_id, amount)
    values (v_branch, v_id, (a ->> 'receipt_id')::uuid, round((a ->> 'amount')::numeric, 2));
  end loop;

  perform app.post_journal(p_date, 'supplier_payment', v_id, 'Bayar hutang supplier ' || v_no,
    jsonb_build_array(jsonb_build_object('account', 'ap', 'debit', v_total),
                      jsonb_build_object('account_id', v_cash, 'credit', v_total)));
  return v_id;
end;
$$;

create or replace function public.post_supplier_payment(p_data jsonb, p_allocations jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
begin
  perform app.assert_permission('payables', 'create');
  perform app.assert_ref('suppliers', (p_data ->> 'supplier_id')::uuid, 'Supplier');
  return app.post_supplier_payment((p_data ->> 'supplier_id')::uuid,
    coalesce(nullif(p_data ->> 'payment_date', '')::date, app.today_wib()),
    (p_data ->> 'cash_bank_account_id')::uuid, p_allocations, p_data ->> 'notes');
end;
$$;

create or replace function public.void_supplier_payment(p_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_pay public.supplier_payments%rowtype;
begin
  perform app.assert_permission('payables', 'void');
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Alasan pembatalan wajib diisi' using errcode = '22023'; end if;
  select * into v_pay from public.supplier_payments where id = p_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Pembayaran tidak ditemukan' using errcode = 'P0002'; end if;
  if v_pay.status = 'void' then raise exception 'Pembayaran sudah dibatalkan' using errcode = '22023'; end if;
  update public.supplier_payments set status = 'void', void_reason = btrim(p_reason) where id = p_id;
  perform app.reverse_journals('supplier_payment', p_id, app.today_wib(), 'Batal bayar ' || v_pay.payment_no || ': ' || btrim(p_reason));
end;
$$;

-- =============================================================================
-- Penerimaan barang
-- p_data: supplier_id, po_id?, receipt_date?, invoice_no?, invoice_date?, due_date?, ppn_amount?, notes?,
--         paid_amount?, cash_bank_account_id? (bayar langsung)
-- p_items: [{item_id, unit_id, qty, unit_price, discount_amount?, location_id, po_item_id?}]
-- =============================================================================
create or replace function public.post_goods_receipt(p_data jsonb, p_items jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch   uuid := app.current_branch_id();
  v_supplier public.suppliers%rowtype;
  v_po       public.purchase_orders%rowtype;
  v_date     date := coalesce(nullif(p_data ->> 'receipt_date', '')::date, app.today_wib());
  v_ppn      numeric(18,2) := round(coalesce(nullif(p_data ->> 'ppn_amount', '')::numeric, 0), 2);
  v_cap      boolean := not app.setting_bool('ppn_enabled', v_branch);
  v_subtotal numeric(18,2) := 0;
  v_id       uuid;
  v_no       text;
  v_paid     numeric(18,2) := round(coalesce(nullif(p_data ->> 'paid_amount', '')::numeric, 0), 2);
  v_left     numeric(18,2);
  v_n        integer;
  v_i        integer := 0;
  v_share    numeric(18,2);
  v_poi      public.purchase_order_items%rowtype;
  r          record;
begin
  perform app.assert_permission('purchasing', 'create');
  select * into v_supplier from public.suppliers where id = (p_data ->> 'supplier_id')::uuid and branch_id = v_branch and is_active;
  if not found then raise exception 'Supplier tidak ditemukan atau nonaktif' using errcode = '22023'; end if;
  if v_ppn < 0 then raise exception 'PPN tidak boleh minus' using errcode = '22023'; end if;
  v_n := jsonb_array_length(coalesce(p_items, '[]'));
  if v_n = 0 then raise exception 'Penerimaan minimal berisi satu barang' using errcode = '22023'; end if;

  if nullif(p_data ->> 'po_id', '') is not null then
    select * into v_po from public.purchase_orders where id = (p_data ->> 'po_id')::uuid and branch_id = v_branch for update;
    if not found then raise exception 'PO tidak ditemukan' using errcode = 'P0002'; end if;
    if v_po.status not in ('sent', 'partial') then
      raise exception 'PO harus berstatus Dikirim atau Diterima Sebagian' using errcode = '22023';
    end if;
    if v_po.supplier_id <> v_supplier.id then raise exception 'Supplier berbeda dengan PO' using errcode = '22023'; end if;
  end if;

  -- Hitung baris (nilai faktur) lebih dulu untuk subtotal & alokasi PPN
  create temporary table if not exists _gr (
    n int, item_id uuid, unit_id uuid, factor numeric, qty numeric, unit_price numeric, discount numeric,
    line_total numeric(18,2), base_qty numeric(14,3), location_id uuid, po_item_id uuid
  ) on commit drop;
  truncate _gr;
  insert into _gr
  select row_number() over (), (x ->> 'item_id')::uuid, (x ->> 'unit_id')::uuid, null, (x ->> 'qty')::numeric,
         (x ->> 'unit_price')::numeric, coalesce(nullif(x ->> 'discount_amount', '')::numeric, 0), null, null,
         (x ->> 'location_id')::uuid, nullif(x ->> 'po_item_id', '')::uuid
  from jsonb_array_elements(p_items) x;

  for r in select * from _gr loop
    perform app.assert_ref('items', r.item_id, 'Barang');
    perform app.assert_ref('locations', r.location_id, 'Lokasi rak');
    if coalesce(r.qty, 0) <= 0 then raise exception 'Jumlah barang harus lebih dari nol' using errcode = '22023'; end if;
    if coalesce(r.unit_price, -1) < 0 or r.discount < 0 then raise exception 'Harga/diskon tidak boleh minus' using errcode = '22023'; end if;
    if r.discount > r.qty * r.unit_price then raise exception 'Diskon melebihi nilai baris' using errcode = '22023'; end if;
    update _gr set factor = app.unit_factor(r.item_id, r.unit_id),
                   line_total = round(r.qty * r.unit_price - r.discount, 2)
     where n = r.n;
    update _gr set base_qty = round(qty * factor, 3) where n = r.n;
    if r.po_item_id is not null then
      select * into v_poi from public.purchase_order_items where id = r.po_item_id for update;
      if v_poi.po_id is distinct from v_po.id or v_poi.item_id <> r.item_id then
        raise exception 'Baris PO tidak cocok dengan barang' using errcode = '22023';
      end if;
      if v_poi.received_base_qty + (select base_qty from _gr where n = r.n) > round(v_poi.qty * v_poi.factor, 3) then
        raise exception 'Jumlah diterima melebihi sisa pesanan PO' using errcode = '23514';
      end if;
    end if;
  end loop;
  select coalesce(sum(line_total), 0) into v_subtotal from _gr;

  v_no := app.next_document_number('GR', v_date, v_branch);
  insert into public.goods_receipts (branch_id, gr_no, supplier_id, po_id, receipt_date, invoice_no, invoice_date, due_date,
                                     subtotal, ppn_amount, ppn_capitalized, total, notes)
  values (v_branch, v_no, v_supplier.id, v_po.id, v_date, nullif(btrim(p_data ->> 'invoice_no'), ''),
          nullif(p_data ->> 'invoice_date', '')::date,
          coalesce(nullif(p_data ->> 'due_date', '')::date, v_date + v_supplier.payment_terms_days),
          v_subtotal, v_ppn, v_cap, v_subtotal + v_ppn, nullif(btrim(p_data ->> 'notes'), ''))
  returning id into v_id;

  -- Baris: PPN dialokasikan proporsional ke nilai baris bila tidak PKP (masuk HPP); sisa pembulatan ke baris terakhir
  v_left := case when v_cap then v_ppn else 0 end;
  for r in select * from _gr order by n loop
    v_i := v_i + 1;
    v_share := case when not v_cap or v_ppn = 0 then 0
                    when v_i = v_n then v_left
                    when v_subtotal = 0 then round(v_ppn / v_n, 2)
                    else round(v_ppn * r.line_total / v_subtotal, 2) end;
    v_left := v_left - v_share;
    insert into public.goods_receipt_items (branch_id, receipt_id, po_item_id, item_id, unit_id, factor, qty, unit_price,
                                            discount_amount, line_total, base_qty, cost_total, location_id)
    values (v_branch, v_id, r.po_item_id, r.item_id, r.unit_id, r.factor, r.qty, r.unit_price, r.discount, r.line_total,
            r.base_qty, r.line_total + v_share, r.location_id);
    -- Stok + HPP rata-rata (harga pokok per satuan dasar)
    perform app.post_stock_movement(r.item_id, r.location_id, 'purchase', r.base_qty,
                                    (r.line_total + v_share) / r.base_qty, 'goods_receipt', v_id, v_no);
    if r.po_item_id is not null then
      update public.purchase_order_items set received_base_qty = received_base_qty + r.base_qty where id = r.po_item_id;
    end if;
  end loop;

  -- Status PO: penuh jika semua baris terpenuhi
  if v_po.id is not null then
    update public.purchase_orders po
       set status = case when not exists (select 1 from public.purchase_order_items i
                                          where i.po_id = po.id and i.received_base_qty < round(i.qty * i.factor, 3))
                         then 'received' else 'partial' end::public.po_status
     where po.id = v_po.id;
  end if;

  -- Jurnal: Dr Persediaan (+PPN jika dikapitalisasi), Dr PPN Masukan (jika PKP), Cr Hutang Usaha
  perform app.post_journal(v_date, 'goods_receipt', v_id, 'Penerimaan barang ' || v_no || ' · ' || v_supplier.name,
    jsonb_build_array(
      jsonb_build_object('account', 'inventory', 'debit', v_subtotal + case when v_cap then v_ppn else 0 end),
      jsonb_build_object('account', 'ppn_in', 'debit', case when v_cap then 0 else v_ppn end),
      jsonb_build_object('account', 'ap', 'credit', v_subtotal + v_ppn)));

  -- Bayar langsung (tunai/transfer saat barang datang)
  if v_paid > 0 then
    if not app.has_permission('payables', 'create') then
      raise exception 'Anda tidak punya izin mencatat pembayaran supplier' using errcode = '42501';
    end if;
    perform app.post_supplier_payment(v_supplier.id, v_date, (p_data ->> 'cash_bank_account_id')::uuid,
      jsonb_build_array(jsonb_build_object('receipt_id', v_id, 'amount', least(v_paid, v_subtotal + v_ppn))), 'Bayar saat terima ' || v_no);
  end if;
  return v_id;
end;
$$;

-- =============================================================================
-- Retur ke supplier
-- p_data: return_date?, settlement (debt|refund), cash_bank_account_id (refund), reason
-- p_items: [{receipt_item_id, base_qty}]
-- Dinilai harga faktur; selisih terhadap HPP rata-rata → akun Selisih Persediaan (PRD §5.4).
-- =============================================================================
create or replace function public.post_purchase_return(p_receipt_id uuid, p_data jsonb, p_items jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch   uuid := app.current_branch_id();
  v_gr       public.goods_receipts%rowtype;
  v_date     date := coalesce(nullif(p_data ->> 'return_date', '')::date, app.today_wib());
  v_settle   public.return_settlement := (p_data ->> 'settlement')::public.return_settlement;
  v_cash     uuid;
  v_id       uuid;
  v_no       text;
  v_amount   numeric(18,2) := 0;   -- nilai faktur (tanpa PPN terpisah)
  v_stock    numeric(18,2) := 0;   -- nilai keluar dari persediaan (HPP rata-rata)
  v_ppn      numeric(18,2) := 0;
  v_line     numeric(18,2);
  v_mov      uuid;
  gi         public.goods_receipt_items%rowtype;
  x          jsonb;
begin
  perform app.assert_permission('purchasing', 'create');
  if length(btrim(coalesce(p_data ->> 'reason', ''))) < 3 then raise exception 'Alasan retur wajib diisi' using errcode = '22023'; end if;
  select * into v_gr from public.goods_receipts where id = p_receipt_id and branch_id = v_branch and status = 'posted' for update;
  if not found then raise exception 'Penerimaan tidak ditemukan' using errcode = 'P0002'; end if;
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then raise exception 'Pilih barang yang diretur' using errcode = '22023'; end if;
  if v_settle = 'refund' then v_cash := app.cash_account((p_data ->> 'cash_bank_account_id')::uuid); end if;

  v_no := app.next_document_number('RB', v_date, v_branch);
  insert into public.purchase_returns (branch_id, return_no, receipt_id, supplier_id, return_date, settlement,
                                       cash_bank_account_id, amount, reason)
  values (v_branch, v_no, v_gr.id, v_gr.supplier_id, v_date, v_settle,
          nullif(p_data ->> 'cash_bank_account_id', '')::uuid, 0, btrim(p_data ->> 'reason'))
  returning id into v_id;

  for x in select * from jsonb_array_elements(p_items) loop
    select * into gi from public.goods_receipt_items
     where id = (x ->> 'receipt_item_id')::uuid and receipt_id = v_gr.id for update;
    if not found then raise exception 'Baris penerimaan tidak ditemukan' using errcode = '22023'; end if;
    if coalesce((x ->> 'base_qty')::numeric, 0) <= 0 then raise exception 'Jumlah retur harus lebih dari nol' using errcode = '22023'; end if;
    if gi.returned_base_qty + (x ->> 'base_qty')::numeric > gi.base_qty then
      raise exception 'Jumlah retur melebihi jumlah yang diterima' using errcode = '23514';
    end if;
    -- Nilai faktur per satuan dasar × jumlah retur
    v_line := round(gi.cost_total * (x ->> 'base_qty')::numeric / gi.base_qty, 2);
    v_amount := v_amount + v_line;
    v_mov := app.post_stock_movement(gi.item_id, gi.location_id, 'purchase_return', -(x ->> 'base_qty')::numeric,
                                     null, 'purchase_return', v_id, v_no);
    select v_stock + round(m.unit_cost * (x ->> 'base_qty')::numeric, 2) into v_stock from public.stock_movements m where m.id = v_mov;
    update public.goods_receipt_items set returned_base_qty = returned_base_qty + (x ->> 'base_qty')::numeric where id = gi.id;
    insert into public.purchase_return_items (branch_id, return_id, receipt_item_id, item_id, location_id, base_qty, amount)
    values (v_branch, v_id, gi.id, gi.item_id, gi.location_id, (x ->> 'base_qty')::numeric, v_line);
  end loop;

  -- PPN Masukan terpisah (PKP) ikut dibalik proporsional
  if not v_gr.ppn_capitalized and v_gr.ppn_amount > 0 and v_gr.subtotal > 0 then
    v_ppn := round(v_gr.ppn_amount * v_amount / v_gr.subtotal, 2);
  end if;
  update public.purchase_returns set amount = v_amount, ppn_amount = v_ppn where id = v_id;

  -- Potong hutang tidak boleh melebihi sisa hutang faktur (v_ap_receipts sudah ikut menghitung retur ini)
  if v_settle = 'debt' and app.receipt_outstanding(v_gr.id) < 0 then
    raise exception 'Nilai retur melebihi sisa hutang faktur; pilih "uang kembali"' using errcode = '23514';
  end if;

  -- Jurnal: Dr Hutang/Kas (nilai faktur + PPN), Cr Persediaan (HPP keluar), Cr PPN Masukan, selisih → Selisih Persediaan
  perform app.post_journal(v_date, 'purchase_return', v_id, 'Retur ke supplier ' || v_no || ' (' || v_gr.gr_no || ')',
    jsonb_build_array(
      case when v_settle = 'debt' then jsonb_build_object('account', 'ap', 'debit', v_amount + v_ppn)
           else jsonb_build_object('account_id', v_cash, 'debit', v_amount + v_ppn) end,
      jsonb_build_object('account', 'inventory', 'credit', v_stock),
      jsonb_build_object('account', 'ppn_in', 'credit', v_ppn),
      jsonb_build_object('account', 'inventory_variance',
                         'debit', greatest(v_stock - v_amount, 0), 'credit', greatest(v_amount - v_stock, 0))));
  return v_id;
end;
$$;

-- =============================================================================
-- RLS & hak akses
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array['suppliers', 'purchase_orders', 'purchase_order_items', 'goods_receipts', 'goods_receipt_items',
    'purchase_returns', 'purchase_return_items', 'supplier_payments', 'supplier_payment_allocations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- Pembelian: izin purchasing; hutang/pembayaran: izin payables (supplier & faktur terlihat oleh keduanya)
create policy suppliers_select on public.suppliers for select to authenticated
  using (branch_id = app.current_branch_id() and (app.has_permission('purchasing', 'view') or app.has_permission('payables', 'view')));
create policy purchase_orders_select on public.purchase_orders for select to authenticated
  using (branch_id = app.current_branch_id() and app.has_permission('purchasing', 'view'));
create policy purchase_order_items_select on public.purchase_order_items for select to authenticated
  using (branch_id = app.current_branch_id() and app.has_permission('purchasing', 'view'));
create policy goods_receipts_select on public.goods_receipts for select to authenticated
  using (branch_id = app.current_branch_id() and (app.has_permission('purchasing', 'view') or app.has_permission('payables', 'view')));
create policy goods_receipt_items_select on public.goods_receipt_items for select to authenticated
  using (branch_id = app.current_branch_id() and (app.has_permission('purchasing', 'view') or app.has_permission('payables', 'view')));
create policy purchase_returns_select on public.purchase_returns for select to authenticated
  using (branch_id = app.current_branch_id() and (app.has_permission('purchasing', 'view') or app.has_permission('payables', 'view')));
create policy purchase_return_items_select on public.purchase_return_items for select to authenticated
  using (branch_id = app.current_branch_id() and (app.has_permission('purchasing', 'view') or app.has_permission('payables', 'view')));
create policy supplier_payments_select on public.supplier_payments for select to authenticated
  using (branch_id = app.current_branch_id() and app.has_permission('payables', 'view'));
create policy supplier_payment_allocations_select on public.supplier_payment_allocations for select to authenticated
  using (branch_id = app.current_branch_id() and app.has_permission('payables', 'view'));

grant select on public.v_ap_receipts to authenticated;

revoke all on function app.receipt_outstanding(uuid), app.unit_factor(uuid, uuid), app.cash_account(uuid),
  app.post_supplier_payment(uuid, date, uuid, jsonb, text) from public, anon, authenticated;

revoke all on function public.save_supplier(uuid, jsonb), public.set_supplier_active(uuid, boolean),
  public.save_purchase_order(uuid, jsonb, jsonb), public.set_purchase_order_status(uuid, text, text),
  public.post_goods_receipt(jsonb, jsonb), public.post_purchase_return(uuid, jsonb, jsonb),
  public.post_supplier_payment(jsonb, jsonb), public.void_supplier_payment(uuid, text) from public, anon;
grant execute on function public.save_supplier(uuid, jsonb), public.set_supplier_active(uuid, boolean),
  public.save_purchase_order(uuid, jsonb, jsonb), public.set_purchase_order_status(uuid, text, text),
  public.post_goods_receipt(jsonb, jsonb), public.post_purchase_return(uuid, jsonb, jsonb),
  public.post_supplier_payment(jsonb, jsonb), public.void_supplier_payment(uuid, text) to authenticated;
