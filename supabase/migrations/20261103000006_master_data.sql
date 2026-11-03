-- =============================================================================
-- Master data: kategori, merek, satuan, barang, konversi satuan, part number,
-- kompatibilitas kendaraan, lokasi rak, jasa, paket, riwayat harga (PRD §4, §15.2)
-- Tulis hanya lewat fungsi (izin dicek di database); baca untuk semua karyawan aktif.
-- =============================================================================

create type public.location_type as enum ('area', 'rack', 'bin');
create type public.commission_type as enum ('percent', 'fixed');

-- Kode master berurutan tanpa periode, contoh BRG-00001, JS-001 (pakai number_sequences, period '0000')
create or replace function app.next_master_code(p_prefix text, p_width integer, p_branch_id uuid default null)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := coalesce(p_branch_id, app.current_branch_id());
  v_next   integer;
begin
  insert into public.number_sequences as s (branch_id, doc_type, period, last_number)
  values (v_branch, upper(p_prefix), '0000', 1)
  on conflict (branch_id, doc_type, period) do update set last_number = s.last_number + 1, updated_at = now()
  returning s.last_number into v_next;
  return upper(p_prefix) || '-' || lpad(v_next::text, p_width, '0');
end;
$$;

-- =============================================================================
-- Tabel
-- =============================================================================
create table public.item_categories (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id),
  parent_id  uuid references public.item_categories(id),
  name       text not null check (length(btrim(name)) between 2 and 60),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
create unique index uq_item_categories_name on public.item_categories
  (branch_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

create table public.brands (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id),
  name       text not null check (length(btrim(name)) between 1 and 60),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
create unique index uq_brands_name on public.brands (branch_id, lower(name));

create table public.units (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id),
  code       text not null check (code ~ '^[a-z0-9]{1,10}$'),   -- pcs, liter, set, box
  name       text not null check (length(btrim(name)) between 1 and 40),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (branch_id, code)
);

-- Lokasi bertingkat: Area > Rak > Level/Bin (PRD §4.2)
create table public.locations (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id),
  parent_id  uuid references public.locations(id),
  type       public.location_type not null,
  code       text not null check (code ~ '^[A-Z0-9][A-Z0-9-]{0,19}$'),
  name       text not null check (length(btrim(name)) between 1 and 60),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (branch_id, code)
);

create table public.items (
  id                  uuid primary key default gen_random_uuid(),
  branch_id           uuid not null references public.branches(id),
  sku                 text not null check (sku ~ '^[A-Z0-9][A-Z0-9-]{1,29}$'),
  name                text not null check (length(btrim(name)) between 2 and 120),
  category_id         uuid references public.item_categories(id),
  brand_id            uuid references public.brands(id),
  base_unit_id        uuid not null references public.units(id),
  sell_price          numeric(18,2) not null default 0 check (sell_price >= 0),
  min_stock           numeric(14,3) not null default 0 check (min_stock >= 0),
  default_location_id uuid references public.locations(id),
  warranty_days       integer not null default 0 check (warranty_days between 0 and 3650),
  is_taxable          boolean not null default true,
  photo_path          text,
  notes               text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  created_by          uuid default auth.uid(),
  updated_at          timestamptz not null default now(),
  unique (branch_id, sku)
);
create index idx_items_name on public.items (branch_id, lower(name));

-- Konversi satuan: 1 unit_id = factor × satuan dasar (PRD §4.4)
create table public.item_units (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches(id),
  item_id     uuid not null references public.items(id),
  unit_id     uuid not null references public.units(id),
  factor      numeric(14,3) not null check (factor > 0),
  is_purchase boolean not null default true,
  is_sale     boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now(),
  unique (item_id, unit_id)
);

create table public.item_part_numbers (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches(id),
  item_id     uuid not null references public.items(id),
  part_number text not null check (length(btrim(part_number)) between 2 and 40),
  is_oem      boolean not null default false,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now()
);
create unique index uq_item_part_numbers on public.item_part_numbers (item_id, upper(part_number));
create index idx_item_part_numbers_search on public.item_part_numbers (branch_id, upper(part_number));

-- Kendaraan (dipakai juga modul Pelanggan) & kompatibilitas barang
create table public.vehicle_makes (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id),
  name       text not null check (length(btrim(name)) between 2 and 40),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
