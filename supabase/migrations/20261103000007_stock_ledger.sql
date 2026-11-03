-- =============================================================================
-- Ledger stok & HPP rata-rata tertimbang (PRD §4.7, aturan teknis #1, #5, #9)
-- Stok = jumlah stock_movements (append-only). stock_balances hanya cache yang diperbarui
-- di transaksi yang sama oleh app.post_stock_movement(), satu-satunya jalur penulisan.
-- HPP (avg_cost) disimpan di item_costs dan hanya terbaca oleh izin laporan keuangan (PRD §10.2).
-- =============================================================================

create type public.stock_movement_type as enum (
  'opening',           -- saldo awal (go-live)
  'purchase',          -- penerimaan barang
  'sales_return',      -- retur dari pelanggan
  'sale',              -- penjualan langsung
  'service_usage',     -- pemakaian part di work order
  'purchase_return',   -- retur ke supplier
  'opname_adjustment', -- hasil stok opname disetujui (masuk/keluar)
  'transfer_out',      -- pindah lokasi: keluar
  'transfer_in'        -- pindah lokasi: masuk
);

create table public.stock_movements (
  id                uuid primary key default gen_random_uuid(),
  branch_id         uuid not null references public.branches(id),
  item_id           uuid not null references public.items(id),
  location_id       uuid not null references public.locations(id),
  movement_type     public.stock_movement_type not null,
  qty               numeric(14,3) not null check (qty <> 0),          -- satuan dasar; + masuk, − keluar
  unit_cost         numeric(18,2) not null check (unit_cost >= 0),    -- HPP per satuan dasar saat mutasi
  source_type       text,                                             -- dokumen asal, mis. goods_receipt
  source_id         uuid,
  transfer_group_id uuid,                                             -- pasangan keluar+masuk pindah lokasi
  note              text,
  created_at        timestamptz not null default now(),
  created_by        uuid default auth.uid(),
  updated_at        timestamptz not null default now()
);
create index idx_stock_movements_item on public.stock_movements (item_id, created_at desc);
create index idx_stock_movements_location on public.stock_movements (location_id, created_at desc);
create index idx_stock_movements_source on public.stock_movements (source_type, source_id);

create trigger trg_stock_movements_immutable before update or delete on public.stock_movements
  for each row execute function app.prevent_modification();
create trigger trg_stock_movements_no_truncate before truncate on public.stock_movements
  for each statement execute function app.prevent_modification();
create trigger trg_audit after insert on public.stock_movements
  for each row execute function app.audit_row_change();

create table public.stock_balances (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches(id),
  item_id     uuid not null references public.items(id),
  location_id uuid not null references public.locations(id),
  qty         numeric(14,3) not null default 0,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now(),
  unique (item_id, location_id)
);
create index idx_stock_balances_location on public.stock_balances (location_id);
create trigger trg_stock_balances_updated_at before update on public.stock_balances
  for each row execute function app.set_updated_at();

create table public.item_costs (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id),
  item_id    uuid not null unique references public.items(id),
  avg_cost   numeric(18,2) not null default 0 check (avg_cost >= 0),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
create trigger trg_item_costs_updated_at before update on public.item_costs
  for each row execute function app.set_updated_at();
create trigger trg_audit after insert or update on public.item_costs
  for each row execute function app.audit_row_change();

-- Setiap barang punya baris HPP (dibuat otomatis); baris ini juga dipakai sebagai kunci per barang
create or replace function app.on_item_insert_cost()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.item_costs (branch_id, item_id) values (new.branch_id, new.id);
  return new;
end;
$$;
create trigger trg_items_cost after insert on public.items
  for each row execute function app.on_item_insert_cost();

-- =============================================================================
-- Inti: satu-satunya jalur menulis stok. Dipanggil fungsi modul (penerimaan, penjualan, WO,
-- opname, pindah lokasi) di dalam transaksinya, sehingga stok + dokumen + jurnal atomik.
-- p_qty bertanda: + masuk, − keluar (satuan dasar).
-- p_unit_cost: wajib untuk masuk yang membawa nilai baru (opening, purchase, sales_return);
--              diabaikan untuk keluar & pindah (pakai HPP rata-rata saat itu).
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
  if (p_type in ('opening', 'purchase', 'sales_return', 'transfer_in') and p_qty < 0)
     or (p_type in ('sale', 'service_usage', 'purchase_return', 'transfer_out') and p_qty > 0) then
    raise exception 'Arah jumlah tidak sesuai tipe mutasi %', p_type using errcode = '22023';
  end if;

  -- Kunci per barang: HPP & saldo konsisten walau ada transaksi bersamaan
  select avg_cost into v_avg from public.item_costs where item_id = p_item_id for update;
  select coalesce(sum(qty), 0) into v_on_hand from public.stock_balances where item_id = p_item_id;

  if p_type in ('opening', 'purchase', 'sales_return') then
    if p_unit_cost is null or p_unit_cost < 0 then
      raise exception 'Harga pokok per satuan wajib diisi untuk mutasi masuk' using errcode = '22023';
    end if;
    v_cost := round(p_unit_cost, 2);
    -- Rata-rata tertimbang; jika stok sebelumnya ≤ 0, HPP mengikuti harga masuk terbaru
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

revoke all on function app.post_stock_movement(uuid, uuid, public.stock_movement_type, numeric, numeric, text, uuid, text, uuid)
  from public, anon, authenticated;

-- Saldo awal saat go-live: hanya Owner (sebelum modul pembelian dipakai)
create or replace function public.post_opening_stock(p_item_id uuid, p_location_id uuid, p_qty numeric, p_unit_cost numeric, p_note text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
begin
  if not app.is_superuser() then
    raise exception 'Hanya Owner yang boleh mengisi saldo awal stok' using errcode = '42501';
  end if;
  if not exists (select 1 from public.items where id = p_item_id and branch_id = app.current_branch_id()) then
    raise exception 'Barang tidak ditemukan' using errcode = 'P0002';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'Jumlah saldo awal harus lebih dari nol' using errcode = '22023';
  end if;
  return app.post_stock_movement(p_item_id, p_location_id, 'opening', p_qty, p_unit_cost, 'opening', null,
                                 coalesce(nullif(btrim(p_note), ''), 'Saldo awal'));
end;
$$;

-- Pindah lokasi: keluar + masuk berpasangan, total stok tetap (PRD §4.2)
create or replace function public.transfer_stock(p_item_id uuid, p_from uuid, p_to uuid, p_qty numeric, p_note text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_group uuid := gen_random_uuid();
begin
  perform app.assert_any_permission(array['master_data:update', 'stock_opname_count:update']);
  if not exists (select 1 from public.items where id = p_item_id and branch_id = app.current_branch_id()) then
    raise exception 'Barang tidak ditemukan' using errcode = 'P0002';
  end if;
  perform app.assert_ref('locations', p_to, 'Lokasi tujuan');
  if p_from = p_to then raise exception 'Lokasi asal dan tujuan sama' using errcode = '22023'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Jumlah pindah harus lebih dari nol' using errcode = '22023'; end if;

  perform app.post_stock_movement(p_item_id, p_from, 'transfer_out', -p_qty, null, 'transfer', v_group, p_note, v_group);
  perform app.post_stock_movement(p_item_id, p_to, 'transfer_in', p_qty, null, 'transfer', v_group, p_note, v_group);
  return v_group;
end;
$$;

-- =============================================================================
-- View (security_invoker: tunduk pada RLS pemanggil)
-- =============================================================================
create view public.v_stock_on_hand with (security_invoker = true) as
  select i.id as item_id, i.branch_id, i.sku, i.name, i.min_stock, i.is_active,
         coalesce(sum(b.qty), 0)::numeric(14,3) as qty
  from public.items i
  left join public.stock_balances b on b.item_id = i.id
  group by i.id;

create view public.v_low_stock with (security_invoker = true) as
  select * from public.v_stock_on_hand where is_active and min_stock > 0 and qty <= min_stock;

-- =============================================================================
-- RLS & hak akses
-- =============================================================================
alter table public.stock_movements enable row level security;
alter table public.stock_balances  enable row level security;
alter table public.item_costs      enable row level security;

revoke all on public.stock_movements, public.stock_balances, public.item_costs from anon;
revoke insert, update, delete, truncate on public.stock_movements, public.stock_balances, public.item_costs from authenticated;

-- Mutasi & saldo: semua karyawan aktif cabang boleh melihat jumlah stok.
-- Nilai (unit_cost) adalah data HPP: kolomnya tidak diberikan ke authenticated.
revoke select on public.stock_movements from authenticated;
grant select (id, branch_id, item_id, location_id, movement_type, qty, source_type, source_id,
              transfer_group_id, note, created_at, created_by, updated_at)
  on public.stock_movements to authenticated;
grant select on public.stock_balances to authenticated;
grant select on public.v_stock_on_hand, public.v_low_stock to authenticated;
grant select on public.item_costs to authenticated;

create policy stock_movements_select on public.stock_movements for select to authenticated
  using (branch_id = app.current_branch_id());
create policy stock_balances_select on public.stock_balances for select to authenticated
  using (branch_id = app.current_branch_id());
create policy item_costs_select on public.item_costs for select to authenticated
  using (branch_id = app.current_branch_id() and app.has_permission('finance_reports', 'view'));

revoke all on function public.post_opening_stock(uuid, uuid, numeric, numeric, text),
  public.transfer_stock(uuid, uuid, uuid, numeric, text) from public, anon;
grant execute on function public.post_opening_stock(uuid, uuid, numeric, numeric, text),
  public.transfer_stock(uuid, uuid, uuid, numeric, text) to authenticated;
