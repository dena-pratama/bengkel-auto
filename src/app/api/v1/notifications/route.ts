import { can, getUserContext } from "@/lib/auth";
import { recentNotifications } from "@/lib/notifications";

/** Notifikasi terbaru + jumlah belum dibaca untuk bel di top bar. Kosong bila peran tidak diizinkan. */
export async function GET() {
  const ctx = await getUserContext();
  if (!ctx) return Response.json({ error: "Sesi berakhir. Silakan masuk lagi." }, { status: 401 });
  if (!can(ctx, "notifications", "view", false)) return Response.json({ enabled: false, items: [], unread: 0, lastReadAt: null });
  const r = await recentNotifications(20);
  return Response.json({ enabled: true, ...r }, { headers: { "Cache-Control": "private, no-store" } });
}
