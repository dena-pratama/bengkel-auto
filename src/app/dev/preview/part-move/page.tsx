import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PartMoveDemo } from "./demo";

// Pratinjau panel keluarkan part tanpa login, HANYA saat development (404 di production).
export default function PartMovePreview() {
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
    <main className="mx-auto grid max-w-[900px] gap-5 p-6">
      <PartMoveDemo />
    </main>
  );
}
