"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, PackageOpen, PackagePlus, PackageSearch, Users, XCircle } from "lucide-react";
import { ScanButton } from "@/components/qr-scanner";
import { parseQr } from "@/lib/qr";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/form-field";
import { inputClass } from "@/components/page-kit";
import { formatDate, formatQty, formatRupiah } from "@/lib/format";
import type { Mechanic, WorkOrderLine } from "@/lib/service";
import { WO_STATUS_LABEL, type WorkOrderStatus } from "@/lib/validation/service";
import { cn } from "@/lib/utils";
import {
  cancelLineAction,
  movePartAction,
  requestPartAction,
  setMechanicsAction,
  setWorkOrderStatusAction,
  updateWorkOrderAction,
  voidWorkOrderAction,
} from "../actions";
import { TypeTag } from "./pickers";

type Result = { ok: true } | { ok: false; error: string };

/** Jalankan aksi server: toast saat berhasil, error di bawah tombol */
function useRun() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<Result>, message: string, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.error);
      toast.success(message);
      after?.();
      router.refresh();
    });
  return { run, error, pending };
}

const NEXT_LABEL: Partial<Record<WorkOrderStatus, string>> = {
  in_progress: "Mulai / lanjut kerjakan",
  waiting_parts: "Menunggu part",
  quality_check: "Selesai, quality check",
  ready: "Siap diambil",
  delivered: "Serahkan ke pelanggan",
  queued: "Kembalikan ke antrean",
};

export function StatusControls({ id, next }: { id: string; next: WorkOrderStatus[] }) {
  const { run, error, pending } = useRun();
  if (next.length === 0) return null;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {next.map((s, i) => (
          <Button
            key={s}
            variant={i === 0 ? "default" : "outline"}
            disabled={pending}
            onClick={() => run(() => setWorkOrderStatusAction(id, s), `Status: ${WO_STATUS_LABEL[s]}.`)}
          >
            {i === 0 && <ArrowRight className="size-4" />}
            {NEXT_LABEL[s] ?? WO_STATUS_LABEL[s]}
          </Button>
        ))}
      </div>
      <FormError message={error} />
    </div>
  );
}

export function WoInfoForm({ id, defaults }: { id: string; defaults: { estimated_done_at: string; odometer_in: string; notes: string } }) {
  const { run, error, pending } = useRun();
  const [v, setV] = useState(defaults);
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">
          Estimasi selesai
          <input type="datetime-local" value={v.estimated_done_at} onChange={(e) => setV({ ...v, estimated_done_at: e.target.value })} className={inputClass} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Kilometer masuk
          <input inputMode="numeric" value={v.odometer_in} onChange={(e) => setV({ ...v, odometer_in: e.target.value })} className={inputClass} />
        </label>
      </div>
      <label className="grid gap-1.5 text-sm font-medium">
        Catatan
        <input value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} className={inputClass} />
      </label>
      <div>
        <Button variant="outline" disabled={pending} onClick={() => run(() => updateWorkOrderAction(id, v), "Data WO tersimpan.")}>
          Simpan
        </Button>
      </div>
      <FormError message={error} />
    </div>
  );
}

export function VoidWorkOrder({ id }: { id: string }) {
  const { run, error, pending } = useRun();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div className="grid gap-2">
      {open ? (
        <div className="flex flex-wrap gap-2">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan pembatalan" aria-label="Alasan pembatalan" className={cn(inputClass, "max-w-md flex-1")} />
          <Button variant="destructive" disabled={pending || reason.trim().length < 3} onClick={() => run(() => voidWorkOrderAction(id, reason), "Work order dibatalkan.")}>
            Batalkan WO
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Tidak jadi
          </Button>
        </div>
      ) : (
        <div>
          <Button variant="ghost" onClick={() => setOpen(true)}>
            <XCircle className="size-4" /> Batalkan work order
          </Button>
        </div>
      )}
      <FormError message={error} />
    </div>
  );
}

export type StockOption = { location_id: string; location: string; location_code: string; qty: number };

