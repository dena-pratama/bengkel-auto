-- =============================================================================
-- Akses: karyawan, profil login, role dinamis, izin per modul/aksi, RLS
-- PRD §2 (role), §10.1–10.2 (karyawan & RLS), §16 (matriks hak akses), §19.3
-- =============================================================================

create type public.employee_status as enum ('active', 'on_leave', 'inactive');
create type public.permission_action as enum ('view', 'create', 'update', 'void', 'approve', 'export');
create type public.permission_scope as enum ('all', 'own');

-- -----------------------------------------------------------------------------
-- employees
-- -----------------------------------------------------------------------------
create table public.employees (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references public.branches(id),
  code          text not null unique,
  full_name     text not null,
  nik           text,
  phone         text,
  position      text,
  hire_date     date,
  bank_name     text,
  bank_account_number text,
  bank_account_name   text,
  photo_url     text,
  status        public.employee_status not null default 'active',
  pin_hash      text,             -- PIN 6 digit persetujuan cepat, bcrypt via app.set_my_pin()
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  updated_at    timestamptz not null default now()
);
comment on column public.employees.pin_hash is 'Hash bcrypt; tidak pernah dikirim ke klien.';

create trigger trg_employees_updated_at before update on public.employees
  for each row execute function app.set_updated_at();

alter table public.audit_logs
  add constraint audit_logs_actor_employee_fk foreign key (actor_employee_id) references public.employees(id);

-- -----------------------------------------------------------------------------
-- profiles — 1–1 dengan akun login (auth.users), terhubung ke karyawan
-- -----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete restrict,
  branch_id    uuid not null references public.branches(id),
  employee_id  uuid not null unique references public.employees(id),
  email        text not null,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  updated_at   timestamptz not null default now()
);

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- employee_status_history — diisi trigger setiap status berubah
-- -----------------------------------------------------------------------------
create table public.employee_status_history (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid not null references public.branches(id),
  employee_id  uuid not null references public.employees(id),
  old_status   public.employee_status,
  new_status   public.employee_status not null,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  updated_at   timestamptz not null default now()
);
create index idx_employee_status_history_employee on public.employee_status_history (employee_id, created_at desc);

-- -----------------------------------------------------------------------------
-- roles, permissions, role_permissions, employee_roles
-- -----------------------------------------------------------------------------
create table public.roles (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references public.branches(id),
  code          text not null,
  name          text not null,
  description   text,
  is_system     boolean not null default false,  -- role bawaan, tidak bisa dinonaktifkan
  is_superuser  boolean not null default false,  -- Owner: semua izin, termasuk modul baru
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  updated_at    timestamptz not null default now(),
  unique (branch_id, code)
);

create trigger trg_roles_updated_at before update on public.roles
  for each row execute function app.set_updated_at();

-- Katalog izin global (modul × aksi). Tidak per cabang, jadi tanpa branch_id.
create table public.permissions (
  id           uuid primary key default gen_random_uuid(),
  module       text not null,
  action       public.permission_action not null,
  module_label text not null,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  updated_at   timestamptz not null default now(),
  unique (module, action)
);

create table public.role_permissions (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid not null references public.branches(id),
  role_id        uuid not null references public.roles(id),
  permission_id  uuid not null references public.permissions(id),
  scope          public.permission_scope not null default 'all',
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid(),
  updated_at     timestamptz not null default now(),
  unique (role_id, permission_id)
);

create table public.employee_roles (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid not null references public.branches(id),
  employee_id  uuid not null references public.employees(id),
  role_id      uuid not null references public.roles(id),
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  updated_at   timestamptz not null default now(),
  unique (employee_id, role_id)
);

-- =============================================================================
-- Helper RLS. Semua policy memanggil fungsi ini; jika Auth diganti cukup ubah
-- app.current_employee_id() (PRD §19.3).
-- =============================================================================

-- Karyawan yang sedang login. NULL jika belum login, tanpa profil, atau Nonaktif.
create or replace function app.current_employee_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select e.id
  from public.profiles p
  join public.employees e on e.id = p.employee_id
  where p.id = auth.uid()
    and e.status <> 'inactive'
$$;

