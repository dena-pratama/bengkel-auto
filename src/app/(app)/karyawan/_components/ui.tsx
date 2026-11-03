import Link from "next/link";
import { ChevronLeft, ShieldCheck, Users } from "lucide-react";
import type { RoleRef } from "@/lib/employees";
import { STATUS_LABEL, type EmployeeStatus } from "@/lib/validation/employee";
import { cn } from "@/lib/utils";

export const panel = "min-w-0 rounded-md bg-card p-5 shadow-[0_1px_2px_rgb(23_36_51/0.04),0_8px_24px_-12px_rgb(23_36_51/0.08)]";
export const inputClass =
  "h-10 w-full rounded-sm border border-input bg-card px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-destructive";

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

/** Navigasi bagian modul Karyawan */
export function SectionTabs({ active }: { active: "employees" | "roles" }) {
  const tabs = [
    { key: "employees", href: "/karyawan", label: "Karyawan", icon: Users },
    { key: "roles", href: "/karyawan/role", label: "Role & hak akses", icon: ShieldCheck },
  ] as const;
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]" aria-label="Bagian karyawan">
      {tabs.map(({ key, href, label, icon: Icon }) => (
        <Link
          key={key}
          href={href}
          aria-current={active === key ? "page" : undefined}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
            active === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: string;
  description?: string;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" /> {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function NoAccess() {
  return (
    <section className={cn(panel, "text-center")}>
      <p className="font-medium">Anda tidak punya akses ke halaman ini.</p>
      <p className="mt-1 text-sm text-muted-foreground">Hubungi Owner jika Anda membutuhkan akses.</p>
    </section>
  );
}

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
const dateTimeFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});
export const formatDate = (v: string | null) => (v ? dateFmt.format(new Date(v)) : "—");
export const formatDateTime = (v: string) => `${dateTimeFmt.format(new Date(v))} WIB`;
