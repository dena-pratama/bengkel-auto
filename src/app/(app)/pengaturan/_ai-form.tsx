"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TOAST_MS } from "@/components/app-toaster";
import { FormError } from "@/components/form-field";
import { inputClass, panel } from "@/components/page-kit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AiSettingsInput } from "@/lib/validation/settings";
import type { AiProviderState } from "@/lib/ai/providers";
import { saveAiSettingsAction } from "./actions";

/** Pengaturan Tanya AI: penyedia default dan nama model. Kunci API diisi di environment server, tidak di sini. */
export function AiSettingsForm({
  providers,
  provider,
  readOnly,
}: {
  providers: AiProviderState[];
  provider: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draftProvider, setDraftProvider] = useState(provider);
  const [models, setModels] = useState<Record<string, string>>(() => Object.fromEntries(providers.map((p) => [p.id, p.savedModel])));

  const save = () =>
    start(async () => {
      setError(null);
      const payload = {
        ai_provider: draftProvider as AiSettingsInput["ai_provider"],
        ai_model_anthropic: models.anthropic ?? "",
        ai_model_openai: models.openai ?? "",
        ai_model_gemini: models.gemini ?? "",
        ai_model_openrouter: models.openrouter ?? "",
      };
      const r = await saveAiSettingsAction(payload);
      if (!r.ok) return setError(r.error);
      toast.success("Pengaturan Tanya AI tersimpan.", { duration: TOAST_MS.action });
      router.refresh();
    });

  const anyKey = providers.some((p) => p.hasKey);

  return (
    <section className={cn(panel, "space-y-5 rounded-2xl p-6 shadow-xs")}>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Tanya AI (AI Analyst)</h2>
        <p className="text-xs text-muted-foreground">
          Kunci API diisi di environment server (ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY) dan tidak ditampilkan di sini. Di sini Anda memilih penyedia default dan nama modelnya.
        </p>
      </div>

      {!anyKey && (
        <p className="rounded-xl border border-brand-sand/40 bg-brand-sand-soft px-3 py-2 text-sm text-brand-sand">
          Belum ada kunci penyedia di server. Tanya AI tidak aktif sampai salah satu kunci diisi lalu server dijalankan ulang.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-semibold text-foreground sm:col-span-2">
          Penyedia default
          <select
            className={inputClass}
            value={draftProvider}
            onChange={(e) => setDraftProvider(e.target.value)}
            disabled={readOnly || pending}
          >
            <option value="">Otomatis (penyedia pertama yang kuncinya terisi)</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.hasKey}>
                {p.label}
                {p.hasKey ? "" : " (kunci belum diisi)"}
              </option>
            ))}
          </select>
        </label>

        {providers.map((p) => (
          <div key={p.id} className="grid content-start gap-2 rounded-xl border border-border/80 bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{p.label}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  p.hasKey ? "bg-brand-green-soft text-brand-green" : "bg-muted text-muted-foreground",
                )}
              >
                {p.hasKey ? "Kunci terisi" : "Kunci belum diisi"}
              </span>
            </div>
            <label className="grid gap-1.5 text-xs font-semibold text-foreground">
              Nama model
              <input
                className={inputClass}
                value={models[p.id] ?? ""}
                onChange={(e) => setModels((m) => ({ ...m, [p.id]: e.target.value }))}
                placeholder={p.defaultModel}
                maxLength={120}
                disabled={readOnly || pending}
              />
              <span className="text-[11px] font-normal text-muted-foreground">
                Kosong = pakai bawaan ({p.defaultModel})
              </span>
            </label>
            <p className="text-[11px] text-muted-foreground">Environment: {p.keyEnv}</p>
          </div>
        ))}
      </div>

      <FormError message={error} />

      {!readOnly && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={pending}>
            {pending ? "Menyimpan..." : "Simpan pengaturan Tanya AI"}
          </Button>
        </div>
      )}
    </section>
  );
}
