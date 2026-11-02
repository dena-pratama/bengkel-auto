import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { DashboardSkeleton, DashboardView } from "./view";

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  return <DashboardView ctx={await requireUser()} />;
}
