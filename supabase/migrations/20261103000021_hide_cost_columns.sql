-- =============================================================================
-- Sembunyikan kolom HPP dari pemegang izin penjualan (PRD §10.2: HPP hanya untuk izin laporan keuangan).
-- sales.cogs_total, sale_items.cost_total, sale_returns.cogs_total, sale_return_items.unit_cost/cost_total
-- sebelumnya ikut terbaca lewat API. Laporan HPP/laba tetap tersedia lewat fungsi security definer
-- (report_*), dan jurnal tidak berubah.
-- =============================================================================

-- View retur tanpa cogs_total
drop view if exists public.v_sale_returns;
create view public.v_sale_returns with (security_invoker = true) as
  select r.id, r.branch_id, r.return_no, r.sale_id, s.sale_no, s.source as sale_source,
         w.wo_no as wo_no, coalesce(w.plate_no, s.plate_no) as plate_no,
         r.customer_id, c.name as customer_name, c.phone as customer_phone,
         r.return_date, r.settlement, r.payment_method, r.cash_bank_account_id,
         a.name as cash_bank_account_name, r.shift_id, cs.shift_no,
         r.amount, r.ppn_amount, r.total, r.reason, r.status, r.void_reason,
         r.created_at, app.employee_name(e.id) as created_by_name,
         (select count(*)::integer from public.sale_return_items i where i.return_id = r.id) as item_count
  from public.sale_returns r
  join public.sales s on s.id = r.sale_id
  left join public.work_orders w on w.id = s.work_order_id
  left join public.customers c on c.id = r.customer_id
  left join public.cash_bank_accounts a on a.id = r.cash_bank_account_id
  left join public.cash_shifts cs on cs.id = r.shift_id
  left join public.employees e on e.id = app.current_employee_id();

-- Hak select per kolom, tanpa kolom HPP
do $$
declare
  r record;
  v_cols text;
begin
  for r in select * from (values
      ('sales', array['cogs_total']),
      ('sale_items', array['cost_total']),
      ('sale_returns', array['cogs_total']),
      ('sale_return_items', array['unit_cost', 'cost_total'])) x(tbl, hidden)
  loop
    select string_agg(format('%I', column_name), ', ' order by ordinal_position) into v_cols
      from information_schema.columns
     where table_schema = 'public' and table_name = r.tbl and column_name <> all (r.hidden);
    execute format('revoke select on public.%I from authenticated', r.tbl);
    execute format('grant select (%s) on public.%I to authenticated', v_cols, r.tbl);
  end loop;
end $$;

grant select on public.v_sale_returns to authenticated;
