import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Building2, Car, Clock, Users } from "lucide-react";
import { AppShell, RailView, TopbarView } from "@/components/app-shell";
import { PageHeader, panel } from "@/components/page-kit";
import type { UserContext } from "@/lib/auth";
import type { Customer, Vehicle } from "@/lib/customers";
import { cn } from "@/lib/utils";
import { CustomersList, CustomersNav } from "@/app/(app)/pelanggan/_components/lists";

const PREVIEW_CTX: UserContext = {
  employee: { id: "preview", code: "EMP-PREVIEW", full_name: "Tama SA", position: "Service Advisor", status: "active", photo_url: null },
  branch: { id: "preview", code: "PST", name: "Bengkel Pusat" },
  is_superuser: true,
  roles: [{ code: "sa", name: "Service Advisor" }],
  permissions: [],
};

const SAMPLE_CUSTOMERS: Customer[] = [
  {
    id: "c-1",
    code: "CUS-00001",
    type: "individual",
    name: "Suhen",
    phone: "0847 5746 844",
    email: null,
    address: "Jl. Merdeka No. 12",
    npwp: null,
    credit_limit: 0,
    payment_terms_days: 0,
    notes: null,
    is_active: true,
  },
  {
    id: "c-2",
    code: "CUS-00002",
    type: "individual",
    name: "Bp. Agus Salim",
    phone: "0812 3456 7788",
    email: "agus@example.com",
    address: "Komp. Griya Indah B3",
    npwp: null,
    credit_limit: 0,
    payment_terms_days: 0,
    notes: null,
    is_active: true,
  },
  {
    id: "c-3",
    code: "CUS-00007",
    type: "company",
    name: "PT Sinar Fleet",
    phone: "021 5550 1122",
    email: "fleet@sinar.co.id",
    address: "Jl. Industri Raya No. 21, Bekasi",
    npwp: "01.234.567.8-412.000",
    credit_limit: 50000000,
    payment_terms_days: 30,
    notes: "PIC: Bp. Hendra",
    is_active: true,
  },
  {
    id: "c-4",
    code: "CUS-00008",
    type: "individual",
    name: "Ibu Sari",
    phone: "0813 9988 7766",
    email: null,
    address: "Jl. Flamboyan 4",
    npwp: null,
    credit_limit: 0,
    payment_terms_days: 0,
    notes: null,
    is_active: true,
  },
];

const SAMPLE_VEHICLES: Vehicle[] = [
  {
    id: "v-1",
    plate_no: "D 5858 KAE",
    plate_key: "D5858KAE",
    make_name: "Honda",
    model_name: "Brio",
    variant: "E CVT",
    year: 2021,
    color: "Hitam",
    transmission: "cvt",
    fuel: "gasoline",
    vin: null,
    engine_no: null,
    last_odometer: 32000,
    notes: null,
    is_active: true,
    customer_id: "c-1",
    customer_name: "Suhen",
    customer_phone: "0847 5746 844",
    owned_since: "2021-05-10",
  },
  {
    id: "v-2",
    plate_no: "B 1234 KJT",
    plate_key: "B1234KJT",
    make_name: "Toyota",
    model_name: "Avanza",
    variant: "1.3 G M/T",
    year: 2019,
    color: "Silver",
    transmission: "manual",
    fuel: "gasoline",
    vin: null,
    engine_no: null,
    last_odometer: 68000,
    notes: null,
    is_active: true,
    customer_id: "c-2",
    customer_name: "Bp. Agus Salim",
    customer_phone: "0812 3456 7788",
    owned_since: "2019-08-15",
  },
  {
    id: "v-3",
    plate_no: "B 6620 TFR",
    plate_key: "B6620TFR",
    make_name: "Toyota",
    model_name: "Innova",
    variant: "2.4 V Diesel A/T",
    year: 2016,
    color: "Putih",
    transmission: "automatic",
    fuel: "diesel",
    vin: null,
    engine_no: null,
    last_odometer: 142000,
    notes: null,
    is_active: true,
    customer_id: "c-3",
    customer_name: "PT Sinar Fleet",
    customer_phone: "021 5550 1122",
    owned_since: "2018-01-20",
  },
  {
    id: "v-4",
    plate_no: "B 4410 PQR",
    plate_key: "B4410PQR",
    make_name: "Mitsubishi",
    model_name: "Xpander",
    variant: "Ultimate A/T",
    year: 2022,
    color: "Abu-abu",
    transmission: "automatic",
    fuel: "gasoline",
    vin: null,
    engine_no: null,
    last_odometer: 41000,
    notes: null,
    is_active: true,
    customer_id: "c-3",
    customer_name: "PT Sinar Fleet",
    customer_phone: "021 5550 1122",
    owned_since: "2022-03-12",
  },
  {
    id: "v-5",
    plate_no: "B 7781 KZA",
    plate_key: "B7781KZA",
    make_name: "Suzuki",
    model_name: "Ertiga",
    variant: "GL A/T",
    year: 2020,
    color: "Merah",
    transmission: "automatic",
    fuel: "gasoline",
    vin: null,
    engine_no: null,
    last_odometer: 54000,
    notes: null,
    is_active: true,
    customer_id: "c-4",
    customer_name: "Ibu Sari",
    customer_phone: "0813 9988 7766",
    owned_since: "2020-11-05",
  },
];

export default function CustomersPreviewPage() {
  return (
    <Suspense fallback={<div className="p-8">Memuat pratinjau pelanggan...</div>}>
      <Preview />
    </Suspense>
  );
}

async function Preview() {
  await connection();
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <AppShell rail={<RailView ctx={PREVIEW_CTX} />} topbar={<TopbarView ctx={PREVIEW_CTX} />}>
      <div className="mx-auto grid w-full max-w-[1440px] gap-5">
        <CustomersNav active="customers" />
        <PageHeader
          title="Pelanggan"
          description="4 pelanggan aktif · 5 kendaraan terdaftar"
          actions={
            <button type="button" className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-rail px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-rail/90">
              Tambah pelanggan
            </button>
          }
        />

        {/* Summary 4 cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-blue-soft">
              <Users className="size-5 text-brand-blue-fg" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total pelanggan</p>
              <p className="text-xl font-semibold leading-tight tabular-nums">4</p>
              <p className="text-[11px] text-muted-foreground">4 aktif · 0 nonaktif</p>
            </div>
          </section>

          <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-green-soft">
              <Building2 className="size-5 text-brand-green" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Pelanggan fleet</p>
              <p className="text-xl font-semibold leading-tight tabular-nums">1</p>
              <p className="text-[11px] text-muted-foreground">perusahaan / boleh tempo</p>
            </div>
          </section>

          <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-sand-soft">
              <Car className="size-5 text-brand-sand" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Kendaraan terdaftar</p>
              <p className="text-xl font-semibold leading-tight tabular-nums">5</p>
              <p className="text-[11px] text-muted-foreground">5 kendaraan aktif</p>
            </div>
          </section>

          <section className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-red-soft">
              <Clock className="size-5 text-brand-red" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Boleh tempo</p>
              <p className="text-xl font-semibold leading-tight tabular-nums">1</p>
              <p className="text-[11px] text-muted-foreground">pelanggan bertempo</p>
            </div>
          </section>
        </div>

        <CustomersList customers={SAMPLE_CUSTOMERS} vehicles={SAMPLE_VEHICLES} />
      </div>
    </AppShell>
  );
}
