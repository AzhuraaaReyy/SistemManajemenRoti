# Modul 9 — Laporan

> Pusat pelaporan formal, terpisah dari
> [Dashboard Owner](MODUL-8-DASHBOARD-OWNER.md) yang ringkas dan real-time.
>
> **Murni membaca.** Tidak ada tabel baru — tujuh laporan disusun dari tabel
> yang sudah diisi modul Pembelian, Produksi, Persediaan, dan Penjualan.

---

## 1. Pemenuhan Spesifikasi

| Permintaan | Terpenuhi |
|---|---|
| Laporan Penjualan | ✅ 13 kolom, per transaksi |
| Laporan Produksi | ✅ 12 kolom, per batch |
| Laporan Pembelian | ✅ 11 kolom, per PO |
| Laporan Persediaan (snapshot pada tanggal) | ✅ Disusun ulang dari ledger — lihat §3 |
| Laporan Mutasi Stok | ✅ 12 kolom, seluruh pergerakan |
| Laporan Supplier | ✅ Rekap per supplier |
| Laporan Produk | ✅ Performa jual & produksi |
| Filter rentang tanggal / bulan / tahun | ✅ Bulan & tahun jadi pintasan rentang |
| Filter kategori, supplier, dsb. sesuai relevansi | ✅ Tiap laporan mendeklarasikan filternya |
| Export PDF | ✅ dompdf, satu templat untuk tujuh laporan |
| Export Excel | ✅ Laravel Excel (Maatwebsite), .xlsx sungguhan |
| API per jenis laporan | ✅ Satu rute berparameter |
| Halaman React: pemilih, filter, pratinjau, export | ✅ |
| Khusus Owner | ✅ Middleware `role:owner` dari Modul 1 |

---

## 2. Satu Definisi, Tiga Keluaran

Tujuh laporan × tiga keluaran (layar, Excel, PDF) berpotensi menjadi dua puluh
satu potongan kode yang hampir sama. Modul ini menghindarinya dengan satu
deklarasi terpusat di `ReportType`:

```php
['key' => 'total', 'label' => 'Total', 'format' => 'money',
 'align' => 'right', 'total' => true]
```

Deklarasi itu dibaca bersama oleh **tabel pratinjau, `ReportExport`, dan
templat Blade PDF**. Menambah satu kolom cukup di satu tempat, dan ketiganya
ikut berubah bersamaan — tidak mungkin lagi sebuah kolom muncul di layar tetapi
hilang saat dicetak.

Diuji secara eksplisit (§7 skenario 10): setiap `key` pada definisi kolom
benar-benar ada di baris datanya, untuk ketujuh laporan.

### 2.1 Kolom Penjumlah Ditandai Eksplisit

Hanya kolom bertanda `'total' => true` yang masuk baris TOTAL. Menjumlahkan
kolom persentase atau tanggal menghasilkan angka yang terlihat resmi dan tidak
berarti apa-apa.

Laporan Mutasi Stok karena itu **tidak punya baris total sama sekali** — kolom
"Jumlah"-nya mencampur gram, mililiter, dan buah dalam satu laporan.
Menjumlahkannya persis kesalahan yang sudah pernah terjadi di Modul 3.

---

## 3. Laporan Persediaan — Disusun Ulang, Bukan Dibaca

Ini satu-satunya laporan yang **tidak boleh menyentuh kolom `current_stock`**.
Kolom itu berisi keadaan hari ini; pertanyaan "berapa stok tanggal 1 bulan
lalu" hanya bisa dijawab dengan menjumlahkan ulang seluruh mutasi sampai
tanggal itu saja.

**Harga pokoknya pun disusun ulang.** Rata-rata tertimbang dihitung ulang dari
pergerakan masuk sampai tanggal tersebut, bukan memakai `avg_cost` hari ini.
Tanpa itu, nilai persediaan bulan lalu akan berubah setiap kali ada pembelian
baru minggu ini — dan laporan yang angkanya berubah sendiri setelah dicetak
tidak bisa dipakai untuk apa pun.

Rumus WAC-nya sengaja identik dengan `StockService::hitungHargaRataRata()`.
Itulah yang membuat rekonstruksinya bisa dibuktikan: **snapshot per hari ini
menghasilkan Rp2.754.337,95 — persis sama dengan yang dilaporkan modul
Persediaan yang berjalan** (§7 skenario 13). Kalau rumusnya berbeda, angkanya
akan berbeda.

