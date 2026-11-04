import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Demo } from "./demo";

// Pratinjau filter lokal tanpa login, HANYA saat development (404 di production).
export default function FilterLokalPreview() {
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
    <main className="mx-auto max-w-[1000px] p-6">
      <Demo />
    </main>
  );
}
