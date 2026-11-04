-- =============================================================================
-- Foto profil dan profil saya (Pengaturan > Profil saya).
-- Foto disimpan lewat sistem lampiran (jenis employee_avatar, bucket privat) dan ditunjuk oleh employees.photo_url
-- ("/api/v1/attachments/<id>"). Setiap karyawan hanya mengubah fotonya sendiri; pemegang izin karyawan (ubah)
-- boleh mengunggah untuk orang lain lewat sistem lampiran yang sama. Foto lama dilepas (ditandai), bukan dihapus.
-- =============================================================================

alter table public.attachments drop constraint attachments_entity_type_check;
alter table public.attachments add constraint attachments_entity_type_check
  check (entity_type in ('item', 'goods_receipt', 'cash_transaction', 'employee_avatar'));

create or replace function app.can_view_attachment(p_type text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select case p_type
    when 'item' then app.has_permission('master_data', 'view')
    when 'goods_receipt' then app.has_permission('purchasing', 'view') or app.has_permission('payables', 'view')
    when 'cash_transaction' then app.has_permission('expenses', 'view') or app.has_permission('journal', 'view') or app.has_permission('finance_reports', 'view')
    when 'employee_avatar' then app.current_employee_id() is not null
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
    when 'employee_avatar' then app.current_employee_id() is not null
    else false end
$$;

-- register_attachment: tambahkan jenis foto profil (hanya gambar, hanya untuk diri sendiri atau pemegang izin karyawan)
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
  if p_entity_type = 'employee_avatar' then
    if p_mime = 'application/pdf' then raise exception 'Foto profil harus berupa gambar' using errcode = '22023'; end if;
    if p_entity_id <> app.current_employee_id() and not app.has_permission('employees', 'update') then
      raise exception 'Anda hanya bisa mengubah foto profil sendiri' using errcode = '42501';
    end if;
  end if;
  execute format('select exists (select 1 from public.%I where id = $1 and branch_id = $2)',
                 case p_entity_type when 'item' then 'items' when 'goods_receipt' then 'goods_receipts'
                                    when 'cash_transaction' then 'cash_transactions' when 'employee_avatar' then 'employees' end)
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

-- Jadikan foto yang baru diunggah sebagai foto profil saya; foto sebelumnya dilepas
create or replace function public.set_my_avatar(p_attachment_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_emp uuid := app.current_employee_id();
begin
  if v_emp is null then raise exception 'Sesi tidak valid: login sebagai karyawan aktif' using errcode = '42501'; end if;
  if not exists (select 1 from public.attachments where id = p_attachment_id and entity_type = 'employee_avatar' and entity_id = v_emp
                 and branch_id = app.current_branch_id() and removed_at is null) then
    raise exception 'Foto tidak ditemukan' using errcode = 'P0002';
  end if;
  update public.attachments set removed_at = now(), removed_by = auth.uid()
   where entity_type = 'employee_avatar' and entity_id = v_emp and removed_at is null and id <> p_attachment_id;
  update public.employees set photo_url = '/api/v1/attachments/' || p_attachment_id::text where id = v_emp;
end;
$$;

create or replace function public.clear_my_avatar()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_emp uuid := app.current_employee_id();
begin
  if v_emp is null then raise exception 'Sesi tidak valid: login sebagai karyawan aktif' using errcode = '42501'; end if;
  update public.attachments set removed_at = now(), removed_by = auth.uid()
   where entity_type = 'employee_avatar' and entity_id = v_emp and removed_at is null;
  update public.employees set photo_url = null where id = v_emp;
end;
$$;

-- Ubah nomor HP saya (data lain tetap lewat pengelolaan karyawan)
create or replace function public.update_my_profile(p_phone text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_emp   uuid := app.current_employee_id();
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
begin
  if v_emp is null then raise exception 'Sesi tidak valid: login sebagai karyawan aktif' using errcode = '42501'; end if;
  if v_phone is not null then
    v_phone := app.normalize_phone(v_phone);
    if v_phone !~ '^[0-9+]{8,16}$' then raise exception 'Nomor HP tidak valid' using errcode = '22023'; end if;
  end if;
  update public.employees set phone = v_phone where id = v_emp;
end;
$$;

-- my_context membawa foto profil
create or replace function public.my_context()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'employee', jsonb_build_object('id', e.id, 'code', e.code, 'full_name', e.full_name,
                                   'position', e.position, 'status', e.status, 'photo_url', e.photo_url),
    'branch',   jsonb_build_object('id', b.id, 'code', b.code, 'name', b.name),
    'is_superuser', app.is_superuser(),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('code', r.code, 'name', r.name) order by r.name)
      from public.employee_roles er join public.roles r on r.id = er.role_id and r.is_active
      where er.employee_id = e.id), '[]'::jsonb),
    'permissions', coalesce((
      select jsonb_agg(distinct pm.module || ':' || pm.action || ':' || rp.scope)
      from public.employee_roles er
      join public.roles r on r.id = er.role_id and r.is_active
      join public.role_permissions rp on rp.role_id = r.id
      join public.permissions pm on pm.id = rp.permission_id
      where er.employee_id = e.id), '[]'::jsonb)
  )
  from public.employees e
  join public.branches b on b.id = e.branch_id
  where e.id = app.current_employee_id()
$$;

revoke all on function public.set_my_avatar(uuid), public.clear_my_avatar(), public.update_my_profile(text) from public, anon;
grant execute on function public.set_my_avatar(uuid), public.clear_my_avatar(), public.update_my_profile(text) to authenticated;
