# Devlog Bengkel Mobil App

Catatan setiap perubahan. Entri terbaru di paling atas.

---

## [0.16.0] 2026-11-04
**Ringkasan:** Modul Penggajian (PRD §10.3-10.4): profil gaji, periode gaji bulanan/mingguan dengan alur Draft, Review Owner, Disetujui, Dibayar, kasbon dengan potongan otomatis, komisi mekanik dibayar bersama gaji, dan slip gaji yang bisa dicetak.

### Added
- Migration `20261103000019_payroll.sql`:
  - Tabel `employee_pay_profiles` (gaji pokok bulanan atau tarif harian + tunjangan tetap), `payroll_periods`, `payslips`, `employee_loans`, `employee_loan_payments`; kolom `commissions.payslip_id` dan status komisi baru `paid`.
  - `create_payroll_period`: slip dibuat untuk semua karyawan aktif/cuti berprofil gaji, komisi yang sudah diakui sampai akhir periode masuk otomatis, cicilan kasbon disarankan otomatis (jumlah cicilan atau sisa, mana yang lebih kecil). Periode yang tumpang tindih ditolak. Periode mingguan: gaji bulanan dan tunjangan dikali 7/30.
  - `update_payslip` (Draft saja): hari masuk (harian), lembur (jam x tarif), bonus, potongan kasbon (tidak boleh melebihi sisa kasbon), potongan lain (BPJS, PPh 21, denda) dengan keterangan. Gaji bersih tidak boleh minus.
  - Alur: `submit_payroll` (Draft ke Review), `approve_payroll` (Owner), `reopen_payroll` (kembali ke Draft), `pay_payroll`, `void_payroll`.
  - Saat dibayar: jurnal Dr Beban Gaji dan Beban Komisi, Cr Kas/Bank (bersih), Cr Kasbon Karyawan (potongan kasbon), Cr Hutang Gaji/Potongan (potongan lain); potongan kasbon dialokasikan ke kasbon tertua; komisi menjadi `paid`. Batal gaji yang sudah dibayar: jurnal dibalik, cicilan kasbon dibatalkan, komisi kembali bisa dibayar.
  - Kasbon: `create_employee_loan` (Dr Kasbon Karyawan, Cr Kas/Bank), `repay_employee_loan` (bayar tunai di luar gaji), `void_employee_loan` (hanya yang belum dicicil).
  - View `v_payslips`, `v_employee_loans`.
  - RLS: Owner melihat semua; mekanik dan gudang (izin `payroll` lingkup sendiri) hanya melihat slip, periode, dan kasbon miliknya, slip baru terlihat setelah gaji disetujui. Admin tidak punya akses.
- Tes DB `supabase/tests/payroll_test.sql`.
- Halaman `/penggajian` (daftar periode; untuk non-Owner menjadi "Slip gaji saya"), `/penggajian/[id]` (rincian per karyawan, input slip saat Draft, tombol alur, bayar gaji, batalkan), `/penggajian/slip/[id]` (slip gaji cetak), `/penggajian/kasbon`, `/penggajian/komisi` (komisi berjalan: menunggu lunas, diakui, dibayar; mekanik hanya miliknya), `/penggajian/profil` (gaji pokok dan tunjangan per karyawan).

### Changed
- Menu **Penggajian** (Owner, Mekanik, Gudang untuk slip sendiri).

### Catatan
- Belum ada: absensi digital (Fase 2, hari masuk diinput manual), perhitungan otomatis PPh 21 dan BPJS (backlog, diinput manual sebagai potongan), pengiriman slip sebagai PDF (gunakan cetak browser).
- Karyawan tanpa profil gaji tidak dibuatkan slip.

### Verifikasi
- `npm run test:db`: semua suite lulus, termasuk penggajian.
- `tsc`, `eslint`, `npm run check:dashes`, `next build` lolos. Bentuk query PostgREST halaman penggajian dicek terhadap DB lokal.
- **Halaman penggajian belum dilihat di browser dengan login.**

### File terdampak
`supabase/migrations/20261103000019_payroll.sql`, `supabase/tests/payroll_test.sql`, `src/app/(app)/penggajian/**`, `src/lib/payroll.ts`, `src/lib/validation/payroll.ts`, `src/lib/navigation.ts`, `src/components/app-nav.tsx`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.15.0] 2026-11-04
**Ringkasan:** Modul Pajak (PRD §12): profil pajak, tarif PPN bertanggal, laporan PPN, PPh Final UMKM bulanan dengan jurnal otomatis, estimasi PPh tarif umum, dan setor pajak.

### Added
- Migration `20261103000018_tax.sql`:
  - Tabel `tax_settings` (bentuk usaha, status PKP, cara PPh, tarif Final 0,5%, tarif umum 22%, batas omzet Rp4,8 miliar, omzet bebas Rp500 juta untuk Orang Pribadi, akhir fasilitas CV/Firma/PT, tanggal setor), `tax_period_summaries` (PPh Final per bulan), `tax_payments` (setor PPh Final dan PPN). RLS untuk izin `tax_settings` dan `finance_reports`.
  - `save_tax_settings`: PPN hanya bisa aktif jika PKP; CV/Firma/PT wajib mengisi tanggal akhir fasilitas bila memakai PPh Final; saklar `ppn_enabled` dan `prices_include_ppn` yang dibaca invoice ikut diperbarui dari profil pajak.
  - `add_tax_rate`: tarif PPN baru berlaku mulai tanggal tertentu, tarif lama berakhir sehari sebelumnya (riwayat tarif utuh).
  - `tax_overview` (omzet, kumulatif, kena pajak, PPh per bulan; omzet dari akun pendapatan sehingga diskon dan retur sudah terhitung), `post_pph_final` (hanya bulan yang sudah berakhir; jurnal Dr Beban PPh Final, Cr Hutang PPh Final bertanggal akhir bulan), `void_pph_final` (jurnal pembalik).
  - Aturan §17.6: Orang Pribadi memakai omzet bebas Rp500 juta pertama setahun (contoh PRD: kumulatif Rp700 juta, kena pajak Rp200 juta, PPh Rp1.000.000); bentuk usaha lain seluruh omzet kena pajak.
  - `post_tax_payment` / `void_tax_payment`: setor PPh Final (Dr Hutang PPh Final, Cr Kas/Bank, tidak boleh melebihi hutang) dan PPN (Dr PPN Keluaran, Cr Kas/Bank).
  - `report_ppn` (Keluaran, Masukan, selisih kurang/lebih bayar, disetor) dan `report_ppn_documents` (faktur penjualan, retur, dan penerimaan barang ber-PPN dengan DPP, PPN, NPWP).
- Tes DB `supabase/tests/tax_test.sql`.
- Halaman `/pajak` (pengaturan profil pajak dan tarif PPN), `/pajak/ppn` (laporan PPN, daftar dokumen, setoran, ekspor Excel), `/pajak/pph` (PPh Final per bulan dengan posting, peringatan omzet 80% dan 95% dari batas, hutang dan setoran, atau estimasi tarif umum).
- Laba rugi (`/keuangan/laporan`): untuk pilihan "Estimasi PPh tarif umum" menampilkan baris estimasi pajak dan laba bersih setelah estimasi (tidak dijurnal); pilihan PPh Final menampilkan beban PPh Final dari jurnal; PPh OFF: laba bersih sama dengan laba sebelum pajak.
- Ekspor Excel PPN (`/api/v1/keuangan/export?jenis=ppn`).

### Changed
- Menu **Pajak** aktif (Owner).

### Catatan
- Belum ada: pengingat setor PPh sebagai notifikasi/dashboard (tanggal setor sudah tersimpan dan tampil di halaman PPh), pembatalan otomatis PPh Final saat dokumen sumber dibatalkan di bulan yang sudah diposting (batalkan posting lalu posting ulang), ekspor faktur pajak ke format DJP (Coming Soon di PRD).
- Setor PPN mencatat Dr PPN Keluaran, Cr Kas/Bank; PPN Masukan tidak dikompensasi otomatis di jurnal (selisih tampil di laporan).
- Aturan PPh bisa berubah: tarif, batas, dan omzet bebas ada di pengaturan, bukan di kode.

### Verifikasi
- `npm run test:db`: semua suite lulus, termasuk pajak.
- `tsc`, `eslint`, `npm run check:dashes`, `next build` lolos. Bentuk query PostgREST halaman pajak dicek terhadap DB lokal.
- **Halaman pajak belum dilihat di browser dengan login.**

### File terdampak
`supabase/migrations/20261103000018_tax.sql`, `supabase/tests/tax_test.sql`, `src/app/(app)/pajak/**`, `src/lib/tax.ts`, `src/lib/validation/tax.ts`, `src/app/(app)/keuangan/laporan/page.tsx`, `src/app/api/v1/keuangan/export/route.ts`, `src/lib/navigation.ts`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.14.0] 2026-11-04
**Ringkasan:** Modul Finance (PRD §11): kas & bank, pemasukan dan pengeluaran, transfer, modal dan prive, biaya rutin, jurnal manual, bagan akun, tutup buku, dan laporan keuangan (laba rugi, neraca, arus kas, buku besar, margin) dengan ekspor Excel.

### Added
- Migration `20261103000017_finance.sql`:
  - Tabel `cash_transactions` (pemasukan lain KM, pengeluaran KK, transfer TF, setoran modal SM, prive PV; status posted/void + alasan), `recurring_expenses` (template biaya rutin), `fiscal_periods` (tutup buku bulanan).
  - Fungsi: `post_cash_transaction`, `void_cash_transaction`, `save_recurring_expense`, `set_recurring_expense_active`, `confirm_recurring_expense` (sekali per bulan, jumlah boleh diubah), `post_manual_journal`, `reverse_manual_journal` (hanya jurnal manual; jurnal otomatis dibalik lewat dokumen sumbernya), `save_account` (awalan kode harus sesuai jenis), `set_account_active` (akun sistem dan akun bersaldo tidak bisa dinonaktifkan), `save_cash_bank_account` (akun buku besar dibuat otomatis), `close_fiscal_period` (hanya bulan yang sudah lewat, berurutan), `reopen_fiscal_period` (Owner, wajib alasan).
  - Penguncian periode: `app.post_journal` menolak jurnal bertanggal di bulan yang ditutup, sehingga semua modul (penjualan, pembelian, kas, opname) ikut terkunci.
  - Laporan (fungsi dengan pemeriksaan izin): `report_profit_loss`, `report_balance_sheet` (laba berjalan kumulatif sebagai baris modal), `report_cash_flow` (metode langsung, dikelompokkan operasi/investasi/pendanaan, transfer antar kas tidak dihitung), `report_cash_bank_balances`, `report_account_balances`, `report_ledger` (saldo berjalan), `report_margin` (per jasa, barang, work order).
  - View `v_cash_transactions`, `v_recurring_expenses`, `v_journal_entries`.
  - Izin: pengeluaran, pemasukan, transfer, dan biaya rutin lewat `expenses` (Admin, Kasir); modal, prive, jurnal manual, akun, dan tutup buku lewat `journal` (Owner); laporan lewat `finance_reports` (Owner).
- Tes DB `supabase/tests/finance_test.sql` (data bertanggal 2020 agar laporan tepat dan tidak tercampur data nyata).
- Halaman `/keuangan` (saldo kas dan bank, transaksi terakhir, biaya rutin), `/keuangan/laporan` (laba rugi dengan pembanding periode sebelumnya, neraca, arus kas, margin; filter periode dan pintasan Bulan ini, Bulan lalu, Tahun ini), `/keuangan/jurnal` (jurnal umum dengan filter sumber, detail baris, dan buku besar per akun), `/keuangan/akun` (bagan akun dan tutup buku).
- Ekspor Excel `GET /api/v1/keuangan/export` (laba rugi, neraca, arus kas, margin) dengan `exceljs`.

### Changed
- Menu **Keuangan** aktif (terlihat untuk pemegang izin `expenses`, jadi Admin dan Kasir bisa mencatat pengeluaran; tab laporan dan akun hanya muncul sesuai izin).

