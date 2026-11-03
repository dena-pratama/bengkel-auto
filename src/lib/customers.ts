import "server-only";
import { createClient } from "@/lib/supabase/server";

// Pembaca data pelanggan & kendaraan (RLS: izin customers:view)

function must<T>(res: { data: unknown; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Gagal memuat ${what}: ${res.error.message}`);
  return res.data as T;
}

export type CustomerType = "individual" | "company";

export type Customer = {
  id: string;
  code: string;
  type: CustomerType;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  npwp: string | null;
  credit_limit: number;
  payment_terms_days: number;
  notes: string | null;
  is_active: boolean;
};

const CUSTOMER_COLUMNS = "id, code, type, name, phone, email, address, npwp, credit_limit, payment_terms_days, notes, is_active";

export type Vehicle = {
  id: string;
  plate_no: string;
  plate_key: string;
  make_name: string | null;
  model_name: string | null;
  variant: string | null;
  year: number | null;
  color: string | null;
  transmission: "manual" | "automatic" | "cvt" | "other" | null;
  fuel: "gasoline" | "diesel" | "hybrid" | "electric" | "other" | null;
  vin: string | null;
  engine_no: string | null;
  last_odometer: number | null;
  notes: string | null;
  is_active: boolean;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  owned_since: string | null;
};

export async function listCustomers(): Promise<Customer[]> {
  const s = await createClient();
  const rows = must<Customer[]>(await s.from("customers").select(CUSTOMER_COLUMNS).order("name"), "pelanggan");
  return rows.map((c) => ({ ...c, credit_limit: Number(c.credit_limit) }));
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const s = await createClient();
  const c = must<Customer | null>(await s.from("customers").select(CUSTOMER_COLUMNS).eq("id", id).maybeSingle(), "pelanggan");
  return c ? { ...c, credit_limit: Number(c.credit_limit) } : null;
}

export async function listVehicles(): Promise<Vehicle[]> {
  const s = await createClient();
  return must<Vehicle[]>(await s.from("v_vehicles").select("*").order("plate_key"), "kendaraan");
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const s = await createClient();
  return must<Vehicle | null>(await s.from("v_vehicles").select("*").eq("id", id).maybeSingle(), "kendaraan");
}

export type Ownership = { id: string; vehicle_id: string; customer_id: string; customer_name: string; plate_no: string; started_at: string; ended_at: string | null; note: string | null };

/** Riwayat kepemilikan untuk satu kendaraan atau satu pelanggan */
export async function listOwnerships(filter: { vehicleId?: string; customerId?: string }): Promise<Ownership[]> {
  const s = await createClient();
  let q = s
    .from("vehicle_ownerships")
    .select("id, vehicle_id, customer_id, started_at, ended_at, note, customers(name), vehicles(plate_no)")
    .order("started_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (filter.vehicleId) q = q.eq("vehicle_id", filter.vehicleId);
  if (filter.customerId) q = q.eq("customer_id", filter.customerId);
  type Row = Omit<Ownership, "customer_name" | "plate_no"> & { customers: { name: string }; vehicles: { plate_no: string } };
  return must<Row[]>(await q, "riwayat pemilik").map(({ customers, vehicles, ...o }) => ({ ...o, customer_name: customers.name, plate_no: vehicles.plate_no }));
}

/** Saran merek & model untuk isian teks (datalist) */
export async function listVehicleModels(): Promise<{ make: string; model: string }[]> {
  const s = await createClient();
  type Row = { name: string; vehicle_makes: { name: string } };
  const rows = must<Row[]>(await s.from("vehicle_models").select("name, vehicle_makes(name)").order("name"), "model kendaraan");
  return rows.map((r) => ({ make: r.vehicle_makes.name, model: r.name }));
}