create or replace function app.current_branch_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select e.branch_id from public.employees e where e.id = app.current_employee_id()
$$;

create or replace function app.is_superuser()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.employee_roles er
    join public.roles r on r.id = er.role_id
    where er.employee_id = app.current_employee_id()
      and r.is_active and r.is_superuser
  )
$$;

-- Cek izin modul/aksi. Role digabung (satu karyawan boleh banyak role).
-- p_scope 'all' hanya lolos untuk izin lingkup penuh; 'own' lolos untuk keduanya.
create or replace function app.has_permission(
  p_module text,
  p_action public.permission_action,
  p_scope  public.permission_scope default 'all'
)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select app.is_superuser() or exists (
    select 1
    from public.employee_roles er
    join public.roles r            on r.id = er.role_id and r.is_active
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions pm     on pm.id = rp.permission_id
    where er.employee_id = app.current_employee_id()
      and pm.module = p_module
      and pm.action = p_action
      and (p_scope = 'own' or rp.scope = 'all')
  )
$$;

grant execute on function app.today_wib(), app.current_employee_id(), app.current_branch_id(),
  app.is_superuser(), app.has_permission(text, public.permission_action, public.permission_scope)
  to authenticated, service_role;

-- =============================================================================
-- Audit trigger generik
-- =============================================================================
create or replace function app.audit_row_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
begin
  -- Jangan simpan rahasia ke audit log
  v_old := v_old - 'pin_hash';
  v_new := v_new - 'pin_hash';

  if tg_op = 'UPDATE' and v_old = v_new then
    return new;
  end if;

  insert into public.audit_logs (branch_id, table_name, record_id, action, old_data, new_data,
                                 actor_user_id, actor_employee_id)
  values (
    coalesce((v_row ->> 'branch_id')::uuid, case when tg_table_name = 'branches' then (v_row ->> 'id')::uuid end),
    tg_table_name,
    (v_row ->> 'id')::uuid,
    lower(tg_op),
    v_old,
    v_new,
    auth.uid(),
    app.current_employee_id()
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_audit after insert or update or delete on public.branches
  for each row execute function app.audit_row_change();
create trigger trg_audit after insert or update or delete on public.settings
  for each row execute function app.audit_row_change();
create trigger trg_audit after insert or update or delete on public.employees
  for each row execute function app.audit_row_change();
create trigger trg_audit after insert or update or delete on public.profiles
  for each row execute function app.audit_row_change();
create trigger trg_audit after insert or update or delete on public.roles
  for each row execute function app.audit_row_change();
create trigger trg_audit after insert or update or delete on public.role_permissions
  for each row execute function app.audit_row_change();
create trigger trg_audit after insert or update or delete on public.employee_roles
  for each row execute function app.audit_row_change();

-- =============================================================================
-- Status karyawan: riwayat + blokir login saat Nonaktif (PRD §10.1)
-- =============================================================================
create or replace function app.on_employee_status_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.employee_status_history (branch_id, employee_id, old_status, new_status)
    values (new.branch_id, new.id, case when tg_op = 'UPDATE' then old.status end, new.status);

    update auth.users u
       set banned_until = case when new.status = 'inactive' then 'infinity'::timestamptz end
      from public.profiles p
     where p.employee_id = new.id and u.id = p.id;
  end if;
  return new;
end;
$$;

create trigger trg_employees_status after insert or update of status on public.employees
  for each row execute function app.on_employee_status_change();

-- Profil baru untuk karyawan yang sudah Nonaktif ikut diblokir
create or replace function app.on_profile_insert()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update auth.users u
     set banned_until = 'infinity'::timestamptz
    from public.employees e
   where e.id = new.employee_id and e.status = 'inactive' and u.id = new.id;
  return new;
end;
$$;

create trigger trg_profiles_ban_inactive after insert on public.profiles
  for each row execute function app.on_profile_insert();

-- =============================================================================
-- Hapus permanen dilarang (PRD §18): master dinonaktifkan, bukan dihapus
-- =============================================================================
create trigger trg_no_delete before delete on public.branches
  for each row execute function app.prevent_modification();
create trigger trg_no_delete before delete on public.employees
  for each row execute function app.prevent_modification();
create trigger trg_no_delete before delete on public.profiles
  for each row execute function app.prevent_modification();
create trigger trg_no_delete before delete on public.roles
  for each row execute function app.prevent_modification();
create trigger trg_no_delete before delete on public.employee_status_history
  for each row execute function app.prevent_modification();
-- role_permissions & employee_roles adalah tabel relasi: boleh dihapus (pencabutan izin), tercatat di audit log.

-- =============================================================================
-- Penomoran dokumen (atomik, aman untuk transaksi bersamaan)
-- =============================================================================
create or replace function app.next_document_number(
  p_doc_type  text,
  p_date      date default null,
  p_branch_id uuid default null
)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := coalesce(p_branch_id, app.current_branch_id());
  v_period text := to_char(coalesce(p_date, app.today_wib()), 'YYMM');
  v_type   text := upper(p_doc_type);
  v_next   integer;
begin
  if v_branch is null then
    raise exception 'Cabang tidak diketahui: login sebagai karyawan aktif atau kirim p_branch_id';
  end if;
  if p_branch_id is not null and auth.uid() is not null and p_branch_id <> app.current_branch_id() then
    raise exception 'Tidak boleh membuat nomor untuk cabang lain';
  end if;

  insert into public.number_sequences as s (branch_id, doc_type, period, last_number)
  values (v_branch, v_type, v_period, 1)
  on conflict (branch_id, doc_type, period)
  do update set last_number = s.last_number + 1, updated_at = now()
  returning s.last_number into v_next;

  return v_type || '-' || v_period || '-' || lpad(v_next::text, 4, '0');
end;
$$;

grant execute on function app.next_document_number(text, date, uuid) to authenticated, service_role;

-- =============================================================================
-- PIN persetujuan (PRD §10.1): disimpan ter-hash, diverifikasi di database
-- =============================================================================
create or replace function app.set_my_pin(p_pin text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_pin !~ '^[0-9]{6}$' then
    raise exception 'PIN harus 6 digit angka';
  end if;
  if app.current_employee_id() is null then
    raise exception 'Tidak ada karyawan aktif untuk akun ini';
  end if;
  update public.employees
     set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'))
   where id = app.current_employee_id();
end;
$$;

-- Verifikasi PIN pemberi persetujuan yang punya izin approve pada modul tsb.
-- Mengembalikan employee_id penyetuju, atau NULL jika gagal.
create or replace function app.verify_approval_pin(p_pin text, p_module text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select e.id into v_id
  from public.employees e
  where e.status = 'active'
    and e.branch_id = app.current_branch_id()
    and e.pin_hash is not null
    and e.pin_hash = extensions.crypt(p_pin, e.pin_hash)
    and (
      exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id
              where er.employee_id = e.id and r.is_active and r.is_superuser)
      or exists (select 1 from public.employee_roles er
                 join public.roles r on r.id = er.role_id and r.is_active
                 join public.role_permissions rp on rp.role_id = r.id
                 join public.permissions pm on pm.id = rp.permission_id
                 where er.employee_id = e.id and pm.module = p_module and pm.action = 'approve')
    )
  limit 1;

  if v_id is not null then
    insert into public.audit_logs (branch_id, table_name, record_id, action, actor_user_id, actor_employee_id, note)
    values (app.current_branch_id(), 'employees', v_id, 'approve', auth.uid(), app.current_employee_id(),
            'Persetujuan PIN untuk modul ' || p_module);
  end if;
  return v_id;
end;
$$;

grant execute on function app.set_my_pin(text), app.verify_approval_pin(text, text) to authenticated;

-- =============================================================================
-- Row Level Security — aktif di semua tabel, anon tidak punya akses
-- =============================================================================
alter table public.branches                enable row level security;
alter table public.settings                enable row level security;
alter table public.number_sequences        enable row level security;
alter table public.audit_logs              enable row level security;
alter table public.employees               enable row level security;
alter table public.profiles                enable row level security;
alter table public.employee_status_history enable row level security;
alter table public.roles                   enable row level security;
alter table public.permissions             enable row level security;
alter table public.role_permissions        enable row level security;
alter table public.employee_roles          enable row level security;

revoke all on public.number_sequences, public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;
revoke all on public.branches, public.settings, public.employees, public.profiles,
  public.employee_status_history, public.roles, public.permissions, public.role_permissions,
  public.employee_roles from anon;
-- pin_hash tidak boleh terbaca/ditulis dari API: hak akses per kolom (revoke kolom saja
-- tidak cukup karena Supabase memberi grant level tabel).
revoke select, insert, update on public.employees from authenticated;
grant select (id, branch_id, code, full_name, nik, phone, position, hire_date, bank_name,
              bank_account_number, bank_account_name, photo_url, status, created_at, created_by, updated_at)
  on public.employees to authenticated;
grant insert (branch_id, code, full_name, nik, phone, position, hire_date, bank_name,
              bank_account_number, bank_account_name, photo_url, status)
  on public.employees to authenticated;
grant update (code, full_name, nik, phone, position, hire_date, bank_name,
              bank_account_number, bank_account_name, photo_url, status)
  on public.employees to authenticated;

-- branches
create policy branches_select on public.branches for select to authenticated
  using (app.current_employee_id() is not null);
create policy branches_write on public.branches for all to authenticated
  using (app.has_permission('settings', 'update')) with check (app.has_permission('settings', 'update'));

-- settings
create policy settings_select on public.settings for select to authenticated
  using (branch_id = app.current_branch_id());
create policy settings_write on public.settings for all to authenticated
  using (branch_id = app.current_branch_id() and app.has_permission('settings', 'update'))
  with check (branch_id = app.current_branch_id() and app.has_permission('settings', 'update'));

-- audit_logs (hanya baca; ditulis oleh trigger security definer)
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (app.has_permission('audit_log', 'view'));

-- employees: lihat diri sendiri, atau semua jika punya izin
create policy employees_select on public.employees for select to authenticated
  using (id = app.current_employee_id()
         or (branch_id = app.current_branch_id() and app.has_permission('employees', 'view')));
create policy employees_insert on public.employees for insert to authenticated
  with check (branch_id = app.current_branch_id() and app.has_permission('employees', 'create'));
create policy employees_update on public.employees for update to authenticated
  using (branch_id = app.current_branch_id() and app.has_permission('employees', 'update'))
  with check (branch_id = app.current_branch_id() and app.has_permission('employees', 'update'));

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid()
         or (branch_id = app.current_branch_id() and app.has_permission('employees', 'view')));
create policy profiles_write on public.profiles for all to authenticated
  using (branch_id = app.current_branch_id() and app.has_permission('employees', 'update'))
  with check (branch_id = app.current_branch_id() and app.has_permission('employees', 'update'));

-- employee_status_history (ditulis trigger)
create policy employee_status_history_select on public.employee_status_history for select to authenticated
  using (employee_id = app.current_employee_id()
         or (branch_id = app.current_branch_id() and app.has_permission('employees', 'view')));

-- roles & izin: semua karyawan aktif boleh baca (untuk menyusun menu), ubah butuh izin
create policy roles_select on public.roles for select to authenticated
  using (branch_id = app.current_branch_id());
create policy roles_write on public.roles for all to authenticated
  using (branch_id = app.current_branch_id() and app.has_permission('employees', 'update'))
  with check (branch_id = app.current_branch_id() and app.has_permission('employees', 'update'));

create policy permissions_select on public.permissions for select to authenticated
  using (app.current_employee_id() is not null);

create policy role_permissions_select on public.role_permissions for select to authenticated
  using (branch_id = app.current_branch_id());
create policy role_permissions_write on public.role_permissions for all to authenticated
  using (branch_id = app.current_branch_id() and app.has_permission('employees', 'update'))
  with check (branch_id = app.current_branch_id() and app.has_permission('employees', 'update'));

create policy employee_roles_select on public.employee_roles for select to authenticated
  using (branch_id = app.current_branch_id());
create policy employee_roles_write on public.employee_roles for all to authenticated
  using (branch_id = app.current_branch_id() and app.has_permission('employees', 'update'))
  with check (branch_id = app.current_branch_id() and app.has_permission('employees', 'update'));
