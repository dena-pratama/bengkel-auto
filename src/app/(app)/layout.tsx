import { Suspense } from "react";
import { LogOut, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileNav, NavLinks } from "@/components/app-nav";
import { can, requireUser } from "@/lib/auth";
import { NAV_ITEMS } from "@/lib/navigation";
import { logoutAction } from "../(auth)/actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 bg-zinc-50">
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r bg-white md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <span className="flex size-7 items-center justify-center rounded-md bg-zinc-900 text-white">
            <Wrench className="size-4" />
          </span>
          <span className="font-semibold tracking-tight">Bengkel Mobil App</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <Suspense fallback={<NavSkeleton />}>
            <SidebarNav />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-white px-4">
          <Suspense fallback={<div className="flex-1" />}>
            <HeaderContent />
          </Suspense>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Memuat...</p>}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}

async function visibleNavItems() {
  const ctx = await requireUser();
  return NAV_ITEMS.filter((item) => !item.module || can(ctx, item.module, item.action ?? "view"));
}

async function SidebarNav() {
  return <NavLinks items={await visibleNavItems()} />;
}

async function HeaderContent() {
  const ctx = await requireUser();
  const items = await visibleNavItems();
  const initials = ctx.employee.full_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <>
      <MobileNav items={items} />
      <div className="flex-1 truncate text-sm text-zinc-500">{ctx.branch.name}</div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight text-zinc-900">{ctx.employee.full_name}</p>
          <p className="text-xs text-zinc-500">{ctx.roles.map((r) => r.name).join(", ")}</p>
        </div>
        <span className="flex size-8 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-700">
          {initials}
        </span>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="icon" aria-label="Keluar" title="Keluar">
            <LogOut className="size-4" />
          </Button>
        </form>
      </div>
    </>
  );
}

function NavSkeleton() {
  return (
    <div className="grid gap-2">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-8 animate-pulse rounded-md bg-zinc-100" />
      ))}
    </div>
  );
}
