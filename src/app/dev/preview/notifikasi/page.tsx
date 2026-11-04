import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Demo } from "./demo";

// Pratinjau bel notifikasi tanpa login, HANYA saat development (404 di production).
export default function NotifikasiPreview() {
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}

async function Preview() {
  await connection();
  if (process.env.NODE_ENV !== "development") notFound();
  return <Demo />;
}
