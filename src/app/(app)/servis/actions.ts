"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError as toDbError, done, invalid, type ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import {
  WO_STATUSES,
  additionalWorkSchema,
  approveSchema,
  estimateSchema,
  partMoveSchema,
  reasonSchema,
  warrantySchema,
  workOrderInfoSchema,
  type AdditionalWorkInput,
  type ApproveInput,
  type EstimateInput,
  type LineInput,
  type PartMoveInput,
  type WarrantyInput,
  type WorkOrderInfoInput,
  type WorkOrderStatus,
} from "@/lib/validation/service";
import { toNumber } from "@/lib/validation/common";

const dbError = (error: Parameters<typeof toDbError>[0]) => toDbError(error, "servis");
const refresh = () => {
  revalidatePath("/servis", "layout");
  revalidatePath("/pelanggan", "layout");
};
const isUuid = (v: string) => z.uuid().safeParse(v).success;
const bad = { ok: false as const, error: "Data tidak valid." };

/** Baris form -> format p_items fungsi database */
const toItems = (lines: { type: LineInput["type"]; ref_id: string; qty: number; discount_amount: number }[]) =>
  lines.map((l) => ({
    type: l.type,
    [l.type === "service" ? "service_id" : l.type === "part" ? "item_id" : "package_id"]: l.ref_id,
    qty: l.qty,
    discount_amount: l.discount_amount,
  }));

/** Wall-clock WIB dari input datetime-local -> timestamptz */
const wib = (v: string) => (v ? `${v}:00+07:00` : "");

// ---------------------------------------------------------------------------- Estimasi

/** Simpan estimasi (baru / revisi). Jika pelanggan sudah setuju: catat persetujuan dan (opsional) langsung jadi WO. */
export async function saveEstimateAction(
  id: string | null,
  input: EstimateInput,
): Promise<ActionResult<{ id: string; workOrderId: string | null; warning?: string }>> {
  const parsed = estimateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (id && !isUuid(id)) return bad;
  const v = parsed.data;
  const supabase = await createClient();
  const { data: estimateId, error } = await supabase.rpc("save_estimate", {
    p_id: id,
    p_data: {
      vehicle_id: v.vehicle_id,
      odometer: v.odometer === "" ? "" : toNumber(v.odometer),
      complaint: v.complaint,
      valid_until: v.valid_until,
      discount_amount: v.discount_amount,
      notes: v.notes,
    },
    p_items: toItems(v.lines),
  });
  if (error) return dbError(error);
  refresh();
  if (!v.approved) return done({ id: estimateId as string, workOrderId: null });

  // Persetujuan dicatat terpisah: jika gagal, estimasi tetap tersimpan sebagai draft
  const { data: woId, error: approveError } = await supabase.rpc("approve_estimate", {
    p_id: estimateId,
    p_channel: v.approval_channel,
    p_note: v.approval_note || null,
    p_wo_data: v.make_work_order ? {} : null,
  });
  if (approveError) return done({ id: estimateId as string, workOrderId: null, warning: `Estimasi tersimpan, tetapi persetujuan gagal: ${dbError(approveError).error}` });
  return done({ id: estimateId as string, workOrderId: (woId as string | null) ?? null });
}

export async function markEstimateSentAction(id: string): Promise<ActionResult> {
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_estimate_sent", { p_id: id });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function approveEstimateAction(id: string, input: ApproveInput): Promise<ActionResult<{ workOrderId: string | null }>> {
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approve_estimate", {
    p_id: id,
    p_channel: parsed.data.channel,
    p_note: parsed.data.note || null,
    p_wo_data: parsed.data.make_work_order ? {} : null,
  });
  if (error) return dbError(error);
  refresh();
  return done({ workOrderId: (data as string | null) ?? null });
}

export async function convertEstimateAction(id: string): Promise<ActionResult<{ workOrderId: string }>> {
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_estimate_to_work_order", { p_id: id, p_data: {} });
  if (error) return dbError(error);
  refresh();
  return done({ workOrderId: data as string });
}

