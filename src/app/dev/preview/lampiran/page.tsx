import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AttachmentButton, AttachmentPanel } from "@/components/attachment-panel";

// Pratinjau panel lampiran tanpa login, HANYA saat development (404 di production).
// Gambar tidak termuat karena rute berkas butuh sesi; tata letak dan kontrol yang diperiksa di sini.
export default function LampiranPreview() {
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}

const INITIAL = [
  { id: "a1", file_name: "depan.jpg", mime_type: "image/jpeg", size_bytes: 120000, created_at: "2026-11-04T01:00:00Z" },
  { id: "a2", file_name: "faktur-supplier-nov-2026-0001.pdf", mime_type: "application/pdf", size_bytes: 80000, created_at: "2026-11-04T02:00:00Z" },
];

async function Preview() {
  await connection();
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto grid max-w-[700px] gap-5 p-6">
      <AttachmentPanel entityType="goods_receipt" entityId="00000000-0000-0000-0000-000000000000" title="Foto faktur supplier" hint="JPG, PNG, WebP, atau PDF, maksimal 5 MB." canEdit initial={INITIAL} />
      <AttachmentButton entityType="cash_transaction" entityId="00000000-0000-0000-0000-000000000000" title="Bukti KAS-0001" canEdit />
    </main>
  );
}
