"use client";

import { Car, ChevronRight, Plus, QrCode, ReceiptText } from "lucide-react";
import type { Customer } from "@/lib/customers";
import type { CatalogOption, VehicleOption } from "@/lib/service";
import { cn } from "@/lib/utils";
import { NewVehicleDialog } from "../../pelanggan/_components/dialogs";
import { NewEstimateDialog } from "../../servis/_components/dialogs";
import { SaleDialog } from "../../kasir/_components/sale-dialog";
import { CheckStockDialog } from "../../inventory/_components/check-stock-dialog";

export function NewWorkOrderButton({
  vehicles,
  catalog,
  validUntil,
}: {
  vehicles: VehicleOption[];
  catalog: CatalogOption[];
  validUntil: string;
}) {
  return (
    <NewEstimateDialog
      vehicles={vehicles}
      catalog={catalog}
      validUntil={validUntil}
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" /> Work order
        </button>
      )}
    />
  );
}

export function QuickActions({
  canCreateWO,
  canCreateVehicle,
  canCreateSale,
  canViewStock,
  vehicles,
  catalog,
  customers,
  models,
  shiftOpen,
  validUntil,
}: {
  canCreateWO: boolean;
  canCreateVehicle: boolean;
  canCreateSale: boolean;
  canViewStock: boolean;
  vehicles: VehicleOption[];
  catalog: CatalogOption[];
  customers: Pick<Customer, "id" | "name" | "phone" | "is_active">[];
  models: { make: string; model: string }[];
  shiftOpen: boolean;
  validUntil: string;
}) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {/* 1. Work order baru */}
      {canCreateWO && (
        <NewEstimateDialog
          vehicles={vehicles}
          catalog={catalog}
          validUntil={validUntil}
          trigger={(open) => (
            <button
              type="button"
              onClick={open}
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors",
                "border-dashed border-brand-blue/60 bg-brand-blue-soft/40 hover:border-brand-blue",
              )}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-rail text-white">
                <Plus className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">Work order baru</span>
                <span className="block truncate text-xs text-muted-foreground">Mulai dari estimasi</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
        />
      )}

      {/* 2. Check-in kendaraan (Penerimaan Kendaraan Masuk) */}
      {canCreateVehicle && (
        <NewVehicleDialog
          customers={customers}
          models={models}
          trigger={(open) => (
            <button
              type="button"
              onClick={open}
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-brand-blue/60",
              )}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue-soft text-brand-blue-fg">
                <Car className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">Check-in kendaraan</span>
                <span className="block truncate text-xs text-muted-foreground">Registrasi kendaraan & pemilik</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
        />
      )}

      {/* 3. Kasir cepat */}
      {canCreateSale && (
        <SaleDialog
          catalog={catalog}
          customers={customers}
          shiftOpen={shiftOpen}
          trigger={(open) => (
            <button
              type="button"
              onClick={open}
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-brand-blue/60",
              )}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue-soft text-brand-blue-fg">
                <ReceiptText className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">Kasir cepat</span>
                <span className="block truncate text-xs text-muted-foreground">Jual part dan terima bayar</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
        />
      )}

      {/* 4. Cek stok */}
      {canViewStock && (
        <CheckStockDialog
          trigger={(open) => (
            <button
              type="button"
              onClick={open}
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-brand-blue/60",
              )}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue-soft text-brand-blue-fg">
                <QrCode className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">Cek stok</span>
                <span className="block truncate text-xs text-muted-foreground">Scan QR barang dan rak</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
        />
      )}
    </section>
  );
}