Barang yang belum punya mutasi apa pun pada tanggal tersebut **dilewati**, tidak
ditampilkan berstok nol — memunculkannya akan menyiratkan barangnya sudah ada
dan kebetulan habis, padahal ia belum dibuat.

---

## 4. Dua Selisih yang Sengaja Dijelaskan

Laporan yang menampilkan angka berbeda untuk hal yang terdengar sama adalah
cara tercepat membuat seluruh modul tidak dipercaya. Dua selisih ditemukan saat
pengujian dan keduanya kini dijelaskan langsung di badan laporan:

**Laba Kotor: Produk Rp36.926 vs Penjualan Rp34.426.**
Selisihnya Rp2.500 — persis total diskon yang diberikan. Laporan Produk
menghitung laba per baris produk (nilai jual − HPP), **sebelum** diskon tingkat
transaksi. Diskon diberikan atas keseluruhan belanja dan tidak bisa dibebankan
ke produk tertentu tanpa mengarang. Catatan ini muncul di layar, di PDF, dan
di Excel.

**Stok Kini vs stok akhir periode.**
Kolom "Stok Kini" pada Laporan Produk menunjukkan stok hari ini, bukan stok
pada akhir periode laporan. Untuk itu ada Laporan Persediaan — dan catatannya
mengarahkan ke sana.

---

## 5. Prasyarat Sistem — Ekstensi `gd`

Laravel Excel bertumpu pada PhpSpreadsheet, yang **mensyaratkan ekstensi PHP
`gd`**. Di XAMPP ekstensi itu tersedia tetapi dinonaktifkan secara bawaan,
sehingga `composer require maatwebsite/excel` akan gagal.

Perubahan yang dilakukan, atas persetujuan:

```
C:\xampp\php\php.ini  baris 931
  sebelum  ;extension=gd
  sesudah   extension=gd
```

Cadangan tersimpan di `C:\xampp\php\php.ini.backup-sebelum-gd`.

> **Catatan penyebaran.** Ini mengubah PHP untuk seluruh proyek di komputer
> tersebut, bukan hanya proyek ini. Saat dipasang di server lain, `gd` harus
> ikut diaktifkan — kalau tidak, seluruh ekspor Excel akan gagal sementara
> pratinjau dan PDF tetap berjalan, sehingga masalahnya baru ketahuan saat
> seseorang menekan tombol Excel.

---

## 6. Bug yang Ditemukan Saat Pengujian

### 6.1 Gaya Kepala Tabel Excel Meleset Dua Baris

Berkas `.xlsx` lolos seluruh pemeriksaan "berkas valid": tanda tangan ZIP
benar, ukuran wajar, tidak ada galat. Baru setelah berkasnya **dibuka kembali
dan selnya dibaca satu per satu**, ketahuan bahwa kepala tabel berada di baris
11 sementara gayanya diterapkan ke baris 13.

Penyebabnya: baris pemisah ditulis `[]` (array kosong). PhpSpreadsheet membuang
baris yang benar-benar kosong, sehingga seluruh baris di bawahnya naik dua
tingkat. Akibatnya latar gelap kepala tabel mendarat di baris data, kepala
tabel yang asli tampil polos, dan pembekuan panel berhenti di tempat yang salah.

Perbaikannya satu karakter: `['']` alih-alih `[]`. Satu sel berisi teks kosong
sudah cukup membuat barisnya nyata.

**Pelajarannya:** memeriksa bahwa berkas ekspor "berhasil dibuat" tidak
membuktikan apa pun tentang isinya.

### 6.2 Bentuk `total` Berbeda di Satu Laporan

`total` dikirim sebagai objek JSON untuk enam laporan, tetapi sebagai array
kosong `[]` untuk Mutasi Stok — karena array PHP kosong menjadi `[]`, bukan
`{}`, saat dijadikan JSON. Frontend akan tersandung tepat di satu laporan saja:
jenis kesalahan yang paling lama dicari.

