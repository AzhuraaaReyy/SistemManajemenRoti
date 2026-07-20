# Modul 6 — Inventory Management

> **Hak akses sudah berubah.** Berkas ini menggambarkan pembagian peran
> saat modul dibangun, ketika sistem masih memakai `admin_produksi`. Sejak
> 20 Juli 2026 peran itu dipecah menjadi Admin Gudang dan Kepala Produksi —
> lihat [MIGRASI-PERAN.md](MIGRASI-PERAN.md) untuk pembagian yang berlaku.

> Pusat monitoring seluruh pergerakan stok, bahan baku maupun produk jadi.
>
> Modul ini **murni membaca**. Ia tidak membuat sumber data baru — seluruh
> angkanya berasal dari `stock_ledger` yang sudah diisi
> [Modul 3 — Pembelian](MODUL-3-PEMBELIAN.md) dan
> [Modul 4 — Produksi](MODUL-4-PRODUKSI.md).

---

## 1. Pemenuhan Spesifikasi

| Permintaan | Terpenuhi | Keterangan |
|---|---|---|
| Ringkasan stok per item (bahan baku & produk jadi) | ✅ | Satu daftar gabungan, terurut dari yang paling genting |
| Riwayat mutasi dengan filter sumber | ✅ | 9 jenis sumber, plus filter arah, tanggal, jenis barang |
| Klasifikasi HABIS / MENIPIS / AMAN | ✅ | Persis rumus spesifikasi — lihat §3 |
| Status dihitung, bukan disimpan sebagai kolom | ✅ | Tidak ada kolom `status` di tabel mana pun |
| Notifikasi hanya saat status **berubah** | ✅ | Tabel `stock_alerts` mencatat peristiwa, bukan keadaan — lihat §4 |
| Penyesuaian manual dengan catatan wajib | ✅ | Minimal 10 karakter, tercatat sebagai mutasi `adjustment` |
| Dashboard kartu ringkasan | ✅ | Tiga kartu status + nilai persediaan |
| Tabel stok dengan badge warna | ✅ | Merah / kuning / hijau, plus perincian kritis & berlebih |
| Chart tren mutasi 7/30 hari | ✅ | Grafik garis SVG, periode 7–90 hari |
| Export ke Excel | ✅ | CSV UTF-8 siap buka — lihat §7 |
| Memakai tabel mutasi yang sama | ✅ | `stock_ledger`, tanpa tabel mutasi baru |

---

## 2. Keputusan yang Disepakati

| Pertanyaan | Keputusan |
|---|---|
| Klasifikasi status | Pertahankan 5 status rinci, **tampilkan 3** di kartu ringkasan |
| Format export | CSV UTF-8, tanpa menambah dependency |
| Notifikasi | Dalam aplikasi saja (lonceng + panel), tanpa email |

---

## 3. Status Stok — Dihitung, Tidak Pernah Disimpan

### 3.1 Aturan

Spesifikasi meminta tiga status:

```
stok = 0          → HABIS    (merah)
stok <= minimum   → MENIPIS  (kuning)
stok >  minimum   → AMAN     (hijau)
```

Sistem memakai lima status yang merupakan **perincian** dari ketiganya, bukan
aturan yang berbeda:

```
HABIS   ├─ habis      stok = 0
MENIPIS ├─ kritis     stok < setengah minimum   ← beli hari ini juga
        └─ menipis    setengah minimum … minimum
AMAN    ├─ aman       minimum … 3× minimum
        └─ berlebih   > 3× minimum              ← modal menganggur
```

Setiap status rinci selalu jatuh ke tepat satu status pokok, sehingga jumlah
ketiga kartu selalu sama dengan total barang. Ini diuji secara eksplisit
(§9 skenario 12).

Perincian ini dipertahankan karena bahan yang tinggal 5% dari minimum dan bahan
yang pas di batas minimum sama-sama "menipis" menurut spesifikasi, tetapi hanya
yang pertama yang bisa menghentikan produksi besok pagi.

### 3.2 Satu Tempat, Bukan Tiga

Sebelum modul ini, rumus klasifikasi ditulis ulang di dua model — dan keduanya
**sudah sempat berbeda**:

```php
// Ingredient::stockStatus()          // Product::stockStatus()
$stok > $min * 3 => 'berlebih',       // (tidak ada)
```

Artinya barang yang sama bisa berstatus lain hanya karena tabelnya berbeda.
Rumusnya kini ada di satu tempat, `StockStatus::classify()`, dan kedua model
memanggilnya. Konstanta label yang terduplikasi di `IngredientResource` dan
`ProductResource` juga ikut dihapus.

### 3.3 Kenapa Tidak Disimpan

