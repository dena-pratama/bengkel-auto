"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const initialsOf = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/** Foto profil bulat/membulat; bila tidak ada atau gagal dimuat, tampil inisial nama. */
export function UserAvatar({ name, photoUrl, className }: { name: string; photoUrl?: string | null; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const show = Boolean(photoUrl) && failed !== photoUrl;
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden bg-brand-blue-soft font-semibold text-brand-blue-fg", className)}>
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl!} alt={name} className="size-full object-cover" onError={() => setFailed(photoUrl ?? null)} />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
