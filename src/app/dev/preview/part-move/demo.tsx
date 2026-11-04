"use client";

import { useState } from "react";
import { PartMove } from "../../../(app)/servis/_components/wo-panels";

const STOCK = [
  { location_id: "11111111-1111-1111-1111-111111111111", location: "GDG · Gudang Utama", location_code: "GDG", qty: 5 },
  { location_id: "22222222-2222-2222-2222-222222222222", location: "A-02 · Rak A2", location_code: "A-02", qty: 3 },
];

export function PartMoveDemo() {
  const [last, setLast] = useState("belum disimpan");
  return (
    <div className="grid gap-3">
      <PartMove kind="issue" max={2} unit="pcs" itemSku="FLTR-OLI-AVNZA-01" stock={STOCK} pending={false} onSave={(v) => setLast(JSON.stringify(v))} />
      <p data-testid="saved" className="font-mono text-xs">{last}</p>
    </div>
  );
}
