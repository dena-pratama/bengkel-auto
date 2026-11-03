-- =============================================================================
-- Pengelolaan karyawan & role (PRD §2, §10.1–10.2, §16)
-- Semua perubahan lewat fungsi atomik di database: izin dicek di sini (bukan di halaman),
-- aturan keamanan (tidak ada eskalasi hak, minimal satu Owner aktif) ditegakkan di sini.
-- Perubahan baris tetap tercatat oleh trigger audit pada tiap tabel.
-- =============================================================================

-- Urutan modul untuk matriks izin di aplikasi (sebelumnya hanya ada di seed sementara)
alter table public.permissions add column if not exists sort_order integer not null default 0;
update public.permissions p set sort_order = m.ord
from (values
  ('dashboard', 1), ('finance_reports', 2), ('master_data', 3), ('price_change', 4), ('purchasing', 5),
  ('payables', 6), ('customers', 7), ('service_orders', 8), ('part_issue', 9), ('service_board', 10),
  ('sales', 11), ('discount_override', 12), ('transaction_void', 13), ('cash_shift', 14), ('sales_return', 15),
  ('receivables', 16), ('stock_opname_count', 17), ('stock_opname_approve', 18), ('employees', 19),
  ('commissions', 20), ('payroll', 21), ('expenses', 22), ('journal', 23), ('tax_settings', 24),
  ('ai_analyst', 25), ('audit_log', 26), ('settings', 27)
) as m(module, ord)
where p.module = m.module;

-- Alasan perubahan status (diisi lewat set_employee_status)
alter table public.employee_status_history add column if not exists reason text;

create or replace function app.on_employee_status_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.employee_status_history (branch_id, employee_id, old_status, new_status, reason)
    values (new.branch_id, new.id, case when tg_op = 'UPDATE' then old.status end, new.status,
            nullif(current_setting('app.status_reason', true), ''));

    update auth.users u
       set banned_until = case when new.status = 'inactive' then 'infinity'::timestamptz end
      from public.profiles p
     where p.employee_id = new.id and u.id = p.id;
  end if;
  return new;
end;
$$;

-- =============================================================================
-- Helper
-- =============================================================================
create or replace function app.assert_permission(p_module text, p_action public.permission_action)
returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if app.current_employee_id() is null then
    raise exception 'Sesi tidak valid: login sebagai karyawan aktif' using errcode = '42501';
  end if;
  if not app.has_permission(p_module, p_action) then
    raise exception 'Anda tidak punya izin untuk tindakan ini' using errcode = '42501';
  end if;
end;
$$;

-- Apakah karyawan memegang role superuser (Owner) yang aktif
create or replace function app.employee_is_superuser(p_employee_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.employee_roles er join public.roles r on r.id = er.role_id
    where er.employee_id = p_employee_id and r.is_active and r.is_superuser
  )
$$;

-- Jumlah Owner aktif (status bukan Nonaktif) di cabang
create or replace function app.active_superuser_count(p_branch_id uuid)
returns integer
language sql stable security definer
set search_path = ''
as $$
  select count(distinct e.id)::int
  from public.employees e
  join public.employee_roles er on er.employee_id = e.id
  join public.roles r on r.id = er.role_id and r.is_active and r.is_superuser
  where e.branch_id = p_branch_id and e.status <> 'inactive'
$$;

-- Karyawan target harus satu cabang; data Owner hanya boleh diubah oleh Owner
create or replace function app.assert_can_manage_employee(p_employee_id uuid)
returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.employees where id = p_employee_id and branch_id = app.current_branch_id()) then
    raise exception 'Karyawan tidak ditemukan' using errcode = 'P0002';
  end if;
  if app.employee_is_superuser(p_employee_id) and not app.is_superuser() then
    raise exception 'Hanya Owner yang boleh mengubah data Owner' using errcode = '42501';
  end if;
end;
$$;

-- Validasi & normalisasi data diri karyawan dari jsonb
create or replace function app.employee_fields(p jsonb)
returns table (full_name text, nik text, phone text, "position" text, hire_date date,
               bank_name text, bank_account_number text, bank_account_name text)
language plpgsql stable
set search_path = ''
as $$
declare
  v_name  text := btrim(p ->> 'full_name');
  v_nik   text := nullif(regexp_replace(coalesce(p ->> 'nik', ''), '\s', '', 'g'), '');
  v_phone text := nullif(regexp_replace(coalesce(p ->> 'phone', ''), '[\s-]', '', 'g'), '');
  v_acct  text := nullif(regexp_replace(coalesce(p ->> 'bank_account_number', ''), '[\s-]', '', 'g'), '');