Kolom status statis berarti setiap pergerakan stok harus ingat memperbaruinya.
Satu saja yang lupa — satu pembatalan produksi, satu penyesuaian, satu retur di
modul yang belum dibuat — dan seluruh laporan berbohong tanpa ketahuan.

Konsekuensi menyenangkan dari menghitungnya: mengubah batas minimum sebuah
bahan di Master Data langsung mengubah statusnya di seluruh laporan, tanpa
proses penyegaran apa pun.

---

## 4. Notifikasi Hanya Saat Status Berubah

### 4.1 Masalahnya

Memeriksa "apakah stok di bawah minimum?" setiap kali halaman dibuka akan
memunculkan peringatan yang sama berulang kali sampai stoknya diisi. Yang
diminta adalah pemberitahuan saat terjadi **perpindahan** — satu peristiwa,
satu baris, satu kali muncul.

Tetapi status tidak disimpan. Lalu dari mana sistem tahu status sebelumnya?

### 4.2 Jawabannya: Simpan Peristiwanya, Bukan Keadaannya

Tabel `stock_alerts` tidak menyimpan status barang. Ia menyimpan **perpindahan**:

| Kolom | Isi |
|---|---|
| `item_type` / `item_id` | polimorfik, melayani bahan dan produk |
| `from_status` / `to_status` | perpindahan yang terjadi |
| `stock_at_alert` / `min_stock_at_alert` | angka **dibekukan** saat peringatan dibuat |
| `stock_ledger_id` | baris ledger yang memicunya — bisa ditelusuri sampai ke PO atau batch |
| `is_read` / `read_at` / `read_by` | penanda sudah dibaca |

Status sebelum pergerakan dihitung di `StockService::applyMovement()` **sebelum**
stok berubah, lalu dibandingkan dengan status sesudahnya. Tidak ada kolom status
yang perlu disimpan di barangnya.

### 4.3 Dipasang di Pintu Stok, Bukan di Controller

```php
$statusSebelum = StockStatus::classify($item->current_stock, $item->min_stock);

$ledger = DB::transaction(function () { /* … pergerakan stok … */ });

// Di LUAR transaksi, setelah stok benar-benar tersimpan.
app(StockAlertService::class)->evaluateSafely($item->fresh(), $statusSebelum, $ledger);
```

Dua hal penting:

- **Di luar transaksi.** Kegagalan membuat pemberitahuan tidak boleh
  membatalkan pembelian atau produksi yang sudah sah. `evaluateSafely()`
  menangkap seluruh galat dan hanya menulis ke log.
- **Di StockService, bukan di controller inventory.** Dengan begitu peringatan
  ikut terpicu dari pembelian, produksi, pembatalan, dan modul penjualan yang
  belum dibuat — tanpa satu baris tambahan di modul-modul itu.

### 4.4 Cacat yang Ditemukan Saat Seeding — Kabar Baik Dianggap Peringatan

Percobaan pertama menghasilkan enam peringatan seperti ini:

```
Tepung Terigu   habis -> kritis   dipicu=opening
Mentega Anchor  habis -> kritis   dipicu=opening
Ragi Instan     habis -> menipis  dipicu=opening
```

Status memang berubah, dan status barunya memang bermasalah. Tetapi stoknya
**naik** — ini pencatatan saldo awal. Setiap bahan baru berangkat dari nol,
sehingga pengisian pertamanya selalu terbaca sebagai "Habis → Kritis" dan
membanjiri lonceng dengan kabar yang justru menyenangkan.

Syarat kedua ditambahkan: peringatan hanya dibuat bila keadaannya **lebih
genting** dari sebelumnya.

```php
if (! $after->isAlert() || $after->severity() <= $before->severity()) {
    return null;
}
```

Setelah perbaikan, seeding menghasilkan 3 peringatan — persis jumlah barang
yang memang perlu perhatian.

### 4.5 Barang yang Sudah Menipis Sebelum Modul Ini Ada

Peringatan lahir dari perpindahan. Barang yang sudah menipis sejak dulu tidak
pernah mengalami perpindahan apa pun — ia diam di keadaan buruk tanpa memicu
apa-apa. Celah ini ditutup `StockAlertService::syncFromCurrentStock()`, yang
dipanggil seeder dan perintah artisan:

```
php artisan stock:alerts
```

Aman dijalankan berulang: barang yang peringatan terakhirnya sudah sesuai
keadaan sekarang akan dilewati.

---

## 5. Penyesuaian Stok Manual

Satu-satunya endpoint di modul ini yang menulis — dan itu pun tetap lewat
`StockService::adjustToCount()`, bukan menyentuh `current_stock` langsung.

**Yang diisi pengguna adalah hasil hitungan fisik, bukan selisihnya.**
Menghitung selisih sendiri adalah sumber kesalahan yang tidak perlu: orang di
gudang tahu ada berapa kilogram di rak, bukan berapa kilogram yang hilang.

