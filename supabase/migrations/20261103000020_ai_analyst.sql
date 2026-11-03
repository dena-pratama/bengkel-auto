-- =============================================================================
-- AI Business Analyst (PRD §13): tool analitik read-only, skor kesehatan bisnis, token akses per pengguna,
-- log panggilan (audit), dan penyimpanan ringkasan mingguan.
-- Tool hanya memanggil fungsi SQL yang sudah dihitung (bukan query bebas). Semua tool membaca data saja,
-- dibatasi izin ai_analyst (Owner), dan setiap panggilan tercatat: siapa, kapan, tool apa, parameter apa.
-- Data pribadi pelanggan (HP, alamat) tidak pernah dikembalikan oleh tool.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabel
-- -----------------------------------------------------------------------------
create table public.ai_tokens (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references public.branches(id),
  employee_id   uuid not null references public.employees(id),
  name          text not null check (length(btrim(name)) between 2 and 60),
  token_prefix  text not null,                 -- 8 karakter pertama untuk dikenali; token utuh tidak disimpan
  token_hash    bytea not null unique,         -- sha256
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  updated_at    timestamptz not null default now()
);

create table public.ai_tool_calls (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches(id),
  employee_id uuid references public.employees(id),
  tool        text not null,
  params      jsonb not null default '{}',
  source      text not null check (source in ('app', 'mcp')),
  ok          boolean not null,
  error       text,
  duration_ms integer,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now()
);
create index idx_ai_tool_calls_created on public.ai_tool_calls (branch_id, created_at desc);

create table public.ai_insights (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references public.branches(id),
  kind        text not null default 'weekly',
  score       numeric(5,1),
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now()
);
create index idx_ai_insights_created on public.ai_insights (branch_id, kind, created_at desc);

do $$
declare
  t text;