begin
  if v_name is null or length(v_name) < 2 then
    raise exception 'Nama minimal 2 karakter' using errcode = '22023';
  end if;
  if v_nik is not null and v_nik !~ '^[0-9]{16}$' then
    raise exception 'NIK harus 16 digit angka' using errcode = '22023';
  end if;
  if v_phone is not null and v_phone !~ '^(\+62|62|0)8[0-9]{7,12}$' then
    raise exception 'Nomor HP tidak valid (contoh 0812xxxxxxx)' using errcode = '22023';
  end if;
  if v_acct is not null and v_acct !~ '^[0-9]{5,20}$' then
    raise exception 'Nomor rekening hanya angka (5–20 digit)' using errcode = '22023';
  end if;
  return query select
    v_name, v_nik, v_phone,
    nullif(btrim(p ->> 'position'), ''),
    nullif(p ->> 'hire_date', '')::date,
    nullif(btrim(p ->> 'bank_name'), ''),
    v_acct,
    nullif(btrim(p ->> 'bank_account_name'), '');
end;
$$;

-- Role yang diberikan harus milik cabang & aktif; role Owner hanya boleh diberikan Owner
create or replace function app.assert_assignable_roles(p_role_ids uuid[])
returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if p_role_ids is null or cardinality(p_role_ids) = 0 then
    raise exception 'Pilih minimal satu role' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_role_ids) x(id)
    left join public.roles r on r.id = x.id and r.branch_id = app.current_branch_id() and r.is_active
    where r.id is null
  ) then
    raise exception 'Role tidak ditemukan atau nonaktif' using errcode = '22023';
  end if;
  if not app.is_superuser() and exists (
    select 1 from public.roles where id = any (p_role_ids) and is_superuser
  ) then
    raise exception 'Hanya Owner yang boleh memberikan role Owner' using errcode = '42501';
  end if;
end;
$$;

-- =============================================================================
-- Karyawan
-- =============================================================================
create or replace function public.create_employee(p_data jsonb, p_role_ids uuid[])
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_id     uuid;
  f        record;
begin
  perform app.assert_permission('employees', 'create');
  perform app.assert_assignable_roles(p_role_ids);
  select * into f from app.employee_fields(p_data);

  insert into public.employees (branch_id, code, full_name, nik, phone, position, hire_date,
                                bank_name, bank_account_number, bank_account_name)
  values (v_branch, app.next_document_number('EMP', null, v_branch), f.full_name, f.nik, f.phone,
          f.position, f.hire_date, f.bank_name, f.bank_account_number, f.bank_account_name)
  returning id into v_id;

  insert into public.employee_roles (branch_id, employee_id, role_id)
  select v_branch, v_id, r from unnest(p_role_ids) as r group by r;

  return v_id;
end;
$$;

