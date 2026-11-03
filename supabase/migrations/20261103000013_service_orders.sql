-- =============================================================================
-- Servis: estimasi, work order, papan status, pengeluaran part, garansi (PRD §7, §11.3, §14)
-- Alur: estimasi (versi, persetujuan pelanggan) -> work order -> papan status -> diserahkan.
-- Tidak ada pekerjaan tanpa estimasi yang disetujui: baris WO selalu berasal dari estimasi
-- (awal atau tambahan), kecuali WO klaim garansi (Rp0 ke pelanggan).
-- Stok berkurang saat part dikeluarkan (bukan saat WO dibuat); jurnal:
--   keluar part : Dr Persediaan dalam Pengerjaan (WO garansi: Beban Garansi), Cr Persediaan Sparepart
--   kembali part: kebalikannya
-- Invoice, pembayaran, dan komisi final menyusul di modul Kasir.
-- =============================================================================

-- Part yang tidak terpakai kembali ke stok dengan nilai saat dikeluarkan
alter type public.stock_movement_type add value if not exists 'service_return';

create type public.estimate_status as enum ('draft', 'sent', 'approved', 'rejected', 'revised', 'converted', 'void');
create type public.approval_channel as enum ('in_person', 'phone', 'chat');
create type public.work_order_status as enum (
  'queued',            -- Antri
  'in_progress',       -- Dikerjakan
  'waiting_parts',     -- Menunggu Part
  'waiting_approval',  -- Menunggu Persetujuan Pelanggan (pekerjaan tambahan)
  'quality_check',     -- Selesai / Quality Check
  'ready',             -- Siap Diambil
  'delivered',         -- Diambil (WO terkunci)
  'void'
);
create type public.service_line_type as enum ('service', 'part');

-- -----------------------------------------------------------------------------
-- Estimasi (quotation). Revisi = baris baru dengan nomor sama dan versi + 1;
-- versi lama berstatus 'revised'. Estimasi tambahan (pekerjaan di tengah servis) punya work_order_id.
-- -----------------------------------------------------------------------------
create table public.estimates (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid not null references public.branches(id),
  estimate_no      text not null,
  version          integer not null default 1 check (version >= 1),
  previous_id      uuid references public.estimates(id),
  vehicle_id       uuid not null references public.vehicles(id),
  customer_id      uuid references public.customers(id),
  plate_no         text not null,                     -- snapshot saat estimasi dibuat
  odometer         integer check (odometer >= 0),
  complaint        text,
  valid_until      date not null,
  subtotal         numeric(18,2) not null default 0 check (subtotal >= 0),
  discount_amount  numeric(18,2) not null default 0 check (discount_amount >= 0),
  total            numeric(18,2) not null default 0 check (total >= 0),
  notes            text,
  is_additional    boolean not null default false,
  work_order_id    uuid,                              -- FK ditambah setelah tabel WO dibuat
  status           public.estimate_status not null default 'draft',
  sent_at          timestamptz,
  approval_channel public.approval_channel,
  approval_note    text,
  decided_at       timestamptz,
  decided_by       uuid references public.employees(id),
  void_reason      text,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid(),
  updated_at       timestamptz not null default now(),
  unique (branch_id, estimate_no, version),
  check (discount_amount <= subtotal),
  check (not is_additional or work_order_id is not null)
);
create index idx_estimates_vehicle on public.estimates (vehicle_id, created_at desc);
create index idx_estimates_work_order on public.estimates (work_order_id);

create table public.estimate_items (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid not null references public.branches(id),
  estimate_id      uuid not null references public.estimates(id),
  line_type        public.service_line_type not null,
  service_id       uuid references public.services(id),
  item_id          uuid references public.items(id),
  package_id       uuid references public.packages(id),  -- asal paket (komponen dipecah per baris)
  description      text not null,
  qty              numeric(14,3) not null check (qty > 0),
  unit_price       numeric(18,2) not null check (unit_price >= 0),
  discount_amount  numeric(18,2) not null default 0 check (discount_amount >= 0),
  line_total       numeric(18,2) not null check (line_total >= 0),
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  warranty_days    integer not null default 0 check (warranty_days >= 0),
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid(),
  updated_at       timestamptz not null default now(),
  check ((line_type = 'service') = (service_id is not null)),
  check ((line_type = 'part') = (item_id is not null))
);
create index idx_estimate_items_estimate on public.estimate_items (estimate_id);

-- -----------------------------------------------------------------------------
-- Work order
-- -----------------------------------------------------------------------------
create table public.work_orders (
  id                     uuid primary key default gen_random_uuid(),
  branch_id              uuid not null references public.branches(id),
  wo_no                  text not null,
  estimate_id            uuid references public.estimates(id),  -- null hanya untuk WO garansi
  vehicle_id             uuid not null references public.vehicles(id),
  customer_id            uuid references public.customers(id),
  plate_no               text not null,                         -- snapshot untuk papan status
  vehicle_label          text,
  odometer_in            integer check (odometer_in >= 0),
  complaint              text,
  estimated_done_at      timestamptz,
  discount_amount        numeric(18,2) not null default 0 check (discount_amount >= 0),
  notes                  text,
  is_warranty            boolean not null default false,
  warranty_source_id     uuid references public.work_orders(id),
  status                 public.work_order_status not null default 'queued',
  status_before_approval public.work_order_status,
  status_changed_at      timestamptz not null default now(),
  started_at             timestamptz,
  completed_at           timestamptz,
  delivered_at           timestamptz,
  void_reason            text,
  created_at             timestamptz not null default now(),
  created_by             uuid default auth.uid(),
  updated_at             timestamptz not null default now(),
  unique (branch_id, wo_no),
  check (not is_warranty or warranty_source_id is not null),
  check (is_warranty or estimate_id is not null)
);
create index idx_work_orders_vehicle on public.work_orders (vehicle_id, created_at desc);
create index idx_work_orders_status on public.work_orders (branch_id, status);

alter table public.estimates add constraint estimates_work_order_id_fkey
  foreign key (work_order_id) references public.work_orders(id);

create table public.work_order_items (
  id                  uuid primary key default gen_random_uuid(),
  branch_id           uuid not null references public.branches(id),
  work_order_id       uuid not null references public.work_orders(id),
  estimate_item_id    uuid references public.estimate_items(id),
  warranty_source_item_id uuid references public.work_order_items(id),
  line_type           public.service_line_type not null,
  service_id          uuid references public.services(id),
  item_id             uuid references public.items(id),
  package_id          uuid references public.packages(id),
  description         text not null,
  qty                 numeric(14,3) not null check (qty > 0),
  unit_price          numeric(18,2) not null check (unit_price >= 0),
  discount_amount     numeric(18,2) not null default 0 check (discount_amount >= 0),
  line_total          numeric(18,2) not null check (line_total >= 0),
  duration_minutes    integer not null default 0 check (duration_minutes >= 0),
  warranty_days       integer not null default 0 check (warranty_days >= 0),
  sort_order          integer not null default 0,
  issued_qty          numeric(14,3) not null default 0,   -- part: bersih keluar (keluar - kembali), satuan dasar
  issue_requested_at  timestamptz,                        -- mekanik minta part ke gudang
  issue_requested_by  uuid references public.employees(id),
  is_cancelled        boolean not null default false,
  cancel_reason       text,
  created_at          timestamptz not null default now(),
  created_by          uuid default auth.uid(),
  updated_at          timestamptz not null default now(),
  check ((line_type = 'service') = (service_id is not null)),
  check ((line_type = 'part') = (item_id is not null)),
  check (issued_qty >= 0 and issued_qty <= qty),
  check (line_type = 'part' or issued_qty = 0),
  check (not is_cancelled or issued_qty = 0)
);
create index idx_wo_items_wo on public.work_order_items (work_order_id);

