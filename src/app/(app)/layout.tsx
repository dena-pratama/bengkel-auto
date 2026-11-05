import { Suspense } from "react";
import { AppShell, RailSkeleton, RailView, TopbarView } from "@/components/app-shell";
import { AppToaster } from "@/components/app-toaster";
import { NavigationProgress } from "@/components/navigation-progress";
import { requireUser } from "@/lib/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      rail={
        <Suspense fallback={<RailSkeleton />}>
          <Rail />
        </Suspense>
      }
      topbar={
        <Suspense fallback={<div className="flex-1" />}>
          <Topbar />
        </Suspense>
      }
    >
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Memuat...</p>}>{children}</Suspense>
      <AppToaster />
    </AppShell>
  );
}

async function Rail() {
  return <RailView ctx={await requireUser()} />;
}

async function Topbar() {
  return <TopbarView ctx={await requireUser()} />;
}
