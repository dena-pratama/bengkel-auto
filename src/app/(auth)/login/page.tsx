import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { LoginExperience } from "./login-experience";
import { LoginForm } from "./login-form";

const NOTICES: Record<string, string> = {
  idle: "Sesi berakhir karena tidak aktif selama 12 jam. Silakan masuk lagi.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <LoginExperience>
      <Suspense fallback={<LoginForm />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </LoginExperience>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  // Data per request: Supabase memakai Date.now() untuk cek sesi, jadi jangan di-prerender
  await connection();
  const supabase = await createClient();
  const { data: needsSetup } = await supabase.rpc("needs_setup");
  if (needsSetup) redirect("/setup");

  const { reason } = await searchParams;
  return <LoginForm notice={typeof reason === "string" ? NOTICES[reason] : undefined} />;
}