create unique index uq_vehicle_makes on public.vehicle_makes (branch_id, lower(name));

create table public.vehicle_models (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id),
  make_id    uuid not null references public.vehicle_makes(id),
  name       text not null check (length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
create unique index uq_vehicle_models on public.vehicle_models (make_id, lower(name));

create table public.item_compatibilities (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id),
  item_id    uuid not null references public.items(id),
  model_id   uuid not null references public.vehicle_models(id),
  year_from  integer check (year_from between 1950 and 2100),
  year_to    integer check (year_to between 1950 and 2100),
  engine     text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  check (year_to is null or year_from is null or year_to >= year_from)
);
create index idx_item_compat_item on public.item_compatibilities (item_id);

-- Jasa (PRD §4.5)
create table public.service_categories (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id),
  name       text not null check (length(btrim(name)) between 2 and 60),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
create unique index uq_service_categories on public.service_categories (branch_id, lower(name));

create table public.services (
  id               uuid primary key default gen_random_uuid(),
  branch_id        uuid not null references public.branches(id),
  code             text not null check (code ~ '^[A-Z0-9][A-Z0-9-]{1,19}$'),
  name             text not null check (length(btrim(name)) between 2 and 120),
  category_id      uuid references public.service_categories(id),
  price            numeric(18,2) not null default 0 check (price >= 0),
  duration_minutes integer not null default 60 check (duration_minutes between 0 and 10080),
  commission_type  public.commission_type not null default 'percent',
  commission_value numeric(18,2) not null default 0 check (commission_value >= 0),
  warranty_days    integer not null default 0 check (warranty_days between 0 and 3650),
  is_taxable       boolean not null default true,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid(),
  updated_at       timestamptz not null default now(),
  unique (branch_id, code),
  check (commission_type <> 'percent' or commission_value <= 100)
);

