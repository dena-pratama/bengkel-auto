import { redirect } from "next/navigation";

// Proxy sudah mengarahkan "/" ke /dashboard atau /login; ini cadangan.
export default function Home() {
  redirect("/dashboard");
}
