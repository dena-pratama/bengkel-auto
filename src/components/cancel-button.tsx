"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Tombol batal: di pop-up menutup dialog (label "Batal"), di halaman biasa kembali ke href. */
export function CancelButton({ href, onCancel, children }: { href: string; onCancel?: () => void; children: React.ReactNode }) {
  if (onCancel)
    return (
      <Button type="button" variant="outline" onClick={onCancel}>
        Batal
      </Button>
    );
  return (
    <Button variant="outline" nativeButton={false} render={<Link href={href} />}>
      {children}
    </Button>
  );
}