begin
  foreach t in array array['ai_tokens', 'ai_tool_calls', 'ai_insights'] loop
    execute format('create trigger trg_%1$s_updated_at before update on public.%1$I
                    for each row execute function app.set_updated_at()', t);
    execute format('create trigger trg_no_delete before delete on public.%I
                    for each row execute function app.prevent_modification()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
    execute format('create policy %1$s_select on public.%1$I for select to authenticated
                    using (branch_id = app.current_branch_id() and (app.has_permission(''ai_analyst'', ''view'') or app.has_permission(''audit_log'', ''view'')))', t);
  end loop;
  -- Log panggilan append-only
  execute 'create trigger trg_ai_tool_calls_immutable before update on public.ai_tool_calls for each row execute function app.prevent_modification()';
end $$;
revoke select on public.ai_tokens from authenticated;
grant select (id, branch_id, employee_id, name, token_prefix, last_used_at, revoked_at, created_at, created_by, updated_at) on public.ai_tokens to authenticated;
grant select on public.ai_tool_calls, public.ai_insights to authenticated;

-- =============================================================================
-- Helper hitungan
-- =============================================================================

-- Laba rugi ringkas satu periode dari jurnal (pendapatan tanpa PPN, sudah memuat diskon dan retur)
create or replace function app.pl_totals(p_from date, p_to date)
returns table (revenue numeric, service_revenue numeric, parts_revenue numeric, cogs numeric, expense numeric, other_net numeric, tax numeric)
language sql stable security definer
set search_path = ''
as $$
  with t as (
    select a.type, a.system_key, sum(l.credit - l.debit) as cr, sum(l.debit - l.credit) as dr
    from public.journal_lines l
    join public.journal_entries e on e.id = l.entry_id
    join public.accounts a on a.id = l.account_id
    where a.branch_id = app.current_branch_id() and e.entry_date between p_from and p_to
      and a.type in ('revenue', 'cogs', 'expense', 'other')
    group by a.type, a.system_key
  )
  select coalesce(sum(cr) filter (where type = 'revenue'), 0)::numeric,
         coalesce(sum(cr) filter (where system_key = 'service_revenue'), 0)::numeric,
         coalesce(sum(cr) filter (where system_key = 'parts_revenue'), 0)::numeric,
         coalesce(sum(dr) filter (where type = 'cogs'), 0)::numeric,
         coalesce(sum(dr) filter (where type = 'expense' and system_key is distinct from 'pph_final_expense'), 0)::numeric,
         coalesce(sum(cr) filter (where type = 'other'), 0)::numeric,
         coalesce(sum(dr) filter (where system_key = 'pph_final_expense'), 0)::numeric
  from t
$$;

create or replace function app.ai_indicator(p_key text, p_label text, p_value numeric, p_unit text, p_rule text, p_state text, p_note text)
returns jsonb
language sql immutable
set search_path = ''
as $$
  select jsonb_build_object('key', p_key, 'label', p_label, 'value', p_value, 'unit', p_unit, 'rule', p_rule, 'state', p_state,
                            'score', case p_state when 'ok' then 100 when 'warn' then 60 when 'bad' then 20 else null end, 'note', p_note)
$$;

create or replace function app.ai_pct(p_part numeric, p_whole numeric)
returns numeric
language sql immutable
set search_path = ''
as $$ select case when coalesce(p_whole, 0) = 0 then null else round(p_part * 100 / p_whole, 1) end $$;

-- =============================================================================
-- Tool 1: get_business_summary
-- =============================================================================
create or replace function app.ai_business_summary(p_params jsonb)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_today  date := app.today_wib();
  v_from   date := coalesce(nullif(p_params ->> 'from', '')::date, date_trunc('month', v_today)::date);
  v_to     date := coalesce(nullif(p_params ->> 'to', '')::date, v_today);
  v_days   integer;
  v_pfrom  date;
  v_pto    date;
  c        record;
  p        record;
  v_inv    integer;
  v_ticket numeric;
  v_wo_new integer;
  v_wo_done integer;
begin
  if v_to < v_from then raise exception 'Tanggal akhir sebelum tanggal awal' using errcode = '22023'; end if;
  v_days := v_to - v_from + 1;
  v_pto := v_from - 1;
  v_pfrom := v_pto - (v_days - 1);
  select * into c from app.pl_totals(v_from, v_to);
  select * into p from app.pl_totals(v_pfrom, v_pto);
  select count(*), coalesce(round(avg(s.total - s.ppn_amount), 0), 0) into v_inv, v_ticket
    from public.sales s where s.branch_id = app.current_branch_id() and s.status = 'posted' and s.sale_date between v_from and v_to;
  select count(*) into v_wo_new from public.work_orders w where w.branch_id = app.current_branch_id() and w.status <> 'void'
     and (w.created_at at time zone 'Asia/Jakarta')::date between v_from and v_to;
  select count(*) into v_wo_done from public.work_orders w where w.branch_id = app.current_branch_id() and w.status = 'delivered'
     and (w.delivered_at at time zone 'Asia/Jakarta')::date between v_from and v_to;
  return jsonb_build_object(
    'period', jsonb_build_object('from', v_from, 'to', v_to, 'days', v_days),
    'revenue', c.revenue, 'service_revenue', c.service_revenue, 'parts_revenue', c.parts_revenue, 'cogs', c.cogs,
    'gross_profit', c.revenue - c.cogs, 'gross_margin_pct', app.ai_pct(c.revenue - c.cogs, c.revenue),
    'operating_expense', c.expense, 'other_income', c.other_net, 'income_tax', c.tax,
    'net_profit', c.revenue - c.cogs - c.expense + c.other_net - c.tax,
    'net_margin_pct', app.ai_pct(c.revenue - c.cogs - c.expense + c.other_net - c.tax, c.revenue),
    'invoice_count', v_inv, 'avg_invoice_value', v_ticket, 'work_orders_created', v_wo_new, 'work_orders_delivered', v_wo_done,
    'previous_period', jsonb_build_object('from', v_pfrom, 'to', v_pto, 'revenue', p.revenue, 'gross_profit', p.revenue - p.cogs,
                                          'net_profit', p.revenue - p.cogs - p.expense + p.other_net - p.tax),
    'source', 'Jurnal akuntansi (laba rugi, tanpa PPN) dan invoice yang diposting; sama dengan laporan Keuangan');
end;
$$;

-- =============================================================================
-- Tool 2: get_health_score (PRD §13.3)
-- =============================================================================
create or replace function app.ai_health_score()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_today  date := app.today_wib();
  v_m0     date := date_trunc('month', v_today)::date;
  v_items  jsonb := '[]';
  c        record;  m1 record;  m2 record;  m3 record;  m4 record;  r90 record;
  v_g0 numeric; v_g1 numeric; v_g2 numeric; v_g3 numeric; v_base numeric;
  v_n1 numeric; v_n2 numeric;
  v_cash numeric; v_burn numeric; v_days numeric;
  v_inv numeric; v_dead numeric; v_turn numeric;
  v_ar numeric; v_ar60 numeric;
  v_cohort integer; v_back integer;
  v_shift integer; v_acc numeric;
  v_state text;
  v_score numeric;
  v_ok integer; v_warn integer; v_bad integer; v_na integer;
begin
  select * into c  from app.pl_totals(v_m0, v_today);
  select * into m1 from app.pl_totals((v_m0 - interval '1 month')::date, v_m0 - 1);
  select * into m2 from app.pl_totals((v_m0 - interval '2 month')::date, (v_m0 - interval '1 month')::date - 1);
  select * into m3 from app.pl_totals((v_m0 - interval '3 month')::date, (v_m0 - interval '2 month')::date - 1);
  select * into m4 from app.pl_totals((v_m0 - interval '4 month')::date, (v_m0 - interval '3 month')::date - 1);
  select * into r90 from app.pl_totals(v_today - 89, v_today);

  -- 1. Margin laba kotor: bulan ini vs rata-rata 3 bulan sebelumnya
  v_g0 := app.ai_pct(c.revenue - c.cogs, c.revenue);
  v_g1 := app.ai_pct(m1.revenue - m1.cogs, m1.revenue);
  v_g2 := app.ai_pct(m2.revenue - m2.cogs, m2.revenue);
  v_g3 := app.ai_pct(m3.revenue - m3.cogs, m3.revenue);
  select avg(x) into v_base from unnest(array[v_g1, v_g2, v_g3]) x;
  v_state := case when v_g0 is null or v_base is null then 'na' when v_base - v_g0 > 5 then 'bad' when v_base - v_g0 > 2 then 'warn' else 'ok' end;
  v_items := v_items || app.ai_indicator('gross_margin', 'Margin laba kotor', v_g0, '%', 'Turun lebih dari 5 poin dari rata-rata 3 bulan', v_state,
    case when v_g0 is null or v_base is null then 'Belum cukup data bulan ini atau 3 bulan sebelumnya'
         else format('Bulan ini %s%%, rata-rata 3 bulan sebelumnya %s%%', v_g0, round(v_base, 1)) end);

  -- 2. Margin laba bersih: dua bulan terakhir yang selesai
  v_n1 := app.ai_pct(m1.revenue - m1.cogs - m1.expense + m1.other_net - m1.tax, m1.revenue);
  v_n2 := app.ai_pct(m2.revenue - m2.cogs - m2.expense + m2.other_net - m2.tax, m2.revenue);
  v_state := case when v_n1 is null and v_n2 is null then 'na' when coalesce(v_n1, 0) < 0 and coalesce(v_n2, 0) < 0 then 'bad'
                  when coalesce(v_n1, 0) < 0 then 'warn' else 'ok' end;
  v_items := v_items || app.ai_indicator('net_margin', 'Margin laba bersih', v_n1, '%', 'Negatif 2 bulan berturut-turut', v_state,
    format('Bulan lalu %s%%, 2 bulan lalu %s%%', coalesce(v_n1::text, '-'), coalesce(v_n2::text, '-')));

  -- 3. Ketahanan kas: saldo kas dan bank / rata-rata biaya harian 90 hari
  select coalesce(sum(l.debit - l.credit), 0) into v_cash
    from public.journal_lines l join public.cash_bank_accounts cb on cb.account_id = l.account_id
    join public.journal_entries e on e.id = l.entry_id
   where cb.branch_id = v_branch and cb.is_active and e.entry_date <= v_today;
  v_burn := (r90.cogs + r90.expense) / 90;
  v_days := case when v_burn > 0 then round(v_cash / v_burn, 0) end;
  v_state := case when v_days is null then 'na' when v_days < 30 then 'bad' when v_days < 60 then 'warn' else 'ok' end;
  v_items := v_items || app.ai_indicator('cash_runway', 'Ketahanan kas', v_days, 'hari', 'Kurang dari 30 hari biaya', v_state,
    format('Saldo kas dan bank Rp%s, biaya rata-rata Rp%s per hari (90 hari terakhir)', round(v_cash, 0), round(v_burn, 0)));

  -- 4 dan 5. Persediaan: perputaran dan dead stock
  select coalesce(sum(b.qty * c2.avg_cost), 0) into v_inv from public.stock_balances b join public.item_costs c2 on c2.item_id = b.item_id
   where b.branch_id = v_branch and b.qty > 0;
  v_turn := case when r90.cogs > 0 and v_inv > 0 then round(v_inv / (r90.cogs / 90), 0) end;
  v_state := case when v_turn is null then 'na' when v_turn > 90 then 'bad' when v_turn > 60 then 'warn' else 'ok' end;
  v_items := v_items || app.ai_indicator('inventory_turnover', 'Perputaran stok', v_turn, 'hari', 'Lebih dari 90 hari', v_state,
    format('Nilai persediaan Rp%s, HPP rata-rata Rp%s per hari', round(v_inv, 0), round(r90.cogs / 90, 0)));

  select coalesce(sum(oh.qty * c2.avg_cost), 0) into v_dead
    from (select item_id, sum(qty) as qty from public.stock_balances where branch_id = v_branch group by item_id having sum(qty) > 0) oh
    join public.item_costs c2 on c2.item_id = oh.item_id
    join public.items i on i.id = oh.item_id
   where i.created_at < now() - interval '90 days'
     and not exists (select 1 from public.stock_movements m where m.item_id = oh.item_id and m.qty < 0
                     and m.movement_type in ('sale', 'service_usage') and m.created_at >= now() - interval '90 days');
  v_state := case when v_inv <= 0 then 'na' when v_dead * 100 / v_inv > 15 then 'bad' when v_dead * 100 / v_inv > 8 then 'warn' else 'ok' end;
  v_items := v_items || app.ai_indicator('dead_stock', 'Dead stock', app.ai_pct(v_dead, v_inv), '%', 'Lebih dari 15% nilai persediaan', v_state,
    format('Barang tanpa pemakaian 90 hari bernilai Rp%s dari Rp%s', round(v_dead, 0), round(v_inv, 0)));

  -- 6. Kualitas piutang
  select coalesce(sum(outstanding), 0), coalesce(sum(outstanding) filter (where age_bucket = '>60'), 0) into v_ar, v_ar60
    from public.v_sales where branch_id = v_branch and status = 'posted' and outstanding > 0;
  v_state := case when v_ar <= 0 then 'na' when v_ar60 * 100 / v_ar > 20 then 'bad' when v_ar60 * 100 / v_ar > 10 then 'warn' else 'ok' end;
  v_items := v_items || app.ai_indicator('receivable_quality', 'Kualitas piutang', app.ai_pct(v_ar60, v_ar), '%', 'Piutang lebih dari 60 hari melebihi 20%', v_state,
    format('Piutang Rp%s, lebih dari 60 hari Rp%s', round(v_ar, 0), round(v_ar60, 0)));

  -- 7. Pertumbuhan omzet: turun berturut-turut
  v_state := case when m2.revenue <= 0 then 'na'
                  when m1.revenue < m2.revenue and m2.revenue < m3.revenue and m3.revenue < m4.revenue and m4.revenue > 0 then 'bad'
                  when m1.revenue < m2.revenue and m2.revenue < m3.revenue then 'warn' else 'ok' end;
  v_items := v_items || app.ai_indicator('revenue_growth', 'Pertumbuhan omzet', app.ai_pct(m1.revenue - m2.revenue, m2.revenue), '%', 'Turun 3 bulan berturut-turut', v_state,
    format('Omzet 4 bulan terakhir (terbaru dulu): Rp%s, Rp%s, Rp%s, Rp%s', round(m1.revenue, 0), round(m2.revenue, 0), round(m3.revenue, 0), round(m4.revenue, 0)));

  -- 8. Retensi pelanggan: pelanggan 6-12 bulan lalu yang kembali dalam 6 bulan terakhir
  with cohort as (
    select distinct customer_id from public.sales where branch_id = v_branch and status = 'posted' and customer_id is not null
       and sale_date >= v_today - 365 and sale_date < v_today - 182
  ), back as (
    select distinct customer_id from public.sales where branch_id = v_branch and status = 'posted' and customer_id is not null and sale_date >= v_today - 182
  )
  select count(*), count(*) filter (where customer_id in (select customer_id from back)) into v_cohort, v_back from cohort;
  v_state := case when v_cohort = 0 then 'na' when v_back * 100.0 / v_cohort < 40 then 'bad' when v_back * 100.0 / v_cohort < 55 then 'warn' else 'ok' end;
  v_items := v_items || app.ai_indicator('retention', 'Retensi pelanggan', app.ai_pct(v_back, v_cohort), '%', 'Pelanggan yang kembali dalam 6 bulan di bawah 40%', v_state,
    format('%s dari %s pelanggan 6 sampai 12 bulan lalu kembali', v_back, v_cohort));

  -- 9. Kedisiplinan operasional: selisih kas 30 hari dan akurasi opname 90 hari
  select count(*) into v_shift from public.cash_shifts where branch_id = v_branch and status in ('closed', 'approved')
     and coalesce(variance, 0) <> 0 and closed_at >= now() - interval '30 days';
  select avg(matched_items * 100.0 / nullif(total_items, 0)) into v_acc from public.stock_opnames
   where branch_id = v_branch and status = 'posted' and approved_at >= now() - interval '90 days';
  v_state := case when v_shift > 3 or coalesce(v_acc, 100) < 80 then 'bad' when v_shift > 1 or coalesce(v_acc, 100) < 95 then 'warn'
                  when (select count(*) from public.cash_shifts where branch_id = v_branch and closed_at >= now() - interval '30 days') = 0 and v_acc is null then 'na'
                  else 'ok' end;
  v_items := v_items || app.ai_indicator('discipline', 'Kedisiplinan operasional', v_shift, 'kali selisih kas', 'Selisih kas lebih dari 3 kali sebulan', v_state,
    format('%s shift berselisih dalam 30 hari; akurasi opname 90 hari %s', v_shift, coalesce(round(v_acc, 1)::text || '%', 'belum ada opname')));

  select avg((x ->> 'score')::numeric), count(*) filter (where x ->> 'state' = 'ok'), count(*) filter (where x ->> 'state' = 'warn'),
         count(*) filter (where x ->> 'state' = 'bad'), count(*) filter (where x ->> 'state' = 'na')
    into v_score, v_ok, v_warn, v_bad, v_na from jsonb_array_elements(v_items) x;

  return jsonb_build_object('score', round(v_score, 0), 'computed_on', v_today, 'indicators', v_items,
    'summary', jsonb_build_object('ok', v_ok, 'warn', v_warn, 'bad', v_bad, 'no_data', v_na),
    'note', 'Skor 0-100: rata-rata indikator yang punya data (aman 100, waspada 60, bahaya 20). Ambang bisa diatur di versi berikutnya.');
end;
$$;

-- =============================================================================
-- Tool 3: get_sales_trend  (granularity: day | week | month)
-- =============================================================================
create or replace function app.ai_sales_trend(p_params jsonb)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_today date := app.today_wib();
  v_from  date := coalesce(nullif(p_params ->> 'from', '')::date, v_today - 29);
  v_to    date := coalesce(nullif(p_params ->> 'to', '')::date, v_today);
  v_gran  text := coalesce(nullif(p_params ->> 'granularity', ''), 'day');
begin
  if v_gran not in ('day', 'week', 'month') then raise exception 'granularity harus day, week, atau month' using errcode = '22023'; end if;
  return jsonb_build_object('period', jsonb_build_object('from', v_from, 'to', v_to), 'granularity', v_gran,
    'buckets', coalesce((
      select jsonb_agg(jsonb_build_object('bucket', b, 'service_revenue', svc, 'parts_revenue', prt, 'total', svc + prt) order by b)
      from (
        select date_trunc(v_gran, e.entry_date)::date as b,
               coalesce(sum(l.credit - l.debit) filter (where a.system_key = 'service_revenue'), 0) as svc,
               coalesce(sum(l.credit - l.debit) filter (where a.system_key = 'parts_revenue'), 0) as prt
        from public.journal_lines l join public.journal_entries e on e.id = l.entry_id join public.accounts a on a.id = l.account_id
        where a.branch_id = app.current_branch_id() and a.system_key in ('service_revenue', 'parts_revenue') and e.entry_date between v_from and v_to
        group by 1
      ) x), '[]'),
    'source', 'Jurnal akun Pendapatan Jasa dan Penjualan Sparepart (tanpa PPN)');
end;
$$;

-- =============================================================================
-- Tool 4: get_stock_alerts
-- =============================================================================
create or replace function app.ai_stock_alerts()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
begin
  return jsonb_build_object(
    'low_stock', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select i.sku, i.name, round(oh.qty, 3) as qty, i.min_stock from public.items i
        join (select item_id, sum(qty) as qty from public.stock_balances where branch_id = v_branch group by item_id) oh on oh.item_id = i.id
        where i.branch_id = v_branch and i.is_active and i.min_stock > 0 and oh.qty > 0 and oh.qty <= i.min_stock
        order by oh.qty / i.min_stock limit 15) x), '[]'),
    'out_of_stock', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select i.sku, i.name, i.min_stock from public.items i
        left join (select item_id, sum(qty) as qty from public.stock_balances where branch_id = v_branch group by item_id) oh on oh.item_id = i.id
        where i.branch_id = v_branch and i.is_active and i.min_stock > 0 and coalesce(oh.qty, 0) <= 0 order by i.name limit 15) x), '[]'),
    'dead_stock', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select i.sku, i.name, round(oh.qty, 3) as qty, round(oh.qty * c.avg_cost, 0) as value,
               (select max((m.created_at at time zone 'Asia/Jakarta')::date) from public.stock_movements m
                where m.item_id = i.id and m.qty < 0 and m.movement_type in ('sale', 'service_usage')) as last_used
        from public.items i
        join (select item_id, sum(qty) as qty from public.stock_balances where branch_id = v_branch group by item_id having sum(qty) > 0) oh on oh.item_id = i.id
        join public.item_costs c on c.item_id = i.id
        where i.branch_id = v_branch and i.created_at < now() - interval '90 days'
          and not exists (select 1 from public.stock_movements m where m.item_id = i.id and m.qty < 0
                          and m.movement_type in ('sale', 'service_usage') and m.created_at >= now() - interval '90 days')
        order by oh.qty * c.avg_cost desc limit 15) x), '[]'),
    'overstock', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select i.sku, i.name, round(oh.qty, 3) as qty, i.min_stock from public.items i
        join (select item_id, sum(qty) as qty from public.stock_balances where branch_id = v_branch group by item_id) oh on oh.item_id = i.id
        where i.branch_id = v_branch and i.is_active and i.min_stock > 0 and oh.qty > i.min_stock * 4 order by oh.qty / i.min_stock desc limit 15) x), '[]'),
    'definitions', 'Menipis: stok sampai batas minimum. Habis: stok nol dengan batas minimum diatur. Dead stock: ada stok, tanpa pemakaian 90 hari. Overstock: stok lebih dari 4x batas minimum.');
