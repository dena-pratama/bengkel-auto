-- =============================================================================
-- Layar pengaturan bengkel (PRD §18): ubah setelan operasional lewat fungsi yang memvalidasi nilai.
-- Setelan pajak (PPN, harga termasuk PPN) tetap dikelola di modul Pajak.
-- Perubahan tercatat di audit log (trigger audit pada tabel settings).
-- =============================================================================
create or replace function public.save_settings(p_data jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  v_key    text;
  v_val    jsonb;
  v_num    numeric;
  v_desc   jsonb := jsonb_build_object(
    'discount_limit_cashier', 'Batas diskon Kasir (% dari harga normal); di atasnya perlu PIN',
    'discount_limit_admin', 'Batas diskon Admin (% dari harga normal); di atasnya perlu PIN Owner',
    'opname_pin_threshold', 'Selisih nilai opname (Rp) di atas ini perlu PIN Owner',
    'sales_return_max_days', 'Batas hari retur penjualan dari tanggal nota; lewat batas perlu PIN',
    'allow_negative_stock', 'Izinkan stok minus (jual dulu, terima menyusul)',
    'part_issue_require_scan', 'Wajib scan QR barang dan rak saat mengeluarkan part untuk work order');
begin
  perform app.assert_permission('settings', 'update');
  if p_data is null or jsonb_typeof(p_data) <> 'object' or p_data = '{}'::jsonb then
    raise exception 'Tidak ada pengaturan yang diubah' using errcode = '22023';
  end if;

  for v_key, v_val in select * from jsonb_each(p_data) loop
    if not v_desc ? v_key then
      raise exception 'Pengaturan "%" tidak dikenal atau dikelola di modul lain', v_key using errcode = '22023';
    end if;
    if v_key in ('allow_negative_stock', 'part_issue_require_scan') then
      if jsonb_typeof(v_val) <> 'boolean' then raise exception 'Nilai % harus ya atau tidak', v_key using errcode = '22023'; end if;
    else
      if jsonb_typeof(v_val) <> 'number' then raise exception 'Nilai % harus berupa angka', v_key using errcode = '22023'; end if;
      v_num := (v_val #>> '{}')::numeric;
      if v_key like 'discount_limit_%' and (v_num < 0 or v_num > 100) then raise exception 'Batas diskon harus 0 sampai 100 persen' using errcode = '22023'; end if;
      if v_key = 'opname_pin_threshold' and v_num < 0 then raise exception 'Ambang opname tidak boleh minus' using errcode = '22023'; end if;
      if v_key = 'sales_return_max_days' and (v_num < 0 or v_num > 365 or v_num <> trunc(v_num)) then raise exception 'Batas hari retur harus bilangan bulat 0 sampai 365' using errcode = '22023'; end if;
    end if;
    insert into public.settings (branch_id, key, value, description)
    values (v_branch, v_key, v_val, v_desc ->> v_key)
    on conflict (branch_id, key) do update set value = excluded.value;
  end loop;
end;
$$;

revoke all on function public.save_settings(jsonb) from public, anon;
grant execute on function public.save_settings(jsonb) to authenticated;
