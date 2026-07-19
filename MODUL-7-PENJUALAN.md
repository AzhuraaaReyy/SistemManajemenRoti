# Modul 7 — Penjualan (Point of Sale)

> Alur: pilih produk → input jumlah → hitung total → bayar → simpan →
> stok produk jadi berkurang otomatis → struk.
>
> Pengurangan stok memakai `stock_ledger` yang sama dengan
> [Pembelian](MODUL-3-PEMBELIAN.md), [Produksi](MODUL-4-PRODUKSI.md), dan
> [Persediaan](MODUL-6-INVENTORY.md). Tidak ada tabel mutasi baru.

---

## 1. Pemenuhan Spesifikasi

| Permintaan | Terpenuhi | Keterangan |
|---|---|---|
| Antarmuka POS: pencarian cepat + keranjang | ✅ | Grid produk kiri, keranjang menetap kanan |
| Subtotal, diskon opsional, pajak opsional, total | ✅ | Dihitung server — lihat §4 |
| Pajak persentase dapat dikonfigurasi | ✅ | Tabel `settings`, diubah Owner dari halaman Pengaturan |
| Validasi stok, tidak boleh menjual melebihi stok | ✅ | Termasuk kasus baris ganda — lihat §5.2 |
| Stok berkurang otomatis + tercatat di mutasi | ✅ | Lewat `StockService`, jenis `sale` arah keluar |
| Struk tampilan cetak sederhana | ✅ | Thermal 58mm, bisa dicetak browser |
| Riwayat per kasir dan keseluruhan | ✅ | Kasir hanya melihat miliknya — lihat §7 |
| Ringkasan harian dan bulanan | ✅ | Termasuk rekap tutup kasir per metode bayar |
| Dashboard ringkas penjualan | ✅ | Total hari ini, perbandingan kemarin, transaksi terakhir |
| Skema `transaksi_penjualan` + `detail_penjualan` | ✅ | `sales` + `sale_items` |
| Create transaksi atomik dalam satu DB transaction | ✅ | Lihat §5.1 |

---

## 2. Keputusan yang Disepakati

| Pertanyaan | Keputusan |
|---|---|
| Konfigurasi pajak | Tabel `settings`, diubah Owner dari halaman Pengaturan |
| Metode pembayaran | Tunai + QRIS + Transfer |
| Format struk | Thermal 58mm, tetap bisa dicetak browser |

---

## 3. Skema Database

### 3.1 `sales` — transaksi_penjualan

| Kolom | Keterangan |
|---|---|
| `sale_number` | `TRX-2026-0001`, bernomor per tahun |
| `cashier_id` | FK → users |
| `subtotal` | |
| `discount_type` / `discount_value` / `discount_amount` | bentuk asli + nominalnya |
| `tax_percent` / `tax_amount` | tarif ikut dibekukan |
| `total` | |
| `payment_method` | cash / qris / transfer |
| `paid_amount` / `change_amount` | |
| `cost_total` | HPP saat transaksi terjadi |
| `status` | completed / voided |
| `voided_at` / `voided_by` / `void_reason` | |
| `idempotency_key` | unik — lihat §5.3 |

### 3.2 `sale_items` — detail_penjualan

Nama, kode, satuan, dan harga produk **disalin**, tidak sekadar direlasikan.
Struk yang dicetak ulang tahun depan harus menampilkan harga yang benar-benar
dibayar pelanggan hari itu, bukan harga produk hari ini. Produk yang kelak
dihapus pun tetap terbaca namanya.

Kolom `cost_source` mencatat asal angka HPP — lihat §6.

### 3.3 `settings`

Pasangan kunci-nilai, bukan satu baris dengan banyak kolom. Menambah pengaturan
baru nanti cukup menambah baris, tidak perlu migrasi tabel yang sudah dipakai.

Kolom `type` menyimpan bentuk aslinya, karena semua nilai tersimpan sebagai
teks. Tanpa itu `"false"` akan terbaca sebagai string tidak kosong — yang
bernilai benar di PHP — dan pajak akan aktif selamanya.

