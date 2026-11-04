import { ShieldCheck, Users } from "lucide-react";
import { SectionNav } from "@/components/page-kit";
import { UserAvatar } from "@/components/user-avatar";
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

export function Avatar({ name, size = "md", photoUrl }: { name: string; size?: "md" | "lg"; photoUrl?: string | null }) {
  return <UserAvatar name={name} photoUrl={photoUrl} className={cn("rounded-full", size === "lg" ? "size-14 text-lg" : "size-10 text-sm")} />;
}

const STATUS_STYLE: Record<EmployeeStatus, string> = {
  active: "bg-brand-green-soft text-brand-green",
  on_leave: "bg-brand-sand-soft text-brand-sand",
  inactive: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: EmployeeStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_STYLE[status])}>
      <span className={cn("size-1.5 rounded-full", status === "active" ? "bg-brand-green" : status === "on_leave" ? "bg-brand-sand" : "bg-muted-foreground")} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function RoleChips({ roles }: { roles: RoleRef[] }) {
  if (roles.length === 0) return <span className="text-xs text-muted-foreground">-</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {roles.map((r) => (
        <span
          key={r.id}
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            r.is_superuser ? "bg-brand-red-soft text-brand-red" : "bg-muted text-foreground",
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
