"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Trash2 } from "lucide-react";
import { TOAST_MS } from "@/components/app-toaster";
import { FormError } from "@/components/form-field";
import { inputClass } from "@/components/page-kit";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { clearAvatarAction, changePasswordAction, setAvatarAction, updatePhoneAction } from "../profil-actions";

const SIZE = 512;

/** Potong tengah menjadi persegi 512 px dan simpan sebagai JPEG: unggahan kecil, EXIF (lokasi dll.) ikut terbuang */
export async function toAvatarFile(file: File): Promise<File> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak mendukung pemrosesan gambar.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
  if (!blob) throw new Error("Gagal memproses gambar.");
  return new File([blob], "foto-profil.jpg", { type: "image/jpeg" });
}

export function AvatarEditor({ employeeId, name, photoUrl }: { employeeId: string; name: string; photoUrl: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const upload = async (picked: File) => {
    setError("");
    setBusy(true);
    try {
      const file = await toAvatarFile(picked);
      const form = new FormData();
      form.set("entity_type", "employee_avatar");
      form.set("entity_id", employeeId);
      form.set("file", file);
      const r = await fetch("/api/v1/attachments", { method: "POST", body: form });
      const body = (await r.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!r.ok || !body?.id) return setError(body?.error ?? "Gagal mengunggah foto.");
      const res = await setAvatarAction(body.id);
      if (!res.ok) return setError(res.error);
      toast.success("Foto profil diperbarui.", { duration: TOAST_MS.action });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "File bukan gambar yang bisa dibuka.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setError("");
    setBusy(true);
    const res = await clearAvatarAction();
    setBusy(false);
    if (!res.ok) return setError(res.error);
    toast.success("Foto profil dihapus.", { duration: TOAST_MS.action });
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-5">
      <UserAvatar name={name} photoUrl={photoUrl} className="size-20 rounded-full text-2xl ring-4 ring-background shadow-md" />
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Pilih foto profil"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void upload(f);
            }}
          />
          <Button type="button" disabled={busy} onClick={() => input.current?.click()} className="rounded-xl">
            <Camera className="size-4" /> {busy ? "Memproses..." : photoUrl ? "Ganti foto" : "Unggah foto"}
          </Button>
          {photoUrl && (
            <Button type="button" variant="outline" disabled={busy} onClick={() => void remove()} className="rounded-xl text-destructive hover:bg-destructive/10">
              <Trash2 className="size-4" /> Hapus foto
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG, atau WebP. Foto dipotong persegi dan diperkecil otomatis.</p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export function PhoneForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      setError(null);
      const r = await updatePhoneAction(value);
      if (!r.ok) return setError(r.error);
      toast.success("Nomor HP tersimpan.", { duration: TOAST_MS.action });
      router.refresh();
    });
  return (
    <div className="grid max-w-sm gap-2">
      <label className="grid gap-1.5 text-sm font-medium">
        Nomor HP / WhatsApp
        <input inputMode="tel" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0812xxxxxxx" className={inputClass} />
      </label>
      <FormError message={error} />
      <div>
        <Button disabled={pending || value.trim() === initial} onClick={submit} className="rounded-xl">
          {pending ? "Menyimpan..." : "Simpan nomor"}
        </Button>
      </div>
    </div>
  );
}

export function PasswordForm() {
  const [v, setV] = useState({ current_password: "", password: "", confirm_password: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      setError(null);
      const r = await changePasswordAction(v);
      if (!r.ok) return setError(r.error);
      setV({ current_password: "", password: "", confirm_password: "" });
      toast.success("Password diganti.", { duration: TOAST_MS.action });
    });
  const field = (key: keyof typeof v, label: string, autoComplete: string) => (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <input type="password" autoComplete={autoComplete} value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} className={inputClass} />
    </label>
  );
  return (
    <div className="grid max-w-sm gap-3">
      {field("current_password", "Password saat ini", "current-password")}
      {field("password", "Password baru (minimal 8 karakter)", "new-password")}
      {field("confirm_password", "Ulangi password baru", "new-password")}
      <FormError message={error} />
      <div>
        <Button disabled={pending || !v.current_password || !v.password} onClick={submit} className="rounded-xl">
          {pending ? "Menyimpan..." : "Ganti password"}
        </Button>
      </div>
    </div>
  );
}