end;
$$;

-- =============================================================================
-- Tool 5: get_top_items
-- =============================================================================
create or replace function app.ai_top_items(p_params jsonb)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_today date := app.today_wib();
  v_from  date := coalesce(nullif(p_params ->> 'from', '')::date, date_trunc('month', v_today)::date);
  v_to    date := coalesce(nullif(p_params ->> 'to', '')::date, v_today);
  v_limit integer := least(greatest(coalesce(nullif(p_params ->> 'limit', '')::int, 5), 1), 20);
begin
  return jsonb_build_object('period', jsonb_build_object('from', v_from, 'to', v_to),
    'services_by_revenue', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select sv.code, sv.name, sum(si.qty) as qty, sum(si.net_amount) as revenue
        from public.sale_items si join public.sales s on s.id = si.sale_id join public.services sv on sv.id = si.service_id
        where s.branch_id = app.current_branch_id() and s.status = 'posted' and s.sale_date between v_from and v_to
        group by sv.code, sv.name order by 4 desc limit v_limit) x), '[]'),
    'parts_by_revenue', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select it.sku, it.name, sum(si.qty) as qty, sum(si.net_amount) as revenue, sum(si.net_amount - si.cost_total) as margin
        from public.sale_items si join public.sales s on s.id = si.sale_id join public.items it on it.id = si.item_id
        where s.branch_id = app.current_branch_id() and s.status = 'posted' and s.sale_date between v_from and v_to
        group by it.sku, it.name order by 4 desc limit v_limit) x), '[]'),
    'parts_by_margin', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select it.sku, it.name, sum(si.qty) as qty, sum(si.net_amount) as revenue, sum(si.net_amount - si.cost_total) as margin
        from public.sale_items si join public.sales s on s.id = si.sale_id join public.items it on it.id = si.item_id
        where s.branch_id = app.current_branch_id() and s.status = 'posted' and s.sale_date between v_from and v_to
        group by it.sku, it.name order by 5 desc limit v_limit) x), '[]'),
    'source', 'Invoice yang diposting; margin = pendapatan setelah diskon dikurangi HPP part (jasa belum dikurangi komisi)');
