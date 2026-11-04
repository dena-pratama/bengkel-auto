-- =============================================================================
-- Pengeluaran part dengan scan QR (PRD §7.4 dan alur servis: tidak ada part keluar tanpa scan QR).
-- part_issues.scanned mencatat apakah QR barang dan rak diverifikasi saat part dikeluarkan.
-- Setelan part_issue_require_scan (default false) bila true menolak pengeluaran tanpa scan.
-- =============================================================================

alter table public.part_issues add column scanned boolean not null default false;

insert into public.settings (branch_id, key, value, description)
select id, 'part_issue_require_scan', 'false'::jsonb, 'Wajib scan QR barang dan rak saat mengeluarkan part untuk work order'
from public.branches
on conflict (branch_id, key) do nothing;

drop function public.issue_work_order_part(uuid, numeric, uuid, text);

create or replace function public.issue_work_order_part(p_item_id uuid, p_qty numeric, p_location_id uuid, p_note text default null, p_scanned boolean default false)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_line public.work_order_items%rowtype;
  v_wo   public.work_orders%rowtype;
  v_mov  uuid;
  v_val  numeric(18,2);
  v_id   uuid;
begin
  perform app.assert_permission('part_issue', 'update');
  if app.setting_bool('part_issue_require_scan') and not coalesce(p_scanned, false) then
    raise exception 'Pengeluaran part wajib scan QR barang dan rak' using errcode = '22023';
  end if;
  select * into v_line from public.work_order_items where id = p_item_id and branch_id = app.current_branch_id() for update;
  if not found then raise exception 'Baris work order tidak ditemukan' using errcode = 'P0002'; end if;
  v_wo := app.lock_open_wo(v_line.work_order_id);
  if v_wo.status not in ('queued', 'in_progress', 'waiting_parts', 'waiting_approval') then
    raise exception 'Part tidak bisa dikeluarkan untuk WO berstatus %', v_wo.status using errcode = '22023';
  end if;
  if v_line.line_type <> 'part' or v_line.is_cancelled then raise exception 'Baris ini bukan part aktif' using errcode = '22023'; end if;
  if coalesce(p_qty, 0) <= 0 then raise exception 'Jumlah harus lebih dari nol' using errcode = '22023'; end if;
  if v_line.issued_qty + p_qty > v_line.qty then
    raise exception 'Jumlah keluar melebihi kebutuhan WO (sisa %)', trim_scale(v_line.qty - v_line.issued_qty) using errcode = '23514';
  end if;
  perform app.assert_ref('locations', p_location_id, 'Lokasi rak');

  v_id := gen_random_uuid();
  v_mov := app.post_stock_movement(v_line.item_id, p_location_id, 'service_usage', -p_qty, null, 'part_issue', v_id,
                                   v_wo.wo_no || coalesce(' · ' || nullif(btrim(p_note), ''), ''));
  insert into public.part_issues (id, branch_id, work_order_id, work_order_item_id, item_id, location_id, kind, qty, movement_id, note, scanned)
  values (v_id, v_line.branch_id, v_wo.id, v_line.id, v_line.item_id, p_location_id, 'issue', p_qty, v_mov, nullif(btrim(p_note), ''), coalesce(p_scanned, false));
  update public.work_order_items set issued_qty = issued_qty + p_qty where id = v_line.id;

  select round(p_qty * unit_cost, 2) into v_val from public.stock_movements where id = v_mov;
  if v_val > 0 then
    perform app.post_journal(app.today_wib(), 'part_issue', v_id,
      'Part keluar ' || v_wo.wo_no || ': ' || v_line.description,
      jsonb_build_array(jsonb_build_object('account', case when v_wo.is_warranty then 'warranty_expense' else 'wip' end, 'debit', v_val),
                        jsonb_build_object('account', 'inventory', 'credit', v_val)));
  end if;
  return v_id;
end;
$$;


revoke all on function public.issue_work_order_part(uuid, numeric, uuid, text, boolean) from public, anon;
grant execute on function public.issue_work_order_part(uuid, numeric, uuid, text, boolean) to authenticated;
