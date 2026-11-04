"use client";

import { useState } from "react";
import { ItemPicker } from "@/components/item-picker";

const ITEMS = [
  { id: "1", sku: "OLI-5W30", name: "Oli mesin 5W-30 synthetic 1 L", base_unit: "pcs", qty: 5 },
  { id: "2", sku: "BUSI-NGK-01", name: "Busi NGK Iridium", base_unit: "pcs", qty: 12 },
];

export function PickerDemo() {
  const [last, setLast] = useState("belum ada");
  return (
    <div className="grid gap-2">
      <ItemPicker items={ITEMS} onPick={(i) => setLast(i.name)} />
      <p data-testid="picked" className="text-sm text-muted-foreground">Terpilih: {last}</p>
    </div>
  );
}
