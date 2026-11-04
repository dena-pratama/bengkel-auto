-- =============================================================================
-- Garansi dihitung dari tanggal invoice (PRD §7.4) dan laporan klaim garansi per mekanik, barang, supplier.
-- Sebelumnya masa garansi dihitung dari tanggal kendaraan diserahkan. Kini: tanggal invoice terbit (posted)
-- untuk WO itu; bila belum ada invoice, jatuh ke tanggal diserahkan.
-- =============================================================================

create or replace function app.wo_warranty_start(p_wo uuid)
returns date
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select min(s.sale_date) from public.sales s where s.work_order_id = p_wo and s.status = 'posted'),
    (select (w.delivered_at at time zone 'Asia/Jakarta')::date from public.work_orders w where w.id = p_wo))
$$;
revoke all on function app.wo_warranty_start(uuid) from public, anon;
grant execute on function app.wo_warranty_start(uuid) to authenticated, service_role;

create or replace view public.v_work_orders with (security_invoker = true) as
  select wo.id, wo.branch_id, wo.wo_no, wo.estimate_id, wo.vehicle_id, wo.customer_id, c.name as customer_name,
         c.phone as customer_phone, wo.plate_no, wo.vehicle_label, wo.odometer_in, wo.complaint, wo.estimated_done_at,
         wo.discount_amount, wo.notes, wo.is_warranty, wo.warranty_source_id, wo.status, wo.status_changed_at,
         wo.started_at, wo.completed_at, wo.delivered_at, wo.void_reason, wo.created_at,
         coalesce(l.subtotal, 0)::numeric(18,2) as subtotal,
         greatest(coalesce(l.subtotal, 0) - wo.discount_amount, 0)::numeric(18,2) as total,
         coalesce(l.duration_minutes, 0)::integer as duration_minutes,
         coalesce(l.services, '') as services,
         coalesce(l.parts, '') as parts,
         coalesce(l.parts_pending, 0)::integer as parts_pending,
         coalesce(l.parts_requested, 0)::integer as parts_requested,
         l.warranty_until,
         coalesce(m.mechanics, '') as mechanics,
         coalesce(m.mechanic_ids, '{}') as mechanic_ids,
         (extract(epoch from now() - wo.status_changed_at) / 60)::integer as minutes_in_status,
         (wo.status in ('queued', 'in_progress', 'waiting_parts', 'waiting_approval', 'quality_check')
          and ((wo.estimated_done_at is not null and now() > wo.estimated_done_at)
               or (wo.estimated_done_at is null and wo.started_at is not null and coalesce(l.duration_minutes, 0) > 0
                   and now() > wo.started_at + make_interval(mins => l.duration_minutes::int)))) as is_overdue,
         (select e.id from public.estimates e
          where e.work_order_id = wo.id and e.is_additional and e.status in ('draft', 'sent')
          order by e.created_at desc limit 1) as pending_estimate_id,
         app.wo_warranty_start(wo.id) as warranty_start
  from public.work_orders wo
  left join public.customers c on c.id = wo.customer_id
  left join lateral (
    select sum(i.line_total) as subtotal,
           sum(i.duration_minutes) filter (where i.line_type = 'service') as duration_minutes,
           string_agg(i.description, ', ' order by i.sort_order) filter (where i.line_type = 'service') as services,
           string_agg(i.description || ' x' || trim_scale(i.qty), ', ' order by i.sort_order) filter (where i.line_type = 'part') as parts,
           count(*) filter (where i.line_type = 'part' and i.issued_qty < i.qty) as parts_pending,
           count(*) filter (where i.line_type = 'part' and i.issued_qty < i.qty and i.issue_requested_at is not null) as parts_requested,
           case when wo.delivered_at is not null and max(i.warranty_days) > 0
                then app.wo_warranty_start(wo.id) + max(i.warranty_days) end as warranty_until
    from public.work_order_items i
    where i.work_order_id = wo.id and not i.is_cancelled
  ) l on true
  left join lateral (
    select string_agg(distinct app.employee_name(x.employee_id), ', ') as mechanics,
           array_agg(distinct x.employee_id) as mechanic_ids
    from public.work_order_mechanics x
    join public.work_order_items i on i.id = x.work_order_item_id and not i.is_cancelled
    where x.work_order_id = wo.id
  ) m on true;

create or replace function public.create_warranty_work_order(p_source_id uuid, p_item_ids uuid[], p_data jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_src  public.work_orders%rowtype;
  v_id   uuid;
  v_odo  integer := nullif(p_data ->> 'odometer', '')::int;
  v_bad  integer;
begin
  perform app.assert_permission('service_orders', 'create');
  select * into v_src from public.work_orders where id = p_source_id and branch_id = app.current_branch_id();
  if not found then raise exception 'Work order asal tidak ditemukan' using errcode = 'P0002'; end if;
  if v_src.status <> 'delivered' then raise exception 'Klaim garansi hanya untuk servis yang sudah diserahkan' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_data ->> 'complaint', ''))) < 3 then raise exception 'Keluhan klaim wajib diisi' using errcode = '22023'; end if;
  if coalesce(array_length(p_item_ids, 1), 0) = 0 then raise exception 'Pilih jasa/part yang diklaim' using errcode = '22023'; end if;

  select count(*) into v_bad from unnest(p_item_ids) x(id)
  where not exists (select 1 from public.work_order_items i
                    where i.id = x.id and i.work_order_id = p_source_id and not i.is_cancelled and i.warranty_days > 0
                      and app.wo_warranty_start(p_source_id) + i.warranty_days >= app.today_wib());
  if v_bad > 0 then raise exception 'Ada baris yang tidak bergaransi atau masa garansinya habis' using errcode = '22023'; end if;

  insert into public.work_orders (branch_id, wo_no, vehicle_id, customer_id, plate_no, vehicle_label, odometer_in, complaint,
                                  is_warranty, warranty_source_id)
  select v_src.branch_id, app.next_document_number('WO', app.today_wib(), v_src.branch_id), v_src.vehicle_id, vv.customer_id,
         vv.plate_no, v_src.vehicle_label, v_odo, btrim(p_data ->> 'complaint'), true, v_src.id
  from public.v_vehicles vv where vv.id = v_src.vehicle_id
  returning id into v_id;

  insert into public.work_order_items (branch_id, work_order_id, warranty_source_item_id, line_type, service_id, item_id, package_id,
                                       description, qty, unit_price, line_total, duration_minutes, warranty_days, sort_order)
  select i.branch_id, v_id, i.id, i.line_type, i.service_id, i.item_id, i.package_id, i.description || ' (garansi)', i.qty, 0, 0,
         i.duration_minutes, 0, row_number() over (order by i.sort_order)
  from public.work_order_items i where i.id = any(p_item_ids);

  insert into public.work_order_status_logs (branch_id, work_order_id, to_status, employee_id, note)
  values (v_src.branch_id, v_id, 'queued', app.current_employee_id(), 'Klaim garansi dari ' || v_src.wo_no);
  if v_odo is not null then
    update public.vehicles set last_odometer = greatest(coalesce(last_odometer, 0), v_odo) where id = v_src.vehicle_id;
  end if;
  return v_id;
