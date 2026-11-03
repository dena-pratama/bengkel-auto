-- Migration 000015: Retur Penjualan (PRD §8.5, §11.3)
-- Mengacu ke nota penjualan asli (POS / invoice WO), dalam batas waktu setting sales_return_max_days (default 7 hari).
-- Pilihan penyelesaian: uang kembali (refund tunai/transfer) atau potong piutang (debt).
-- Barang kondisi baik kembali ke stok rak; barang rusak masuk lokasi Karantina/Rusak.
-- Stok bertambah via mutasi sales_return, jurnal pembalik (Retur Penjualan, PPN Keluaran, Kas/Piutang, Persediaan, HPP).

-- -----------------------------------------------------------------------------
-- Setting batas hari retur
-- -----------------------------------------------------------------------------
insert into public.settings (branch_id, key, value, description)
select b.id, 'sales_return_max_days', '7'::jsonb, 'Batas waktu retur penjualan (hari) dari tanggal nota'
from public.branches b
where not exists (select 1 from public.settings s where s.branch_id = b.id and s.key = 'sales_return_max_days');

-- -----------------------------------------------------------------------------
-- Pastikan lokasi Karantina/Rusak tersedia per cabang (PRD §8.5)
-- -----------------------------------------------------------------------------
do $$
declare
  b record;
  v_area_id uuid;
begin
  for b in select id from public.branches loop
    select id into v_area_id from public.locations where branch_id = b.id and code = 'KRT';
    if v_area_id is null then
      insert into public.locations (branch_id, type, code, name)
      values (b.id, 'area', 'KRT', 'Area Karantina dan Rusak')
      returning id into v_area_id;
    end if;
    if not exists (select 1 from public.locations where branch_id = b.id and code = 'KRT-01') then
      insert into public.locations (branch_id, parent_id, type, code, name)
      values (b.id, v_area_id, 'rack', 'KRT-01', 'Rak Karantina dan Rusak');
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Tambah returned_qty pada sale_items untuk validasi jumlah retur
-- -----------------------------------------------------------------------------
alter table public.sale_items
  add column if not exists returned_qty numeric(14,3) not null default 0 check (returned_qty >= 0);

-- -----------------------------------------------------------------------------
-- Tabel sale_returns (dokumen retur penjualan)
-- -----------------------------------------------------------------------------
create table if not exists public.sale_returns (
  id                   uuid primary key default gen_random_uuid(),
  branch_id            uuid not null references public.branches(id),
  return_no            text not null,
  sale_id              uuid not null references public.sales(id),
  customer_id          uuid references public.customers(id),
  return_date          date not null default app.today_wib(),
  settlement           public.return_settlement not null,
  payment_method       public.payment_method,
  cash_bank_account_id uuid references public.cash_bank_accounts(id),
  shift_id             uuid references public.cash_shifts(id),
  amount               numeric(18,2) not null default 0 check (amount >= 0),
  ppn_amount           numeric(18,2) not null default 0 check (ppn_amount >= 0),
  total                numeric(18,2) not null default 0 check (total >= 0),
  cogs_total           numeric(18,2) not null default 0 check (cogs_total >= 0),
  reason               text not null,
  status               public.doc_status not null default 'posted',
  void_reason          text,
  created_at           timestamptz not null default now(),
  created_by           uuid default auth.uid(),
  updated_at           timestamptz not null default now(),
  unique (branch_id, return_no),
  check (length(btrim(reason)) >= 3),
  check (settlement = 'debt' or cash_bank_account_id is not null or payment_method = 'cash')
);
create index if not exists idx_sale_returns_sale on public.sale_returns (sale_id);
create index if not exists idx_sale_returns_customer on public.sale_returns (customer_id);
create index if not exists idx_sale_returns_date on public.sale_returns (return_date desc);
create index if not exists idx_sale_returns_shift on public.sale_returns (shift_id) where shift_id is not null;

