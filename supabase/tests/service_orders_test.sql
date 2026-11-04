-- Tes servis: estimasi, work order, papan status, pengeluaran part, garansi (migration 20261103000013).
-- Berjalan dalam satu transaksi dan di-ROLLBACK, jadi tidak meninggalkan data.

\set QUIET on
\o /dev/null
begin;

create temporary table t_ids (k text primary key, v uuid);
grant select, insert on t_ids to authenticated;
insert into t_ids values ('u_owner', gen_random_uuid()), ('u_admin', gen_random_uuid()), ('u_wh', gen_random_uuid()),
  ('u_cashier', gen_random_uuid()), ('u_mech', gen_random_uuid()), ('u_mech2', gen_random_uuid());

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
select v, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', k || '@test.local', now(), now()
from t_ids;

do $$
declare
  b uuid := (select id from public.branches where code = 'PST');
  e uuid;
  r record;
begin
  for r in select * from (values ('u_owner', 'owner', 'T-OWN'), ('u_admin', 'admin', 'T-ADM'), ('u_wh', 'warehouse', 'T-GDG'),
                                 ('u_cashier', 'cashier', 'T-KSR'), ('u_mech', 'mechanic', 'T-MK1'), ('u_mech2', 'mechanic', 'T-MK2')) x(k, role_code, code) loop
    insert into public.employees (branch_id, code, full_name) values (b, r.code, 'Uji ' || r.code) returning id into e;
    insert into t_ids values ('e_' || substr(r.k, 3), e);
    insert into public.profiles (id, branch_id, employee_id, email)
      values ((select v from t_ids where k = r.k), b, e, r.k || '@test.local');
    insert into public.employee_roles (branch_id, employee_id, role_id)
      values (b, e, (select id from public.roles where code = r.role_code));
  end loop;
end $$;

create or replace function pg_temp.login(p_key text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select v from t_ids where k = p_key), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.check(p_ok boolean, p_name text) returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'GAGAL: %', p_name; end if;
  raise notice 'OK   %', p_name;
end $$;

