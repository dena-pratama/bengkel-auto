"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { toast } from "sonner";
import { motion, useReducedMotion } from "motion/react";
import { XIcon } from "lucide-react";
import { TOAST_MS } from "@/components/app-toaster";
import { cn } from "@/lib/utils";

const SIZE = { md: "sm:max-w-2xl", lg: "sm:max-w-4xl", xl: "sm:max-w-6xl" } as const;

/**
 * Pop-up form besar. HP: panel naik dari bawah (bottom sheet, layar penuh hampir). Tablet ke atas: di tengah.
 * Animasi masuk lewat Motion; mengikuti setting "kurangi gerakan" di perangkat.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  size = "lg",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: keyof typeof SIZE;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        {/* Popup hanya pemosisi; panel di dalamnya yang dianimasikan (transform Motion tidak bentrok) */}
        <DialogPrimitive.Popup className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center outline-none sm:items-center sm:p-6">
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.8 }}
            className={cn(
              "pointer-events-auto flex max-h-[94svh] w-full flex-col overflow-hidden rounded-t-2xl bg-card shadow-2xl ring-1 ring-border sm:max-h-[90svh] sm:rounded-2xl",
              SIZE[size],
            )}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 pt-5 pb-4 sm:px-7 sm:pt-6">
              <div className="min-w-0">
                <DialogPrimitive.Title className="text-xl font-bold tracking-tight text-foreground">{title}</DialogPrimitive.Title>
                {description && <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">{description}</DialogPrimitive.Description>}
              </div>
              <DialogPrimitive.Close
                aria-label="Tutup"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <XIcon className="size-4" />
              </DialogPrimitive.Close>
            </div>
            <div data-slot="dialog-body" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-6 sm:px-7">{children}</div>
          </motion.div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * State pop-up "tambah data": setelah berhasil, tutup dialog, tampilkan toast (dengan tombol Buka),
 * dan segarkan daftar di halaman yang sama tanpa pindah halaman.
 */
export function useCreateDialog({ message, detailHref }: { message: string; detailHref?: (id: string) => string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const onDone = (id: string) => {
    setOpen(false);
    toast.success(message, detailHref ? { action: { label: "Buka", onClick: () => router.push(detailHref(id)) }, duration: TOAST_MS.action } : undefined);
    router.refresh();
  };
  return { open, setOpen, onDone, onCancel: () => setOpen(false) };
}
