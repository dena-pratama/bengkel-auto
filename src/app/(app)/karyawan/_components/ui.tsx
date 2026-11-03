import { ShieldCheck, Users } from "lucide-react";
import { SectionNav } from "@/components/page-kit";
import type { RoleRef } from "@/lib/employees";
import { STATUS_LABEL, type EmployeeStatus } from "@/lib/validation/employee";
import { cn } from "@/lib/utils";

export { inputClass, NoAccess, PageHeader, panel } from "@/components/page-kit";
export { formatDate, formatDateTime } from "@/lib/format";

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-sm bg-brand-blue-soft font-semibold text-brand-blue-fg",
        size === "lg" ? "size-14 text-lg" : "size-10 text-sm",
      )}
    >
      {initials(name)}
    </span>
  );
}

const STATUS_STYLE: Record<EmployeeStatus, string> = {
  active: "bg-brand-blue-soft text-brand-blue-fg",
  on_leave: "bg-brand-sand-soft text-foreground",
  inactive: "bg-brand-red-soft text-brand-red",
};

export function StatusBadge({ status }: { status: EmployeeStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-medium", STATUS_STYLE[status])}>
      <span className={cn("size-1.5 rounded-full", status === "active" ? "bg-brand-blue" : status === "on_leave" ? "bg-brand-sand" : "bg-brand-red")} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function RoleChips({ roles }: { roles: RoleRef[] }) {
  if (roles.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <span
          key={r.id}
          className={cn(
            "rounded-sm px-2 py-0.5 text-xs font-medium",
            r.is_superuser ? "bg-brand-red text-white" : "bg-muted text-foreground",
            !r.is_active && "line-through opacity-60",
          )}
        >
          {r.name}
        </span>
      ))}
    </span>
  );
}

const TABS = [
  { key: "employees", href: "/karyawan", label: "Karyawan", icon: Users },
  { key: "roles", href: "/karyawan/role", label: "Role & hak akses", icon: ShieldCheck },
] as const;

/** Navigasi bagian modul Karyawan */
export function SectionTabs({ active }: { active: "employees" | "roles" }) {
  return <SectionNav tabs={TABS} active={active} label="Bagian karyawan" />;
}
