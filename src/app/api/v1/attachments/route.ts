import { randomUUID } from "node:crypto";
import { getUserContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ALLOWED_MIMES, ENTITY_TYPES, EXT, MAX_BYTES, sniffMime, type EntityType } from "@/lib/validation/attachments";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Daftar lampiran aktif satu dokumen (RLS menentukan siapa yang boleh melihat). Parameter: entity_type, entity_id. */
export async function GET(request: Request) {
  const ctx = await getUserContext();
  if (!ctx) return Response.json({ error: "Sesi berakhir. Silakan masuk lagi." }, { status: 401 });
  const q = new URL(request.url).searchParams;
  const type = q.get("entity_type") as EntityType;
  const entityId = q.get("entity_id") ?? "";
  if (!ENTITY_TYPES.includes(type) || !UUID.test(entityId)) return Response.json({ error: "Dokumen tidak valid." }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.from("attachments").select("id, file_name, mime_type, size_bytes, created_at").eq("entity_type", type).eq("entity_id", entityId).order("created_at");
  if (error) return Response.json({ error: "Gagal memuat lampiran." }, { status: 500 });
  return Response.json({ items: data ?? [] });
}

/** Unggah lampiran (multipart: entity_type, entity_id, file). Berkas masuk bucket privat; izin dicek di database. */
export async function POST(request: Request) {
  const ctx = await getUserContext();
  if (!ctx) return Response.json({ error: "Sesi berakhir. Silakan masuk lagi." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Permintaan unggah tidak valid." }, { status: 400 });
  }
  const type = String(form.get("entity_type") ?? "") as EntityType;
  const entityId = String(form.get("entity_id") ?? "");
  const file = form.get("file");
  if (!ENTITY_TYPES.includes(type) || !UUID.test(entityId)) return Response.json({ error: "Dokumen tujuan tidak valid." }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Pilih berkas yang akan diunggah." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Ukuran berkas maksimal 5 MB." }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime || !ALLOWED_MIMES[type].includes(mime)) {
    return Response.json({ error: type === "item" || type === "employee_avatar" ? "Foto harus berformat JPG, PNG, atau WebP." : "Berkas harus berformat JPG, PNG, WebP, atau PDF." }, { status: 415 });
  }

  const path = `${ctx.branch.id}/${type}/${entityId}/${randomUUID()}.${EXT[mime]}`;
  // Catat dulu dengan sesi pengguna: izin, dokumen induk, dan batas jumlah dicek di database
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("register_attachment", {
    p_entity_type: type,
    p_entity_id: entityId,
    p_path: path,
    p_file_name: file.name || `lampiran.${EXT[mime]}`,
    p_mime: mime,
    p_size: file.size,
  });
  if (error) return Response.json({ error: error.code === "42501" ? "Anda tidak punya izin." : error.message }, { status: error.code === "42501" ? 403 : 422 });

  const up = await createAdminClient().storage.from("attachments").upload(path, bytes, { contentType: mime, upsert: false });
  if (up.error) {
    console.error("[attachments] upload gagal", up.error.message);
    await supabase.rpc("remove_attachment", { p_id: id });
    return Response.json({ error: "Gagal menyimpan berkas. Coba lagi." }, { status: 502 });
  }
  return Response.json({ id });
}
