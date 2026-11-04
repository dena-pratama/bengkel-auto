import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CompatPanel } from "../../../(app)/inventory/_components/compat-panel";

// Pratinjau panel kompatibilitas kendaraan tanpa login, HANYA saat development (404 di production).
export default function CompatPreview() {
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
    <main className="mx-auto max-w-[760px] p-6">
      <CompatPanel
        itemId="preview"
        initial={[
          { make: "Toyota", model: "Avanza", year_from: 2012, year_to: 2018, engine: "1.3 VVT-i" },
          { make: "Daihatsu", model: "Xenia", year_from: null, year_to: null, engine: null },
        ]}
        known={[{ make: "Toyota", model: "Avanza" }, { make: "Honda", model: "Jazz" }]}
        canEdit
      />
    </main>
  );
}
