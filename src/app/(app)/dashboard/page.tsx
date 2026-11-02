import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { can, requireUser } from "@/lib/auth";

const SUMMARY_CARDS = [
  { label: "Omzet hari ini", hint: "Tersedia setelah modul Kasir" },
  { label: "Work order aktif", hint: "Tersedia setelah modul Servis" },
  { label: "Stok menipis", hint: "Tersedia setelah modul Inventory" },
  { label: "Hutang jatuh tempo", hint: "Tersedia setelah modul Pembelian" },
];

export default async function DashboardPage() {
  const ctx = await requireUser();
  const firstName = ctx.employee.full_name.split(" ")[0];
  const today = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date());

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Halo, {firstName}</h1>
        <p className="text-sm text-zinc-500">{today}</p>
      </div>

      {can(ctx, "dashboard") ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SUMMARY_CARDS.map((card) => (
            <Card key={card.label} className="bg-white">
              <CardHeader>
                <CardDescription>{card.label}</CardDescription>
                <CardTitle className="text-2xl text-zinc-300">–</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-zinc-400">{card.hint}</CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Selamat bekerja</CardTitle>
            <CardDescription>Pilih menu di samping untuk mulai.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