-- -----------------------------------------------------------------------------
-- Tabel sale_return_items (rincian barang yang diretur)
-- -----------------------------------------------------------------------------
create table if not exists public.sale_return_items (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid not null references public.branches(id),
  return_id       uuid not null references public.sale_returns(id),
  sale_item_id    uuid not null references public.sale_items(id),
  item_id         uuid not null references public.items(id),
  condition       text not null default 'good' check (condition in ('good', 'damaged')),
  location_id     uuid not null references public.locations(id),
  qty             numeric(14,3) not null check (qty > 0),
  unit_price      numeric(18,2) not null check (unit_price >= 0),
  line_total      numeric(18,2) not null check (line_total >= 0),
  unit_cost       numeric(18,2) not null default 0 check (unit_cost >= 0),
  cost_total      numeric(18,2) not null default 0 check (cost_total >= 0),
  created_at      timestamptz not null default now(),
  created_by      uuid default auth.uid(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_sale_return_items_return on public.sale_return_items (return_id);
create index if not exists idx_sale_return_items_item on public.sale_return_items (item_id);

-- Trigger audit dan immutable
do $$
declare
  t text;
begin
  foreach t in array array['sale_returns', 'sale_return_items'] loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$I', t);
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$I
                    for each row execute function app.set_updated_at()', t);
    execute format('drop trigger if exists trg_audit on public.%1$I', t);
    execute format('create trigger trg_audit after insert or update or delete on public.%I
                    for each row execute function app.audit_row_change()', t);
    execute format('drop trigger if exists trg_no_delete on public.%1$I', t);
    execute format('create trigger trg_no_delete before delete on public.%I
                    for each row execute function app.prevent_modification()', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Hitung kas seharusnya di shift (termasuk potongan retur tunai)
-- -----------------------------------------------------------------------------
create or replace function app.shift_expected_cash(p_shift_id uuid)
returns numeric
language sql stable security definer
set search_path = ''
as $$
  select s.opening_cash
         + coalesce((select sum(amount) from public.payments where shift_id = s.id and method = 'cash' and status = 'posted'), 0)
         - coalesce((select sum(amount) from public.cash_movements where shift_id = s.id), 0)
         - coalesce((select sum(total) from public.sale_returns where shift_id = s.id and settlement = 'refund' and payment_method = 'cash' and status = 'posted'), 0)
  from public.cash_shifts s where s.id = p_shift_id
$$;

-- -----------------------------------------------------------------------------
-- Perbarui View v_sales (mengurangi sisa piutang jika ada retur potong piutang)
-- -----------------------------------------------------------------------------
drop view if exists public.v_ar_customers cascade;
drop view if exists public.v_sales cascade;

create view public.v_sales with (security_invoker = true) as
  select s.id, s.branch_id, s.sale_no, s.source, s.work_order_id, w.wo_no, coalesce(w.plate_no, s.plate_no) as plate_no,
         s.customer_id, c.name as customer_name, c.phone as customer_phone, s.sale_date, s.due_date, s.status,
         s.subtotal, s.discount_amount, s.ppn_amount, s.ppn_included, s.total, s.service_revenue, s.parts_revenue,
         s.notes, s.void_reason, s.posted_at, s.created_at,
         coalesce(p.paid, 0)::numeric(18,2) as paid,
         coalesce(sr.returned, 0)::numeric(18,2) as returned_total,
         case when s.status = 'posted' then greatest(0, (s.total - coalesce(p.paid, 0) - coalesce(sr.debt_returned, 0)))::numeric(18,2) else 0::numeric(18,2) end as outstanding,
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
  ) p on true
  left join lateral (
    select sum(total) as returned,
           sum(total) filter (where settlement = 'debt') as debt_returned
    from public.sale_returns r where r.sale_id = s.id and r.status = 'posted'
  ) sr on true;

create view public.v_ar_customers with (security_invoker = true) as
  select customer_id, customer_name, count(*)::integer as invoices, sum(outstanding)::numeric(18,2) as outstanding,
         sum(outstanding) filter (where age_bucket = '0-30')::numeric(18,2) as bucket_0_30,
         sum(outstanding) filter (where age_bucket = '31-60')::numeric(18,2) as bucket_31_60,
         sum(outstanding) filter (where age_bucket = '>60')::numeric(18,2) as bucket_60_plus,
         max(days_overdue) as max_days_overdue
  from public.v_sales where status = 'posted' and outstanding > 0 and customer_id is not null
  group by customer_id, customer_name;

-- -----------------------------------------------------------------------------
-- Perbarui View v_cash_shifts (menampilkan retur tunai)
-- -----------------------------------------------------------------------------
drop view if exists public.v_cash_shifts cascade;

create view public.v_cash_shifts with (security_invoker = true) as
  select s.*, app.employee_name(s.cashier_id) as cashier_name,
         coalesce(pm.cash_in, 0)::numeric(18,2) as cash_in,
         coalesce(cm.cash_out, 0)::numeric(18,2) as cash_out,
         coalesce(sr.cash_refund, 0)::numeric(18,2) as cash_refund,
         coalesce(pm.transfer_in, 0)::numeric(18,2) as transfer_in,
         coalesce(pm.qris_in, 0)::numeric(18,2) as qris_in,
         coalesce(pm.card_in, 0)::numeric(18,2) as card_in,
         case when s.status = 'open' then (s.opening_cash + coalesce(pm.cash_in, 0) - coalesce(cm.cash_out, 0) - coalesce(sr.cash_refund, 0))::numeric(18,2)
              else s.expected_cash end as expected_now
  from public.cash_shifts s
  left join lateral (
    select sum(amount) filter (where method = 'cash') as cash_in, sum(amount) filter (where method = 'transfer') as transfer_in,
           sum(amount) filter (where method = 'qris') as qris_in, sum(amount) filter (where method = 'card') as card_in
    from public.payments where shift_id = s.id and status = 'posted'
  ) pm on true
  left join lateral (select sum(amount) as cash_out from public.cash_movements where shift_id = s.id) cm on true
  left join lateral (select sum(total) as cash_refund from public.sale_returns where shift_id = s.id and settlement = 'refund' and payment_method = 'cash' and status = 'posted') sr on true;

-- -----------------------------------------------------------------------------
-- View v_sale_returns
-- -----------------------------------------------------------------------------
drop view if exists public.v_sale_returns cascade;
create view public.v_sale_returns with (security_invoker = true) as
  select r.id, r.branch_id, r.return_no, r.sale_id, s.sale_no, s.source as sale_source,
         w.wo_no as wo_no, coalesce(w.plate_no, s.plate_no) as plate_no,
         r.customer_id, c.name as customer_name, c.phone as customer_phone,
         r.return_date, r.settlement, r.payment_method, r.cash_bank_account_id,
         a.name as cash_bank_account_name, r.shift_id, cs.shift_no,
         r.amount, r.ppn_amount, r.total, r.cogs_total, r.reason, r.status, r.void_reason,
         r.created_at, app.employee_name(e.id) as created_by_name,
         (select count(*)::integer from public.sale_return_items i where i.return_id = r.id) as item_count
  from public.sale_returns r
  join public.sales s on s.id = r.sale_id
  left join public.work_orders w on w.id = s.work_order_id
  left join public.customers c on c.id = r.customer_id
  left join public.cash_bank_accounts a on a.id = r.cash_bank_account_id
  left join public.cash_shifts cs on cs.id = r.shift_id
  left join public.employees e on e.id = app.current_employee_id();

-- -----------------------------------------------------------------------------
-- Fungsi posting retur penjualan (PRD §8.5, §11.3)
-- -----------------------------------------------------------------------------
create or replace function public.post_sale_return(
  p_sale_id uuid,
  p_data    jsonb,
  p_items   jsonb,
  p_pin     text default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch      uuid := app.current_branch_id();
  v_sale        public.sales%rowtype;
  v_date        date := coalesce(nullif(p_data ->> 'return_date', '')::date, app.today_wib());
  v_settle      public.return_settlement := (p_data ->> 'settlement')::public.return_settlement;
  v_method      public.payment_method := nullif(p_data ->> 'payment_method', '')::public.payment_method;
  v_cash_acc    uuid := null;
  v_shift_id    uuid := null;
  v_reason      text := btrim(coalesce(p_data ->> 'reason', ''));
  v_max_days    integer;
  v_approver    uuid;
  v_id          uuid;
  v_no          text;
  v_amount      numeric(18,2) := 0;
  v_ppn         numeric(18,2) := 0;
  v_cogs        numeric(18,2) := 0;
  v_total       numeric(18,2) := 0;
  v_outstanding numeric(18,2);
  v_krt_loc     uuid;
  x             jsonb;
  si            public.sale_items%rowtype;
  v_qty         numeric(14,3);
  v_cond        text;
  v_target_loc  uuid;
  v_line_net    numeric(18,2);
  v_line_cogs   numeric(18,2);
  v_unit_cogs   numeric(18,2);
  v_journal     jsonb := '[]'::jsonb;
begin
  perform app.assert_permission('sales', 'create');

  if length(v_reason) < 3 then
    raise exception 'Alasan retur wajib diisi (minimal 3 karakter)' using errcode = '22023';
  end if;

  select * into v_sale from public.sales where id = p_sale_id and branch_id = v_branch for update;
  if not found then raise exception 'Invoice tidak ditemukan' using errcode = 'P0002'; end if;
  if v_sale.status <> 'posted' then
    raise exception 'Hanya invoice yang sudah diposting yang bisa diretur' using errcode = '22023';
  end if;

  -- Cek batas waktu retur dari tanggal nota (PRD §8.5)
  select coalesce((select (value #>> '{}')::integer from public.settings where branch_id = v_branch and key = 'sales_return_max_days'), 7)
    into v_max_days;

  if v_date > v_sale.sale_date + v_max_days then
    v_approver := app.verify_pin(p_pin);
    if not app.employee_has_role(v_approver, 'owner') and not app.employee_has_role(v_approver, 'admin') then
      raise exception 'Batas waktu retur adalah % hari dari tanggal nota; butuh PIN Owner atau Admin', v_max_days using errcode = '42501';
    end if;
  end if;

  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then
    raise exception 'Pilih barang yang ingin diretur' using errcode = '22023';
  end if;

  -- Validasi penyelesaian
  if v_settle = 'refund' then
    v_method := coalesce(v_method, 'cash');
    if v_method = 'cash' then
      v_shift_id := app.my_open_shift();
      v_cash_acc := (select account_id from public.cash_bank_accounts where id = app.payment_account('cash', null));
    else
      v_cash_acc := app.payment_account(v_method, nullif(p_data ->> 'cash_bank_account_id', '')::uuid);
      v_cash_acc := (select account_id from public.cash_bank_accounts where id = v_cash_acc);
    end if;
  elsif v_settle = 'debt' then
    if v_sale.customer_id is null then
      raise exception 'Penjualan ke pelanggan Umum tidak memiliki piutang; pilih uang kembali' using errcode = '22023';
    end if;
    -- Hitung sisa piutang nota saat ini
    select (v_sale.total - coalesce(sum(p.amount) filter (where p.status = 'posted'), 0)
                         - coalesce((select sum(total) from public.sale_returns sr where sr.sale_id = v_sale.id and sr.status = 'posted' and sr.settlement = 'debt'), 0))
      into v_outstanding
      from public.payments p where p.sale_id = v_sale.id;
    if v_outstanding <= 0 then
      raise exception 'Nota ini sudah lunas; pilih uang kembali' using errcode = '23514';
    end if;
  else
    raise exception 'Penyelesaian retur tidak valid' using errcode = '22023';
  end if;

  -- Ambil lokasi karantina cabang (untuk barang rusak)
  select id into v_krt_loc from public.locations where branch_id = v_branch and code = 'KRT-01' limit 1;

  v_no := app.next_document_number('RJ', v_date, v_branch);
  insert into public.sale_returns (
    branch_id, return_no, sale_id, customer_id, return_date, settlement,
    payment_method, cash_bank_account_id, shift_id, amount, ppn_amount, total, cogs_total, reason
  ) values (
    v_branch, v_no, v_sale.id, v_sale.customer_id, v_date, v_settle,
    case when v_settle = 'refund' then v_method else null end,
    case when v_settle = 'refund' and v_method <> 'cash' then nullif(p_data ->> 'cash_bank_account_id', '')::uuid else null end,
    v_shift_id, 0, 0, 0, 0, v_reason
  ) returning id into v_id;

  for x in select * from jsonb_array_elements(p_items) loop
    select * into si from public.sale_items
     where id = (x ->> 'sale_item_id')::uuid and sale_id = v_sale.id for update;
    if not found then raise exception 'Baris invoice tidak ditemukan' using errcode = '22023'; end if;
    if si.line_type <> 'part' then
      raise exception 'Hanya sparepart yang dapat diretur secara fisik' using errcode = '22023';
    end if;

    v_qty := coalesce((x ->> 'qty')::numeric, 0);
    if v_qty <= 0 then
      raise exception 'Jumlah retur harus lebih dari nol' using errcode = '22023';
    end if;
    if si.returned_qty + v_qty > si.qty then
      raise exception 'Jumlah retur (%) melebihi sisa yang dapat diretur (%)', v_qty, (si.qty - si.returned_qty) using errcode = '23514';
    end if;

    v_cond := coalesce(nullif(x ->> 'condition', ''), 'good');
    if v_cond not in ('good', 'damaged') then
      raise exception 'Kondisi barang harus baik atau rusak' using errcode = '22023';
    end if;

    if v_cond = 'damaged' then
      v_target_loc := coalesce(nullif(x ->> 'location_id', '')::uuid, v_krt_loc);
    else
      v_target_loc := coalesce(nullif(x ->> 'location_id', '')::uuid, si.location_id, (select default_location_id from public.items where id = si.item_id));
    end if;
    if v_target_loc is null then
      raise exception 'Pilih lokasi rak untuk pengembalian barang' using errcode = '22023';
    end if;

    -- Nilai jual retur (proporsional terhadap line net)
    v_line_net := round(si.net_amount * v_qty / si.qty, 2);
    v_amount := v_amount + v_line_net;

    -- HPP retur (proporsional terhadap cost_total saat invoice diposting)
    v_line_cogs := round(si.cost_total * v_qty / si.qty, 2);
    v_cogs := v_cogs + v_line_cogs;
    v_unit_cogs := case when v_qty > 0 then round(v_line_cogs / v_qty, 2) else 0 end;

    -- Mutasi stok masuk kembali (tipe mutasi sales_return)
    perform app.post_stock_movement(
      si.item_id, v_target_loc, 'sales_return', v_qty, v_unit_cogs,
      'sale_return', v_id, 'Retur ' || v_no
    );

    update public.sale_items set returned_qty = returned_qty + v_qty where id = si.id;

    insert into public.sale_return_items (
      branch_id, return_id, sale_item_id, item_id, condition, location_id,
      qty, unit_price, line_total, unit_cost, cost_total
    ) values (
      v_branch, v_id, si.id, si.item_id, v_cond, v_target_loc,
      v_qty, si.unit_price, v_line_net, v_unit_cogs, v_line_cogs
    );
  end loop;

  -- Hitung PPN proporsional jika invoice asli mengenakan PPN
  if v_sale.ppn_amount > 0 and v_sale.subtotal > 0 then
    v_ppn := round(v_sale.ppn_amount * v_amount / v_sale.subtotal, 2);
  end if;
  v_total := v_amount + v_ppn;

  -- Jika potong piutang, pastikan total retur tidak melebihi sisa piutang nota
  if v_settle = 'debt' and v_total > v_outstanding then
    raise exception 'Total retur (%) melebihi sisa piutang nota (%); pilih uang kembali', v_total, v_outstanding using errcode = '23514';
  end if;

  update public.sale_returns
     set amount = v_amount, ppn_amount = v_ppn, total = v_total, cogs_total = v_cogs
   where id = v_id;

  -- Susun baris jurnal (PRD §11.3)
  -- Dr Retur Penjualan (sales_return) : v_amount
  -- Dr PPN Keluaran (ppn_out)        : v_ppn (bila ada)
  -- Cr Piutang (ar) ATAU Cr Kas/Bank : v_total
  -- Dr Persediaan Sparepart          : v_cogs
  -- Cr HPP Sparepart (cogs)          : v_cogs
  v_journal := jsonb_build_array(
    jsonb_build_object('account', 'sales_return', 'debit', v_amount),
    case when v_settle = 'debt' then jsonb_build_object('account', 'ar', 'credit', v_total)
         else jsonb_build_object('account_id', v_cash_acc, 'credit', v_total) end
  );

  if v_ppn > 0 then
    v_journal := v_journal || jsonb_build_array(jsonb_build_object('account', 'ppn_out', 'debit', v_ppn));
  end if;

  if v_cogs > 0 then
    v_journal := v_journal || jsonb_build_array(
      jsonb_build_object('account', 'inventory', 'debit', v_cogs),
      jsonb_build_object('account', 'cogs', 'credit', v_cogs)
    );
  end if;

  perform app.post_journal(v_date, 'sale_return', v_id, 'Retur penjualan ' || v_no || ' (' || coalesce(v_sale.sale_no, '') || ')', v_journal);

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS & Hak Akses
-- -----------------------------------------------------------------------------
alter table public.sale_returns enable row level security;
alter table public.sale_return_items enable row level security;

revoke all on public.sale_returns from anon;
revoke all on public.sale_return_items from anon;
revoke insert, update, delete, truncate on public.sale_returns from authenticated;
revoke insert, update, delete, truncate on public.sale_return_items from authenticated;

drop policy if exists sale_returns_select on public.sale_returns;
create policy sale_returns_select on public.sale_returns for select to authenticated
  using (branch_id = app.current_branch_id() and (app.has_permission('sales', 'view') or app.has_permission('receivables', 'view')));

drop policy if exists sale_return_items_select on public.sale_return_items;
create policy sale_return_items_select on public.sale_return_items for select to authenticated
  using (branch_id = app.current_branch_id() and (app.has_permission('sales', 'view') or app.has_permission('receivables', 'view')));

grant select on public.sale_returns, public.sale_return_items, public.v_sale_returns to authenticated;
grant select on public.v_sales, public.v_cash_shifts, public.v_ar_customers to authenticated;

revoke all on function public.post_sale_return(uuid, jsonb, jsonb, text) from public, anon;
grant execute on function public.post_sale_return(uuid, jsonb, jsonb, text) to authenticated;
