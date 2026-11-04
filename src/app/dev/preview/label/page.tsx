import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PickerDemo } from "./picker";
import { LabelPrinter } from "../../../(app)/inventory/label/_label-printer";

// Pratinjau label QR dan pemilih barang tanpa login, HANYA saat development (404 di production).
export default function LabelPreview() {
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}

const ITEMS = [
  { id: "1", code: "OLI-5W30", name: "Oli mesin 5W-30 synthetic 1 L" },
  { id: "2", code: "BUSI-NGK-01", name: "Busi NGK Iridium" },
  { id: "3", code: "FLT-OLI-AVZ", name: "Filter oli Avanza" },
];
const RACKS = [
  { id: "a", code: "A-01", name: "Gudang Utama › A-01" },
  { id: "b", code: "A-02", name: "Gudang Utama › A-02" },
];

async function Preview() {
  await connection();
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto grid max-w-[1100px] gap-5 p-6">
      <PickerDemo />
      <LabelPrinter items={ITEMS} locations={RACKS} />
    </main>
  );
}