end;
$$;

-- =============================================================================
-- Tool 6: get_mechanic_performance
-- =============================================================================
create or replace function app.ai_mechanic_performance(p_params jsonb)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_today date := app.today_wib();
  v_from  date := coalesce(nullif(p_params ->> 'from', '')::date, date_trunc('month', v_today)::date);
  v_to    date := coalesce(nullif(p_params ->> 'to', '')::date, v_today);
  v_branch uuid := app.current_branch_id();
begin
  return jsonb_build_object('period', jsonb_build_object('from', v_from, 'to', v_to),
    'mechanics', coalesce((select jsonb_agg(to_jsonb(x) order by x.service_revenue desc) from (
      select e.full_name as name,
             (select count(distinct w.id) from public.work_order_mechanics wm join public.work_orders w on w.id = wm.work_order_id
               where wm.employee_id = e.id and w.status <> 'void' and not w.is_warranty
                 and (w.created_at at time zone 'Asia/Jakarta')::date between v_from and v_to) as work_orders,
             (select coalesce(round(sum(woi.duration_minutes * wm.share_percent / 100) / 60.0, 1), 0)
                from public.work_order_mechanics wm join public.work_order_items woi on woi.id = wm.work_order_item_id
                join public.work_orders w on w.id = wm.work_order_id
               where wm.employee_id = e.id and w.status <> 'void' and not w.is_warranty and not woi.is_cancelled
                 and (w.created_at at time zone 'Asia/Jakarta')::date between v_from and v_to) as service_hours,
             (select coalesce(round(sum(si.net_amount * wm.share_percent / 100), 0), 0)
                from public.work_order_mechanics wm join public.sale_items si on si.work_order_item_id = wm.work_order_item_id
                join public.sales s on s.id = si.sale_id
               where wm.employee_id = e.id and s.status = 'posted' and s.sale_date between v_from and v_to) as service_revenue,
             (select count(distinct w.id) from public.work_order_mechanics wm join public.work_orders w on w.id = wm.work_order_id
               where wm.employee_id = e.id and w.is_warranty and w.status <> 'void'
                 and (w.created_at at time zone 'Asia/Jakarta')::date between v_from and v_to) as warranty_claims
      from public.employees e
      where e.branch_id = v_branch and exists (select 1 from public.work_order_mechanics wm where wm.employee_id = e.id)) x), '[]'),
    'source', 'Work order dan invoice yang diposting; jam kerja = estimasi durasi jasa dikali porsi mekanik');
