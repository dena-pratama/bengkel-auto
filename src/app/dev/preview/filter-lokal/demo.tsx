"use client";

import { useState } from "react";
import { LocalFilters } from "@/components/local-filter";
import { panel } from "@/components/page-kit";
import { cn } from "@/lib/utils";

const ROWS = [
  { n: "Andi", role: "Mekanik", hire: "2024-02-01" },
  { n: "Budi", role: "Kasir", hire: "2025-06-15" },
  { n: "Citra", role: "Admin", hire: "2023-11-20" },
  { n: "Dedi", role: "Mekanik", hire: "2026-01-10" },
];

export function Demo() {
  const [role, setRole] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const shown = ROWS.filter((r) => (!role || r.role === role) && (!from || r.hire >= from) && (!to || r.hire <= to));
  return (
    <section className={cn(panel, "grid gap-4")}>
      <LocalFilters
        selects={[{ key: "peran", label: "Peran", value: role, options: ["Admin", "Kasir", "Mekanik"].map((v) => ({ value: v, label: v })), allLabel: "Semua peran", onChange: setRole }]}
        date={{ label: "Tanggal masuk", from, to, onChange: (f, t) => { setFrom(f); setTo(t); } }}
        dirty={Boolean(role || from || to)}
        onReset={() => { setRole(""); setFrom(""); setTo(""); }}
      />
      <p data-testid="out">{shown.map((r) => r.n).join(", ") || "kosong"}</p>
    </section>
  );
}
