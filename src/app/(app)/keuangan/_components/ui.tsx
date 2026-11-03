import { BookOpen, FileBarChart, Landmark, ListTree } from "lucide-react";
import { SectionNav } from "@/components/page-kit";

const TABS = [
  { key: "cash", href: "/keuangan", label: "Kas & bank", icon: Landmark },
  { key: "reports", href: "/keuangan/laporan", label: "Laporan", icon: FileBarChart },
  { key: "journal", href: "/keuangan/jurnal", label: "Jurnal & buku besar", icon: BookOpen },
  { key: "accounts", href: "/keuangan/akun", label: "Akun & tutup buku", icon: ListTree },
] as const;

export function FinanceNav({ active, showReports, showLedger }: { active: (typeof TABS)[number]["key"]; showReports: boolean; showLedger: boolean }) {
  return (
    <SectionNav
      tabs={TABS.filter((t) => (t.key === "reports" ? showReports : t.key === "journal" || t.key === "accounts" ? showLedger : true))}
      active={active}
      label="Bagian keuangan"
    />
  );
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Awal dan akhir bulan (YYYY-MM-DD) dari tanggal; offset bulan opsional */
export function monthRange(date: string, offset = 0) {
  const [y, m] = date.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + offset, 1));
  const last = new Date(Date.UTC(y, m + offset, 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

/** Periode pembanding dengan jumlah hari yang sama, tepat sebelum periode ini */
export function previousRange(from: string, to: string) {
  const f = new Date(`${from}T00:00:00Z`).getTime();
  const t = new Date(`${to}T00:00:00Z`).getTime();
  const days = Math.round((t - f) / 86_400_000) + 1;
  const prevTo = new Date(f - 86_400_000);
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86_400_000);
  return { from: prevFrom.toISOString().slice(0, 10), to: prevTo.toISOString().slice(0, 10) };
}
