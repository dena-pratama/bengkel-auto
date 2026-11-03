import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AppToaster } from "@/components/app-toaster";
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
    <main className="grid min-h-svh place-items-center gap-4 bg-background p-6">
      <NewSupplierDialog />
      <AppToaster />
    </main>
  );
}
