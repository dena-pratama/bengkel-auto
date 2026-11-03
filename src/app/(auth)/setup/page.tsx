import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { SetupForm } from "./setup-form";

export default function SetupPage() {
  return (
    <Card className="rounded-md shadow-[0_1px_2px_rgb(23_36_51/0.04),0_8px_24px_-12px_rgb(23_36_51/0.08)] ring-foreground/5">
      <CardHeader>
        <CardTitle>Setup awal</CardTitle>
        <CardDescription>
          Buat akun Owner pertama. Halaman ini hanya muncul sekali, sebelum ada karyawan terdaftar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Memeriksa...</p>}>
          <SetupGate />
        </Suspense>
      </CardContent>
    </Card>
  );
}

async function SetupGate() {
  const supabase = await createClient();
  const { data: needsSetup } = await supabase.rpc("needs_setup");
  if (!needsSetup) redirect("/login");
  return <SetupForm />;
}
