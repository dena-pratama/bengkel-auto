import "server-only";
import { listItems, listServices } from "@/lib/inventory";
import type { ComponentOption } from "../_components/package-form";

/** Pilihan komponen paket: barang & jasa aktif (plus yang sudah terpasang walau nonaktif) */
export async function componentOptions(keep: { kind: string; id: string }[] = []): Promise<ComponentOption[]> {
  const [items, services] = await Promise.all([listItems(), listServices()]);
  const kept = (kind: string, id: string) => keep.some((k) => k.kind === kind && k.id === id);
  return [
    ...services
      .filter((s) => s.is_active || kept("service", s.id))
      .map((s) => ({ kind: "service" as const, id: s.id, label: `${s.code} ${s.name}`, price: s.price, unit: "" })),
    ...items
      .filter((i) => i.is_active || kept("item", i.id))
      .map((i) => ({ kind: "item" as const, id: i.id, label: `${i.name} (${i.sku})`, price: i.sell_price, unit: i.unit })),
  ];
}