create or replace function public.update_employee(p_employee_id uuid, p_data jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  f record;
begin
  perform app.assert_permission('employees', 'update');
  perform app.assert_can_manage_employee(p_employee_id);
  select * into f from app.employee_fields(p_data);

  update public.employees
     set full_name = f.full_name, nik = f.nik, phone = f.phone, position = f.position,
         hire_date = f.hire_date, bank_name = f.bank_name,
         bank_account_number = f.bank_account_number, bank_account_name = f.bank_account_name
   where id = p_employee_id;
end;
$$;

create or replace function public.set_employee_roles(p_employee_id uuid, p_role_ids uuid[])
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
begin
  perform app.assert_permission('employees', 'update');
  perform app.assert_can_manage_employee(p_employee_id);
  perform app.assert_assignable_roles(p_role_ids);

  -- Cegah dua admin mengubah role bersamaan sampai Owner habis
  lock table public.employee_roles in share row exclusive mode;

  delete from public.employee_roles
   where employee_id = p_employee_id and not (role_id = any (p_role_ids));

  insert into public.employee_roles (branch_id, employee_id, role_id)
  select v_branch, p_employee_id, r from unnest(p_role_ids) as r group by r
  on conflict (employee_id, role_id) do nothing;

  if app.active_superuser_count(v_branch) = 0 then
    raise exception 'Minimal harus ada satu Owner aktif' using errcode = '23514';
  end if;
end;
$$;

create or replace function public.set_employee_status(
  p_employee_id uuid,
  p_status public.employee_status,
  p_reason text default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
begin
  perform app.assert_permission('employees', 'update');
  perform app.assert_can_manage_employee(p_employee_id);

  if p_employee_id = app.current_employee_id() then
    raise exception 'Tidak bisa mengubah status akun sendiri' using errcode = '42501';
  end if;
  if p_status = 'inactive' and length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Alasan wajib diisi saat menonaktifkan karyawan' using errcode = '22023';
  end if;

  lock table public.employee_roles in share row exclusive mode;

  perform set_config('app.status_reason', btrim(coalesce(p_reason, '')), true);
  update public.employees set status = p_status where id = p_employee_id;
  perform set_config('app.status_reason', '', true);

  if app.active_superuser_count(v_branch) = 0 then
    raise exception 'Minimal harus ada satu Owner aktif' using errcode = '23514';
  end if;
end;
$$;

-- Hubungkan akun login (dibuat server lewat Auth Admin API) ke karyawan.
-- Dipanggil sebagai user yang login, jadi izinnya dicek di sini. Akun auth harus baru
-- (≤ 10 menit) dan belum terhubung, agar tidak bisa "mengambil" akun orang lain.
create or replace function public.link_employee_account(p_employee_id uuid, p_user_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  perform app.assert_permission('employees', 'update');
  perform app.assert_can_manage_employee(p_employee_id);

  if exists (select 1 from public.profiles where employee_id = p_employee_id) then
    raise exception 'Karyawan ini sudah punya akun login' using errcode = '23505';
  end if;
  select email into v_email from auth.users
   where id = p_user_id and created_at > now() - interval '10 minutes'
     and not exists (select 1 from public.profiles where id = p_user_id);
  if v_email is null then
    raise exception 'Akun login tidak valid atau sudah terhubung' using errcode = '22023';
  end if;

  insert into public.profiles (id, branch_id, employee_id, email)
  values (p_user_id, app.current_branch_id(), p_employee_id, lower(v_email));
end;
$$;

-- ID akun login karyawan, untuk atur ulang password lewat server (Auth Admin API).
create or replace function public.employee_account_for_reset(p_employee_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  perform app.assert_permission('employees', 'update');
  perform app.assert_can_manage_employee(p_employee_id);
  select id into v_user from public.profiles where employee_id = p_employee_id;
  if v_user is null then
    raise exception 'Karyawan ini belum punya akun login' using errcode = 'P0002';
  end if;
  insert into public.audit_logs (branch_id, table_name, record_id, action, actor_user_id, actor_employee_id, note)
  values (app.current_branch_id(), 'profiles', v_user, 'update', auth.uid(), app.current_employee_id(),
          'Atur ulang password akun karyawan');
  return v_user;
end;
$$;

-- PIN persetujuan milik sendiri (pembungkus app.set_my_pin agar bisa dipanggil lewat API)
create or replace function public.set_my_pin(p_pin text)
returns void
language sql security definer
set search_path = ''
as $$ select app.set_my_pin(p_pin) $$;

-- Apakah karyawan sudah mengatur PIN (tanpa membuka hash-nya)
create or replace function public.employee_has_pin(p_employee_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select pin_hash is not null from public.employees
  where id = p_employee_id
    and (id = app.current_employee_id()
         or (branch_id = app.current_branch_id() and app.has_permission('employees', 'view')))
$$;

-- =============================================================================
-- Role & matriks izin
-- p_permissions: [{"permission_id": "...", "scope": "all"|"own"}, ...]
-- =============================================================================
create or replace function public.save_role(
  p_role_id uuid,
  p_name text,
  p_description text,
  p_permissions jsonb
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_name   text := btrim(p_name);
  v_role   public.roles%rowtype;
  v_code   text;
  v_bad    text;
  v_ids    uuid[];
  v_scopes public.permission_scope[];
begin
  perform app.assert_permission('employees', 'update');

  if v_name is null or length(v_name) < 2 then
    raise exception 'Nama role minimal 2 karakter' using errcode = '22023';
  end if;
  if exists (select 1 from public.roles where branch_id = v_branch and lower(name) = lower(v_name)
             and id is distinct from p_role_id) then
    raise exception 'Nama role sudah dipakai' using errcode = '23505';
  end if;

  -- Izin unik per permission_id (jika dobel, ambil lingkup terluas)
  select array_agg(id), array_agg(scope) into v_ids, v_scopes
  from (
    select (x ->> 'permission_id')::uuid as id,
           min(coalesce(x ->> 'scope', 'all'))::public.permission_scope as scope  -- 'all' < 'own'
    from jsonb_array_elements(coalesce(p_permissions, '[]'::jsonb)) x
    group by 1
  ) t;
  v_ids := coalesce(v_ids, '{}');
  v_scopes := coalesce(v_scopes, '{}');

  if exists (select 1 from unnest(v_ids) t(id) left join public.permissions p on p.id = t.id where p.id is null) then
    raise exception 'Izin tidak dikenal' using errcode = '22023';
  end if;

  -- Tanpa eskalasi: non-Owner hanya boleh memberi izin yang ia miliki sendiri
  if not app.is_superuser() then
    select p.module_label || ' — ' || p.action into v_bad
    from unnest(v_ids, v_scopes) t(id, scope) join public.permissions p on p.id = t.id
    where not app.has_permission(p.module, p.action, t.scope)
    limit 1;
    if v_bad is not null then
      raise exception 'Anda tidak bisa memberi izin yang tidak Anda miliki: %', v_bad using errcode = '42501';
    end if;
  end if;

  if p_role_id is null then
    v_code := left(trim(both '_' from regexp_replace(lower(v_name), '[^a-z0-9]+', '_', 'g')), 40);
    if v_code = '' then v_code := 'role'; end if;
    while exists (select 1 from public.roles where branch_id = v_branch and code = v_code) loop
      v_code := v_code || '_' || substr(md5(random()::text), 1, 4);
    end loop;
    insert into public.roles (branch_id, code, name, description)
    values (v_branch, v_code, v_name, nullif(btrim(p_description), ''))
    returning * into v_role;
  else
    select * into v_role from public.roles where id = p_role_id and branch_id = v_branch for update;
    if not found then
      raise exception 'Role tidak ditemukan' using errcode = 'P0002';
    end if;
    if v_role.is_superuser then
      raise exception 'Role Owner selalu punya semua izin dan tidak bisa diubah' using errcode = '42501';
    end if;
    update public.roles set name = v_name, description = nullif(btrim(p_description), '')
     where id = v_role.id;
  end if;

  delete from public.role_permissions rp
   where rp.role_id = v_role.id and not (rp.permission_id = any (v_ids));
  insert into public.role_permissions (branch_id, role_id, permission_id, scope)
  select v_branch, v_role.id, t.id, t.scope from unnest(v_ids, v_scopes) t(id, scope)
  on conflict (role_id, permission_id) do update set scope = excluded.scope
    where public.role_permissions.scope is distinct from excluded.scope;

  return v_role.id;
end;
$$;

create or replace function public.set_role_active(p_role_id uuid, p_active boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_role public.roles%rowtype;
begin
  perform app.assert_permission('employees', 'update');
  select * into v_role from public.roles where id = p_role_id and branch_id = app.current_branch_id();
  if not found then
    raise exception 'Role tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_role.is_system then
    raise exception 'Role bawaan tidak bisa dinonaktifkan' using errcode = '42501';
  end if;
  update public.roles set is_active = p_active where id = p_role_id;
end;
$$;

-- =============================================================================
-- Hak eksekusi: hanya user login (izin dicek di dalam fungsi)
-- =============================================================================
revoke all on function
  public.create_employee(jsonb, uuid[]),
  public.update_employee(uuid, jsonb),
  public.set_employee_roles(uuid, uuid[]),
  public.set_employee_status(uuid, public.employee_status, text),
  public.link_employee_account(uuid, uuid),
  public.employee_account_for_reset(uuid),
  public.set_my_pin(text),
  public.employee_has_pin(uuid),
  public.save_role(uuid, text, text, jsonb),
  public.set_role_active(uuid, boolean)
from public, anon;

grant execute on function
  public.create_employee(jsonb, uuid[]),
  public.update_employee(uuid, jsonb),
  public.set_employee_roles(uuid, uuid[]),
  public.set_employee_status(uuid, public.employee_status, text),
  public.link_employee_account(uuid, uuid),
  public.employee_account_for_reset(uuid),
  public.set_my_pin(text),
  public.employee_has_pin(uuid),
  public.save_role(uuid, text, text, jsonb),
  public.set_role_active(uuid, boolean)
to authenticated;

revoke all on function app.assert_permission(text, public.permission_action), app.employee_is_superuser(uuid),
  app.active_superuser_count(uuid), app.assert_can_manage_employee(uuid), app.assert_assignable_roles(uuid[])
from public, anon;
