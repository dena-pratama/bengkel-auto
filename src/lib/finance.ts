import "server-only";
import { createClient } from "@/lib/supabase/server";

// Pembaca data keuangan (RLS & fungsi laporan memeriksa izin finance_reports / journal / expenses)

function must<T>(res: { data: unknown; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Gagal memuat ${what}: ${res.error.message}`);
  return res.data as T;
}
const num = (v: unknown) => Number(v ?? 0);

export type CashBankBalance = { cash_bank_account_id: string; name: string; kind: "cash" | "bank"; bank_name: string | null; account_number: string | null; is_active: boolean; balance: number };

export async function listCashBankBalances(date: string): Promise<CashBankBalance[]> {
  const s = await createClient();
  return must<CashBankBalance[]>(await s.rpc("report_cash_bank_balances", { p_date: date }), "saldo kas & bank").map((r) => ({ ...r, balance: num(r.balance) }));
}

export type CashTransaction = {
  id: string;
  txn_no: string;
  txn_date: string;
  kind: "income" | "expense" | "transfer" | "capital" | "drawing";
  cash_bank_account_id: string;
  cash_bank_name: string;
  to_cash_bank_name: string | null;
  account_code: string | null;
  account_name: string | null;
  amount: number;
  description: string;
  recurring_id: string | null;
  status: "posted" | "void";
  void_reason: string | null;
};

export async function listCashTransactions(limit = 40): Promise<CashTransaction[]> {
  const s = await createClient();
  return must<CashTransaction[]>(
    await s.from("v_cash_transactions").select("*").order("txn_date", { ascending: false }).order("created_at", { ascending: false }).limit(limit),
    "transaksi kas",
  ).map((t) => ({ ...t, amount: num(t.amount) }));
}

export type RecurringExpense = {
  id: string;
  name: string;
  account_id: string;
  account_name: string;
  cash_bank_account_id: string;
  cash_bank_name: string;
  amount: number;
  day_of_month: number;
  is_active: boolean;
  confirmed_this_month: boolean;
  last_confirmed_on: string | null;
};

export async function listRecurringExpenses(): Promise<RecurringExpense[]> {
  const s = await createClient();
  return must<RecurringExpense[]>(await s.from("v_recurring_expenses").select("*").order("name"), "biaya rutin").map((r) => ({ ...r, amount: num(r.amount) }));
}

export type AccountRow = {
  id: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "cogs" | "expense" | "other";
  normal_balance: "debit" | "credit";
  system_key: string | null;
  is_active: boolean;
};

export async function listAccounts(): Promise<AccountRow[]> {
  const s = await createClient();
  return must<AccountRow[]>(await s.from("accounts").select("id, code, name, type, normal_balance, system_key, is_active").order("code"), "bagan akun");
}

export async function listCashBankAccounts() {
  const s = await createClient();
  return must<{ id: string; name: string; kind: "cash" | "bank"; bank_name: string | null; account_number: string | null; is_active: boolean }[]>(
    await s.from("cash_bank_accounts").select("id, name, kind, bank_name, account_number, is_active").order("kind").order("name"),
    "akun kas/bank",
  );
}

// ---------------------------------------------------------------------------- Laporan

export type PlRow = { section: "revenue" | "cogs" | "expense" | "tax" | "other"; account_id: string; code: string; name: string; amount: number };

export async function getProfitLoss(from: string, to: string): Promise<PlRow[]> {
  const s = await createClient();
  return must<PlRow[]>(await s.rpc("report_profit_loss", { p_from: from, p_to: to }), "laba rugi").map((r) => ({ ...r, amount: num(r.amount) }));
}

export type ProfitLossSummary = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  expense: number;
  operatingProfit: number;
  other: number;
  beforeTax: number;
  tax: number;
  net: number;
};

export function summarizeProfitLoss(rows: PlRow[]): ProfitLossSummary {
  const sum = (sec: PlRow["section"]) => rows.filter((r) => r.section === sec).reduce((t, r) => t + r.amount, 0);
  const revenue = sum("revenue");
  const cogs = sum("cogs");
  const expense = sum("expense");
  const other = sum("other");
  const tax = sum("tax");
  const grossProfit = revenue - cogs;
  const operatingProfit = grossProfit - expense;
  const beforeTax = operatingProfit + other;
  return { revenue, cogs, grossProfit, expense, operatingProfit, other, beforeTax, tax, net: beforeTax - tax };
}

export type BsRow = { section: "asset" | "liability" | "equity"; account_id: string | null; code: string; name: string; amount: number };

export async function getBalanceSheet(date: string): Promise<BsRow[]> {
  const s = await createClient();
  return must<BsRow[]>(await s.rpc("report_balance_sheet", { p_date: date }), "neraca").map((r) => ({ ...r, amount: num(r.amount) }));
}

export type CashFlowRow = { category: "operating" | "investing" | "financing"; source_type: string; inflow: number; outflow: number };

export async function getCashFlow(from: string, to: string): Promise<CashFlowRow[]> {
  const s = await createClient();
  return must<CashFlowRow[]>(await s.rpc("report_cash_flow", { p_from: from, p_to: to }), "arus kas").map((r) => ({ ...r, inflow: num(r.inflow), outflow: num(r.outflow) }));
}

export type MarginRow = { key_id: string; label: string; sublabel: string | null; qty: number; revenue: number; cost: number; margin: number };

export async function getMargin(group: "service" | "item" | "wo", from: string, to: string): Promise<MarginRow[]> {
  const s = await createClient();
  return must<MarginRow[]>(await s.rpc("report_margin", { p_group: group, p_from: from, p_to: to }), "margin").map((r) => ({
    ...r,
    qty: num(r.qty),
    revenue: num(r.revenue),
    cost: num(r.cost),
    margin: num(r.margin),
  }));
}

export type LedgerRow = {
  ord: number;
  entry_id: string | null;
  entry_no: string | null;
  entry_date: string | null;
  description: string;
  source_type: string | null;
  memo: string | null;
  debit: number;
  credit: number;
  balance: number;
};

export async function getLedger(accountId: string, from: string, to: string): Promise<LedgerRow[]> {
  const s = await createClient();
  return must<LedgerRow[]>(await s.rpc("report_ledger", { p_account_id: accountId, p_from: from, p_to: to }), "buku besar").map((r) => ({
    ...r,
    ord: num(r.ord),
    debit: num(r.debit),
    credit: num(r.credit),
    balance: num(r.balance),
  }));
}

export type JournalEntry = {
  id: string;
  entry_no: string;
  entry_date: string;
  source_type: string;
  description: string;
  reversal_of: string | null;
  total: number;
  is_reversed: boolean;
  lines: { account_id: string; debit: number; credit: number; memo: string | null; accounts: { code: string; name: string } }[];
};

export async function listJournal(from: string, to: string, source: string | null): Promise<JournalEntry[]> {
  const s = await createClient();
  let q = s
    .from("v_journal_entries")
    .select("id, entry_no, entry_date, source_type, description, reversal_of, total, is_reversed")
    .gte("entry_date", from)
    .lte("entry_date", to)
    .order("entry_date", { ascending: false })
    .order("entry_no", { ascending: false })
    .limit(200);
  if (source) q = q.eq("source_type", source);
  const entries = must<Omit<JournalEntry, "lines">[]>(await q, "jurnal");
  if (entries.length === 0) return [];
  const lines = must<{ entry_id: string; account_id: string; debit: number; credit: number; memo: string | null; accounts: { code: string; name: string } }[]>(
    await s.from("journal_lines").select("entry_id, account_id, debit, credit, memo, accounts(code, name)").in("entry_id", entries.map((e) => e.id)).order("debit", { ascending: false }),
    "baris jurnal",
  );
  return entries.map((e) => ({
    ...e,
    total: num(e.total),
    lines: lines.filter((l) => l.entry_id === e.id).map((l) => ({ account_id: l.account_id, debit: num(l.debit), credit: num(l.credit), memo: l.memo, accounts: l.accounts })),
  }));
}

export type FiscalPeriod = { period_year: number; period_month: number; is_closed: boolean; closed_at: string; reopen_reason: string | null };

export async function listFiscalPeriods(): Promise<FiscalPeriod[]> {
  const s = await createClient();
  return must<FiscalPeriod[]>(
    await s.from("fiscal_periods").select("period_year, period_month, is_closed, closed_at, reopen_reason").order("period_year", { ascending: false }).order("period_month", { ascending: false }),
    "periode",
  );
}

/** Bulan yang punya jurnal, untuk daftar tutup buku (YYYY-MM) */
export async function listJournalMonths(): Promise<string[]> {
  const s = await createClient();
  const rows = must<{ entry_date: string }[]>(await s.from("journal_entries").select("entry_date").order("entry_date", { ascending: false }).limit(5000), "bulan jurnal");
  return [...new Set(rows.map((r) => r.entry_date.slice(0, 7)))];
}