### Catatan
- Belum ada: foto bukti transaksi (butuh Storage), ekspor PDF (gunakan cetak browser), jurnal penutup akhir tahun, anggaran. Laporan umur hutang dan piutang tetap di halaman Pembelian dan Kasir.
- Margin memakai HPP part saja; komisi mekanik belum dihitung sebagai biaya.
- Pembatalan transaksi kas membuat jurnal pembalik bertanggal hari pembatalan (bukan tanggal asli), sama seperti modul lain.
- `sale_items.cost_total` dan `sales.cogs_total` (HPP) masih terbaca pemegang izin penjualan lewat API; menyembunyikannya dari non-Owner (PRD §10.2) belum dikerjakan.

### Verifikasi
- `npm run test:db`: semua suite lulus, termasuk finance.
- `tsc`, `eslint`, `npm run check:dashes`, `next build` lolos. Bentuk query PostgREST halaman keuangan dicek terhadap DB lokal.
- **Halaman keuangan dan ekspor Excel belum dilihat di browser dengan login.**

### File terdampak
`supabase/migrations/20261103000017_finance.sql`, `supabase/tests/finance_test.sql`, `src/app/(app)/keuangan/**`, `src/app/api/v1/keuangan/export/route.ts`, `src/lib/finance.ts`, `src/lib/validation/finance.ts`, `src/lib/navigation.ts`, `package.json`, `package-lock.json`, `devlog.md`, `fitur.md`, `VERSION`

---

## [0.13.1] 2026-11-03
**Ringkasan:** Pembaruan logo 3D AutoMobi dengan transparansi penuh untuk mode terang, mode gelap, halaman login/setup, sidebar aplikasi, dan favicon tab browser.

### Added
- Aset sumber logo baru beresolusi tinggi: `design/automobi-logo-light-source.jpg` dan `design/automobi-logo-dark-source.jpg`.
- Generator aset `scripts/make-logo.mjs`: mengekstrak siluet mobil 3D metalik, kunci pas, dan tipografi AutoMobi dengan eliminasi latar kotak-kotak catur (checkerboard) dan teks label mode, menghasilkan transparansi alpha anti-alias halus.

### Changed
- `public/brand/automobi-logo.png`: logo 3D AutoMobi transparan untuk latar terang (navy tua pada kunci pas dan teks Mobi).
- `public/brand/automobi-logo-dark.png`: logo 3D AutoMobi transparan untuk latar gelap (biru sian cerah pada kunci pas dan teks Mobi).
- `public/brand/automobi-mark.png`: ikon lambang mobil dan kunci pas bujur sangkar 512x512 transparan untuk sidebar ciut.
- `src/app/icon.png`: favicon browser 256x256 bersumber dari lambang 3D baru.
- `src/app/(auth)/layout.tsx`: penyesuaian dimensi gambar logo (`671x335`) pada halaman login dan setup.
- `src/components/app-shell.tsx`: penyesuaian dimensi gambar logo (`671x335`) pada sidebar bentang.

### Verifikasi
- Bebas tanda pisah panjang: `npm run check:dashes` (222 file lolos).
- Typecheck (`npx tsc --noEmit`) 0 error.
- Linting (`npm run lint`) 0 error / 0 warning.
- Kompilasi produksi Next.js (`npm run build`) 54 rute berhasil.

### File terdampak
`VERSION`, `package.json`, `devlog.md`, `design/*`, `public/brand/*`, `src/app/icon.png`, `scripts/make-logo.mjs`, `src/app/(auth)/layout.tsx`, `src/components/app-shell.tsx`

---

## [0.13.0] 2026-11-03
**Ringkasan:** Modul Stok Opname (PRD §9, §11.3): sesi opname menyeluruh, parsial rak/kategori, cycle count acak, mode blind count, persetujuan selisih dengan PIN owner, posting mutasi penyesuaian stok, dan jurnal otomatis selisih persediaan.

### Added
- Migrasi `supabase/migrations/20261103000016_stock_opname.sql`:
  - Enum `opname_type` ('full', 'location', 'category', 'cycle_count'), `opname_status` ('draft', 'in_progress', 'review', 'posted', 'void'), dan `opname_variance_reason` ('damaged', 'lost', 'input_error', 'misplaced', 'other').
  - Tabel `public.stock_opnames` dan `public.stock_opname_items` lengkap dengan trigger audit perubahan baris `audit_row_change`, proteksi hapus `trg_no_delete_stock_opnames` untuk sesi posted/void, dan indeks performa.
  - Setting cabang `opname_pin_threshold` bernilai Rp 500.000 untuk ambang batas otorisasi persetujuan PIN owner.
  - Prosedur dan fungsi PostgreSQL:
    - `public.create_stock_opname`: inisialisasi sesi opname dan otomatis memuat item berdasarkan cakupan (seluruh bengkel, rak/lokasi tertentu, kategori barang tertentu, atau cycle count sampel acak).
    - `public.start_stock_opname`: mengunci saldo sistem (`book_qty`) pada waktu mulai dan mengubah status menjadi `in_progress`.
    - `public.save_opname_counts`: penyimpanan bertahap hasil hitungan fisik (`physical_qty`).
    - `public.complete_opname_count`: validasi kelengkapan hitungan fisik dan perpindahan status ke `review`.
    - `public.recount_opname_item`: fasilitas hitung ulang item berselisih yang mengembalikan status sesi ke `in_progress`.
    - `public.post_stock_opname`: persetujuan akhir sesi, validasi alasan selisih per item, verifikasi PIN owner bila total selisih melebihi ambang batas, posting mutasi penyesuaian stok via `app.post_stock_movement`, dan posting jurnal otomatis selisih persediaan via `app.post_journal` (Dr Beban Selisih Persediaan, Cr Persediaan Sparepart untuk selisih kurang, atau sebaliknya untuk selisih lebih).
    - `public.void_stock_opname`: pembatalan sesi draft/in_progress/review dengan pencatatan alasan wajib.
  - View pelaporan `public.v_stock_opnames` (metrik akurasi %, total item, item berselisih, selisih netto/nilai, nomor jurnal) dan `public.v_stock_opname_items`.
  - Pengaturan RLS ketat berbasis izin `stock_opname:view`, `stock_opname:manage`, `stock_opname:count`, dan `stock_opname:approve`.
- Rangkaian pengujian database `supabase/tests/stock_opname_test.sql`:
  - Skenario 1: Validasi hak akses pembuatan opname (mekanik ditolak, admin/gudang diizinkan).
  - Skenario 2: Inisialisasi sesi draft, pemilihan cakupan rak, dan penguncian saldo buku saat `start_stock_opname`.
  - Skenario 3: Validasi input hitungan fisik (kuantitas negatif ditolak, penyelesaian sebelum semua item terhitung ditolak).
  - Skenario 4: Perhitungan selisih fisik vs buku, fasilitas recount (hitung ulang) item, dan perbaikan hitungan.
  - Skenario 5: Persetujuan dan posting penyesuaian (kasir ditolak, validasi alasan selisih wajib, verifikasi PIN jika selisih melampaui batas, penyesuaian saldo gudang, mutasi penyesuaian stok tercatat, jurnal selisih seimbang di buku besar, proteksi sesi posted dari penghapusan).
  - Skenario 6: Pembatalan sesi opname (`void_stock_opname`) dengan validasi panjang alasan pembatalan.
- Validasi data Zod di `src/lib/validation/stock-opname.ts` untuk pembuatan sesi, penyimpanan hitungan fisik, persetujuan dan posting, serta pembatalan sesi.
- Modul data access di `src/lib/stock-opname.ts` (`listStockOpnames`, `getStockOpname`, `listOpnameLocations`, `listOpnameCategories`, `listOpnameEmployees`).
- Server actions di `src/app/(app)/stok-opname/actions.ts`: `createStockOpnameAction`, `startStockOpnameAction`, `saveOpnameCountsAction`, `completeOpnameCountAction`, `recountOpnameItemAction`, `postStockOpnameAction`, `voidStockOpnameAction`.
- Antarmuka pengguna Stok Opname di `src/app/(app)/stok-opname`:
  - `page.tsx`: Halaman daftar sesi opname dengan ringkasan status, pencarian, dan filter status.
  - `_components/create-dialog.tsx`: Modal pembuatan sesi baru dengan opsi cakupan (menyeluruh, per rak, per kategori, atau cycle count acak), mode blind count, dan penunjukan petugas hitung.
  - `_components/count-sheet.tsx`: Lembar kerja hitung fisik interaktif dengan dukungan blind count (menyembunyikan stok sistem), penyimpanan progres sementara, dan konfirmasi selesai hitung.
  - `_components/review-panel.tsx`: Panel telaah selisih dengan persentase akurasi, seleksi alasan selisih (rusak, hilang, salah input, salah letak, lainnya), tombol hitung ulang per item, dan persetujuan posting dengan PIN owner jika melampaui ambang batas.
  - `_components/void-dialog.tsx`: Dialog pembatalan sesi opname dengan input alasan pembatalan.
  - `[id]/page.tsx`: Halaman detail sesi terpadu yang menampilkan alur kerja status dinamis (draft, in progress, review, posted, void).
  - Aktivasi menu Stok Opname pada sidebar navigasi `src/lib/navigation.ts`.

### Verifikasi
- Pengujian database lolos 100% untuk seluruh 9 test suite (`npm run test:db`).
- Bebas tanda pisah panjang: `npm run check:dashes` (209 file lolos).
- Typecheck (`npx tsc --noEmit`) 0 error.
- Linting (`npm run lint`) 0 error / 0 warning.
- Kompilasi produksi Next.js (`npm run build`) berhasil (termasuk halaman `/stok-opname` dan `/stok-opname/[id]`).

### File terdampak
`VERSION`, `package.json`, `fitur.md`, `devlog.md`, `src/lib/navigation.ts`, `supabase/migrations/20261103000016_stock_opname.sql`, `supabase/tests/stock_opname_test.sql`, `src/lib/validation/stock-opname.ts`, `src/lib/stock-opname.ts`, `src/app/(app)/stok-opname/actions.ts`, `src/app/(app)/stok-opname/_components/ui.tsx`, `src/app/(app)/stok-opname/_components/create-dialog.tsx`, `src/app/(app)/stok-opname/_components/count-sheet.tsx`, `src/app/(app)/stok-opname/_components/review-panel.tsx`, `src/app/(app)/stok-opname/_components/void-dialog.tsx`, `src/app/(app)/stok-opname/_components/opname-list.tsx`, `src/app/(app)/stok-opname/page.tsx`, `src/app/(app)/stok-opname/[id]/page.tsx`

---

## [0.12.0] 2026-11-03
**Ringkasan:** Modul Retur Penjualan (PRD §8.5, §11.3): uang kembali atau potong piutang, barang rusak ke rak karantina, jurnal pembalik otomatis, dan integrasi kasir.

### Added
- Migrasi `supabase/migrations/20261103000015_sales_returns.sql`: tabel `public.sale_returns` dan `public.sale_return_items` lengkap dengan audit trigger, trigger proteksi hapus `trg_no_delete`, kolom `returned_qty` pada `sale_items`, setting `sales_return_max_days` (default 7 hari), serta inisialisasi rak karantina `KRT-01` per cabang.
- Fungsi PostgreSQL `public.post_sale_return`: menangani pengembalian stok (barang bagus ke rak asal atau barang rusak ke rak karantina) via `app.post_stock_movement`, jurnal pembalik otomatis (Dr Retur Penjualan, Dr PPN Keluaran jika kena pajak, Cr Piutang/Kas, Dr Persediaan Sparepart, Cr HPP), pengembalian fisik uang kas kasir pada shift aktif (`cash_refund`), dan pemotongan sisa tagihan piutang pada penjualan tempo.
- View pelaporan `v_sale_returns`, serta pembaruan `v_sales` (kolom `returned_total` dan pengurangan sisa piutang `outstanding`) dan `v_cash_shifts` (kolom `cash_refund` pengembalian kas).
- Rangkaian pengujian database `supabase/tests/sales_returns_test.sql` mencakup 5 skenario lengkap (POS tunai + uang kembali, validasi batas retur dan alasan, barang rusak ke rak karantina, penjualan kredit + potong piutang, dan proteksi imutabilitas tabel).
- Skema validasi Zod di `src/lib/validation/cashier.ts` dan fungsi query backend di `src/lib/cashier.ts` (`listSaleReturns`, `getSaleReturn`, `listReturnLocations`).
- Server action `postSaleReturnAction` di `src/app/(app)/kasir/actions.ts`.
- Komponen antarmuka kasir: dialog `ReturnDialog`, daftar retur `ReturnsList`, dan tab navigasi retur di `CashierNav`.
- Halaman web `/kasir/retur` (daftar retur penjualan), `/kasir/retur/[id]` (detail retur dengan status, item, rak tujuan, dan nomor jurnal pembalik), serta integrasi tombol retur dan riwayat retur pada halaman detail invoice `/kasir/penjualan/[id]`.

