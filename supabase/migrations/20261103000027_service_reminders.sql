-- =============================================================================
-- Reminder servis berkala (PRD §6.4): aturan per jasa (km atau bulan, mana yang lebih dulu),
-- daftar kendaraan yang perlu dihubungi, dan catatan "sudah dihubungi/diabaikan".
-- MVP klik-ke-WhatsApp: pengiriman otomatis lewat gateway masuk Fase 2.
-- =============================================================================

create table public.service_reminder_rules (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid not null references public.branches(id),
  service_id      uuid not null references public.services(id),
  interval_km     integer check (interval_km > 0),
  interval_months integer check (interval_months > 0),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  created_by      uuid default auth.uid(),
  updated_at      timestamptz not null default now(),
  unique (service_id),
  check (interval_km is not null or interval_months is not null)
);

create table public.service_reminders (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid not null references public.branches(id),
  vehicle_id   uuid not null references public.vehicles(id),
  rule_id      uuid not null references public.service_reminder_rules(id),
  source_wo_id uuid not null references public.work_orders(id),   -- servis terakhir yang memicu reminder ini
  status       text not null check (status in ('contacted', 'dismissed')),
  note         text,
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  updated_at   timestamptz not null default now(),
  unique (rule_id, vehicle_id, source_wo_id)
);

do $$
declare
  t text;
begin
  foreach t in array array['service_reminder_rules', 'service_reminders'] loop
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

-- Atur aturan reminder satu jasa (buat atau ubah; nonaktifkan lewat p_active = false)
create or replace function public.save_reminder_rule(p_service_id uuid, p_interval_km integer, p_interval_months integer, p_active boolean default true)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform app.assert_permission('master_data', 'update');
  perform app.assert_ref('services', p_service_id, 'Jasa');
  if p_interval_km is null and p_interval_months is null then
    raise exception 'Isi jarak tempuh (km) atau jarak waktu (bulan), atau keduanya' using errcode = '22023';
  end if;
  if coalesce(p_interval_km, 1) <= 0 or coalesce(p_interval_km, 1) > 200000 then raise exception 'Jarak tempuh harus 1 sampai 200.000 km' using errcode = '22023'; end if;
  if coalesce(p_interval_months, 1) <= 0 or coalesce(p_interval_months, 1) > 60 then raise exception 'Jarak waktu harus 1 sampai 60 bulan' using errcode = '22023'; end if;
  insert into public.service_reminder_rules (branch_id, service_id, interval_km, interval_months, is_active)
  values (app.current_branch_id(), p_service_id, p_interval_km, p_interval_months, coalesce(p_active, true))
  on conflict (service_id) do update
    set interval_km = excluded.interval_km, interval_months = excluded.interval_months, is_active = excluded.is_active
  returning id into v_id;
  return v_id;
end;
$$;

-- Kendaraan yang perlu dihubungi: servis terakhir tiap jasa + aturan -> perkiraan jatuh tempo.
-- Jatuh tempo = yang lebih dulu antara waktu (bulan) dan jarak tempuh. Jarak tempuh diproyeksikan dengan
-- rata-rata pemakaian kendaraan (km per hari dari riwayat servis); bila km terakhir kendaraan sudah melewati batas, jatuh tempo hari ini.
create or replace function public.list_due_reminders(p_days integer default 7)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_today  date := app.today_wib();
  v_days   integer := least(greatest(coalesce(p_days, 7), 0), 365);
