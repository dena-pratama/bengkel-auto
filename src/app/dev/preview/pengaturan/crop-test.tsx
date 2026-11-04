"use client";

import { useState } from "react";
import { toAvatarFile } from "../../../(app)/pengaturan/_components/profile";

export function CropTest() {
  const [out, setOut] = useState("belum dijalankan");
  const run = async () => {
    const c = document.createElement("canvas");
    c.width = 1600;
    c.height = 900;
    const g = c.getContext("2d")!;
    g.fillStyle = "#c33";
    g.fillRect(0, 0, 1600, 900);
    g.fillStyle = "#36c";
    g.fillRect(500, 0, 600, 900);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/png"));
    const file = await toAvatarFile(new File([blob], "uji.png", { type: "image/png" }));
    const bmp = await createImageBitmap(file);
    setOut(`${file.name} ${file.type} ${file.size} byte, ${bmp.width}x${bmp.height}`);
  };
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => void run().catch((e) => setOut("ERROR: " + (e instanceof Error ? e.message : String(e))))} className="rounded-full bg-muted px-4 py-2 text-sm font-medium">
        Uji potong foto
      </button>
      <span data-testid="crop-out" className="font-mono text-xs">{out}</span>
    </div>
  );
}
