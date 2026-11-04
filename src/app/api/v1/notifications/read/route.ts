import { getUserContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Tandai semua notifikasi sebagai sudah dibaca (per karyawan). */
export async function POST() {
  const ctx = await getUserContext();
  if (!ctx) return Response.json({ error: "Sesi berakhir. Silakan masuk lagi." }, { status: 401 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notifications_read");
  if (error) return Response.json({ error: "Gagal menandai dibaca." }, { status: 500 });
  return Response.json({ ok: true });
}
