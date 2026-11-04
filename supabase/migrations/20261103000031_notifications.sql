-- =============================================================================
-- Pusat notifikasi: merekam aksi/eksekusi yang relevan di seluruh modul.
-- Peristiwa ditulis oleh pemicu di tabel kunci (bukan oleh halaman), jadi tidak ada aksi yang terlewat dan
-- tidak bergantung pada UI. Siapa yang boleh melihat ditentukan dua lapis:
--   1. izin peran "notifications" (view): Owner mengatur per peran apakah boleh memakai pusat notifikasi;
--   2. izin modul asal peristiwa (mis. sales, payroll): notifikasi gaji tidak tampil untuk peran tanpa akses gaji.
-- Penulisan notifikasi tidak boleh menggagalkan transaksi bisnis: kesalahan di pemicu diabaikan (peringatan saja).
-- =============================================================================

create table public.notifications (
  id                uuid primary key default gen_random_uuid(),
  branch_id         uuid not null references public.branches(id),
  kind              text not null,
  module            text,
  severity          text not null default 'info' check (severity in ('info', 'warn', 'danger')),
  title             text not null,
  body              text,
  link              text,
  entity_type       text,
  entity_id         uuid,
  actor_employee_id uuid references public.employees(id),
  created_at        timestamptz not null default clock_timestamp(),
  created_by        uuid default auth.uid(),
  updated_at        timestamptz not null default now()
);
create index idx_notifications_created on public.notifications (branch_id, created_at desc);
create index idx_notifications_module on public.notifications (branch_id, module, created_at desc);

create trigger trg_notifications_updated_at before update on public.notifications for each row execute function app.set_updated_at();
create trigger trg_notifications_immutable before update or delete on public.notifications for each row execute function app.prevent_modification();

-- Status baca per karyawan: semua notifikasi sebelum last_read_at dianggap sudah dibaca
create table public.notification_state (
  employee_id  uuid primary key references public.employees(id),
  last_read_at timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Izin peran: modul "notifications" (hanya "view" yang bermakna; baris lain mengikuti pola katalog)
insert into public.permissions (module, action, module_label, sort_order)
select 'notifications', a.action, 'Notifikasi', 28
from unnest(enum_range(null::public.permission_action)) as a(action)
on conflict do nothing;

-- Bawaan: semua peran bawaan boleh melihat notifikasi (tetap tersaring izin modul); Owner = superuser
insert into public.role_permissions (branch_id, role_id, permission_id, scope)
select r.branch_id, r.id, p.id, 'all'
from public.roles r
join public.permissions p on p.module = 'notifications' and p.action = 'view'
where r.code in ('admin', 'cashier', 'mechanic', 'warehouse')
on conflict do nothing;

-- RLS
alter table public.notifications enable row level security;
alter table public.notification_state enable row level security;
revoke all on public.notifications, public.notification_state from anon;
revoke insert, update, delete, truncate on public.notifications, public.notification_state from authenticated;
grant select on public.notifications, public.notification_state to authenticated;

create policy notifications_select on public.notifications for select to authenticated
  using (branch_id = app.current_branch_id()
         and app.has_permission('notifications', 'view')
         and (module is null or app.has_permission(module, 'view')));
create policy notification_state_select on public.notification_state for select to authenticated
  using (employee_id = app.current_employee_id());

-- Menandai semua notifikasi sebagai sudah dibaca
create or replace function public.mark_notifications_read()
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if app.current_employee_id() is null then raise exception 'Sesi tidak valid: login sebagai karyawan aktif' using errcode = '42501'; end if;
  insert into public.notification_state (employee_id, last_read_at) values (app.current_employee_id(), clock_timestamp())
  on conflict (employee_id) do update set last_read_at = excluded.last_read_at;
end;
$$;
revoke all on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

-- Jumlah belum dibaca (sesuai izin pemanggil) dan waktu terakhir dibaca
create or replace function public.my_notification_summary()
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'unread', (select count(*) from public.notifications n
               where n.created_at > coalesce((select last_read_at from public.notification_state where employee_id = app.current_employee_id()), '-infinity'::timestamptz)),
    'last_read_at', (select last_read_at from public.notification_state where employee_id = app.current_employee_id()))
$$;
revoke all on function public.my_notification_summary() from public, anon;
grant execute on function public.my_notification_summary() to authenticated;

