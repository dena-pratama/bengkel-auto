import Image from "next/image";

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-6">
        <span className="sr-only">AutoMobi</span>
        {/* Varian gelap: navy & biru dicerahkan agar terbaca di latar gelap */}
        <Image src="/brand/automobi-logo.png" alt="" width={671} height={335} className="h-auto w-52 dark:hidden" priority />
        <Image src="/brand/automobi-logo-dark.png" alt="" width={671} height={335} className="hidden h-auto w-52 dark:block" priority />
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
