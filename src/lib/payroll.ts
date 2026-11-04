import "server-only";
import { createClient } from "@/lib/supabase/server";

// Pembaca data penggajian (RLS: payroll lihat semua, atau milik sendiri setelah gaji disetujui)

function must<T>(res: { data: unknown; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Gagal memuat ${what}: ${res.error.message}`);
  return res.data as T;
}
const num = (v: unknown) => Number(v ?? 0);

export type PayrollStatus = "draft" | "review" | "approved" | "paid" | "void";

export type PayrollPeriod = {
  id: string;
  period_no: string;
  label: string;
  period_type: "monthly" | "weekly";
  start_date: string;
  end_date: string;
  status: PayrollStatus;
  approved_at: string | null;
  paid_date: string | null;
  void_reason: string | null;
  slips: number;
  gross: number;
  net: number;
};

export async function listPayrollPeriods(f?: { from: string | null; to: string | null; status?: string | null; type?: string | null }): Promise<PayrollPeriod[]> {
  const s = await createClient();
  type Row = Omit<PayrollPeriod, "slips" | "gross" | "net"> & { payslips: { gross_amount: number; net_amount: number }[] };
  let q = s
    .from("payroll_periods")
    .select("id, period_no, label, period_type, start_date, end_date, status, approved_at, paid_date, void_reason, payslips(gross_amount, net_amount)")
    .order("start_date", { ascending: false })
    .limit(200);
  // periode ikut bila rentangnya beririsan dengan filter
  if (f?.from) q = q.gte("end_date", f.from);
  if (f?.to) q = q.lte("start_date", f.to);
  if (f?.status) q = q.eq("status", f.status);
  if (f?.type) q = q.eq("period_type", f.type);
  const rows = must<Row[]>(await q, "periode gaji");
  return rows.map(({ payslips, ...p }) => ({
    ...p,
    slips: payslips.length,
    gross: payslips.reduce((t, x) => t + num(x.gross_amount), 0),
    net: payslips.reduce((t, x) => t + num(x.net_amount), 0),
  }));
}

export type Payslip = {
  id: string;
  period_id: string;
  employee_id: string;
  employee_name: string;
  employee_position: string | null;
  slip_no: string;
  pay_type: "monthly" | "daily";
  base_salary: number;
  days_worked: number;
  base_amount: number;
  allowance_details: { name: string; amount: number }[];
  allowance_amount: number;
  overtime_hours: number;
  overtime_rate: number;
  overtime_amount: number;
  commission_amount: number;
  bonus_amount: number;
  loan_deduction: number;
  other_deduction: number;
  other_deduction_note: string | null;
  gross_amount: number;
  net_amount: number;
  notes: string | null;
  period_label: string;
  period_no: string;
  period_type: "monthly" | "weekly";
  start_date: string;
  end_date: string;
  period_status: PayrollStatus;
  paid_date: string | null;
};

const toSlip = (r: Payslip): Payslip => ({
  ...r,
  base_salary: num(r.base_salary),
  days_worked: num(r.days_worked),
  base_amount: num(r.base_amount),
  allowance_amount: num(r.allowance_amount),
  allowance_details: (r.allowance_details ?? []).map((a) => ({ name: a.name, amount: num(a.amount) })),
  overtime_hours: num(r.overtime_hours),
  overtime_rate: num(r.overtime_rate),
  overtime_amount: num(r.overtime_amount),
  commission_amount: num(r.commission_amount),
  bonus_amount: num(r.bonus_amount),
  loan_deduction: num(r.loan_deduction),
  other_deduction: num(r.other_deduction),
  gross_amount: num(r.gross_amount),
  net_amount: num(r.net_amount),
});

export async function getPayrollPeriod(id: string) {
  const s = await createClient();
  const [period, slips] = await Promise.all([
    s
      .from("payroll_periods")
      .select("id, period_no, label, period_type, start_date, end_date, status, approved_at, paid_date, void_reason, cash_bank_accounts(name)")
      .eq("id", id)
      .maybeSingle(),
    s.from("v_payslips").select("*").eq("period_id", id).order("employee_name"),
  ]);
  type P = Omit<PayrollPeriod, "slips" | "gross" | "net"> & { cash_bank_accounts: { name: string } | null };
  const row = must<P | null>(period, "periode gaji");
  if (!row) return null;
  return { ...row, slips: must<Payslip[]>(slips, "slip gaji").map(toSlip) };
}

export async function getPayslip(id: string) {
  const s = await createClient();
  const slip = must<Payslip | null>(await s.from("v_payslips").select("*").eq("id", id).maybeSingle(), "slip gaji");
  if (!slip) return null;
  const comm = must<{ id: string; amount: number; base_amount: number; recognized_at: string | null; sales: { sale_no: string | null } | null }[]>(
    await s.from("commissions").select("id, amount, base_amount, recognized_at, sales(sale_no)").eq("payslip_id", id).order("recognized_at"),
    "komisi slip",
  );
  return { ...toSlip(slip), commissions: comm.map((c) => ({ ...c, amount: num(c.amount), base_amount: num(c.base_amount) })) };
}

export type PayProfile = {
  employee_id: string;
  code: string;
  full_name: string;
  position: string | null;
  status: string;
  pay_type: "monthly" | "daily" | null;
  base_salary: number;
  fixed_allowances: { name: string; amount: number }[];
};

export async function listPayProfiles(): Promise<PayProfile[]> {
  const s = await createClient();
  const [emps, profiles] = await Promise.all([
    s.from("employees").select("id, code, full_name, position, status").neq("status", "inactive").order("full_name"),
    s.from("employee_pay_profiles").select("employee_id, pay_type, base_salary, fixed_allowances"),
  ]);
  const map = new Map(
    must<{ employee_id: string; pay_type: "monthly" | "daily"; base_salary: number; fixed_allowances: { name: string; amount: number }[] }[]>(profiles, "profil gaji").map((p) => [p.employee_id, p]),
  );
  return must<{ id: string; code: string; full_name: string; position: string | null; status: string }[]>(emps, "karyawan").map((e) => {
    const p = map.get(e.id);
    return {
      employee_id: e.id,
      code: e.code,
      full_name: e.full_name,
      position: e.position,
      status: e.status,
      pay_type: p?.pay_type ?? null,
      base_salary: num(p?.base_salary),
      fixed_allowances: (p?.fixed_allowances ?? []).map((a) => ({ name: a.name, amount: num(a.amount) })),
    };
  });
}

export type Loan = {
  id: string;
  loan_no: string;
  employee_id: string;
  employee_name: string;
  loan_date: string;
  principal: number;
  installment_amount: number;
  note: string | null;
  status: "active" | "paid_off" | "void";
  void_reason: string | null;
  cash_bank_name: string;
  balance: number;
};

export async function listLoans(f?: { from: string | null; to: string | null; status?: string | null; employee?: string | null }): Promise<Loan[]> {
  const s = await createClient();
  let q = s.from("v_employee_loans").select("*").order("loan_date", { ascending: false }).limit(500);
  if (f?.from) q = q.gte("loan_date", f.from);
  if (f?.to) q = q.lte("loan_date", f.to);
  if (f?.status) q = q.eq("status", f.status);
  if (f?.employee) q = q.eq("employee_id", f.employee);
  return must<Loan[]>(await q, "kasbon").map((l) => ({
    ...l,
    principal: num(l.principal),
    installment_amount: num(l.installment_amount),
    balance: num(l.balance),
  }));
}

export type CommissionRow = {
  id: string;
  employee_id: string;
  employee_name: string | null;
  base_amount: number;
  commission_type: "percent" | "fixed";
  commission_value: number;
  share_percent: number;
  amount: number;
  status: "pending" | "recognized" | "paid" | "void";
  recognized_at: string | null;
  created_at: string;
  sale_no: string | null;
};

export async function listCommissions(f?: { from: string | null; to: string | null; status?: string | null; employee?: string | null }): Promise<CommissionRow[]> {
  const s = await createClient();
  type Row = Omit<CommissionRow, "employee_name" | "sale_no"> & { employees: { full_name: string } | null; sales: { sale_no: string | null } | null };
  let q = s
    .from("commissions")
    .select("id, employee_id, base_amount, commission_type, commission_value, share_percent, amount, status, recognized_at, created_at, employees(full_name), sales(sale_no)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (f?.from) q = q.gte("created_at", `${f.from}T00:00:00+07:00`);
  if (f?.to) q = q.lte("created_at", `${f.to}T23:59:59.999+07:00`);
  if (f?.status) q = q.eq("status", f.status);
  if (f?.employee) q = q.eq("employee_id", f.employee);
  return must<Row[]>(await q, "komisi").map(({ employees, sales, ...c }) => ({
    ...c,
    base_amount: num(c.base_amount),
    commission_value: num(c.commission_value),
    share_percent: num(c.share_percent),
    amount: num(c.amount),
    employee_name: employees?.full_name ?? null,
    sale_no: sales?.sale_no ?? null,
  }));
}

export async function listActiveEmployees() {
  const s = await createClient();
  return must<{ id: string; full_name: string }[]>(await s.from("employees").select("id, full_name").neq("status", "inactive").order("full_name"), "karyawan");
}

export async function listCashAccounts() {
  const s = await createClient();
  return must<{ id: string; name: string }[]>(await s.from("cash_bank_accounts").select("id, name").eq("is_active", true).order("kind").order("name"), "akun kas/bank");
}
