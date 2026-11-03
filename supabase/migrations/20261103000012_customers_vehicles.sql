-- =============================================================================
-- Pelanggan & kendaraan (PRD §6.1-6.2)
-- Satu pelanggan punya banyak kendaraan; kendaraan bisa pindah pemilik tanpa kehilangan riwayat
-- (vehicle_ownerships). Riwayat servis & reminder menyusul bersama modul Servis.
-- =============================================================================

create type public.customer_type as enum ('individual', 'company');
create type public.transmission_type as enum ('manual', 'automatic', 'cvt', 'other');
create type public.fuel_type as enum ('gasoline', 'diesel', 'hybrid', 'electric', 'other');

create table public.customers (
  id                 uuid primary key default gen_random_uuid(),
  branch_id          uuid not null references public.branches(id),
  code               text not null,
  type               public.customer_type not null default 'individual',
  name               text not null check (length(btrim(name)) between 2 and 120),
  phone              text,
  email              text,
  address            text,
  npwp               text,
  credit_limit       numeric(18,2) not null default 0 check (credit_limit >= 0),   -- khusus perusahaan
  payment_terms_days integer not null default 0 check (payment_terms_days between 0 and 365),
  notes              text,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  created_by         uuid default auth.uid(),
  updated_at         timestamptz not null default now(),
  unique (branch_id, code)
);
create index idx_customers_phone on public.customers (branch_id, phone);
create index idx_customers_name on public.customers (branch_id, lower(name));

create table public.vehicles (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references public.branches(id),
  plate_no      text not null,                       -- tampilan: "B 1234 KJT"
  model_id      uuid references public.vehicle_models(id),
  variant       text,
  year          integer check (year between 1950 and 2100),
  color         text,
  transmission  public.transmission_type,
  fuel          public.fuel_type,
  vin           text,                                -- nomor rangka
  engine_no     text,
  last_odometer integer check (last_odometer >= 0),  -- diperbarui otomatis oleh work order
  notes         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  updated_at    timestamptz not null default now()
);
-- Plat unik tanpa memedulikan spasi
create unique index uq_vehicles_plate on public.vehicles (branch_id, regexp_replace(plate_no, '\s', '', 'g'));

