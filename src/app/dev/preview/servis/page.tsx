import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AppShell, RailView, TopbarView } from "@/components/app-shell";
import { PageHeader } from "@/components/page-kit";
import type { UserContext } from "@/lib/auth";
import type { WorkOrderRow } from "@/lib/service";
import { ServiceBoard } from "@/app/(app)/servis/_components/board";
import { ServiceNav } from "@/app/(app)/servis/_components/ui";

const PREVIEW_CTX: UserContext = {
  employee: { id: "preview", code: "EMP-PREVIEW", full_name: "Tama Service", position: "Service Advisor", status: "active", photo_url: null },
  branch: { id: "preview", code: "PST", name: "Bengkel Pusat" },
  is_superuser: true,
  roles: [{ code: "sa", name: "Service Advisor" }],
  permissions: [],
};

function createMockWo(partial: Partial<WorkOrderRow> & Pick<WorkOrderRow, "id" | "wo_no" | "plate_no" | "status">): WorkOrderRow {
  return {
    estimate_id: null,
    vehicle_id: "v-mock",
    customer_id: "c-mock",
    customer_name: "Pelanggan",
    customer_phone: null,
    vehicle_label: null,
    odometer_in: 50000,
    complaint: null,
    estimated_done_at: null,
    discount_amount: 0,
    notes: null,
    is_warranty: false,
    warranty_source_id: null,
    status_changed_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    delivered_at: null,
    void_reason: null,
    created_at: new Date().toISOString(),
    subtotal: 500000,
    total: 500000,
    duration_minutes: 60,
    services: "",
    parts: "",
    parts_pending: 0,
    parts_requested: 0,
    warranty_until: null,
    warranty_start: null,
    mechanics: "",
    mechanic_ids: [],
    minutes_in_status: 30,
    is_overdue: false,
    pending_estimate_id: null,
    ...partial,
  };
}

const SAMPLE_ORDERS: WorkOrderRow[] = [
  createMockWo({
    id: "wo-1",
    wo_no: "WO-2611-0022",
    plate_no: "B 2210 SNA",
    vehicle_label: "Honda Jazz 2018",
    customer_name: "Bp. Hendra",
    status: "queued",
    services: "Spooring & balancing",
    minutes_in_status: 35,
    total: 350000,
  }),
  createMockWo({
    id: "wo-2",
    wo_no: "WO-2611-0023",
    plate_no: "B 7781 KZA",
    vehicle_label: "Suzuki Ertiga 2020",
    customer_name: "Ibu Sari",
    status: "queued",
    services: "Servis berkala 40.000 km",
    parts: "Oli mesin, Filter oli",
    minutes_in_status: 15,
    total: 950000,
  }),
  createMockWo({
    id: "wo-3",
    wo_no: "WO-2611-0018",
    plate_no: "B 1234 KJT",
    vehicle_label: "Toyota Avanza 2019",
    customer_name: "Bp. Agus",
    status: "in_progress",
    services: "Tune up mesin bensin",
    parts: "Busi iridium",
    mechanics: "Rudi Hartono",
    minutes_in_status: 165,
    total: 1480000,
  }),
  createMockWo({
    id: "wo-4",
    wo_no: "WO-2611-0014",
    plate_no: "B 1932 TKA",
    vehicle_label: "Honda Brio 2021",
    customer_name: "CV Maju Jaya",
    status: "in_progress",
    services: "Ganti kampas rem depan",
    parts: "Brake pad",
    mechanics: "Andi Wijaya",
    minutes_in_status: 90,
    is_overdue: true,
    total: 620000,
  }),
  createMockWo({
    id: "wo-5",
    wo_no: "WO-2611-0020",
    plate_no: "D 1288 XB",
    vehicle_label: "Daihatsu Xenia 2017",
    customer_name: "Bp. Dimas",
    status: "in_progress",
    services: "Servis AC & isi freon",
    parts: "Freon R134a",
    mechanics: "Joko Santoso",
    minutes_in_status: 75,
    total: 450000,
  }),
  createMockWo({
    id: "wo-6",
    wo_no: "WO-2611-0016",
    plate_no: "B 4410 PQR",
    vehicle_label: "Mitsubishi Xpander 2022",
    customer_name: "PT Sinar Fleet",
    status: "waiting_parts",
    services: "Ganti shock absorber depan",
    parts: "Shock absorber (PO-2611-0007)",
    mechanics: "Andi Wijaya",
    minutes_in_status: 240,
    parts_requested: 2,
    parts_pending: 2,
    total: 2150000,
  }),
  createMockWo({
    id: "wo-7",
    wo_no: "WO-2611-0021",
    plate_no: "B 8812 KJA",
    vehicle_label: "Toyota Avanza 2019",
    customer_name: "Bp. Rizal",
    status: "waiting_approval",
    services: "Ganti oli, filter & tune up",
    parts: "Oli mesin, Filter oli",
    mechanics: "Rudi Hartono",
    minutes_in_status: 45,
    total: 1250000,
  }),
  createMockWo({
    id: "wo-8",
    wo_no: "WO-2611-0012",
    plate_no: "B 6620 TFR",
    vehicle_label: "Toyota Innova 2016",
    customer_name: "PT Sinar Fleet",
    status: "quality_check",
    services: "Overhaul rem 4 roda",
    parts: "Minyak rem, Brake shoe",
    mechanics: "Rudi Hartono",
    minutes_in_status: 50,
    total: 1850000,
  }),
  createMockWo({
    id: "wo-9",
    wo_no: "WO-2611-0010",
    plate_no: "B 3301 NNA",
    vehicle_label: "Honda HR-V 2020",
    customer_name: "Ibu Maya",
    status: "ready",
    services: "Servis berkala 20.000 km",
    parts: "Oli mesin, Filter oli",
    mechanics: "Joko Santoso",
    minutes_in_status: 120,
    total: 865000,
  }),
];

export default function ServicePreviewPage() {
  return (
    <Suspense fallback={<div className="p-8">Memuat pratinjau papan servis...</div>}>
      <Preview />
    </Suspense>
  );
}

async function Preview() {
  await connection();
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <AppShell rail={<RailView ctx={PREVIEW_CTX} />} topbar={<TopbarView ctx={PREVIEW_CTX} />}>
      <div className="mx-auto grid w-full max-w-[1600px] gap-5">
        <ServiceNav active="board" showEstimates={true} showWarranty={true} />
        <PageHeader
          title="Servis & work order"
          description="9 kendaraan di bengkel · 3 dikerjakan, 1 lewat estimasi waktu"
          actions={
            <button type="button" className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-rail px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-rail/90">
              Estimasi baru
            </button>
          }
        />
        <ServiceBoard orders={SAMPLE_ORDERS} showMoney={true} />
      </div>
    </AppShell>
  );
}
