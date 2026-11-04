import { z } from "zod";
import { toNumber } from "./common";

const optionalInt = (label: string, max: number) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || (Number.isInteger(toNumber(v)) && toNumber(v) >= 1 && toNumber(v) <= max), `${label} harus bilangan bulat 1-${max.toLocaleString("id-ID")}`);

export const ruleSchema = z
  .object({
    service_id: z.uuid("Pilih jasa"),
    interval_km: optionalInt("Jarak tempuh", 200_000),
    interval_months: optionalInt("Jarak waktu", 60),
    is_active: z.boolean(),
  })
  .refine((v) => v.interval_km !== "" || v.interval_months !== "", { message: "Isi jarak tempuh (km) atau jarak waktu (bulan), atau keduanya", path: ["interval_km"] });
export type RuleInput = z.input<typeof ruleSchema>;

export const markSchema = z.object({
  vehicle_id: z.uuid(),
  rule_id: z.uuid(),
  wo_id: z.uuid(),
  status: z.enum(["contacted", "dismissed"]),
});
export type MarkInput = z.input<typeof markSchema>;
