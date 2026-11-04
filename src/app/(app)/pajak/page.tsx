import { Suspense } from "react";
import { NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getTaxSettings, listTaxRates } from "@/lib/tax";
import { cn } from "@/lib/utils";
import { AddRateDialog, TaxSettingsForm } from "./_components/forms";
import { TaxNav } from "./_components/ui";

export default function TaxPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-5">
      <TaxNav active="settings" />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "tax_settings", "view", false)) return <NoAccess />;
  const [settings, rates] = await Promise.all([getTaxSettings(), listTaxRates()]);
  const canEdit = can(ctx, "tax_settings", "update", false);

  const ratesSlot = (
    <section className={cn(panel, "grid gap-3 p-4 sm:p-5")}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <h2 className="text-lg font-semibold">Tarif PPN</h2>
          <p className="text-xs text-muted-foreground">
            Default 12% dengan DPP 11/12 (beban efektif 11% untuk barang dan jasa non-mewah).
          </p>
        </div>
        {can(ctx, "tax_settings", "create", false) && <AddRateDialog />}
      </div>
      <ul className="grid divide-y divide-border">
        {rates.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
            <span className="w-16 text-lg font-bold tabular-nums text-foreground">{r.rate_percent}%</span>
            <span className="min-w-0 flex-1 text-xs text-muted-foreground">
              DPP {r.dpp_numerator}/{r.dpp_denominator} · berlaku {formatDate(r.valid_from)} s/d{" "}
              {r.valid_to ? formatDate(r.valid_to) : "sekarang"}
            </span>
            {!r.valid_to && (
              <span className="rounded-full bg-brand-green-soft px-2.5 py-0.5 text-xs font-medium text-brand-green">
                Berlaku
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <>
      <PageHeader
        title="Pengaturan pajak"
        description="Profil usaha, saklar PPN, dan pilihan PPh. Tarif disimpan dengan tanggal berlaku, bukan ditulis di kode."
      />
      <TaxSettingsForm
        readOnly={!canEdit}
        ratesSlot={ratesSlot}
        defaults={{
          business_form: settings.business_form,
          is_pkp: settings.is_pkp,
          ppn_enabled: settings.ppn_enabled,
          prices_include_ppn: settings.prices_include_ppn,
          pph_mode: settings.pph_mode,
          pph_final_rate: String(settings.pph_final_rate),
          general_rate: String(settings.general_rate),
          annual_ceiling: String(settings.annual_ceiling),
          free_threshold: String(settings.free_threshold),
          facility_end_date: settings.facility_end_date ?? "",
          pph_due_day: String(settings.pph_due_day),
        }}
      />
    </>
  );
}