/** Satu baris WO: jasa (mekanik) atau part (minta, keluar, kembali), plus batal baris */
export function WoLine({
  line,
  mechanics,
  names,
  stock,
  locked,
  canAssign,
  canRequest,
  canIssue,
  canCancel,
  showMoney,
}: {
  line: WorkOrderLine;
  mechanics: Mechanic[];
  names: Record<string, string>;
  stock: StockOption[];
  locked: boolean;
  canAssign: boolean;
  canRequest: boolean;
  canIssue: boolean;
  canCancel: boolean;
  showMoney: boolean;
}) {
  const { run, error, pending } = useRun();
  const [panel, setPanel] = useState<null | "mechanics" | "issue" | "return" | "cancel">(null);
  const remaining = line.qty - line.issued_qty;
  const toggle = (p: typeof panel) => setPanel(panel === p ? null : p);

  return (
    <li className={cn("grid gap-2 py-3", line.is_cancelled && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <TypeTag type={line.line_type} />
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium", line.is_cancelled && "line-through")}>{line.description}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatQty(line.qty)} {line.base_unit ?? ""}
            {showMoney && ` × ${formatRupiah(line.unit_price)}`}
            {line.warranty_days > 0 && ` · garansi ${line.warranty_days} hari`}
            {line.is_cancelled && line.cancel_reason && ` · batal: ${line.cancel_reason}`}
          </p>
        </div>
        {line.line_type === "part" && !line.is_cancelled && (
          <span
            className={cn(
              "rounded-sm px-2 py-0.5 text-xs font-medium tabular-nums",
              remaining <= 0 ? "bg-brand-blue-soft text-brand-blue-fg" : line.issue_requested_at ? "bg-brand-sand text-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {remaining <= 0 ? "Sudah keluar" : line.issue_requested_at ? "Diminta" : "Belum keluar"} {formatQty(line.issued_qty)}/{formatQty(line.qty)}
          </span>
        )}
        {showMoney && <span className="w-28 text-right text-sm font-semibold tabular-nums">{formatRupiah(line.line_total)}</span>}
      </div>

      {line.line_type === "service" && !line.is_cancelled && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="size-3.5" />
          {line.mechanics.length
            ? line.mechanics.map((m) => `${names[m.employee_id] ?? "Mekanik"} (${formatQty(m.share_percent)}%)`).join(", ")
            : "Belum ada mekanik"}
        </p>
      )}

      {!locked && !line.is_cancelled && (
        <div className="flex flex-wrap gap-1.5">
          {line.line_type === "service" && canAssign && (
            <Button size="sm" variant="outline" onClick={() => toggle("mechanics")}>
              <Users className="size-3.5" /> Atur mekanik
            </Button>
          )}
          {line.line_type === "part" && canRequest && remaining > 0 && !line.issue_requested_at && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => requestPartAction(line.id), "Permintaan part dikirim ke gudang.")}>
              <PackageSearch className="size-3.5" /> Minta part
            </Button>
          )}
          {line.line_type === "part" && canIssue && remaining > 0 && (
            <Button size="sm" variant="outline" onClick={() => toggle("issue")}>
              <PackageOpen className="size-3.5" /> Keluarkan part
            </Button>
          )}
          {line.line_type === "part" && canIssue && line.issued_qty > 0 && (
            <Button size="sm" variant="outline" onClick={() => toggle("return")}>
              <PackagePlus className="size-3.5" /> Kembalikan (tidak terpakai)
            </Button>
          )}
          {canCancel && line.issued_qty === 0 && (
            <Button size="sm" variant="ghost" onClick={() => toggle("cancel")}>
              Batalkan baris
            </Button>
          )}
        </div>
      )}

      {panel === "mechanics" && <MechanicEditor line={line} mechanics={mechanics} pending={pending} onSave={(a) => run(() => setMechanicsAction(line.id, a), "Mekanik tersimpan.", () => setPanel(null))} />}
      {(panel === "issue" || panel === "return") && (
        <PartMove
          kind={panel}
          max={panel === "issue" ? remaining : line.issued_qty}
          unit={line.base_unit ?? ""}
          itemSku={line.item_sku}
          stock={stock}
          pending={pending}
          onSave={(v) => run(() => movePartAction(line.id, panel, v), panel === "issue" ? "Part dikeluarkan." : "Part dikembalikan ke stok.", () => setPanel(null))}
        />
      )}
      {panel === "cancel" && <ReasonInput pending={pending} label="Batalkan baris" onSave={(r) => run(() => cancelLineAction(line.id, r), "Baris dibatalkan.", () => setPanel(null))} />}
      <FormError message={error} />
    </li>
  );
}

