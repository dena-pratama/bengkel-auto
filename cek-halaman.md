# Daftar cek halaman (login Owner)

Halaman di bawah ini sudah lolos tes database, tsc, eslint, dan build, tetapi **belum pernah dibuka dengan sesi login nyata** oleh agen. Cek satu per satu di browser dengan akun Owner, lalu centang. Bila ada yang aneh, catat halaman dan langkahnya.

Siapkan data uji: 1 pelanggan + kendaraan, 1 barang ber-stok, 1 jasa, 1 supplier.

## Alur utama (urutan disarankan)
- [ ] **Barang & Jasa** (`/inventory`): tambah barang, atur harga, stok awal. Buka detail barang: panel **Foto barang** (Tambah, lepas) dan **Cocok untuk kendaraan** (tambah baris, simpan).
- [ ] **Label QR** (`/inventory/label`): pilih barang dan rak, ukuran 50 x 30 mm, cetak (matikan header/footer, skala 100%).
- [ ] **Scan QR** (`/inventory/scan`): scan label dengan HP (kamera) dan pemindai USB bila ada; cek stok per lokasi dan 10 mutasi.
- [ ] **Pembelian** (`/pembelian`): buat PO, **Unduh PDF**, tandai terkirim, terima barang. Di penerimaan: **Foto faktur supplier**.
- [ ] **Servis** (`/servis`): estimasi, setujui, work order, papan status (indikator **Langsung**; buka di dua tab dan ubah status di satu tab). Keluarkan part dengan **scan QR barang dan rak** (cek penanda "scan QR" di riwayat).
- [ ] **Kasir** (`/kasir`): buka shift, invoice WO, bayar. Di invoice: **Cetak A4**, **Nota 80 mm / 58 mm**, **Unduh PDF**, kirim WhatsApp.
- [ ] **Garansi**: dari riwayat servis buat klaim garansi, lalu `/servis/garansi` (laporan per mekanik, barang, supplier).
- [ ] **Reminder servis** (`/pelanggan/reminder`): tambah aturan (mis. ganti oli 5.000 km atau 3 bulan), cek daftar jatuh tempo dan tombol WhatsApp.

## Keuangan dan pengelolaan
- [ ] **Keuangan** (`/keuangan`): kas masuk/keluar, tombol **Bukti** (lampiran) per transaksi, jurnal, tutup buku.
- [ ] **Laporan keuangan** (`/keuangan/laporan`): laba rugi, neraca, arus kas; **Ekspor Excel** dan **Unduh PDF**.
- [ ] **Pajak** (`/pajak`): profil pajak, laporan PPN, PPh Final.
- [ ] **Penggajian** (`/penggajian`): profil gaji, periode, slip gaji (cetak), kasbon, komisi.
- [ ] **Stok opname** (`/stok-opname`): buat sesi, hitung (coba scan `I:SKU` di kotak cari), review, posting.
- [ ] **AI Analyst** (`/ai`): skor kesehatan, ringkasan mingguan, buat token. Tanya AI butuh `ANTHROPIC_API_KEY`.
- [ ] **Audit log** (`/audit`): filter, klik baris untuk sebelum/sesudah, **Ekspor Excel**.
- [ ] **Pengaturan** (ikon gerigi atau menu profil): tab Profil saya (unggah, ganti, hapus foto; simpan nomor HP; ganti password; PIN; mode gelap) dan tab Bengkel (batas diskon, wajib scan part). Foto muncul di pojok kanan atas dan di daftar karyawan.

## Cek filter daftar
- [ ] Buka Penjualan, Retur, Shift, Piutang, PO, Penerimaan, Hutang, Stok opname, Estimasi, Kas & bank, Jurnal, Penggajian (periode, kasbon, komisi), Audit log, Garansi: coba pilihan cepat (7 hari, Bulan ini, Semua), tanggal bebas, kategori, lalu Atur ulang. Alamat halaman ikut berubah dan bisa dibagikan.
- [ ] Papan servis: filter di bagian "Selesai & batal" tidak menyembunyikan kendaraan yang sedang dikerjakan.
- [ ] Barang, Jasa, Pelanggan, Kendaraan, Karyawan: pilih kategori atau merek atau peran atau tanggal masuk, lalu Atur ulang.

## Cek hak akses (login sebagai peran lain)
- [ ] Admin tidak melihat Penggajian, AI Analyst, Audit log.
- [ ] Mekanik hanya melihat WO dan slip gaji miliknya.
- [ ] Kasir tidak melihat kolom HPP di halaman penjualan.

## Setelah dicek
Bila semua lolos, tandai di `fitur.md` bagian yang masih "belum diverifikasi" di `devlog.md`. Sebelum go-live, jalankan juga backup/restore uji dan atur penjadwal mingguan untuk `POST /api/v1/ai/weekly`.
