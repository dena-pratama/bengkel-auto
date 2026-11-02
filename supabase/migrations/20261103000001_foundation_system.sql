-- =============================================================================
-- Fondasi sistem: schema app, cabang, setting, penomoran dokumen, audit log
-- PRD §15.1 (konvensi), §15.2 (kelompok Sistem), §18 (audit log)
-- =============================================================================

create schema if not exists app;
grant usage on schema app to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Helper umum
-- -----------------------------------------------------------------------------

-- Tanggal hari ini menurut WIB (dipakai penomoran dokumen & periode)
create or replace function app.today_wib()
returns date
language sql stable
set search_path = ''
as $$ select (now() at time zone 'Asia/Jakarta')::date $$;

-- Trigger: isi updated_at otomatis
create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- branches — disiapkan untuk multi-cabang (MVP: satu cabang)
-- -----------------------------------------------------------------------------
create table public.branches (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  address     text,
  phone       text,
  npwp        text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now()
);
comment on table public.branches is 'Cabang bengkel. Semua tabel bisnis punya branch_id.';

create trigger trg_branches_updated_at before update on public.branches
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- settings — key/value per cabang
-- -----------------------------------------------------------------------------
create table public.settings (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches(id),
  key         text not null,
  value       jsonb not null,
  description text,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now(),
  unique (branch_id, key)
);

create trigger trg_settings_updated_at before update on public.settings
  for each row execute function app.set_updated_at();

-- -----------------------------------------------------------------------------
-- number_sequences — nomor dokumen otomatis, contoh INV-2611-0001 (PRD §8.3)
-- Hanya diakses lewat app.next_document_number().
-- -----------------------------------------------------------------------------
create table public.number_sequences (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches(id),
  doc_type    text not null check (doc_type ~ '^[A-Z]{2,5}$'),
  period      text not null check (period ~ '^[0-9]{4}$'),   -- YYMM
  last_number integer not null default 0 check (last_number >= 0),
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now(),
  unique (branch_id, doc_type, period)
);

-- -----------------------------------------------------------------------------
-- audit_logs — append-only, tidak bisa diubah/dihapus (PRD §18)
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid references public.branches(id),
  table_name  text not null,
  record_id   uuid,
  action      text not null check (action in ('insert', 'update', 'delete', 'void', 'approve', 'ai_tool_call', 'login', 'other')),
  old_data    jsonb,
  new_data    jsonb,
  actor_user_id     uuid,           -- auth.users.id
  actor_employee_id uuid,           -- employees.id (FK ditambah di migration akses)
  note        text,
  created_at  timestamptz not null default now()
);
create index idx_audit_logs_record on public.audit_logs (table_name, record_id);
create index idx_audit_logs_created on public.audit_logs (created_at desc);

create or replace function app.prevent_modification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Tabel % bersifat append-only: % tidak diizinkan', tg_table_name, tg_op;
end;
$$;

create trigger trg_audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function app.prevent_modification();
create trigger trg_audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function app.prevent_modification();