function MechanicEditor({
  line,
  mechanics,
  pending,
  onSave,
}: {
  line: WorkOrderLine;
  mechanics: Mechanic[];
  pending: boolean;
  onSave: (a: { employee_id: string; share_percent: string }[]) => void;
}) {
  const [picked, setPicked] = useState<Map<string, string>>(
    () => new Map(line.mechanics.map((m) => [m.employee_id, line.mechanics.length > 1 ? String(m.share_percent) : ""])),
  );
  if (mechanics.length === 0) return <p className="text-sm text-muted-foreground">Belum ada karyawan aktif dengan role Mekanik.</p>;
  return (
    <div className="grid gap-2 rounded-sm border border-border p-3">
      <p className="text-xs text-muted-foreground">Pilih satu atau lebih mekanik. Porsi (%) kosong = dibagi rata.</p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {mechanics.map((m) => (
          <div key={m.id} className="flex items-center gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-brand-blue-ink"
                checked={picked.has(m.id)}
                onChange={(e) =>
                  setPicked((p) => {
                    const n = new Map(p);
                    if (e.target.checked) n.set(m.id, "");
                    else n.delete(m.id);
                    return n;
                  })
                }
              />
              <span className="truncate">{m.full_name}</span>
            </label>
            {picked.has(m.id) && (
              <input
                inputMode="decimal"
                aria-label={`Porsi ${m.full_name}`}
                placeholder="%"
                value={picked.get(m.id)}
                onChange={(e) => setPicked((p) => new Map(p).set(m.id, e.target.value))}
                className={cn(inputClass, "w-20")}
              />
            )}
          </div>
        ))}
      </div>
      <div>
        <Button size="sm" disabled={pending} onClick={() => onSave([...picked].map(([employee_id, share_percent]) => ({ employee_id, share_percent })))}>
          Simpan mekanik
        </Button>
      </div>
    </div>
  );
}

