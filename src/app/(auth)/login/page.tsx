import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

const NOTICES: Record<string, string> = {
  idle: "Sesi berakhir karena tidak aktif selama 12 jam. Silakan masuk lagi.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Masuk</CardTitle>
        <CardDescription>Gunakan email dan password akun karyawan Anda.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<LoginForm />}>
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </CardContent>
    </Card>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const supabase = await createClient();
  const { data: needsSetup } = await supabase.rpc("needs_setup");
  if (needsSetup) redirect("/setup");

  const { reason } = await searchParams;
  return <LoginForm notice={typeof reason === "string" ? NOTICES[reason] : undefined} />;
}