### Changed
- `v_sales`: kolom `returned_total` ditambahkan dan `outstanding` otomatis terpotong saat ada retur piutang.
- `v_cash_shifts`: menghitung akumulasi `cash_refund` sehingga kas kasir yang seharusnya berkurang akurat saat ada refund tunai.
- `src/app/(app)/kasir/_components/ui.tsx`: menambahkan navigasi "Retur penjualan" ke `CashierNav`.

### Fixed
- Isolasi pengecekan penjualan di `supabase/tests/cashier_test.sql` agar tidak terganggu data uji yang sudah ada.
- Penomoran sekuens dokumen di `supabase/tests/foundation_test.sql` agar tidak bentrok dengan invoice uji yang sudah dibuat di lokal.

### Verifikasi
- Pengujian database lolos 100% untuk semua 8 file pengujian (`npm run test:db`).
- Bebas tanda pisah panjang: `npm run check:dashes` (209 file lolos).
- Typecheck (`npx tsc --noEmit`), linting (`npm run lint`), dan kompilasi Next.js (`npm run build`) semuanya sukses tanpa peringatan atau error.

### File terdampak
`VERSION`, `package.json`, `fitur.md`, `devlog.md`, `supabase/migrations/20261103000015_sales_returns.sql`, `supabase/tests/sales_returns_test.sql`, `supabase/tests/cashier_test.sql`, `supabase/tests/foundation_test.sql`, `src/lib/validation/cashier.ts`, `src/lib/cashier.ts`, `src/app/(app)/kasir/actions.ts`, `src/app/(app)/kasir/_components/ui.tsx`, `src/app/(app)/kasir/_components/return-dialog.tsx`, `src/app/(app)/kasir/_components/returns-list.tsx`, `src/app/(app)/kasir/retur/page.tsx`, `src/app/(app)/kasir/retur/[id]/page.tsx`, `src/app/(app)/kasir/penjualan/[id]/page.tsx`

---

## [0.11.7] 2026-11-03
**Ringkasan:** Top bar tidak lagi "nempel" ke tepi atas panel pada halaman yang kontennya panjang.

### Fixed
- Sejak 0.11.6 panel konten menjadi kontainer scroll setinggi layar, sehingga header (`h-16`) ikut tertekan flexbox menjadi 48px saat konten lebih panjang dari layar (kolom cari hanya 4px dari tepi atas, jarak ke baris tab menyempit). Header diberi `shrink-0`: tinggi tetap 64px, kolom cari 12px dari tepi atas. Halaman berkonten pendek (servis, pelanggan) tidak terdampak, itu sebabnya terlihat berbeda.

### Verifikasi
- Diukur di browser pada lebar 1906px: tinggi header 64px (sebelumnya 48px), jarak kolom cari ke tepi atas panel 12px (sebelumnya 4px), tetap 64px setelah panel di-scroll. `tsc`, `eslint`, `npm run check:dashes`, `next build` lolos.

### File terdampak
`src/components/app-nav.tsx`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.11.6] 2026-11-03
**Ringkasan:** Bingkai, sidebar, dan top bar diam di tempat saat halaman di-scroll; hanya isi panel yang bergulir.

### Changed
- Tablet ke atas: kerangka setinggi layar (`h-dvh`), bingkai gelap dan sidebar tidak ikut bergeser, panel konten bergulir sendiri (scrollbar tipis) dengan top bar menempel di atas panel. Sebelumnya seluruh halaman ikut ter-scroll sehingga bingkai terlihat ikut turun.
- HP tetap seperti sebelumnya (halaman bergulir normal, menu geser, header menempel).
- Cetak (invoice, laporan shift) tetap memuat seluruh isi karena tinggi dan overflow dilepas saat mencetak.

### Verifikasi
- Di browser: panel di-scroll 600px, posisi sidebar dan header tidak berubah, `window` tidak ter-scroll. Lebar HP: halaman bergulir normal tanpa geser samping.
- `tsc`, `eslint`, `npm run check:dashes`, `next build` lolos.

### File terdampak
`src/components/app-nav.tsx`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.11.5] 2026-11-03
**Ringkasan:** Ikon yang tampil seperti tanda pisah panjang diganti.

### Fixed
- Tombol **Kas keluar** (shift kasir) memakai ikon `Minus` yang terlihat seperti em dash; diganti ikon `HandCoins`.
- Tombol **Keluarkan part** (detail WO) memakai `PackageMinus`; diganti `PackageOpen`.

### Verifikasi
- `tsc`, `eslint`, `npm run check:dashes` lolos; tidak ada lagi pemakaian ikon `Minus` di `src`.

### File terdampak
`src/app/(app)/kasir/_components/shift-dialogs.tsx`, `src/app/(app)/servis/_components/wo-panels.tsx`, `devlog.md`, `VERSION`, `package.json`

---

## [0.11.4] 2026-11-03
**Ringkasan:** Notifikasi (toast) dirapikan: di tengah layar, warna biru dan merah logo, durasi singkat.

### Changed
- Posisi di tengah layar (horizontal dan vertikal), bukan di atas.
- Bentuk pil bersih: sukses dan info = biru tua logo, gagal = merah logo, peringatan = pasir logo. Ikon outline, tombol aksi (mis. "Buka") berupa chip tipis. Tombol tutup (x) dihapus karena toast hilang sendiri; satu toast tampil pada satu waktu.
- Durasi lewat konstanta `TOAST_MS` (`src/components/app-toaster.tsx`): konfirmasi biasa 1,2 detik, ada tombol aksi 3 detik, peringatan 5 detik.

### Catatan
- Durasi 0,5 detik sempat dicoba lalu dinaikkan: animasi masuk sonner sekitar 0,4 detik, sehingga di 0,45 detik toast sudah transparan dan tidak terbaca. Nilai bisa diubah di `TOAST_MS`.
- Halaman pratinjau `/dev/preview/form-dialog` punya tombol uji notifikasi (toast bertahan sampai ditutup agar bisa diperiksa).

### Verifikasi
- `tsc`, `eslint`, `npm run check:dashes`, `next build` lolos. Posisi tengah, warna, dan tampilan diperiksa di browser.

### File terdampak
`src/components/app-toaster.tsx`, `src/components/form-dialog.tsx`, `src/app/(app)/servis/_components/dialogs.tsx`, `src/app/dev/preview/form-dialog/**`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.11.3] 2026-11-03
**Ringkasan:** Kolom isian dan pop-up dirapikan agar seragam dan selaras dengan tema moodboard.

### Changed
- Satu gaya kolom untuk semua isian (`Input`, `Textarea`, `inputClass`, select bawaan): tinggi 44px, sudut 14px, latar putih dengan border biru lembut, cincin fokus biru, status error merah. Sebelumnya ada tiga gaya berbeda (pil kecil, persegi, tinggi berbeda).
- Select bawaan memakai panah sendiri (terang dan gelap) dan ruang kanan yang cukup.
- Label seragam (15px, medium) di komponen `Label` dan label biasa.
- Pop-up (`FormDialog`): permukaan putih tanpa pita header bergaris, judul lebih besar, tombol tutup bulat, sudut 32px. Bagian (`panel`) di dalam pop-up menjadi blok kebiruan datar tanpa bayangan, sehingga tidak ada kartu di dalam kartu.
- Tombol: tinggi default 40px (sm 32px, lg 44px), semua berbentuk pil agar sebanding dengan kolom.

### Verifikasi
- `tsc`, `eslint`, `npm run check:dashes`, `next build` lolos.
- Dilihat di browser: pop-up tambah supplier (atas dan bawah) dan dashboard. Pop-up kasir/servis belum dilihat dengan data nyata.

### File terdampak
`src/components/ui/input.tsx`, `src/components/ui/textarea.tsx`, `src/components/ui/label.tsx`, `src/components/ui/button.tsx`, `src/components/page-kit.tsx`, `src/components/form-dialog.tsx`, `src/components/form-field.tsx`, `src/app/globals.css`, `src/app/(app)/kasir/_components/*`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.11.2] 2026-11-03
**Ringkasan:** Tampilan baru mengikuti moodboard (bingkai gelap membulat dengan rail ikon, panel tengah kebiruan, kartu putih sangat membulat), warna merah dan biru dari logo. Menjadi tema default.

### Changed
- Token warna (`globals.css`): latar luar gradien biru lembut (`--page-bg`), panel tengah `#dbe8f2`, bingkai & rail `#2f5878`, border lebih lembut, palet grafik merah / emas / biru tua / biru logo. Token baru `--brand-gold` (turunan pasir logo) hanya untuk grafik dan penanda. Mode gelap tetap berfungsi.
- Kerangka (`app-nav.tsx`): aplikasi dibingkai kartu gelap membulat 40px (tablet ke atas); sidebar masuk ke dalam bingkai (sticky, tidak lagi melayang), konten di panel membulat 30px. HP tetap tanpa bingkai dengan menu geser.
- Sidebar default **rail ikon**; bisa dibentangkan dengan tombol atau Ctrl+B dan pilihan tetap diingat.
- Menu aktif: pil tembus pandang dengan penanda merah di kiri (tetap meluncur antar menu).
- Kartu (`panel` dan kartu dashboard): sudut 28px, bayangan lembut, padding lebih lega, judul kartu dengan tombol titik tiga.
- Tab bagian modul dan tab dashboard menjadi pil (aktif = biru tua, teks putih). Kolom cari di top bar berbentuk pil.

### Verifikasi
- `tsc`, `eslint`, `npm run check:dashes`, `next build` lolos.
- Dilihat di browser lewat `/dev/preview` (mode terang, mode gelap, rail ikon, sidebar bentang) dan `/login`. Halaman di balik login belum dilihat dengan sesi nyata.

### File terdampak
`src/app/globals.css`, `src/components/app-nav.tsx`, `src/components/app-shell.tsx`, `src/components/page-kit.tsx`, `src/app/(app)/dashboard/view.tsx`, `src/app/(app)/dashboard/widgets.tsx`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.11.1] 2026-11-03
**Ringkasan:** Perpindahan antar halaman lebih mulus dengan Motion (sudah terpasang sejak 0.8.0, belum dimaksimalkan).

### Changed
- Menu samping: penanda menu aktif berupa pil yang meluncur antar menu (`layoutId` Motion, pegas) dan langsung pindah saat menu diklik, tanpa menunggu halaman tujuan selesai dirender server. Mengikuti setting "kurangi gerakan".
- Animasi masuk halaman (`template.tsx`) memakai pegas dengan geser 14px dan skala halus, fade lebih cepat dari geseran.

### Verifikasi
- `tsc`, `eslint` lolos; dev server tanpa error.
- **Belum dilihat di browser dengan login** (menu samping ada di balik login).

### File terdampak
`src/components/app-nav.tsx`, `src/app/(app)/template.tsx`, `devlog.md`, `VERSION`, `package.json`

---

## [0.11.0] 2026-11-03
**Ringkasan:** Modul Kasir (PRD §8): shift kas, penjualan part langsung (POS), invoice work order, pembayaran split, DP, bayar tempo & piutang, PPN dari tarif bertanggal, batas diskon dengan PIN, dan pengakuan komisi mekanik. Menutup alur servis: WO Siap Diambil, invoice, bayar, serahkan.

