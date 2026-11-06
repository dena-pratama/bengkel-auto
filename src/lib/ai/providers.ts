import "server-only";
import { createClient } from "@/lib/supabase/server";

// Penyedia AI untuk "Tanya AI". Kunci API hanya dibaca dari environment server (tidak pernah disimpan di database
// atau dikirim ke browser). Penyedia aktif dan nama model diatur di halaman Pengaturan (tabel settings).

export type ProviderId = "anthropic" | "openai" | "gemini" | "openrouter";

export type ProviderDef = {
  id: ProviderId;
  label: string;
  keyEnv: string;
  modelEnv: string;
  defaultModel: string;
};

export const PROVIDERS: ProviderDef[] = [
  { id: "anthropic", label: "Anthropic (Claude)", keyEnv: "ANTHROPIC_API_KEY", modelEnv: "AI_MODEL", defaultModel: "claude-sonnet-5-5" },
  { id: "openai", label: "OpenAI (GPT)", keyEnv: "OPENAI_API_KEY", modelEnv: "OPENAI_MODEL", defaultModel: "gpt-4.1" },
  { id: "gemini", label: "Google Gemini", keyEnv: "GEMINI_API_KEY", modelEnv: "GEMINI_MODEL", defaultModel: "gemini-2.5-flash" },
  { id: "openrouter", label: "OpenRouter", keyEnv: "OPENROUTER_API_KEY", modelEnv: "OPENROUTER_MODEL", defaultModel: "anthropic/claude-sonnet-4.5" },
];

export type AiProviderState = {
  id: ProviderId;
  label: string;
  keyEnv: string;
  /** Kunci terisi di environment server (nilainya tidak pernah ditampilkan) */
  hasKey: boolean;
  defaultModel: string;
  /** Nama model yang disimpan di Pengaturan (kosong = pakai env atau bawaan) */
  savedModel: string;
  /** Model yang benar-benar dipakai */
  model: string;
};

/** Pengaturan AI dari tabel settings (dibaca sebagai pengguna yang login; RLS berlaku). */
async function savedAiSettings(): Promise<Record<string, string>> {
  const s = await createClient();
  const { data, error } = await s.from("settings").select("key, value").like("key", "ai_%");
  if (error) return {};
  const out: Record<string, string> = {};
  for (const r of data ?? []) out[r.key as string] = typeof r.value === "string" ? r.value : "";
  return out;
}

/** Status semua penyedia untuk halaman Pengaturan dan Tanya AI. */
export async function aiProviderStates(): Promise<{ provider: string; providers: AiProviderState[] }> {
  const saved = await savedAiSettings();
  const providers = PROVIDERS.map((p): AiProviderState => {
    const savedModel = (saved[`ai_model_${p.id}`] ?? "").trim();
    const envModel = process.env[p.modelEnv]?.trim() ?? "";
    return {
      id: p.id,
      label: p.label,
      keyEnv: p.keyEnv,
      hasKey: Boolean(process.env[p.keyEnv]?.trim()),
      defaultModel: p.defaultModel,
      savedModel,
      model: savedModel || envModel || p.defaultModel,
    };
  });
  return { provider: (saved.ai_provider ?? "").trim(), providers };
}

/** Penyedia yang kuncinya terisi, plus penyedia aktif (dari Pengaturan; jika kosong, yang pertama). */
export async function configuredProviders(): Promise<{ providers: { id: ProviderId; label: string; model: string }[]; active: string }> {
  const st = await aiProviderStates();
  const providers = st.providers.filter((p) => p.hasKey).map((p) => ({ id: p.id, label: p.label, model: p.model }));
  const active = providers.some((p) => p.id === st.provider) ? st.provider : (providers[0]?.id ?? "");
  return { providers, active };
}

/** Penyedia lengkap dengan kunci, untuk pemanggilan API. Null jika kunci belum diisi. */
export async function getProvider(id: string): Promise<{ id: ProviderId; label: string; key: string; model: string } | null> {
  const def = PROVIDERS.find((p) => p.id === id);
  const key = def ? process.env[def.keyEnv]?.trim() : "";
  if (!def || !key) return null;
  const st = (await aiProviderStates()).providers.find((p) => p.id === def.id);
  return { id: def.id, label: def.label, key, model: st?.model ?? def.defaultModel };
}