Diperbaiki dengan mengecor ke objek. Efek sampingnya harus ikut ditangani:
`empty()` atas objek kosong bernilai **false**, sehingga eksportir sempat
menyiapkan baris TOTAL kosong — dikembalikan menjadi array di `ReportExport`
dan `ReportController` sebelum dipakai.

---

## 7. API Endpoint

Prefix `/api/v1/reports` · penjaga `role:owner`

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/types` | Definisi tujuh laporan + isi seluruh pilihan filter |
| GET | `/{type}` | Pratinjau terstruktur |
| GET | `/{type}/export/excel` | Berkas `.xlsx` |
| GET | `/{type}/export/pdf` | Berkas `.pdf` |

Rute export didaftarkan **sebelum** `{type}` agar tidak tertangkap polanya.

Setiap ekspor dicatat di `activity_logs` — laporan formal adalah berkas yang
keluar dari sistem dan beredar di luar; siapa mengunduh apa dan kapan adalah
pertanyaan yang cepat atau lambat akan ditanyakan.

---

## 8. Struktur Folder

### 8.1 Backend

```
app/
  Enums/ReportType.php                          ← definisi tunggal: filter + kolom
  Services/ReportService.php                    ← tujuh query + rekonstruksi ledger
  Exports/ReportExport.php                      ← satu eksportir untuk tujuh laporan
  Http/Controllers/Api/V1/ReportController.php
resources/views/reports/pdf.blade.php           ← satu templat untuk tujuh laporan
```

Tidak ada migrasi. Tidak ada model baru.

Paket baru: `maatwebsite/excel ^3.1`, `barryvdh/laravel-dompdf ^3.1`.

### 8.2 Frontend

```
src/
  types/reports.ts
  services/reportService.ts
  components/reports/ReportFilterPanel.tsx      panel yang menyesuaikan jenis laporan
  pages/ReportsPage.tsx