### Added
- Migration `20261103000014_cashier.sql`:
  - Tabel `cash_shifts` (SH-YYMM-####, satu shift terbuka per kasir), `cash_movements` (kas keluar kecil dengan akun beban), `sales`/`sale_items` (INV-YYMM-####; sumber `pos` atau `work_order`; status draft/posted/void + `void_reason`), `payments` (append-only; metode tunai, transfer, QRIS, kartu, DP; jenis `sale` atau `deposit`), `commissions`, `tax_rates` (tarif PPN bertanggal: 12%, DPP 11/12, berlaku sejak 2025-01-01).
  - Alur jurnal: semua tagihan masuk Piutang Usaha lebih dulu, tiap pembayaran/DP yang dipakai melunasinya, jadi saldo Piutang selalu sama dengan tagihan belum lunas. Invoice: Dr Piutang, Dr HPP; Cr Pendapatan Jasa, Penjualan Sparepart, PPN Keluaran, Persediaan (POS) atau Persediaan dalam Pengerjaan (WO). Bayar: Dr Kas/Bank, Cr Piutang. DP: Dr Kas/Bank, Cr Uang Muka Pelanggan; DP dipakai: Dr Uang Muka, Cr Piutang.
  - Fungsi: `open_shift`, `add_cash_out`, `close_shift` (uang fisik per pecahan, selisih wajib dicatat), `approve_shift` (selisih dijurnal ke Selisih Kas; kasir tidak bisa menyetujui shift sendiri), `save_sale` (draft = transaksi ditahan), `post_sale`, `post_work_order_invoice`, `preview_work_order_invoice` (total persis termasuk PPN tanpa menyimpan), `pay_sale`, `record_deposit`, `void_payment` (hanya selama shift pembayaran terbuka), `void_sale` (pembayaran harus dibatalkan dulu; invoice butuh izin approve atau PIN; stok POS dikembalikan, jurnal dibalik).
  - Uang hanya diterima di shift terbuka; non-tunai direkap terpisah per shift.
  - Batas diskon per peran dari setting (`discount_limit_cashier` 5%, `discount_limit_admin` 10%, Owner bebas); di atasnya wajib PIN Owner/Admin.
  - Tempo: sisa tagihan butuh pelanggan terdaftar dan batas kredit cukup, atau PIN Owner (`receivables`). Jatuh tempo dari termin pelanggan.
  - PPN: saklar `ppn_enabled` tetap di setting; tarif dari `tax_rates` menurut tanggal transaksi; mendukung harga belum/sudah termasuk PPN (`prices_include_ppn`); dihitung per dokumen dari baris kena pajak setelah diskon, dibulatkan ke rupiah.
  - Komisi mekanik: dicatat saat invoice (harga jasa setelah diskon, tanpa PPN x persen/nominal x porsi mekanik), diakui saat invoice lunas, kembali tertunda jika pembayaran dibatalkan, batal jika invoice dibatalkan.
  - View `v_sales`, `v_cash_shifts`, `v_ar_customers` (umur piutang 0-30, 31-60, > 60 hari).
  - RLS: penjualan/pembayaran untuk izin `sales`/`receivables`; shift untuk `cash_shift`; komisi penuh atau milik sendiri (mekanik).
- Tes DB `supabase/tests/cashier_test.sql` (62 tes).
- Halaman `/kasir` (status shift, kas masuk/keluar, siap ditagih, transaksi ditahan, terakhir), `/kasir/penjualan` dan detail invoice (rincian, pembayaran, batal, cetak, kirim WhatsApp), `/kasir/piutang` (rekap per pelanggan dan umur), `/kasir/shift` dan detail (rekap kas, non-tunai, persetujuan, cetak laporan).
- Dialog: buka/tutup shift (hitung per pecahan), kas keluar, penjualan part (cari barang, pelanggan, diskon, lanjut bayar), pembayaran split dengan kembalian dan PIN bila diminta, invoice WO, terima DP.
- Kartu **Penagihan** di detail WO (DP, buat invoice, status tagihan).
- Gaya cetak: sidebar dan top bar disembunyikan saat mencetak.

### Changed
- Penyerahan kendaraan (`delivered`) butuh invoice terlebih dahulu (kecuali WO garansi atau total nol). WO yang sudah diinvoice terkunci dari perubahan dan status mundur; batalkan invoice untuk mengubahnya.
- `app.lock_open_wo` dan `public.set_work_order_status` ditulis ulang untuk aturan di atas.
- Tes servis diperbarui: WO diinvoice dulu sebelum diserahkan.
- Menu sidebar **Kasir** aktif.

### Catatan
- Belum ada: retur penjualan (uang kembali/potong piutang/tukar barang, barang rusak ke karantina), batas waktu retur, cetak thermal 58/80 mm khusus (cetak memakai dialog cetak browser), scan QR di POS, harga bertingkat, PDF.
- Masa garansi masih dihitung dari tanggal kendaraan diserahkan (sama dengan tanggal invoice pada alur normal), belum dari tanggal invoice.
- Komisi baru tercatat dan diakui; pembayarannya lewat modul Penggajian (menyusul). Pengaturan batas diskon belum punya layar, diubah lewat tabel `settings`.
- Batas diskon memakai persen dari harga normal seluruh transaksi; persetujuan PIN tidak membatasi persen penyetuju (Admin 10% belum ditegakkan terhadap penyetuju).

### Verifikasi
- `npm run test:db`: 62 tes kasir + semua tes lama lulus (311 tes).
- `tsc`, `eslint`, `npm run check:dashes`, `next build` lolos. Bentuk query PostgREST halaman kasir dicek terhadap DB lokal (service role, baca saja).
- Rute `/kasir/*` mengarahkan ke login tanpa sesi dan tidak ada error di log dev.
- **Belum diverifikasi di browser dengan login.**

### File terdampak
`supabase/migrations/20261103000014_cashier.sql`, `supabase/tests/cashier_test.sql`, `supabase/tests/service_orders_test.sql`, `src/app/(app)/kasir/**`, `src/app/(app)/servis/[id]/page.tsx`, `src/lib/cashier.ts`, `src/lib/validation/cashier.ts`, `src/lib/navigation.ts`, `src/components/app-nav.tsx`, `src/app/globals.css`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.10.0] 2026-11-03
**Ringkasan:** Modul Servis (PRD §7): estimasi berversi dengan persetujuan pelanggan, work order, papan status kanban, pengeluaran part dari gudang, riwayat servis kendaraan, dan klaim garansi.

### Added
- Migration `20261103000013_service_orders.sql`:
  - Tabel `estimates`/`estimate_items` (EST-YYMM-####; revisi = baris baru dengan nomor sama dan versi + 1, versi lama berstatus `revised`; status draft, sent, approved, rejected, revised, converted, void + `void_reason`; cara persetujuan langsung/telepon/chat; masa berlaku), `work_orders`/`work_order_items` (WO-YYMM-####; plat & label kendaraan disimpan sebagai snapshot), `work_order_mechanics` (mekanik per jasa + porsi %), `part_issues` (append-only), `work_order_status_logs`.
  - Baris jasa/part memakai harga master; paket dipecah lewat `package_components()` (alokasi harga PRD §17.3).
  - Fungsi: `save_estimate`, `mark_estimate_sent`, `approve_estimate` (opsional langsung jadi WO), `convert_estimate_to_work_order`, `reject_estimate`, `void_estimate`, `update_work_order`, `add_work_order_work` (pekerjaan tambahan = estimasi tambahan; WO "Menunggu Persetujuan" sampai pelanggan memutuskan), `cancel_work_order_item`, `set_work_order_mechanics` (porsi kosong = bagi rata), `set_work_order_status` (transisi berurutan; QC/siap/diambil hanya jika semua part sudah keluar), `void_work_order`, `request_work_order_part`, `issue_work_order_part`, `return_work_order_part`, `create_warranty_work_order`, `list_mechanics`.
  - Stok berkurang saat part dikeluarkan (`service_usage`) dengan jurnal Dr Persediaan dalam Pengerjaan / Cr Persediaan Sparepart. Part tidak terpakai kembali ke stok (`service_return`, tipe mutasi baru) dengan nilai saat keluar; jumlah & nilai tagihan baris ikut berkurang. WO garansi: biaya part ke Beban Garansi.
  - Kilometer kendaraan diperbarui otomatis dari WO (tidak pernah mundur).
  - View `v_work_orders` (total, jasa, part, mekanik, lama di status, `is_overdue`, part belum keluar/diminta, garansi s/d, estimasi tambahan yang menunggu) dan `v_estimates` (penanda versi terbaru).
  - RLS: estimasi untuk izin `service_orders` lingkup penuh; WO & turunannya untuk izin penuh `service_orders`/`service_board`, mekanik (lingkup `own`) hanya WO yang ia kerjakan. Mekanik bisa mengubah status WO miliknya (kecuali menyerahkan kendaraan) dan meminta part; keluarkan/kembalikan part butuh `part_issue:update` (Admin, Gudang).
- Tes DB `supabase/tests/service_orders_test.sql` (75 tes).
- Halaman `/servis`: papan kanban 6 kolom (Antri sampai Siap Diambil) dengan plat, mekanik, lama di status, tanda merah lewat estimasi durasi, mode layar penuh untuk TV, segar otomatis tiap 30 detik, dan daftar selesai/batal 14 hari terakhir.
- `/servis/estimasi` dan `/servis/estimasi/[id]`: daftar & detail estimasi, kirim lewat WhatsApp (klik-ke-chat berisi ringkasan), catat persetujuan/penolakan, jadikan WO, revisi (versi), batalkan.
- `/servis/[id]`: detail WO (ubah status, atur mekanik, minta/keluarkan/kembalikan part per rak, batalkan baris, pekerjaan tambahan, estimasi tambahan yang menunggu, data WO, riwayat status, keluar-masuk part, klaim garansi).
- Pop-up estimasi baru: pilih kendaraan lewat nomor polisi (menampilkan servis terakhir), cari jasa/paket/part, diskon baris & total, catat persetujuan dan langsung buat WO.
- Riwayat servis di `/pelanggan/kendaraan/[id]` + tombol estimasi untuk kendaraan tersebut.
- Helper `formatDuration` dan `addDays` (`src/lib/format.ts`).

### Changed
- `app.post_stock_movement` menerima tipe `service_return` (masuk dengan nilai yang dibawa).
- Menu sidebar **Servis & Work Order** aktif.

### Catatan
- Invoice, pembayaran, DP, dan komisi final menyusul di modul Kasir. Sampai saat itu WO bisa diserahkan tanpa invoice; masa garansi dihitung dari tanggal diserahkan.
- PPN di estimasi menyusul bersama modul Pajak. Scan QR saat mengeluarkan part menunggu fitur QR label. Papan memakai segar otomatis 30 detik, belum Supabase Realtime. Laporan klaim garansi per mekanik/barang/supplier belum ada.

### Verifikasi
- `npm run test:db`: 75 tes servis + semua tes lama lulus (248 tes).
- `tsc`, `eslint`, `npm run check:dashes`, `next build` lolos. Bentuk query PostgREST halaman servis dicek terhadap DB lokal (service role, baca saja).
- **Belum diverifikasi di browser dengan login.**

### File terdampak
`supabase/migrations/20261103000013_service_orders.sql`, `supabase/tests/service_orders_test.sql`, `src/app/(app)/servis/**`, `src/app/(app)/pelanggan/kendaraan/[id]/page.tsx`, `src/lib/service.ts`, `src/lib/validation/service.ts`, `src/lib/format.ts`, `src/lib/navigation.ts`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.9.0] 2026-11-03
**Ringkasan:** Modul Pelanggan & Kendaraan (PRD §6.1-6.2): pelanggan perorangan/perusahaan, kendaraan per nomor polisi, dan riwayat pergantian pemilik.

