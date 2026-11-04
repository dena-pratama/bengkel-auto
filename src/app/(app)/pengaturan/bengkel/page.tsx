import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "../_settings-form";
import { SettingsNav } from "../_components/nav";

export default function ShopSettingsPage() {
  return (
    <div className="mx-auto grid w-full max-w-[900px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "settings", "view", false) && !can(ctx, "settings", "update", false)) return <NoAccess />;
  const initial = await getSettings();
  return (
    <>
      <SettingsNav active="shop" showShop />
      <PageHeader title="Pengaturan" description="Batas dan aturan operasional bengkel. Setiap perubahan tercatat di audit log." />
      <SettingsForm initial={initial} readOnly={!can(ctx, "settings", "update", false)} />
    </>
  );
}
