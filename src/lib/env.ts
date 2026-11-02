import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverSchema = publicSchema.extend({
  // URL Supabase dari sisi server. Di dalam container Docker, supabase.localhost
  // tidak mengarah ke Kong, jadi pakai alamat internal (contoh http://supabase-kong:8000).
  SUPABASE_INTERNAL_URL: z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

// NEXT_PUBLIC_* harus ditulis literal agar di-inline oleh Next.js ke bundle browser.
export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

export function serverEnv() {
  return serverSchema.parse(process.env);
}
