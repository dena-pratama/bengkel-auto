"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, KeyRound, RefreshCw, Send } from "lucide-react";
import { TOAST_MS } from "@/components/app-toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { askAction, createTokenAction, generateWeeklyAction, revokeTokenAction } from "../actions";

export function GenerateWeeklyButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await generateWeeklyAction();
          if (!r.ok) return void toast.error(r.error, { duration: TOAST_MS.warning });
          toast.success("Ringkasan dibuat.", { duration: TOAST_MS.action });
          router.refresh();
        })
      }
    >
      <RefreshCw className="size-4" /> {pending ? "Membuat..." : "Buat ringkasan sekarang"}
    </Button>
  );
}

export function AskBox({ providers }: { providers: { id: string; label: string; model: string }[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [provider, setProvider] = useState(providers[0]?.id ?? "");
  const enabled = providers.length > 0;
  const [answer, setAnswer] = useState<{ text: string; tools: string[]; label: string } | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError("");
      const r = await askAction(q, provider);
      if (!r.ok) return setError(r.error);
      setAnswer({ text: r.data.answer, tools: r.data.tools, label: `${r.data.provider} · ${r.data.model}` });
      router.refresh();
    });

  return (
    <div className="grid gap-3">
      <Textarea value={q} onChange={(e) => setQ(e.target.value)} rows={2} maxLength={500} disabled={!enabled || pending} placeholder="Contoh: Kenapa laba bulan ini turun dibanding bulan lalu?" />
      <div className="flex flex-wrap items-center gap-3">
        {enabled && (
          <select
            aria-label="Pilih penyedia AI"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            disabled={pending || providers.length < 2}
            className="h-10 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-70"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        )}
        <Button onClick={submit} disabled={!enabled || pending || q.trim().length < 5}>
          <Send className="size-4" /> {pending ? "AI sedang menganalisis..." : "Tanya AI"}
        </Button>
        {!enabled && <p className="text-sm text-muted-foreground">Belum aktif: isi kunci salah satu penyedia (ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY) di environment server.</p>}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {answer && (
        <div className="grid gap-2 rounded-2xl bg-muted/60 p-4">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{answer.text}</p>
          <p className="text-xs text-muted-foreground">Dijawab oleh {answer.label}</p>
          {answer.tools.length > 0 && <p className="text-xs text-muted-foreground">Sumber data: {[...new Set(answer.tools)].join(", ")}</p>}
        </div>
      )}
    </div>
  );
}

export function TokenManager({ tokens, mcpUrl }: { tokens: { id: string; name: string; token_prefix: string; last_used_at: string | null; revoked_at: string | null; created_at: string }[]; mcpUrl: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast.success("Disalin.", { duration: TOAST_MS.quick }));

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <p className="text-sm font-medium">Alamat server MCP</p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-xl bg-muted px-3 py-2 text-sm">{mcpUrl}</code>
          <Button variant="outline" size="icon" aria-label="Salin alamat" onClick={() => copy(mcpUrl)}>
            <Copy className="size-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Pasang di Claude (Connector) atau klien MCP lain dengan header Authorization: Bearer &lt;token&gt;.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama token, mis. Claude Desktop" maxLength={60} className="min-w-0 flex-1" />
        <Button
          disabled={pending || name.trim().length < 2}
          onClick={() =>
            start(async () => {
              setError("");
              const r = await createTokenAction(name);
              if (!r.ok) return setError(r.error);
              setFresh(r.data.token);
              setName("");
              router.refresh();
            })
          }
        >
          <KeyRound className="size-4" /> Buat token
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {fresh && (
        <div className="grid gap-2 rounded-2xl bg-brand-blue-soft p-4">
          <p className="text-sm font-medium">Salin token ini sekarang. Token tidak akan ditampilkan lagi.</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-xl bg-card px-3 py-2 text-sm">{fresh}</code>
            <Button variant="outline" size="icon" aria-label="Salin token" onClick={() => copy(fresh)}>
              <Copy className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {tokens.length > 0 && (
        <ul className="grid divide-y divide-border">
          {tokens.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.token_prefix}... · dibuat {new Date(t.created_at).toLocaleDateString("id-ID")} · {t.last_used_at ? `terakhir dipakai ${new Date(t.last_used_at).toLocaleDateString("id-ID")}` : "belum dipakai"}
                </p>
              </div>
              {t.revoked_at ? (
                <span className="rounded-full bg-brand-red-soft px-2.5 py-0.5 text-xs font-medium text-brand-red">Dicabut</span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await revokeTokenAction(t.id);
                      if (!r.ok) return void toast.error(r.error, { duration: TOAST_MS.warning });
                      toast.success("Token dicabut.", { duration: TOAST_MS.action });
                      router.refresh();
                    })
                  }
                >
                  Cabut
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
