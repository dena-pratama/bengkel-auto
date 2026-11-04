-- =============================================================================
-- Kompatibilitas kendaraan pada barang (PRD §4.4): daftar merek/model/tahun/mesin yang cocok untuk tiap barang.
-- Tabel item_compatibilities sudah ada sejak master data; migration ini menambah fungsi simpan (ganti seluruh daftar
-- satu barang) yang membuat merek dan model baru bila belum ada. Perubahan tercatat di audit log.
-- =============================================================================
create or replace function public.save_item_compatibilities(p_item_id uuid, p_rows jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_branch uuid := app.current_branch_id();
  x        jsonb;
  v_model  uuid;
  v_from   integer;
  v_to     integer;
  v_seen   text[] := '{}';
  v_key    text;
begin
  perform app.assert_permission('master_data', 'update');
  perform app.assert_ref('items', p_item_id, 'Barang');
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'Daftar kendaraan tidak valid' using errcode = '22023'; end if;
  if jsonb_array_length(p_rows) > 200 then raise exception 'Maksimal 200 kendaraan per barang' using errcode = '22023'; end if;

  delete from public.item_compatibilities where item_id = p_item_id and branch_id = v_branch;
  for x in select * from jsonb_array_elements(p_rows) loop
    if nullif(btrim(x ->> 'make'), '') is null or nullif(btrim(x ->> 'model'), '') is null then
      raise exception 'Merek dan model kendaraan wajib diisi' using errcode = '22023';
    end if;
    v_from := nullif(x ->> 'year_from', '')::integer;
    v_to := nullif(x ->> 'year_to', '')::integer;
    if v_from is not null and v_from not between 1950 and 2100 or v_to is not null and v_to not between 1950 and 2100 then
      raise exception 'Tahun harus antara 1950 dan 2100' using errcode = '22023';
    end if;
    if v_from is not null and v_to is not null and v_to < v_from then
      raise exception 'Tahun akhir tidak boleh sebelum tahun awal' using errcode = '22023';
    end if;
    v_model := app.resolve_vehicle_model(x ->> 'make', x ->> 'model');
    v_key := v_model::text || '|' || coalesce(v_from::text, '') || '|' || coalesce(v_to::text, '') || '|' || lower(coalesce(btrim(x ->> 'engine'), ''));
    if v_key = any(v_seen) then continue; end if;   -- baris kembar diabaikan
    v_seen := v_seen || v_key;
    insert into public.item_compatibilities (branch_id, item_id, model_id, year_from, year_to, engine)
    values (v_branch, p_item_id, v_model, v_from, v_to, nullif(btrim(x ->> 'engine'), ''));
  end loop;
end;
$$;

revoke all on function public.save_item_compatibilities(uuid, jsonb) from public, anon;
grant execute on function public.save_item_compatibilities(uuid, jsonb) to authenticated;