end;
$$;

-- =============================================================================
-- Tool 7: get_cash_position
-- =============================================================================
create or replace function app.ai_cash_position()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_today  date := app.today_wib();
  r90      record;
  v_total  numeric;
  v_fixed  numeric;
  v_burn   numeric;
begin
  select * into r90 from app.pl_totals(v_today - 89, v_today);
  v_burn := (r90.cogs + r90.expense) / 90;
  select coalesce(sum(amount), 0) into v_fixed from public.recurring_expenses where branch_id = v_branch and is_active;
  select coalesce(sum(l.debit - l.credit), 0) into v_total from public.journal_lines l
    join public.cash_bank_accounts cb on cb.account_id = l.account_id join public.journal_entries e on e.id = l.entry_id
   where cb.branch_id = v_branch and cb.is_active and e.entry_date <= v_today;
  return jsonb_build_object('as_of', v_today, 'total_balance', v_total,
    'accounts', coalesce((select jsonb_agg(jsonb_build_object('name', cb.name, 'kind', cb.kind, 'balance', coalesce(s.net, 0)) order by cb.name)
       from public.cash_bank_accounts cb
       left join lateral (select sum(l.debit - l.credit) as net from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
                          where l.account_id = cb.account_id and e.entry_date <= v_today) s on true
       where cb.branch_id = v_branch and cb.is_active), '[]'),
    'avg_daily_cost_90d', round(v_burn, 0), 'runway_days_all_costs', case when v_burn > 0 then round(v_total / v_burn, 0) end,
    'monthly_fixed_costs', v_fixed, 'runway_days_fixed_costs', case when v_fixed > 0 then round(v_total / (v_fixed / 30), 0) end,
    'source', 'Saldo dari jurnal akun kas dan bank; biaya harian = (HPP + beban usaha) 90 hari terakhir dibagi 90; biaya rutin dari template Biaya rutin');
