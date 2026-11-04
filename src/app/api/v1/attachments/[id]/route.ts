import { getUserContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lepas lampiran (ditandai, berkas tetap tersimpan untuk jejak audit). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return Response.json({ error: "Sesi berakhir. Silakan masuk lagi." }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Lampiran tidak ditemukan." }, { status: 404 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_attachment", { p_id: id });
  if (error) return Response.json({ error: error.code === "42501" ? "Anda tidak punya izin." : error.message }, { status: error.code === "42501" ? 403 : 422 });
  return Response.json({ ok: true });
}

/** Buka lampiran: izin dicek lewat RLS pengguna, lalu dialihkan ke URL bertanda tangan jangka pendek. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return Response.json({ error: "Sesi berakhir. Silakan masuk lagi." }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return Response.json({ error: "Lampiran tidak ditemukan." }, { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase.from("attachments").select("path, file_name, mime_type, entity_type").eq("id", id).maybeSingle();
  if (!data) return Response.json({ error: "Lampiran tidak ditemukan." }, { status: 404 });
  const signed = await createAdminClient().storage.from("attachments").createSignedUrl(data.path as string, 60);
  if (signed.error || !signed.data) return Response.json({ error: "Berkas tidak tersedia." }, { status: 404 });
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // URL bertanda tangan dibuat terhadap alamat internal; arahkan ke alamat yang bisa dijangkau browser
  const internal = process.env.SUPABASE_INTERNAL_URL;
  const url = internal && signed.data.signedUrl.startsWith(internal) ? signed.data.signedUrl.replace(internal, base) : signed.data.signedUrl;
  const cache = data.entity_type === "employee_avatar" ? "private, max-age=45" : "private, no-store";
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": cache } });
}
