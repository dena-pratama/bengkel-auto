import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CalendarDays, Phone } from "lucide-react";
import { can, requireUser } from "@/lib/auth";
import { employeeHasPin, getEmployee, getStatusHistory, listRoles } from "@/lib/employees";
import { STATUS_LABEL } from "@/lib/validation/employee";
import { cn } from "@/lib/utils";
import { EditEmployeeForm } from "../_components/employee-form";
import { AccountSection, PinSection, RolesSection, StatusSection } from "../_components/employee-sections";
import { Avatar, NoAccess, PageHeader, RoleChips, StatusBadge, formatDate, formatDateTime, panel } from "../_components/ui";

export default function EmployeeDetailPage({ params }: PageProps<"/karyawan/[id]">) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <Suspense fallback={<div className={`${panel} h-[480px] animate-pulse`} />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await requireUser();
  const isSelf = id === ctx.employee.id;
  if (!isSelf && !can(ctx, "employees", "view", false)) return <NoAccess />;

  const employee = await getEmployee(id);
  if (!employee) notFound();
  const [roles, history, hasPin] = await Promise.all([listRoles(), getStatusHistory(id), isSelf ? employeeHasPin(id) : false]);

  const targetIsOwner = employee.roles.some((r) => r.is_superuser && r.is_active);
  const canManage = can(ctx, "employees", "update", false) && (!targetIsOwner || ctx.is_superuser);
  const roleOptions = roles.filter((r) => r.is_active || employee.roles.some((er) => er.id === r.id));

  return (
    <>
      <PageHeader title="Detail karyawan" back={{ href: "/karyawan", label: "Karyawan" }} />

      <section className={cn(panel, "flex flex-wrap items-center gap-4")}>
        <Avatar name={employee.full_name} size="lg" photoUrl={employee.photo_url} />
        <div className="grid min-w-0 flex-1 gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-semibold">{employee.full_name}</h2>
            <StatusBadge status={employee.status} />
            {isSelf && <span className="rounded-sm bg-muted px-2 py-0.5 text-xs">Anda</span>}
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{employee.code}</span>
            {employee.position && ` · ${employee.position}`}
          </p>
          <RoleChips roles={employee.roles} />
        </div>
        <div className="grid gap-1 text-sm text-muted-foreground">
          {employee.phone && (
            <span className="flex items-center gap-1.5">
              <Phone className="size-4" /> {employee.phone}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-4" /> Masuk {formatDate(employee.hire_date)}
          </span>
        </div>
      </section>

      {!canManage && !isSelf && (
        <p className="rounded-sm bg-muted px-3 py-2 text-sm text-muted-foreground">
          {targetIsOwner ? "Data Owner hanya bisa diubah oleh Owner." : "Anda hanya bisa melihat data karyawan."}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className={cn(panel, "grid content-start gap-4")}>
          <h3 className="text-lg font-semibold">Data karyawan</h3>
          <EditEmployeeForm
            id={employee.id}
            readOnly={!canManage}
            defaults={{
              full_name: employee.full_name,
              nik: employee.nik ?? "",
              phone: employee.phone ?? "",
              position: employee.position ?? "",
              hire_date: employee.hire_date ?? "",
              bank_name: employee.bank_name ?? "",
              bank_account_number: employee.bank_account_number ?? "",
              bank_account_name: employee.bank_account_name ?? "",
            }}
          />
        </section>

        <div className="grid content-start gap-4">
          <section className={cn(panel, "grid gap-3")}>
            <h3 className="text-lg font-semibold">Role &amp; akses</h3>
            <RolesSection
              key={employee.roles.map((r) => r.id).join()}
              employeeId={employee.id}
              roles={roleOptions}
              current={employee.roles.map((r) => r.id)}
              canAssignOwner={ctx.is_superuser}
              readOnly={!canManage}
            />
          </section>

          <section className={cn(panel, "grid gap-3")}>
            <h3 className="text-lg font-semibold">Akun login</h3>
            <AccountSection employeeId={employee.id} email={employee.email} readOnly={!canManage} />
          </section>

          {isSelf && (
            <section className={cn(panel, "grid gap-3")}>
              <h3 className="text-lg font-semibold">PIN persetujuan</h3>
              <PinSection hasPin={hasPin} />
            </section>
          )}

          <section className={cn(panel, "grid gap-4")}>
            <h3 className="text-lg font-semibold">Status</h3>
            {canManage && <StatusSection key={employee.status} employeeId={employee.id} status={employee.status} isSelf={isSelf} />}
            <ol className="grid gap-3 border-l-2 border-border pl-4">
              {history.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-card bg-brand-blue" />
                  <p className="text-sm font-medium">
                    {h.old_status ? `${STATUS_LABEL[h.old_status]} → ${STATUS_LABEL[h.new_status]}` : `Dibuat: ${STATUS_LABEL[h.new_status]}`}
                  </p>
                  {h.reason && <p className="text-sm text-muted-foreground">{h.reason}</p>}
                  <p className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