### 3.4 Angka Uang Dibekukan

Tarif pajak, nilai diskon, harga satuan, dan HPP **tidak pernah dihitung ulang**
dari pengaturan yang berlaku sekarang. Owner yang menaikkan tarif pajak minggu
ini tidak boleh mengubah struk bulan lalu.

Diuji secara eksplisit (§9 skenario 20): setelah pajak diaktifkan, transaksi
lama tetap menunjukkan pajak 0%.

---

## 4. Perhitungan — Urutannya Penting

```
subtotal → diskon → pajak → total
```

Pajak dihitung dari nilai **setelah** diskon, bukan dari subtotal. Memungut
pajak atas nilai yang tidak jadi dibayar pelanggan membuat totalnya lebih besar
dari seharusnya, dan selisihnya baru ketahuan saat pembukuan tidak cocok.

**Perhitungannya dilakukan server, juga untuk pratinjau di keranjang.**
Endpoint `POST /sales/calculate` memakai method yang sama persis dengan
penyimpanan. Menghitungnya dua kali di dua bahasa adalah cara pasti membuat
angka di layar berbeda dari angka di struk — dan pelanggan yang menemukan
selisihnya akan selalu benar.

Dua pagar tambahan:

- Diskon tidak boleh melebihi nilai belanja (total negatif berarti toko
  membayar pelanggan).
- Diskon tidak boleh melebihi batas persen yang ditetapkan Owner — pagar agar
  salah ketik tidak menghapus seluruh nilai transaksi.

---

## 5. Atomisitas dan Validasi Stok

### 5.1 Satu Transaksi, Semua atau Tidak Sama Sekali

Seluruh proses berada dalam satu `DB::transaction`: bila satu produk saja
stoknya tidak mencukupi, tidak ada satu pun stok yang terpotong dan
transaksinya tidak tersimpan. Tidak ada keadaan setengah jadi.

Produk dikunci berurutan menurut ID (`lockForUpdate`) untuk mencegah kebuntuan
bila dua kasir menjual produk yang sama bersamaan — pola yang sama dipakai
`StockService` dan `ProductionService`.

### 5.2 Baris Ganda Digabung Lebih Dulu

Kasir yang menambahkan roti yang sama dua kali menghasilkan dua baris. Bila
masing-masing diperiksa terhadap stok penuh, dua baris @ 30 pcs akan lolos
padahal stoknya hanya 40 — dan stok berakhir minus.

Baris dengan produk yang sama karena itu dijumlahkan **sebelum** pemeriksaan
stok. Diuji secara eksplisit (§9 skenario 6).

### 5.3 Idempoten di Tingkat Transaksi

Pelajaran dari "batch hantu" di Modul 4: melindungi ledger saja tidak cukup.
Kasir yang menekan Bayar dua kali karena jaringan lambat akan menghasilkan dua
transaksi dengan dua nomor struk berbeda, dan yang kedua sudah terlanjur
memotong stok sebelum ledger menolaknya.

Kuncinya diperiksa **sebelum** apa pun dibuat. Di sisi frontend, kunci dibuat
sekali saat dialog pembayaran dibuka — bukan per pengiriman — sehingga percobaan
ulang memakai kunci yang sama.

### 5.4 Penolakan Menyebut Seluruh Produk Sekaligus

Produk yang stoknya kurang dikumpulkan dulu, tidak langsung dilempar pada yang
pertama. Kasir perlu tahu seluruh masalahnya sekaligus, bukan satu per satu
dengan pelanggan menunggu di depan meja:

> 2 produk stoknya tidak mencukupi: Croissant (diminta 8, tersedia 5 pcs);
> Roti Tawar (diminta 12, tersedia 9 pcs).

---

## 6. Cacat yang Ditemukan Saat Pengujian — HPP Nol

Pengujian pertama melaporkan margin yang mustahil:

