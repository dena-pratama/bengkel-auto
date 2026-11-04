import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { SaleDetail } from "@/lib/cashier";
import { ThermalReceipt } from "../../../(app)/kasir/_components/thermal-receipt";

// Pratinjau nota thermal tanpa login, HANYA saat development (404 di production).
export default function NotaPreview() {
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}

const SALE = {
  sale_no: "INV-2026-0042", sale_date: "2026-11-04", plate_no: "B 7788 TES", customer_name: "Budi Santoso", status: "posted",
  subtotal: 247500, discount_amount: 10000, ppn_amount: 0, total: 237500, paid: 237500, outstanding: 0,
  lines: [
    { id: "1", description: "Ganti oli mesin", qty: 1, unit_price: 50000, discount_amount: 0, line_total: 50000 },
    { id: "2", description: "Oli mesin 5W-30 synthetic 1 L", qty: 4, unit_price: 57500, discount_amount: 10000, line_total: 220000 },
  ],
  payments: [{ id: "p", status: "posted", method: "cash", amount: 237500 }],
} as unknown as SaleDetail;

async function Preview() {
  await connection();
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="flex flex-wrap items-start gap-6 p-6">
      <style>{`.thermal-only { display: block !important; background: #fff; padding: 2mm; box-shadow: 0 1px 6px #0003 }`}</style>
      <div style={{ width: "74mm" }}><ThermalReceipt s={SALE} shop="Bengkel Pusat" /></div>
      <div style={{ width: "54mm" }}><ThermalReceipt s={SALE} shop="Bengkel Pusat" /></div>
    </main>
  );
}
