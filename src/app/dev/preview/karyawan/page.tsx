import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Key, Plus, UserCheck, Users, Wrench } from "lucide-react";
import { AppShell, RailView, TopbarView } from "@/components/app-shell";
import { PageHeader, panel } from "@/components/page-kit";
import type { UserContext } from "@/lib/auth";
import type { Employee } from "@/lib/employees";
import { EmployeesTable } from "@/app/(app)/karyawan/_components/employees-table";
import { SectionTabs } from "@/app/(app)/karyawan/_components/ui";
import { cn } from "@/lib/utils";

const PREVIEW_CTX: UserContext = {
  employee: { id: "preview", code: "EMP-PREVIEW", full_name: "Tama Admin", position: "HR Manager", status: "active", photo_url: null },
  branch: { id: "preview", code: "PST", name: "Bengkel Pusat" },
  is_superuser: true,
  roles: [{ code: "admin", name: "HR & Owner" }],
  permissions: [],
};

function createMockEmployee(partial: Partial<Employee> & Pick<Employee, "id" | "code" | "full_name" | "status">): Employee {
  return {
    nik: null,
    phone: null,
    position: null,
    hire_date: "2022-01-01",
    bank_name: null,
    bank_account_number: null,
    bank_account_name: null,
    photo_url: null,
    created_at: new Date().toISOString(),
    email: null,
    roles: [],
    ...partial,
  };
}

const SAMPLE_EMPLOYEES: Employee[] = [
  createMockEmployee({
    id: "emp-1",
    code: "EMP-001",
    full_name: "Budi Santoso",
    position: "Owner",
    phone: "081234567890",
    email: "budi@automobi.id",
    status: "active",
    hire_date: "2020-01-01",
    roles: [{ id: "r-1", code: "owner", name: "Owner", is_superuser: true, is_active: true }],
  }),
  createMockEmployee({
    id: "emp-2",
    code: "EMP-002",
    full_name: "Siti Rahma",
    position: "Admin / Service Advisor",
    phone: "081298765432",
    email: "siti@automobi.id",
    status: "active",
    hire_date: "2021-03-15",
    roles: [{ id: "r-2", code: "advisor", name: "Service Advisor", is_superuser: false, is_active: true }],
  }),
  createMockEmployee({
    id: "emp-3",
    code: "EMP-003",
    full_name: "Maya Anggraini",
    position: "Kasir",
    phone: "081345678901",
    email: "maya@automobi.id",
    status: "active",
    hire_date: "2022-06-01",
    roles: [{ id: "r-3", code: "cashier", name: "Kasir", is_superuser: false, is_active: true }],
  }),
  createMockEmployee({
    id: "emp-4",
    code: "EMP-004",
    full_name: "Agus Pratama",
    position: "Mekanik Senior",
    phone: "081456789012",
    email: "agus@automobi.id",
    status: "active",
    hire_date: "2021-01-10",
    roles: [{ id: "r-4", code: "mechanic", name: "Mekanik", is_superuser: false, is_active: true }],
  }),
  createMockEmployee({
    id: "emp-5",
    code: "EMP-005",
    full_name: "Rizky Fauzi",
    position: "Mekanik",
    phone: "081567890123",
    email: "rizky@automobi.id",
    status: "active",
    hire_date: "2023-02-01",
    roles: [{ id: "r-4", code: "mechanic", name: "Mekanik", is_superuser: false, is_active: true }],
  }),
  createMockEmployee({
    id: "emp-6",
    code: "EMP-006",
    full_name: "Dedi Irawan",
    position: "Mekanik",
    phone: "081678901234",
    email: "dedi@automobi.id",
    status: "on_leave",
    hire_date: "2023-05-15",
    roles: [{ id: "r-4", code: "mechanic", name: "Mekanik", is_superuser: false, is_active: true }],
  }),
  createMockEmployee({
    id: "emp-7",
    code: "EMP-007",
    full_name: "Hendra Wijaya",
    position: "Staf Gudang",
    phone: "081789012345",
    email: "hendra@automobi.id",
    status: "active",
    hire_date: "2022-09-01",
    roles: [{ id: "r-5", code: "inventory", name: "Gudang", is_superuser: false, is_active: true }],
  }),
];

export default function EmployeesPreviewPage() {
  return (
    <Suspense fallback={<div className="p-8">Memuat pratinjau karyawan...</div>}>
      <Preview />
    </Suspense>
  );
}

async function Preview() {
  await connection();
  if (process.env.NODE_ENV !== "development") notFound();

  const active = SAMPLE_EMPLOYEES.filter((e) => e.status === "active").length;
  const onLeave = SAMPLE_EMPLOYEES.filter((e) => e.status === "on_leave").length;
  const mechanics = SAMPLE_EMPLOYEES.filter(
    (e) => /mekanik/i.test(e.position ?? "") || e.roles.some((r) => /mekanik/i.test(r.name))
  ).length;
  const withLogin = SAMPLE_EMPLOYEES.filter((e) => Boolean(e.email)).length;

  return (
    <AppShell rail={<RailView ctx={PREVIEW_CTX} />} topbar={<TopbarView ctx={PREVIEW_CTX} />}>
      <div className="mx-auto grid w-full max-w-[1440px] gap-5">
        <SectionTabs active="employees" />
        <PageHeader
          title="Karyawan"
          description={`${SAMPLE_EMPLOYEES.length} staf terdaftar · ${active} aktif${onLeave > 0 ? ` · ${onLeave} cuti` : ""}`}
          actions={
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-rail px-4 text-xs font-semibold text-white shadow-sm hover:bg-brand-rail/90"
            >
              <Plus className="size-4" />
              Tambah karyawan
            </button>
          }
        />

        {/* 4 Summary Stat Cards matching Figma 08 · Karyawan */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-blue-soft">
              <Users className="size-5 text-brand-blue-fg" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total karyawan</p>
              <p className="text-lg font-semibold leading-tight tabular-nums sm:text-xl">{SAMPLE_EMPLOYEES.length}</p>
              <p className="truncate text-[11px] text-muted-foreground">2 role manajemen</p>
            </div>
          </div>

          <div className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-green-soft">
              <UserCheck className="size-5 text-brand-green" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Aktif hari ini</p>
              <p className="text-lg font-semibold leading-tight tabular-nums text-brand-green sm:text-xl">{active}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {onLeave > 0 ? `${onLeave} sedang cuti` : "Semua bertugas"}
              </p>
            </div>
          </div>

          <div className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-sand-soft">
              <Wrench className="size-5 text-brand-sand" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Mekanik</p>
              <p className="text-lg font-semibold leading-tight tabular-nums sm:text-xl">{mechanics}</p>
              <p className="truncate text-[11px] text-muted-foreground">siap mengerjakan WO</p>
            </div>
          </div>

          <div className={cn(panel, "flex items-center gap-3.5 p-4")}>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-muted">
              <Key className="size-5 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Akun login</p>
              <p className="text-lg font-semibold leading-tight tabular-nums sm:text-xl">{withLogin}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {withLogin === SAMPLE_EMPLOYEES.length ? "semua terhubung" : `${withLogin} dari ${SAMPLE_EMPLOYEES.length} terhubung`}
              </p>
            </div>
          </div>
        </section>

        <EmployeesTable employees={SAMPLE_EMPLOYEES} />
      </div>
    </AppShell>
  );
}
