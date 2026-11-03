-- =============================================================================
-- Migrasi 16: Modul Stok Opname (PRD §9 & §11.3)
-- Jenis opname: menyeluruh (full), parsial lokasi (location),
-- parsial kategori (category), dan cycle count acak (cycle_count).
-- Fitur: hitung buta (blind count), review selisih, alasan per selisih,
-- posting penyesuaian stok otomatis, dan jurnal pembalik/selisih persediaan.
-- =============================================================================

-- Setting ambang toleransi selisih nilai opname yang membutuhkan PIN Owner
insert into public.settings (branch_id, key, value, description)
select id, 'opname_pin_threshold', '500000'::jsonb,
       'Batas nilai selisih opname (Rp) yang mewajibkan PIN Owner untuk persetujuan'
from public.branches
on conflict (branch_id, key) do nothing;

-- -----------------------------------------------------------------------------
-- Tipe enum opname
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'opname_type') then
    create type public.opname_type as enum (
      'full',        -- Menyeluruh: semua barang di semua rak
      'location',    -- Parsial per lokasi: satu atau beberapa rak tertentu
      'category',    -- Parsial per kategori: satu atau beberapa kategori tertentu
      'cycle_count'  -- Cycle count acak: N barang acak
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'opname_status') then
    create type public.opname_status as enum (
      'draft',       -- Sesi dibuat, cakupan ditentukan
      'in_progress', -- Sedang dihitung fisik oleh petugas
      'review',      -- Hitung fisik selesai, sedang ditinjau selisihnya
      'posted',      -- Disetujui & penyesuaian stok serta jurnal telah diposting
      'void'         -- Dibatalkan
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'opname_variance_reason') then
    create type public.opname_variance_reason as enum (
      'damaged',     -- Rusak
      'lost',        -- Hilang
      'input_error', -- Salah input sebelumnya
      'misplaced',   -- Salah taruh lokasi
      'other'        -- Alasan lainnya
    );
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Tabel header: stock_opnames
-- -----------------------------------------------------------------------------
create table if not exists public.stock_opnames (
  id                    uuid primary key default gen_random_uuid(),
  branch_id             uuid not null references public.branches(id),
  opname_no             text not null unique,
  opname_type           public.opname_type not null,
  status                public.opname_status not null default 'draft',
  is_blind_count        boolean not null default true,
  scope_filter          jsonb not null default '{}'::jsonb,
  assigned_to           uuid references public.employees(id),
  notes                 text,
  total_items           integer not null default 0,
  matched_items         integer not null default 0,
  variance_items        integer not null default 0,
  total_variance_amount numeric(18,2) not null default 0,
  started_at            timestamptz,
  counted_at            timestamptz,
  completed_at          timestamptz,
  approved_by           uuid references public.employees(id),
  approved_at           timestamptz,
  journal_id            uuid references public.journal_entries(id),
  void_reason           text,
  created_at            timestamptz not null default now(),
  created_by            uuid references public.employees(id),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_stock_opnames_branch_status on public.stock_opnames(branch_id, status);
create index if not exists idx_stock_opnames_created on public.stock_opnames(created_at desc);

alter table public.stock_opnames add column if not exists completed_at timestamptz;

-- -----------------------------------------------------------------------------
-- Tabel detail: stock_opname_items
-- -----------------------------------------------------------------------------
create table if not exists public.stock_opname_items (
  id                uuid primary key default gen_random_uuid(),
  opname_id         uuid not null references public.stock_opnames(id) on delete cascade,
  item_id           uuid not null references public.items(id),
  location_id       uuid not null references public.locations(id),
  system_qty        numeric(14,3) not null default 0,
  physical_qty      numeric(14,3),
  difference_qty    numeric(14,3) not null default 0,
  cost_price        numeric(18,2) not null default 0,
  difference_amount numeric(18,2) not null default 0,
  variance_reason   public.opname_variance_reason,
  notes             text,
  counted_at        timestamptz,
  counted_by        uuid references public.employees(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (opname_id, item_id, location_id)
);

create index if not exists idx_stock_opname_items_opname on public.stock_opname_items(opname_id);
create index if not exists idx_stock_opname_items_item on public.stock_opname_items(item_id);

-- Trigger updated_at & audit log
drop trigger if exists set_stock_opnames_updated_at on public.stock_opnames;
create trigger set_stock_opnames_updated_at
  before update on public.stock_opnames
  for each row execute function app.set_updated_at();

drop trigger if exists set_stock_opname_items_updated_at on public.stock_opname_items;
create trigger set_stock_opname_items_updated_at
  before update on public.stock_opname_items
  for each row execute function app.set_updated_at();

drop trigger if exists audit_stock_opnames_change on public.stock_opnames;
create trigger audit_stock_opnames_change
  after insert or update or delete on public.stock_opnames
  for each row execute function app.audit_row_change();

drop trigger if exists audit_stock_opname_items_change on public.stock_opname_items;
create trigger audit_stock_opname_items_change
  after insert or update or delete on public.stock_opname_items
  for each row execute function app.audit_row_change();

-- Imutabilitas: sesi yang sudah diposting atau void tidak boleh dihapus
create or replace function app.prevent_opname_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('posted', 'void') then
    raise exception 'Dokumen stok opname yang sudah diposting atau dibatalkan tidak boleh dihapus'
      using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_no_delete_stock_opnames on public.stock_opnames;
create trigger trg_no_delete_stock_opnames
  before delete on public.stock_opnames
  for each row execute function app.prevent_opname_delete();

-- -----------------------------------------------------------------------------
-- View: v_stock_opnames
-- -----------------------------------------------------------------------------
drop view if exists public.v_stock_opnames cascade;
create or replace view public.v_stock_opnames with (security_invoker = true) as
select
  o.id,
  o.branch_id,
  b.name as branch_name,
  o.opname_no,
  o.opname_type,
  o.status,
  o.is_blind_count,
  o.scope_filter,
  o.assigned_to,
  app.employee_name(o.assigned_to) as assigned_name,
  o.notes,
  o.total_items,
  o.matched_items,
  o.variance_items,
  o.total_variance_amount,
  case
    when o.total_items > 0 then round((o.matched_items::numeric / o.total_items::numeric) * 100, 1)
    else 100.0
  end as accuracy_pct,
  o.started_at,
  o.counted_at,
  o.completed_at,
  o.approved_by,
  app.employee_name(o.approved_by) as approved_name,
  o.approved_at,
  o.journal_id,
  j.entry_no as journal_no,
  o.void_reason,
  o.created_at,
  o.created_by,
  app.employee_name(o.created_by) as created_by_name,
  o.updated_at
from public.stock_opnames o
join public.branches b on b.id = o.branch_id
left join public.journal_entries j on j.id = o.journal_id;

-- -----------------------------------------------------------------------------
-- View: v_stock_opname_items
-- -----------------------------------------------------------------------------
drop view if exists public.v_stock_opname_items cascade;
create or replace view public.v_stock_opname_items with (security_invoker = true) as
select
  oi.id,
  oi.opname_id,
  oi.item_id,
  i.sku as item_sku,
  i.name as item_name,
  c.name as category_name,
  u.code as unit_code,
  u.name as unit_name,
  oi.location_id,
  l.code as location_code,
  l.name as location_name,
  oi.system_qty,
  oi.physical_qty,
  oi.difference_qty,
  oi.cost_price,
  oi.difference_amount,
  oi.variance_reason,
  oi.notes,
  oi.counted_at,
  oi.counted_by,
  app.employee_name(oi.counted_by) as counted_by_name,
  oi.created_at,
  oi.updated_at
from public.stock_opname_items oi
join public.items i on i.id = oi.item_id
join public.units u on u.id = i.base_unit_id
left join public.item_categories c on c.id = i.category_id
join public.locations l on l.id = oi.location_id;

-- -----------------------------------------------------------------------------
-- Fungsi internal: hitung ulang ringkasan sesi opname
-- -----------------------------------------------------------------------------
create or replace function app.recompute_opname_summary(p_opname_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total    integer := 0;
  v_matched  integer := 0;
  v_variance integer := 0;
  v_amount   numeric(18,2) := 0;
begin
  select
    count(*),
    count(*) filter (where physical_qty is not null and difference_qty = 0),
    count(*) filter (where physical_qty is not null and difference_qty <> 0),
    coalesce(sum(difference_amount) filter (where physical_qty is not null), 0)
  into v_total, v_matched, v_variance, v_amount
  from public.stock_opname_items
  where opname_id = p_opname_id;

  update public.stock_opnames
  set total_items = v_total,
      matched_items = v_matched,
      variance_items = v_variance,
      total_variance_amount = v_amount
  where id = p_opname_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Fungsi publik: create_stock_opname
-- Membuat sesi opname baru dan menginisialisasi daftar item sesuai cakupan
-- -----------------------------------------------------------------------------
create or replace function public.create_stock_opname(
  p_data jsonb,
  p_items jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch        uuid := app.current_branch_id();
  v_id            uuid;
  v_no            text;
  v_type          public.opname_type;
  v_is_blind      boolean := coalesce((p_data ->> 'is_blind_count')::boolean, true);
  v_assigned_to   uuid := nullif(p_data ->> 'assigned_to', '')::uuid;
  v_notes         text := btrim(p_data ->> 'notes');
  v_scope         jsonb := coalesce(p_data -> 'scope_filter', '{}'::jsonb);
  v_date          date := app.today_wib();
  v_loc_ids       uuid[];
  v_cat_ids       uuid[];
  v_sample_size   integer;
  v_item_elem     jsonb;
begin
  if v_branch is null then
    raise exception 'Cabang tidak diketahui' using errcode = '42501';
  end if;

  perform app.assert_permission('stock_opname_count', 'create');

  v_type := (p_data ->> 'opname_type')::public.opname_type;
  if v_type is null then
    raise exception 'Jenis opname wajib diisi' using errcode = '22023';
  end if;

  v_no := app.next_document_number('SOP', v_date, v_branch);

  insert into public.stock_opnames (
    branch_id, opname_no, opname_type, status, is_blind_count,
    scope_filter, assigned_to, notes, created_by
  ) values (
    v_branch, v_no, v_type, 'draft', v_is_blind,
    v_scope, v_assigned_to, v_notes, app.current_employee_id()
  ) returning id into v_id;

  -- Jika daftar item manual disediakan
  if p_items is not null and jsonb_array_length(p_items) > 0 then
    for v_item_elem in select * from jsonb_array_elements(p_items) loop
      insert into public.stock_opname_items (
        opname_id, item_id, location_id, system_qty, cost_price
      )
      select
        v_id,
        (v_item_elem ->> 'item_id')::uuid,
        (v_item_elem ->> 'location_id')::uuid,
        coalesce((select qty from public.stock_balances where item_id = (v_item_elem ->> 'item_id')::uuid and location_id = (v_item_elem ->> 'location_id')::uuid), 0),
        coalesce((select avg_cost from public.item_costs where item_id = (v_item_elem ->> 'item_id')::uuid and branch_id = v_branch), 0)
      on conflict (opname_id, item_id, location_id) do nothing;
    end loop;
  else
    -- Inisialisasi otomatis berdasarkan jenis cakupan
    if v_type = 'full' then
      -- Semua barang aktif beserta lokasi default atau lokasi bersaldo
      insert into public.stock_opname_items (
        opname_id, item_id, location_id, system_qty, cost_price
      )
      select distinct
        v_id,
        i.id,
        coalesce(b.location_id, i.default_location_id),
        coalesce(b.qty, 0),
        coalesce(c.avg_cost, 0)
      from public.items i
      left join public.stock_balances b on b.item_id = i.id and b.branch_id = v_branch
      left join public.item_costs c on c.item_id = i.id and c.branch_id = v_branch
      where i.branch_id = v_branch
        and i.is_active = true
        and coalesce(b.location_id, i.default_location_id) is not null
      on conflict (opname_id, item_id, location_id) do nothing;

    elsif v_type = 'location' then
      -- Parsial per lokasi rak
      if v_scope ? 'location_ids' and jsonb_array_length(v_scope -> 'location_ids') > 0 then
        select array_agg(value::text::uuid) into v_loc_ids
        from jsonb_array_elements_text(v_scope -> 'location_ids');

        insert into public.stock_opname_items (
          opname_id, item_id, location_id, system_qty, cost_price
        )
        select distinct
          v_id,
          i.id,
          coalesce(b.location_id, i.default_location_id),
          coalesce(b.qty, 0),
          coalesce(c.avg_cost, 0)
        from public.items i
        left join public.stock_balances b on b.item_id = i.id and b.branch_id = v_branch
        left join public.item_costs c on c.item_id = i.id and c.branch_id = v_branch
        where i.branch_id = v_branch
          and i.is_active = true
          and coalesce(b.location_id, i.default_location_id) = any(v_loc_ids)
        on conflict (opname_id, item_id, location_id) do nothing;
      end if;

    elsif v_type = 'category' then
      -- Parsial per kategori barang
      if v_scope ? 'category_ids' and jsonb_array_length(v_scope -> 'category_ids') > 0 then
        select array_agg(value::text::uuid) into v_cat_ids
        from jsonb_array_elements_text(v_scope -> 'category_ids');

        insert into public.stock_opname_items (
          opname_id, item_id, location_id, system_qty, cost_price
        )
        select distinct
          v_id,
          i.id,
          coalesce(b.location_id, i.default_location_id),
          coalesce(b.qty, 0),
          coalesce(c.avg_cost, 0)
        from public.items i
        left join public.stock_balances b on b.item_id = i.id and b.branch_id = v_branch
        left join public.item_costs c on c.item_id = i.id and c.branch_id = v_branch
        where i.branch_id = v_branch
          and i.is_active = true
          and i.category_id = any(v_cat_ids)
          and coalesce(b.location_id, i.default_location_id) is not null
        on conflict (opname_id, item_id, location_id) do nothing;
      end if;

    elsif v_type = 'cycle_count' then
      -- Cycle count: N barang acak
      v_sample_size := coalesce((v_scope ->> 'sample_size')::integer, 20);
      if v_sample_size < 1 then v_sample_size := 20; end if;

      insert into public.stock_opname_items (
        opname_id, item_id, location_id, system_qty, cost_price
      )
      select
        v_id,
        q.item_id,
        q.location_id,
        q.system_qty,
        q.cost_price
      from (
        select
          d.item_id,
          d.location_id,
          d.system_qty,
          d.cost_price
        from (
          select distinct
            i.id as item_id,
            coalesce(b.location_id, i.default_location_id) as location_id,
            coalesce(b.qty, 0) as system_qty,
            coalesce(c.avg_cost, 0) as cost_price
          from public.items i
          left join public.stock_balances b on b.item_id = i.id and b.branch_id = v_branch
          left join public.item_costs c on c.item_id = i.id and c.branch_id = v_branch
          where i.branch_id = v_branch
            and i.is_active = true
            and coalesce(b.location_id, i.default_location_id) is not null
        ) d
        order by random()
        limit v_sample_size
      ) q
      on conflict (opname_id, item_id, location_id) do nothing;
    end if;
  end if;

  perform app.recompute_opname_summary(v_id);
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Fungsi publik: start_stock_opname
-- Memulai sesi opname (pindah dari draft ke in_progress)
-- dan membekukan snapshot stok sistem saat mulai
-- -----------------------------------------------------------------------------
create or replace function public.start_stock_opname(p_opname_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opname public.stock_opnames%rowtype;
begin
  select * into v_opname
  from public.stock_opnames
  where id = p_opname_id;

  if not found then
    raise exception 'Sesi opname tidak ditemukan' using errcode = 'P0002';
  end if;

  if v_opname.status <> 'draft' then
    raise exception 'Hanya sesi berstatus draft yang dapat dimulai' using errcode = '42501';
  end if;

  perform app.assert_permission('stock_opname_count', 'update');

  -- Perbarui saldo sistem snapshot dan HPP pada saat sesi dimulai
  update public.stock_opname_items oi
  set system_qty = coalesce((select qty from public.stock_balances where item_id = oi.item_id and location_id = oi.location_id), 0),
      cost_price = coalesce((select avg_cost from public.item_costs where item_id = oi.item_id and branch_id = v_opname.branch_id), 0)
  where oi.opname_id = p_opname_id;

  update public.stock_opnames
  set status = 'in_progress',
      started_at = coalesce(started_at, now())
  where id = p_opname_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Fungsi publik: save_opname_counts
-- Menyimpan hasil hitung fisik (bisa bertahap/parsial)
-- -----------------------------------------------------------------------------
create or replace function public.save_opname_counts(
  p_opname_id uuid,
  p_counts jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opname      public.stock_opnames%rowtype;
  v_emp         uuid := app.current_employee_id();
  v_elem        jsonb;
  v_item_id     uuid;
  v_loc_id      uuid;
  v_phys_qty    numeric(14,3);
  v_reason      public.opname_variance_reason;
  v_notes       text;
  v_cost        numeric(18,2);
  v_sys_qty     numeric(14,3);
  v_diff_qty    numeric(14,3);
  v_diff_amt    numeric(18,2);
begin
  select * into v_opname
  from public.stock_opnames
  where id = p_opname_id;

  if not found then
    raise exception 'Sesi opname tidak ditemukan' using errcode = 'P0002';
  end if;

  if v_opname.status not in ('draft', 'in_progress', 'review') then
    raise exception 'Sesi opname sudah diposting atau dibatalkan' using errcode = '42501';
  end if;

  perform app.assert_permission('stock_opname_count', 'update');

  -- Jika status masih draft, otomatis naikkan ke in_progress
  if v_opname.status = 'draft' then
    update public.stock_opnames
    set status = 'in_progress',
        started_at = coalesce(started_at, now())
    where id = p_opname_id;
  end if;

  for v_elem in select * from jsonb_array_elements(p_counts) loop
    v_item_id  := (v_elem ->> 'item_id')::uuid;
    v_loc_id   := (v_elem ->> 'location_id')::uuid;
    v_phys_qty := (v_elem ->> 'physical_qty')::numeric(14,3);
    v_reason   := nullif(v_elem ->> 'variance_reason', '')::public.opname_variance_reason;
    v_notes    := btrim(v_elem ->> 'notes');

    if v_item_id is null or v_loc_id is null then
      continue;
    end if;

    if v_phys_qty is not null and v_phys_qty < 0 then
      raise exception 'Jumlah fisik tidak boleh negatif' using errcode = '22023';
    end if;

    -- Cari atau inisialisasi item bila belum terdaftar di sesi opname
    select system_qty, cost_price into v_sys_qty, v_cost
    from public.stock_opname_items
    where opname_id = p_opname_id and item_id = v_item_id and location_id = v_loc_id;

    if not found then
      -- Item baru ditemukan di rak saat opname berlangsung
      select coalesce(qty, 0) into v_sys_qty
      from public.stock_balances
      where item_id = v_item_id and location_id = v_loc_id;

      if v_sys_qty is null then v_sys_qty := 0; end if;

      select coalesce(avg_cost, 0) into v_cost
      from public.item_costs
      where item_id = v_item_id and branch_id = v_opname.branch_id;

      if v_cost is null then v_cost := 0; end if;

      v_diff_qty := case when v_phys_qty is not null then v_phys_qty - v_sys_qty else 0 end;
      v_diff_amt := v_diff_qty * v_cost;

      insert into public.stock_opname_items (
        opname_id, item_id, location_id, system_qty, physical_qty,
        difference_qty, cost_price, difference_amount, variance_reason,
        notes, counted_at, counted_by
      ) values (
        p_opname_id, v_item_id, v_loc_id, v_sys_qty, v_phys_qty,
        v_diff_qty, v_cost, v_diff_amt, v_reason,
        v_notes, case when v_phys_qty is not null then now() end,
        case when v_phys_qty is not null then v_emp end
      );
    else
      v_diff_qty := case when v_phys_qty is not null then v_phys_qty - v_sys_qty else 0 end;
      v_diff_amt := v_diff_qty * v_cost;

      update public.stock_opname_items
      set physical_qty = v_phys_qty,
          difference_qty = v_diff_qty,
          difference_amount = v_diff_amt,
          variance_reason = coalesce(v_reason, variance_reason),
          notes = coalesce(v_notes, notes),
          counted_at = case when v_phys_qty is not null then now() else counted_at end,
          counted_by = case when v_phys_qty is not null then v_emp else counted_by end
      where opname_id = p_opname_id and item_id = v_item_id and location_id = v_loc_id;
    end if;
  end loop;

  perform app.recompute_opname_summary(p_opname_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Fungsi publik: complete_opname_count
-- Menyelesaikan hitung fisik dan memindahkan status ke review
-- -----------------------------------------------------------------------------
create or replace function public.complete_opname_count(p_opname_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opname    public.stock_opnames%rowtype;
  v_uncounted integer;
begin
  select * into v_opname
  from public.stock_opnames
  where id = p_opname_id;

  if not found then
    raise exception 'Sesi opname tidak ditemukan' using errcode = 'P0002';
  end if;

  if v_opname.status not in ('draft', 'in_progress') then
    raise exception 'Sesi tidak dalam status penghitungan' using errcode = '42501';
  end if;

  perform app.assert_permission('stock_opname_count', 'update');

  select count(*) into v_uncounted
  from public.stock_opname_items
  where opname_id = p_opname_id and physical_qty is null;

  if v_uncounted > 0 then
    raise exception 'Masih ada % barang yang belum dihitung fisik', v_uncounted
      using errcode = '22023';
  end if;

  perform app.recompute_opname_summary(p_opname_id);

  update public.stock_opnames
  set status = 'review',
      counted_at = coalesce(counted_at, now())
  where id = p_opname_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Fungsi publik: recount_opname_item
-- Mengosongkan hitungan item agar dihitung ulang
-- -----------------------------------------------------------------------------
create or replace function public.recount_opname_item(p_item_row_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opname_id uuid;
begin
  select opname_id into v_opname_id
  from public.stock_opname_items
  where id = p_item_row_id;

  if not found then
    raise exception 'Baris item opname tidak ditemukan' using errcode = 'P0002';
  end if;

  perform app.assert_permission('stock_opname_count', 'update');

  update public.stock_opname_items
  set physical_qty = null,
      difference_qty = 0,
      difference_amount = 0,
      variance_reason = null,
      counted_at = null,
      counted_by = null
  where id = p_item_row_id;

  update public.stock_opnames
  set status = 'in_progress'
  where id = v_opname_id and status = 'review';

  perform app.recompute_opname_summary(v_opname_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Fungsi publik: post_stock_opname
-- Persetujuan & posting penyesuaian stok serta jurnal otomatis
-- -----------------------------------------------------------------------------
create or replace function public.post_stock_opname(
  p_opname_id      uuid,
  p_pin            text default null,
  p_items_reasons  jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opname          public.stock_opnames%rowtype;
  v_branch          uuid;
  v_emp             uuid := app.current_employee_id();
  v_threshold       numeric(18,2);
  v_missing_reasons integer;
  v_elem            jsonb;
  v_item            record;
  v_journal_id      uuid := null;
  v_journal_lines   jsonb := '[]'::jsonb;
  v_total_shortage  numeric(18,2) := 0; -- total nilai selisih kurang
  v_total_surplus   numeric(18,2) := 0; -- total nilai selisih lebih
  v_approver        uuid;
begin
  select * into v_opname
  from public.stock_opnames
  where id = p_opname_id;

  if not found then
    raise exception 'Sesi opname tidak ditemukan' using errcode = 'P0002';
  end if;

  if v_opname.status = 'posted' then
    raise exception 'Sesi opname sudah diposting sebelumnya' using errcode = '42501';
  end if;

  if v_opname.status = 'void' then
    raise exception 'Sesi opname sudah dibatalkan' using errcode = '42501';
  end if;

  v_branch := v_opname.branch_id;
  perform app.assert_permission('stock_opname_approve', 'approve');

  -- Jika alasan per selisih dikirim bersamaan dengan permintaan posting
  if p_items_reasons is not null and jsonb_array_length(p_items_reasons) > 0 then
    for v_elem in select * from jsonb_array_elements(p_items_reasons) loop
      update public.stock_opname_items
      set variance_reason = (v_elem ->> 'variance_reason')::public.opname_variance_reason,
          notes = coalesce(btrim(v_elem ->> 'notes'), notes)
      where id = (v_elem ->> 'id')::uuid and opname_id = p_opname_id;
    end loop;
  end if;

  -- Pastikan semua item sudah dihitung fisik
  if exists (
    select 1 from public.stock_opname_items
    where opname_id = p_opname_id and physical_qty is null
  ) then
    raise exception 'Semua item wajib dihitung fisik sebelum disetujui' using errcode = '22023';
  end if;

  -- Pastikan setiap selisih memiliki alasan (PRD §9.2)
  select count(*) into v_missing_reasons
  from public.stock_opname_items
  where opname_id = p_opname_id
    and difference_qty <> 0
    and variance_reason is null;

  if v_missing_reasons > 0 then
    raise exception 'Alasan selisih wajib diisi untuk semua barang yang berselisih' using errcode = '22023';
  end if;

  perform app.recompute_opname_summary(p_opname_id);
  select * into v_opname from public.stock_opnames where id = p_opname_id;

  -- Cek ambang toleransi selisih nilai yang memerlukan PIN Owner
  select (value #>> '{}')::numeric into v_threshold
  from public.settings
  where branch_id = v_branch and key = 'opname_pin_threshold';

  if v_threshold is null then v_threshold := 500000; end if;

  if abs(v_opname.total_variance_amount) > v_threshold then
    if p_pin is null or length(btrim(p_pin)) = 0 then
      raise exception 'Nilai selisih opname (Rp %) melebihi ambang batas toleransi (Rp %). Memerlukan PIN Owner untuk persetujuan',
        to_char(abs(v_opname.total_variance_amount), 'FM999,999,999'),
        to_char(v_threshold, 'FM999,999,999')
        using errcode = '42501';
    end if;
    v_approver := app.verify_pin(p_pin);
  else
    if p_pin is not null and length(btrim(p_pin)) > 0 then
      v_approver := app.verify_pin(p_pin);
    else
      v_approver := v_emp;
    end if;
  end if;

  -- 1. Buat mutasi stok untuk setiap baris yang berselisih
  for v_item in
    select oi.*, i.name as item_name
    from public.stock_opname_items oi
    join public.items i on i.id = oi.item_id
    where oi.opname_id = p_opname_id
      and oi.difference_qty <> 0
  loop
    perform app.post_stock_movement(
      v_item.item_id,
      v_item.location_id,
      'opname_adjustment'::public.stock_movement_type,
      v_item.difference_qty,
      v_item.cost_price,
      'stock_opnames',
      p_opname_id,
      'Penyesuaian opname ' || v_opname.opname_no || ' (' || coalesce(v_item.variance_reason::text, 'opname') || ')'
    );

    if v_item.difference_amount < 0 then
      v_total_shortage := v_total_shortage + abs(v_item.difference_amount);
    else
      v_total_surplus := v_total_surplus + v_item.difference_amount;
    end if;
  end loop;

  -- 2. Buat jurnal penyesuaian selisih persediaan jika ada nilai selisih
  if v_total_shortage > 0 or v_total_surplus > 0 then
    -- Baris jurnal untuk selisih kurang: Dr Beban Selisih, Cr Persediaan
    if v_total_shortage > 0 then
      v_journal_lines := v_journal_lines || jsonb_build_array(
        jsonb_build_object(
          'account', 'inventory_variance',
          'debit', v_total_shortage,
          'memo', 'Beban selisih kurang persediaan ' || v_opname.opname_no
        ),
        jsonb_build_object(
          'account', 'inventory',
          'credit', v_total_shortage,
          'memo', 'Penyesuaian stok kurang ' || v_opname.opname_no
        )
      );
    end if;

    -- Baris jurnal untuk selisih lebih: Dr Persediaan, Cr Beban Selisih
    if v_total_surplus > 0 then
      v_journal_lines := v_journal_lines || jsonb_build_array(
        jsonb_build_object(
          'account', 'inventory',
          'debit', v_total_surplus,
          'memo', 'Penyesuaian stok lebih ' || v_opname.opname_no
        ),
        jsonb_build_object(
          'account', 'inventory_variance',
          'credit', v_total_surplus,
          'memo', 'Pengakuan selisih lebih persediaan ' || v_opname.opname_no
        )
      );
    end if;

    v_journal_id := app.post_journal(
      app.today_wib(),
      'stock_opnames',
      p_opname_id,
      'Penyesuaian stok opname ' || v_opname.opname_no,
      v_journal_lines
    );
  end if;

  -- 3. Update status sesi opname menjadi posted
  update public.stock_opnames
  set status = 'posted',
      approved_by = v_approver,
      approved_at = now(),
      completed_at = now(),
      journal_id = v_journal_id
  where id = p_opname_id;

  return p_opname_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Fungsi publik: void_stock_opname
-- Membatalkan sesi opname yang belum diposting
-- -----------------------------------------------------------------------------
create or replace function public.void_stock_opname(
  p_opname_id uuid,
  p_reason    text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opname public.stock_opnames%rowtype;
  v_reason text := btrim(p_reason);
begin
  select * into v_opname
  from public.stock_opnames
  where id = p_opname_id;

  if not found then
    raise exception 'Sesi opname tidak ditemukan' using errcode = 'P0002';
  end if;

  if v_opname.status = 'posted' then
    raise exception 'Sesi opname yang sudah diposting tidak dapat dibatalkan' using errcode = '42501';
  end if;

  if v_opname.status = 'void' then
    raise exception 'Sesi opname sudah dibatalkan' using errcode = '42501';
  end if;

  if length(coalesce(v_reason, '')) < 3 then
    raise exception 'Alasan pembatalan minimal 3 karakter' using errcode = '22023';
  end if;

  perform app.assert_permission('stock_opname_count', 'void');

  update public.stock_opnames
  set status = 'void',
      void_reason = v_reason
  where id = p_opname_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS (Row Level Security)
-- -----------------------------------------------------------------------------
alter table public.stock_opnames enable row level security;
alter table public.stock_opname_items enable row level security;

drop policy if exists stock_opnames_select on public.stock_opnames;
create policy stock_opnames_select on public.stock_opnames
  for select using (branch_id = app.current_branch_id());

drop policy if exists stock_opnames_insert on public.stock_opnames;
create policy stock_opnames_insert on public.stock_opnames
  for insert with check (
    branch_id = app.current_branch_id() and
    app.has_permission('stock_opname_count', 'create')
  );

drop policy if exists stock_opnames_update on public.stock_opnames;
create policy stock_opnames_update on public.stock_opnames
  for update using (
    branch_id = app.current_branch_id() and
    (app.has_permission('stock_opname_count', 'update') or app.has_permission('stock_opname_approve', 'approve'))
  );

drop policy if exists stock_opnames_delete on public.stock_opnames;
create policy stock_opnames_delete on public.stock_opnames
  for delete using (
    branch_id = app.current_branch_id() and
    status = 'draft' and
    app.has_permission('stock_opname_count', 'void')
  );

drop policy if exists stock_opname_items_select on public.stock_opname_items;
create policy stock_opname_items_select on public.stock_opname_items
  for select using (
    exists (
      select 1 from public.stock_opnames o
      where o.id = opname_id and o.branch_id = app.current_branch_id()
    )
  );

drop policy if exists stock_opname_items_insert on public.stock_opname_items;
create policy stock_opname_items_insert on public.stock_opname_items
  for insert with check (
    exists (
      select 1 from public.stock_opnames o
      where o.id = opname_id and o.branch_id = app.current_branch_id()
    ) and app.has_permission('stock_opname_count', 'update')
  );

drop policy if exists stock_opname_items_update on public.stock_opname_items;
create policy stock_opname_items_update on public.stock_opname_items
  for update using (
    exists (
      select 1 from public.stock_opnames o
      where o.id = opname_id and o.branch_id = app.current_branch_id()
    ) and (app.has_permission('stock_opname_count', 'update') or app.has_permission('stock_opname_approve', 'approve'))
  );

drop policy if exists stock_opname_items_delete on public.stock_opname_items;
create policy stock_opname_items_delete on public.stock_opname_items
  for delete using (
    exists (
      select 1 from public.stock_opnames o
      where o.id = opname_id and o.branch_id = app.current_branch_id() and o.status = 'draft'
    ) and app.has_permission('stock_opname_count', 'update')
  );