-- =============================================================================
-- Penulis notifikasi
-- =============================================================================
create or replace function app.fmt_rp(p numeric)
returns text
language sql immutable
set search_path = ''
as $$ select 'Rp ' || replace(to_char(coalesce(p, 0), 'FM999,999,999,999,999'), ',', '.') $$;

create or replace function app.notify(
  p_kind text, p_module text, p_severity text, p_title text, p_body text, p_link text, p_entity_type text, p_entity_id uuid, p_branch uuid
)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.notifications (branch_id, kind, module, severity, title, body, link, entity_type, entity_id, actor_employee_id)
  values (p_branch, p_kind, p_module, p_severity, left(p_title, 200), left(p_body, 500), p_link, p_entity_type, p_entity_id, app.current_employee_id());
end;
$$;

create or replace function app.wo_status_label(p text)
returns text
language sql immutable
set search_path = ''
as $$
  select case p when 'queued' then 'Antri' when 'in_progress' then 'Dikerjakan' when 'waiting_parts' then 'Menunggu part'
               when 'waiting_approval' then 'Menunggu persetujuan' when 'quality_check' then 'Selesai / QC' when 'ready' then 'Siap diambil'
               when 'delivered' then 'Diambil pelanggan' when 'void' then 'Dibatalkan' else p end
$$;

-- Pemicu tunggal: memetakan perubahan di tabel kunci menjadi notifikasi berbahasa Indonesia.
-- Setiap cabang hanya aktif untuk tabel pemiliknya; seluruh isi dibungkus agar kegagalan tidak menggagalkan transaksi.
create or replace function app.notify_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_t   text := tg_table_name;
  v_op  text := tg_op;
  v_s   text;
  v_so  text;
  v_wo  record;
  v_who text;
  v_item record;
  v_tot numeric;