end;
$$;

-- =============================================================================
-- Laporan klaim garansi (PRD §7.4): sumber masalah berulang per mekanik, barang, dan supplier.
-- Hanya izin laporan keuangan (berisi nilai HPP part). Biaya = HPP part yang keluar untuk WO garansi dikurangi yang kembali;
-- biaya jasa (waktu mekanik) tidak dihitung.
-- =============================================================================
create or replace function public.report_warranty_claims(p_from date, p_to date)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_result jsonb;
begin
  perform app.assert_permission('finance_reports', 'view');
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Rentang tanggal tidak valid' using errcode = '22023'; end if;

  create temporary table pg_temp.wc on commit drop as
  select cl.id as claim_item_id, w.id as claim_wo_id, w.wo_no, w.plate_no, w.created_at, cl.description, cl.item_id, cl.service_id, cl.line_type,
         src.id as src_item_id, sw.wo_no as src_wo_no, app.wo_warranty_start(sw.id) as src_date,
         coalesce((select sum(case when pi.kind = 'issue' then 1 else -1 end * round(pi.qty * m.unit_cost, 2))
                     from public.part_issues pi join public.stock_movements m on m.id = pi.movement_id
                    where pi.work_order_item_id = cl.id), 0)::numeric(18,2) as part_cost
  from public.work_order_items cl
  join public.work_orders w on w.id = cl.work_order_id and w.is_warranty and w.status <> 'void'
  left join public.work_order_items src on src.id = cl.warranty_source_item_id
  left join public.work_orders sw on sw.id = src.work_order_id
  where w.branch_id = v_branch and not cl.is_cancelled
    and (w.created_at at time zone 'Asia/Jakarta')::date between p_from and p_to;

  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'claim_lines', (select count(*) from pg_temp.wc),
    'claim_orders', (select count(distinct claim_wo_id) from pg_temp.wc),
    'part_cost', (select coalesce(sum(part_cost), 0) from pg_temp.wc),
    'by_mechanic', coalesce((select jsonb_agg(to_jsonb(x) order by x.claims desc, x.part_cost desc) from (
        select app.employee_name(wm.employee_id) as name, count(*)::int as claims,
               round(sum(c.part_cost * wm.share_percent / 100), 2) as part_cost
        from pg_temp.wc c join public.work_order_mechanics wm on wm.work_order_item_id = c.src_item_id
        group by wm.employee_id) x), '[]'),
    'by_item', coalesce((select jsonb_agg(to_jsonb(x) order by x.claims desc, x.part_cost desc) from (
        select coalesce(it.sku, sv.code) as code, coalesce(it.name, sv.name, c.description) as name,
               case when c.line_type = 'part' then 'part' else 'jasa' end as kind, count(*)::int as claims, sum(c.part_cost) as part_cost
        from pg_temp.wc c left join public.items it on it.id = c.item_id left join public.services sv on sv.id = c.service_id
        group by 1, 2, 3) x), '[]'),
    'by_supplier', coalesce((select jsonb_agg(to_jsonb(x) order by x.claims desc, x.part_cost desc) from (
        select coalesce(su.name, 'Tidak diketahui') as name, count(*)::int as claims, sum(c.part_cost) as part_cost
        from pg_temp.wc c
        left join lateral (
          select gr.supplier_id from public.goods_receipt_items gi join public.goods_receipts gr on gr.id = gi.receipt_id
          where gi.item_id = c.item_id and gr.status = 'posted' and gr.receipt_date <= coalesce(c.src_date, current_date)
          order by gr.receipt_date desc, gr.created_at desc limit 1) sup on true
        left join public.suppliers su on su.id = sup.supplier_id
        where c.line_type = 'part'
        group by 1) x), '[]'),
    'claims', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select c.wo_no, c.src_wo_no, c.plate_no, c.description, c.part_cost, (c.created_at at time zone 'Asia/Jakarta')::date as created_at
        from pg_temp.wc c order by c.created_at desc limit 100) x), '[]'),
    'source', 'Work order bertanda garansi dalam periode; sumber masalah dilacak ke baris servis asalnya'
  ) into v_result;
  drop table pg_temp.wc;
  return v_result;
end;
$$;
revoke all on function public.report_warranty_claims(date, date) from public, anon;
grant execute on function public.report_warranty_claims(date, date) to authenticated;
