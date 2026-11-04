import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ListFilter } from "@/components/list-filter";
import { formatDate, todayWib } from "@/lib/format";
import { readOption, readRange, describeRange } from "@/lib/list-filter";

// Pratinjau filter daftar tanpa login, HANYA saat development (404 di production).
export default function FilterPreview({ searchParams }: PageProps<"/dev/preview/filter">) {
  return (
    <Suspense>
      <Preview searchParams={searchParams} />
    </Suspense>
  );
}

const STATUS = ["posted", "paid", "unpaid", "void"] as const;
const LABEL = { posted: "Diposting (semua)", paid: "Lunas", unpaid: "Belum lunas", void: "Dibatalkan" } as const;

async function Preview({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  if (process.env.NODE_ENV !== "development") notFound();
  const sp = await searchParams;
  const today = todayWib();
  const range = readRange(sp, today, "bulan-ini");
  const status = readOption(sp, "status", STATUS);
  return (
    <main className="mx-auto grid max-w-[1000px] gap-4 p-6">
      <h1 className="text-2xl font-semibold">Penjualan & invoice</h1>
      <p data-testid="desc" className="text-sm text-muted-foreground">{describeRange(range, formatDate)} · status: {status ?? "semua"}</p>
      <ListFilter
        today={today}
        range={range}
        defaultRange="bulan-ini"
        selects={[{ name: "status", label: "Status", value: status, options: STATUS.map((v) => ({ value: v, label: LABEL[v] })), allLabel: "Semua status" }]}
      />
    </main>
  );
}
