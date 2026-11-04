"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/form-dialog";
import {
  FileTextIcon,
  UserPlusIcon,
  UsersIcon,
  PackagePlusIcon,
  WalletCardsIcon,
  CarFrontIcon,
  PlusIcon,
  Trash2Icon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";

export function PopupShowcase() {
  const [openEstimasi, setOpenEstimasi] = useState(false);
  const [openKaryawan, setOpenKaryawan] = useState(false);
  const [openPelanggan, setOpenPelanggan] = useState(false);
  const [openBarang, setOpenBarang] = useState(false);
  const [openPengeluaran, setOpenPengeluaran] = useState(false);

  return (
    <div className="w-full max-w-4xl space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-blue-border bg-brand-blue-soft/50 px-3 py-1 text-xs font-semibold text-brand-blue">
          <SparklesIcon className="size-3.5" />
          Figma Page 14 : Pop up Input & Dialog Showcase
        </div>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Katalog Pop-up Form & Input
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Klik tombol di bawah untuk menguji ragam modal form dialog dengan styling rounded-2xl, backdrop blur, dan animasi motion responsif.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <button
          type="button"
          onClick={() => setOpenEstimasi(true)}
          className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-5 text-left shadow-xs transition-all hover:border-brand-blue/50 hover:shadow-md"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand-blue-soft text-brand-blue transition-transform group-hover:scale-105">
            <FileTextIcon className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Estimasi Baru</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Form pembuatan estimasi servis, keluhan, item jasa, dan rincian biaya.</p>
          </div>
          <span className="mt-auto text-xs font-medium text-brand-blue group-hover:underline">Buka Modal &rarr;</span>
        </button>

        <button
          type="button"
          onClick={() => setOpenKaryawan(true)}
          className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-5 text-left shadow-xs transition-all hover:border-brand-blue/50 hover:shadow-md"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 transition-transform group-hover:scale-105">
            <UserPlusIcon className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Tambah Karyawan</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Input data teknisi/staf, peran bengkel, nomor kontak, dan hak akses.</p>
          </div>
          <span className="mt-auto text-xs font-medium text-emerald-600 dark:text-emerald-400 group-hover:underline">Buka Modal &rarr;</span>
        </button>

        <button
          type="button"
          onClick={() => setOpenPelanggan(true)}
          className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-5 text-left shadow-xs transition-all hover:border-brand-blue/50 hover:shadow-md"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 transition-transform group-hover:scale-105">
            <UsersIcon className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Tambah Pelanggan</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Registrasi profil pemilik mobil, nomor WhatsApp, dan kategori member.</p>
          </div>
          <span className="mt-auto text-xs font-medium text-purple-600 dark:text-purple-400 group-hover:underline">Buka Modal &rarr;</span>
        </button>

        <button
          type="button"
          onClick={() => setOpenBarang(true)}
          className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-5 text-left shadow-xs transition-all hover:border-brand-blue/50 hover:shadow-md"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 transition-transform group-hover:scale-105">
            <PackagePlusIcon className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Tambah Barang / Part</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Katalog spare part baru, kode SKU, harga modal, harga jual, dan stok.</p>
          </div>
          <span className="mt-auto text-xs font-medium text-amber-600 dark:text-amber-400 group-hover:underline">Buka Modal &rarr;</span>
        </button>

        <button
          type="button"
          onClick={() => setOpenPengeluaran(true)}
          className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-5 text-left shadow-xs transition-all hover:border-brand-blue/50 hover:shadow-md"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 transition-transform group-hover:scale-105">
            <WalletCardsIcon className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Catat Pengeluaran</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Pencatatan biaya operasional, listrik, konsumsi, atau pembelian alat bengkel.</p>
          </div>
          <span className="mt-auto text-xs font-medium text-rose-600 dark:text-rose-400 group-hover:underline">Buka Modal &rarr;</span>
        </button>
      </div>

      {/* Dialog 1: Estimasi Baru */}
      <FormDialog
        open={openEstimasi}
        onOpenChange={setOpenEstimasi}
        title="Buat Estimasi Servis Baru"
        description="Lengkapi data estimasi sebelum diajukan atau disetujui pelanggan."
        size="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setOpenEstimasi(false);
            toast.success("Estimasi berhasil disimpan sebagai draf.");
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-foreground">Pilih Kendaraan *</label>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-input bg-card px-3 py-2 text-sm">
                <CarFrontIcon className="size-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cari plat B 1234 XYZ..."
                  defaultValue="B 8829 TYA - Honda Civic Turbo (Pak Budi)"
                  className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Kilometer (KM) Masuk *</label>
              <input
                type="number"
                defaultValue={45200}
                className="mt-1 flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">Keluhan Pelanggan *</label>
            <textarea
              rows={2}
              defaultValue="Rem depan bunyi berdecit saat macet, tarikan awal terasa agak tersendat."
              className="mt-1 flex w-full rounded-xl border border-input bg-card p-3 text-sm outline-none"
            />
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Item Jasa & Suku Cadang</span>
              <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline">
                <PlusIcon className="size-3.5" /> Tambah Baris
              </button>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-xs">
                <span className="w-16 font-medium text-muted-foreground">Jasa</span>
                <span className="flex-1 font-semibold text-foreground">Servis Rem 4 Roda & Bleeding</span>
                <span className="w-12 text-center text-muted-foreground">1x</span>
                <span className="w-24 text-right font-mono font-medium">Rp 175.000</span>
                <button type="button" className="text-muted-foreground hover:text-rose-500">
                  <Trash2Icon className="size-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-xs">
                <span className="w-16 font-medium text-muted-foreground">Part</span>
                <span className="flex-1 font-semibold text-foreground">Brake Pad Front Genuine Honda</span>
                <span className="w-12 text-center text-muted-foreground">1 set</span>
                <span className="w-24 text-right font-mono font-medium">Rp 650.000</span>
                <button type="button" className="text-muted-foreground hover:text-rose-500">
                  <Trash2Icon className="size-3.5" />
                </button>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-semibold text-foreground">Total Estimasi</span>
              <span className="font-mono text-base font-bold text-foreground">Rp 825.000</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpenEstimasi(false)}>
              Batal
            </Button>
            <Button type="submit">
              Simpan Estimasi
            </Button>
          </div>
        </form>
      </FormDialog>

      {/* Dialog 2: Tambah Karyawan */}
      <FormDialog
        open={openKaryawan}
        onOpenChange={setOpenKaryawan}
        title="Tambah Karyawan Baru"
        description="Daftarkan mekanik, kasir, atau staf administrasi baru ke sistem bengkel."
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setOpenKaryawan(false);
            toast.success("Karyawan baru berhasil ditambahkan.");
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-xs font-semibold text-foreground">Nama Lengkap *</label>
            <input
              type="text"
              placeholder="Contoh: Andi Pratama"
              required
              className="mt-1 flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-foreground">Nomor WhatsApp *</label>
              <input
                type="tel"
                placeholder="081234567890"
                required
                className="mt-1 flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Peran / Jabatan *</label>
              <select className="mt-1 flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none">
                <option value="mechanic">Mekanik Senior</option>
                <option value="junior_mechanic">Mekanik Junior</option>
                <option value="cashier">Kasir</option>
                <option value="admin">Admin Bengkel</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-foreground">Tanggal Mulai Bekerja</label>
              <input
                type="date"
                defaultValue={new Date().toISOString().split("T")[0]}
                className="mt-1 flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">PIN Akses Kasir (6 Digit)</label>
              <input
                type="password"
                maxLength={6}
                placeholder="******"
                className="mt-1 flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpenKaryawan(false)}>
              Batal
            </Button>
            <Button type="submit">
              Simpan Karyawan
            </Button>
          </div>
        </form>
      </FormDialog>

      {/* Dialog 3: Tambah Pelanggan */}
      <FormDialog
        open={openPelanggan}
        onOpenChange={setOpenPelanggan}
        title="Tambah Pelanggan Baru"
        description="Masukkan identitas pemilik kendaraan untuk pencatatan riwayat servis."
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setOpenPelanggan(false);
            toast.success("Pelanggan baru berhasil disimpan.");
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-xs font-semibold text-foreground">Nama Pelanggan *</label>
            <input
              type="text"
              placeholder="Contoh: Ibu Rina Melati"
              required
              className="mt-1 flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-foreground">Nomor HP / WA *</label>
              <input
                type="tel"
                placeholder="081987654321"
                required
                className="mt-1 flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Kategori Member</label>
              <select className="mt-1 flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none">
                <option value="regular">Reguler</option>
                <option value="vip">VIP / Member</option>
                <option value="corporate">Korporasi / Armada</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground">Alamat Domisili</label>
            <input
              type="text"
              placeholder="Contoh: Jl. Diponegoro No. 12, Bandung"
              className="mt-1 flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpenPelanggan(false)}>
              Batal
            </Button>
            <Button type="submit">
              Simpan Pelanggan
            </Button>
          </div>
        </form>
      </FormDialog>

      {/* Dialog 4: Tambah Barang */}
      <FormDialog
        open={openBarang}
        onOpenChange={setOpenBarang}
        title="Tambah Barang / Spare Part"
        description="Tambahkan item suku cadang atau pelumas ke inventori bengkel."
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setOpenBarang(false);
            toast.success("Barang baru berhasil ditambahkan ke inventori.");
          }}
          className="space-y-4"
        >
          <div>
            <label className="text-xs font-semibold text-foreground">Nama Barang / Part *</label>
            <input
              type="text"
              placeholder="Contoh: Oli Mesin Shell Helix Ultra 5W-40 4L"
              required
              className="mt-1 flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-foreground">Kode SKU / Barcode</label>
              <input
                type="text"
                placeholder="SKU-88219"
                className="mt-1 flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Kategori Barang</label>
              <select className="mt-1 flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none">
                <option value="oil">Pelumas & Fluida</option>
                <option value="brake">Pengereman</option>
                <option value="filter">Filter (Oli/Udara/AC)</option>
                <option value="suspension">Kaki-kaki & Suspensi</option>
                <option value="electrical">Kelistrikan & Aki</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-foreground">Harga Modal (Rp)</label>
              <input
                type="number"
                placeholder="350000"
                className="mt-1 flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Harga Jual (Rp) *</label>
              <input
                type="number"
                placeholder="450000"
                required
                className="mt-1 flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none font-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Stok Awal</label>
              <input
                type="number"
                defaultValue={10}
                className="mt-1 flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpenBarang(false)}>
              Batal
            </Button>
            <Button type="submit">
              Simpan Barang
            </Button>
          </div>
        </form>
      </FormDialog>

      {/* Dialog 5: Catat Pengeluaran */}
      <FormDialog
        open={openPengeluaran}
        onOpenChange={setOpenPengeluaran}
        title="Catat Pengeluaran Kas"
        description="Pencatatan beban operasional kas kecil atau transfer perbankan."
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setOpenPengeluaran(false);
            toast.success("Pengeluaran kas berhasil dibukukan.");
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-foreground">Dari Rekening / Kas *</label>
              <select className="mt-1 flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none">
                <option value="kas_kecil">Kas Kecil Bengkel (Cash)</option>
                <option value="bca">BCA Operasional (0291-882-11)</option>
                <option value="mandiri">Mandiri Utama (130-00-8829-1)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground">Kategori Biaya *</label>
              <select className="mt-1 flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none">
                <option value="listrik">Listrik & Air (PLN/PDAM)</option>
                <option value="konsumsi">Konsumsi Mekanik & Tamu</option>
                <option value="peralatan">Alat Kerja & Perlengkapan Bengkel</option>
                <option value="sewa">Sewa Tempat & Kebersihan</option>
                <option value="lainnya">Lain-lain</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground">Nominal Pengeluaran (Rp) *</label>
            <input
              type="number"
              placeholder="Contoh: 150000"
              required
              className="mt-1 flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground">Keterangan / Catatan</label>
            <input
              type="text"
              placeholder="Contoh: Beli sabun cuci tangan dan lap microfiber mekanik"
              className="mt-1 flex h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpenPengeluaran(false)}>
              Batal
            </Button>
            <Button type="submit">
              Catat Pengeluaran
            </Button>
          </div>
        </form>
      </FormDialog>
    </div>
  );
}
