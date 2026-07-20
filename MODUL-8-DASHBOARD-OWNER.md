# Modul 8 — Dashboard Owner

> Ringkasan tingkat tertinggi, khusus peran Owner.
>
> **Murni agregasi.** Tidak ada tabel baru — seluruh angkanya dijumlahkan dari
> tabel yang sudah diisi modul [Pembelian](MODUL-3-PEMBELIAN.md),
> [Produksi](MODUL-4-PRODUKSI.md), [Tracking](MODUL-5-TRACKING-PRODUKSI.md),
> [Persediaan](MODUL-6-INVENTORY.md), dan [Penjualan](MODUL-7-PENJUALAN.md).

---

## 1. Pemenuhan Spesifikasi

| Permintaan | Terpenuhi | Keterangan |
|---|---|---|
| Total Penjualan (hari ini, bulan ini) | ✅ | Transaksi dan unit |
| Total Produksi (batch selesai hari/bulan) | ✅ | Dihitung menurut kapan batch **selesai** — lihat §3.1 |
| Pendapatan hari ini & bulan ini | ✅ | Beserta laba kotor dan perbandingan kemarin |
| Produk Terlaris (top 5) | ✅ | Dari data penjualan |
| Grafik Penjualan (tren 30 hari) | ✅ | Recharts, rentang 7–90 hari |
| Grafik Produksi (batch per hari) | ✅ | Recharts |
| Monitoring Stok (aman/menipis/habis) | ✅ | Memakai `InventoryService` |
| Batch Produksi Aktif | ✅ | Beserta tahap dan progress dari Modul 5 |
| Supplier Terakhir | ✅ | Penerimaan, bukan pemesanan — lihat §3.3 |
| Recent Activity lintas modul | ✅ | Penjualan + produksi + pembelian, urut waktu |
| Endpoint agregasi tanpa tabel baru | ✅ | Satu endpoint — lihat §2 |
| Grafik memakai Recharts | ✅ | Ditambahkan sebagai dependency baru |
| Warna konsisten status (hijau/kuning/merah) | ✅ | Palet tervalidasi — lihat §4 |
| Auto-refresh atau tombol refresh | ✅ | Keduanya, auto sebagai mekanisme utama — lihat §5 |
| Hanya bisa diakses Owner | ✅ | Middleware `role:owner` dari Modul 1 |

---

## 2. Satu Endpoint, Bukan Sepuluh

```
GET /api/v1/dashboard/owner?days=30      middleware: auth:api · active · role:owner
```

Seluruh isi dashboard datang dalam satu panggilan. Dashboard yang menembakkan
sepuluh permintaan sekaligus menampilkan kartunya satu per satu dengan urutan
acak, dan tombol muat ulang tidak pernah selesai bersamaan.

Balasannya terbagi menjadi dua belas bagian: `penjualan`, `produksi`,
`pendapatan`, `produk_terlaris`, `grafik_penjualan`, `grafik_produksi`, `stok`,
`batch_aktif`, `supplier_terakhir`, `aktivitas_terkini`, `periode`,
`diperbarui_pada`.

### 2.1 Tidak Menghitung Ulang Apa yang Sudah Dihitung

`OwnerDashboardService` **memanggil** service modul lain, tidak menyalin
rumusnya:

| Bagian | Sumbernya |
|---|---|
| Pendapatan & laba kotor | `SaleService::dailySummary()` / `monthlySummary()` |
| Produk terlaris | `SaleService::produkTerlaris()` |
| Status stok | `InventoryService::summary()` / `needsAttention()` |
| Progress batch | `ProductionBatch::progressPercent()` (Modul 5) |

Menyalin rumusnya ke sini berarti dua tempat yang harus diperbaiki setiap kali
aturannya berubah — dan satu di antaranya pasti terlupa. Konsistensinya diuji
secara eksplisit (§7 skenario 12–14): angka dashboard harus sama persis dengan
angka modul asalnya.

---

## 3. Tiga Keputusan Agregasi

