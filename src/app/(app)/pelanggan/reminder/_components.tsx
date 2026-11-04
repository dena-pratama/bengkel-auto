"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCircle, Pencil, Plus } from "lucide-react";
import { TOAST_MS } from "@/components/app-toaster";
import { FormDialog } from "@/components/form-dialog";
import { FormError } from "@/components/form-field";
import { inputClass } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { formatDate, formatQty } from "@/lib/format";
import type { DueReminder, ReminderRule } from "@/lib/reminders";
import { cn } from "@/lib/utils";
import { markReminderAction, saveRuleAction } from "./actions";

/** Pesan WhatsApp klik-ke-chat (tanpa API). Nomor 08xx diubah jadi 628xx. */
function waLink(r: DueReminder, shop: string) {
  if (!r.customer_phone) return null;
  const text = [
    `Halo ${r.customer_name ?? "Bapak/Ibu"}, kami dari ${shop}.`,
    `Kendaraan ${r.vehicle ? r.vehicle + " " : ""}${r.plate_no} sudah waktunya ${r.service_name.toLowerCase()}${r.last_odometer != null ? ` (terakhir ${formatDate(r.last_date)} di ${formatQty(r.last_odometer)} km)` : ` (terakhir ${formatDate(r.last_date)})`}.`,
    "Silakan atur jadwal servis ke kami. Terima kasih.",
  ].join("\n");
  return `https://wa.me/62${r.customer_phone.replace(/\D/g, "").replace(/^0/, "").replace(/^62/, "")}?text=${encodeURIComponent(text)}`;
}

export function ReminderRow({ r, shop, canMark }: { r: DueReminder; shop: string; canMark: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const wa = waLink(r, shop);
  const mark = (status: "contacted" | "dismissed") =>
    start(async () => {
      const res = await markReminderAction({ vehicle_id: r.vehicle_id, rule_id: r.rule_id, wo_id: r.source_wo_id, status });
      if (!res.ok) return void toast.error(res.error, { duration: TOAST_MS.warning });
      toast.success(status === "contacted" ? "Ditandai sudah dihubungi." : "Reminder diabaikan.", { duration: TOAST_MS.action });
      router.refresh();
    });
  const late = r.days_until < 0;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          <span className="font-mono">{r.plate_no}</span> <span className="font-normal text-muted-foreground">{r.vehicle}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {r.customer_name ?? "Tanpa pemilik"}
          {r.customer_phone ? ` · ${r.customer_phone}` : " · tanpa nomor HP"} · {r.service_name}, terakhir {formatDate(r.last_date)}
          {r.last_odometer != null && ` di ${formatQty(r.last_odometer)} km`}
        </p>
      </div>
      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", late ? "bg-brand-red-soft text-brand-red" : "bg-brand-sand-soft")}>
        {late ? `Lewat ${-r.days_until} hari` : r.days_until === 0 ? "Hari ini" : `${r.days_until} hari lagi`} ({r.due_by === "km" ? "berdasar km" : "berdasar waktu"})
      </span>
      <div className="flex flex-wrap gap-2">
        {wa && (
          <Button size="sm" nativeButton={false} render={<a href={wa} target="_blank" rel="noopener noreferrer" />}>
            <MessageCircle className="size-3.5" /> Kirim WhatsApp
          </Button>
        )}
        {canMark && (
          <>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => mark("contacted")}>
              Sudah dihubungi
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => mark("dismissed")}>
              Abaikan
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

export function RuleDialog({ services, rule }: { services: { id: string; name: string; code: string }[]; rule?: ReminderRule }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    service_id: rule?.service_id ?? services[0]?.id ?? "",
    interval_km: rule?.interval_km ? String(rule.interval_km) : "",
    interval_months: rule?.interval_months ? String(rule.interval_months) : "",
    is_active: rule?.is_active ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      setError(null);
      const r = await saveRuleAction(v);
      if (!r.ok) return setError(r.error);
      setOpen(false);
      toast.success("Aturan reminder tersimpan.", { duration: TOAST_MS.action });
      router.refresh();
    });

  return (
    <>
      {rule ? (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Pencil className="size-3.5" /> Ubah
        </Button>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Aturan baru
        </Button>
      )}
      <FormDialog open={open} onOpenChange={setOpen} title={rule ? "Ubah aturan reminder" : "Aturan reminder baru"} description="Reminder muncul saat jarak tempuh atau waktu tercapai, mana yang lebih dulu." size="md">
        <div className="grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium">
            Jasa
            <select disabled={Boolean(rule)} value={v.service_id} onChange={(e) => setV({ ...v, service_id: e.target.value })} className={inputClass}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              Setiap berapa km
              <input inputMode="numeric" value={v.interval_km} onChange={(e) => setV({ ...v, interval_km: e.target.value })} placeholder="mis. 5000" className={inputClass} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Setiap berapa bulan
              <input inputMode="numeric" value={v.interval_months} onChange={(e) => setV({ ...v, interval_months: e.target.value })} placeholder="mis. 3" className={inputClass} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.is_active} onChange={(e) => setV({ ...v, is_active: e.target.checked })} className="size-4 accent-[var(--brand-blue)]" /> Aktif
          </label>
          <FormError message={error} />
          <div className="flex gap-2">
            <Button disabled={pending || !v.service_id} onClick={submit}>
              {pending ? "Menyimpan..." : "Simpan aturan"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
          </div>
        </div>
      </FormDialog>
    </>
  );
}
