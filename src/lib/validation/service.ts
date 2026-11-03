import { z } from "zod";
import { toNumber } from "./common";

const text = (max: number) => z.string().trim().max(max, `Maksimal ${max} karakter`);
const optionalDate = z.string().refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Tanggal tidak valid");
const money = (label: string) =>
  z.preprocess(toNumber, z.number({ error: `${label} harus angka` }).min(0, `${label} tidak boleh minus`).max(9_999_999_999_999, `${label} terlalu besar`));
const odometer = z
  .string()
  .trim()
  .refine((v) => v === "" || (Number.isInteger(toNumber(v)) && toNumber(v) >= 0 && toNumber(v) <= 9_999_999), "Kilometer harus angka bulat 0-9.999.999");

export const CHANNELS = ["in_person", "phone", "chat"] as const;
export type ApprovalChannel = (typeof CHANNELS)[number];
export const CHANNEL_LABEL: Record<ApprovalChannel, string> = {
  in_person: "Langsung di bengkel",
  phone: "Lewat telepon",
  chat: "Lewat chat/WhatsApp",
};

// Baris estimasi: jasa, part, atau paket (dipecah per komponen di database)
export const lineSchema = z.object({
  type: z.enum(["service", "part", "package"]),
  ref_id: z.uuid("Pilih jasa/part"),
  qty: z.preprocess(toNumber, z.number({ error: "Jumlah harus angka" }).gt(0, "Jumlah harus lebih dari 0").max(99_999, "Jumlah terlalu besar")),
  discount_amount: money("Diskon"),
});
export type LineInput = z.input<typeof lineSchema>;

const approvalFields = {
  approved: z.boolean(),
  approval_channel: z.string(),
  approval_note: text(300),
};
const approvalRefine = <T extends { approved: boolean; approval_channel: string }>(v: T) => !v.approved || (CHANNELS as readonly string[]).includes(v.approval_channel);

export const estimateSchema = z
  .object({
    vehicle_id: z.uuid("Pilih kendaraan"),
    odometer,
    complaint: text(500),
    valid_until: optionalDate,
    discount_amount: money("Diskon"),
    notes: text(500),
    lines: z.array(lineSchema).min(1, "Tambahkan minimal satu jasa, part, atau paket"),
    ...approvalFields,
    make_work_order: z.boolean(),
  })
  .refine(approvalRefine, { path: ["approval_channel"], message: "Pilih cara persetujuan pelanggan" });
export type EstimateInput = z.input<typeof estimateSchema>;

export const additionalWorkSchema = z
  .object({
    complaint: text(500),
    discount_amount: money("Diskon"),
    notes: text(500),
    lines: z.array(lineSchema).min(1, "Tambahkan minimal satu jasa, part, atau paket"),
    ...approvalFields,
  })
  .refine(approvalRefine, { path: ["approval_channel"], message: "Pilih cara persetujuan pelanggan" });
export type AdditionalWorkInput = z.input<typeof additionalWorkSchema>;

export const approveSchema = z.object({
  channel: z.enum(CHANNELS, { error: "Pilih cara persetujuan pelanggan" }),
  note: text(300),
  make_work_order: z.boolean(),
});
export type ApproveInput = z.input<typeof approveSchema>;

export const workOrderInfoSchema = z.object({
  estimated_done_at: z.string().refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Waktu tidak valid"),
  odometer_in: odometer,
  notes: text(500),
});
export type WorkOrderInfoInput = z.input<typeof workOrderInfoSchema>;

export const partMoveSchema = z.object({
  qty: z.preprocess(toNumber, z.number({ error: "Jumlah harus angka" }).gt(0, "Jumlah harus lebih dari 0")),
  location_id: z.uuid("Pilih lokasi rak"),
  note: text(200),
});
export type PartMoveInput = z.input<typeof partMoveSchema>;

export const warrantySchema = z.object({
  complaint: z.string().trim().min(3, "Keluhan klaim wajib diisi").max(500),
  odometer,
  item_ids: z.array(z.uuid()).min(1, "Pilih jasa/part yang diklaim"),
});
export type WarrantyInput = z.input<typeof warrantySchema>;

export const reasonSchema = z.string().trim().min(3, "Alasan wajib diisi").max(300);

export const WO_STATUSES = ["queued", "in_progress", "waiting_parts", "waiting_approval", "quality_check", "ready", "delivered", "void"] as const;
export type WorkOrderStatus = (typeof WO_STATUSES)[number];
export const WO_STATUS_LABEL: Record<WorkOrderStatus, string> = {
  queued: "Antri",
  in_progress: "Dikerjakan",
  waiting_parts: "Menunggu Part",
  waiting_approval: "Menunggu Persetujuan",
  quality_check: "Selesai / QC",
  ready: "Siap Diambil",
  delivered: "Diambil",
  void: "Dibatalkan",
};
/** Kolom papan status (urut PRD §7.3); Diambil & Dibatalkan tampil di daftar riwayat */
export const BOARD_STATUSES: WorkOrderStatus[] = ["queued", "in_progress", "waiting_parts", "waiting_approval", "quality_check", "ready"];

/** Transisi yang boleh dari papan (sama dengan aturan di database) */
export const NEXT_STATUS: Partial<Record<WorkOrderStatus, WorkOrderStatus[]>> = {
  queued: ["in_progress"],
  in_progress: ["waiting_parts", "quality_check", "queued"],
  waiting_parts: ["in_progress"],
  quality_check: ["ready", "in_progress"],
  ready: ["delivered", "quality_check"],
};

export const ESTIMATE_STATUSES = ["draft", "sent", "approved", "rejected", "revised", "converted", "void"] as const;
export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];
export const ESTIMATE_STATUS_LABEL: Record<EstimateStatus, string> = {
  draft: "Draft",
  sent: "Terkirim",
  approved: "Disetujui",
  rejected: "Ditolak",
  revised: "Direvisi",
  converted: "Jadi WO",
  void: "Dibatalkan",
};
