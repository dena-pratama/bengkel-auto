"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError as toDbError, done, invalid, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import {
  customerSchema,
  transferSchema,
  vehicleSchema,
  type CustomerInput,
  type TransferInput,
  type VehicleInput,
} from "@/lib/validation/customer";

const dbError = (error: Parameters<typeof toDbError>[0]) => toDbError(error, "pelanggan");
const refresh = () => revalidatePath("/pelanggan", "layout");
const isUuid = (v: string) => z.uuid().safeParse(v).success;

export async function saveCustomerAction(id: string | null, input: CustomerInput): Promise<ActionResult<{ id: string }>> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_customer", { p_id: id, p_data: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done({ id: data as string });
}

export async function setCustomerActiveAction(id: string, active: boolean): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Data tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_customer_active", { p_id: id, p_active: active });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function saveVehicleAction(id: string | null, input: VehicleInput): Promise<ActionResult<{ id: string }>> {
  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const { owner_id, ...data } = parsed.data;
  if (!id && !isUuid(owner_id)) return { ok: false, error: "Pilih pemilik kendaraan." };
  const supabase = await createClient();
  const { data: vehicleId, error } = await supabase.rpc("save_vehicle", { p_id: id, p_data: data, p_owner_id: id ? null : owner_id });
  if (error) return dbError(error);
  refresh();
  return done({ id: vehicleId as string });
}

export async function transferVehicleAction(vehicleId: string, input: TransferInput): Promise<ActionResult> {
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(vehicleId)) return { ok: false, error: "Data tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_vehicle", {
    p_vehicle_id: vehicleId,
    p_customer_id: parsed.data.customer_id,
    p_date: parsed.data.date || null,
    p_note: parsed.data.note || null,
  });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function setVehicleActiveAction(id: string, active: boolean): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, error: "Data tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_vehicle_active", { p_id: id, p_active: active });
  if (error) return dbError(error);
  refresh();
  return done();
}