end;
$$;

-- =============================================================================
-- Tool 8: get_receivables_payables
-- =============================================================================
create or replace function app.ai_receivables_payables()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
begin
  return jsonb_build_object('as_of', app.today_wib(),
    'receivables', jsonb_build_object(
      'total', coalesce((select sum(outstanding) from public.v_sales where branch_id = v_branch and status = 'posted' and outstanding > 0), 0),
      'buckets', coalesce((select jsonb_object_agg(age_bucket, tot) from (
         select age_bucket, sum(outstanding) as tot from public.v_sales where branch_id = v_branch and status = 'posted' and outstanding > 0 group by age_bucket) b), '{}'),
      'overdue', coalesce((select jsonb_agg(to_jsonb(x)) from (
         select sale_no, coalesce(customer_name, 'Umum') as customer, outstanding, due_date, days_overdue from public.v_sales
         where branch_id = v_branch and status = 'posted' and outstanding > 0 and days_overdue > 0 order by days_overdue desc limit 10) x), '[]')),
    'payables', jsonb_build_object(
      'total', coalesce((select sum(outstanding) from public.v_ap_receipts where branch_id = v_branch and outstanding > 0), 0),
      'buckets', coalesce((select jsonb_object_agg(age_bucket, tot) from (
         select age_bucket, sum(outstanding) as tot from public.v_ap_receipts where branch_id = v_branch and outstanding > 0 group by age_bucket) b), '{}'),
      'due_or_overdue', coalesce((select jsonb_agg(to_jsonb(x)) from (
         select gr_no, supplier_name as supplier, outstanding, due_date, days_overdue from public.v_ap_receipts
         where branch_id = v_branch and outstanding > 0 and days_overdue >= -3 order by days_overdue desc limit 10) x), '[]')),
    'source', 'Daftar piutang (invoice) dan hutang supplier (penerimaan barang); umur dihitung dari tanggal dokumen, jatuh tempo dari termin');
end;
$$;

-- =============================================================================
-- Tool 9: get_tax_summary
-- =============================================================================
create or replace function app.ai_tax_summary()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_today  date := app.today_wib();
  s        public.tax_settings%rowtype;
  v_out    numeric;
  v_in     numeric;
  v_cum    numeric := 0;
  v_posted numeric;
  v_paid   numeric;
  m        integer;