### Added
- Migration `20261103000012_customers_vehicles.sql`: `customers` (CUS-00001, perorangan/perusahaan, batas kredit & termin khusus perusahaan), `vehicles` (plat unik tanpa memedulikan spasi, merek/model ke master `vehicle_models`, transmisi, bahan bakar, nomor rangka/mesin, kilometer), `vehicle_ownerships` (satu pemilik aktif per kendaraan, riwayat tersimpan), view `v_vehicles` (kendaraan + pemilik saat ini).
  - Fungsi `save_customer`, `set_customer_active`, `save_vehicle` (merek/model dari teks dibuat otomatis bila belum ada; kilometer tidak bisa mundur), `transfer_vehicle` (pindah pemilik), `set_vehicle_active`.
  - Normalisasi di database: nomor HP disimpan seragam `08xxxxxxxx`; plat nomor `B 1234 KJT`.
  - Izin: modul `customers` (Admin penuh, Kasir lihat+buat, Mekanik lihat).
- Tes DB `supabase/tests/customers_test.sql` (17 tes).
- Halaman `/pelanggan` (cari nama, HP, kode, atau **nomor polisi**; filter perorangan/perusahaan), `/pelanggan/[id]` (profil, ringkasan, kendaraan dimiliki & pernah dimiliki, tambah kendaraan untuk pelanggan ini), `/pelanggan/kendaraan` (cari plat/pemilik/model), `/pelanggan/kendaraan/[id]` (data kendaraan, pemilik & riwayatnya, pindah pemilik). Tambah pelanggan & kendaraan lewat pop-up.

### Changed
- Menu sidebar **Pelanggan** aktif.

### Catatan
- Total belanja, piutang, transaksi terakhir, riwayat servis, dan reminder servis berkala (PRD §6.3-6.4) terisi setelah modul Servis & Kasir.

### Verifikasi
- `npm run test:db`: 17 tes pelanggan + semua tes lama lulus (175 tes). `tsc`, `eslint`, `npm run check:dashes`, `next build` lolos.
- Bentuk query PostgREST halaman pelanggan dicek terhadap DB lokal.
- **Belum diverifikasi di browser dengan login.**

### File terdampak
`supabase/migrations/20261103000012_customers_vehicles.sql`, `supabase/tests/customers_test.sql`, `src/app/(app)/pelanggan/**`, `src/lib/customers.ts`, `src/lib/validation/customer.ts`, `src/lib/navigation.ts`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.8.0] 2026-11-03
**Ringkasan:** Semua form tambah data dibuka sebagai pop-up (tanpa pindah halaman) dan animasi halus memakai Motion (Framer Motion).

### Added
- `FormDialog` (`src/components/form-dialog.tsx`): pop-up form besar berbasis Dialog Base UI. HP: panel naik dari bawah; tablet ke atas: di tengah. Animasi masuk dengan Motion (pegas), mengikuti setting "kurangi gerakan" perangkat. Tutup lewat tombol X, Batal, klik luar, atau Esc.
- `useCreateDialog`: setelah simpan, pop-up tertutup, toast "berhasil" dengan tombol **Buka** ke detail, dan daftar di halaman yang sama diperbarui.
- Pop-up tambah untuk: karyawan, role, barang, jasa, paket servis, supplier, PO, dan penerimaan barang (tanpa PO dari daftar PO/penerimaan; dari PO lewat tombol **Terima barang** di detail PO, terisi sisa pesanan).
- Toast (`sonner`) yang mengikuti tema terang/gelap (`AppToaster`).
- Animasi perpindahan halaman (`src/app/(app)/template.tsx`, Motion). Muatan pertama tidak dianimasikan agar konten server langsung tampil.
- `CancelButton`: di pop-up menjadi tombol "Batal", di halaman biasa link kembali.
- `receipt-data.ts`: data form penerimaan (termasuk isi otomatis dari sisa PO) dipakai bersama pop-up & halaman.
- Pratinjau development `/dev/preview/form-dialog` (404 di production).
- Dependensi: `motion` 14, `sonner` 2.

### Changed
- Form tambah menerima `onDone`/`onCancel`; tanpa itu (halaman `/baru` lama) tetap pindah ke halaman detail. Halaman detail/ubah tetap halaman karena memuat stok, riwayat, dan aksi lain.

### Fixed
- Pesan error bawaan PostgreSQL berbahasa Inggris (mis. "permission denied for function") kini diganti pesan Indonesia sesuai kodenya.

### Verifikasi
- Browser `/dev/preview/form-dialog`: desktop 1280px (di tengah), HP 375px (panel dari bawah, tidak melebar), validasi tampil di pop-up, Esc menutup, error server tampil dalam bahasa Indonesia.
- `tsc`, `eslint`, `npm run check:dashes` (155 file), `next build` lolos.
- Pop-up di halaman yang butuh login belum dicoba langsung dengan login.

### File terdampak
`src/components/form-dialog.tsx`, `src/components/app-toaster.tsx`, `src/components/cancel-button.tsx`, `src/components/topbar-controls.tsx`, `src/lib/action-result.ts`, `src/app/(app)/template.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/{karyawan,inventory,pembelian}/**`, `src/app/dev/preview/form-dialog/page.tsx`, `package.json`, `package-lock.json`, `devlog.md`, `fitur.md`, `VERSION`

---

## [0.7.3] 2026-11-03
**Ringkasan:** Perbaiki halaman HP yang bisa digeser ke samping.

### Fixed
- Kotak isian, select, dan pencarian (`inputClass`) kini bertekstur 17px di HP (15px mulai 640px). Sebelumnya 15px membuat Safari iOS otomatis zoom saat kotak diketuk, sehingga halaman terasa harus digeser ke kanan.
- Pengaman `overflow-x: clip` pada `html`/`body`: elemen yang sedikit melebar tidak lagi membuat seluruh halaman bisa digeser. Memakai `clip` agar top bar sticky tetap berfungsi.
- `inputClass` ditambah `min-w-0` agar select dengan pilihan panjang bisa menyusut di layar sempit.

### Verifikasi
- Browser `/dev/preview` pada lebar 320, 360, 375px: lebar halaman = lebar layar, tidak ada elemen melebar; top bar tetap menempel saat digulir. Halaman login 320px aman.
- Halaman yang butuh login (Karyawan, Barang, Pembelian) diperiksa lewat kode; belum dilihat langsung dengan login.
- `tsc`, `eslint`, `npm run check:dashes` lolos.

### File terdampak
`src/components/page-kit.tsx`, `src/app/globals.css`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.7.2] 2026-11-03
**Ringkasan:** Sidebar berujung bulat penuh dengan logo AutoMobi bertulisan; kartu login/setup bersudut kecil dengan bayangan tipis.

### Changed
- Sidebar: radius 28px menjadi 36px (maksimal untuk rail 72px, jadi kapsul penuh saat ciut).
- Logo sidebar: saat bentang memakai logo lengkap "AutoMobi" di kotak putih, nama cabang di bawahnya; saat ciut memakai ikon di lingkaran putih.
- Kartu login & setup: radius 12,8px (sama dengan kartu dashboard) dan bayangan tipis yang sama.

### Verifikasi
- `tsc`, `eslint`, `npm run check:dashes` lolos. Browser: sidebar ciut (tablet) & bentang (desktop 1440px), halaman login (radius 12,8px, bayangan tampil).
- `next build` tidak dijalankan ulang (hanya perubahan kelas CSS).

### File terdampak
`src/components/app-shell.tsx`, `src/components/app-nav.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/setup/page.tsx`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.7.1] 2026-11-03
**Ringkasan:** Hapus semua tanda pisah panjang (em dash dan en dash) dari UI, kode, SQL, dan dokumen.

### Changed
- Placeholder pilihan seperti "Pilih supplier" tanpa tanda pisah; nilai kosong ditampilkan sebagai "-"; rentang angka memakai tanda minus biasa ("5-20 digit", "0-30 hari").
- Komentar kode, file migration, tes, `CLAUDE.md`, `devlog.md`, `fitur.md`, `Dockerfile` ikut dibersihkan. Judul versi devlog kini `## [x.y.z] YYYY-MM-DD`.
- `CLAUDE.md` Cara Kerja #4: larangan memakai tanda pisah panjang di mana pun.

### Added
- Migration `20261103000011_remove_long_dashes.sql`: menulis ulang fungsi database yang pesan errornya masih memakai tanda pisah (5 fungsi: `employee_fields`, `save_role`, `save_item`, `save_unit`, `save_supplier`); hak akses fungsi tetap.
- `npm run check:dashes` (`scripts/check-dashes.mjs`): pengecek otomatis seluruh file yang di-track git.

### Catatan
- `AGENTS.md` (dibuat ulang otomatis oleh `next dev`) dan `supabase/config.toml` (bawaan Supabase CLI) tidak diubah.

### Verifikasi
- `npm run check:dashes`: 145 file bersih. Di database: 0 fungsi tersisa yang memuat tanda pisah, izin eksekusi tetap.
- `npm run test:db` semua lulus, `tsc`, `eslint`, `next build` lolos.

### File terdampak
34 file sumber & dokumen, `supabase/migrations/20261103000011_remove_long_dashes.sql`, `scripts/check-dashes.mjs`, `package.json`, `CLAUDE.md`, `devlog.md`, `fitur.md`, `VERSION`

---

## [0.7.0] 2026-11-03
**Ringkasan:** Modul Pembelian, Supplier & Hutang (PRD §5) beserta inti akuntansi: setiap penerimaan, retur, dan pembayaran membuat stok + HPP + hutang + jurnal dalam satu transaksi.

### Added
- Migration `20261103000009_accounting_core.sql`: `accounts` (bagan akun default PRD §11.2, 32 akun dengan `system_key`), `cash_bank_accounts` (Kas Laci, Bank), `journal_entries` + `journal_lines` (append-only, nomor JU-YYMM-####). `app.post_journal()` menolak jurnal tidak seimbang; `app.reverse_journals()` untuk pembatalan dokumen. Jurnal hanya terbaca dengan izin jurnal/laporan keuangan. Setting `ppn_enabled` (default OFF).
- Migration `20261103000010_purchasing.sql`: `suppliers` (SUP-001, termin), `purchase_orders`/`purchase_order_items` (Draft → Dikirim → Diterima Sebagian/Penuh → Ditutup/Dibatalkan), `goods_receipts`/`goods_receipt_items` (GR-YYMM), `purchase_returns`/`purchase_return_items` (RB-YYMM), `supplier_payments`/`supplier_payment_allocations` (BS-YYMM), view `v_ap_receipts` (sisa hutang, hari lewat jatuh tempo, umur 0-30/31-60/>60).
  - `post_goods_receipt`: satuan beli → satuan dasar, diskon per baris, tolak melebihi sisa PO, jatuh tempo otomatis dari termin, PPN **masuk HPP** (tidak PKP, dialokasikan proporsional) atau **PPN Masukan** (PKP), update status PO, jurnal *Persediaan (+PPN Masukan) / Hutang Usaha*, opsi bayar langsung.
  - `post_purchase_return`: dinilai harga faktur, stok keluar pada HPP rata-rata, selisih ke *Selisih Persediaan*, PPN Masukan dibalik proporsional, potong hutang (tidak boleh melebihi sisa) atau uang kembali.
  - `post_supplier_payment` (sebagian / banyak faktur, kunci baris faktur), `void_supplier_payment` (jurnal pembalik).
  - Izin: pembelian `purchasing`; bayar/batal hutang `payables` (default hanya Owner).
- Tes DB `supabase/tests/purchasing_test.sql` (42 tes: alur PO → terima sebagian → terima + PPN → PKP, HPP, jurnal seimbang & saldo akun, bayar/batal, retur potong hutang & uang kembali, akses).
- Halaman `/pembelian` (PO), `/pembelian/po/baru` & `/[id]` (form PO + saran dari stok menipis, aksi kirim/terima/tutup/batal), `/pembelian/penerimaan` (+ `baru?po=` terisi otomatis dari sisa PO, `/[id]` detail + retur), `/pembelian/hutang` (ringkasan, umur hutang, jatuh tempo ≤ 3 hari, bayar beberapa faktur sekaligus, riwayat + batal), `/pembelian/supplier` (+ baru/[id] dengan riwayat PO, penerimaan, sisa hutang).
- Komponen `ItemPicker` (cari barang nama/SKU, dipakai ulang untuk kasir/servis), helper `todayWib()`, `src/lib/validation/common.ts` (`toNumber` bersama).

### Changed
- Menu sidebar **Pembelian** aktif.

### Catatan
- Pembatalan penerimaan barang belum ada; koreksi lewat retur ke supplier.
- Menyusul: cetak/kirim PO (PDF/WhatsApp), foto faktur, UI Finance (kas/bank, jurnal, laporan), pengingat hutang H-3 di dashboard.

### Verifikasi
- `npm run test:db`: 42 tes pembelian + 44 inventory + 37 karyawan + 33 fondasi lulus. `tsc`, `eslint`, `next build` lolos.
- Bentuk query PostgREST semua halaman pembelian dicek terhadap DB lokal.
- **Belum diverifikasi di browser dengan login.**

### File terdampak
`supabase/migrations/20261103000009_accounting_core.sql`, `supabase/migrations/20261103000010_purchasing.sql`, `supabase/tests/purchasing_test.sql`, `src/app/(app)/pembelian/**`, `src/lib/purchasing.ts`, `src/lib/validation/purchasing.ts`, `src/lib/validation/common.ts`, `src/lib/validation/inventory.ts`, `src/lib/format.ts`, `src/components/item-picker.tsx`, `src/lib/navigation.ts`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.6.0] 2026-11-03
**Ringkasan:** Modul Master Data & Inventory (PRD §4): barang, jasa, paket servis, kategori/merek/satuan/lokasi, dan ledger stok dengan HPP rata-rata tertimbang.

