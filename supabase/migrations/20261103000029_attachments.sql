-- =============================================================================
-- Lampiran foto/dokumen (PRD §4.1 foto barang, §5 foto faktur supplier, §11 foto bukti transaksi).
-- Berkas disimpan di Supabase Storage (bucket privat "attachments"); tabel attachments mencatat metadata
-- dan menjadi sumber izin: berkas hanya bisa dibuka lewat aplikasi (URL bertanda tangan jangka pendek)
-- oleh pengguna yang boleh melihat dokumen induknya. Lampiran tidak dihapus permanen: ditandai removed_at.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

create table public.attachments (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches(id),
  entity_type text not null check (entity_type in ('item', 'goods_receipt', 'cash_transaction')),
  entity_id   uuid not null,
  path        text not null unique,
  file_name   text not null check (length(btrim(file_name)) between 1 and 200),
  mime_type   text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes  integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  removed_at  timestamptz,
  removed_by  uuid,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now()
);
create index idx_attachments_entity on public.attachments (entity_type, entity_id) where removed_at is null;

create trigger trg_attachments_updated_at before update on public.attachments for each row execute function app.set_updated_at();
create trigger trg_audit after insert or update or delete on public.attachments for each row execute function app.audit_row_change();
create trigger trg_no_delete before delete on public.attachments for each row execute function app.prevent_modification();

-- Izin lihat dan kelola menurut jenis dokumen induk
create or replace function app.can_view_attachment(p_type text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select case p_type
    when 'item' then app.has_permission('master_data', 'view')
    when 'goods_receipt' then app.has_permission('purchasing', 'view') or app.has_permission('payables', 'view')
    when 'cash_transaction' then app.has_permission('expenses', 'view') or app.has_permission('journal', 'view') or app.has_permission('finance_reports', 'view')
    else false end
$$;

create or replace function app.can_manage_attachment(p_type text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select case p_type
    when 'item' then app.has_permission('master_data', 'update')
    when 'goods_receipt' then app.has_permission('purchasing', 'create') or app.has_permission('purchasing', 'update')
    when 'cash_transaction' then app.has_permission('expenses', 'create')
    else false end
$$;
revoke all on function app.can_view_attachment(text), app.can_manage_attachment(text) from public, anon;
grant execute on function app.can_view_attachment(text), app.can_manage_attachment(text) to authenticated, service_role;

alter table public.attachments enable row level security;
revoke all on public.attachments from anon;
revoke insert, update, delete, truncate on public.attachments from authenticated;
grant select on public.attachments to authenticated;
create policy attachments_select on public.attachments for select to authenticated
  using (branch_id = app.current_branch_id() and removed_at is null and app.can_view_attachment(entity_type));

-- Catat berkas yang sudah diunggah server. Dipanggil dengan sesi pengguna (izin dicek di sini).
create or replace function public.register_attachment(p_entity_type text, p_entity_id uuid, p_path text, p_file_name text, p_mime text, p_size integer)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_ok     boolean;
  v_id     uuid;
begin
  if app.current_employee_id() is null then raise exception 'Sesi tidak valid: login sebagai karyawan aktif' using errcode = '42501'; end if;
  if not app.can_manage_attachment(p_entity_type) then raise exception 'Anda tidak punya izin untuk tindakan ini' using errcode = '42501'; end if;
  execute format('select exists (select 1 from public.%I where id = $1 and branch_id = $2)',
                 case p_entity_type when 'item' then 'items' when 'goods_receipt' then 'goods_receipts' when 'cash_transaction' then 'cash_transactions' end)
    into v_ok using p_entity_id, v_branch;
  if not coalesce(v_ok, false) then raise exception 'Dokumen induk tidak ditemukan' using errcode = '22023'; end if;
  if p_path not like v_branch::text || '/' || p_entity_type || '/' || p_entity_id::text || '/%' then
    raise exception 'Lokasi berkas tidak valid' using errcode = '22023';
  end if;
  if (select count(*) from public.attachments where entity_type = p_entity_type and entity_id = p_entity_id and removed_at is null) >= 10 then
    raise exception 'Maksimal 10 lampiran per dokumen' using errcode = '22023';
  end if;
  insert into public.attachments (branch_id, entity_type, entity_id, path, file_name, mime_type, size_bytes)
  values (v_branch, p_entity_type, p_entity_id, p_path, left(btrim(p_file_name), 200), p_mime, p_size)
  returning id into v_id;
  return v_id;
end;
$$;

-- Lepas lampiran (ditandai, berkas tetap di penyimpanan untuk jejak audit)
create or replace function public.remove_attachment(p_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_a public.attachments%rowtype;
begin
  select * into v_a from public.attachments where id = p_id and branch_id = app.current_branch_id() and removed_at is null;
  if not found then raise exception 'Lampiran tidak ditemukan' using errcode = 'P0002'; end if;
  if not app.can_manage_attachment(v_a.entity_type) then raise exception 'Anda tidak punya izin untuk tindakan ini' using errcode = '42501'; end if;
  update public.attachments set removed_at = now(), removed_by = auth.uid() where id = p_id;
end;
$$;

revoke all on function public.register_attachment(text, uuid, text, text, text, integer), public.remove_attachment(uuid) from public, anon;
grant execute on function public.register_attachment(text, uuid, text, text, text, integer), public.remove_attachment(uuid) to authenticated;
