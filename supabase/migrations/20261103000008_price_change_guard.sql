-- Perketat izin ubah harga jual (PRD §16 price_change):
-- sebelumnya perubahan ke 0 lolos tanpa izin, sehingga pengguna tanpa izin bisa mengosongkan harga.
-- Kini: data baru boleh berharga 0 tanpa izin; perubahan harga pada data yang ada selalu butuh izin.
create or replace function app.assert_price_change(p_old numeric, p_new numeric)
returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if app.has_permission('price_change', 'create') then
    return;
  end if;
  if (p_old is null and coalesce(p_new, 0) <> 0)          -- data baru dengan harga
     or (p_old is not null and p_new is distinct from p_old) then  -- data lama, harga berubah
    raise exception 'Anda tidak punya izin mengubah harga jual' using errcode = '42501';
  end if;
end;
$$;

revoke all on function app.assert_price_change(numeric, numeric) from public, anon, authenticated;