### Added
- Migration `20261103000006_master_data.sql`: tabel `item_categories` (2 tingkat), `brands`, `units`, `locations` (Area › Rak › Bin), `items`, `item_units` (konversi), `item_part_numbers`, `vehicle_makes`/`vehicle_models`/`item_compatibilities`, `service_categories`, `services`, `packages`, `package_items`, `price_history` (trigger otomatis). RLS baca per cabang; tulis hanya lewat fungsi `save_item`, `save_service`, `save_package`, `save_item_category`, `save_brand`, `save_unit`, `save_location`, `save_service_category`, `set_master_active`. Kode otomatis BRG-00001, JS-001, PKT-001. `package_components()` mengalokasikan harga paket proporsional terhadap harga normal (sisa pembulatan ke komponen termahal). Data awal: 8 satuan, 6 kategori jasa, area "GDG Gudang Utama".
- Migration `20261103000007_stock_ledger.sql`: `stock_movements` (append-only, 9 tipe mutasi), `stock_balances` (cache), `item_costs` (HPP). `app.post_stock_movement()` satu-satunya jalur tulis stok: kunci per barang, HPP rata-rata tertimbang pada mutasi masuk bernilai, keluar dinilai HPP rata-rata, tolak stok minus kecuali setting `allow_negative_stock` (pindah lokasi tetap tidak boleh minus). `post_opening_stock` (saldo awal, Owner saja), `transfer_stock` (pindah lokasi berpasangan). View `v_stock_on_hand`, `v_low_stock` (security_invoker).
- **HPP rahasia** (PRD §10.2): `item_costs` hanya terbaca dengan izin laporan keuangan; kolom `stock_movements.unit_cost` tidak diberikan ke pengguna.
- Migration `20261103000008_price_change_guard.sql`: perubahan harga data yang sudah ada selalu butuh izin `price_change` (sebelumnya perubahan ke 0 lolos).
- Tes DB `supabase/tests/inventory_test.sql` (44 tes).
- Halaman `/inventory` (Barang: cari nama/SKU/part number/merek, filter Aktif/Stok menipis/Nonaktif, TanStack Table v9; kartu di HP), `/inventory/barang/baru`, `/inventory/barang/[id]` (form + konversi satuan + part number, stok per lokasi, saldo awal, pindah lokasi, 50 mutasi terakhir, riwayat harga, HPP bila berizin), `/inventory/jasa` (+ baru/[id]: durasi, komisi persen/nominal, garansi, PPN), `/inventory/paket` (+ baru/[id]: komponen barang/jasa, harga normal vs paket, alokasi), `/inventory/master` (lokasi, kategori, satuan, merek, kategori jasa: tambah/ubah di baris/nonaktifkan).
- Komponen bersama `src/components/page-kit.tsx`, `src/lib/action-result.ts`, `src/lib/format.ts` (Rupiah/angka/tanggal WIB); modul Karyawan ikut memakainya.

### Changed
- Menu sidebar **Barang & Jasa** aktif.
- `scripts/test-db.mjs`: URL database dikirim lewat env container, tidak lagi tercetak (dengan password) saat tes gagal.

### Catatan
- Menyusul (0.6.x): QR label & scan, foto barang, UI kompatibilitas kendaraan. Stok bertambah lewat modul Pembelian (berikutnya); saldo awal untuk persiapan go-live.
- Satuan HPP disimpan `numeric(18,2)` sesuai aturan uang proyek.

### Verifikasi
- `npm run test:db`: 44 tes inventory + 37 karyawan + 33 fondasi lulus. `tsc`, `eslint`, `next build` lolos.
- Bentuk query PostgREST semua halaman inventory dicek terhadap DB lokal.
- **Belum diverifikasi di browser dengan login.**

### File terdampak
`supabase/migrations/2026110300000{6,7,8}_*.sql`, `supabase/tests/inventory_test.sql`, `scripts/test-db.mjs`, `src/app/(app)/inventory/**`, `src/lib/inventory.ts`, `src/lib/validation/inventory.ts`, `src/lib/format.ts`, `src/lib/action-result.ts`, `src/components/page-kit.tsx`, `src/app/(app)/karyawan/_components/ui.tsx`, `src/app/(app)/karyawan/actions.ts`, `src/lib/navigation.ts`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.5.1] 2026-11-03
**Ringkasan:** Perbaiki peringatan Base UI pada tombol yang dirender sebagai link.

### Fixed
- "Base UI: A component that acts as a button expected a native <button>…": `Button` dengan `render={<Link />}` (Tambah karyawan, Tambah role, Batal/Kembali, Buka detail karyawan) kini memakai `nativeButton={false}` agar semantik link benar.

### Verifikasi
- `tsc`, `eslint` lolos; log dev server tidak berisi error lain selain peringatan ini (muncul 3× di `/karyawan`, `/karyawan/role`, `/karyawan/baru`).

### File terdampak
`src/app/(app)/karyawan/page.tsx`, `src/app/(app)/karyawan/role/page.tsx`, `src/app/(app)/karyawan/_components/employee-form.tsx`, `src/app/(app)/karyawan/_components/role-form.tsx`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.5.0] 2026-11-03
**Ringkasan:** Modul Karyawan & Role (PRD §2, §10.1-10.2, §16): kelola karyawan, role ganda, status, akun login, PIN, role dinamis dengan matriks hak akses.

### Added
- Migration `20261103000005_employee_management.sql`: semua perubahan lewat fungsi atomik di database (izin dicek di DB, tercatat audit log):
  - `create_employee`, `update_employee` (validasi & normalisasi NIK 16 digit, HP, rekening; kode `EMP-YYMM-####` otomatis).
  - `set_employee_roles` (role ganda), `set_employee_status` (alasan wajib saat Nonaktif; tersimpan di `employee_status_history.reason`).
  - `link_employee_account` (hanya akun Auth baru ≤10 menit & belum terhubung), `employee_account_for_reset` (atur ulang password, diaudit).
  - `set_my_pin`, `employee_has_pin`; `save_role` (role baru/ubah + matriks izin sekaligus), `set_role_active`.
  - Pengaman: non-Owner tidak bisa memberi/mengubah role atau data Owner; **tanpa eskalasi hak** (non-Owner hanya bisa memberi izin yang ia miliki); minimal satu Owner aktif; tidak bisa mengubah status diri sendiri; role Owner terkunci; role bawaan tidak bisa dinonaktifkan; role nonaktif tidak bisa diberikan.
  - Kolom `permissions.sort_order` (urutan modul untuk matriks).
- Tes DB `supabase/tests/employee_management_test.sql` (37 tes: validasi, role ganda, status & blokir login, akun, batas Owner, admin/HR tanpa eskalasi, role, PIN).
- Halaman `/karyawan`: daftar dengan pencarian & filter status (TanStack Table v9; kartu di HP), `/karyawan/baru` (data + role + akun login opsional), `/karyawan/[id]` (ubah data, role, akun login/atur ulang password, PIN sendiri, status + riwayat).
- Halaman `/karyawan/role`, `/karyawan/role/baru`, `/karyawan/role/[id]`: daftar role (jumlah anggota & izin) dan matriks izin modul × aksi (Lihat/Buat/Ubah/Batal/Setujui/Ekspor; lingkup "semua" atau "hanya data sendiri").
- Validasi Zod bersama (`src/lib/validation/employee.ts`), data fetcher (`src/lib/employees.ts`), server actions (`src/app/(app)/karyawan/actions.ts`). Akun login dibuat lewat Auth Admin API lalu ditautkan oleh DB; dihapus lagi bila penautan gagal.
- Dependensi: `@tanstack/react-table` 9; komponen shadcn checkbox, select, textarea, dialog, table, tabs.

### Changed
- Menu sidebar **Karyawan** aktif; "Profil saya" di menu profil membuka detail karyawan sendiri.
- Sidebar HP ditutup saat link menu diklik (sebelumnya lewat `usePathname` di kerangka, yang memblokir build route dinamis di luar Suspense).
- `FormError` & catatan login memakai token tema (ikut mode gelap).

### Catatan
- Komisi mekanik & penggajian (PRD §10.3-10.4) menunggu modul Servis & Finance.
- Endpoint REST `/api/v1` khusus karyawan belum dibuat; fungsi DB di atas bisa dipanggil klien mana pun lewat Supabase RPC dengan aturan yang sama.

### Verifikasi
- `npm run test:db`: 37 tes baru + 33 tes fondasi lulus. `tsc`, `eslint`, `next build` lolos.
- Bentuk query PostgREST (relasi profil & role, hitungan anggota/izin) dicek terhadap DB lokal.
- Browser: menu Karyawan aktif, `/karyawan` tanpa login dialihkan ke `/login`, dashboard tetap normal.
- **Belum diverifikasi di browser dengan login** (halaman karyawan butuh sesi asli).

### File terdampak
`supabase/migrations/20261103000005_employee_management.sql`, `supabase/tests/employee_management_test.sql`, `src/app/(app)/karyawan/**`, `src/lib/employees.ts`, `src/lib/validation/employee.ts`, `src/lib/navigation.ts`, `src/components/app-nav.tsx`, `src/components/app-shell.tsx`, `src/components/topbar-controls.tsx`, `src/components/form-field.tsx`, `src/components/ui/*`, `src/app/(auth)/login/login-form.tsx`, `package.json`, `package-lock.json`, `devlog.md`, `fitur.md`, `VERSION`

---

## [0.4.5] 2026-11-03
**Ringkasan:** Logo baru AutoMobi (latar transparan) di sidebar, login/setup, dan favicon.

### Added
- `scripts/make-logo.mjs` (sharp): mengubah `design/automobi-logo-source.jpg` (latar hitam) menjadi PNG transparan. Tiap piksel digolongkan ke warna logo (merah mobil, navy kunci, biru tulisan) dan dibuat solid; alpha dari kecerahan → tepi halus tanpa garis gelap.
- Aset: `public/brand/automobi-logo.png` (latar terang), `public/brand/automobi-logo-dark.png` (mode gelap: navy & biru dicerahkan ke `#7DAACB` agar terbaca), `public/brand/automobi-mark.png` (ikon mobil + kunci), `src/app/icon.png` (favicon).

### Changed
- Sidebar: tile merah ikon kunci → tile putih berisi ikon AutoMobi; nama "AutoMobi" + nama cabang.
- Login/setup: logo lengkap AutoMobi (otomatis varian terang/gelap).
- Judul tab browser: "AutoMobi".

### Removed
- `src/app/favicon.ico` bawaan Next (diganti `icon.png`).

### Verifikasi
- `tsc`, `eslint`, `next build` lolos; aset `/brand/*` & `/icon.png` bisa diakses tanpa login (200).
- Browser: sidebar HP terbuka, login terang & gelap, console bersih.