export function PartMove({
  kind,
  max,
  unit,
  itemSku,
  stock,
  pending,
  onSave,
}: {
  kind: "issue" | "return";
  max: number;
  unit: string;
  itemSku: string | null;
  stock: StockOption[];
  pending: boolean;
  onSave: (v: { qty: string; location_id: string; note: string; scanned: boolean }) => void;
}) {
  const options = kind === "issue" ? stock.filter((s) => s.qty > 0) : stock;
  const [v, setV] = useState({ qty: String(max), location_id: options[0]?.location_id ?? "", note: "" });
  const [itemOk, setItemOk] = useState(false);
  const [rackOk, setRackOk] = useState(false);
  const [scanError, setScanError] = useState("");

  // Scan QR barang: harus barang yang diminta WO ini
  const scanItem = (raw: string) => {
    const t = parseQr(raw);
    if (t && t.kind !== "location" && itemSku && t.code === itemSku.toUpperCase()) {
      setItemOk(true);
      setScanError("");
    } else {
      setItemOk(false);
      setScanError(`QR ${raw.trim().slice(0, 40)} bukan barang ini (butuh ${itemSku ?? "SKU barang"}).`);
    }
  };
  // Scan QR rak: harus rak yang menyimpan stok barang ini
  const scanRack = (raw: string) => {
    const t = parseQr(raw);
    const hit = t && t.kind !== "item" ? options.find((o) => o.location_code.toUpperCase() === t.code) : undefined;
    if (hit) {
      setV((x) => ({ ...x, location_id: hit.location_id }));
      setRackOk(true);
      setScanError("");
    } else {
      setRackOk(false);
      setScanError(`Rak ${raw.trim().slice(0, 40)} tidak menyimpan stok barang ini.`);
    }
  };
  const scanned = kind === "issue" && itemOk && rackOk;
  // Pemindai USB: kode diketik lalu Enter. Awalan L: = rak, I: = barang, tanpa awalan = coba barang lalu rak.
  const [typed, setTyped] = useState("");
  const submitTyped = () => {
    const t = parseQr(typed);
    setTyped("");
    if (!t) return setScanError("Kode tidak dikenali.");
    if (t.kind === "location") return scanRack(typed);
    if (t.kind === "item" || (itemSku && t.code === itemSku.toUpperCase())) return scanItem(typed);
    scanRack(typed);
  };

  return (
    <div className="grid gap-2 rounded-sm border border-border p-3 sm:grid-cols-[1fr_110px_1fr_auto] sm:items-end">
      {kind === "issue" && (
        <div className="grid gap-1.5 sm:col-span-4">
          <div className="flex flex-wrap items-center gap-2">
            <ScanButton label={itemOk ? "Barang terverifikasi" : "Scan QR barang"} onScan={scanItem} className="h-9" />
            <ScanButton label={rackOk ? "Rak terverifikasi" : "Scan QR rak"} onScan={scanRack} className="h-9" />
            {scanned ? (
              <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-blue-fg">
                <CheckCircle2 className="size-4" /> Barang dan rak sesuai
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Scan barang dan rak agar tercatat terverifikasi.</span>
            )}
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitTyped();
                }
              }}
              placeholder="Pemindai USB: scan di sini"
              aria-label="Kode dari pemindai USB"
              autoComplete="off"
              className={cn(inputClass, "h-9 w-56 font-mono text-sm")}
            />
          </div>
          {scanError && <p role="alert" className="text-sm text-destructive">{scanError}</p>}
        </div>
      )}
      <label className="grid gap-1.5 text-sm font-medium">
        {kind === "issue" ? "Ambil dari rak" : "Kembalikan ke rak"}
        <select
          value={v.location_id}
          onChange={(e) => {
            setV({ ...v, location_id: e.target.value });
            setRackOk(false);
          }}
          className={inputClass}
        >
          {options.length === 0 && <option value="">Stok kosong di semua rak</option>}
          {options.map((s) => (
            <option key={s.location_id} value={s.location_id}>
              {s.location} (stok {formatQty(s.qty)})
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Jumlah {unit && `(${unit})`}
        <input inputMode="decimal" value={v.qty} onChange={(e) => setV({ ...v, qty: e.target.value })} className={inputClass} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Catatan
        <input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder={kind === "issue" ? "mis. hasil scan rak" : "alasan kembali"} className={inputClass} />
      </label>
      <Button disabled={pending || !v.location_id} onClick={() => onSave({ ...v, scanned })}>
        {kind === "issue" ? "Keluarkan" : "Kembalikan"}
      </Button>
    </div>
  );
}

function ReasonInput({ label, pending, onSave }: { label: string; pending: boolean; onSave: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-wrap gap-2">
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan" aria-label="Alasan" className={cn(inputClass, "max-w-md flex-1")} />
      <Button variant="destructive" disabled={pending || reason.trim().length < 3} onClick={() => onSave(reason)}>
        {label}
      </Button>
    </div>
  );
}

export function StatusTimeline({ logs }: { logs: { id: string; to_status: WorkOrderStatus; who: string | null; note: string | null; created_at: string }[] }) {
  return (
    <ol className="grid gap-2 border-l-2 border-border pl-4">
      {logs.map((l) => (
        <li key={l.id} className="relative text-sm">
          <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-card bg-brand-blue" />
          <p className="font-medium">{WO_STATUS_LABEL[l.to_status]}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(l.created_at)}{" "}
            {new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(l.created_at))}
            {l.who && ` · ${l.who}`}
            {l.note && ` · ${l.note}`}
          </p>
        </li>
      ))}
    </ol>
  );
}
