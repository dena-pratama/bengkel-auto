import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { panel } from "@/components/page-kit";
import { cn } from "@/lib/utils";
import { AvatarEditor, PasswordForm, PhoneForm } from "../../../(app)/pengaturan/_components/profile";
import { SettingsNav } from "../../../(app)/pengaturan/_components/nav";
import { CropTest } from "./crop-test";

// Pratinjau halaman Profil saya tanpa login, HANYA saat development (404 di production).
// Tombol di sini memanggil rute yang butuh sesi, jadi hanya tata letak dan pemrosesan foto yang diperiksa.
export default function PengaturanPreview() {
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}

async function Preview() {
  await connection();
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto grid max-w-[900px] gap-5 p-6">
      <SettingsNav active="profile" showShop />
      <section className={cn(panel, "grid gap-5")}>
        <h2 className="text-lg font-semibold">Foto profil</h2>
        <AvatarEditor employeeId="00000000-0000-0000-0000-000000000000" name="Tama Pratama" photoUrl={null} />
      </section>
      <section className={cn(panel, "grid gap-5")}>
        <h2 className="text-lg font-semibold">Kontak dan keamanan</h2>
        <PhoneForm initial="081234567890" />
        <PasswordForm />
      </section>
      <CropTest />
    </main>
  );
}
