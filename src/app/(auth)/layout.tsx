// Pembungkus halaman auth: tiap halaman (login, setup) mengatur tata letaknya sendiri.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col">{children}</div>;
}
