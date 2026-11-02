import { Wrench } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-10">
      <div className="mb-6 flex items-center gap-2 text-zinc-900">
        <span className="flex size-9 items-center justify-center rounded-lg bg-zinc-900 text-white">
          <Wrench className="size-5" />
        </span>
        <span className="text-lg font-semibold tracking-tight">Bengkel Mobil App</span>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