create table public.vehicle_ownerships (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches(id),
  vehicle_id  uuid not null references public.vehicles(id),
  customer_id uuid not null references public.customers(id),
  started_at  date not null default app.today_wib(),
  ended_at    date,
  note        text,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
-- Satu pemilik aktif per kendaraan
create unique index uq_vehicle_current_owner on public.vehicle_ownerships (vehicle_id) where ended_at is null;
create index idx_vehicle_ownerships_customer on public.vehicle_ownerships (customer_id);

do $$
declare
  t text;
begin
  foreach t in array array['customers', 'vehicles', 'vehicle_ownerships'] loop
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
                    using (branch_id = app.current_branch_id() and app.has_permission(''customers'', ''view''))', t);
  end loop;
end $$;

-- Kendaraan + pemilik saat ini (tunduk RLS pemanggil)
create view public.v_vehicles with (security_invoker = true) as
  select v.id, v.branch_id, v.plate_no, regexp_replace(v.plate_no, '\s', '', 'g') as plate_key,
         v.model_id, mk.name as make_name, md.name as model_name, v.variant, v.year, v.color,
         v.transmission, v.fuel, v.vin, v.engine_no, v.last_odometer, v.notes, v.is_active,
         o.customer_id, c.name as customer_name, c.phone as customer_phone, o.started_at as owned_since
  from public.vehicles v
  left join public.vehicle_models md on md.id = v.model_id
  left join public.vehicle_makes mk on mk.id = md.make_id
  left join public.vehicle_ownerships o on o.vehicle_id = v.id and o.ended_at is null
  left join public.customers c on c.id = o.customer_id;
grant select on public.v_vehicles to authenticated;

-- =============================================================================
-- Helper
-- =============================================================================
create or replace function app.normalize_phone(p text)
returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v text := nullif(regexp_replace(coalesce(p, ''), '[\s().-]', '', 'g'), '');
begin
  if v is null then return null; end if;
  if v !~ '^(\+62|62|0)8[0-9]{7,12}$' then
    raise exception 'Nomor HP/WhatsApp tidak valid (contoh 0812xxxxxxx)' using errcode = '22023';
  end if;
  return '0' || regexp_replace(v, '^(\+62|62|0)', '');   -- simpan seragam: 08xxxxxxxx
end;
$$;

-- Plat nomor Indonesia: "B 1234 KJT" (huruf wilayah, angka, huruf akhir opsional)
create or replace function app.normalize_plate(p text)
returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v text := upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'));
  m text[];
begin
  m := regexp_match(v, '^([A-Z]{1,2})([0-9]{1,4})([A-Z]{0,3})$');
  if m is null then
    raise exception 'Nomor polisi tidak valid (contoh B 1234 KJT)' using errcode = '22023';
  end if;
  return btrim(m[1] || ' ' || m[2] || ' ' || m[3]);
end;
$$;

-- Merek & model dari teks bebas: pakai yang ada (tanpa beda huruf besar), buat jika belum ada
create or replace function app.resolve_vehicle_model(p_make text, p_model text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_make   uuid;
  v_model  uuid;
begin
  if nullif(btrim(p_make), '') is null or nullif(btrim(p_model), '') is null then
    return null;
  end if;
  select id into v_make from public.vehicle_makes where branch_id = v_branch and lower(name) = lower(btrim(p_make));
  if v_make is null then
    insert into public.vehicle_makes (branch_id, name) values (v_branch, initcap(btrim(p_make))) returning id into v_make;
  end if;
  select id into v_model from public.vehicle_models where make_id = v_make and lower(name) = lower(btrim(p_model));
  if v_model is null then
    insert into public.vehicle_models (branch_id, make_id, name) values (v_branch, v_make, btrim(p_model)) returning id into v_model;
  end if;
  return v_model;
end;
$$;

revoke all on function app.normalize_phone(text), app.normalize_plate(text), app.resolve_vehicle_model(text, text)
  from public, anon, authenticated;

-- =============================================================================
-- Pelanggan. p_data: type, name, phone, email, address, npwp, credit_limit, payment_terms_days, notes
-- =============================================================================
create or replace function public.save_customer(p_id uuid, p_data jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_type   public.customer_type := coalesce(nullif(p_data ->> 'type', '')::public.customer_type, 'individual');
  v_phone  text := app.normalize_phone(p_data ->> 'phone');
  v_limit  numeric(18,2) := case when v_type = 'company' then coalesce(nullif(p_data ->> 'credit_limit', '')::numeric, 0) else 0 end;
  v_terms  integer := case when v_type = 'company' then coalesce(nullif(p_data ->> 'payment_terms_days', '')::int, 0) else 0 end;
  v_id     uuid;
begin
  perform app.assert_permission('customers', case when p_id is null then 'create' else 'update' end::public.permission_action);
  if length(btrim(coalesce(p_data ->> 'name', ''))) < 2 then
    raise exception 'Nama pelanggan minimal 2 karakter' using errcode = '22023';
  end if;
  if v_limit < 0 or v_terms < 0 or v_terms > 365 then
    raise exception 'Batas kredit / termin tidak valid' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.customers (branch_id, code, type, name, phone, email, address, npwp, credit_limit, payment_terms_days, notes)
    values (v_branch, app.next_master_code('CUS', 5), v_type, btrim(p_data ->> 'name'), v_phone,
            nullif(lower(btrim(p_data ->> 'email')), ''), nullif(btrim(p_data ->> 'address'), ''),
            nullif(btrim(p_data ->> 'npwp'), ''), v_limit, v_terms, nullif(btrim(p_data ->> 'notes'), ''))
    returning id into v_id;
  else
    update public.customers
       set type = v_type, name = btrim(p_data ->> 'name'), phone = v_phone,
           email = nullif(lower(btrim(p_data ->> 'email')), ''), address = nullif(btrim(p_data ->> 'address'), ''),
           npwp = nullif(btrim(p_data ->> 'npwp'), ''), credit_limit = v_limit, payment_terms_days = v_terms,
           notes = nullif(btrim(p_data ->> 'notes'), '')
     where id = p_id and branch_id = v_branch
    returning id into v_id;
    if v_id is null then raise exception 'Pelanggan tidak ditemukan' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.set_customer_active(p_id uuid, p_active boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform app.assert_permission('customers', 'update');
  update public.customers set is_active = p_active where id = p_id and branch_id = app.current_branch_id();
  if not found then raise exception 'Pelanggan tidak ditemukan' using errcode = 'P0002'; end if;
end;
$$;

-- =============================================================================
-- Kendaraan. p_data: plate_no, make, model, variant, year, color, transmission, fuel, vin, engine_no,
--                    last_odometer, notes
-- p_owner_id: wajib saat membuat kendaraan baru (pemilik pertama)
-- =============================================================================
create or replace function public.save_vehicle(p_id uuid, p_data jsonb, p_owner_id uuid default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_plate  text := app.normalize_plate(p_data ->> 'plate_no');
  v_model  uuid;
  v_id     uuid;
  v_dupe   text;
begin
  perform app.assert_permission('customers', case when p_id is null then 'create' else 'update' end::public.permission_action);
  select plate_no into v_dupe from public.vehicles
   where branch_id = v_branch and regexp_replace(plate_no, '\s', '', 'g') = regexp_replace(v_plate, '\s', '', 'g')
     and id is distinct from p_id;
  if v_dupe is not null then
    raise exception 'Nomor polisi % sudah terdaftar', v_dupe using errcode = '23505';
  end if;
  v_model := app.resolve_vehicle_model(p_data ->> 'make', p_data ->> 'model');

  if p_id is null then
    if p_owner_id is null then raise exception 'Pilih pemilik kendaraan' using errcode = '22023'; end if;
    perform app.assert_ref('customers', p_owner_id, 'Pelanggan');
    insert into public.vehicles (branch_id, plate_no, model_id, variant, year, color, transmission, fuel, vin, engine_no,
                                 last_odometer, notes)
    values (v_branch, v_plate, v_model, nullif(btrim(p_data ->> 'variant'), ''), nullif(p_data ->> 'year', '')::int,
            nullif(btrim(p_data ->> 'color'), ''), nullif(p_data ->> 'transmission', '')::public.transmission_type,
            nullif(p_data ->> 'fuel', '')::public.fuel_type, nullif(upper(btrim(p_data ->> 'vin')), ''),
            nullif(upper(btrim(p_data ->> 'engine_no')), ''), nullif(p_data ->> 'last_odometer', '')::int,
            nullif(btrim(p_data ->> 'notes'), ''))
    returning id into v_id;
    insert into public.vehicle_ownerships (branch_id, vehicle_id, customer_id) values (v_branch, v_id, p_owner_id);
  else
    update public.vehicles
       set plate_no = v_plate, model_id = v_model, variant = nullif(btrim(p_data ->> 'variant'), ''),
           year = nullif(p_data ->> 'year', '')::int, color = nullif(btrim(p_data ->> 'color'), ''),
           transmission = nullif(p_data ->> 'transmission', '')::public.transmission_type,
           fuel = nullif(p_data ->> 'fuel', '')::public.fuel_type, vin = nullif(upper(btrim(p_data ->> 'vin')), ''),
           engine_no = nullif(upper(btrim(p_data ->> 'engine_no')), ''),
           -- Kilometer tidak boleh mundur (dipakai perkiraan servis berkala)
           last_odometer = greatest(coalesce(last_odometer, 0), coalesce(nullif(p_data ->> 'last_odometer', '')::int, 0)),
           notes = nullif(btrim(p_data ->> 'notes'), '')
     where id = p_id and branch_id = v_branch
    returning id into v_id;
    if v_id is null then raise exception 'Kendaraan tidak ditemukan' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

-- Pindah pemilik: tutup kepemilikan lama, buka yang baru; riwayat servis tetap ikut kendaraan
create or replace function public.transfer_vehicle(p_vehicle_id uuid, p_customer_id uuid, p_date date default null, p_note text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch  uuid := app.current_branch_id();
  v_date    date := coalesce(p_date, app.today_wib());
  v_current public.vehicle_ownerships%rowtype;
begin
  perform app.assert_permission('customers', 'update');
  perform app.assert_ref('customers', p_customer_id, 'Pemilik baru');
  if not exists (select 1 from public.vehicles where id = p_vehicle_id and branch_id = v_branch) then
    raise exception 'Kendaraan tidak ditemukan' using errcode = 'P0002';
  end if;
  select * into v_current from public.vehicle_ownerships where vehicle_id = p_vehicle_id and ended_at is null for update;
  if v_current.customer_id = p_customer_id then
    raise exception 'Pelanggan ini sudah menjadi pemilik kendaraan' using errcode = '22023';
  end if;
  if v_current.id is not null then
    if v_date < v_current.started_at then
      raise exception 'Tanggal pindah tidak boleh sebelum kepemilikan sekarang dimulai' using errcode = '22023';
    end if;
    update public.vehicle_ownerships set ended_at = v_date where id = v_current.id;
  end if;
  insert into public.vehicle_ownerships (branch_id, vehicle_id, customer_id, started_at, note)
  values (v_branch, p_vehicle_id, p_customer_id, v_date, nullif(btrim(p_note), ''));
end;
$$;

create or replace function public.set_vehicle_active(p_id uuid, p_active boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform app.assert_permission('customers', 'update');
  update public.vehicles set is_active = p_active where id = p_id and branch_id = app.current_branch_id();
  if not found then raise exception 'Kendaraan tidak ditemukan' using errcode = 'P0002'; end if;
end;
$$;

revoke all on function public.save_customer(uuid, jsonb), public.set_customer_active(uuid, boolean),
  public.save_vehicle(uuid, jsonb, uuid), public.transfer_vehicle(uuid, uuid, date, text),
  public.set_vehicle_active(uuid, boolean) from public, anon;
grant execute on function public.save_customer(uuid, jsonb), public.set_customer_active(uuid, boolean),
  public.save_vehicle(uuid, jsonb, uuid), public.transfer_vehicle(uuid, uuid, date, text),
  public.set_vehicle_active(uuid, boolean) to authenticated;