```
Croissant Butter Premium   2 pcs   Rp36.000   laba Rp36.000   margin 100%
```

Penyebabnya: `avg_cost` berisi rata-rata tertimbang dari produksi yang
**benar-benar terjadi**. Produk yang stoknya berasal dari saldo awal belum
pernah melewati produksi, sehingga `avg_cost`-nya masih nol — dan laba kotornya
terbaca sebesar seluruh omzet.

Angka yang terlihat menyenangkan dan sepenuhnya salah.

**Perbaikan:** dipakai HPP teoretis dari resep aktif sebagai cadangan, dan
asal-usulnya dicatat di kolom `cost_source`:

| Nilai | Arti |
|---|---|
| `actual` | Rata-rata tertimbang produksi nyata — paling bisa dipercaya |
| `recipe` | Taksiran dari resep aktif, produk belum pernah diproduksi |
| `unknown` | Tidak ada keduanya; laba kotor baris ini terlalu besar |

Tanpa kolom ini, laporan laba akan mencampur angka nyata dan taksiran tanpa ada
yang bisa membedakannya. Struk dan detail transaksi menampilkan labelnya
("Produksi nyata" / "Taksiran resep"), dan `cost_reliable` pada transaksi
bernilai benar hanya bila SELURUH barisnya berbiaya nyata.

Setelah perbaikan, laba kotor harian turun dari Rp79.417 (mengada-ada) menjadi
Rp60.210 (masuk akal).

---

## 7. Hak Akses

| Peran | Akses |
|---|---|
| **Kasir** | POS, riwayat **miliknya sendiri**, dashboard miliknya sendiri |
| **Owner** | Semua di atas + seluruh kasir, pembatalan, pengaturan |
| **Admin Produksi** | Tidak berjualan — 403 di seluruh endpoint penjualan |

Kasir hanya melihat penjualannya sendiri bukan karena data rekan rahasia,
melainkan karena **tutup kasir adalah tanggung jawab pribadi** — mencampur
transaksi rekan membuat selisih laci mustahil ditelusuri.

Pembatasan ini ditegakkan di controller, bukan di middleware peran, karena
bergantung pada isi datanya (`cashier_id`), bukan pada perannya saja.

Membaca pengaturan boleh siapa saja yang sudah masuk — kasir butuh tarif pajak
dan identitas toko untuk menyusun struk. Mengubahnya hanya Owner.

---

## 8. Pembatalan Transaksi

**Tambahan di luar spesifikasi.** Spesifikasi tidak menyebut pembatalan, tetapi
POS tanpa cara memperbaiki kesalahan adalah jalan buntu: kasir yang salah ketik
20 alih-alih 2 tidak punya jalan keluar sama sekali.

- Untuk **kesalahan kasir** — salah ketik, salah produk, tercatat dua kali.
- **Bukan retur pelanggan**; itu modul tersendiri (M7 pada papan status).
- Stok dikembalikan dengan jenis mutasi `sale_void` yang **terpisah** dari
  `return`, supaya laporan retur tidak menghitung kesalahan pengetikan sebagai
  keluhan pelanggan.
- Transaksinya **tidak dihapus** — barisnya tetap ada berstatus Dibatalkan
  lengkap dengan alasannya, sehingga nomor struk yang sudah dipegang pelanggan
  tetap bisa ditelusuri.
- Hanya Owner.

---

## 9. API Endpoint

