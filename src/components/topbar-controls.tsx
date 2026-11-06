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
import { UserAvatar } from "@/components/user-avatar";
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
      className="relative flex h-9 w-[66px] shrink-0 items-center gap-0.5 rounded-full border border-border bg-muted p-[3px] transition-colors"
    >
      <span className={cn("absolute top-[3px] left-[3px] size-7 rounded-full bg-card shadow-sm ring-1 ring-border transition-transform duration-200", dark && "translate-x-[30px]")} />
      <span className="relative z-10 flex size-7 items-center justify-center">
        <Sun className={cn("size-[15px]", dark ? "text-muted-foreground" : "text-brand-gold")} />
      </span>
      <span className="relative z-10 flex size-7 items-center justify-center">
        <Moon className={cn("size-[15px]", dark ? "text-brand-blue-fg" : "text-muted-foreground")} />
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
  photoUrl,
  logout,
}: {
  employeeId: string;
  name: string;
  role: string;
  branch: string;
  photoUrl?: string | null;
  logout: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2.5 rounded-full border border-border bg-card py-1 pr-2 pl-1 transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-muted lg:pr-3"
        aria-label={`Menu profil ${name}`}
      >
        <UserAvatar name={name} photoUrl={photoUrl} className="size-8 rounded-full text-xs" />
        <span className="hidden text-left leading-tight lg:block">
          <span className="block text-[13px] font-semibold">{name}</span>
          <span className="block text-2xs text-muted-foreground">{role}</span>
        </span>
        <ChevronDown className="hidden size-4 text-muted-foreground lg:block" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-60 rounded-2xl p-1.5">
        <div className="flex items-center gap-3 px-2 py-2">
          <UserAvatar name={name} photoUrl={photoUrl} className="size-10 rounded-xl text-sm" />
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
        <DropdownMenuItem className="rounded-lg px-2 py-2" render={<Link href="/pengaturan" />}>
          <Settings /> Pengaturan
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
