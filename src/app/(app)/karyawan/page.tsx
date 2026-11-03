import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { can, requireUser } from "@/lib/auth";
import { listEmployees } from "@/lib/employees";
import { EmployeesTable } from "./_components/employees-table";
import { NoAccess, PageHeader, SectionTabs, panel } from "./_components/ui";

export default function EmployeesPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <SectionTabs active="employees" />
      <Suspense fallback={<div className={`${panel} h-96 animate-pulse`} />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "employees", "view", false)) return <NoAccess />;
  const employees = await listEmployees();
  const active = employees.filter((e) => e.status === "active").length;

  return (
    <>
      <PageHeader
        title="Karyawan"
        description={`${employees.length} karyawan · ${active} aktif`}
        actions={
          can(ctx, "employees", "create", false) && (
            <Button nativeButton={false} render={<Link href="/karyawan/baru" />}>
              <Plus className="size-4" /> Tambah karyawan
            </Button>
          )
        }
      />
      <EmployeesTable employees={employees} />
    </>
  );
}