-- Paket servis (PRD §4.6): komponen barang atau jasa
create table public.packages (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches(id),
  code        text not null check (code ~ '^[A-Z0-9][A-Z0-9-]{1,19}$'),
  name        text not null check (length(btrim(name)) between 2 and 120),
  description text,
  price       numeric(18,2) not null default 0 check (price >= 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now(),
  unique (branch_id, code)
);

create table public.package_items (
  id         uuid primary key default gen_random_uuid(),
  branch_id  uuid not null references public.branches(id),
  package_id uuid not null references public.packages(id),
  item_id    uuid references public.items(id),
  service_id uuid references public.services(id),
  qty        numeric(14,3) not null check (qty > 0),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  check ((item_id is null) <> (service_id is null))
);
create unique index uq_package_items on public.package_items
  (package_id, coalesce(item_id, service_id));

-- Riwayat harga jual (PRD §4.1), diisi trigger
create table public.price_history (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches(id),
  entity_type text not null check (entity_type in ('item', 'service', 'package')),
  entity_id   uuid not null,
  old_price   numeric(18,2),
  new_price   numeric(18,2) not null,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now()
);
create index idx_price_history_entity on public.price_history (entity_type, entity_id, created_at desc);

-- =============================================================================
-- Trigger: updated_at, audit, riwayat harga, tanpa hapus permanen
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array['item_categories', 'brands', 'units', 'locations', 'items', 'item_units',
    'item_part_numbers', 'vehicle_makes', 'vehicle_models', 'item_compatibilities', 'service_categories',
    'services', 'packages', 'package_items'] loop
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$I
                    for each row execute function app.set_updated_at()', t);
    execute format('create trigger trg_audit after insert or update or delete on public.%I
                    for each row execute function app.audit_row_change()', t);
  end loop;
  -- Master dinonaktifkan, bukan dihapus. Tabel relasi (konversi, part number, kompatibilitas,
  -- komponen paket) boleh dihapus lewat fungsi simpan dan tercatat di audit log.
  foreach t in array array['item_categories', 'brands', 'units', 'locations', 'items', 'vehicle_makes',
    'vehicle_models', 'service_categories', 'services', 'packages', 'price_history'] loop
    execute format('create trigger trg_no_delete before delete on public.%I
                    for each row execute function app.prevent_modification()', t);
  end loop;
end $$;

create trigger trg_price_history_immutable before update on public.price_history
  for each row execute function app.prevent_modification();

create or replace function app.record_price_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  -- Kolom harga berbeda per tabel; dibaca lewat jsonb agar satu fungsi untuk ketiganya
  v_col text := case tg_table_name when 'items' then 'sell_price' else 'price' end;
  v_old numeric(18,2) := case when tg_op = 'UPDATE' then (to_jsonb(old) ->> v_col)::numeric end;
  v_new numeric(18,2) := (to_jsonb(new) ->> v_col)::numeric;
begin
  if tg_op = 'INSERT' or v_new is distinct from v_old then
    insert into public.price_history (branch_id, entity_type, entity_id, old_price, new_price)
    values (new.branch_id, case tg_table_name when 'items' then 'item' when 'services' then 'service' else 'package' end,
            new.id, v_old, v_new);
  end if;
  return new;
end;
$$;

create trigger trg_items_price after insert or update of sell_price on public.items
  for each row execute function app.record_price_change();
create trigger trg_services_price after insert or update of price on public.services
  for each row execute function app.record_price_change();
create trigger trg_packages_price after insert or update of price on public.packages
  for each row execute function app.record_price_change();

-- =============================================================================
-- RLS: baca untuk karyawan aktif di cabangnya; tulis hanya lewat fungsi
-- =============================================================================
do $$
declare
  t text;
begin
  foreach t in array array['item_categories', 'brands', 'units', 'locations', 'items', 'item_units',
    'item_part_numbers', 'vehicle_makes', 'vehicle_models', 'item_compatibilities', 'service_categories',
    'services', 'packages', 'package_items', 'price_history'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy %1$s_select on public.%1$I for select to authenticated
                    using (branch_id = app.current_branch_id())', t);
  end loop;
end $$;

-- =============================================================================
-- Fungsi tulis
-- =============================================================================

-- Izin: salah satu cukup
create or replace function app.assert_any_permission(p_checks text[])
returns void
language plpgsql stable security definer
set search_path = ''
as $$
declare
  c text;
begin
  if app.current_employee_id() is null then
    raise exception 'Sesi tidak valid: login sebagai karyawan aktif' using errcode = '42501';
  end if;
  foreach c in array p_checks loop
    if app.has_permission(split_part(c, ':', 1), split_part(c, ':', 2)::public.permission_action) then
      return;
    end if;
  end loop;
  raise exception 'Anda tidak punya izin untuk tindakan ini' using errcode = '42501';
end;
$$;

-- Referensi harus milik cabang & aktif (null boleh)
create or replace function app.assert_ref(p_table text, p_id uuid, p_label text)
returns void
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  if p_id is null then return; end if;
  execute format('select exists (select 1 from public.%I where id = $1 and branch_id = $2 and is_active)', p_table)
    into v_ok using p_id, app.current_branch_id();
  if not v_ok then
    raise exception '% tidak ditemukan atau nonaktif', p_label using errcode = '22023';
  end if;
end;
$$;

create or replace function public.save_item_category(p_id uuid, p_name text, p_parent_id uuid default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform app.assert_permission('master_data', case when p_id is null then 'create' else 'update' end::public.permission_action);
  perform app.assert_ref('item_categories', p_parent_id, 'Kategori induk');
  if p_parent_id is not null then
    if p_parent_id = p_id then
      raise exception 'Kategori tidak bisa menjadi induk dirinya sendiri' using errcode = '22023';
    end if;
    -- Maksimal dua tingkat: kategori > subkategori (PRD §4.1)
    if exists (select 1 from public.item_categories where id = p_parent_id and parent_id is not null)
       or exists (select 1 from public.item_categories where parent_id = p_id) then
      raise exception 'Kategori maksimal dua tingkat (kategori > subkategori)' using errcode = '22023';
    end if;
  end if;
  if p_id is null then
    insert into public.item_categories (branch_id, parent_id, name)
    values (app.current_branch_id(), p_parent_id, btrim(p_name)) returning id into v_id;
  else
    update public.item_categories set name = btrim(p_name), parent_id = p_parent_id
     where id = p_id and branch_id = app.current_branch_id() returning id into v_id;
    if v_id is null then raise exception 'Kategori tidak ditemukan' using errcode = 'P0002'; end if;
  end if;
  return v_id;
exception when unique_violation then
  raise exception 'Nama kategori sudah dipakai' using errcode = '23505';
end;
$$;

create or replace function public.save_brand(p_id uuid, p_name text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform app.assert_permission('master_data', case when p_id is null then 'create' else 'update' end::public.permission_action);
  if p_id is null then
    insert into public.brands (branch_id, name) values (app.current_branch_id(), btrim(p_name)) returning id into v_id;
  else
    update public.brands set name = btrim(p_name) where id = p_id and branch_id = app.current_branch_id() returning id into v_id;
    if v_id is null then raise exception 'Merek tidak ditemukan' using errcode = 'P0002'; end if;
  end if;
  return v_id;
exception when unique_violation then
  raise exception 'Nama merek sudah dipakai' using errcode = '23505';
end;
$$;

create or replace function public.save_unit(p_id uuid, p_code text, p_name text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id   uuid;
  v_code text := lower(btrim(p_code));
begin
  perform app.assert_permission('master_data', case when p_id is null then 'create' else 'update' end::public.permission_action);
  if v_code !~ '^[a-z0-9]{1,10}$' then
    raise exception 'Kode satuan 1–10 huruf kecil/angka, contoh pcs, liter' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.units (branch_id, code, name) values (app.current_branch_id(), v_code, btrim(p_name)) returning id into v_id;
  else
    update public.units set code = v_code, name = btrim(p_name) where id = p_id and branch_id = app.current_branch_id() returning id into v_id;
    if v_id is null then raise exception 'Satuan tidak ditemukan' using errcode = 'P0002'; end if;
  end if;
  return v_id;
exception when unique_violation then
  raise exception 'Kode satuan sudah dipakai' using errcode = '23505';
end;
$$;

create or replace function public.save_location(p_id uuid, p_parent_id uuid, p_type public.location_type, p_code text, p_name text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id          uuid;
  v_code        text := upper(btrim(p_code));
  v_parent_type public.location_type;
begin
  perform app.assert_permission('master_data', case when p_id is null then 'create' else 'update' end::public.permission_action);
  if v_code !~ '^[A-Z0-9][A-Z0-9-]{0,19}$' then
    raise exception 'Kode lokasi hanya huruf, angka, dan tanda minus (maks. 20)' using errcode = '22023';
  end if;
  perform app.assert_ref('locations', p_parent_id, 'Lokasi induk');
  select type into v_parent_type from public.locations where id = p_parent_id;
  -- Area > Rak > Bin
  if (p_type = 'area' and p_parent_id is not null)
     or (p_type = 'rack' and v_parent_type is distinct from 'area')
     or (p_type = 'bin' and v_parent_type is distinct from 'rack') then
    raise exception 'Struktur lokasi: Area > Rak > Level/Bin' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.locations (branch_id, parent_id, type, code, name)
    values (app.current_branch_id(), p_parent_id, p_type, v_code, btrim(p_name)) returning id into v_id;
  else
    update public.locations set parent_id = p_parent_id, type = p_type, code = v_code, name = btrim(p_name)
     where id = p_id and branch_id = app.current_branch_id() returning id into v_id;
    if v_id is null then raise exception 'Lokasi tidak ditemukan' using errcode = 'P0002'; end if;
  end if;
  return v_id;
exception when unique_violation then
  raise exception 'Kode lokasi sudah dipakai' using errcode = '23505';
end;
$$;

create or replace function public.save_service_category(p_id uuid, p_name text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform app.assert_permission('master_data', case when p_id is null then 'create' else 'update' end::public.permission_action);
  if p_id is null then
    insert into public.service_categories (branch_id, name) values (app.current_branch_id(), btrim(p_name)) returning id into v_id;
  else
    update public.service_categories set name = btrim(p_name) where id = p_id and branch_id = app.current_branch_id() returning id into v_id;
    if v_id is null then raise exception 'Kategori jasa tidak ditemukan' using errcode = 'P0002'; end if;
  end if;
  return v_id;
exception when unique_violation then
  raise exception 'Nama kategori jasa sudah dipakai' using errcode = '23505';
end;
$$;

-- Aktif/nonaktif master (tabel dalam daftar putih)
create or replace function public.set_master_active(p_table text, p_id uuid, p_active boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_found boolean;
begin
  if p_table not in ('item_categories', 'brands', 'units', 'locations', 'items', 'service_categories', 'services', 'packages') then
    raise exception 'Tabel tidak dikenal' using errcode = '22023';
  end if;
  perform app.assert_permission('master_data', 'update');
  execute format('update public.%I set is_active = $1 where id = $2 and branch_id = $3 returning true', p_table)
    into v_found using p_active, p_id, app.current_branch_id();
  if v_found is null then raise exception 'Data tidak ditemukan' using errcode = 'P0002'; end if;
end;
$$;

-- Ubah harga jual butuh izin price_change (PRD §16); dipakai save_item/save_service/save_package
create or replace function app.assert_price_change(p_old numeric, p_new numeric)
returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if p_new is distinct from p_old and coalesce(p_new, 0) <> 0 and not app.has_permission('price_change', 'create') then
    raise exception 'Anda tidak punya izin mengubah harga jual' using errcode = '42501';
  end if;
end;
$$;

-- Barang beserta konversi satuan & part number dalam satu transaksi.
-- p_data: sku (opsional, otomatis BRG-00001), name, category_id, brand_id, base_unit_id, sell_price,
--         min_stock, default_location_id, warranty_days, is_taxable, notes
-- p_units: [{unit_id, factor, is_purchase, is_sale}]   p_part_numbers: [{part_number, is_oem}]
create or replace function public.save_item(p_id uuid, p_data jsonb, p_units jsonb default '[]', p_part_numbers jsonb default '[]')
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_old    public.items%rowtype;
  v_id     uuid;
  v_sku    text := nullif(upper(btrim(p_data ->> 'sku')), '');
  v_base   uuid := (p_data ->> 'base_unit_id')::uuid;
  v_price  numeric(18,2) := coalesce(nullif(p_data ->> 'sell_price', '')::numeric, 0);
begin
  perform app.assert_permission('master_data', case when p_id is null then 'create' else 'update' end::public.permission_action);
  if v_base is null then raise exception 'Satuan dasar wajib dipilih' using errcode = '22023'; end if;
  perform app.assert_ref('units', v_base, 'Satuan dasar');
  perform app.assert_ref('item_categories', nullif(p_data ->> 'category_id', '')::uuid, 'Kategori');
  perform app.assert_ref('brands', nullif(p_data ->> 'brand_id', '')::uuid, 'Merek');
  perform app.assert_ref('locations', nullif(p_data ->> 'default_location_id', '')::uuid, 'Lokasi default');
  if v_sku is not null and v_sku !~ '^[A-Z0-9][A-Z0-9-]{1,29}$' then
    raise exception 'SKU hanya huruf, angka, dan tanda minus (2–30)' using errcode = '22023';
  end if;

  if p_id is not null then
    select * into v_old from public.items where id = p_id and branch_id = v_branch for update;
    if not found then raise exception 'Barang tidak ditemukan' using errcode = 'P0002'; end if;
    -- Stok tersimpan dalam satuan dasar; mengganti satuan dasar setelah ada mutasi merusak riwayat
    if v_base <> v_old.base_unit_id and exists (select 1 from public.stock_movements where item_id = p_id) then
      raise exception 'Satuan dasar tidak bisa diganti karena barang sudah punya mutasi stok' using errcode = '22023';
    end if;
  end if;
  perform app.assert_price_change(v_old.sell_price, v_price);

  if p_id is null then
    insert into public.items (branch_id, sku, name, category_id, brand_id, base_unit_id, sell_price, min_stock,
                              default_location_id, warranty_days, is_taxable, notes)
    values (v_branch, coalesce(v_sku, app.next_master_code('BRG', 5)), btrim(p_data ->> 'name'),
            nullif(p_data ->> 'category_id', '')::uuid, nullif(p_data ->> 'brand_id', '')::uuid, v_base, v_price,
            coalesce(nullif(p_data ->> 'min_stock', '')::numeric, 0), nullif(p_data ->> 'default_location_id', '')::uuid,
            coalesce(nullif(p_data ->> 'warranty_days', '')::int, 0), coalesce((p_data ->> 'is_taxable')::boolean, true),
            nullif(btrim(p_data ->> 'notes'), ''))
    returning id into v_id;
  else
    update public.items
       set sku = coalesce(v_sku, sku), name = btrim(p_data ->> 'name'),
           category_id = nullif(p_data ->> 'category_id', '')::uuid, brand_id = nullif(p_data ->> 'brand_id', '')::uuid,
           base_unit_id = v_base, sell_price = v_price,
           min_stock = coalesce(nullif(p_data ->> 'min_stock', '')::numeric, 0),
           default_location_id = nullif(p_data ->> 'default_location_id', '')::uuid,
           warranty_days = coalesce(nullif(p_data ->> 'warranty_days', '')::int, 0),
           is_taxable = coalesce((p_data ->> 'is_taxable')::boolean, true),
           notes = nullif(btrim(p_data ->> 'notes'), '')
     where id = p_id
    returning id into v_id;
  end if;

  -- Konversi satuan (tanpa satuan dasar; faktor > 0; satuan aktif)
  if exists (select 1 from jsonb_array_elements(coalesce(p_units, '[]')) u
             where (u ->> 'unit_id')::uuid = v_base) then
    raise exception 'Satuan dasar tidak perlu ditambahkan di konversi' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_units, '[]')) u
             left join public.units un on un.id = (u ->> 'unit_id')::uuid and un.branch_id = v_branch and un.is_active
             where un.id is null or coalesce((u ->> 'factor')::numeric, 0) <= 0) then
    raise exception 'Konversi satuan tidak valid (satuan aktif & faktor > 0)' using errcode = '22023';
  end if;
  delete from public.item_units iu
   where iu.item_id = v_id
     and not exists (select 1 from jsonb_array_elements(coalesce(p_units, '[]')) u where (u ->> 'unit_id')::uuid = iu.unit_id);
  insert into public.item_units (branch_id, item_id, unit_id, factor, is_purchase, is_sale)
  select v_branch, v_id, (u ->> 'unit_id')::uuid, (u ->> 'factor')::numeric,
         coalesce((u ->> 'is_purchase')::boolean, true), coalesce((u ->> 'is_sale')::boolean, false)
  from jsonb_array_elements(coalesce(p_units, '[]')) u
  on conflict (item_id, unit_id) do update
    set factor = excluded.factor, is_purchase = excluded.is_purchase, is_sale = excluded.is_sale
    where (public.item_units.factor, public.item_units.is_purchase, public.item_units.is_sale)
          is distinct from (excluded.factor, excluded.is_purchase, excluded.is_sale);

  -- Part number (OEM & alternatif)
  delete from public.item_part_numbers pn
   where pn.item_id = v_id
     and not exists (select 1 from jsonb_array_elements(coalesce(p_part_numbers, '[]')) p
                     where upper(btrim(p ->> 'part_number')) = upper(pn.part_number));
  insert into public.item_part_numbers (branch_id, item_id, part_number, is_oem)
  select v_branch, v_id, upper(btrim(p ->> 'part_number')), coalesce((p ->> 'is_oem')::boolean, false)
  from jsonb_array_elements(coalesce(p_part_numbers, '[]')) p
  where nullif(btrim(p ->> 'part_number'), '') is not null
  on conflict (item_id, upper(part_number)) do update set is_oem = excluded.is_oem
    where public.item_part_numbers.is_oem is distinct from excluded.is_oem;

  return v_id;
exception when unique_violation then
  raise exception 'SKU atau part number sudah dipakai' using errcode = '23505';
end;
$$;

-- Jasa. p_data: code (opsional, otomatis JS-001), name, category_id, price, duration_minutes,
--               commission_type, commission_value, warranty_days, is_taxable
create or replace function public.save_service(p_id uuid, p_data jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_old    public.services%rowtype;
  v_id     uuid;
  v_code   text := nullif(upper(btrim(p_data ->> 'code')), '');
  v_price  numeric(18,2) := coalesce(nullif(p_data ->> 'price', '')::numeric, 0);
begin
  perform app.assert_permission('master_data', case when p_id is null then 'create' else 'update' end::public.permission_action);
  perform app.assert_ref('service_categories', nullif(p_data ->> 'category_id', '')::uuid, 'Kategori jasa');
  if p_id is not null then
    select * into v_old from public.services where id = p_id and branch_id = v_branch for update;
    if not found then raise exception 'Jasa tidak ditemukan' using errcode = 'P0002'; end if;
  end if;
  perform app.assert_price_change(v_old.price, v_price);

  if p_id is null then
    insert into public.services (branch_id, code, name, category_id, price, duration_minutes, commission_type,
                                 commission_value, warranty_days, is_taxable)
    values (v_branch, coalesce(v_code, app.next_master_code('JS', 3)), btrim(p_data ->> 'name'),
            nullif(p_data ->> 'category_id', '')::uuid, v_price,
            coalesce(nullif(p_data ->> 'duration_minutes', '')::int, 60),
            coalesce(nullif(p_data ->> 'commission_type', '')::public.commission_type, 'percent'),
            coalesce(nullif(p_data ->> 'commission_value', '')::numeric, 0),
            coalesce(nullif(p_data ->> 'warranty_days', '')::int, 0), coalesce((p_data ->> 'is_taxable')::boolean, true))
    returning id into v_id;
  else
    update public.services
       set code = coalesce(v_code, code), name = btrim(p_data ->> 'name'),
           category_id = nullif(p_data ->> 'category_id', '')::uuid, price = v_price,
           duration_minutes = coalesce(nullif(p_data ->> 'duration_minutes', '')::int, 60),
           commission_type = coalesce(nullif(p_data ->> 'commission_type', '')::public.commission_type, 'percent'),
           commission_value = coalesce(nullif(p_data ->> 'commission_value', '')::numeric, 0),
           warranty_days = coalesce(nullif(p_data ->> 'warranty_days', '')::int, 0),
           is_taxable = coalesce((p_data ->> 'is_taxable')::boolean, true)
     where id = p_id
    returning id into v_id;
  end if;
  return v_id;
exception when unique_violation then
  raise exception 'Kode jasa sudah dipakai' using errcode = '23505';
end;
$$;

-- Paket. p_data: code (opsional, otomatis PKT-001), name, description, price
-- p_items: [{item_id | service_id, qty}]
create or replace function public.save_package(p_id uuid, p_data jsonb, p_items jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_old    public.packages%rowtype;
  v_id     uuid;
  v_code   text := nullif(upper(btrim(p_data ->> 'code')), '');
  v_price  numeric(18,2) := coalesce(nullif(p_data ->> 'price', '')::numeric, 0);
begin
  perform app.assert_permission('master_data', case when p_id is null then 'create' else 'update' end::public.permission_action);
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then
    raise exception 'Paket minimal berisi satu komponen' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) x
    left join public.items i on i.id = nullif(x ->> 'item_id', '')::uuid and i.branch_id = v_branch and i.is_active
    left join public.services s on s.id = nullif(x ->> 'service_id', '')::uuid and s.branch_id = v_branch and s.is_active
    where ((x ->> 'item_id') is null) = ((x ->> 'service_id') is null)
       or (i.id is null and s.id is null)
       or coalesce(nullif(x ->> 'qty', '')::numeric, 0) <= 0
  ) then
    raise exception 'Komponen paket tidak valid (barang/jasa aktif & jumlah > 0)' using errcode = '22023';
  end if;
  if p_id is not null then
    select * into v_old from public.packages where id = p_id and branch_id = v_branch for update;
    if not found then raise exception 'Paket tidak ditemukan' using errcode = 'P0002'; end if;
  end if;
  perform app.assert_price_change(v_old.price, v_price);

  if p_id is null then
    insert into public.packages (branch_id, code, name, description, price)
    values (v_branch, coalesce(v_code, app.next_master_code('PKT', 3)), btrim(p_data ->> 'name'),
            nullif(btrim(p_data ->> 'description'), ''), v_price)
    returning id into v_id;
  else
    update public.packages set code = coalesce(v_code, code), name = btrim(p_data ->> 'name'),
           description = nullif(btrim(p_data ->> 'description'), ''), price = v_price
     where id = p_id returning id into v_id;
  end if;

  delete from public.package_items pi
   where pi.package_id = v_id
     and not exists (select 1 from jsonb_array_elements(p_items) x
                     where coalesce(nullif(x ->> 'item_id', ''), x ->> 'service_id')::uuid = coalesce(pi.item_id, pi.service_id));
  insert into public.package_items (branch_id, package_id, item_id, service_id, qty)
  select v_branch, v_id, nullif(x ->> 'item_id', '')::uuid, nullif(x ->> 'service_id', '')::uuid, (x ->> 'qty')::numeric
  from jsonb_array_elements(p_items) x
  on conflict (package_id, coalesce(item_id, service_id)) do update set qty = excluded.qty
    where public.package_items.qty is distinct from excluded.qty;
  return v_id;
exception when unique_violation then
  raise exception 'Kode paket sudah dipakai' using errcode = '23505';
end;
$$;

-- Komponen paket + alokasi harga proporsional terhadap harga normal (PRD §4.6).
-- Sisa pembulatan dibebankan ke komponen termahal agar total = harga paket.
create or replace function public.package_components(p_package_id uuid)
returns table (item_id uuid, service_id uuid, name text, qty numeric, normal_price numeric, allocated_price numeric)
language sql stable security definer
set search_path = ''
as $$
  with pkg as (
    select id, price from public.packages where id = p_package_id and branch_id = app.current_branch_id()
  ), lines as (
    select pi.item_id, pi.service_id, coalesce(i.name, s.name) as name, pi.qty,
           round(pi.qty * coalesce(i.sell_price, s.price), 2) as normal_price
    from public.package_items pi
    join pkg on pkg.id = pi.package_id
    left join public.items i on i.id = pi.item_id
    left join public.services s on s.id = pi.service_id
  ), totals as (
    select sum(normal_price) as total, count(*) as n from lines
  ), alloc as (
    select l.*,
           case when t.total > 0 then round((select price from pkg) * l.normal_price / t.total, 2)
                else round((select price from pkg) / t.n, 2) end as raw_alloc,
           row_number() over (order by l.normal_price desc, l.name) as rn
    from lines l cross join totals t
  )
  select a.item_id, a.service_id, a.name, a.qty, a.normal_price,
         a.raw_alloc + case when a.rn = 1 then (select price from pkg) - (select sum(raw_alloc) from alloc) else 0 end
  from alloc a
  order by a.rn
$$;

-- =============================================================================
-- Data awal: satuan umum, kategori jasa, area gudang
-- =============================================================================
insert into public.units (branch_id, code, name)
select b.id, u.code, u.name from public.branches b,
  (values ('pcs', 'Pcs'), ('set', 'Set'), ('liter', 'Liter'), ('botol', 'Botol'), ('box', 'Box'),
          ('galon', 'Galon'), ('meter', 'Meter'), ('kaleng', 'Kaleng')) as u(code, name)
where b.code = 'PST';

insert into public.service_categories (branch_id, name)
select b.id, c.name from public.branches b,
  (values ('Servis berkala'), ('Mesin'), ('Kaki-kaki'), ('Kelistrikan'), ('AC'), ('Body & cat')) as c(name)
where b.code = 'PST';

insert into public.locations (branch_id, type, code, name)
select id, 'area', 'GDG', 'Gudang Utama' from public.branches where code = 'PST';

-- =============================================================================
-- Hak eksekusi
-- =============================================================================
revoke all on function app.next_master_code(text, integer, uuid), app.assert_any_permission(text[]),
  app.assert_ref(text, uuid, text), app.assert_price_change(numeric, numeric) from public, anon, authenticated;

revoke all on function
  public.save_item_category(uuid, text, uuid), public.save_brand(uuid, text), public.save_unit(uuid, text, text),
  public.save_location(uuid, uuid, public.location_type, text, text), public.save_service_category(uuid, text),
  public.set_master_active(text, uuid, boolean), public.save_item(uuid, jsonb, jsonb, jsonb),
  public.save_service(uuid, jsonb), public.save_package(uuid, jsonb, jsonb), public.package_components(uuid)
from public, anon;
grant execute on function
  public.save_item_category(uuid, text, uuid), public.save_brand(uuid, text), public.save_unit(uuid, text, text),
  public.save_location(uuid, uuid, public.location_type, text, text), public.save_service_category(uuid, text),
  public.set_master_active(text, uuid, boolean), public.save_item(uuid, jsonb, jsonb, jsonb),
  public.save_service(uuid, jsonb), public.save_package(uuid, jsonb, jsonb), public.package_components(uuid)
to authenticated;