begin
  select * into s from public.tax_settings where branch_id = v_branch;
  select coalesce(sum(l.credit - l.debit), 0) into v_out from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
   where l.account_id = app.account_id('ppn_out') and e.source_type <> 'tax_payment' and date_trunc('month', e.entry_date) = date_trunc('month', v_today);
  select coalesce(sum(l.debit - l.credit), 0) into v_in from public.journal_lines l join public.journal_entries e on e.id = l.entry_id
   where l.account_id = app.account_id('ppn_in') and date_trunc('month', e.entry_date) = date_trunc('month', v_today);
  for m in 1..extract(month from v_today)::int loop
    v_cum := v_cum + app.month_omzet(extract(year from v_today)::int, m);
  end loop;
  select coalesce(sum(pph_amount), 0) into v_posted from public.tax_period_summaries
   where branch_id = v_branch and period_year = extract(year from v_today)::int and status = 'posted';
  select coalesce(sum(amount), 0) into v_paid from public.tax_payments where branch_id = v_branch and tax_type = 'pph_final' and status = 'posted';
  return jsonb_build_object('as_of', v_today, 'business_form', s.business_form, 'is_pkp', s.is_pkp, 'pph_mode', s.pph_mode,
    'ppn_this_month', jsonb_build_object('output', v_out, 'input', v_in, 'payable', v_out - v_in),
    'pph_final', jsonb_build_object('rate_pct', s.pph_final_rate, 'cumulative_revenue_year', v_cum, 'annual_ceiling', s.annual_ceiling,
        'ceiling_used_pct', app.ai_pct(v_cum, s.annual_ceiling), 'posted_this_year', v_posted, 'paid_total', v_paid),
    'source', 'Jurnal PPN Keluaran dan Masukan bulan berjalan; omzet kumulatif tahun berjalan dari akun pendapatan; pengaturan pajak');
end;
$$;

-- =============================================================================
-- Tool 10: get_service_due_customers (tanpa nomor HP; kendaraan lama tidak servis)
-- =============================================================================
create or replace function app.ai_service_due_customers(p_params jsonb)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_months integer := least(greatest(coalesce(nullif(p_params ->> 'months', '')::int, 3), 1), 36);
  v_limit  integer := least(greatest(coalesce(nullif(p_params ->> 'limit', '')::int, 30), 1), 100);
  v_today  date := app.today_wib();
begin
  return jsonb_build_object('months_threshold', v_months,
    'vehicles', coalesce((select jsonb_agg(to_jsonb(x)) from (
      select vv.plate_no, trim(concat_ws(' ', vv.make_name, vv.model_name, vv.year::text)) as vehicle, coalesce(vv.customer_name, 'Tanpa pemilik') as customer,
             l.last_service, v_today - l.last_service as days_since, vv.last_odometer
      from public.v_vehicles vv
      join lateral (select max((w.delivered_at at time zone 'Asia/Jakarta')::date) as last_service from public.work_orders w
                    where w.vehicle_id = vv.id and w.status = 'delivered') l on l.last_service is not null
      where vv.branch_id = app.current_branch_id() and vv.is_active and l.last_service <= v_today - (v_months * 30)
      order by l.last_service limit v_limit) x), '[]'),
    'basis', 'Kendaraan yang terakhir diservis lebih dari N bulan lalu (aturan reminder per jasa belum tersedia)');
end;
$$;

-- =============================================================================
-- Tool 11: get_inventory_accuracy
-- =============================================================================
create or replace function app.ai_inventory_accuracy()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  return jsonb_build_object(
    'recent_opnames', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select o.opname_no, o.opname_type, (o.approved_at at time zone 'Asia/Jakarta')::date as posted_on, o.total_items, o.matched_items, o.variance_items,
               round(o.matched_items * 100.0 / nullif(o.total_items, 0), 1) as accuracy_pct, o.total_variance_amount
        from public.stock_opnames o where o.branch_id = app.current_branch_id() and o.status = 'posted' order by o.approved_at desc limit 6) x), '[]'),
    'average_accuracy_pct', (select round(avg(o.matched_items * 100.0 / nullif(o.total_items, 0)), 1) from public.stock_opnames o
                             where o.branch_id = app.current_branch_id() and o.status = 'posted' and o.approved_at >= now() - interval '180 days'),
    'source', 'Sesi stok opname yang sudah diposting (180 hari terakhir untuk rata-rata)');
end;
$$;

-- =============================================================================
-- Pengarah tool + log panggilan
-- =============================================================================
create or replace function app.ai_dispatch(p_tool text, p_params jsonb)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  return case p_tool
    when 'get_business_summary' then app.ai_business_summary(p_params)
    when 'get_health_score' then app.ai_health_score()
    when 'get_sales_trend' then app.ai_sales_trend(p_params)
    when 'get_stock_alerts' then app.ai_stock_alerts()
    when 'get_top_items' then app.ai_top_items(p_params)
    when 'get_mechanic_performance' then app.ai_mechanic_performance(p_params)
    when 'get_cash_position' then app.ai_cash_position()
    when 'get_receivables_payables' then app.ai_receivables_payables()
    when 'get_tax_summary' then app.ai_tax_summary()
    when 'get_service_due_customers' then app.ai_service_due_customers(p_params)
    when 'get_inventory_accuracy' then app.ai_inventory_accuracy()
    else null end;
end;
$$;