### 3.1 Batch Dihitung Menurut Kapan Ia Selesai

"Total Produksi hari ini" memakai `finished_at`, bukan `started_at`. Batch yang
mulai kemarin sore dan selesai pagi ini adalah **hasil hari ini** — memasukkannya
ke kemarin membuat angka produksi harian tidak pernah cocok dengan jumlah roti
yang benar-benar keluar dari oven hari itu.

### 3.2 Grafik Penjualan: Dua Deret, Satu Sumbu

Grafik menggambar **omzet dan laba kotor** — keduanya rupiah, satu sumbu.

Jumlah transaksi sengaja **tidak** ikut digambar meski datanya tersedia dan
terlihat menggoda. Ia bersatuan berbeda (belasan, bukan jutaan), sehingga
menggambarnya menuntut sumbu Y kedua. Penyelarasan dua sumbu selalu sembarang,
dan grafiknya jadi mengarang hubungan yang tidak ada di datanya. Angkanya tetap
terbaca di tooltip dan di tabel pendamping.

### 3.3 "Supplier Terakhir" Menampilkan Penerimaan, Bukan Pemesanan

Pesanan yang baru dibuat belum menjadi pengeluaran dan belum menambah stok.
Yang menarik bagi Owner adalah barang yang **benar-benar sudah datang** — jadi
panel ini membaca `purchase_receipts`, bukan `purchase_orders`.

---

## 4. Recent Activity — Dari Tabel Sumber, Bukan `activity_logs`

Sistem sudah punya tabel `activity_logs` sejak Modul 1, dan pada pandangan
pertama itulah tempat yang jelas untuk panel ini. Tetapi keduanya menjawab
pertanyaan yang berbeda:

| | Menjawab |
|---|---|
| `activity_logs` | apa yang **diklik pengguna** |
| Tabel sumber | apa yang **terjadi pada usahanya** |

Keduanya sering sama, tetapi tidak selalu. Kejadian yang lahir dari seeder,
perintah artisan, atau proses otomatis tidak punya baris log sama sekali — dan
justru itu yang akan membuat panel ini terlihat kosong padahal usahanya
berjalan. Karena itu aktivitas disusun dari `sales`, `production_batches`, dan
`purchase_orders`, lalu digabung dan diurutkan menurut waktu.

`activity_logs` tetap ada dan tetap terisi; ia jejak audit, bukan ringkasan
usaha.

---

## 5. Warna Grafik — Dihitung, Bukan Dikira-kira

Palet grafik ada di `Frontend/src/lib/chartTheme.ts` dan **dijalankan lewat
pemeriksa keterbacaan warna** terhadap permukaan kartu (`#ffffff`), bukan
dipilih menurut selera:

```
pita terang         semua slot di L 0,43–0,77          PASS
lantai kroma        semua slot >= 0,1                  PASS
pemisahan CVD       terburuk ΔE 16,2 (protan)          PASS  (target >= 8)
penglihatan normal  terburuk ΔE 29,0                   PASS  (lantai >= 15)
```

Aturan yang ditegakkan:

- **Warna kategorikal berurutan, tidak pernah diputar.** Deret ke-9 bukan warna
  baru — ia digabung menjadi "Lainnya".
- **Warna status tidak pernah dipakai sebagai warna deret**, dan sebaliknya.
- **Status selalu ditemani ikon dan label.** Warna "menipis" (kuning) berada di
  bawah rasio kontras 3:1 terhadap latar putih — itu bukan kelalaian, dan
  pasangan ikon + label adalah penawarnya. Pembaca yang mencetak halaman ini
  hitam-putih tetap bisa membacanya.
- **Satu warna untuk satu deret.** Grafik produk terlaris tidak memakai gradasi
  gelap-untuk-yang-besar: produk adalah kategori nominal tanpa urutan alami,
  jadi gradasi hanya mengulang apa yang sudah dikatakan panjang batangnya.
