import { Suspense } from "react";
import { HandCoins } from "lucide-react";
import { EmptyState, NoAccess, PageHeader, Skeleton, panel } from "@/components/page-kit";
import { can, requireUser } from "@/lib/auth";
import { formatDate, formatRupiah, todayWib } from "@/lib/format";
import { listActiveEmployees, listCashAccounts, listLoans } from "@/lib/payroll";
import { cn } from "@/lib/utils";
import { LoanDialog, RepayDialog, VoidLoanButton } from "../_components/forms";
import { PayrollNav } from "../_components/ui";

export default function LoansPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-5">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Content />
      </Suspense>
    </div>
  );
}

const STATUS = { active: "Aktif", paid_off: "Lunas", void: "Dibatalkan" } as const;

async function Content() {
  const ctx = await requireUser();
  if (!can(ctx, "payroll", "view")) return <NoAccess />;
  const all = can(ctx, "payroll", "view", false);
  const canCreate = can(ctx, "payroll", "create", false);
  const [loans, employees, cash] = await Promise.all([listLoans(), canCreate ? listActiveEmployees() : Promise.resolve([]), canCreate ? listCashAccounts() : Promise.resolve([])]);
  const outstanding = loans.filter((l) => l.status === "active").reduce((t, l) => t + l.balance, 0);
  const today = todayWib();

  return (
    <>
      <PayrollNav active="loans" showAll={all} />
      <PageHeader
        title={all ? "Kasbon karyawan" : "Kasbon saya"}
        description={`Sisa kasbon aktif ${formatRupiah(outstanding)}`}
        actions={canCreate && <LoanDialog employees={employees} cashAccounts={cash} today={today} />}
      />
      <section className={cn(panel, "p-4 sm:p-5")}>
        {loans.length === 0 ? (
          <EmptyState icon={HandCoins} text="Belum ada kasbon." />
        ) : (
          <ul className="grid divide-y divide-border">
            {loans.map((l) => (
              <li key={l.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 py-3", l.status === "void" && "opacity-60")}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {l.employee_name} <span className="font-mono text-xs font-normal text-muted-foreground">{l.loan_no}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(l.loan_date)} · pokok {formatRupiah(l.principal)} · cicilan {formatRupiah(l.installment_amount)}/periode · dari {l.cash_bank_name}
                    {l.note && ` · ${l.note}`}
                    {l.void_reason && ` · batal: ${l.void_reason}`}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{STATUS[l.status]}</span>
                <span className={cn("w-32 text-right font-semibold tabular-nums", l.balance > 0 && l.status === "active" && "text-brand-red")}>{formatRupiah(l.balance)}</span>
                {canCreate && l.status === "active" && (
                  <span className="flex flex-wrap items-center gap-1">
                    <RepayDialog loanId={l.id} balance={l.balance} cashAccounts={cash} today={today} />
                    {l.balance === l.principal && <VoidLoanButton id={l.id} />}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