begin
  begin
    if v_t = 'sales' then
      v_s := new.status::text; v_so := case when v_op = 'UPDATE' then old.status::text end;
      if v_s = 'posted' and v_so is distinct from 'posted' then
        perform app.notify('sale_posted', 'sales', 'info', 'Invoice ' || coalesce(new.sale_no, '') || ' diposting',
          app.fmt_rp(new.total) || coalesce(' · ' || new.plate_no, ''), '/kasir/penjualan/' || new.id, 'sale', new.id, new.branch_id);
      elsif v_s = 'void' and v_so = 'posted' then
        perform app.notify('sale_void', 'sales', 'warn', 'Invoice ' || coalesce(new.sale_no, '') || ' dibatalkan',
          coalesce(new.void_reason, ''), '/kasir/penjualan/' || new.id, 'sale', new.id, new.branch_id);
      end if;

    elsif v_t = 'sale_returns' then
      if v_op = 'INSERT' and new.status::text = 'posted' then
        perform app.notify('sale_return', 'sales', 'warn', 'Retur penjualan ' || new.return_no, app.fmt_rp(new.total) || ' · ' || new.reason,
          '/kasir/retur/' || new.id, 'sale_return', new.id, new.branch_id);
      elsif v_op = 'UPDATE' and new.status::text = 'void' and old.status::text <> 'void' then
        perform app.notify('sale_return_void', 'sales', 'warn', 'Retur ' || new.return_no || ' dibatalkan', coalesce(new.void_reason, ''),
          '/kasir/retur/' || new.id, 'sale_return', new.id, new.branch_id);
      end if;

    elsif v_t = 'cash_shifts' then
      select full_name into v_who from public.employees where id = new.cashier_id;
      if v_op = 'INSERT' then
        perform app.notify('shift_open', 'cash_shift', 'info', 'Shift ' || new.shift_no || ' dibuka', coalesce(v_who, '') || ' · kas awal ' || app.fmt_rp(new.opening_cash),
          '/kasir/shift/' || new.id, 'cash_shift', new.id, new.branch_id);
      elsif new.status::text = 'closed' and old.status::text = 'open' then
        perform app.notify('shift_close', 'cash_shift', case when coalesce(new.variance, 0) <> 0 then 'warn' else 'info' end,
          'Shift ' || new.shift_no || ' ditutup',
          coalesce(v_who, '') || case when coalesce(new.variance, 0) <> 0 then ' · selisih kas ' || app.fmt_rp(new.variance) else ' · kas cocok' end,
          '/kasir/shift/' || new.id, 'cash_shift', new.id, new.branch_id);
      elsif new.status::text = 'approved' and old.status::text = 'closed' then
        perform app.notify('shift_approve', 'cash_shift', 'info', 'Shift ' || new.shift_no || ' disetujui', coalesce(v_who, ''),
          '/kasir/shift/' || new.id, 'cash_shift', new.id, new.branch_id);
      end if;

    elsif v_t = 'work_orders' then
      if v_op = 'INSERT' then
        perform app.notify(case when new.is_warranty then 'wo_warranty' else 'wo_created' end, 'service_orders', case when new.is_warranty then 'warn' else 'info' end,
          case when new.is_warranty then 'Klaim garansi ' else 'Work order ' end || new.wo_no || ' dibuat', new.plate_no || ' · ' || coalesce(new.complaint, ''),
          '/servis/' || new.id, 'work_order', new.id, new.branch_id);
      elsif new.status::text is distinct from old.status::text then
        perform app.notify('wo_status', 'service_orders',
          case when new.status::text in ('waiting_approval', 'waiting_parts') then 'warn' when new.status::text = 'void' then 'warn' else 'info' end,
          new.wo_no || ': ' || app.wo_status_label(new.status::text), new.plate_no || ' · sebelumnya ' || app.wo_status_label(old.status::text),
          '/servis/' || new.id, 'work_order', new.id, new.branch_id);
      end if;

    elsif v_t = 'work_order_items' then
      if v_op = 'UPDATE' and old.issue_requested_at is null and new.issue_requested_at is not null then
        select wo_no, plate_no into v_wo from public.work_orders where id = new.work_order_id;
        perform app.notify('part_requested', 'part_issue', 'warn', 'Part diminta: ' || new.description, coalesce(v_wo.wo_no, '') || ' · ' || coalesce(v_wo.plate_no, ''),
          '/servis/' || new.work_order_id, 'work_order', new.work_order_id, new.branch_id);
      end if;

    elsif v_t = 'estimates' then
      if v_op = 'INSERT' and new.is_additional then
        perform app.notify('estimate_additional', 'service_orders', 'warn', 'Pekerjaan tambahan ' || new.estimate_no || ' menunggu persetujuan', new.plate_no || ' · ' || app.fmt_rp(new.total),
          '/servis/estimasi/' || new.id, 'estimate', new.id, new.branch_id);
      elsif v_op = 'UPDATE' and new.status::text is distinct from old.status::text and new.status::text in ('approved', 'rejected') then
        perform app.notify('estimate_' || new.status::text, 'service_orders', case when new.status::text = 'rejected' then 'warn' else 'info' end,
          'Estimasi ' || new.estimate_no || case when new.status::text = 'approved' then ' disetujui pelanggan' else ' ditolak pelanggan' end,
          new.plate_no || ' · ' || app.fmt_rp(new.total), '/servis/estimasi/' || new.id, 'estimate', new.id, new.branch_id);
      end if;

    elsif v_t = 'purchase_orders' then
      if v_op = 'UPDATE' and new.status::text = 'sent' and old.status::text = 'draft' then
        perform app.notify('po_sent', 'purchasing', 'info', 'PO ' || new.po_no || ' dikirim ke supplier', coalesce(new.notes, ''),
          '/pembelian/po/' || new.id, 'purchase_order', new.id, new.branch_id);
      elsif v_op = 'UPDATE' and new.status::text = 'cancelled' and old.status::text <> 'cancelled' then
        perform app.notify('po_cancel', 'purchasing', 'warn', 'PO ' || new.po_no || ' dibatalkan', coalesce(new.cancel_reason, ''),
          '/pembelian/po/' || new.id, 'purchase_order', new.id, new.branch_id);
      end if;

    elsif v_t = 'goods_receipts' then
      if v_op = 'INSERT' and new.status::text = 'posted' then
        perform app.notify('receipt_posted', 'purchasing', 'info', 'Barang diterima ' || new.gr_no, app.fmt_rp(new.total) || coalesce(' · faktur ' || new.invoice_no, ''),
          '/pembelian/penerimaan/' || new.id, 'goods_receipt', new.id, new.branch_id);
      elsif v_op = 'UPDATE' and new.status::text = 'void' and old.status::text <> 'void' then
        perform app.notify('receipt_void', 'purchasing', 'warn', 'Penerimaan ' || new.gr_no || ' dibatalkan', coalesce(new.void_reason, ''),
          '/pembelian/penerimaan/' || new.id, 'goods_receipt', new.id, new.branch_id);
      end if;

    elsif v_t = 'supplier_payments' then
      if v_op = 'INSERT' and new.status::text = 'posted' then
        perform app.notify('supplier_paid', 'payables', 'info', 'Pembayaran supplier ' || new.payment_no, app.fmt_rp(new.amount), '/pembelian/hutang', 'supplier_payment', new.id, new.branch_id);
      elsif v_op = 'UPDATE' and new.status::text = 'void' and old.status::text <> 'void' then
        perform app.notify('supplier_paid_void', 'payables', 'warn', 'Pembayaran ' || new.payment_no || ' dibatalkan', coalesce(new.void_reason, ''), '/pembelian/hutang', 'supplier_payment', new.id, new.branch_id);
      end if;

    elsif v_t = 'stock_opnames' then
      if v_op = 'UPDATE' and new.status::text = 'review' and old.status::text <> 'review' then
        perform app.notify('opname_review', 'stock_opname_approve', 'warn', 'Opname ' || new.opname_no || ' menunggu persetujuan',
          new.variance_items || ' barang selisih · ' || app.fmt_rp(new.total_variance_amount), '/stok-opname/' || new.id, 'stock_opname', new.id, new.branch_id);
      elsif v_op = 'UPDATE' and new.status::text = 'posted' and old.status::text <> 'posted' then
        perform app.notify('opname_posted', 'stock_opname_count', case when coalesce(new.total_variance_amount, 0) <> 0 then 'warn' else 'info' end,
          'Opname ' || new.opname_no || ' diposting', 'Selisih nilai ' || app.fmt_rp(new.total_variance_amount), '/stok-opname/' || new.id, 'stock_opname', new.id, new.branch_id);
      end if;

    elsif v_t = 'cash_transactions' then
      if v_op = 'INSERT' and new.status::text = 'posted' then
        perform app.notify('cash_txn', 'expenses', case when new.kind::text = 'drawing' then 'warn' else 'info' end,
          case new.kind::text when 'expense' then 'Pengeluaran ' when 'income' then 'Pemasukan ' when 'transfer' then 'Transfer ' when 'capital' then 'Setoran modal ' else 'Prive ' end || app.fmt_rp(new.amount),
          new.txn_no || ' · ' || new.description, '/keuangan', 'cash_transaction', new.id, new.branch_id);
      elsif v_op = 'UPDATE' and new.status::text = 'void' and old.status::text <> 'void' then
        perform app.notify('cash_txn_void', 'expenses', 'warn', 'Transaksi kas ' || new.txn_no || ' dibatalkan', coalesce(new.void_reason, ''), '/keuangan', 'cash_transaction', new.id, new.branch_id);
      end if;

    elsif v_t = 'payroll_periods' then
      if v_op = 'INSERT' then
        perform app.notify('payroll_created', 'payroll', 'info', 'Periode gaji ' || new.label || ' dibuat', new.period_no, '/penggajian/' || new.id, 'payroll_period', new.id, new.branch_id);
      elsif new.status::text is distinct from old.status::text then
        perform app.notify('payroll_' || new.status::text, 'payroll', case when new.status::text in ('review', 'void') then 'warn' else 'info' end,
          'Gaji ' || new.label || ': ' || case new.status::text when 'draft' then 'kembali ke draft' when 'review' then 'menunggu persetujuan Owner' when 'approved' then 'disetujui'
                                                                  when 'paid' then 'dibayar' else 'dibatalkan' end,
          new.period_no, '/penggajian/' || new.id, 'payroll_period', new.id, new.branch_id);
      end if;

    elsif v_t = 'employee_loans' then
      if v_op = 'INSERT' then
        select full_name into v_who from public.employees where id = new.employee_id;
        perform app.notify('loan_created', 'payroll', 'info', 'Kasbon ' || new.loan_no || ' dicairkan', coalesce(v_who, '') || ' · ' || app.fmt_rp(new.principal), '/penggajian/kasbon', 'employee_loan', new.id, new.branch_id);
      end if;

    elsif v_t = 'fiscal_periods' then
      if new.is_closed and (v_op = 'INSERT' or not old.is_closed) then
        perform app.notify('period_closed', 'journal', 'warn', 'Buku ' || to_char(make_date(new.period_year, new.period_month, 1), 'YYYY-MM') || ' ditutup', 'Jurnal bertanggal di bulan itu terkunci', '/keuangan/akun', 'fiscal_period', new.id, new.branch_id);
      elsif v_op = 'UPDATE' and old.is_closed and not new.is_closed then
        perform app.notify('period_reopened', 'journal', 'danger', 'Buku ' || to_char(make_date(new.period_year, new.period_month, 1), 'YYYY-MM') || ' dibuka kembali', coalesce(new.reopen_reason, ''), '/keuangan/akun', 'fiscal_period', new.id, new.branch_id);
      end if;

    elsif v_t = 'tax_payments' then
      if v_op = 'INSERT' and new.status::text = 'posted' then
        perform app.notify('tax_paid', 'tax_settings', 'info', 'Setoran pajak ' || upper(new.tax_type::text), app.fmt_rp(new.amount) || ' · ' || new.period_month || '/' || new.period_year, '/pajak', 'tax_payment', new.id, new.branch_id);
      end if;

    elsif v_t = 'employees' then
      if v_op = 'INSERT' then
        perform app.notify('employee_created', 'employees', 'info', 'Karyawan baru: ' || new.full_name, new.code, '/karyawan/' || new.id, 'employee', new.id, new.branch_id);
      elsif new.status::text is distinct from old.status::text then
        perform app.notify('employee_status', 'employees', case when new.status::text = 'inactive' then 'warn' else 'info' end,
          'Status ' || new.full_name || ': ' || case new.status::text when 'active' then 'aktif' when 'on_leave' then 'cuti' else 'nonaktif' end, new.code, '/karyawan/' || new.id, 'employee', new.id, new.branch_id);
      end if;

    elsif v_t = 'settings' then
      if v_op = 'UPDATE' and new.value is distinct from old.value then
        perform app.notify('settings_changed', 'settings', 'warn', 'Pengaturan diubah: ' || new.key, old.value::text || ' menjadi ' || new.value::text, '/pengaturan/bengkel', 'setting', new.id, new.branch_id);
      end if;

    elsif v_t = 'ai_tokens' then
      if v_op = 'INSERT' then
        perform app.notify('ai_token', 'ai_analyst', 'warn', 'Token AI dibuat: ' || new.name, 'Token memberi akses baca data bengkel ke klien AI', '/ai', 'ai_token', new.id, new.branch_id);
      elsif v_op = 'UPDATE' and old.revoked_at is null and new.revoked_at is not null then
        perform app.notify('ai_token_revoked', 'ai_analyst', 'info', 'Token AI dicabut: ' || new.name, '', '/ai', 'ai_token', new.id, new.branch_id);
      end if;

    elsif v_t = 'stock_balances' then
      -- stok menipis atau habis: hanya saat melewati batas minimum (tidak berulang untuk setiap pengurangan)
      if v_op = 'UPDATE' and new.qty < old.qty then
        select i.id, i.sku, i.name, i.min_stock into v_item from public.items i where i.id = new.item_id;
        if v_item.min_stock > 0 then
          select coalesce(sum(qty), 0) into v_tot from public.stock_balances where item_id = new.item_id;
          if v_tot <= v_item.min_stock and v_tot + (old.qty - new.qty) > v_item.min_stock then
            perform app.notify('stock_low', 'master_data', case when v_tot <= 0 then 'danger' else 'warn' end,
              case when v_tot <= 0 then 'Stok habis: ' else 'Stok menipis: ' end || v_item.name,
              'Tersisa ' || trim_scale(v_tot)::text || ' (minimum ' || trim_scale(v_item.min_stock)::text || ') · ' || v_item.sku, '/inventory/barang/' || v_item.id, 'item', v_item.id, new.branch_id);
          end if;
        end if;
      end if;
    end if;
  exception when others then
    raise warning 'notify_change gagal untuk %: %', v_t, sqlerrm;   -- jangan gagalkan transaksi bisnis
  end;
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['sales', 'sale_returns', 'cash_shifts', 'work_orders', 'work_order_items', 'estimates', 'purchase_orders', 'goods_receipts',
    'supplier_payments', 'stock_opnames', 'cash_transactions', 'payroll_periods', 'employee_loans', 'fiscal_periods', 'tax_payments', 'employees',
    'settings', 'ai_tokens', 'stock_balances'] loop
    execute format('create trigger trg_notify after insert or update on public.%I for each row execute function app.notify_change()', t);
  end loop;
end $$;

revoke all on function app.notify(text, text, text, text, text, text, text, uuid, uuid), app.notify_change(), app.fmt_rp(numeric), app.wo_status_label(text) from public, anon, authenticated;

-- Siaran realtime (mengikuti RLS): bel di top bar ikut berubah seketika
alter publication supabase_realtime add table public.notifications;
