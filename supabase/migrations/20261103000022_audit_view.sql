-- =============================================================================
-- Audit log (PRD §18): view gabungan untuk halaman Audit log + cakupan stok opname.
-- audit_logs sudah append-only dan terisi trigger di tabel bisnis. View ini menambah nama pelaku
-- dan menggabungkan panggilan AI (ai_tool_calls) sebagai aksi 'ai_tool_call'.
-- Akses mengikuti RLS tabel dasar: izin audit_log (view).
-- =============================================================================

-- Stok opname belum tercatat di audit log
create trigger trg_audit after insert or update or delete on public.stock_opnames
  for each row execute function app.audit_row_change();

create view public.v_audit_logs with (security_invoker = true) as
  select a.id, a.branch_id, a.table_name, a.record_id, a.action, a.old_data, a.new_data, a.note, a.created_at,
         a.actor_employee_id, app.employee_name(a.actor_employee_id) as actor_name
  from public.audit_logs a
  union all
  select c.id, c.branch_id, 'ai_tool_calls', null::uuid, 'ai_tool_call', null::jsonb, c.params,
         c.tool || case when c.ok then '' else ' (gagal)' end, c.created_at,
         c.employee_id, app.employee_name(c.employee_id)
  from public.ai_tool_calls c;

grant select on public.v_audit_logs to authenticated;
