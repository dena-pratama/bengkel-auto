import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// Penyusun PDF sederhana di server (PRD §19: PDF dibuat di server). Memakai font standar PDF yang
// tertanam di pdf-lib, jadi tidak butuh berkas font eksternal (aman untuk Docker standalone).
// Font standar hanya mengenal Latin-1 (WinAnsi); karakter lain diganti tanda tanya.

export type PdfAlign = "l" | "r";
export type PdfTable = {
  title?: string;
  head: string[];
  rows: (string | number | null)[][];
  /** Lebar kolom relatif; default rata */
  widths?: number[];
  align?: PdfAlign[];
  /** Baris tebal (mis. subtotal) berdasarkan indeks baris */
  boldRows?: number[];
};

export type PdfDoc = {
  /** Nama bengkel di kop */
  shop: string;
  title: string;
  subtitle?: string;
  /** Pasangan label-nilai di bawah judul (dua kolom) */
  meta?: [string, string][];
  tables: PdfTable[];
  /** Ringkasan di kanan bawah (total, dll.); baris terakhir ditebalkan */
  totals?: [string, string][];
  notes?: string[];
};

const A4: [number, number] = [595.28, 841.89];
const M = 40;
const INK = rgb(0.09, 0.14, 0.2);
const MUTED = rgb(0.4, 0.45, 0.5);
const HEAD_BG = rgb(0.18, 0.34, 0.47);
const LINE = rgb(0.85, 0.88, 0.9);

const WIN_ANSI_EXTRA = new Set([0x2022, 0x2026, 0x2018, 0x2019, 0x201c, 0x201d, 0x20ac, 0x203a, 0x2039]);
/** Ganti karakter di luar WinAnsi agar pdf-lib tidak melempar error */
export function pdfSafe(v: unknown): string {
  return String(v ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .split("")
    .map((ch) => {
      const c = ch.charCodeAt(0);
      return c < 0x100 || WIN_ANSI_EXTRA.has(c) ? ch : "?";
    })
    .join("");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of pdfSafe(text).split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= width) {
        line = test;
        continue;
      }
      if (line) out.push(line);
      // kata lebih panjang dari kolom: potong
      let w = word;
      while (font.widthOfTextAtSize(w, size) > width && w.length > 1) {
        let n = w.length - 1;
        while (n > 1 && font.widthOfTextAtSize(w.slice(0, n), size) > width) n--;
        out.push(w.slice(0, n));
        w = w.slice(n);
      }
      line = w;
    }
    out.push(line);
  }
  return out;
}

export async function renderPdf(doc: PdfDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(doc.title));
  pdf.setCreator("AutoMobi");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const contentW = A4[0] - M * 2;

  let page!: PDFPage;
  let y = 0;
  const newPage = () => {
    page = pdf.addPage(A4);
    y = A4[1] - M;
  };
  const ensure = (h: number, redraw?: () => void) => {
    if (y - h < M + 20) {
      newPage();
      redraw?.();
    }
  };
  const text = (t: string, x: number, size: number, f: PDFFont = font, color = INK) => page.drawText(pdfSafe(t), { x, y, size, font: f, color });
  const textRight = (t: string, xRight: number, size: number, f: PDFFont = font, color = INK) => {
    const s = pdfSafe(t);
    page.drawText(s, { x: xRight - f.widthOfTextAtSize(s, size), y, size, font: f, color });
  };

  newPage();
  // Kop
  text(doc.shop, M, 11, bold, HEAD_BG);
  y -= 22;
  text(doc.title, M, 18, bold);
  y -= 16;
  if (doc.subtitle) {
    text(doc.subtitle, M, 9.5, font, MUTED);
    y -= 14;
  }
  if (doc.meta?.length) {
    y -= 4;
    const colW = contentW / 2;
    doc.meta.forEach(([k, v], i) => {
      const x = M + (i % 2) * colW;
      if (i % 2 === 0 && i > 0) y -= 13;
      text(`${k}:`, x, 9, font, MUTED);
      text(v, x + font.widthOfTextAtSize(pdfSafe(`${k}:`), 9) + 6, 9, bold);
    });
    y -= 16;
  }

  for (const t of doc.tables) {
    const n = t.head.length;
    const rel = t.widths ?? Array(n).fill(1);
    const total = rel.reduce((a, b) => a + b, 0);
    const widths = rel.map((r) => (r / total) * contentW);
    const align = t.align ?? Array(n).fill("l");
    const size = 8.5;
    const pad = 4;

    const header = () => {
      page.drawRectangle({ x: M, y: y - 15, width: contentW, height: 18, color: HEAD_BG });
      let x = M;
      t.head.forEach((h, i) => {
        const yy = y;
        y = yy - 11;
        if (align[i] === "r") textRight(h, x + widths[i] - pad, size, bold, rgb(1, 1, 1));
        else text(h, x + pad, size, bold, rgb(1, 1, 1));
        y = yy;
        x += widths[i];
      });
      y -= 22;
    };

    y -= 6;
    if (t.title) {
      ensure(40);
      text(t.title, M, 11, bold);
      y -= 16;
    }
    ensure(40);
    header();
    t.rows.forEach((r, ri) => {
      const cells = r.map((c, i) => wrap(c === null ? "" : String(c), t.boldRows?.includes(ri) ? bold : font, size, widths[i] - pad * 2));
      const lines = Math.max(...cells.map((c) => c.length), 1);
      const h = lines * 11 + 5;
      ensure(h, header);
      let x = M;
      cells.forEach((cl, i) => {
        cl.forEach((ln, li) => {
          const yy = y;
          y = yy - 10 - li * 11;
          const f = t.boldRows?.includes(ri) ? bold : font;
          if (align[i] === "r") textRight(ln, x + widths[i] - pad, size, f);
          else text(ln, x + pad, size, f);
          y = yy;
        });
        x += widths[i];
      });
      y -= h;
      page.drawLine({ start: { x: M, y: y + 2 }, end: { x: M + contentW, y: y + 2 }, thickness: 0.5, color: LINE });
    });
    y -= 8;
  }

  if (doc.totals?.length) {
    ensure(doc.totals.length * 15 + 10);
    const xr = M + contentW - 4;
    doc.totals.forEach(([k, v], i) => {
      const last = i === doc.totals!.length - 1;
      const f = last ? bold : font;
      textRight(v, xr, last ? 11 : 9.5, f);
      textRight(`${k}`, xr - 120, last ? 11 : 9.5, f, last ? INK : MUTED);
      y -= last ? 18 : 14;
    });
  }
  for (const n of doc.notes ?? []) {
    ensure(24);
    for (const ln of wrap(n, font, 8.5, contentW)) {
      text(ln, M, 8.5, font, MUTED);
      y -= 11;
    }
  }

  // Nomor halaman
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const s = `Halaman ${i + 1} dari ${pages.length}`;
    p.drawText(s, { x: A4[0] - M - font.widthOfTextAtSize(s, 8), y: 22, size: 8, font, color: MUTED });
  });
  return pdf.save();
}

export function pdfResponse(bytes: Uint8Array, filename: string) {
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename.replace(/[^A-Za-z0-9._-]+/g, "_")}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
