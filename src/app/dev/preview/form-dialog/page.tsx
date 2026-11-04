import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AppToaster } from "@/components/app-toaster";
import { ToastButtons } from "./toast-buttons";
import { PopupShowcase } from "./popup-showcase";
import { NewSupplierDialog } from "../../../(app)/pembelian/_components/dialogs";

// Pratinjau pop-up form tanpa login, HANYA saat development (404 di production).
export default function FormDialogPreview() {
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}

async function Preview() {
  await connection();
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 bg-background p-6">
      <PopupShowcase />
      <div className="flex flex-col items-center gap-3 border-t border-border pt-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dialog & Notifikasi Lainnya</span>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <NewSupplierDialog />
          <ToastButtons />
        </div>
      </div>
      <AppToaster />
    </main>
  );
}