### File terdampak
`scripts/make-logo.mjs`, `design/automobi-logo-source.jpg`, `public/brand/*`, `src/app/icon.png`, `src/app/favicon.ico`, `src/components/app-shell.tsx`, `src/app/(auth)/layout.tsx`, `src/app/layout.tsx`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.4.4] 2026-11-03
**Ringkasan:** Radius sudut kartu dashboard diperkecil.

### Changed
- Kartu dashboard `rounded-3xl` (±35px) → `rounded-md` (12,8px), termasuk skeleton & kartu merah stok menipis.
- Elemen di dalam kartu (item notifikasi, baris WO, tile, ikon, badge, tombol) `rounded-2xl/xl/lg` → `rounded-sm` (9,6px) agar tidak lebih bulat dari kartunya. Bentuk lingkaran (`rounded-full`) tetap.

### Verifikasi
- `tsc`, `eslint`, `next build` lolos; browser 1440px: semua kartu radius 12,8px.

### File terdampak
`src/app/(app)/dashboard/widgets.tsx`, `src/app/(app)/dashboard/view.tsx`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.4.3] 2026-11-03
**Ringkasan:** Peringatan "Encountered a script tag while rendering React component" benar-benar dihilangkan.

### Fixed
- `next/script` (`beforeInteractive`) ternyata tetap menghasilkan elemen `<script>` yang dibuat React di browser saat root layout dirender ulang (Fast Refresh/pemulihan render), sehingga peringatan masih muncul. Skrip tema kini disisipkan lewat `useServerInsertedHTML` (komponen `ThemeScript`): hanya ada di HTML dari server (di `<head>`, satu kali), tidak pernah dirender React di browser.

### Verifikasi
- `tsc`, `eslint`, `next build` lolos; skrip ada tepat 1× di `<head>` HTML dev (`/login`, `/dev/preview`) dan di hasil prerender production (`.next/server/app/*.html`).
- Browser tab baru: mode gelap aktif sebelum hydrate (latar langsung navy), console bersih termasuk setelah `layout.tsx` diubah.

### File terdampak
`src/components/theme-script.tsx`, `src/app/layout.tsx`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.4.2] 2026-11-03
**Ringkasan:** Perbaiki error hydration mismatch tombol sidebar dan peringatan "script tag" skrip tema.

### Fixed
- **Hydration mismatch** (tombol ciut/bentang sidebar & tombol menu HP): tombol berada di dalam Suspense yang di-hydrate belakangan sehingga membaca status sidebar versi browser lewat context, sementara HTML server memakai default. Kini `useSidebar()` membaca store langsung via `useSyncExternalStore` (snapshot server saat hydrate); context hanya membawa `mobileOpen` & `toggle`.
- **"Encountered a script tag while rendering React component"**: skrip tema di `<head>` diganti `next/script` dengan `strategy="beforeInteractive"` (tetap jalan sebelum hydrate, tanpa kedipan).

### Verifikasi
- `tsc`, `eslint`, `next build` lolos.
- Browser tab baru: sidebar posisi ciut + mode gelap setelah reload → tidak ada error di console & log server; halaman login bersih.

### File terdampak
`src/components/app-nav.tsx`, `src/app/layout.tsx`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.4.1] 2026-11-03
**Ringkasan:** Ukuran huruf dinaikkan secara proporsional dan angka metrik diperbesar agar mudah dibaca owner.

### Changed
- Skala teks di tema (`@theme`): `xs` 12→13px, `sm` 14→15px, `base` 16→17px, `lg` 18→19px; ukuran baru `2xs` 12px. Semua teks 10-11px diganti `text-2xs`, jadi minimum 12px.
- Metrik dashboard: persen cincin target 72px dengan angka tebal, progres & durasi work order `text-sm` tebal `tabular-nums` (bar progres lebih tebal), angka stok menipis `text-4xl`.
- Kartu target disusun ulang (judul di atas, cincin + keterangan di bawah) agar label tidak meluber.
- Sidebar bentang 248→264px (konten 280px) agar label menu tidak terlalu terpotong.

### Verifikasi
- `tsc`, `eslint`, `next build` lolos.
- Browser (`/dev/preview`): desktop 1440px, tablet 768px, HP 375px: lebar halaman = layar, tidak ada teks meluber.

### File terdampak
`src/app/globals.css`, `src/app/(app)/dashboard/widgets.tsx`, `src/app/(app)/dashboard/view.tsx`, `src/components/app-nav.tsx`, `src/components/app-shell.tsx`, `src/components/topbar-controls.tsx`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.4.0] 2026-11-03
**Ringkasan:** Dark mode + toggle di top bar; profil, pengaturan, dan keluar dipindah ke top bar.

### Added
- **Dark mode**: palet navy gelap dengan aksen biru moodboard dan merah yang dicerahkan (`.dark` di `globals.css`). Toggle matahari/bulan di kiri ikon notifikasi; pilihan disimpan di browser (`bk_theme`), dipasang skrip kecil di `<head>` sebelum render agar tidak berkedip. Default tetap terang.
- Token baru `brand-blue-fg` (teks biru yang menyesuaikan tema) dan `brand-rail` (latar sidebar).
- **Menu profil** di top bar (komponen shadcn `dropdown-menu`): nama, role · cabang, Profil saya (segera), Pengaturan (segera), Keluar.

### Changed
- Sidebar: kartu profil + tombol keluar dihapus; menu "Pengaturan" dikeluarkan dari sidebar (ikon pengaturan tetap di top bar).
- Teks biru `text-brand-blue-ink` → `text-brand-blue-fg`; menu aktif sidebar memakai `bg-card` agar cocok di dua tema.
- Halaman login/setup memakai token tema (sebelumnya warna zinc tetap).

### Verifikasi
- `tsc`, `eslint`, `next build` lolos.
- Browser: desktop 1440px terang & gelap (semua kartu terbaca, tema bertahan setelah reload), menu profil terbuka, HP 375px & tablet 768px mode gelap tanpa overflow, halaman login mode gelap.

### File terdampak
`src/app/globals.css`, `src/app/layout.tsx`, `src/lib/theme.ts`, `src/components/topbar-controls.tsx`, `src/components/ui/dropdown-menu.tsx`, `src/components/app-shell.tsx`, `src/components/app-nav.tsx`, `src/lib/navigation.ts`, `src/app/(auth)/layout.tsx`, `src/app/(app)/dashboard/*`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.3.5] 2026-11-03
**Ringkasan:** Saat disembunyikan, sidebar menciut menjadi rail ikon (tidak hilang total); tombol panel di top bar dihapus.

### Changed
- Sidebar dua mode: **bentang** (panel berlabel 248px) dan **ciut** (rail ikon 72px: logo, tombol bentang, ikon menu, avatar, keluar). Label muncul sebagai tooltip saat ikon di-hover/fokus.
- Tombol bentang/ciutkan pindah ke dalam sidebar (di bawah logo saat ciut). Pintasan Ctrl/⌘ + B tetap.
- Desktop (≥1024px): konten bergeser 264px ↔ 88px; pilihan disimpan di browser.
- Tablet (768-1023px): default rail ikon (konten bergeser 88px); saat dibentangkan panel melayang di atas konten dengan latar gelap.
- HP (<768px): sidebar tersembunyi; tombol ☰ di top bar hanya tampil di HP untuk membukanya.

### Removed
- Tombol panel di top bar untuk tablet & desktop; komponen `SidebarClose` (diganti `SidebarRailToggle`).

### Verifikasi
- `tsc`, `eslint`, `next build` lolos.
- Browser (`/dev/preview`): desktop 1440px (ciut → rail 72px, konten 88px), tablet 768px (rail default, tooltip, bentang overlay, tutup lewat latar), HP 375px (☰ membuka panel penuh): tidak ada halaman yang melebar.

### File terdampak
`src/components/app-nav.tsx`, `src/components/app-shell.tsx`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.3.4] 2026-11-03
**Ringkasan:** Sidebar diganti menjadi panel melayang (floating) berlabel yang bisa ditampilkan/disembunyikan manual.

### Changed
- Sidebar: panel biru melayang (sudut membulat, bayangan, jarak dari tepi layar) berisi logo + cabang, daftar menu berlabel (ikon dalam kotak, menu aktif putih dengan ikon merah, chip "Segera"), kartu profil + tombol keluar.
- Show/hide manual: tombol di top bar, tombol tutup di dalam panel, pintasan **Ctrl/⌘ + B**.
- Desktop (≥1024px): default tampil, konten bergeser halus; pilihan tampil/sembunyi disimpan di browser (`localStorage`).
- Tablet & HP: default tersembunyi, panel muncul di atas konten dengan latar gelap; tutup lewat klik latar, Esc, atau pindah halaman.
- Top bar: menu sheet HP dan tombol keluar di HP dihapus (sudah ada di sidebar).

### Removed
- Komponen `IconNav` dan `MobileNav` (diganti `SidebarFrame`, `SidebarToggle`, `SidebarClose`, `SideNav`).

### Verifikasi
- `tsc`, `eslint`, `next build` lolos.
- Browser (`/dev/preview`): desktop 1440px (dorong konten, pilihan bertahan setelah reload), tablet 768px & HP 375px (overlay; tombol, klik latar, Esc, Ctrl+B, tombol tutup): tidak ada halaman yang melebar.

### File terdampak
`src/components/app-nav.tsx`, `src/components/app-shell.tsx`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.3.3] 2026-11-03
**Ringkasan:** Redesign dashboard mengikuti referensi baru, dominan biru & merah, responsif HP-tablet-desktop.

### Changed
- Tema: primary biru `#3B6A8C` (turunan gelap `#7DAACB`, kontras teks putih ≥ 4.5:1), aksen biru `#7DAACB`, merah `#CE2626` untuk prioritas/peringatan/sorotan. Latar biru keabuan `#EEF3F7`. Pasir & krem hanya aksen kecil. Token baru `brand-blue-deep`.
- Kerangka: pita biru berisi navigasi ikon dengan tooltip (tablet & desktop), top bar (cari, notifikasi, pengaturan, profil). HP: menu sheet biru berlabel + tombol keluar.
- Dashboard: tab halaman, sapaan "Halo, {nama}! Apa rencana bengkel hari ini?", tile aksi cepat (Work order baru, Terima kendaraan, Kasir cepat, Cek stok), Notifikasi, Pekerjaan mekanik, kalender minggu ini + agenda, Work order hari ini (progres), kartu merah Stok menipis, cincin Target omzet & Piutang tertagih, Tutup kas shift.
- Grid 1 kolom (HP) → 2 kolom (tablet) → 12 kolom (desktop); semua kartu `min-w-0` agar tidak meluber.

### Fixed
- Loop reload tanpa henti di dev: cache Turbopack (`.next/dev`) basi setelah refactor nama export. Cache dihapus; `experimental.mcpServer: false` juga dimatikan agar dev tidak menulis log file per request.

### Verifikasi
- `tsc`, `eslint`, `next build` lolos.
- Browser (`/dev/preview`): desktop 1440px, tablet 768px, HP 375px: lebar halaman = lebar layar, tidak ada kartu yang meluber.

### File terdampak
`src/app/globals.css`, `src/components/app-shell.tsx`, `src/components/app-nav.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/dashboard/*`, `src/app/dev/preview/page.tsx`, `src/lib/demo/dashboard.ts`, `next.config.ts`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.3.2] 2026-11-03
**Ringkasan:** Tema warna moodboard + redesign layout & dashboard ala referensi, dengan konteks bengkel.

### Changed
- Tema light mode (`globals.css`): merah `#CE2626` (aksi utama), biru `#7DAACB` (aksen; teks pakai `#3B6A8C` agar kontras), pasir `#E8DBB3` (garis/chip), krem `#FFFDEB` (latar). Token `brand-*` tersedia sebagai utility Tailwind. Radius kartu lebih membulat.
- Layout aplikasi: sidebar bergaya tumpukan kartu (profil, cabang, menu dengan item aktif merah, kartu merah "Servis hari ini", aksi cepat, "Buat Work Order baru"). HP: header ringkas + menu sheet.
- Dashboard: alur papan servis (Antri → Dikerjakan → Menunggu Part → QC → Siap Diambil) dengan peringatan, work order berjalan, kapasitas bay, tren omzet 7 hari, skor kesehatan bisnis, pengingat. Kartu disembunyikan sesuai izin role.
- Komponen dipisah: `src/components/app-shell.tsx` (kerangka + sidebar), `dashboard/view.tsx`, `dashboard/widgets.tsx`.