- **Kisi digambar solid, bukan putus-putus.** Garis putus-putus adalah bawaan
  Recharts dan harus ditimpa setiap kali — ia menambah bising dan terbaca
  sebagai "ambang batas" padahal sekadar kisi.

Setiap grafik punya **kembaran tabel** (ikon tabel di pojok kartu). Tooltip
boleh memperkaya, tetapi tidak boleh menjadi satu-satunya jalan membaca sebuah
angka — pembaca dengan pembaca layar, atau yang mencetak halaman ini, tidak
punya hover.

Sistem ini bermode terang saja; tidak ada langkah gelap yang didefinisikan.
Bila kelak ditambahkan, langkahnya harus dipilih ulang untuk permukaan gelap dan
divalidasi lagi, bukan dibalik begitu saja.

---

## 6. Penyegaran — Otomatis, dengan Tombol sebagai Jalan Pintas

Spesifikasi mempersilakan memilih salah satu. **Yang dipilih: auto-refresh tiap
60 detik.**

Alasannya bentuk pemakaiannya: dashboard ini dibuka dan dibiarkan terbuka — di
layar belakang toko, atau di tab yang ditengok sesekali. Menuntut Owner menekan
tombol untuk melihat angka yang sudah berubah membuat halaman ini berbohong
tanpa ada yang menyadarinya.

Tombol muat ulang tetap ada sebagai jalan pintas: Owner yang baru saja mencatat
sesuatu ingin melihatnya sekarang, bukan 59 detik lagi.

Dua hal yang membuat penyegaran otomatis tidak mengganggu:

- **Tidak ada kerangka abu-abu yang berkedip.** Saat menyegarkan, isi yang lama
  diredupkan sedikit dan tetap di tempatnya. Kerangka yang berkedip tiap menit
  membuat halaman terasa berkedut dan memindahkan tata letaknya.
- **Galat hanya dilaporkan sekali.** Notifikasi yang muncul tiap menit karena
  jaringan mati lebih mengganggu daripada membantu.

Waktu pembaruan terakhir ditulis di bawah judul — tanpa itu, penyegaran otomatis
tidak terlihat dan pengguna tidak tahu apakah angkanya masih berlaku.

---

## 7. Hasil Pengujian

| # | Skenario | Hasil |
|---|---|---|
| 1 | Admin Produksi mengakses dashboard owner | ✅ 403 |
| 2 | Kasir mengakses dashboard owner | ✅ 403 |
| 3 | Owner mengakses | ✅ OK |
| 4 | Kelengkapan bagian | ✅ 12 bagian terkirim |
| 5 | Kartu pendapatan + perbandingan kemarin | ✅ Rp62.500, kemarin Rp0 → perubahan null |
| 6 | Kartu penjualan & produksi | ✅ 3 trx · 1 batch selesai · 1 aktif |
| 7 | Grafik penjualan 30 titik | ✅ Termasuk hari kosong sebagai nol |
| 8 | Grafik produksi 30 titik | ✅ |
| 9 | Produk terlaris | ✅ 2 produk terjual |
| 10 | Batch aktif + tahap | ✅ PRO-2026-0002 · Fermentasi · 28,57% |
| 11 | Penerimaan terakhir | ✅ 2 penerimaan, nilai benar |
| 12 | **Omzet dashboard = modul Penjualan** | ✅ 62.500 = 62.500 |
| 13 | **Status stok = modul Persediaan** | ✅ habis/menipis/aman sama |
| 14 | **Batch aktif = modul Produksi** | ✅ 1 = 1 |
| 15 | Aktivitas menggabungkan tiga modul | ✅ penjualan, produksi, pembelian |
| 16 | Aktivitas terurut dari yang terbaru | ✅ Diperiksa berpasangan |
| 17 | Rentang grafik 7 / 30 / 90 hari | ✅ Jumlah titik sesuai |
| 18 | `days=200` | ✅ Ditolak (batas 90) |

`npm run lint` dan `npm run build` lulus.