export async function rejectEstimateAction(id: string, note: string): Promise<ActionResult> {
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_estimate", { p_id: id, p_note: note.trim() || null });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function voidEstimateAction(id: string, reason: string): Promise<ActionResult> {
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_estimate", { p_id: id, p_reason: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done();
}

// ---------------------------------------------------------------------------- Work order

export async function addWorkAction(workOrderId: string, input: AdditionalWorkInput): Promise<ActionResult<{ id: string }>> {
  const parsed = additionalWorkSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(workOrderId)) return bad;
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_work_order_work", {
    p_id: workOrderId,
    p_items: toItems(v.lines),
    p_data: { complaint: v.complaint, discount_amount: v.discount_amount, notes: v.notes },
    p_approval: v.approved ? { channel: v.approval_channel, note: v.approval_note } : null,
  });
  if (error) return dbError(error);
  refresh();
  return done({ id: data as string });
}

export async function updateWorkOrderAction(id: string, input: WorkOrderInfoInput): Promise<ActionResult> {
  const parsed = workOrderInfoSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(id)) return bad;
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_work_order", {
    p_id: id,
    p_data: { estimated_done_at: wib(v.estimated_done_at), odometer_in: v.odometer_in === "" ? "" : toNumber(v.odometer_in), notes: v.notes },
  });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function setWorkOrderStatusAction(id: string, status: WorkOrderStatus, note?: string): Promise<ActionResult> {
  if (!isUuid(id) || !(WO_STATUSES as readonly string[]).includes(status)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_work_order_status", { p_id: id, p_status: status, p_note: note?.trim() || null });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function voidWorkOrderAction(id: string, reason: string): Promise<ActionResult> {
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(id)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_work_order", { p_id: id, p_reason: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function cancelLineAction(itemId: string, reason: string): Promise<ActionResult> {
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(itemId)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_work_order_item", { p_item_id: itemId, p_reason: parsed.data });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function setMechanicsAction(itemId: string, assignments: { employee_id: string; share_percent: string }[]): Promise<ActionResult> {
  if (!isUuid(itemId) || assignments.some((a) => !isUuid(a.employee_id))) return bad;
  const custom = assignments.some((a) => a.share_percent.trim() !== "");
  if (custom && assignments.some((a) => !(toNumber(a.share_percent) > 0))) return { ok: false, error: "Isi porsi (%) semua mekanik, atau kosongkan semua untuk dibagi rata." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_work_order_mechanics", {
    p_item_id: itemId,
    p_assignments: assignments.map((a) => ({ employee_id: a.employee_id, share_percent: custom ? toNumber(a.share_percent) : null })),
  });
  if (error) return dbError(error);
  refresh();
  return done();
}

// ---------------------------------------------------------------------------- Part

export async function requestPartAction(itemId: string): Promise<ActionResult> {
  if (!isUuid(itemId)) return bad;
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_work_order_part", { p_item_id: itemId });
  if (error) return dbError(error);
  refresh();
  return done();
}

export async function movePartAction(itemId: string, kind: "issue" | "return", input: PartMoveInput): Promise<ActionResult> {
  const parsed = partMoveSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(itemId)) return bad;
  const supabase = await createClient();
  const args = { p_item_id: itemId, p_qty: parsed.data.qty, p_location_id: parsed.data.location_id, p_note: parsed.data.note || null };
  const { error } = kind === "issue" ? await supabase.rpc("issue_work_order_part", { ...args, p_scanned: parsed.data.scanned === true }) : await supabase.rpc("return_work_order_part", args);
  if (error) return dbError(error);
  refresh();
  revalidatePath("/inventory", "layout");
  return done();
}

// ---------------------------------------------------------------------------- Garansi

export async function createWarrantyAction(sourceId: string, input: WarrantyInput): Promise<ActionResult<{ id: string }>> {
  const parsed = warrantySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!isUuid(sourceId)) return bad;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_warranty_work_order", {
    p_source_id: sourceId,
    p_item_ids: parsed.data.item_ids,
    p_data: { complaint: parsed.data.complaint, odometer: parsed.data.odometer === "" ? "" : toNumber(parsed.data.odometer) },
  });
  if (error) return dbError(error);
  refresh();
  return done({ id: data as string });
}
