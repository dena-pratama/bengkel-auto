import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AppShell, RailView, TopbarView } from "@/components/app-shell";
import type { UserContext } from "@/lib/auth";
import { DashboardSkeleton, DashboardView } from "../../(app)/dashboard/view";

// Pratinjau UI tanpa login, HANYA saat development (404 di production).
const PREVIEW_CTX: UserContext = {
  employee: { id: "preview", code: "EMP-PREVIEW", full_name: "Tama Pratama", position: "Owner", status: "active" },
  branch: { id: "preview", code: "PST", name: "Bengkel Pusat" },
  is_superuser: true,
  roles: [{ code: "owner", name: "Owner" }],
  permissions: [],
};

export default function PreviewPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Preview />
    </Suspense>
  );
}

async function Preview() {
  await connection();
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <AppShell rail={<RailView ctx={PREVIEW_CTX} />} topbar={<TopbarView ctx={PREVIEW_CTX} />}>
      <DashboardView ctx={PREVIEW_CTX} />
    </AppShell>
  );
}