**Yang belum diverifikasi:** hasil render di layar. Lingkungan ini tidak punya
alat pengambil tangkapan layar, jadi tata letaknya diperiksa dengan membaca
kode, bukan dengan melihatnya. Satu bug tata letak ditemukan lewat pemeriksaan
itu — dua grafik ditempatkan pada kisi tiga kolom sehingga menyisakan satu kolom
kosong — dan sudah diperbaiki menjadi dua kolom. Bila ada tumpukan label atau
luapan yang hanya terlihat di layar, itu belum tertangkap.

---

## 8. Ukuran Bundel — Biaya Recharts

Recharts ditambahkan sebagai dependency baru sesuai permintaan. Biayanya nyata:

```
Bundel awal (semua peran)     306 KB  → 98 KB gzip   (tidak berubah)
OwnerDashboardPage            391 KB  → 112 KB gzip  (chunk terpisah)
```

Bundel awal **tidak bertambah** karena halaman Owner dimuat malas, dan
`DashboardHome` memilih halaman menurut peran — Kasir dan Admin Produksi tidak
ikut mengunduh Recharts sama sekali.

Catatan kejujuran: modul 4 dan 6 sebelumnya sengaja menggambar grafiknya sendiri
dengan SVG/CSS untuk menghindari dependency ini. Kini keduanya hidup
berdampingan — dashboard Pembelian, Produksi, dan Persediaan masih memakai
batang buatan sendiri, sementara Dashboard Owner memakai Recharts. Bila ingin
seragam, langkah berikutnya adalah memindahkan ketiganya ke Recharts (bundelnya
sudah terbayar) — bukan sebaliknya.

---

## 9. Struktur Folder

### 9.1 Backend

```
app/
  Services/OwnerDashboardService.php                    ← seluruh agregasi
  Http/Controllers/Api/V1/OwnerDashboardController.php
routes/api.php                                          GET dashboard/owner
```

Tidak ada migrasi. Tidak ada model baru.

### 9.2 Frontend

```
src/
  lib/chartTheme.ts                       palet tervalidasi + props sumbu/kisi
  components/dashboard/
    ChartCard.tsx                         bingkai + legenda + kembaran tabel
    SalesTrendChart.tsx                   dua deret, satu sumbu
    ProductionChart.tsx                   batang, satu deret
    TopProductsChart.tsx                  batang mendatar
    StockMonitor.tsx                      tiga status, ikon + label
  pages/
    OwnerDashboardPage.tsx
    DashboardHome.tsx                     memilih beranda menurut peran
  types/dashboard.ts
  services/dashboardService.ts
```

---

## 10. Yang Sengaja Belum Dikerjakan

- **Beranda peran non-Owner masih halaman lama.** `DashboardPage.tsx` berisi
  peta modul dari Modul 1 yang isinya sudah usang — ia masih menyebut Pembelian
  dan Produksi "antre" padahal keduanya sudah selesai. Kasir dan Admin Produksi
  mendarat di sana setelah masuk. Memperbaikinya di luar lingkup modul ini,
  tetapi perlu dicatat sebagai utang.
- **Perbandingan periode.** Dashboard menunjukkan hari ini vs kemarin. Bulan ini
  vs bulan lalu, dan tahun berjalan, masuk modul Laporan (M10).
- **Ekspor dashboard.** Modul Persediaan sudah punya ekspor CSV; dashboard belum.
- **Rentang tanggal bebas.** Sekarang hanya 7/14/30/60/90 hari dari hari ini.
- **Mode gelap.** Belum ada di aplikasi mana pun, jadi palet grafik hanya
  mendefinisikan langkah terang.

---

## 11. Modul Berikutnya

Modul 10 — Laporan Laba Kotor. Agregasinya sudah terbukti benar di sini, dan
`cost_source` dari Modul 7 menandai mana angka HPP yang nyata dan mana yang
taksiran — sehingga laporannya bisa jujur menyebut bagian mana yang perlu
dipercaya dengan hati-hati.
