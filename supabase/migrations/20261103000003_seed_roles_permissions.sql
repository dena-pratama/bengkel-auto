-- =============================================================================
-- Data awal: cabang utama, katalog izin, role bawaan, matriks hak akses default
-- PRD §2 dan §16. Owner bisa mengubahnya lewat aplikasi.
--
-- Kode matriks (PRD §16) → izin:
--   P = view, create, update, void, export   B = view, create   L = view
--   A = approve   S = view (hanya data sendiri)   U = update (hanya data sendiri)
-- =============================================================================

insert into public.branches (code, name) values ('PST', 'Bengkel Pusat');

insert into public.settings (branch_id, key, value, description)
select id, s.key, s.value::jsonb, s.description
from public.branches, (values
  ('timezone',            '"Asia/Jakarta"', 'Zona waktu operasional'),
  ('currency',            '"IDR"',          'Mata uang'),
  ('session_idle_hours',  '12',             'Logout otomatis setelah tidak aktif (jam)'),
  ('allow_negative_stock','false',          'Izinkan jual dulu, terima barang menyusul'),
  ('sales_return_days',   '7',              'Batas hari retur penjualan')
) as s(key, value, description)
where code = 'PST';

-- Katalog modul (urutan & label mengikuti PRD §16)
create temporary table _modules (module text, label text, ord int);
insert into _modules values
  ('dashboard',            'Dashboard ringkas', 1),
  ('finance_reports',      'Laporan keuangan, HPP, laba', 2),
  ('master_data',          'Master barang & jasa', 3),
  ('price_change',         'Ubah harga jual', 4),
  ('purchasing',           'Pembelian, penerimaan barang', 5),
  ('payables',             'Hutang supplier & pembayaran', 6),
  ('customers',            'Pelanggan & kendaraan', 7),
  ('service_orders',       'Estimasi & work order', 8),
  ('part_issue',           'Pengeluaran part untuk WO', 9),
  ('service_board',        'Papan status servis', 10),
  ('sales',                'Penjualan langsung & pembayaran', 11),
  ('discount_override',    'Diskon di atas batas role', 12),
  ('transaction_void',     'Batal transaksi', 13),
  ('cash_shift',           'Buka-tutup kas harian', 14),
  ('sales_return',         'Retur penjualan', 15),
  ('receivables',          'Piutang & pelunasan', 16),
  ('stock_opname_count',   'Stok opname: hitung', 17),
  ('stock_opname_approve', 'Stok opname: setujui & posting', 18),
  ('employees',            'Karyawan, role, status', 19),
  ('commissions',          'Komisi', 20),
  ('payroll',              'Penggajian & kasbon', 21),
  ('expenses',             'Biaya operasional & kas/bank', 22),
  ('journal',              'Jurnal & tutup buku', 23),
  ('tax_settings',         'Setting pajak', 24),
  ('ai_analyst',           'AI Business Analyst', 25),
  ('audit_log',            'Audit log', 26),
  ('settings',             'Setting sistem', 27);

insert into public.permissions (module, action, module_label)
select m.module, a.action, m.label
from _modules m cross join unnest(enum_range(null::public.permission_action)) as a(action);

-- Role bawaan
insert into public.roles (branch_id, code, name, description, is_system, is_superuser)
select b.id, r.code, r.name, r.description, true, r.code = 'owner'
from public.branches b, (values
  ('owner',    'Owner',                   'Pemilik bengkel: semua akses'),
  ('admin',    'Admin / Service Advisor', 'Staf depan: pelanggan, estimasi, work order, master data'),
  ('cashier',  'Kasir',                   'Penjualan, pembayaran, kas harian'),
  ('mechanic', 'Mekanik',                 'Work order miliknya, status pekerjaan, komisi sendiri'),
  ('warehouse','Gudang',                  'Penerimaan barang, pengeluaran part, stok opname')
) as r(code, name, description)
where b.code = 'PST';

-- Matriks default PRD §16 (Owner = superuser, tidak perlu baris izin)
create temporary table _matrix (module text, role_code text, codes text);
insert into _matrix values
  ('dashboard',            'admin', 'L'), ('dashboard', 'cashier', 'L'),
  ('master_data',          'admin', 'P'), ('master_data', 'cashier', 'L'), ('master_data', 'mechanic', 'L'), ('master_data', 'warehouse', 'B'),
  ('price_change',         'admin', 'B'),
  ('purchasing',           'admin', 'P'), ('purchasing', 'warehouse', 'B'),
  ('payables',             'admin', 'L'),
  ('customers',            'admin', 'P'), ('customers', 'cashier', 'B'), ('customers', 'mechanic', 'L'),
  ('service_orders',       'admin', 'P'), ('service_orders', 'cashier', 'L'), ('service_orders', 'mechanic', 'S'), ('service_orders', 'warehouse', 'L'),
  ('part_issue',           'admin', 'P'), ('part_issue', 'mechanic', 'B'), ('part_issue', 'warehouse', 'P'),
  ('service_board',        'admin', 'P'), ('service_board', 'cashier', 'L'), ('service_board', 'mechanic', 'SU'), ('service_board', 'warehouse', 'L'),
  ('sales',                'admin', 'P'), ('sales', 'cashier', 'P'),
  ('discount_override',    'admin', 'A'),
  ('transaction_void',     'admin', 'B'), ('transaction_void', 'cashier', 'B'),
  ('cash_shift',           'admin', 'A'), ('cash_shift', 'cashier', 'P'),
  ('sales_return',         'admin', 'P'), ('sales_return', 'cashier', 'B'),
  ('receivables',          'admin', 'P'), ('receivables', 'cashier', 'B'),
  ('stock_opname_count',   'admin', 'P'), ('stock_opname_count', 'warehouse', 'P'),
  ('stock_opname_approve', 'admin', 'A'),
  ('employees',            'admin', 'L'),
  ('commissions',          'admin', 'L'), ('commissions', 'mechanic', 'S'),
  ('payroll',              'mechanic', 'S'), ('payroll', 'warehouse', 'S'),
  ('expenses',             'admin', 'B'), ('expenses', 'cashier', 'B');

create temporary table _codes (code text, action public.permission_action, scope public.permission_scope);
insert into _codes values
  ('P', 'view', 'all'), ('P', 'create', 'all'), ('P', 'update', 'all'), ('P', 'void', 'all'), ('P', 'export', 'all'),
  ('B', 'view', 'all'), ('B', 'create', 'all'),
  ('L', 'view', 'all'),
  ('A', 'approve', 'all'),
  ('S', 'view', 'own'),
  ('U', 'update', 'own');

insert into public.role_permissions (branch_id, role_id, permission_id, scope)
select r.branch_id, r.id, p.id, c.scope
from _matrix x
join public.roles r       on r.code = x.role_code
join _codes c             on position(c.code in x.codes) > 0
join public.permissions p on p.module = x.module and p.action = c.action;

drop table _modules, _matrix, _codes;
