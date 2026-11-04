"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MarkAllRead({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={disabled || busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/v1/notifications/read", { method: "POST" });
        setBusy(false);
        router.refresh();
      }}
    >
      <CheckCheck className="size-4" /> Tandai semua dibaca
    </Button>
  );
}