create or replace function pg_temp.fails(p_sql text, p_expect text, p_name text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'GAGAL (tidak error): %', p_name;
exception when others then
  if sqlerrm like 'GAGAL%' then raise; end if;
  if position(p_expect in sqlerrm) = 0 then
    raise exception 'GAGAL: %: pesan tak terduga: %', p_name, sqlerrm;
  end if;
  raise notice 'OK   %', p_name;
end $$;

create or replace function pg_temp.id(p_key text) returns uuid language sql as $$ select v from t_ids where k = p_key $$;
create or replace function pg_temp.unit(p_code text) returns uuid language sql as $$ select id from public.units where code = p_code $$;
create or replace function pg_temp.stock(p_key text) returns numeric language sql as $$
  select coalesce(sum(qty), 0) from public.stock_balances where item_id = pg_temp.id(p_key) $$;
-- Baris WO berdasarkan urutan
create or replace function pg_temp.line(p_wo text, p_n int) returns uuid language sql as $$
  select id from public.work_order_items where work_order_id = pg_temp.id(p_wo) and sort_order = p_n $$;
create temporary table t_start as select now() as created_at;
grant select on t_start to authenticated;
-- Saldo akun sistem dari jurnal tes ini (debit - kredit), dibaca sebagai admin DB
create or replace function pg_temp.bal(p_key text) returns numeric language sql as $$
  select coalesce(sum(l.debit - l.credit), 0) from public.journal_lines l
  join public.accounts a on a.id = l.account_id where a.system_key = p_key
    and l.entry_id in (select id from public.journal_entries where created_at >= (select min(created_at) from t_start)) $$;

-- ---------------------------------------------------------------------------
-- Persiapan master (owner): oli 10 pcs @ 40.000, jasa ganti oli, paket, pelanggan & kendaraan
-- ---------------------------------------------------------------------------
select pg_temp.login('u_owner');
insert into t_ids select 'l_bin', public.save_location(null, (select id from public.locations where code = 'GDG'), 'rack', 'TSV', 'Rak Tes Servis');
insert into t_ids select 'i_oil', public.save_item(null,
  jsonb_build_object('name', 'Oli Tes Servis', 'base_unit_id', pg_temp.unit('pcs'), 'sell_price', 60000, 'warranty_days', 30));
select public.post_opening_stock(pg_temp.id('i_oil'), pg_temp.id('l_bin'), 10, 40000);
insert into t_ids select 's_oli', public.save_service(null,
  '{"name": "Jasa Ganti Oli Tes", "price": 50000, "duration_minutes": 30, "warranty_days": 7, "commission_value": 10}');
insert into t_ids select 's_tune', public.save_service(null, '{"name": "Tune Up Tes", "price": 150000, "duration_minutes": 90}');
insert into t_ids select 'p_kit', public.save_package(null, '{"name": "Paket Oli Tes", "price": 100000}',
  jsonb_build_array(jsonb_build_object('item_id', pg_temp.id('i_oil'), 'qty', 1), jsonb_build_object('service_id', pg_temp.id('s_oli'), 'qty', 1)));
insert into t_ids select 'c_budi', public.save_customer(null, '{"name": "Budi Servis"}');
insert into t_ids select 'v_avz', public.save_vehicle(null, '{"plate_no": "B 7788 TES", "make": "Toyota", "model": "Avanza", "last_odometer": "45000"}',
  pg_temp.id('c_budi'));

-- ---------------------------------------------------------------------------
-- Estimasi
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('u_admin');
insert into t_ids select 'est', public.save_estimate(null,
  jsonb_build_object('vehicle_id', pg_temp.id('v_avz'), 'odometer', 46000, 'complaint', 'Ganti oli rutin', 'discount_amount', 10000),
  jsonb_build_array(jsonb_build_object('type', 'service', 'service_id', pg_temp.id('s_oli')),
                    jsonb_build_object('type', 'part', 'item_id', pg_temp.id('i_oil'), 'qty', 2, 'discount_amount', 5000)));
select pg_temp.check((select estimate_no like 'EST-%' and version = 1 and status = 'draft' and subtotal = 165000 and total = 155000
                             and customer_id = pg_temp.id('c_budi') and plate_no = 'B 7788 TES' and valid_until = app.today_wib() + 7
                      from public.estimates where id = pg_temp.id('est')),
  'estimasi: nomor EST, harga dari master, diskon baris & total, pemilik & plat tercatat');
select pg_temp.fails($q$ select public.save_estimate(null, jsonb_build_object('vehicle_id', pg_temp.id('v_avz')), '[]') $q$,
  'minimal berisi', 'estimasi: tanpa baris ditolak');
select pg_temp.fails($q$ select public.save_estimate(null, jsonb_build_object('vehicle_id', pg_temp.id('v_avz'), 'discount_amount', 999999),
    jsonb_build_array(jsonb_build_object('type', 'service', 'service_id', pg_temp.id('s_oli')))) $q$,
  'melebihi subtotal', 'estimasi: diskon melebihi subtotal ditolak');

insert into t_ids select 'est_pkt', public.save_estimate(null, jsonb_build_object('vehicle_id', pg_temp.id('v_avz')),
  jsonb_build_array(jsonb_build_object('type', 'package', 'package_id', pg_temp.id('p_kit'))));
select pg_temp.check((select count(*) = 2 and sum(line_total) = 100000 and bool_and(package_id = pg_temp.id('p_kit'))
                      from public.estimate_items where estimate_id = pg_temp.id('est_pkt')),
  'estimasi paket: dipecah per komponen, total = harga paket');

-- Ubah draft = di tempat (tetap versi 1)
select public.save_estimate(pg_temp.id('est'),
  jsonb_build_object('odometer', 46000, 'complaint', 'Ganti oli rutin', 'discount_amount', 10000),
  jsonb_build_array(jsonb_build_object('type', 'service', 'service_id', pg_temp.id('s_oli')),
                    jsonb_build_object('type', 'part', 'item_id', pg_temp.id('i_oil'), 'qty', 2, 'discount_amount', 5000)));
select pg_temp.check((select count(*) = 1 from public.estimates where estimate_no = (select estimate_no from public.estimates where id = pg_temp.id('est'))),
  'estimasi draft: diubah di tempat');

-- Terkirim lalu direvisi = versi baru, versi lama tersimpan
select public.mark_estimate_sent(pg_temp.id('est'));
insert into t_ids select 'est_v2', public.save_estimate(pg_temp.id('est'),
  jsonb_build_object('odometer', 46000, 'complaint', 'Ganti oli + filter', 'discount_amount', 10000),
  jsonb_build_array(jsonb_build_object('type', 'service', 'service_id', pg_temp.id('s_oli')),
                    jsonb_build_object('type', 'part', 'item_id', pg_temp.id('i_oil'), 'qty', 2, 'discount_amount', 5000)));
select pg_temp.check((select status = 'revised' from public.estimates where id = pg_temp.id('est'))
                     and (select version = 2 and previous_id = pg_temp.id('est') and status = 'draft' from public.estimates where id = pg_temp.id('est_v2'))
                     and (select count(*) = 2 from public.estimate_items where estimate_id = pg_temp.id('est')),
  'revisi: versi 2 dibuat, versi 1 tersimpan berstatus revised beserta barisnya');
select pg_temp.check((select bool_and(is_latest = (id = pg_temp.id('est_v2'))) from public.v_estimates
                      where estimate_no = (select estimate_no from public.estimates where id = pg_temp.id('est'))),
  'v_estimates: hanya versi terbaru bertanda is_latest');
select pg_temp.fails($q$ select public.approve_estimate(pg_temp.id('est'), 'phone') $q$, 'tidak bisa disetujui', 'versi lama tidak bisa disetujui');
select pg_temp.fails($q$ select public.convert_estimate_to_work_order(pg_temp.id('est_v2')) $q$, 'disetujui pelanggan', 'belum disetujui: tidak bisa jadi WO');

-- Kedaluwarsa
reset role;
update public.estimates set valid_until = app.today_wib() - 1 where id = pg_temp.id('est_pkt');
select pg_temp.login('u_admin');
select pg_temp.fails($q$ select public.approve_estimate(pg_temp.id('est_pkt'), 'chat') $q$, 'lewat masa berlaku', 'estimasi kedaluwarsa tidak bisa disetujui');

-- Hak akses estimasi
reset role;
select pg_temp.login('u_mech');
select pg_temp.check((select count(*) = 0 from public.estimates), 'mekanik: tidak melihat estimasi');
select pg_temp.fails($q$ select public.save_estimate(null, jsonb_build_object('vehicle_id', pg_temp.id('v_avz')),
    jsonb_build_array(jsonb_build_object('type', 'service', 'service_id', pg_temp.id('s_oli')))) $q$, 'tidak punya izin', 'mekanik: tidak bisa membuat estimasi');
reset role;
select pg_temp.login('u_cashier');
select pg_temp.check((select count(*) >= 3 from public.estimates), 'kasir: bisa melihat estimasi');
select pg_temp.fails($q$ select public.approve_estimate(pg_temp.id('est_v2'), 'phone') $q$, 'tidak punya izin', 'kasir: tidak bisa menyetujui estimasi');

-- ---------------------------------------------------------------------------
-- Disetujui -> work order (satu klik)
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('u_admin');
insert into t_ids select 'wo', public.approve_estimate(pg_temp.id('est_v2'), 'phone', 'Setuju lewat telepon', '{}');
select pg_temp.check((select wo_no like 'WO-%' and status = 'queued' and discount_amount = 10000 and odometer_in = 46000
                             and vehicle_label like 'Toyota Avanza%' and estimate_id = pg_temp.id('est_v2')
                      from public.work_orders where id = pg_temp.id('wo')),
  'WO: dibuat dari estimasi, status Antri, diskon & kilometer terbawa');
select pg_temp.check((select status = 'converted' and approval_channel = 'phone' and work_order_id = pg_temp.id('wo')
                      from public.estimates where id = pg_temp.id('est_v2')), 'estimasi: tercatat disetujui lewat telepon & converted');
select pg_temp.check((select count(*) = 2 from public.work_order_items where work_order_id = pg_temp.id('wo')), 'WO: baris tersalin dari estimasi');
select pg_temp.check((select last_odometer = 46000 from public.vehicles where id = pg_temp.id('v_avz')), 'kendaraan: kilometer terakhir diperbarui');
select pg_temp.check((select total = 155000 and services = 'Jasa Ganti Oli Tes' and parts_pending = 1 from public.v_work_orders where id = pg_temp.id('wo')),
  'v_work_orders: total, daftar jasa, part belum keluar');
select pg_temp.fails($q$ select public.convert_estimate_to_work_order(pg_temp.id('est_v2')) $q$, 'disetujui pelanggan', 'estimasi tidak bisa dijadikan WO dua kali');

-- WO kedua dari paket (tanpa mekanik saya)
reset role;
update public.estimates set valid_until = app.today_wib() where id = pg_temp.id('est_pkt');
select pg_temp.login('u_admin');
select public.approve_estimate(pg_temp.id('est_pkt'), 'in_person');
insert into t_ids select 'wo2', public.convert_estimate_to_work_order(pg_temp.id('est_pkt'), '{}');

-- ---------------------------------------------------------------------------
-- Mekanik per jasa & lingkup "milik sendiri"
-- ---------------------------------------------------------------------------
select public.set_work_order_mechanics(pg_temp.line('wo', 1), jsonb_build_array(jsonb_build_object('employee_id', pg_temp.id('e_mech'))));
select pg_temp.check((select share_percent = 100 from public.work_order_mechanics where work_order_item_id = pg_temp.line('wo', 1)), 'mekanik tunggal: porsi 100%');
select public.set_work_order_mechanics(pg_temp.line('wo', 1),
  jsonb_build_array(jsonb_build_object('employee_id', pg_temp.id('e_mech')), jsonb_build_object('employee_id', pg_temp.id('e_mech2'))));
select pg_temp.check((select count(*) = 2 and sum(share_percent) = 100 and min(share_percent) = 50 from public.work_order_mechanics
                      where work_order_item_id = pg_temp.line('wo', 1)), 'dua mekanik: dibagi rata 50/50');
select pg_temp.fails($q$ select public.set_work_order_mechanics(pg_temp.line('wo', 1),
    jsonb_build_array(jsonb_build_object('employee_id', pg_temp.id('e_mech'), 'share_percent', 70),
                      jsonb_build_object('employee_id', pg_temp.id('e_mech2'), 'share_percent', 20))) $q$, 'harus 100', 'porsi mekanik tidak 100% ditolak');
select pg_temp.fails($q$ select public.set_work_order_mechanics(pg_temp.line('wo', 2),
    jsonb_build_array(jsonb_build_object('employee_id', pg_temp.id('e_mech')))) $q$, 'baris jasa', 'mekanik hanya untuk baris jasa');
select public.set_work_order_mechanics(pg_temp.line('wo', 1),
  jsonb_build_array(jsonb_build_object('employee_id', pg_temp.id('e_mech'), 'share_percent', 60),
                    jsonb_build_object('employee_id', pg_temp.id('e_mech2'), 'share_percent', 40)));
select pg_temp.check((select mechanics like '%Uji T-MK1%' and mechanics like '%Uji T-MK2%' from public.v_work_orders where id = pg_temp.id('wo')),
  'v_work_orders: nama mekanik tampil');
select pg_temp.check((select count(*) >= 2 from public.list_mechanics() where id in (pg_temp.id('e_mech'), pg_temp.id('e_mech2'))),
  'daftar mekanik untuk dipilih');

reset role;
select pg_temp.login('u_mech');
select pg_temp.check((select count(*) = 1 and bool_and(id = pg_temp.id('wo')) from public.work_orders), 'mekanik: hanya melihat WO yang ia kerjakan');
select pg_temp.check((select count(*) = 1 from public.v_work_orders), 'mekanik: papan hanya WO miliknya');
select pg_temp.check((select count(*) = 2 from public.work_order_items), 'mekanik: melihat baris WO miliknya');

-- ---------------------------------------------------------------------------
-- Papan status
-- ---------------------------------------------------------------------------
select public.set_work_order_status(pg_temp.id('wo'), 'in_progress');
select pg_temp.check((select status = 'in_progress' and started_at is not null from public.work_orders where id = pg_temp.id('wo')),
  'mekanik: ubah status WO miliknya ke Dikerjakan');
select pg_temp.fails($q$ select public.set_work_order_status(pg_temp.id('wo2'), 'in_progress') $q$, 'tidak punya izin', 'mekanik: tidak bisa mengubah WO orang lain');
select pg_temp.fails($q$ select public.set_work_order_status(pg_temp.id('wo'), 'ready') $q$, 'tidak bisa langsung', 'status: tidak boleh lompat');
select pg_temp.fails($q$ select public.set_work_order_status(pg_temp.id('wo'), 'quality_check') $q$, 'belum dikeluarkan', 'QC: part belum keluar ditolak');
select public.set_work_order_status(pg_temp.id('wo'), 'waiting_parts', 'Oli habis di rak');
select pg_temp.check((select status = 'waiting_parts' from public.work_orders where id = pg_temp.id('wo')), 'status: Menunggu Part');
select public.set_work_order_status(pg_temp.id('wo'), 'in_progress');

-- Mekanik minta part; tidak bisa mengeluarkan sendiri
select public.request_work_order_part(pg_temp.line('wo', 2));
select pg_temp.check((select parts_requested = 1 from public.v_work_orders where id = pg_temp.id('wo')), 'mekanik: minta part ke gudang');
select pg_temp.fails($q$ select public.issue_work_order_part(pg_temp.line('wo', 2), 2, pg_temp.id('l_bin')) $q$, 'tidak punya izin', 'mekanik: tidak bisa mengeluarkan part');

reset role;
select pg_temp.login('u_cashier');
select pg_temp.fails($q$ select public.issue_work_order_part(pg_temp.line('wo', 2), 2, pg_temp.id('l_bin')) $q$, 'tidak punya izin', 'kasir: tidak bisa mengeluarkan part');

-- ---------------------------------------------------------------------------
-- Pengeluaran part (gudang)
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('u_wh');
select pg_temp.fails($q$ select public.issue_work_order_part(pg_temp.line('wo', 2), 3, pg_temp.id('l_bin')) $q$, 'melebihi kebutuhan', 'keluar part melebihi kebutuhan WO ditolak');
select public.issue_work_order_part(pg_temp.line('wo', 2), 2, pg_temp.id('l_bin'), 'scan rak TSV');
select pg_temp.check(pg_temp.stock('i_oil') = 8, 'keluar part: stok 10 -> 8');
select pg_temp.check((select issued_qty = 2 from public.work_order_items where id = pg_temp.line('wo', 2)), 'keluar part: jumlah keluar tercatat di baris WO');
select pg_temp.check((select count(*) = 1 from public.stock_movements where source_type = 'part_issue' and movement_type = 'service_usage'
                      and item_id = pg_temp.id('i_oil')), 'keluar part: mutasi stok service_usage');
reset role;
select pg_temp.check(pg_temp.bal('wip') = 80000 and pg_temp.bal('inventory') = -80000,
  'jurnal: Dr Persediaan dalam Pengerjaan 80.000, Cr Persediaan Sparepart');

-- ---------------------------------------------------------------------------
-- Pekerjaan tambahan (wajib persetujuan pelanggan)
-- ---------------------------------------------------------------------------
select pg_temp.login('u_admin');
insert into t_ids select 'est_add', public.add_work_order_work(pg_temp.id('wo'),
  jsonb_build_array(jsonb_build_object('type', 'service', 'service_id', pg_temp.id('s_tune'))), '{"complaint": "Mesin brebet"}');
select pg_temp.check((select status = 'waiting_approval' from public.work_orders where id = pg_temp.id('wo'))
                     and (select is_additional and status = 'draft' from public.estimates where id = pg_temp.id('est_add')),
  'tambahan: tercatat sebagai estimasi tambahan, WO Menunggu Persetujuan');
select pg_temp.check((select pending_estimate_id = pg_temp.id('est_add') from public.v_work_orders where id = pg_temp.id('wo')),
  'v_work_orders: estimasi tambahan yang menunggu tampil');
select pg_temp.fails($q$ select public.add_work_order_work(pg_temp.id('wo'),
    jsonb_build_array(jsonb_build_object('type', 'service', 'service_id', pg_temp.id('s_oli')))) $q$, 'menunggu persetujuan', 'tambahan kedua saat menunggu ditolak');
reset role;
select pg_temp.login('u_mech');
select pg_temp.fails($q$ select public.set_work_order_status(pg_temp.id('wo'), 'in_progress') $q$, 'tidak bisa langsung', 'mekanik: tidak bisa melewati persetujuan pelanggan');
reset role;
select pg_temp.login('u_admin');
select public.approve_estimate(pg_temp.id('est_add'), 'chat', 'OK via WA');
select pg_temp.check((select status = 'in_progress' and status_before_approval is null from public.work_orders where id = pg_temp.id('wo'))
                     and (select count(*) = 3 from public.work_order_items where work_order_id = pg_temp.id('wo'))
                     and (select status = 'converted' from public.estimates where id = pg_temp.id('est_add')),
  'tambahan disetujui: baris masuk WO, status kembali Dikerjakan');

-- Tambahan yang ditolak: WO kembali tanpa baris baru
insert into t_ids select 'est_rej', public.add_work_order_work(pg_temp.id('wo'),
  jsonb_build_array(jsonb_build_object('type', 'service', 'service_id', pg_temp.id('s_oli'))));
select public.reject_estimate(pg_temp.id('est_rej'), 'Pelanggan menolak');
select pg_temp.check((select status = 'in_progress' from public.work_orders where id = pg_temp.id('wo'))
                     and (select count(*) = 3 from public.work_order_items where work_order_id = pg_temp.id('wo')),
  'tambahan ditolak: WO kembali Dikerjakan tanpa baris baru');

-- Tambahan yang langsung disetujui di tempat
select public.add_work_order_work(pg_temp.id('wo'),
  jsonb_build_array(jsonb_build_object('type', 'part', 'item_id', pg_temp.id('i_oil'), 'qty', 1)), '{}', '{"channel": "in_person"}');
select pg_temp.check((select status = 'in_progress' from public.work_orders where id = pg_temp.id('wo'))
                     and (select count(*) = 4 from public.work_order_items where work_order_id = pg_temp.id('wo')),
  'tambahan langsung disetujui: baris masuk tanpa menunggu');

-- ---------------------------------------------------------------------------
-- Part kembali (tidak terpakai)
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('u_wh');
select public.issue_work_order_part(pg_temp.line('wo', 4), 1, pg_temp.id('l_bin'), null, true);
select public.return_work_order_part(pg_temp.line('wo', 4), 1, pg_temp.id('l_bin'), 'Tidak jadi dipakai');

select pg_temp.check((select is_cancelled and issued_qty = 0 from public.work_order_items where id = pg_temp.line('wo', 4)),
  'kembali semua: baris part batal (tidak ditagih)');
select public.return_work_order_part(pg_temp.line('wo', 2), 1, pg_temp.id('l_bin'));
select pg_temp.check((select qty = 1 and issued_qty = 1 and line_total = 57500 from public.work_order_items where id = pg_temp.line('wo', 2)),
  'kembali sebagian: jumlah & nilai tagihan baris berkurang');
select pg_temp.fails($q$ select public.return_work_order_part(pg_temp.line('wo', 2), 5, pg_temp.id('l_bin')) $q$, 'melebihi part', 'kembali melebihi yang keluar ditolak');
select pg_temp.check(pg_temp.stock('i_oil') = 9, 'stok: 10 - 2 - 1 + 1 + 1 = 9');
select pg_temp.check((select count(*) = 2 from public.stock_movements where movement_type = 'service_return' and item_id = pg_temp.id('i_oil')),
  'part kembali: mutasi service_return');
reset role;
select pg_temp.check(pg_temp.bal('wip') = 40000 and pg_temp.bal('inventory') = -40000,
  'jurnal part kembali: Persediaan dalam Pengerjaan tersisa 1 x 40.000');
select pg_temp.check((select avg_cost = 40000 from public.item_costs where item_id = pg_temp.id('i_oil')), 'HPP rata-rata tidak berubah oleh part kembali');

-- ---------------------------------------------------------------------------
-- Selesai, siap, diserahkan (terkunci)
-- ---------------------------------------------------------------------------
select pg_temp.login('u_mech');
select public.set_work_order_status(pg_temp.id('wo'), 'quality_check');
select public.set_work_order_status(pg_temp.id('wo'), 'ready');
select pg_temp.check((select completed_at is not null from public.work_orders where id = pg_temp.id('wo')), 'mekanik: QC lalu Siap Diambil');
select pg_temp.fails($q$ select public.set_work_order_status(pg_temp.id('wo'), 'delivered') $q$, 'tidak punya izin', 'mekanik: tidak bisa menyerahkan kendaraan');
reset role;
select pg_temp.login('u_admin');
select pg_temp.fails($q$ select public.set_work_order_status(pg_temp.id('wo'), 'delivered') $q$, 'Buat invoice', 'penyerahan butuh invoice dulu');
reset role;
select pg_temp.login('u_cashier');
select public.open_shift(0);
select public.post_work_order_invoice(pg_temp.id('wo'), '[{"method": "cash", "amount": 247500}]');
reset role;
select pg_temp.login('u_admin');
select public.set_work_order_status(pg_temp.id('wo'), 'delivered');
select pg_temp.check((select status = 'delivered' and delivered_at is not null from public.work_orders where id = pg_temp.id('wo')), 'admin: kendaraan diserahkan');
select pg_temp.check((select total = 50000 + 57500 + 150000 - 10000 and warranty_until = app.today_wib() + 30 from public.v_work_orders where id = pg_temp.id('wo')),
  'v_work_orders: total akhir & garansi s/d (30 hari dari diserahkan)');
select pg_temp.check((select count(*) >= 8 from public.work_order_status_logs where work_order_id = pg_temp.id('wo')), 'riwayat status tercatat');
reset role;
select pg_temp.login('u_wh');
select pg_temp.fails($q$ select public.return_work_order_part(pg_temp.line('wo', 2), 1, pg_temp.id('l_bin')) $q$, 'terkunci', 'WO diserahkan: terkunci');
reset role;
select pg_temp.login('u_admin');
select pg_temp.fails($q$ select public.add_work_order_work(pg_temp.id('wo'),
    jsonb_build_array(jsonb_build_object('type', 'service', 'service_id', pg_temp.id('s_oli')))) $q$, 'terkunci', 'WO diserahkan: tidak bisa ditambah');

-- ---------------------------------------------------------------------------
-- Batal WO
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.login('u_wh');
-- Pengeluaran part dengan scan QR: setelan wajib scan menolak pengeluaran manual
reset role;
update public.settings set value = 'true'::jsonb where key = 'part_issue_require_scan';
select pg_temp.login('u_wh');
select pg_temp.fails(format($q$ select public.issue_work_order_part('%s', 1, '%s') $q$, (select id from public.work_order_items where work_order_id = pg_temp.id('wo2') and line_type = 'part'), pg_temp.id('l_bin')), 'wajib scan', 'setelan wajib scan: pengeluaran manual ditolak');
select pg_temp.fails(format($q$ select public.issue_work_order_part('%s', 1, '%s', null, false) $q$, (select id from public.work_order_items where work_order_id = pg_temp.id('wo2') and line_type = 'part'), pg_temp.id('l_bin')), 'wajib scan', 'setelan wajib scan: scanned=false ditolak');
select public.issue_work_order_part((select id from public.work_order_items where work_order_id = pg_temp.id('wo2') and line_type = 'part'), 1, pg_temp.id('l_bin'), null, true);
select pg_temp.check((select scanned from public.part_issues where work_order_item_id = (select id from public.work_order_items where work_order_id = pg_temp.id('wo2') and line_type = 'part') and kind = 'issue'), 'pengeluaran dengan scan diterima dan ditandai scanned');
reset role;
update public.settings set value = 'false'::jsonb where key = 'part_issue_require_scan';
select pg_temp.login('u_wh');
reset role;
select pg_temp.login('u_admin');
select pg_temp.fails($q$ select public.void_work_order(pg_temp.id('wo2'), 'Pelanggan batal') $q$, 'Kembalikan dulu', 'batal WO: part keluar harus kembali dulu');
reset role;
select pg_temp.login('u_wh');
select public.return_work_order_part((select id from public.work_order_items where work_order_id = pg_temp.id('wo2') and line_type = 'part'), 1, pg_temp.id('l_bin'));
reset role;
select pg_temp.login('u_admin');
select public.void_work_order(pg_temp.id('wo2'), 'Pelanggan batal');
select pg_temp.check((select status = 'void' and void_reason = 'Pelanggan batal' from public.work_orders where id = pg_temp.id('wo2')), 'batal WO: status void + alasan');
select pg_temp.fails($q$ select public.set_work_order_status(pg_temp.id('wo2'), 'in_progress') $q$, 'dibatalkan', 'WO batal tidak bisa diubah');

-- ---------------------------------------------------------------------------
-- Klaim garansi: WO baru Rp0, biaya part ke Beban Garansi
-- ---------------------------------------------------------------------------
select pg_temp.fails($q$ select public.create_warranty_work_order(pg_temp.id('wo'), array[pg_temp.line('wo', 3)], '{"complaint": "Masih brebet"}') $q$,
  'tidak bergaransi', 'garansi: jasa tanpa garansi ditolak');
insert into t_ids select 'wo_g', public.create_warranty_work_order(pg_temp.id('wo'), array[pg_temp.line('wo', 1), pg_temp.line('wo', 2)],
  '{"complaint": "Oli rembes", "odometer": "46500"}');
select pg_temp.check((select is_warranty and warranty_source_id = pg_temp.id('wo') and status = 'queued' and total = 0 from public.v_work_orders
                      where id = pg_temp.id('wo_g')), 'garansi: WO baru bertanda Garansi, Rp0 ke pelanggan');
select pg_temp.check((select last_odometer = 46500 from public.vehicles where id = pg_temp.id('v_avz')), 'garansi: kilometer kendaraan diperbarui');
reset role;
select pg_temp.login('u_wh');
select public.issue_work_order_part((select id from public.work_order_items where work_order_id = pg_temp.id('wo_g') and line_type = 'part'), 1, pg_temp.id('l_bin'));
reset role;
select pg_temp.check(pg_temp.bal('warranty_expense') = 40000, 'garansi: part keluar dicatat sebagai Beban Garansi');

-- ---------------------------------------------------------------------------
-- Riwayat servis kendaraan, hapus permanen
-- ---------------------------------------------------------------------------
select pg_temp.login('u_admin');
select pg_temp.check((select count(*) = 3 from public.v_work_orders where vehicle_id = pg_temp.id('v_avz')), 'riwayat servis: semua WO kendaraan');
reset role;
select pg_temp.fails($q$ delete from public.work_orders where id = pg_temp.id('wo2') $q$, 'append-only', 'WO tidak bisa dihapus');
select pg_temp.fails($q$ update public.part_issues set qty = 99 $q$, 'append-only', 'part_issues tidak bisa diubah');

reset role;
rollback;
\o
\echo SEMUA TES SERVIS LULUS
