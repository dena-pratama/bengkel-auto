import { cn } from "@/lib/utils";

// Tachometer dekoratif untuk halaman login (sesuai Figma "login UI anima"):
// sapuan 270 derajat dari kiri bawah (0) ke kanan bawah (8), nilai 0 sampai 8 x1000 r/min.
const CX = 150;
const CY = 150;
const R_ARC = 145;
const START_DEG = -135;
const SWEEP = 270;
const MAX = 8;
const ARC_LEN = (R_ARC * Math.PI * SWEEP) / 180;

const rad = (deg: number) => (deg * Math.PI) / 180;
const polar = (r: number, deg: number) => ({ x: CX + r * Math.sin(rad(deg)), y: CY - r * Math.cos(rad(deg)) });
const degFor = (v: number) => START_DEG + (v / MAX) * SWEEP;

const ARC_START = polar(R_ARC, START_DEG);
const ARC_END = polar(R_ARC, START_DEG + SWEEP);
const ARC_PATH = `M ${ARC_START.x.toFixed(2)} ${ARC_START.y.toFixed(2)} A ${R_ARC} ${R_ARC} 0 1 1 ${ARC_END.x.toFixed(2)} ${ARC_END.y.toFixed(2)}`;
const TICKS = Array.from({ length: MAX + 1 }, (_, i) => i);

export function Tachometer({ value, className }: { value: number; className?: string }) {
  const v = Math.min(MAX, Math.max(0, value));
  const on = v > 0.05;
  const lit = (v / MAX) * ARC_LEN;
  return (
    <svg viewBox="0 0 300 270" role="img" aria-label={`Tachometer ${v.toFixed(1)} x1000 r/min`} className={cn("block h-auto w-full overflow-visible select-none", className)}>
      <defs>
        <linearGradient id="tacho-arc" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="300" y2="0">
          <stop offset="0.1" stopColor="#2b6fdc" />
          <stop offset="0.55" stopColor="#8b4a9c" />
          <stop offset="0.9" stopColor="#e0262b" />
        </linearGradient>
        <linearGradient id="tacho-needle" gradientUnits="userSpaceOnUse" x1="150" y1="150" x2="150" y2="42">
          <stop offset="0" stopColor="#e0262b" />
          <stop offset="1" stopColor="#ff5a3d" />
        </linearGradient>
        <filter id="tacho-glow" filterUnits="userSpaceOnUse" x="-60" y="-60" width="420" height="420">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      {/* Jalur dan busur menyala */}
      <path d={ARC_PATH} fill="none" strokeWidth={10} className="stroke-[#e2e8f0] dark:stroke-[#1a2130]" />
      {on && (
        <path
          d={ARC_PATH}
          fill="none"
          stroke="#e0262b"
          strokeWidth={10}
          strokeDasharray={`${lit.toFixed(2)} ${ARC_LEN.toFixed(2)}`}
          opacity={Math.min(0.5, v / 12)}
          filter="url(#tacho-glow)"
        />
      )}
      {on && (
        <path
          d={ARC_PATH}
          fill="none"
          stroke="url(#tacho-arc)"
          strokeWidth={10}
          strokeDasharray={`${lit.toFixed(2)} ${ARC_LEN.toFixed(2)}`}
        />
      )}

      {/* Garis skala dan angka */}
      {TICKS.map((i) => {
        const deg = degFor(i);
        const a = polar(133, deg);
        const b = polar(121, deg);
        const l = polar(104, deg);
        const red = i >= 7;
        return (
          <g key={i}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={2} strokeLinecap="round" className={red ? "stroke-[#e0262b]" : "stroke-[#94a3b8] dark:stroke-[#64748b]"} />
            <text x={l.x} y={l.y} textAnchor="middle" dominantBaseline="central" fontSize={12.5} className={red ? "fill-[#e0262b]" : "fill-[#94a3b8] dark:fill-[#64748b]"}>
              {i}
            </text>
          </g>
        );
      })}

      {/* Angka dan satuan */}
      <text x={CX} y={222} textAnchor="middle" dominantBaseline="central" fontSize={46} fontWeight={700} className={cn("tabular-nums transition-colors duration-300", on ? "fill-foreground" : "fill-[#cbd5e1] dark:fill-[#2a3345]")}>
        {v.toFixed(1)}
      </text>
      <text x={CX} y={253} textAnchor="middle" dominantBaseline="central" fontSize={11.5} letterSpacing={0.6} className="fill-muted-foreground">
        x1000 r/min
      </text>

      {/* Jarum dan poros */}
      <g transform={`rotate(${degFor(v).toFixed(2)} ${CX} ${CY})`}>
        <line x1={CX} y1={CY} x2={CX} y2={CY - 108} stroke="url(#tacho-needle)" strokeWidth={4} strokeLinecap="round" />
      </g>
      <circle cx={CX} cy={CY} r={9} strokeWidth={3} className="fill-card stroke-[#e0262b]" />
    </svg>
  );
}
