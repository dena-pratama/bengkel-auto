import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Bengkel Mobil App</CardTitle>
          <CardDescription>Fondasi proyek siap. Modul akan ditambahkan bertahap.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Cek koneksi: <code>/api/v1/health</code>
        </CardContent>
      </Card>
    </main>
  );
}