-- Mekanik per jasa; porsi (%) dipakai untuk komisi di modul Kasir/Penggajian
create table public.work_order_mechanics (
  id                 uuid primary key default gen_random_uuid(),
  branch_id          uuid not null references public.branches(id),
  work_order_id      uuid not null references public.work_orders(id),
  work_order_item_id uuid not null references public.work_order_items(id),
  employee_id        uuid not null references public.employees(id),
  share_percent      numeric(5,2) not null check (share_percent > 0 and share_percent <= 100),
  created_at         timestamptz not null default now(),
  created_by         uuid default auth.uid(),
  updated_at         timestamptz not null default now(),
  unique (work_order_item_id, employee_id)
);
create index idx_wo_mechanics_wo on public.work_order_mechanics (work_order_id);
create index idx_wo_mechanics_employee on public.work_order_mechanics (employee_id);

-- Pengeluaran & pengembalian part (append-only). Nilai HPP ada di stock_movements (movement_id).
create table public.part_issues (
  id                 uuid primary key default gen_random_uuid(),
  branch_id          uuid not null references public.branches(id),
  work_order_id      uuid not null references public.work_orders(id),
  work_order_item_id uuid not null references public.work_order_items(id),
  item_id            uuid not null references public.items(id),
  location_id        uuid not null references public.locations(id),
  kind               text not null check (kind in ('issue', 'return')),
  qty                numeric(14,3) not null check (qty > 0),  -- satuan dasar
  movement_id        uuid not null references public.stock_movements(id),
  note               text,
  created_at         timestamptz not null default now(),
  created_by         uuid default auth.uid(),
  updated_at         timestamptz not null default now()
);
create index idx_part_issues_wo on public.part_issues (work_order_id);
create index idx_part_issues_item on public.part_issues (work_order_item_id);

-- Riwayat perpindahan status (untuk lama waktu per status & audit)
create table public.work_order_status_logs (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references public.branches(id),
  work_order_id uuid not null references public.work_orders(id),
  from_status   public.work_order_status,
  to_status     public.work_order_status not null,
  employee_id   uuid references public.employees(id),
  note          text,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  updated_at    timestamptz not null default now()
);
create index idx_wo_status_logs_wo on public.work_order_status_logs (work_order_id, created_at);

