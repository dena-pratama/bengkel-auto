import { Suspense } from "react";
import { AppShell, MobileHeaderView, SidebarSkeleton, SidebarView } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      sidebar={
        <Suspense fallback={<SidebarSkeleton />}>
          <Sidebar />
        </Suspense>
      }
      mobileHeader={
        <Suspense fallback={<div className="flex-1" />}>
          <MobileHeader />
        </Suspense>
      }
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Memuat...</p>}>{children}</Suspense>
    </AppShell>
  );
}

async function Sidebar() {
  return <SidebarView ctx={await requireUser()} />;
}

async function MobileHeader() {
  return <MobileHeaderView ctx={await requireUser()} />;
}