**Catatan wajib, minimal 10 karakter.** Ini bukan kerewelan validasi. Seluruh
rancangan ledger bertumpu pada aturan bahwa stok tidak pernah berubah tanpa
alasan yang bisa dibaca orang lain enam bulan kemudian. Penyesuaian adalah
satu-satunya jalur di mana manusia mengetik angka stok secara langsung, jadi
justru di sinilah alasannya paling dibutuhkan.

Yang tercatat adalah **selisihnya** sebagai satu baris ledger bertipe
`adjustment` — bukan menimpa angka lama. Riwayat sebelumnya tetap utuh dan
`stock:reconcile` tetap bersih.

Penyesuaian yang tidak mengubah apa pun bukan kesalahan:

> Stok sudah sesuai hitungan fisik. Tidak ada penyesuaian yang perlu dicatat.

---

## 6. API Endpoint

Prefix `/api/v1/inventory` · penjaga `role:owner,admin_produksi`

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/dashboard` | Ringkasan, perlu perhatian, tren mutasi, rekap per sumber |
| GET | `/items` | Daftar stok gabungan; filter status, jenis, kategori, pencarian |
| GET | `/movements` | Riwayat mutasi; filter arah, sumber, jenis, barang, tanggal |
| POST | `/adjustments` | Penyesuaian manual, catatan wajib |
| GET | `/export/items` | Laporan stok CSV |
| GET | `/export/movements` | Riwayat mutasi CSV |
| GET | `/options` | Pengisi filter: status, sumber, jenis, daftar barang |
| GET | `/alerts` | Daftar peringatan berhalaman |
| GET | `/alerts/unread` | Ringkas, untuk lonceng |
| PATCH | `/alerts/{alert}/read` | Tandai satu terbaca |
| POST | `/alerts/read-all` | Tandai semua terbaca |

Kasir tidak diberi akses — peran itu memang tidak punya menu `persediaan` di
`UserRole::allowedMenus()`.

---

## 7. Export CSV

Dua hal yang membuatnya benar-benar terbuka rapi di Excel Indonesia:

- **Pemisah titik-koma**, bukan koma. Excel dengan pengaturan wilayah Indonesia
  memakai koma sebagai pemisah desimal — dengan pemisah koma, angka `4,5` akan
  pecah menjadi dua kolom.
- **BOM UTF-8** di awal berkas. Tanpa itu Excel di Windows membaca berkas
  sebagai ANSI dan huruf beraksen pada nama bahan berubah menjadi karakter aneh.

Export **tidak dibatasi halaman**. Kalau pengguna menyaring satu bulan, yang
diunduh adalah satu bulan penuh — bukan 20 baris pertama. Riwayat mutasi
dialirkan dengan `cursor()` agar tidak menumpuk di memori.

Di sisi frontend, unduhan tidak bisa memakai `<a href>` biasa karena tautan
polos tidak membawa header `Authorization`. Berkas diambil sebagai blob lewat
axios, lalu diserahkan ke browser.

---

## 8. Struktur Folder

### 8.1 Backend

```
app/
  Enums/StockStatus.php                      classify(), headline(), severity(), isAlert()
  Models/StockAlert.php                      message(), scope unread/ofStatus/ofItemKind
  Services/
    InventoryService.php                     ← inti modul (baca)
    StockAlertService.php                    ← deteksi perpindahan status
  Http/
    Requests/Inventory/StockAdjustmentRequest.php
    Resources/StockMovementResource.php
    Resources/StockAlertResource.php
    Controllers/Api/V1/Inventory/InventoryController.php
    Controllers/Api/V1/Inventory/StockAlertController.php
  Console/Commands/SyncStockAlerts.php       php artisan stock:alerts
database/
  migrations/2026_07_19_150100_create_stock_alerts_table.php
  seeders/InventorySeeder.php
```

Diubah: `StockService` (deteksi perpindahan), `Ingredient` + `Product`
(delegasi ke enum), `IngredientResource` + `ProductResource` (hapus konstanta
label), `IngredientController`, `ProductionService`, `PurchaseDashboardController`
(menyesuaikan `stockStatus()` yang kini mengembalikan enum).

### 8.2 Frontend

```
src/
  components/inventory/
    MovementTrendChart.tsx      grafik garis SVG buatan sendiri
    StockAdjustmentModal.tsx
    StockAlertBell.tsx          lonceng di bilah atas
  pages/inventory/
    InventoryDashboardPage.tsx
    StockItemsPage.tsx
    StockMovementsPage.tsx
  types/inventory.ts
  services/inventoryService.ts
