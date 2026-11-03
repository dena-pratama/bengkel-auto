import Link from "next/link";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Komponen halaman modul yang dipakai bersama (kartu, header, tab bagian, tanpa akses). */

export const panel = "min-w-0 rounded-md bg-card p-5 shadow-[0_1px_2px_rgb(23_36_51/0.04),0_8px_24px_-12px_rgb(23_36_51/0.08)]";
export const inputClass =
  "h-10 w-full rounded-sm border border-input bg-card px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 aria-invalid:border-destructive disabled:opacity-60";

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

export type SectionTab = { key: string; href: string; label: string; icon: LucideIcon };

/** Navigasi antarbagian dalam satu modul */
export function SectionNav({ tabs, active, label }: { tabs: readonly SectionTab[]; active: string; label: string }) {
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]" aria-label={label}>
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

export function NoAccess() {
  return (
    <section className={cn(panel, "text-center")}>
      <p className="font-medium">Anda tidak punya akses ke halaman ini.</p>
      <p className="mt-1 text-sm text-muted-foreground">Hubungi Owner jika Anda membutuhkan akses.</p>
    </section>
  );
}

export function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
      <Icon className="size-8" strokeWidth={1.5} />
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn(panel, "animate-pulse", className)} />;
}