begin
  perform app.assert_permission('customers', 'view');
  return coalesce((
    with last_wo as (
      select r.id as rule_id, r.service_id, r.interval_km, r.interval_months, w.vehicle_id, w.id as wo_id,
             (w.delivered_at at time zone 'Asia/Jakarta')::date as last_date, w.odometer_in as last_odo,
             row_number() over (partition by r.id, w.vehicle_id order by w.delivered_at desc) as rn
      from public.service_reminder_rules r
      join public.work_order_items i on i.service_id = r.service_id and i.line_type = 'service' and not i.is_cancelled
      join public.work_orders w on w.id = i.work_order_id and w.status = 'delivered' and not w.is_warranty
      where r.branch_id = v_branch and r.is_active
    ), usage as (
      select w.vehicle_id, min(w.odometer_in) as o_min, max(w.odometer_in) as o_max,
             min((w.delivered_at at time zone 'Asia/Jakarta')::date) as d_min, max((w.delivered_at at time zone 'Asia/Jakarta')::date) as d_max
      from public.work_orders w
      where w.branch_id = v_branch and w.status = 'delivered' and not w.is_warranty and w.odometer_in is not null
      group by w.vehicle_id
    ), calc as (
      select l.*, v.plate_no, v.last_odometer,
             trim(concat_ws(' ', mk.name, md.name, v.year::text)) as vehicle_label,
             o.customer_id, c.name as customer_name, c.phone as customer_phone, s.name as service_name,
             case when u.d_max > u.d_min and u.o_max > u.o_min then (u.o_max - u.o_min)::numeric / (u.d_max - u.d_min) end as km_per_day,
             case when l.interval_months is not null then (l.last_date + make_interval(months => l.interval_months))::date end as due_time
      from last_wo l
      join public.vehicles v on v.id = l.vehicle_id and v.is_active
      join public.services s on s.id = l.service_id
      left join public.vehicle_models md on md.id = v.model_id
      left join public.vehicle_makes mk on mk.id = md.make_id
      left join public.vehicle_ownerships o on o.vehicle_id = v.id and o.ended_at is null
      left join public.customers c on c.id = o.customer_id
      left join usage u on u.vehicle_id = l.vehicle_id
      where l.rn = 1
        and not exists (select 1 from public.service_reminders sr where sr.rule_id = l.rule_id and sr.vehicle_id = l.vehicle_id and sr.source_wo_id = l.wo_id)
    ), due as (
      select c.*,
             case when c.interval_km is not null and c.last_odo is not null then
                    case when coalesce(c.last_odometer, 0) >= c.last_odo + c.interval_km then v_today
                         when c.km_per_day > 0 then c.last_date + ceil(c.interval_km / c.km_per_day)::int end
             end as due_km
      from calc c
    )
    select jsonb_agg(jsonb_build_object(
      'vehicle_id', d.vehicle_id, 'rule_id', d.rule_id, 'source_wo_id', d.wo_id, 'plate_no', d.plate_no, 'vehicle', d.vehicle_label,
      'customer_id', d.customer_id, 'customer_name', d.customer_name, 'customer_phone', d.customer_phone,
      'service_name', d.service_name, 'last_date', d.last_date, 'last_odometer', d.last_odo, 'current_odometer', d.last_odometer,
      'interval_km', d.interval_km, 'interval_months', d.interval_months,
      'due_date', least(d.due_time, d.due_km), 'days_until', least(d.due_time, d.due_km) - v_today,
      'due_by', case when d.due_time is not null and (d.due_km is null or d.due_time <= d.due_km) then 'waktu' else 'km' end
    ) order by least(d.due_time, d.due_km), d.plate_no)
    from due d
    where least(d.due_time, d.due_km) is not null and least(d.due_time, d.due_km) <= v_today + v_days
  ), '[]'::jsonb);
end;
$$;

-- Tandai reminder: sudah dihubungi, atau diabaikan (tidak muncul lagi sampai ada servis berikutnya)
create or replace function public.mark_service_reminder(p_vehicle_id uuid, p_rule_id uuid, p_wo_id uuid, p_status text, p_note text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform app.assert_permission('customers', 'update');
  if p_status not in ('contacted', 'dismissed') then raise exception 'Status reminder tidak valid' using errcode = '22023'; end if;
  perform app.assert_ref('vehicles', p_vehicle_id, 'Kendaraan');
  if not exists (select 1 from public.service_reminder_rules where id = p_rule_id and branch_id = app.current_branch_id()) then
    raise exception 'Aturan reminder tidak ditemukan' using errcode = '22023';
  end if;
  if not exists (select 1 from public.work_orders where id = p_wo_id and vehicle_id = p_vehicle_id and branch_id = app.current_branch_id()) then
    raise exception 'Work order tidak ditemukan untuk kendaraan ini' using errcode = '22023';
  end if;
  insert into public.service_reminders (branch_id, vehicle_id, rule_id, source_wo_id, status, note)
  values (app.current_branch_id(), p_vehicle_id, p_rule_id, p_wo_id, p_status, nullif(btrim(p_note), ''))
  on conflict (rule_id, vehicle_id, source_wo_id) do update set status = excluded.status, note = excluded.note;
end;
$$;

revoke all on function public.save_reminder_rule(uuid, integer, integer, boolean), public.list_due_reminders(integer),
  public.mark_service_reminder(uuid, uuid, uuid, text, text) from public, anon;
grant execute on function public.save_reminder_rule(uuid, integer, integer, boolean), public.list_due_reminders(integer),
  public.mark_service_reminder(uuid, uuid, uuid, text, text) to authenticated;