```

Grafiknya digambar sendiri dengan SVG, tanpa pustaka chart. Alasannya bukan
penghematan semata: dashboard pembelian dan produksi sudah memakai batang CSS
buatan sendiri, dan menambahkan Recharts (~100 KB) hanya untuk satu grafik akan
membuat tampilan sistem terbelah menjadi dua gaya.

---

## 9. Hasil Pengujian

Diuji lewat API berjalan dengan akun `produksi@rotimanis.test` dan
`kasir@rotimanis.test`.

| # | Skenario | Hasil |
|---|---|---|
| 1 | Ringkasan tiga kartu | ✅ Habis 0 · Menipis 3 · Aman 8 dari 11 barang |
| 2 | Perincian lima status | ✅ kritis 1 · menipis 2 · aman 7 · berlebih 1 |
| 3 | Daftar stok gabungan, terurut kegentingan | ✅ Mentega (Kritis) di baris pertama |
| 4 | Filter `status=menipis` menangkap yang kritis | ✅ 3 item, termasuk 1 kritis |
| 5 | Filter jenis barang | ✅ 8 bahan baku, 3 produk jadi |
| 6 | Riwayat mutasi + filter sumber | ✅ purchase 4 · production_consume 12 · production_yield 1 · opening 11 |
| 7 | Filter arah dan tanggal | ✅ masuk 16 · keluar 12 |
| 8 | Penyesuaian tanpa catatan | ✅ Ditolak |
| 9 | Penyesuaian dengan catatan terlalu singkat | ✅ Ditolak dengan contoh yang benar |
| 10 | Penyesuaian tanpa selisih | ✅ Berhasil tanpa mencatat mutasi |
| 11 | Penyesuaian turun di bawah minimum | ✅ 7,573 → 1,2 kg · status Aman → Kritis · mutasi `adjustment` tercatat |
| 12 | **Membaca data berulang tidak menambah peringatan** | ✅ Tetap 4 setelah dashboard dan daftar stok dibuka ulang |
| 13 | Peringatan terbit saat status memburuk | ✅ "Cokelat Meses Ceres turun dari Aman menjadi Kritis." |
| 14 | Tandai satu / semua terbaca | ✅ 4 → 3 → 0 |
| 15 | Export laporan stok | ✅ 966 byte, pemisah titik-koma, desimal koma |
| 16 | Export riwayat mutasi | ✅ 29 baris data sesuai filter |
| 17 | Kasir akses seluruh endpoint inventory | ✅ 403 |
| 18 | Konsistensi: 3 kartu = total barang | ✅ 11 = 11 |
| 19 | Konsistensi: 5 status rinci = total barang | ✅ 11 = 11 |
| 20 | Konsistensi: filter = angka kartu | ✅ menipis 3=3 · aman 8=8 |
| 21 | Modul 2/3/4/5 tidak rusak oleh perubahan enum | ✅ 5 endpoint diperiksa, semua OK |
| 22 | `php artisan stock:reconcile` setelah penyesuaian | ✅ 11 barang, cache cocok dengan ledger |
| 23 | `php artisan data:check` | ✅ Tidak ada masalah integritas |

Frontend: `npm run lint` dan `npm run build` lulus. Bundel awal 303 KB;
tiga halaman persediaan masuk sebagai chunk terpisah (11 KB, 13 KB, 5 KB).

---

## 10. Yang Sengaja Belum Dikerjakan

- **Stock opname terjadwal.** Penyesuaian sekarang satu barang per satu kali.
  Opname sungguhan menghitung seluruh gudang dalam satu sesi dengan lembar
  hitung tercetak. Itu modul tersendiri (M13).
- **Titik pesan ulang dinamis.** "Perkiraan habis dalam ± N hari" sudah dihitung
  dari rata-rata pemakaian 30 hari, tetapi belum dipakai untuk menyarankan
  jumlah pembelian otomatis. Menunggu data historis yang lebih panjang.
- **Notifikasi email.** Sengaja tidak dipasang — butuh kredensial SMTP yang
  benar, dan kegagalannya hanya terlihat di log.
- **Kedaluwarsa (FEFO).** `shelf_life_days` sudah ada di bahan baku tetapi belum
  dipakai. Masuk M8.
- **Pagination daftar stok.** Seluruh barang ditampilkan sekaligus. Untuk skala
  UMKM (11 barang sekarang, realistis puluhan) ini benar dan membuat pengurutan
  menurut kegentingan berguna. Bila kelak menembus ribuan,
  `InventoryService::allItems()` adalah tempat pertama yang perlu diubah
  menjadi UNION SQL — dan itu sudah dicatat sebagai komentar di sana.

---

## 11. Modul Berikutnya

Modul 7 — Penjualan (POS). Stok produk jadi kini terpantau penuh; pengurangannya
di kasir akan memakai `StockService` yang sama, dan peringatan stok produk habis
otomatis ikut terpicu tanpa tambahan kode apa pun di modul penjualan.
