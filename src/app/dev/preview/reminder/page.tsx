import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ReminderRow } from "../../../(app)/pelanggan/reminder/_components";

// Pratinjau baris reminder servis tanpa login, HANYA saat development (404 di production).
export default function ReminderPreview() {
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}

const BASE = {
  vehicle_id: "a", rule_id: "b", source_wo_id: "c", plate_no: "B 7788 TES", vehicle: "Toyota Avanza 2018", customer_id: "x",
  customer_name: "Budi Santoso", customer_phone: "081234567890", service_name: "Ganti Oli Mesin", last_date: "2026-08-01",
  last_odometer: 45000, current_odometer: 49800, interval_km: 5000, interval_months: 3,
} as const;

async function Preview() {
  await connection();
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto max-w-[1000px] p-6">
      <ul className="grid divide-y divide-border rounded-3xl bg-card p-4">
        <ReminderRow r={{ ...BASE, due_date: "2026-11-01", days_until: -3, due_by: "waktu" }} shop="Bengkel Pusat" canMark />
        <ReminderRow r={{ ...BASE, plate_no: "D 1234 AB", due_date: "2026-11-04", days_until: 0, due_by: "km", customer_phone: null }} shop="Bengkel Pusat" canMark />
        <ReminderRow r={{ ...BASE, plate_no: "F 99 XY", due_date: "2026-11-10", days_until: 6, due_by: "waktu" }} shop="Bengkel Pusat" canMark={false} />
      </ul>
    </main>
  );
}
