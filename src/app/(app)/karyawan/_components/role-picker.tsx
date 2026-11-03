"use client";

import { Crown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type RoleOption = { id: string; name: string; description: string | null; is_superuser: boolean };

/** Pilih satu atau lebih role (PRD §2: satu orang boleh merangkap). */
export function RolePicker({
  roles,
  value,
  onChange,
  canAssignOwner,
  error,
  disabled,
}: {
  roles: RoleOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  canAssignOwner: boolean;
  error?: string;
  disabled?: boolean;
}) {
  const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((v) => v !== id));

  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium">Role</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {roles.map((r) => {
          const locked = r.is_superuser && !canAssignOwner;
          const checked = value.includes(r.id);
          return (
            <label
              key={r.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-sm border p-3 transition-colors",
                checked ? "border-brand-blue bg-brand-blue-soft/60" : "border-border hover:bg-muted/60",
                locked && "cursor-not-allowed opacity-60",
              )}
            >
              <Checkbox
                checked={checked}
                disabled={locked || disabled}
                onCheckedChange={(v) => toggle(r.id, v === true)}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {r.is_superuser && <Crown className="size-3.5 text-brand-red" />}
                  {r.name}
                </span>
                {r.description && <span className="block text-xs text-muted-foreground">{r.description}</span>}
                {locked && <span className="block text-xs text-muted-foreground">Hanya Owner yang bisa memberikan role ini</span>}
              </span>
            </label>
          );
        })}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </fieldset>
  );
}