```

### 8.3 Catatan Antarmuka

**Filter menyesuaikan jenis laporan.** Hanya filter yang benar-benar dipakai
yang ditampilkan, dan daftarnya datang dari server — satu sumber dengan yang
dipakai query-nya. Menampilkan filter supplier pada laporan produksi hanya
membuat pengguna mengira laporannya bisa disaring begitu.

**Berganti jenis laporan membuang filter yang tidak relevan.** Filter supplier
yang tertinggal dari laporan pembelian akan tetap terkirim ke laporan produksi
dan menyaring hasilnya tanpa ada isian yang terlihat di layar.

**Pintasan bulan/tahun mengosongkan rentang tanggal.** Keduanya menghasilkan
periode, dan server memprioritaskan bulan/tahun — membiarkan keduanya terisi
membuat layar menampilkan dua periode yang saling bertentangan.

**Pratinjau berhalaman 10 baris.** Laporan setahun bisa memuat ribuan baris;
mengirimkan seluruhnya hanya untuk ditampilkan di layar membuat setiap
perubahan filter terasa berat tanpa alasan.

Tiga hal yang dijaga pada paginasi ini:

| | |
|---|---|
| **Ringkasan dan baris TOTAL** | dihitung dari SELURUH baris, bukan dari halaman yang tampil |
| **Berkas ekspor** | tetap memuat seluruh baris — `build()` dipanggil tanpa nomor halaman |
| **Halaman melampaui batas** | dijepit ke halaman terakhir, tidak menghasilkan tabel kosong |

Yang pertama paling mudah salah dan paling sulit disadari: menghitung total
setelah pemotongan menghasilkan laporan yang totalnya berubah setiap kali
tombol "Berikutnya" ditekan — halaman 1 melaporkan omzet sepuluh transaksi
pertama sebagai omzet seluruh periode, dan angkanya tetap terlihat masuk akal.
Diuji secara eksplisit (§9 skenario 20).

---

## 9. Hasil Pengujian

| # | Skenario | Hasil |
|---|---|---|
| 1 | Admin Produksi & Kasir mengakses laporan | ✅ 403 keduanya |
| 2 | Owner mengakses | ✅ OK |
| 3 | Definisi tujuh jenis laporan | ✅ 10–13 kolom, filter sesuai |
| 4 | Pratinjau ketujuh laporan | ✅ Ringkasan + baris + total |
| 5 | Filter metode bayar / status penjualan | ✅ 4 → 3 tunai → 1 dibatalkan |
| 6 | Filter arah & sumber mutasi | ✅ 34 → 17 keluar → 5 penjualan |
| 7 | Pintasan bulan | ✅ 01–31 Juli 2026 |
| 8 | Pintasan tahun | ✅ 01 Jan – 31 Des 2026 |
| 9 | Jenis laporan tidak dikenal | ✅ 404 |
| 10 | **Setiap kunci kolom ada di barisnya** | ✅ Ketujuh laporan |
| 11 | Bentuk `total` seragam | ✅ Objek di ketujuhnya |
| 12 | Snapshot stok per tanggal lampau | ✅ 40 hari lalu = 0 barang (benar, belum ada mutasi) |
| 13 | **Snapshot hari ini = stok berjalan** | ✅ Kuantitas dan nilai (Rp2.754.337,95) sama persis |
| 14 | Omzet laporan = Dashboard Owner | ✅ Rp62.500 |
| 15 | Export Excel ketujuh laporan | ✅ ZIP valid, 7,5–9,7 KB |
| 16 | Export PDF ketujuh laporan | ✅ `%PDF` valid, ±880 KB |
| 17 | **Isi Excel dibaca ulang** | ✅ Angka tersimpan sebagai angka, kepala di baris 13, panel beku A14 |
| 18 | `stock:reconcile` & `data:check` | ✅ Bersih |
| 19 | Pratinjau berhalaman 10 baris | ✅ Ketujuh laporan |
| 20 | **Ringkasan & TOTAL sama di setiap halaman** | ✅ Omzet Rp62.500 di halaman 1 dan 2 |
| 21 | Telusuri seluruh halaman Mutasi Stok | ✅ 4 halaman, 34 baris terkumpul, tidak ada yang terulang |
| 22 | Halaman 999 pada laporan 1 halaman | ✅ Dijepit ke halaman 1, tabel tidak kosong |
| 23 | **Ekspor tidak ikut terpotong** | ✅ Excel memuat 34 baris = jumlah di basis data |
| 24 | `per_page` 5 / 25 / 500 | ✅ 7 halaman · 2 halaman · ditolak (batas 100) |

`npm run lint` dan `npm run build` lulus. Halaman Laporan 13 KB (chunk
terpisah); bundel awal tidak berubah.

**Yang belum diverifikasi:** tampilan PDF. Lingkungan ini tidak punya pembaca
PDF, jadi yang terbukti hanya bahwa berkasnya sah, berukuran wajar, dan
dihasilkan tanpa galat — bukan bahwa tata letaknya rapi di kertas. Struktur
HTML yang diberikan ke dompdf sudah diperiksa dengan membaca kode. Silakan buka
satu PDF dan beri tahu bila ada kolom terpotong.

---

## 10. Yang Sengaja Belum Dikerjakan

- **Ukuran berkas PDF ±880 KB** untuk laporan beberapa baris. Penyebabnya
  dompdf menyematkan seluruh berkas font DejaVu Sans. Bisa ditekan drastis
  dengan memakai font inti (Helvetica) yang tidak perlu disematkan, dengan
  risiko beberapa karakter khusus tidak terender. Dibiarkan karena keandalan
  huruf lebih berharga daripada ukuran berkas pada alat internal.
- **Laporan laba rugi penuh.** Yang ada di sini laba kotor; beban operasional
  (gaji, listrik, gas) belum tercatat di sistem mana pun.
- **Penjadwalan laporan otomatis.** Kirim laporan bulanan lewat email setiap
  tanggal 1 — butuh konfigurasi SMTP dan penjadwal.
- **Grafik di dalam PDF.** Laporan sekarang murni tabel.
- **Perbandingan antar periode** dalam satu laporan (bulan ini vs bulan lalu
  berdampingan).

---

## 11. Papan Status Setelah Modul Ini

Seluruh modul operasional dan pelaporan inti sudah berdiri:
Autentikasi, Master Data, Pembelian, Produksi, Tracking, Persediaan, Penjualan,
Dashboard Owner, dan Laporan.

Yang tersisa dari rancangan awal: Retur (M7), Kedaluwarsa/FEFO (M8), Forecast
(M9), Barcode/QR (M12), dan Stock Opname (M13).
