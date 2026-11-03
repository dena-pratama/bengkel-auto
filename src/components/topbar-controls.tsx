"use client";

import { useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Moon, Settings, Sun, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { cn } from "@/lib/utils";

const THEME_EVENT = "bk-theme-change";

// Tema = class `dark` di <html> (dipasang skrip di root layout sebelum render, agar tidak berkedip)
export function subscribeTheme(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
export const readIsDark = () => document.documentElement.classList.contains("dark");

function setTheme(dark: boolean) {
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  try {
    localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
  } catch {}
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Tombol mode terang/gelap. */
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeTheme, readIsDark, () => false);
  const label = dark ? "Mode terang" : "Mode gelap";
  return (
    <button
      type="button"
      onClick={() => setTheme(!dark)}
      aria-label={label}
      aria-pressed={dark}
      title={label}
      className="relative flex h-9 w-16 shrink-0 items-center rounded-full border border-border bg-card p-1 shadow-sm transition-colors hover:border-brand-blue/60"
    >
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-full shadow-sm transition-[translate,background-color] duration-300",
          dark ? "translate-x-7 bg-brand-blue-ink text-white" : "translate-x-0 bg-brand-red text-white",
        )}
      >
        {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </span>
    </button>
  );
}

/** Chip profil dengan menu: profil, pengaturan, keluar. */
export function ProfileMenu({
  employeeId,
  name,
  role,
  branch,
  initials,
  logout,
}: {
  employeeId: string;
  name: string;
  role: string;
  branch: string;
  initials: string;
  logout: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="ml-1 flex items-center gap-2.5 rounded-xl border border-border bg-card py-1 pr-2 pl-1 shadow-sm transition-colors outline-none hover:border-brand-blue/60 focus-visible:ring-2 focus-visible:ring-ring data-popup-open:border-brand-blue/60"
        aria-label={`Menu profil ${name}`}
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-blue-soft text-xs font-semibold text-brand-blue-fg">
          {initials}
        </span>
        <span className="hidden text-left leading-tight lg:block">
          <span className="block text-sm font-medium">{name}</span>
          <span className="block text-2xs text-muted-foreground">{role}</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-60 rounded-2xl p-1.5">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-blue-soft text-sm font-semibold text-brand-blue-fg">
            {initials}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {role} · {branch}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="rounded-lg px-2 py-2" render={<Link href={`/karyawan/${employeeId}`} />}>
          <UserRound /> Profil saya
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="rounded-lg px-2 py-2">
          <Settings /> Pengaturan
          <span className="ml-auto text-2xs text-muted-foreground">Segera</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="rounded-lg px-2 py-2"
          disabled={pending}
          closeOnClick={false}
          onClick={() => startTransition(() => logout())}
        >
          <LogOut /> {pending ? "Keluar..." : "Keluar"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