Prefix `/api/v1/sales` · penjaga `role:owner,kasir`

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/catalog` | Produk siap jual + pengaturan + metode bayar |
| POST | `/calculate` | Pratinjau subtotal → diskon → pajak → total |
| POST | `/` | Simpan transaksi (atomik) |
| GET | `/` | Riwayat; filter tanggal, status, metode, kasir |
| GET | `/{sale}` | Detail + identitas toko untuk cetak ulang struk |
| POST | `/{sale}/void` | Batalkan (Owner) |
| GET | `/options` | Pengisi filter |
| GET | `/dashboard` | Hari ini, perbandingan kemarin, bulan berjalan |
| GET | `/summary/daily` | Ringkasan harian + rekap tutup kasir |
| GET | `/summary/monthly` | Ringkasan bulanan + produk terlaris + per kasir |

Pengaturan · prefix `/api/v1/settings`

| Method | Endpoint | Penjaga |
|---|---|---|
| GET | `/pos` | semua yang sudah masuk |
| GET | `/` | Owner |
| PUT | `/` | Owner |

---

## 10. Struktur Folder

### 10.1 Backend

```
app/
  Enums/
    PaymentMethod.php          cash / qris / transfer, needsChange(), isCash()
    SaleStatus.php             completed / voided
    StockMovementType.php      + case SALE_VOID
  Models/
    Sale.php                   generateNumber(), grossProfit(), scope revenue()
    SaleItem.php               costIsReliable(), costSourceLabel()
    Setting.php                typedValue()
  Services/
    SaleService.php            ← inti modul
    SettingService.php         cache dibuang saat berubah, bukan diberi masa berlaku
  Http/
    Requests/Sales/StoreSaleRequest.php
    Resources/SaleResource.php
    Controllers/Api/V1/Sales/SaleController.php
    Controllers/Api/V1/Sales/SalesDashboardController.php
    Controllers/Api/V1/SettingController.php
database/
  migrations/2026_07_19_1601xx–1604xx  settings, sale_void, sales, sale_items
  seeders/SalesSeeder.php
```

### 10.2 Frontend

```
src/
  components/sales/
    PaymentModal.tsx           metode bayar + tombol pecahan cepat
    ReceiptModal.tsx           struk 58mm
  pages/sales/
    PosPage.tsx                grid produk + keranjang menetap
    SalesHistoryPage.tsx
    SalesDashboardPage.tsx
  pages/SettingsPage.tsx
  types/sales.ts
  services/salesService.ts
  index.css                    aturan @media print
