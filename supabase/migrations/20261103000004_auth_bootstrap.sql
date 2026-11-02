-- =============================================================================
-- Auth: setup Owner pertama & konteks user login untuk aplikasi
-- Fungsi di schema public agar bisa dipanggil lewat PostgREST (supabase.rpc).
-- =============================================================================

-- Apakah aplikasi belum punya karyawan sama sekali (halaman /setup)
create or replace function public.needs_setup()
returns boolean
language sql stable security definer
set search_path = ''
as $$ select not exists (select 1 from public.employees) $$;

revoke all on function public.needs_setup() from public;
grant execute on function public.needs_setup() to anon, authenticated, service_role;

-- Buat Owner pertama untuk akun auth yang sudah dibuat server.
-- Hanya service_role, dan hanya jika belum ada karyawan.
create or replace function public.bootstrap_owner(p_user_id uuid, p_full_name text, p_email text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := (select id from public.branches where code = 'PST');
  v_role   uuid;
  v_emp    uuid;
begin
  -- Kunci agar dua request setup bersamaan tidak membuat dua Owner
  lock table public.employees in share row exclusive mode;

  if exists (select 1 from public.employees) then
    raise exception 'Setup sudah pernah dilakukan' using errcode = 'P0001';
  end if;
  if length(trim(p_full_name)) < 2 then
    raise exception 'Nama minimal 2 karakter';
  end if;

  select id into v_role from public.roles where branch_id = v_branch and code = 'owner';

  insert into public.employees (branch_id, code, full_name, position)
  values (v_branch, app.next_document_number('EMP', null, v_branch), trim(p_full_name), 'Owner')
  returning id into v_emp;

  insert into public.profiles (id, branch_id, employee_id, email)
  values (p_user_id, v_branch, v_emp, lower(p_email));

  insert into public.employee_roles (branch_id, employee_id, role_id)
  values (v_branch, v_emp, v_role);

  return v_emp;
end;
$$;

revoke all on function public.bootstrap_owner(uuid, text, text) from public, anon, authenticated;
grant execute on function public.bootstrap_owner(uuid, text, text) to service_role;

-- Konteks user login: karyawan, cabang, role, izin (untuk menu & guard di aplikasi).
-- NULL jika akun tidak terhubung ke karyawan aktif.
create or replace function public.my_context()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'employee', jsonb_build_object('id', e.id, 'code', e.code, 'full_name', e.full_name,
                                   'position', e.position, 'status', e.status),
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

revoke all on function public.my_context() from public, anon;
grant execute on function public.my_context() to authenticated;