### Added
- `src/lib/demo/dashboard.ts`: data contoh dashboard (berlabel "Data contoh"), diganti view database saat modul jadi.
- `/dev/preview`: pratinjau UI tanpa login, hanya di development (404 di production, tidak dibuka di proxy production).

### Fixed
- Warna tidak tampil di dev: dev server masih memakai CSS lama; perlu restart setelah menambah token `@theme`.
- Titik alur servis tidak pas di garis: kurva kini dihitung melewati titik (Catmull-Rom).
- Label grafik bertumpuk di HP: grafik diberi lebar minimum dan bisa digeser horizontal.

### Verifikasi
- `tsc`, `eslint`, `next build` lolos. Dicek di browser: desktop 1440px dan HP 375px (tanpa horizontal scroll halaman).

### File terdampak
`src/app/globals.css`, `src/app/(app)/layout.tsx`, `src/app/(app)/dashboard/*`, `src/app/dev/preview/page.tsx`, `src/components/app-shell.tsx`, `src/components/app-nav.tsx`, `src/lib/demo/dashboard.ts`, `src/proxy.ts`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.3.1] 2026-11-03
**Ringkasan:** Perbaikan error dashboard & keamanan log dev.

### Fixed
- Error "unstable value `Date.now()` while prerendering" di `/dashboard`: `getUserContext()` kini memanggil `connection()` sebelum mengakses Supabase.
- Error "uncached data outside of `<Suspense>`" di `/dashboard`: data user dipindah ke `DashboardContent` di dalam `<Suspense>` dengan skeleton.

### Security
- Next.js dev mencatat argumen server action ke terminal, termasuk password dari form setup/login. Dimatikan lewat `logging.serverFunctions: false`.

### Verifikasi
- Owner pertama berhasil dibuat lewat `/setup` (EMP-2611-0001, role owner, profil terhubung).
- `tsc`, `eslint`, `next build` lolos.

### File terdampak
`src/lib/auth.ts`, `src/app/(app)/dashboard/page.tsx`, `next.config.ts`, `devlog.md`, `fitur.md`, `VERSION`, `package.json`

---

## [0.3.0] 2026-11-03
**Ringkasan:** Halaman login, setup Owner pertama, dan layout aplikasi (light mode).

### Added
- Migration `20261103000004_auth_bootstrap.sql`: `public.needs_setup()`, `public.bootstrap_owner()` (hanya service_role, sekali saja, terkunci dari race), `public.my_context()` (karyawan, cabang, role, izin).
- `src/proxy.ts` (Next 16, pengganti middleware): refresh sesi Supabase, redirect ke `/login` jika belum masuk, logout otomatis setelah 12 jam tidak aktif.
- `/setup`: buat akun Owner pertama (muncul hanya jika belum ada karyawan).
- `/login`: email + password; pesan error Bahasa Indonesia (salah password, akun dinonaktifkan, akun tanpa karyawan).
- Layout aplikasi: sidebar (desktop) + menu sheet (HP), header dengan nama, role, cabang, dan tombol keluar. Menu difilter sesuai izin; modul yang belum dibangun bertanda "Segera".
- `/dashboard`: sapaan, tanggal WIB, kartu ringkasan (placeholder sampai modul terkait jadi).
- `src/lib/auth.ts` (`getUserContext`, `requireUser`, `can`), `src/lib/supabase/admin.ts`, `src/lib/validation/auth.ts` (Zod dipakai di client & server), `src/components/form-field.tsx`.
- shadcn: input, label, badge, separator, sheet.

### Fixed
- Halaman reload terus di dev: ada `package-lock.json` di folder home sehingga Turbopack salah root. `turbopack.root` dikunci ke folder proyek.
- Font jatuh ke serif: variabel `--font-sans` dari shadcn merujuk dirinya sendiri, diarahkan ke Geist.

### Verifikasi
- `tsc`, `eslint`, `next build` lolos.
- Browser: `/` → `/login` → `/setup` (karena belum ada karyawan), validasi form tampil benar.
- Belum diuji end-to-end: pembuatan Owner, login, dashboard, logout (menunggu user membuat akun Owner sendiri).

### File terdampak
`supabase/migrations/20261103000004_auth_bootstrap.sql`, `src/proxy.ts`, `src/app/(auth)/**`, `src/app/(app)/**`, `src/app/page.tsx`, `src/app/globals.css`, `src/components/**`, `src/lib/**`, `next.config.ts`, `package.json`, `devlog.md`, `fitur.md`, `VERSION`

---

## [0.2.0] 2026-11-03
**Ringkasan:** Skema database fondasi: sistem, akses, role & RLS.

### Added
- Migration `20261103000001_foundation_system.sql`:
  - schema `app`, `app.today_wib()`, `app.set_updated_at()`.
  - Tabel `branches`, `settings`, `number_sequences`, `audit_logs` (append-only, tidak bisa update/delete/truncate).
- Migration `20261103000002_access_control.sql`:
  - Tabel `employees`, `profiles` (1-1 `auth.users`), `employee_status_history`, `roles`, `permissions`, `role_permissions` (scope `all`/`own`), `employee_roles`.
  - Helper RLS: `app.current_employee_id()`, `app.current_branch_id()`, `app.is_superuser()`, `app.has_permission(module, action, scope)`.
  - Audit trigger generik `app.audit_row_change()` (tanpa `pin_hash`).
  - Status karyawan: riwayat otomatis + akun Nonaktif diblokir login (`auth.users.banned_until`).
  - Penomoran dokumen atomik `app.next_document_number('INV')` → `INV-2611-0001`.
  - PIN persetujuan bcrypt: `app.set_my_pin()`, `app.verify_approval_pin()` (tercatat di audit log).
  - RLS aktif di semua tabel; anon tanpa akses; `pin_hash` dilindungi dengan grant per kolom.
  - Hapus permanen diblokir untuk master (branches, employees, profiles, roles).
- Migration `20261103000003_seed_roles_permissions.sql`: cabang `PST`, 5 setting awal, 27 modul × 6 aksi (162 izin), 5 role bawaan, matriks default PRD §16 (113 baris).
- `supabase/tests/foundation_test.sql` + `scripts/test-db.mjs` + `npm run test:db`.

### Verifikasi
- `supabase db push` ke Supabase lokal berhasil.
- `npm run test:db`: 33/33 tes lulus (izin kasir/mekanik/owner, RLS, penomoran, audit, PIN, status Nonaktif, integritas). Tes berjalan dalam transaksi + rollback, tidak meninggalkan data.

### Catatan desain
- `permissions` adalah katalog global, jadi tanpa `branch_id` (pengecualian konvensi §15.1).
- Owner = role `is_superuser`, otomatis punya semua izin termasuk modul baru.
- Batas percobaan PIN salah belum ada (perlu rate limit di layer aplikasi).

### File terdampak
`supabase/migrations/*`, `supabase/tests/foundation_test.sql`, `scripts/test-db.mjs`, `package.json`, `package-lock.json`, `devlog.md`, `fitur.md`, `VERSION`

---

## [0.1.1] 2026-11-03
**Ringkasan:** `npm run dev` di host Windows terhubung ke Supabase.

### Fixed
- Node.js di Windows tidak me-resolve `supabase.localhost`. Ditambah entri hosts `127.0.0.1 supabase.localhost` (setup manual sekali per mesin developer).

### Verifikasi
- `next dev` di host: `/api/v1/health` → `{"status":"ok","version":"0.1.0","supabase":{"ok":true}}`.

### File terdampak
`devlog.md`, `fitur.md`, `VERSION`

---

## [0.1.0] 2026-11-03
**Ringkasan:** Setup proyek Next.js + Supabase + Docker.

### Added
- Next.js 16.4 (App Router, TypeScript, Tailwind v4, ESLint, `src/`), `lang="id"`.
- shadcn/ui (button, card), Zod, React Hook Form, `@supabase/supabase-js`, `@supabase/ssr`, `server-only`.
- Supabase CLI (devDependency) + folder `supabase/` (`config.toml`, `migrations/`).
- `src/lib/env.ts`: validasi env dengan Zod.
- `src/lib/supabase/client.ts` & `server.ts`: Supabase client browser/server (cookie session).
- `GET /api/v1/health`: status app, versi, dan koneksi Supabase Auth.
- `Dockerfile` (Node 24 alpine, standalone, user non-root, TZ Asia/Jakarta, healthcheck) + `.dockerignore`.
- `next.config.ts` → `output: "standalone"`.
- `.env.example` → `SUPABASE_INTERNAL_URL`.

### Verifikasi
- `tsc --noEmit`, `eslint`, `next build` lolos.
- Image Docker dijalankan di jaringan Supabase: `/api/v1/health` → `{"status":"ok","version":"0.1.0","supabase":{"ok":true}}`, jam container WIB.

### Catatan
- Node.js di Windows tidak me-resolve `supabase.localhost` (browser bisa). Untuk `npm run dev` di host perlu entri hosts `127.0.0.1 supabase.localhost`.

### File terdampak
`package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `components.json`, `src/**`, `public/**`, `supabase/**`, `Dockerfile`, `.dockerignore`, `.gitignore`, `.env.example`, `AGENTS.md`, `devlog.md`, `fitur.md`, `VERSION`

---

## [0.0.4] 2026-11-03
**Ringkasan:** Port Postgres di-publish untuk migration.

### Added
- Port Postgres Supabase di-publish di Coolify lokal: `127.0.0.1:54322` (via proxy container Coolify).
- `DATABASE_URL` di `.env.local` diaktifkan. Login teruji: user `postgres`, PostgreSQL 15.8.

### Catatan
- Port publik hanya untuk development lokal. Jangan diaktifkan di staging/production.

### File terdampak
`devlog.md`, `fitur.md`, `VERSION`

---

## [0.0.3] 2026-11-03
**Ringkasan:** Supabase self-host berjalan di Coolify lokal.

### Added
- Supabase (12 container) dideploy di Coolify lokal, API via Kong di `http://supabase.localhost`.
- `.env.example`: template variabel env (Supabase URL, anon key, service role key, DATABASE_URL, TZ).
- `.env.local` (tidak di-commit): diisi kunci asli dari Coolify.

### Fixed
- 503 di `supabase.localhost`: domain Kong masih sslip.io bawaan Coolify. Domain diganti ke `supabase.localhost` port 8000 lalu restart servis.

### Catatan
- Label "DNS mismatch" di Coolify normal untuk domain `.localhost`.
- Port Postgres belum di-publish; diperlukan untuk migration via Supabase CLI.

### File terdampak
`.env.example`, `devlog.md`, `fitur.md`, `VERSION`

---

## [0.0.2] 2026-11-03
**Ringkasan:** Environment development pindah ke Docker + Coolify lokal.

### Changed
- `CLAUDE.md`: development memakai Docker + Coolify lokal dengan Supabase self-host (bukan Netlify + Supabase Cloud). Ditambah tabel environment dan konsekuensinya (Dockerfile standalone, `.env.example`, Supabase CLI).

### File terdampak
`CLAUDE.md`, `devlog.md`, `fitur.md`, `VERSION`

---

## [0.0.1] 2026-11-03
**Ringkasan:** Inisialisasi proyek & dokumentasi kerja.

### Added
- `CLAUDE.md`: agent default (Fullstack Developer) beserta aturan teknis dari PRD dan alur versioning.
- `devlog.md`: log perubahan.
- `fitur.md`: daftar fitur & status berdasarkan PRD.
- `VERSION`, `.gitignore`.
- Inisialisasi repository git.

### File terdampak
`CLAUDE.md`, `devlog.md`, `fitur.md`, `VERSION`, `.gitignore`
