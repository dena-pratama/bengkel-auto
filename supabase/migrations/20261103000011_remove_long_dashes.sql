-- Hapus tanda pisah panjang (em dash U+2014, en dash U+2013) dari pesan & teks fungsi database.
-- Fungsi yang sudah terpasang ditulis ulang dari definisinya sendiri (hak akses tetap karena
-- CREATE OR REPLACE). Karakter dicari lewat chr() agar file ini sendiri bebas tanda pisah panjang.
do $$
declare
  r     record;
  v_def text;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app')
      and p.prosrc ~ ('[' || chr(8212) || chr(8211) || ']')
  loop
    v_def := pg_get_functiondef(r.oid);
    v_def := replace(v_def, ' ' || chr(8212) || ' ', ': ');
    v_def := replace(v_def, chr(8212), '-');
    v_def := replace(v_def, chr(8211), '-');
    execute v_def;
  end loop;
end $$;
