import "server-only";

// Daftar penyedia AI untuk "Tanya AI". Kunci API hanya dibaca dari environment server (tidak pernah dikirim ke browser).
// Penyedia yang kuncinya belum diisi tidak ditampilkan di halaman.

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

export type ConfiguredProvider = { id: ProviderId; label: string; model: string };

/** Penyedia yang sudah punya kunci di environment (aman dikirim ke browser: tanpa kunci). */
export function configuredProviders(): ConfiguredProvider[] {
  return PROVIDERS.filter((p) => Boolean(process.env[p.keyEnv]?.trim())).map((p) => ({
    id: p.id,
    label: p.label,
    model: process.env[p.modelEnv]?.trim() || p.defaultModel,
  }));
}

export function getProvider(id: string): (ProviderDef & { key: string; model: string }) | null {
  const def = PROVIDERS.find((p) => p.id === id);
  const key = def ? process.env[def.keyEnv]?.trim() : "";
  if (!def || !key) return null;
  return { ...def, key, model: process.env[def.modelEnv]?.trim() || def.defaultModel };
}
