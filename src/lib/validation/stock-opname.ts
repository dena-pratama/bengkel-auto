import { z } from "zod";
import { toNumber } from "./common";

const text = (max: number) => z.string().trim().max(max, `Maksimal ${max} karakter`);

export const OPNAME_TYPES = ["full", "location", "category", "cycle_count"] as const;
export type OpnameType = (typeof OPNAME_TYPES)[number];

export const OPNAME_TYPE_LABEL: Record<OpnameType, string> = {
  full: "Menyeluruh (Semua Rak)",
  location: "Parsial per Lokasi Rak",
  category: "Parsial per Kategori",
  cycle_count: "Cycle Count Acak",
};

export const OPNAME_STATUSES = ["draft", "in_progress", "review", "posted", "void"] as const;
export type OpnameStatus = (typeof OPNAME_STATUSES)[number];

export const OPNAME_STATUS_LABEL: Record<OpnameStatus, string> = {
  draft: "Draft",
  in_progress: "Sedang Dihitung",
  review: "Peninjauan Selisih",
  posted: "Selesai (Diposting)",
  void: "Dibatalkan",
};

export const VARIANCE_REASONS = ["damaged", "lost", "input_error", "misplaced", "other"] as const;
export type VarianceReason = (typeof VARIANCE_REASONS)[number];

export const VARIANCE_REASON_LABEL: Record<VarianceReason, string> = {
  damaged: "Barang Rusak",
  lost: "Barang Hilang",
  input_error: "Salah Input Sebelumnya",
  misplaced: "Salah Lokasi Rak",
  other: "Lainnya",
};

export const createStockOpnameSchema = z.object({
  opname_type: z.enum(OPNAME_TYPES, { error: "Pilih jenis opname" }),
  is_blind_count: z.boolean().default(true),
  assigned_to: z.string().optional(),
  notes: text(300),
  location_ids: z.array(z.string()).optional(),
  category_ids: z.array(z.string()).optional(),
  sample_size: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? 20 : toNumber(v)),
    z.number().int().min(1, "Minimal 1 barang").max(500, "Maksimal 500 barang").optional(),
  ),
});
export type CreateStockOpnameInput = z.input<typeof createStockOpnameSchema>;

export const countItemSchema = z.object({
  item_id: z.string().uuid("Item tidak valid"),
  location_id: z.string().uuid("Lokasi tidak valid"),
  physical_qty: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : toNumber(v)),
    z.number().min(0, "Jumlah fisik tidak boleh negatif").nullable().optional(),
  ),
  variance_reason: z.enum(VARIANCE_REASONS).nullable().optional(),
  notes: text(200).optional(),
});
export type CountItemInput = z.input<typeof countItemSchema>;

export const saveCountsSchema = z.object({
  opname_id: z.string().uuid("ID Opname tidak valid"),
  counts: z.array(countItemSchema),
});
export type SaveCountsInput = z.input<typeof saveCountsSchema>;

export const postStockOpnameSchema = z.object({
  opname_id: z.string().uuid("ID Opname tidak valid"),
  pin: text(6).optional(),
  items_reasons: z
    .array(
      z.object({
        id: z.string().uuid(),
        variance_reason: z.enum(VARIANCE_REASONS, { error: "Pilih alasan selisih" }),
        notes: text(200).optional(),
      }),
    )
    .optional(),
});
export type PostStockOpnameInput = z.input<typeof postStockOpnameSchema>;

export const voidStockOpnameSchema = z.object({
  opname_id: z.string().uuid("ID Opname tidak valid"),
  reason: z.string().trim().min(3, "Alasan pembatalan minimal 3 karakter").max(200, "Maksimal 200 karakter"),
});
export type VoidStockOpnameInput = z.input<typeof voidStockOpnameSchema>;
