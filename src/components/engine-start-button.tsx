import { cn } from "@/lib/utils";

/**
 * Tombol bulat ENGINE START STOP (Figma "login UI anima"). Ukuran dalam px; huruf ikut skala.
 * Tanpa `onClick` tampil sebagai indikator dekoratif.
 */
export function EngineStartButton({
  size,
  lit,
  onClick,
  autoFocus,
  label = "Start mesin untuk masuk",
  id,
  className,
}: {
  size: number;
  lit: boolean;
  onClick?: () => void;
  autoFocus?: boolean;
  label?: string;
  id?: string;
  className?: string;
}) {
  const body = (
    <>
      {/* Bezel logam */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full bg-gradient-to-b transition-shadow duration-500",
          "from-white to-[#c5cdd9] shadow-[0_0.9em_1.6em_-0.5em_rgb(30_41_59/0.38),inset_0_0.1em_0.15em_rgb(255_255_255/0.9)]",
          "dark:from-[#4d5767] dark:to-[#161b24] dark:shadow-[0_0.9em_1.6em_-0.5em_rgb(0_0_0/0.8),inset_0_0.1em_0.15em_rgb(255_255_255/0.18)]",
          lit && "shadow-[0_0_2.6em_0.2em_rgb(224_38_43/0.45),0_0.6em_1.2em_-0.4em_rgb(30_41_59/0.3)] dark:shadow-[0_0_2.6em_0.2em_rgb(224_38_43/0.5),0_0.6em_1.2em_-0.4em_rgb(0_0_0/0.8)]",
        )}
      />
      {/* Muka tombol */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-[7.5%] rounded-full border-[0.1em] bg-gradient-to-b transition-colors duration-500",
          "from-[#f4f6fa] to-[#dbe1ea]",
          "dark:from-[#1c222c] dark:to-[#0d1117]",
          lit ? "border-[#e0262b]" : "border-[#bcc5d3] dark:border-[#2d3543]",
        )}
      />
      <span className="relative flex h-full flex-col items-center justify-center text-center leading-none">
        <span aria-hidden className={cn("mb-[0.7em] size-[0.35em] rounded-full transition-colors duration-500", lit ? "bg-[#e0262b] shadow-[0_0_0.6em_0.15em_rgb(224_38_43/0.8)]" : "bg-[#aab3c2] dark:bg-[#3a4352]")} />
        <span className={cn("text-[0.95em] font-semibold tracking-[0.22em] transition-colors duration-500", lit ? "text-[#e0262b]" : "text-[#64748b] dark:text-[#6b7686]")}>ENGINE</span>
        <span className="my-[0.35em] text-[2.4em] font-bold tracking-wide text-[#1f2937] dark:text-[#e8ecf2]">START</span>
        <span className={cn("text-[0.9em] font-semibold tracking-[0.22em] transition-colors duration-500", lit ? "text-[#e0262b]" : "text-[#64748b] dark:text-[#6b7686]")}>STOP</span>
      </span>
    </>
  );

  const style = { width: size, height: size, fontSize: size / 16 };
  if (!onClick) {
    return (
      <span aria-hidden className={cn("pointer-events-none relative inline-block shrink-0 rounded-full", className)} style={style}>
        {body}
      </span>
    );
  }
  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      autoFocus={autoFocus}
      aria-label={label}
      className={cn("relative inline-block shrink-0 rounded-full outline-none transition-transform duration-150 focus-visible:ring-4 focus-visible:ring-brand-blue/40 active:scale-[0.97]", className)}
      style={style}
    >
      {body}
    </button>
  );
}