-- Menjalankan tool + mencatat log. Kesalahan dikembalikan sebagai {error} agar log tetap tersimpan.
create or replace function app.ai_run(p_tool text, p_params jsonb, p_source text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_start  timestamptz := clock_timestamp();
  v_result jsonb;
  v_error  text;
begin
  perform app.assert_permission('ai_analyst', 'view');
  p_params := coalesce(p_params, '{}');
  begin
    v_result := app.ai_dispatch(p_tool, p_params);
    if v_result is null then v_error := 'Tool "' || coalesce(p_tool, '') || '" tidak dikenal'; end if;
  exception when others then
    v_error := sqlerrm;
  end;
  insert into public.ai_tool_calls (branch_id, employee_id, tool, params, source, ok, error, duration_ms)
  values (app.current_branch_id(), app.current_employee_id(), left(coalesce(p_tool, ''), 60), p_params, p_source, v_error is null, v_error,
          (extract(epoch from clock_timestamp() - v_start) * 1000)::int);
  if v_error is not null then return jsonb_build_object('error', v_error); end if;
  return v_result;
end;
$$;

create or replace function public.ai_run_tool(p_tool text, p_params jsonb default '{}')
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
begin
  return app.ai_run(p_tool, p_params, 'app');
end;
$$;

-- Dipanggil server MCP (service role): token per pengguna -> bertindak sebagai karyawan pemilik token
create or replace function public.ai_run_tool_token(p_token text, p_tool text, p_params jsonb default '{}')
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_tok public.ai_tokens%rowtype;
  v_uid uuid;
begin
  select * into v_tok from public.ai_tokens where token_hash = extensions.digest(coalesce(p_token, ''), 'sha256') and revoked_at is null;
  if not found then raise exception 'Token tidak valid atau sudah dicabut' using errcode = '28000'; end if;
  select id into v_uid from public.profiles where employee_id = v_tok.employee_id;
  if v_uid is null or not exists (select 1 from public.employees where id = v_tok.employee_id and status <> 'inactive') then
    raise exception 'Akun pemilik token tidak aktif' using errcode = '28000';
  end if;
  update public.ai_tokens set last_used_at = now() where id = v_tok.id;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  return app.ai_run(p_tool, p_params, 'mcp');
end;
$$;

-- =============================================================================
-- Token akses
-- =============================================================================
create or replace function public.create_ai_token(p_name text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_token text := 'abk_' || encode(extensions.gen_random_bytes(24), 'hex');
begin
  perform app.assert_permission('ai_analyst', 'create');
  if length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'Nama token minimal 2 karakter' using errcode = '22023'; end if;
  insert into public.ai_tokens (branch_id, employee_id, name, token_prefix, token_hash)
  values (app.current_branch_id(), app.current_employee_id(), btrim(p_name), left(v_token, 8), extensions.digest(v_token, 'sha256'));
  return v_token;   -- hanya ditampilkan sekali
end;
$$;

create or replace function public.revoke_ai_token(p_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform app.assert_permission('ai_analyst', 'update');
  update public.ai_tokens set revoked_at = now() where id = p_id and branch_id = app.current_branch_id() and revoked_at is null;
  if not found then raise exception 'Token tidak ditemukan atau sudah dicabut' using errcode = 'P0002'; end if;
end;
$$;

-- Ringkasan mingguan tersimpan (dibuat aplikasi dari hasil tool)
create or replace function public.save_ai_insight(p_payload jsonb, p_score numeric default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform app.assert_permission('ai_analyst', 'create');
  insert into public.ai_insights (branch_id, kind, score, payload) values (app.current_branch_id(), 'weekly', p_score, p_payload) returning id into v_id;
  return v_id;
end;
$$;

-- Versi token (penjadwal mingguan memakai token, bukan sesi login)
create or replace function public.save_ai_insight_token(p_token text, p_payload jsonb, p_score numeric default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_tok public.ai_tokens%rowtype;
  v_uid uuid;
begin
  select * into v_tok from public.ai_tokens where token_hash = extensions.digest(coalesce(p_token, ''), 'sha256') and revoked_at is null;
  if not found then raise exception 'Token tidak valid atau sudah dicabut' using errcode = '28000'; end if;
  select id into v_uid from public.profiles where employee_id = v_tok.employee_id;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  return public.save_ai_insight(p_payload, p_score);
end;
$$;

-- =============================================================================
-- Hak eksekusi
-- =============================================================================
revoke all on function app.pl_totals(date, date), app.ai_indicator(text, text, numeric, text, text, text, text), app.ai_pct(numeric, numeric),
  app.ai_business_summary(jsonb), app.ai_health_score(), app.ai_sales_trend(jsonb), app.ai_stock_alerts(), app.ai_top_items(jsonb),
  app.ai_mechanic_performance(jsonb), app.ai_cash_position(), app.ai_receivables_payables(), app.ai_tax_summary(),
  app.ai_service_due_customers(jsonb), app.ai_inventory_accuracy(), app.ai_dispatch(text, jsonb), app.ai_run(text, jsonb, text)
  from public, anon, authenticated;

revoke all on function public.ai_run_tool(text, jsonb), public.create_ai_token(text), public.revoke_ai_token(uuid),
  public.save_ai_insight(jsonb, numeric) from public, anon;
grant execute on function public.ai_run_tool(text, jsonb), public.create_ai_token(text), public.revoke_ai_token(uuid),
  public.save_ai_insight(jsonb, numeric) to authenticated;

-- Hanya server aplikasi (service role) yang boleh memakai token
revoke all on function public.ai_run_tool_token(text, text, jsonb), public.save_ai_insight_token(text, jsonb, numeric) from public, anon, authenticated;
grant execute on function public.ai_run_tool_token(text, text, jsonb), public.save_ai_insight_token(text, jsonb, numeric) to service_role;