```

### 10.3 Catatan Antarmuka

**Keranjang hanya hidup di sisi klien.** Tidak ada "draft transaksi" yang
tersimpan di basis data — pelanggan yang berubah pikiran di depan meja tidak
boleh meninggalkan sampah.

**Tombol pecahan cepat.** Kasir yang melayani antrean tidak sempat mengetik
"50000", dan salah ketik nol adalah kesalahan yang paling sering terjadi di meja
kasir. Saran uangnya dibulatkan ke pecahan yang benar-benar ada di dompet:
total Rp41.000 menyarankan Rp50.000, bukan Rp41.000.

**Produk habis tetap ditampilkan** tetapi tidak bisa diklik. Menyembunyikannya
membuat kasir mengira produknya dihapus dari sistem.

**Pencetakan memakai `window.print()`** dengan aturan `@media print` yang
menyembunyikan seluruh halaman kecuali elemen struk. Cara ini dipilih daripada
membuka jendela baru karena pemblokir pop-up kerap menghalanginya tanpa pesan
apa pun, dan kasir tidak akan tahu kenapa struknya tidak keluar.

---

## 11. Hasil Pengujian

Diuji lewat API berjalan dengan akun `kasir@`, `owner@`, dan `produksi@`.

| # | Skenario | Hasil |
|---|---|---|
| 1 | Katalog POS untuk Kasir | ✅ 3 produk, 3 kategori, 3 metode bayar |
| 2 | Pratinjau perhitungan berdiskon | ✅ 100.000 → diskon 10.000 → total 90.000 |
| 3 | Keranjang kosong | ✅ Ditolak |
| 4 | Jual melebihi stok | ✅ Ditolak, menyebut diminta vs tersedia |
| 5 | Uang tunai kurang dari total | ✅ Ditolak dengan kedua angka |
| 6 | **Produk sama dua baris, gabungannya melebihi stok** | ✅ Ditolak (8 diminta, 5 tersedia) |
| 7 | Diskon melebihi batas Owner | ✅ Ditolak, menyebut batas dan cara mengubahnya |
| 8 | Transaksi berhasil | ✅ TRX-2026-0005, kembalian benar |
| 9 | Stok produk berkurang | ✅ 5 → 3 |
| 10 | Tercatat di ledger jenis `sale` arah keluar | ✅ ref = nomor transaksi |
| 11 | **Idempoten: kirim ulang kunci sama** | ✅ Nomor sama, stok tidak terpotong dua kali |
| 12 | Kasir hanya melihat transaksinya sendiri | ✅ |
| 13 | Kasir membatalkan transaksi | ✅ 403 |
| 14 | Kasir mengubah pengaturan | ✅ 403 |
| 15 | Kasir mengakses master/inventory/produksi/pembelian | ✅ 403 keempatnya |
| 16 | Admin Produksi mengakses POS | ✅ 403 |
| 17 | Owner mengaktifkan pajak 11% | ✅ Tersimpan |
| 18 | Perhitungan langsung memakai tarif baru | ✅ 100.000 → pajak 11.000 |
| 19 | Transaksi baru mengenakan pajak | ✅ 18.000 → 19.980 |
| 20 | **Tarif lama tetap beku di transaksi sebelumnya** | ✅ Tetap 0% |
| 21 | Non-tunai dicatat pas, tanpa kembalian | ✅ QRIS bayar = total |
| 22 | Pembatalan mengembalikan stok | ✅ |
| 23 | Membatalkan dua kali | ✅ Ditolak |
| 24 | Mutasi `sale_void` terpisah dari `sale` | ✅ Terlihat berbeda di riwayat mutasi |
| 25 | Ringkasan harian + rekap per metode | ✅ Tunai di laci dipisah dari QRIS |
| 26 | Ringkasan bulanan + produk terlaris + per kasir | ✅ 19 hari dirinci |
| 27 | Omzet ringkasan = penjumlahan transaksi selesai | ✅ 62.500 = 62.500 |
| 28 | Tunai di laci = penjualan tunai saja | ✅ 37.500 |
| 29 | Transaksi dibatalkan tidak masuk omzet | ✅ 15.000 di luar 62.500 |
| 30 | Modul 2–6 tidak rusak | ✅ 6 endpoint diperiksa |
| 31 | `php artisan stock:reconcile` | ✅ 11 barang, cache cocok dengan ledger |
| 32 | `php artisan data:check` | ✅ Tidak ada masalah integritas |

Frontend: `npm run lint` dan `npm run build` lulus. Bundel awal 306 KB; halaman
POS masuk sebagai chunk terpisah 17 KB.

---

## 12. Yang Sengaja Belum Dikerjakan

- **Retur pelanggan.** Berbeda dari pembatalan: barangnya benar-benar sempat
  dibawa pulang. Jenis mutasi `return` sudah disiapkan di enum, modulnya
  menyusul.
- **Cetak langsung ke printer thermal.** Sekarang lewat dialog cetak browser.
  Pencetakan langsung butuh driver ESC/POS atau jembatan aplikasi lokal.
- **Shift kasir.** Ringkasan harian sudah memisahkan tunai dari non-tunai,
  tetapi belum ada konsep buka/tutup shift dengan modal awal laci.
- **Diskon per baris.** Diskon sekarang berlaku per transaksi. Diskon per produk
  butuh kolom tambahan di `sale_items` dan aturan urutan yang lebih rumit.
- **Laporan lengkap.** Sesuai permintaan, yang ada di sini hanya ringkasan.
  Laporan laba rugi dan tren tahunan adalah modul tersendiri (M10).

---

## 13. Modul Berikutnya

Modul 10 — Laporan Laba Kotor. Seluruh bahannya sudah tersedia: `cost_total`
per transaksi, `line_cost` per baris, dan `cost_source` yang menandai mana
angka nyata dan mana taksiran — sehingga laporannya bisa jujur menyebut bagian
mana yang masih perlu dipercaya dengan hati-hati.