-- =============================================================================
-- Trigger standar
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array['estimates', 'estimate_items', 'work_orders', 'work_order_items', 'work_order_mechanics',
    'part_issues', 'work_order_status_logs'] loop
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$I
                    for each row execute function app.set_updated_at()', t);
    execute format('create trigger trg_audit after insert or update or delete on public.%I
                    for each row execute function app.audit_row_change()', t);
  end loop;
  -- Dokumen: tanpa hapus permanen. Baris estimasi draft & pembagian mekanik boleh diganti (tercatat di audit log).
  foreach t in array array['estimates', 'work_orders', 'work_order_items'] loop
    execute format('create trigger trg_no_delete before delete on public.%I
                    for each row execute function app.prevent_modification()', t);
  end loop;
  -- Ledger: tidak bisa diubah maupun dihapus
  foreach t in array array['part_issues', 'work_order_status_logs'] loop
    execute format('create trigger trg_%1$s_immutable before update or delete on public.%1$I
                    for each row execute function app.prevent_modification()', t);
  end loop;
end $$;

-- =============================================================================
-- Ledger stok: tipe 'service_return' masuk dengan nilai yang dibawa (seperti retur penjualan)
-- =============================================================================
create or replace function app.post_stock_movement(
  p_item_id     uuid,
  p_location_id uuid,
  p_type        public.stock_movement_type,
  p_qty         numeric,
  p_unit_cost   numeric default null,
  p_source_type text default null,
  p_source_id   uuid default null,
  p_note        text default null,
  p_group_id    uuid default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch    uuid;
  v_avg       numeric(18,2);
  v_on_hand   numeric(14,3);
  v_cost      numeric(18,2);
  v_balance   numeric(14,3);
  v_allow_neg boolean;
  v_unit      text;
  v_id        uuid;
begin
  select i.branch_id into v_branch from public.items i where i.id = p_item_id;
  if v_branch is null then raise exception 'Barang tidak ditemukan' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.locations where id = p_location_id and branch_id = v_branch) then
    raise exception 'Lokasi tidak ditemukan' using errcode = 'P0002';
  end if;
  if p_qty is null or p_qty = 0 then raise exception 'Jumlah tidak boleh nol' using errcode = '22023'; end if;
  if (p_type::text in ('opening', 'purchase', 'sales_return', 'service_return', 'transfer_in') and p_qty < 0)
     or (p_type::text in ('sale', 'service_usage', 'purchase_return', 'transfer_out') and p_qty > 0) then
    raise exception 'Arah jumlah tidak sesuai tipe mutasi %', p_type using errcode = '22023';
  end if;

  -- Kunci per barang: HPP & saldo konsisten walau ada transaksi bersamaan
  select avg_cost into v_avg from public.item_costs where item_id = p_item_id for update;
  select coalesce(sum(qty), 0) into v_on_hand from public.stock_balances where item_id = p_item_id;

  if p_type::text in ('opening', 'purchase', 'sales_return', 'service_return') then
    if p_unit_cost is null or p_unit_cost < 0 then
      raise exception 'Harga pokok per satuan wajib diisi untuk mutasi masuk' using errcode = '22023';
    end if;
    v_cost := round(p_unit_cost, 2);
    -- Rata-rata tertimbang; jika stok sebelumnya <= 0, HPP mengikuti harga masuk terbaru
    v_avg := case when v_on_hand <= 0 then v_cost
                  else round((v_on_hand * v_avg + p_qty * v_cost) / (v_on_hand + p_qty), 2) end;
    update public.item_costs set avg_cost = v_avg where item_id = p_item_id;
  else
    v_cost := v_avg;
  end if;

  insert into public.stock_movements (branch_id, item_id, location_id, movement_type, qty, unit_cost,
                                      source_type, source_id, transfer_group_id, note)
  values (v_branch, p_item_id, p_location_id, p_type, p_qty, v_cost, p_source_type, p_source_id, p_group_id,
          nullif(btrim(p_note), ''))
  returning id into v_id;

  insert into public.stock_balances as b (branch_id, item_id, location_id, qty)
  values (v_branch, p_item_id, p_location_id, p_qty)
  on conflict (item_id, location_id) do update set qty = b.qty + excluded.qty
  returning b.qty into v_balance;

  -- Stok tidak boleh minus, kecuali Owner mengizinkan "jual dulu, terima menyusul" (PRD §4.7)
  if v_balance < 0 then
    select coalesce((value)::text::boolean, false) into v_allow_neg
    from public.settings where branch_id = v_branch and key = 'allow_negative_stock';
    if not coalesce(v_allow_neg, false) or p_type = 'transfer_out' then
      select u.code into v_unit from public.items i join public.units u on u.id = i.base_unit_id where i.id = p_item_id;
      raise exception 'Stok tidak cukup di lokasi ini: tersedia % %', trim_scale(v_balance - p_qty), v_unit
        using errcode = '23514';
    end if;
  end if;

  return v_id;
end;
$$;

-- =============================================================================
-- Helper akses
-- =============================================================================
create or replace function app.is_wo_mechanic(p_work_order_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.work_order_mechanics
                 where work_order_id = p_work_order_id and employee_id = app.current_employee_id())
$$;

-- Lihat WO: izin penuh estimasi/WO atau papan; mekanik (lingkup sendiri) hanya WO yang ia kerjakan
create or replace function app.can_view_work_order(p_work_order_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select app.has_permission('service_orders', 'view') or app.has_permission('service_board', 'view')
      or ((app.has_permission('service_orders', 'view', 'own') or app.has_permission('service_board', 'view', 'own'))
          and app.is_wo_mechanic(p_work_order_id))
$$;

-- Nama karyawan untuk tampilan (papan, riwayat) tanpa membuka data karyawan lain
create or replace function app.employee_name(p_employee_id uuid)
returns text
language sql stable security definer
set search_path = ''
as $$
  select full_name from public.employees where id = p_employee_id and branch_id = app.current_branch_id()
$$;

grant execute on function app.is_wo_mechanic(uuid), app.can_view_work_order(uuid), app.employee_name(uuid)
  to authenticated, service_role;

-- =============================================================================
-- View (security_invoker: tunduk RLS pemanggil)
-- =============================================================================
create view public.v_work_orders with (security_invoker = true) as
  select wo.id, wo.branch_id, wo.wo_no, wo.estimate_id, wo.vehicle_id, wo.customer_id, c.name as customer_name,
         c.phone as customer_phone, wo.plate_no, wo.vehicle_label, wo.odometer_in, wo.complaint, wo.estimated_done_at,
         wo.discount_amount, wo.notes, wo.is_warranty, wo.warranty_source_id, wo.status, wo.status_changed_at,
         wo.started_at, wo.completed_at, wo.delivered_at, wo.void_reason, wo.created_at,
         coalesce(l.subtotal, 0)::numeric(18,2) as subtotal,
         greatest(coalesce(l.subtotal, 0) - wo.discount_amount, 0)::numeric(18,2) as total,
         coalesce(l.duration_minutes, 0)::integer as duration_minutes,
         coalesce(l.services, '') as services,
         coalesce(l.parts, '') as parts,
         coalesce(l.parts_pending, 0)::integer as parts_pending,
         coalesce(l.parts_requested, 0)::integer as parts_requested,
         l.warranty_until,
         coalesce(m.mechanics, '') as mechanics,
         coalesce(m.mechanic_ids, '{}') as mechanic_ids,
         (extract(epoch from now() - wo.status_changed_at) / 60)::integer as minutes_in_status,
         (wo.status in ('queued', 'in_progress', 'waiting_parts', 'waiting_approval', 'quality_check')
          and ((wo.estimated_done_at is not null and now() > wo.estimated_done_at)
               or (wo.estimated_done_at is null and wo.started_at is not null and coalesce(l.duration_minutes, 0) > 0
                   and now() > wo.started_at + make_interval(mins => l.duration_minutes::int)))) as is_overdue,
         (select e.id from public.estimates e
          where e.work_order_id = wo.id and e.is_additional and e.status in ('draft', 'sent')
          order by e.created_at desc limit 1) as pending_estimate_id
  from public.work_orders wo
  left join public.customers c on c.id = wo.customer_id
  left join lateral (
    select sum(i.line_total) as subtotal,
           sum(i.duration_minutes) filter (where i.line_type = 'service') as duration_minutes,
           string_agg(i.description, ', ' order by i.sort_order) filter (where i.line_type = 'service') as services,
           string_agg(i.description || ' x' || trim_scale(i.qty), ', ' order by i.sort_order) filter (where i.line_type = 'part') as parts,
           count(*) filter (where i.line_type = 'part' and i.issued_qty < i.qty) as parts_pending,
           count(*) filter (where i.line_type = 'part' and i.issued_qty < i.qty and i.issue_requested_at is not null) as parts_requested,
           case when wo.delivered_at is not null and max(i.warranty_days) > 0
                then (wo.delivered_at at time zone 'Asia/Jakarta')::date + max(i.warranty_days) end as warranty_until
    from public.work_order_items i
    where i.work_order_id = wo.id and not i.is_cancelled
  ) l on true
  left join lateral (
    select string_agg(distinct app.employee_name(x.employee_id), ', ') as mechanics,
           array_agg(distinct x.employee_id) as mechanic_ids
    from public.work_order_mechanics x
    join public.work_order_items i on i.id = x.work_order_item_id and not i.is_cancelled
    where x.work_order_id = wo.id
  ) m on true;

create view public.v_estimates with (security_invoker = true) as
  select e.*, c.name as customer_name, c.phone as customer_phone,
         not exists (select 1 from public.estimates n where n.previous_id = e.id) as is_latest,
         (select count(*) from public.estimate_items i where i.estimate_id = e.id) as line_count,
         w.wo_no
  from public.estimates e
  left join public.customers c on c.id = e.customer_id
  left join public.work_orders w on w.id = e.work_order_id;

-- =============================================================================
-- Helper isi baris
-- p_items: [{type: service|part|package, service_id?, item_id?, package_id?, qty?, discount_amount?}]
-- Harga dari master (jasa: price, barang: sell_price). Paket dipecah lewat package_components():
-- tiap komponen jadi baris dengan nilai alokasi (PRD §17.3).
-- =============================================================================
create or replace function app.fill_estimate(p_estimate_id uuid, p_items jsonb, p_discount numeric)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch   uuid := app.current_branch_id();
  v_n        integer := 0;
  v_qty      numeric;
  v_disc     numeric;
  v_sub      numeric(18,2);
  v_svc      public.services%rowtype;
  v_item     public.items%rowtype;
  v_pkg_name text;
  c          record;
  x          jsonb;
begin
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then
    raise exception 'Estimasi minimal berisi satu jasa atau part' using errcode = '22023';
  end if;

  for x in select * from jsonb_array_elements(p_items) loop
    v_qty  := coalesce(nullif(x ->> 'qty', '')::numeric, 1);
    v_disc := round(coalesce(nullif(x ->> 'discount_amount', '')::numeric, 0), 2);
    if v_qty <= 0 then raise exception 'Jumlah harus lebih dari nol' using errcode = '22023'; end if;
    if v_disc < 0 then raise exception 'Diskon tidak boleh minus' using errcode = '22023'; end if;

    if x ->> 'type' = 'service' then
      select * into v_svc from public.services where id = (x ->> 'service_id')::uuid and branch_id = v_branch and is_active;
      if not found then raise exception 'Jasa tidak ditemukan atau nonaktif' using errcode = '22023'; end if;
      if v_disc > round(v_qty * v_svc.price, 2) then raise exception 'Diskon melebihi nilai baris' using errcode = '22023'; end if;
      v_n := v_n + 1;
      insert into public.estimate_items (branch_id, estimate_id, line_type, service_id, description, qty, unit_price,
                                         discount_amount, line_total, duration_minutes, warranty_days, sort_order)
      values (v_branch, p_estimate_id, 'service', v_svc.id, v_svc.name, v_qty, v_svc.price, v_disc,
              round(v_qty * v_svc.price, 2) - v_disc, round(v_svc.duration_minutes * v_qty)::int, v_svc.warranty_days, v_n);

    elsif x ->> 'type' = 'part' then
      select * into v_item from public.items where id = (x ->> 'item_id')::uuid and branch_id = v_branch and is_active;
      if not found then raise exception 'Barang tidak ditemukan atau nonaktif' using errcode = '22023'; end if;
      if v_disc > round(v_qty * v_item.sell_price, 2) then raise exception 'Diskon melebihi nilai baris' using errcode = '22023'; end if;
      v_n := v_n + 1;
      insert into public.estimate_items (branch_id, estimate_id, line_type, item_id, description, qty, unit_price,
                                         discount_amount, line_total, warranty_days, sort_order)
      values (v_branch, p_estimate_id, 'part', v_item.id, v_item.name, v_qty, v_item.sell_price, v_disc,
              round(v_qty * v_item.sell_price, 2) - v_disc, v_item.warranty_days, v_n);

    elsif x ->> 'type' = 'package' then
      select name into v_pkg_name from public.packages where id = (x ->> 'package_id')::uuid and branch_id = v_branch and is_active;
      if v_pkg_name is null then raise exception 'Paket tidak ditemukan atau nonaktif' using errcode = '22023'; end if;
      if v_disc > 0 then raise exception 'Paket sudah berharga khusus; diskon per baris tidak berlaku' using errcode = '22023'; end if;
      for c in select pc.*, s.duration_minutes as svc_minutes, coalesce(s.warranty_days, i.warranty_days, 0) as w_days
               from public.package_components((x ->> 'package_id')::uuid) pc
               left join public.services s on s.id = pc.service_id
               left join public.items i on i.id = pc.item_id loop
        v_n := v_n + 1;
        insert into public.estimate_items (branch_id, estimate_id, line_type, service_id, item_id, package_id, description,
                                           qty, unit_price, line_total, duration_minutes, warranty_days, sort_order)
        values (v_branch, p_estimate_id, case when c.service_id is not null then 'service' else 'part' end::public.service_line_type,
                c.service_id, c.item_id, (x ->> 'package_id')::uuid, c.name || ' (' || v_pkg_name || ')',
                c.qty * v_qty, round(c.allocated_price / c.qty, 2), round(c.allocated_price * v_qty, 2),
                round(coalesce(c.svc_minutes, 0) * c.qty * v_qty)::int, c.w_days, v_n);
      end loop;
    else
      raise exception 'Jenis baris tidak dikenal' using errcode = '22023';
    end if;
  end loop;

  select coalesce(sum(line_total), 0) into v_sub from public.estimate_items where estimate_id = p_estimate_id;
  if round(coalesce(p_discount, 0), 2) < 0 or round(coalesce(p_discount, 0), 2) > v_sub then
    raise exception 'Diskon estimasi tidak boleh minus atau melebihi subtotal' using errcode = '22023';
  end if;
  update public.estimates
     set subtotal = v_sub, discount_amount = round(coalesce(p_discount, 0), 2), total = v_sub - round(coalesce(p_discount, 0), 2)
   where id = p_estimate_id;
end;
$$;

-- Catat perubahan status WO + log
create or replace function app.set_wo_status(p_work_order_id uuid, p_to public.work_order_status, p_note text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_from public.work_order_status;
begin
  select status into v_from from public.work_orders where id = p_work_order_id;
  update public.work_orders
     set status = p_to, status_changed_at = now(),
         started_at = case when p_to = 'in_progress' then coalesce(started_at, now()) else started_at end,
         completed_at = case when p_to = 'ready' then now() when p_to in ('in_progress', 'quality_check') then null else completed_at end,
         delivered_at = case when p_to = 'delivered' then now() else delivered_at end
   where id = p_work_order_id;
  insert into public.work_order_status_logs (branch_id, work_order_id, from_status, to_status, employee_id, note)
  select branch_id, id, v_from, p_to, app.current_employee_id(), nullif(btrim(p_note), '')
  from public.work_orders where id = p_work_order_id;
end;
$$;

-- Status kembali setelah keputusan estimasi tambahan. Jika sudah QC/siap, kerjakan lagi.
create or replace function app.restore_wo_after_approval(p_work_order_id uuid, p_note text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_wo public.work_orders%rowtype;
begin
  select * into v_wo from public.work_orders where id = p_work_order_id for update;
  if v_wo.status <> 'waiting_approval' then return; end if;
  perform app.set_wo_status(p_work_order_id,
    case when v_wo.status_before_approval in ('quality_check', 'ready') then 'in_progress'
         else coalesce(v_wo.status_before_approval, 'queued') end, p_note);
  update public.work_orders set status_before_approval = null where id = p_work_order_id;
end;
$$;

-- Salin baris estimasi ke WO
create or replace function app.copy_estimate_lines(p_estimate_id uuid, p_work_order_id uuid)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.work_order_items (branch_id, work_order_id, estimate_item_id, line_type, service_id, item_id, package_id,
                                       description, qty, unit_price, discount_amount, line_total, duration_minutes,
                                       warranty_days, sort_order)
  select ei.branch_id, p_work_order_id, ei.id, ei.line_type, ei.service_id, ei.item_id, ei.package_id, ei.description,
         ei.qty, ei.unit_price, ei.discount_amount, ei.line_total, ei.duration_minutes, ei.warranty_days,
         coalesce((select max(sort_order) from public.work_order_items where work_order_id = p_work_order_id), 0) + ei.sort_order
  from public.estimate_items ei
  where ei.estimate_id = p_estimate_id
  order by ei.sort_order
$$;

-- =============================================================================
-- Estimasi
-- p_data: vehicle_id, odometer?, complaint?, valid_until?, discount_amount?, notes?
-- Ubah estimasi draft = di tempat. Ubah estimasi terkirim/ditolak/disetujui = versi baru (versi lama 'revised').
-- =============================================================================
create or replace function public.save_estimate(p_id uuid, p_data jsonb, p_items jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch  uuid := app.current_branch_id();
  v_vehicle public.v_vehicles%rowtype;
  v_old     public.estimates%rowtype;
  v_id      uuid;
  v_valid   date := coalesce(nullif(p_data ->> 'valid_until', '')::date, app.today_wib() + 7);
  v_odo     integer := nullif(p_data ->> 'odometer', '')::int;
begin
  perform app.assert_permission('service_orders', case when p_id is null then 'create' else 'update' end::public.permission_action);
  if v_odo < 0 then raise exception 'Kilometer tidak boleh minus' using errcode = '22023'; end if;

  if p_id is null then
    select * into v_vehicle from public.v_vehicles where id = (p_data ->> 'vehicle_id')::uuid and branch_id = v_branch and is_active;
    if not found then raise exception 'Kendaraan tidak ditemukan atau nonaktif' using errcode = '22023'; end if;
    if v_valid < app.today_wib() then raise exception 'Masa berlaku tidak boleh sebelum hari ini' using errcode = '22023'; end if;
    insert into public.estimates (branch_id, estimate_no, vehicle_id, customer_id, plate_no, odometer, complaint, valid_until, notes)
    values (v_branch, app.next_document_number('EST', app.today_wib(), v_branch), v_vehicle.id, v_vehicle.customer_id,
            v_vehicle.plate_no, v_odo, nullif(btrim(p_data ->> 'complaint'), ''), v_valid, nullif(btrim(p_data ->> 'notes'), ''))
    returning id into v_id;
  else
    select * into v_old from public.estimates where id = p_id and branch_id = v_branch for update;
    if not found then raise exception 'Estimasi tidak ditemukan' using errcode = 'P0002'; end if;
    if v_old.status = 'draft' then
      update public.estimates
         set odometer = coalesce(v_odo, odometer), complaint = nullif(btrim(p_data ->> 'complaint'), ''), valid_until = v_valid,
             notes = nullif(btrim(p_data ->> 'notes'), '')
       where id = p_id returning id into v_id;
      delete from public.estimate_items where estimate_id = p_id;
    elsif v_old.status in ('sent', 'rejected', 'approved') and not v_old.is_additional then
      -- Revisi: simpan versi sebelumnya apa adanya
      update public.estimates set status = 'revised' where id = p_id;
      insert into public.estimates (branch_id, estimate_no, version, previous_id, vehicle_id, customer_id, plate_no, odometer,
                                    complaint, valid_until, notes)
      values (v_branch, v_old.estimate_no, v_old.version + 1, v_old.id, v_old.vehicle_id, v_old.customer_id, v_old.plate_no,
              coalesce(v_odo, v_old.odometer), nullif(btrim(p_data ->> 'complaint'), ''), greatest(v_valid, app.today_wib()),
              nullif(btrim(p_data ->> 'notes'), ''))
      returning id into v_id;
    else
      raise exception 'Estimasi berstatus % tidak bisa diubah', v_old.status using errcode = '22023';
    end if;
  end if;

  perform app.fill_estimate(v_id, p_items, nullif(p_data ->> 'discount_amount', '')::numeric);
  return v_id;
end;
$$;

create or replace function public.mark_estimate_sent(p_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform app.assert_permission('service_orders', 'update');
  update public.estimates set status = 'sent', sent_at = now()
   where id = p_id and branch_id = app.current_branch_id() and status in ('draft', 'sent');
  if not found then raise exception 'Hanya estimasi draft yang bisa ditandai terkirim' using errcode = '22023'; end if;
end;
$$;

-- Inti persetujuan (dipakai approve & tambah pekerjaan yang langsung disetujui)
create or replace function app.approve_estimate(p_id uuid, p_channel public.approval_channel, p_note text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_est public.estimates%rowtype;
begin
  select * into v_est from public.estimates where id = p_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Estimasi tidak ditemukan' using errcode = 'P0002'; end if;
  if v_est.status not in ('draft', 'sent') then
    raise exception 'Estimasi berstatus % tidak bisa disetujui', v_est.status using errcode = '22023';
  end if;
  if p_channel is null then raise exception 'Pilih cara persetujuan pelanggan' using errcode = '22023'; end if;
  if not v_est.is_additional and v_est.valid_until < app.today_wib() then
    raise exception 'Estimasi sudah lewat masa berlaku; buat revisi dulu' using errcode = '22023';
  end if;

  update public.estimates
     set status = 'approved', approval_channel = p_channel, approval_note = nullif(btrim(p_note), ''),
         decided_at = now(), decided_by = app.current_employee_id()
   where id = p_id;

  -- Pekerjaan tambahan: langsung masuk WO, status WO kembali berjalan
  if v_est.is_additional then
    perform 1 from public.work_orders where id = v_est.work_order_id and status not in ('delivered', 'void') for update;
    if not found then raise exception 'Work order sudah ditutup atau dibatalkan' using errcode = '22023'; end if;
    perform app.copy_estimate_lines(p_id, v_est.work_order_id);
    update public.work_orders set discount_amount = discount_amount + v_est.discount_amount where id = v_est.work_order_id;
    update public.estimates set status = 'converted' where id = p_id;
    perform app.restore_wo_after_approval(v_est.work_order_id, 'Tambahan ' || v_est.estimate_no || ' disetujui');
  end if;
end;
$$;

-- Ubah estimasi yang disetujui jadi WO. p_data: estimated_done_at?, notes?
create or replace function app.convert_estimate(p_id uuid, p_data jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_est   public.estimates%rowtype;
  v_label text;
  v_id    uuid;
begin
  select * into v_est from public.estimates where id = p_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Estimasi tidak ditemukan' using errcode = 'P0002'; end if;
  if v_est.is_additional then raise exception 'Estimasi tambahan sudah otomatis masuk WO' using errcode = '22023'; end if;
  if v_est.status <> 'approved' then
    raise exception 'Hanya estimasi yang disetujui pelanggan yang bisa dijadikan work order' using errcode = '22023';
  end if;

  select nullif(concat_ws(' ', make_name, model_name, variant, year::text), '') into v_label
  from public.v_vehicles where id = v_est.vehicle_id;

  insert into public.work_orders (branch_id, wo_no, estimate_id, vehicle_id, customer_id, plate_no, vehicle_label, odometer_in,
                                  complaint, estimated_done_at, discount_amount, notes)
  values (v_est.branch_id, app.next_document_number('WO', app.today_wib(), v_est.branch_id), v_est.id, v_est.vehicle_id,
          v_est.customer_id, v_est.plate_no, v_label, v_est.odometer, v_est.complaint,
          nullif(coalesce(p_data, '{}') ->> 'estimated_done_at', '')::timestamptz, v_est.discount_amount,
          coalesce(nullif(btrim(coalesce(p_data, '{}') ->> 'notes'), ''), v_est.notes))
  returning id into v_id;
  perform app.copy_estimate_lines(p_id, v_id);
  insert into public.work_order_status_logs (branch_id, work_order_id, to_status, employee_id, note)
  values (v_est.branch_id, v_id, 'queued', app.current_employee_id(), 'Dari estimasi ' || v_est.estimate_no);
  update public.estimates set status = 'converted', work_order_id = v_id where id = p_id;

  -- Kilometer kendaraan diperbarui otomatis setiap work order (tidak pernah mundur)
  if v_est.odometer is not null then
    update public.vehicles set last_odometer = greatest(coalesce(last_odometer, 0), v_est.odometer) where id = v_est.vehicle_id;
  end if;
  return v_id;
end;
$$;

-- Catat persetujuan pelanggan. p_wo_data bukan null = langsung buat WO (satu klik); hasil: id WO atau null.
create or replace function public.approve_estimate(p_id uuid, p_channel public.approval_channel, p_note text default null,
                                                   p_wo_data jsonb default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
begin
  perform app.assert_permission('service_orders', 'update');
  perform app.approve_estimate(p_id, p_channel, p_note);
  if p_wo_data is not null and not (select is_additional from public.estimates where id = p_id) then
    perform app.assert_permission('service_orders', 'create');
    return app.convert_estimate(p_id, p_wo_data);
  end if;
  return null;
end;
$$;

create or replace function public.convert_estimate_to_work_order(p_id uuid, p_data jsonb default '{}')
returns uuid
language plpgsql security definer
set search_path = ''
as $$
begin
  perform app.assert_permission('service_orders', 'create');
  return app.convert_estimate(p_id, p_data);
end;
$$;

create or replace function public.reject_estimate(p_id uuid, p_note text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_est public.estimates%rowtype;
begin
  perform app.assert_permission('service_orders', 'update');
  select * into v_est from public.estimates where id = p_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Estimasi tidak ditemukan' using errcode = 'P0002'; end if;
  if v_est.status not in ('draft', 'sent') then
    raise exception 'Estimasi berstatus % tidak bisa ditolak', v_est.status using errcode = '22023';
  end if;
  update public.estimates
     set status = 'rejected', approval_note = nullif(btrim(p_note), ''), decided_at = now(), decided_by = app.current_employee_id()
   where id = p_id;
  if v_est.is_additional then
    perform app.restore_wo_after_approval(v_est.work_order_id, 'Tambahan ' || v_est.estimate_no || ' ditolak pelanggan');
  end if;
end;
$$;

create or replace function public.void_estimate(p_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_est public.estimates%rowtype;
begin
  perform app.assert_permission('service_orders', 'void');
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Alasan pembatalan wajib diisi' using errcode = '22023'; end if;
  select * into v_est from public.estimates where id = p_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Estimasi tidak ditemukan' using errcode = 'P0002'; end if;
  if v_est.status in ('revised', 'converted', 'void') then
    raise exception 'Estimasi berstatus % tidak bisa dibatalkan', v_est.status using errcode = '22023';
  end if;
  update public.estimates set status = 'void', void_reason = btrim(p_reason) where id = p_id;
  if v_est.is_additional then
    perform app.restore_wo_after_approval(v_est.work_order_id, 'Tambahan ' || v_est.estimate_no || ' dibatalkan');
  end if;
end;
$$;

-- =============================================================================
-- Work order
-- =============================================================================

-- Kunci WO yang masih bisa diubah (belum diserahkan / batal)
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
  return v_wo;
end;
$$;

-- p_data: estimated_done_at?, notes?, odometer_in?
create or replace function public.update_work_order(p_id uuid, p_data jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_wo  public.work_orders%rowtype;
  v_odo integer := nullif(p_data ->> 'odometer_in', '')::int;
begin
  perform app.assert_permission('service_orders', 'update');
  v_wo := app.lock_open_wo(p_id);
  if v_odo < 0 then raise exception 'Kilometer tidak boleh minus' using errcode = '22023'; end if;
  update public.work_orders
     set estimated_done_at = nullif(p_data ->> 'estimated_done_at', '')::timestamptz,
         notes = nullif(btrim(p_data ->> 'notes'), ''),
         odometer_in = coalesce(v_odo, odometer_in)
   where id = p_id;
  if v_odo is not null then
    update public.vehicles set last_odometer = greatest(coalesce(last_odometer, 0), v_odo) where id = v_wo.vehicle_id;
  end if;
end;
$$;

-- Pekerjaan tambahan di tengah servis: tercatat sebagai estimasi tambahan.
-- p_approval {channel, note} diisi jika pelanggan sudah setuju (langsung masuk WO);
-- jika kosong, WO menunggu persetujuan pelanggan.
create or replace function public.add_work_order_work(p_id uuid, p_items jsonb, p_data jsonb default '{}', p_approval jsonb default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_wo  public.work_orders%rowtype;
  v_est uuid;
begin
  perform app.assert_permission('service_orders', 'update');
  v_wo := app.lock_open_wo(p_id);
  if v_wo.status = 'waiting_approval' then
    raise exception 'Masih ada pekerjaan tambahan yang menunggu persetujuan pelanggan' using errcode = '22023';
  end if;
  if v_wo.is_warranty then raise exception 'WO garansi tidak bisa ditambah pekerjaan berbayar; buat estimasi baru' using errcode = '22023'; end if;

  insert into public.estimates (branch_id, estimate_no, vehicle_id, customer_id, plate_no, odometer, complaint, valid_until, notes,
                                is_additional, work_order_id)
  values (v_wo.branch_id, app.next_document_number('EST', app.today_wib(), v_wo.branch_id), v_wo.vehicle_id, v_wo.customer_id,
          v_wo.plate_no, v_wo.odometer_in, nullif(btrim(coalesce(p_data, '{}') ->> 'complaint'), ''), app.today_wib() + 1,
          nullif(btrim(coalesce(p_data, '{}') ->> 'notes'), ''), true, v_wo.id)
  returning id into v_est;
  perform app.fill_estimate(v_est, p_items, nullif(coalesce(p_data, '{}') ->> 'discount_amount', '')::numeric);

  update public.work_orders set status_before_approval = v_wo.status where id = p_id;
  perform app.set_wo_status(p_id, 'waiting_approval', 'Pekerjaan tambahan menunggu persetujuan');

  if p_approval is not null and nullif(p_approval ->> 'channel', '') is not null then
    perform app.approve_estimate(v_est, (p_approval ->> 'channel')::public.approval_channel, p_approval ->> 'note');
  end if;
  return v_est;
end;
$$;

-- Batalkan baris (mis. pekerjaan tidak jadi); part yang sudah keluar harus dikembalikan dulu
create or replace function public.cancel_work_order_item(p_item_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_line public.work_order_items%rowtype;
  v_wo   public.work_orders%rowtype;
begin
  perform app.assert_permission('service_orders', 'update');
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Alasan pembatalan wajib diisi' using errcode = '22023'; end if;
  select * into v_line from public.work_order_items where id = p_item_id and branch_id = app.current_branch_id();
  if not found then raise exception 'Baris work order tidak ditemukan' using errcode = 'P0002'; end if;
  v_wo := app.lock_open_wo(v_line.work_order_id);
  if v_line.is_cancelled then raise exception 'Baris sudah dibatalkan' using errcode = '22023'; end if;
  if v_line.issued_qty > 0 then raise exception 'Kembalikan dulu part yang sudah dikeluarkan' using errcode = '22023'; end if;
  update public.work_order_items set is_cancelled = true, cancel_reason = btrim(p_reason) where id = p_item_id;
end;
$$;

-- Mekanik per jasa. p_assignments: [{employee_id, share_percent?}]; tanpa persen = dibagi rata.
create or replace function public.set_work_order_mechanics(p_item_id uuid, p_assignments jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_line  public.work_order_items%rowtype;
  v_wo    public.work_orders%rowtype;
  v_n     integer := jsonb_array_length(coalesce(p_assignments, '[]'));
  v_given boolean;
  v_sum   numeric;
  v_i     integer := 0;
  v_share numeric(5,2);
  x       jsonb;
begin
  perform app.assert_permission('service_orders', 'update');
  select * into v_line from public.work_order_items where id = p_item_id and branch_id = app.current_branch_id();
  if not found then raise exception 'Baris work order tidak ditemukan' using errcode = 'P0002'; end if;
  if v_line.line_type <> 'service' or v_line.is_cancelled then
    raise exception 'Mekanik hanya untuk baris jasa yang aktif' using errcode = '22023';
  end if;
  v_wo := app.lock_open_wo(v_line.work_order_id);

  select bool_and(nullif(a ->> 'share_percent', '') is not null), sum(nullif(a ->> 'share_percent', '')::numeric)
    into v_given, v_sum from jsonb_array_elements(coalesce(p_assignments, '[]')) a;
  if v_n > 0 and v_given and v_sum <> 100 then
    raise exception 'Total porsi mekanik harus 100%%' using errcode = '22023';
  end if;
  if (select count(distinct a ->> 'employee_id') from jsonb_array_elements(coalesce(p_assignments, '[]')) a) <> v_n then
    raise exception 'Mekanik tidak boleh dobel' using errcode = '22023';
  end if;

  delete from public.work_order_mechanics where work_order_item_id = p_item_id;
  for x in select * from jsonb_array_elements(coalesce(p_assignments, '[]')) loop
    v_i := v_i + 1;
    if not exists (select 1 from public.employees where id = (x ->> 'employee_id')::uuid
                   and branch_id = app.current_branch_id() and status = 'active') then
      raise exception 'Mekanik tidak ditemukan atau tidak aktif' using errcode = '22023';
    end if;
    -- Bagi rata: sisa pembulatan ke mekanik pertama
    v_share := case when v_given then (x ->> 'share_percent')::numeric
                    when v_i = 1 then 100 - round(100.0 / v_n, 2) * (v_n - 1)
                    else round(100.0 / v_n, 2) end;
    insert into public.work_order_mechanics (branch_id, work_order_id, work_order_item_id, employee_id, share_percent)
    values (v_line.branch_id, v_line.work_order_id, p_item_id, (x ->> 'employee_id')::uuid, v_share);
  end loop;
end;
$$;

-- Ubah status di papan. Mekanik (lingkup sendiri) hanya WO yang ia kerjakan dan tidak bisa menyerahkan kendaraan.
create or replace function public.set_work_order_status(p_id uuid, p_status public.work_order_status, p_note text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_wo      public.work_orders%rowtype;
  v_allowed boolean;
begin
  if app.current_employee_id() is null then
    raise exception 'Sesi tidak valid: login sebagai karyawan aktif' using errcode = '42501';
  end if;
  v_wo := app.lock_open_wo(p_id);
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

  if p_status in ('quality_check', 'ready', 'delivered') then
    if not exists (select 1 from public.work_order_items where work_order_id = p_id and not is_cancelled) then
      raise exception 'Work order belum berisi pekerjaan' using errcode = '22023';
    end if;
    if exists (select 1 from public.work_order_items where work_order_id = p_id and not is_cancelled
               and line_type = 'part' and issued_qty < qty) then
      raise exception 'Masih ada part yang belum dikeluarkan gudang (atau batalkan barisnya)' using errcode = '22023';
    end if;
  end if;

  perform app.set_wo_status(p_id, p_status, p_note);
end;
$$;

create or replace function public.void_work_order(p_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_wo public.work_orders%rowtype;
begin
  perform app.assert_permission('service_orders', 'void');
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Alasan pembatalan wajib diisi' using errcode = '22023'; end if;
  v_wo := app.lock_open_wo(p_id);
  if exists (select 1 from public.work_order_items where work_order_id = p_id and issued_qty > 0) then
    raise exception 'Kembalikan dulu semua part yang sudah dikeluarkan' using errcode = '22023';
  end if;
  update public.estimates set status = 'void', void_reason = 'WO dibatalkan: ' || btrim(p_reason)
   where work_order_id = p_id and is_additional and status in ('draft', 'sent');
  update public.work_orders set void_reason = btrim(p_reason), status_before_approval = null where id = p_id;
  perform app.set_wo_status(p_id, 'void', btrim(p_reason));
end;
$$;

-- =============================================================================
-- Pengeluaran part (gudang). Mekanik meminta lewat request_work_order_part.
-- =============================================================================
create or replace function public.request_work_order_part(p_item_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_line public.work_order_items%rowtype;
begin
  perform app.assert_any_permission(array['part_issue:create', 'part_issue:update']);
  select * into v_line from public.work_order_items where id = p_item_id and branch_id = app.current_branch_id();
  if not found or not app.can_view_work_order(v_line.work_order_id) then
    raise exception 'Baris work order tidak ditemukan' using errcode = 'P0002';
  end if;
  perform app.lock_open_wo(v_line.work_order_id);
  if v_line.line_type <> 'part' or v_line.is_cancelled or v_line.issued_qty >= v_line.qty then
    raise exception 'Tidak ada part yang perlu diminta di baris ini' using errcode = '22023';
  end if;
  update public.work_order_items set issue_requested_at = now(), issue_requested_by = app.current_employee_id() where id = p_item_id;
end;
$$;

create or replace function public.issue_work_order_part(p_item_id uuid, p_qty numeric, p_location_id uuid, p_note text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_line public.work_order_items%rowtype;
  v_wo   public.work_orders%rowtype;
  v_mov  uuid;
  v_val  numeric(18,2);
  v_id   uuid;
begin
  perform app.assert_permission('part_issue', 'update');
  select * into v_line from public.work_order_items where id = p_item_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Baris work order tidak ditemukan' using errcode = 'P0002'; end if;
  v_wo := app.lock_open_wo(v_line.work_order_id);
  if v_wo.status not in ('queued', 'in_progress', 'waiting_parts', 'waiting_approval') then
    raise exception 'Part tidak bisa dikeluarkan untuk WO berstatus %', v_wo.status using errcode = '22023';
  end if;
  if v_line.line_type <> 'part' or v_line.is_cancelled then raise exception 'Baris ini bukan part aktif' using errcode = '22023'; end if;
  if coalesce(p_qty, 0) <= 0 then raise exception 'Jumlah harus lebih dari nol' using errcode = '22023'; end if;
  if v_line.issued_qty + p_qty > v_line.qty then
    raise exception 'Jumlah keluar melebihi kebutuhan WO (sisa %)', trim_scale(v_line.qty - v_line.issued_qty) using errcode = '23514';
  end if;
  perform app.assert_ref('locations', p_location_id, 'Lokasi rak');

  v_id := gen_random_uuid();
  v_mov := app.post_stock_movement(v_line.item_id, p_location_id, 'service_usage', -p_qty, null, 'part_issue', v_id,
                                   v_wo.wo_no || coalesce(' · ' || nullif(btrim(p_note), ''), ''));
  insert into public.part_issues (id, branch_id, work_order_id, work_order_item_id, item_id, location_id, kind, qty, movement_id, note)
  values (v_id, v_line.branch_id, v_wo.id, v_line.id, v_line.item_id, p_location_id, 'issue', p_qty, v_mov, nullif(btrim(p_note), ''));
  update public.work_order_items set issued_qty = issued_qty + p_qty where id = v_line.id;

  select round(p_qty * unit_cost, 2) into v_val from public.stock_movements where id = v_mov;
  if v_val > 0 then
    perform app.post_journal(app.today_wib(), 'part_issue', v_id,
      'Part keluar ' || v_wo.wo_no || ': ' || v_line.description,
      jsonb_build_array(jsonb_build_object('account', case when v_wo.is_warranty then 'warranty_expense' else 'wip' end, 'debit', v_val),
                        jsonb_build_object('account', 'inventory', 'credit', v_val)));
  end if;
  return v_id;
end;
$$;

-- Part tidak terpakai kembali ke stok (nilai rata-rata saat dikeluarkan); jumlah tagihan baris ikut berkurang
create or replace function public.return_work_order_part(p_item_id uuid, p_qty numeric, p_location_id uuid, p_note text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_line public.work_order_items%rowtype;
  v_wo   public.work_orders%rowtype;
  v_cost numeric;
  v_mov  uuid;
  v_val  numeric(18,2);
  v_id   uuid;
begin
  perform app.assert_permission('part_issue', 'update');
  select * into v_line from public.work_order_items where id = p_item_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Baris work order tidak ditemukan' using errcode = 'P0002'; end if;
  v_wo := app.lock_open_wo(v_line.work_order_id);
  if coalesce(p_qty, 0) <= 0 then raise exception 'Jumlah harus lebih dari nol' using errcode = '22023'; end if;
  if p_qty > v_line.issued_qty then
    raise exception 'Jumlah kembali melebihi part yang sudah keluar (%)', trim_scale(v_line.issued_qty) using errcode = '23514';
  end if;
  perform app.assert_ref('locations', p_location_id, 'Lokasi rak');

  -- Nilai rata-rata part yang keluar untuk baris ini
  select sum(m.unit_cost * pi.qty) / nullif(sum(pi.qty), 0) into v_cost
  from public.part_issues pi join public.stock_movements m on m.id = pi.movement_id
  where pi.work_order_item_id = v_line.id and pi.kind = 'issue';

  v_id := gen_random_uuid();
  v_mov := app.post_stock_movement(v_line.item_id, p_location_id, 'service_return', p_qty, coalesce(v_cost, 0), 'part_issue', v_id,
                                   v_wo.wo_no || coalesce(' · ' || nullif(btrim(p_note), ''), ''));
  insert into public.part_issues (id, branch_id, work_order_id, work_order_item_id, item_id, location_id, kind, qty, movement_id, note)
  values (v_id, v_line.branch_id, v_wo.id, v_line.id, v_line.item_id, p_location_id, 'return', p_qty, v_mov, nullif(btrim(p_note), ''));

  -- Tidak terpakai = tidak ditagih: jumlah & nilai baris berkurang proporsional; habis = baris batal
  if v_line.qty - p_qty <= 0 then
    update public.work_order_items
       set issued_qty = 0, is_cancelled = true, cancel_reason = 'Part tidak terpakai, dikembalikan ke stok'
     where id = v_line.id;
  else
    update public.work_order_items
       set issued_qty = issued_qty - p_qty, qty = qty - p_qty,
           line_total = round(line_total * (qty - p_qty) / qty, 2),
           discount_amount = least(discount_amount, round(line_total * (qty - p_qty) / qty, 2))
     where id = v_line.id;
  end if;

  v_val := round(p_qty * coalesce(v_cost, 0), 2);
  if v_val > 0 then
    perform app.post_journal(app.today_wib(), 'part_issue', v_id,
      'Part kembali ' || v_wo.wo_no || ': ' || v_line.description,
      jsonb_build_array(jsonb_build_object('account', 'inventory', 'debit', v_val),
                        jsonb_build_object('account', case when v_wo.is_warranty then 'warranty_expense' else 'wip' end, 'credit', v_val)));
  end if;
  return v_id;
end;
$$;

-- =============================================================================
-- Garansi (PRD §7.4): klaim dari riwayat servis -> WO baru bertanda Garansi, Rp0 ke pelanggan.
-- Masa garansi dihitung dari tanggal kendaraan diserahkan (invoice menyusul di modul Kasir).
-- p_data: complaint, odometer?
-- =============================================================================
create or replace function public.create_warranty_work_order(p_source_id uuid, p_item_ids uuid[], p_data jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_src  public.work_orders%rowtype;
  v_id   uuid;
  v_odo  integer := nullif(p_data ->> 'odometer', '')::int;
  v_bad  integer;
begin
  perform app.assert_permission('service_orders', 'create');
  select * into v_src from public.work_orders where id = p_source_id and branch_id = app.current_branch_id();
  if not found then raise exception 'Work order asal tidak ditemukan' using errcode = 'P0002'; end if;
  if v_src.status <> 'delivered' then raise exception 'Klaim garansi hanya untuk servis yang sudah diserahkan' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_data ->> 'complaint', ''))) < 3 then raise exception 'Keluhan klaim wajib diisi' using errcode = '22023'; end if;
  if coalesce(array_length(p_item_ids, 1), 0) = 0 then raise exception 'Pilih jasa/part yang diklaim' using errcode = '22023'; end if;

  select count(*) into v_bad from unnest(p_item_ids) x(id)
  where not exists (select 1 from public.work_order_items i
                    where i.id = x.id and i.work_order_id = p_source_id and not i.is_cancelled and i.warranty_days > 0
                      and (v_src.delivered_at at time zone 'Asia/Jakarta')::date + i.warranty_days >= app.today_wib());
  if v_bad > 0 then raise exception 'Ada baris yang tidak bergaransi atau masa garansinya habis' using errcode = '22023'; end if;

  insert into public.work_orders (branch_id, wo_no, vehicle_id, customer_id, plate_no, vehicle_label, odometer_in, complaint,
                                  is_warranty, warranty_source_id)
  select v_src.branch_id, app.next_document_number('WO', app.today_wib(), v_src.branch_id), v_src.vehicle_id, vv.customer_id,
         vv.plate_no, v_src.vehicle_label, v_odo, btrim(p_data ->> 'complaint'), true, v_src.id
  from public.v_vehicles vv where vv.id = v_src.vehicle_id
  returning id into v_id;

  insert into public.work_order_items (branch_id, work_order_id, warranty_source_item_id, line_type, service_id, item_id, package_id,
                                       description, qty, unit_price, line_total, duration_minutes, warranty_days, sort_order)
  select i.branch_id, v_id, i.id, i.line_type, i.service_id, i.item_id, i.package_id, i.description || ' (garansi)', i.qty, 0, 0,
         i.duration_minutes, 0, row_number() over (order by i.sort_order)
  from public.work_order_items i where i.id = any(p_item_ids);

  insert into public.work_order_status_logs (branch_id, work_order_id, to_status, employee_id, note)
  values (v_src.branch_id, v_id, 'queued', app.current_employee_id(), 'Klaim garansi dari ' || v_src.wo_no);
  if v_odo is not null then
    update public.vehicles set last_odometer = greatest(coalesce(last_odometer, 0), v_odo) where id = v_src.vehicle_id;
  end if;
  return v_id;
end;
$$;

-- Daftar mekanik untuk dipilih di WO (role Mekanik, aktif)
create or replace function public.list_mechanics()
returns table (id uuid, full_name text)
language sql stable security definer
set search_path = ''
as $$
  select distinct e.id, e.full_name
  from public.employees e
  join public.employee_roles er on er.employee_id = e.id
  join public.roles r on r.id = er.role_id and r.is_active and r.code = 'mechanic'
  where e.branch_id = app.current_branch_id() and e.status = 'active'
    and (app.has_permission('service_orders', 'view', 'own') or app.has_permission('service_board', 'view', 'own'))
  order by e.full_name
$$;

-- =============================================================================
-- RLS & hak akses
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array['estimates', 'estimate_items', 'work_orders', 'work_order_items', 'work_order_mechanics',
    'part_issues', 'work_order_status_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- Estimasi: izin estimasi & WO lingkup penuh (Admin, Kasir & Gudang lihat). Mekanik tidak.
create policy estimates_select on public.estimates for select to authenticated
  using (branch_id = app.current_branch_id() and app.has_permission('service_orders', 'view'));
create policy estimate_items_select on public.estimate_items for select to authenticated
  using (branch_id = app.current_branch_id() and app.has_permission('service_orders', 'view'));
-- WO & turunannya: penuh, atau mekanik hanya WO yang ia kerjakan
create policy work_orders_select on public.work_orders for select to authenticated
  using (branch_id = app.current_branch_id() and app.can_view_work_order(id));
create policy work_order_items_select on public.work_order_items for select to authenticated
  using (branch_id = app.current_branch_id() and app.can_view_work_order(work_order_id));
create policy work_order_mechanics_select on public.work_order_mechanics for select to authenticated
  using (branch_id = app.current_branch_id() and app.can_view_work_order(work_order_id));
create policy part_issues_select on public.part_issues for select to authenticated
  using (branch_id = app.current_branch_id() and app.can_view_work_order(work_order_id));
create policy work_order_status_logs_select on public.work_order_status_logs for select to authenticated
  using (branch_id = app.current_branch_id() and app.can_view_work_order(work_order_id));

grant select on public.v_work_orders, public.v_estimates to authenticated;

revoke all on function app.fill_estimate(uuid, jsonb, numeric), app.set_wo_status(uuid, public.work_order_status, text),
  app.restore_wo_after_approval(uuid, text), app.copy_estimate_lines(uuid, uuid),
  app.approve_estimate(uuid, public.approval_channel, text), app.convert_estimate(uuid, jsonb), app.lock_open_wo(uuid)
  from public, anon, authenticated;

revoke all on function public.save_estimate(uuid, jsonb, jsonb), public.mark_estimate_sent(uuid),
  public.approve_estimate(uuid, public.approval_channel, text, jsonb), public.convert_estimate_to_work_order(uuid, jsonb),
  public.reject_estimate(uuid, text), public.void_estimate(uuid, text), public.update_work_order(uuid, jsonb),
  public.add_work_order_work(uuid, jsonb, jsonb, jsonb), public.cancel_work_order_item(uuid, text),
  public.set_work_order_mechanics(uuid, jsonb), public.set_work_order_status(uuid, public.work_order_status, text),
  public.void_work_order(uuid, text), public.request_work_order_part(uuid),
  public.issue_work_order_part(uuid, numeric, uuid, text), public.return_work_order_part(uuid, numeric, uuid, text),
  public.create_warranty_work_order(uuid, uuid[], jsonb), public.list_mechanics()
  from public, anon;
grant execute on function public.save_estimate(uuid, jsonb, jsonb), public.mark_estimate_sent(uuid),
  public.approve_estimate(uuid, public.approval_channel, text, jsonb), public.convert_estimate_to_work_order(uuid, jsonb),
  public.reject_estimate(uuid, text), public.void_estimate(uuid, text), public.update_work_order(uuid, jsonb),
  public.add_work_order_work(uuid, jsonb, jsonb, jsonb), public.cancel_work_order_item(uuid, text),
  public.set_work_order_mechanics(uuid, jsonb), public.set_work_order_status(uuid, public.work_order_status, text),
  public.void_work_order(uuid, text), public.request_work_order_part(uuid),
  public.issue_work_order_part(uuid, numeric, uuid, text), public.return_work_order_part(uuid, numeric, uuid, text),
  public.create_warranty_work_order(uuid, uuid[], jsonb), public.list_mechanics()
  to authenticated;
