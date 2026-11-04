import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { loadDashboard } from "@/lib/dashboard";
import { DashboardSkeleton, DashboardView } from "./view";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const ctx = await requireUser();
  return <DashboardView ctx={ctx} data={await loadDashboard(ctx)} />;
}
