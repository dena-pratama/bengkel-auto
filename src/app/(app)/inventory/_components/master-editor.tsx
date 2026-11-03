"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/form-field";
import { inputClass, panel } from "@/components/page-kit";
import { cn } from "@/lib/utils";
import { saveMasterAction, setActiveAction, type MasterKind } from "../actions";

export type MasterField = {
  name: string;
  label: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  className?: string;
};
export type MasterRow = { id: string; label: string; sub?: string; depth?: number; is_active: boolean; values: Record<string, string> };

type Table = "item_categories" | "brands" | "units" | "locations" | "service_categories";

function Fields({ fields, values, onChange, idPrefix }: { fields: MasterField[]; values: Record<string, string>; onChange: (v: Record<string, string>) => void; idPrefix: string }) {
  return (
    <>
      {fields.map((f) =>
        f.options ? (
          <select
            key={f.name}
            aria-label={f.label}
            id={`${idPrefix}-${f.name}`}
            value={values[f.name] ?? ""}
            onChange={(e) => onChange({ ...values, [f.name]: e.target.value })}
            className={cn(inputClass, "h-9", f.className)}
          >
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            key={f.name}
            aria-label={f.label}
            id={`${idPrefix}-${f.name}`}
            value={values[f.name] ?? ""}
            placeholder={f.placeholder ?? f.label}
            onChange={(e) => onChange({ ...values, [f.name]: e.target.value })}
            className={cn(inputClass, "h-9", f.className)}
          />
        ),
      )}
    </>
  );
}

/** Daftar master kecil: tambah, ubah di baris, aktif/nonaktif. Validasi & izin di server + database. */
export function MasterEditor({
  kind,
  table,
  title,
  description,
  fields,
  rows,
  emptyValues,
  canCreate,
  canUpdate,
}: {
  kind: MasterKind;
  table: Table;
  title: string;
  description?: string;
  fields: MasterField[];
  rows: MasterRow[];
  emptyValues: Record<string, string>;
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [editing, setEditing] = useState<{ id: string; values: Record<string, string> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (id: string | null, values: Record<string, string>, after: () => void) => {
    setError(null);
    startTransition(async () => {
      const r = await saveMasterAction(kind, id, values);
      if (!r.ok) return setError(r.error);
      after();
      router.refresh();
    });
  };
  const toggle = (row: MasterRow) =>
    startTransition(async () => {
      const r = await setActiveAction(table, row.id, !row.is_active);
      if (!r.ok) setError(r.error);
      router.refresh();
    });

  return (
    <section className={cn(panel, "grid content-start gap-3")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {canCreate && !draft && (
          <Button type="button" variant="outline" size="sm" onClick={() => setDraft(emptyValues)}>
            <Plus className="size-4" /> Tambah
          </Button>
        )}
      </div>

      {draft && (
        <form
          className="flex flex-wrap items-center gap-2 rounded-sm border border-brand-blue/60 bg-brand-blue-soft/40 p-2"
          onSubmit={(e) => {
            e.preventDefault();
            save(null, draft, () => setDraft(null));
          }}
        >
          <Fields fields={fields} values={draft} onChange={setDraft} idPrefix={`${kind}-new`} />
          <div className="flex gap-1">
            <Button type="submit" size="sm" disabled={pending}>
              Simpan
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)}>
              Batal
            </Button>
          </div>
        </form>
      )}
      <FormError message={error} />

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada data.</p>
      ) : (
        <ul className="grid divide-y divide-border">
          {rows.map((row) =>
            editing?.id === row.id ? (
              <li key={row.id} className="py-2">
                <form
                  className="flex flex-wrap items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    save(row.id, editing.values, () => setEditing(null));
                  }}
                >
                  <Fields fields={fields} values={editing.values} onChange={(values) => setEditing({ id: row.id, values })} idPrefix={`${kind}-${row.id}`} />
                  <Button type="submit" size="icon" variant="ghost" aria-label="Simpan" disabled={pending}>
                    <Check className="size-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" aria-label="Batal" onClick={() => setEditing(null)}>
                    <X className="size-4" />
                  </Button>
                </form>
              </li>
            ) : (
              <li key={row.id} className={cn("flex items-center gap-2 py-2", !row.is_active && "opacity-60")} style={{ paddingLeft: `${(row.depth ?? 0) * 20}px` }}>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-medium", !row.is_active && "line-through")}>{row.label}</p>
                  {row.sub && <p className="truncate text-xs text-muted-foreground">{row.sub}</p>}
                </div>
                {canUpdate && (
                  <>
                    <Button type="button" size="icon" variant="ghost" aria-label={`Ubah ${row.label}`} onClick={() => setEditing({ id: row.id, values: row.values })}>
                      <Pencil className="size-4" />
                    </Button>
                    <button
                      type="button"
                      onClick={() => toggle(row)}
                      disabled={pending}
                      className="rounded-sm px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {row.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  </>
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
