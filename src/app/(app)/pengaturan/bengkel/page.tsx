import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { aiProviderStates } from "@/lib/ai/providers";
import { getSettings } from "@/lib/settings";
import { AiSettingsForm } from "../_ai-form";
import { SettingsForm } from "../_settings-form";
import { SettingsNav } from "../_components/nav";

export default function ShopSettingsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
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
  const ai = await aiProviderStates();
  return (
    <>
      <SettingsNav active="shop" showShop />
      <PageHeader title="Pengaturan" description="Batas dan aturan operasional bengkel. Setiap perubahan tercatat di audit log." />
      <SettingsForm initial={initial} readOnly={!can(ctx, "settings", "update", false)} />
      <AiSettingsForm providers={ai.providers} provider={ai.provider} readOnly={!can(ctx, "settings", "update", false)} />
    </>
  );
}
