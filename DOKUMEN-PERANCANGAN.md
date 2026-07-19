# Dokumen Perancangan — Sistem Manajemen UMKM Roti

Versi 1.0 · 19 Juli 2026
Metode penyusunan: **Identifikasi Scope → Divide & Conquer → Algorithmic Design**

---

# BAGIAN 1 — IDENTIFIKASI SCOPE

## 1.1 Latar Belakang Masalah

UMKM roti memiliki karakteristik operasional yang khas dan menyulitkan pencatatan manual:

| Masalah | Dampak Nyata |
|---|---|
| Bahan baku berubah bentuk menjadi produk jadi | Stok tepung tidak bisa dihitung dari penjualan roti secara langsung |
| Konsumsi bahan bersifat proporsional terhadap resep | Salah takar = kerugian tak terdeteksi |
| Bahan baku dan produk cepat rusak | Kerugian dari kedaluwarsa jarang tercatat |
| Pembelian bahan tidak terjadwal | Sering kehabisan bahan di tengah produksi |
| Harga bahan naik-turun | HPP tidak akurat, harga jual asal tebak |

**Inti masalah:** pemilik usaha tidak tahu **berapa stok sebenarnya**, **berapa biaya produksi sebenarnya**, dan **kapan harus membeli lagi**.

## 1.2 Tujuan Sistem

| Kode | Tujuan | Indikator Keberhasilan |
|---|---|---|
| G1 | Stok bahan baku akurat dan real-time | Selisih stok fisik vs sistem < 3% saat stock opname |
| G2 | Produksi otomatis memotong stok sesuai resep | 100% batch produksi tercatat dengan konsumsi bahan |
| G3 | Peringatan dini sebelum stok habis | 0 kejadian "produksi batal karena bahan habis" |
| G4 | Riwayat pergerakan stok dapat ditelusuri | Setiap perubahan stok punya sumber yang jelas |
| G5 | Biaya produksi per produk diketahui | HPP per pcs tersedia untuk semua produk aktif |

## 1.3 Aktor Pengguna

| Aktor | Peran | Modul yang Diakses |
|---|---|---|
| **Pemilik / Owner** | Pengambil keputusan, lihat laporan | Semua (read) + Laporan + Dashboard |
| **Admin Gudang** | Terima barang, catat stok, opname | Persediaan, Pembelian, Supplier |
| **Kepala Produksi** | Jalankan batch produksi | Resep (BOM), Produksi |
| **Kasir** | Catat penjualan dan retur | Penjualan (POS), Retur |

## 1.4 Ruang Lingkup

### ✅ Termasuk dalam Scope (In Scope)

**Fitur Utama — Prioritas Tertinggi**
1. **Manajemen Resep (BOM)** — komposisi bahan baku per produk, dengan skalabilitas ke jumlah produksi apa pun
2. **Pembelian Bahan Baku & Manajemen Supplier** — PO, penerimaan barang, update stok otomatis, riwayat harga
3. **Monitoring Persediaan Real-time** — stok masuk, stok keluar, stok menipis, stok habis

**Fitur Pendukung**
4. Tracking produksi bahan mentah → barang jadi (batch tracking)
5. Penjualan produk jadi (POS sederhana)
6. Retur penjualan
7. Monitoring kedaluwarsa (FEFO)
8. Forecast kebutuhan produksi
9. Dashboard analitik & notifikasi otomatis
10. Laporan laba kotor berbasis HPP
11. Barcode / QR Code untuk percepatan input

### ❌ Di Luar Scope (Out of Scope)

| Hal | Alasan |
|---|---|
| Akuntansi penuh (jurnal umum, neraca, buku besar) | Bukan kebutuhan UMKM tahap ini; cukup laba kotor |
| Payroll & absensi karyawan | Domain terpisah |
| Multi-cabang / multi-gudang | Kompleksitas transfer stok antar lokasi; disiapkan di skema DB, tidak diimplementasi |
| Integrasi marketplace (Shopee/Tokopedia) | Butuh API pihak ketiga, tahap lanjutan |
| Pembayaran digital (QRIS/EDC) real | Cukup catat metode pembayaran |
| Mobile app native | Cukup web responsive (PWA) |

### ⚠️ Batasan & Asumsi

- Satu lokasi usaha, satu gudang.
- Semua kuantitas disimpan dalam **satuan dasar** (`g`, `ml`, `pcs`) — konversi hanya di lapisan tampilan.
- Produk jadi tidak menjadi bahan baku produk lain (**BOM 1 level**, bukan bertingkat). Jika nanti perlu (misal "adonan dasar" dipakai 3 produk), naikkan ke BOM multi-level — sudah diantisipasi di §3.4.
- Resep punya toleransi *yield loss* (susut adonan), bukan konversi sempurna.
- Sistem dijalankan online; offline-first bersifat opsional (§4.3).

## 1.5 Entitas Data Inti

```
Supplier ──< PurchaseOrder ──< POItem >── Ingredient
                                              │
                                              ├──< StockBatch (lot + kedaluwarsa)
                                              │
                                              └──< StockLedger >── (sumber: PO/Produksi/Penjualan/Opname)
                                              │
                                        RecipeItem
                                              │
Product ──< Recipe ────────────────────────────┘
   │
   ├──< ProductionBatch (menghasilkan Product, mengonsumsi Ingredient)
   ├──< SaleItem >── Sale
   └──< ReturnItem >── SalesReturn
```

## 1.6 Kondisi Saat Ini (Hasil Audit Kode)

| Aspek | Status | Catatan |
|---|---|---|
| Frontend | 🟡 Prototipe berjalan | React 19 + TS + Vite + Tailwind, 4 halaman |
| Backend | 🔴 Kosong | Folder `Backend/` belum berisi apa pun |
| Persistensi | 🔴 Tidak ada | Semua data di `useState`, hilang saat refresh |
| Modul Penjualan | 🔴 Belum ada | Padahal ini sumber data untuk forecast & laba |
| Validasi stok saat produksi | 🔴 Cacat | `Math.max(0, stok - kebutuhan)` menyembunyikan stok minus alih-alih menolak produksi |
| Stok produk jadi | 🟡 Ditulis, tak dibaca | `const [, setProducts]` — nilainya tidak pernah ditampilkan |
| ID transaksi | 🟡 Rawan tabrakan | `Date.now()` dapat menghasilkan ID kembar |
| Autentikasi & peran | 🔴 Belum ada | User masih hardcoded di Sidebar |

**Kesimpulan audit:** UI sudah menjadi aset berharga dan layak dipertahankan. Yang kurang adalah **fondasi data** — itulah yang harus dikerjakan lebih dulu.

---

# BAGIAN 2 — DIVIDE & CONQUER

## 2.1 Prinsip Pemecahan

Masalah besar dipecah dengan tiga sumbu:

1. **Sumbu Lapisan (Horizontal)** — pisahkan Data → Logika Bisnis → API → UI, agar logika stok tidak tercecer di komponen React.
2. **Sumbu Domain (Vertikal)** — pisahkan per konteks bisnis: Persediaan, Resep, Produksi, Pembelian, Penjualan, Analitik.
3. **Sumbu Waktu (Bertahap)** — kerjakan **satu modul per iterasi**, setiap modul harus bisa berjalan dan bermanfaat sendiri sebelum lanjut.

## 2.2 Arsitektur Berlapis

```
┌──────────────────────────────────────────────────┐
│  LAPIS 4 — PRESENTASI (React + TS + Tailwind)    │
│  Halaman, komponen, form, tabel, grafik          │
├──────────────────────────────────────────────────┤
│  LAPIS 3 — API (REST /api/v1)                    │
│  Controller, validasi input, autentikasi, peran  │
├──────────────────────────────────────────────────┤
│  LAPIS 2 — LOGIKA BISNIS (Service)               │
│  StockService, BomService, ProductionService,    │
│  PurchaseService, SalesService, CostingService   │
│  ← SEMUA ATURAN STOK ADA DI SINI, TITIK          │
├──────────────────────────────────────────────────┤
│  LAPIS 1 — DATA (ORM + Database)                 │
│  Repository, transaksi ACID, migrasi skema       │
└──────────────────────────────────────────────────┘
```

**Aturan mutlak:** Lapis 4 **tidak boleh** menghitung stok. Frontend hanya menampilkan apa yang dikirim backend. Ini memperbaiki kelemahan prototipe saat ini di mana `handleExecuteProduction` melakukan aritmetika stok langsung di komponen.

### Rekomendasi Teknologi

| Lapis | Pilihan | Alasan |
|---|---|---|
| Database | **PostgreSQL** (dev: SQLite) | Butuh transaksi ACID untuk potong-stok; SQLite cukup untuk demo portofolio |
| ORM | **Prisma** | Skema deklaratif, migrasi otomatis, tipe TypeScript ikut ter-generate |
| Backend | **Node.js + Express + TypeScript** | Satu bahasa dengan frontend, tipe data bisa dibagi |
| Validasi | **Zod** | Skema validasi bisa dipakai bersama frontend-backend |
| Auth | **JWT + bcrypt** | Sederhana, cukup untuk skala UMKM |
| State FE | **TanStack Query** | Cache + invalidasi otomatis, hilangkan prop-drilling di `App.tsx` |

## 2.3 Peta Modul & Dependensi

```
M0 Fondasi (DB, Auth, API skeleton)
 │
 ├─► M1 Master Data (Bahan Baku, Produk, Kategori, Satuan)
 │    │
 │    ├─► M2 Persediaan & Ledger Stok  ★FITUR UTAMA 3
 │    │    │
 │    │    ├─► M3 Supplier & Pembelian ★FITUR UTAMA 2
 │    │    │
 │    │    ├─► M4 Resep / BOM          ★FITUR UTAMA 1
 │    │    │    │
 │    │    │    └─► M5 Produksi (mentah → jadi)
 │    │    │         │
 │    │    │         └─► M6 Penjualan (POS)
 │    │    │              │
 │    │    │              ├─► M7 Retur Penjualan
 │    │    │              ├─► M9 Forecast Produksi
 │    │    │              └─► M10 Laporan Laba Kotor
 │    │    │
 │    │    ├─► M8 Kedaluwarsa & Batch (FEFO)
 │    │    ├─► M11 Dashboard & Notifikasi
 │    │    └─► M12 Barcode / QR
 │    │
 │    └─► M13 Stock Opname
```

## 2.4 Rincian Setiap Modul

### M0 — Fondasi Sistem
| Item | Isi |
|---|---|
| **Tujuan** | Menyiapkan tulang punggung: database, migrasi, autentikasi, struktur API |
| **Isi** | Skema Prisma lengkap, seeder data awal, login/logout JWT, middleware peran, error handler global, struktur folder backend |
| **Output** | `POST /auth/login`, `GET /auth/me`, DB ter-migrasi |
| **Definition of Done** | Bisa login sebagai 4 peran; endpoint terproteksi menolak token tidak valid |
| **Estimasi** | 1 iterasi |

### M1 — Master Data
| Item | Isi |
|---|---|
| **Tujuan** | Sumber kebenaran untuk semua identitas barang |
| **Isi** | CRUD Bahan Baku, CRUD Produk, kategori, satuan dasar + satuan tampilan, faktor konversi, harga jual, `minStock` |
| **Output** | `/api/v1/ingredients`, `/api/v1/products` |
| **DoD** | Frontend bisa menambah bahan baru dan langsung muncul di halaman Persediaan |
| **Estimasi** | 1 iterasi |

### M2 — Persediaan & Ledger Stok ★
| Item | Isi |
|---|---|
| **Tujuan** | Menjadikan stok **hasil perhitungan**, bukan angka yang diedit manual |
| **Isi** | Tabel `stock_ledger` append-only, penyesuaian manual, klasifikasi status stok, filter & pencarian, riwayat pergerakan per bahan |
| **Output** | `GET /inventory/status`, `GET /inventory/:id/ledger`, `POST /inventory/adjustment` |
| **DoD** | Setiap perubahan stok punya baris ledger; total ledger == stok tampil; 4 status (Aman/Menipis/Kritis/Habis) tampil benar |
| **Estimasi** | 2 iterasi |

### M3 — Supplier & Pembelian ★
| Item | Isi |
|---|---|
| **Tujuan** | Stok bertambah otomatis dan tercatat harganya saat barang diterima |
| **Isi** | CRUD Supplier, buat PO, status PO (Draft → Dipesan → Diterima Sebagian → Selesai → Batal), penerimaan barang (bisa parsial), riwayat harga bahan, skor performa supplier |
| **Output** | `/suppliers`, `/purchase-orders`, `POST /purchase-orders/:id/receive` |
| **DoD** | Terima PO → stok naik + ledger `IN` + harga rata-rata terupdate, semua dalam satu transaksi DB |
| **Estimasi** | 2 iterasi |

### M4 — Resep / BOM ★
| Item | Isi |
|---|---|
| **Tujuan** | Menghubungkan bahan baku dengan produk jadi |
| **Isi** | CRUD Resep, item resep, `yieldQuantity`, persentase susut (waste %), versi resep, kalkulator biaya resep, simulasi "bisa produksi berapa banyak?" |
| **Output** | `/recipes`, `GET /recipes/:id/max-producible`, `GET /recipes/:id/cost` |
| **DoD** | Ubah resep tidak mengubah riwayat produksi lama (versioning); biaya per pcs muncul otomatis |
| **Estimasi** | 2 iterasi |

### M5 — Produksi
| Item | Isi |
|---|---|
| **Tujuan** | Eksekusi transformasi bahan mentah → produk jadi |
| **Isi** | Buat batch, validasi ketersediaan **sebelum** eksekusi, potong stok bahan, tambah stok produk jadi, status batch, pencatatan hasil aktual vs target, pencatatan produk gagal/rusak |
| **Output** | `POST /production/batches`, `POST /production/batches/:id/complete` |
| **DoD** | Produksi dengan bahan kurang **ditolak** dengan pesan bahan mana yang kurang — bukan dipaksa jadi nol |
| **Estimasi** | 2 iterasi |

### M6 — Penjualan (POS)
| Item | Isi |
|---|---|
| **Tujuan** | Mencatat penjualan dan memotong stok produk jadi |
| **Isi** | Keranjang, diskon, metode bayar, cetak/simpan struk, penjualan harian, pembatalan transaksi |
| **Output** | `POST /sales`, `GET /sales/daily-summary` |
| **DoD** | Jual 10 roti → stok produk turun 10 + ledger produk tercatat + omzet harian bertambah |
| **Estimasi** | 2 iterasi |

### M7 — Retur Penjualan
| Item | Isi |
|---|---|
| **Isi** | Retur bertaut ke nota penjualan, alasan retur (rusak/salah/basi), keputusan: kembali ke stok atau dibuang, koreksi omzet |
| **DoD** | Retur "layak jual" mengembalikan stok; retur "rusak" masuk kerugian, bukan stok |
| **Estimasi** | 1 iterasi |

### M8 — Kedaluwarsa & Batch (FEFO)
| Item | Isi |
|---|---|
| **Isi** | Lot/batch bahan dengan tanggal kedaluwarsa, konsumsi FEFO, daftar "akan kedaluwarsa dalam N hari", pencatatan pembuangan (waste) |
| **DoD** | Produksi mengambil dari lot terdekat kedaluwarsa lebih dulu |
| **Estimasi** | 2 iterasi |

### M9 — Forecast Kebutuhan Produksi
| Item | Isi |
|---|---|
| **Isi** | Rata-rata bergerak tertimbang + pola hari-dalam-minggu, rekomendasi jumlah produksi, terjemahan ke kebutuhan bahan, saran PO |
| **DoD** | Menampilkan "Senin depan produksi ±120 pcs Roti Cokelat, butuh 24 kg terigu (kurang 6 kg)" |
| **Estimasi** | 2 iterasi |

### M10 — Laporan Laba Kotor
| Item | Isi |
|---|---|
| **Isi** | HPP metode rata-rata tertimbang (WAC), laba kotor per produk/periode, produk paling menguntungkan, nilai persediaan |
| **DoD** | Angka laba kotor cocok saat diverifikasi manual dengan sampel 1 hari transaksi |
| **Estimasi** | 2 iterasi |

### M11 — Dashboard & Notifikasi
| Item | Isi |
|---|---|
| **Isi** | KPI (omzet, produk terlaris, nilai persediaan, bahan terboros), grafik tren, pusat notifikasi, aturan peringatan yang bisa diatur |
| **DoD** | Semua angka dashboard berasal dari API agregat, bukan hitungan di frontend |
| **Estimasi** | 2 iterasi |

### M12 — Barcode / QR Code
| Item | Isi |
|---|---|
| **Isi** | Generate kode per bahan/produk/batch, cetak label, pemindaian via kamera web untuk POS & penerimaan barang |
| **Estimasi** | 1–2 iterasi |

### M13 — Stock Opname
| Item | Isi |
|---|---|
| **Isi** | Sesi opname, input hitungan fisik, laporan selisih, penyesuaian resmi dengan alasan & persetujuan |
| **DoD** | Selisih tercatat sebagai baris ledger bertipe `ADJUSTMENT`, bukan penimpaan diam-diam |
| **Estimasi** | 1 iterasi |

## 2.5 Urutan Eksekusi yang Direkomendasikan

Karena Anda ingin **eksekusi per modul**, berikut urutannya beserta alasan:

| Tahap | Modul | Mengapa Urutan Ini |
|---|---|---|
| **Tahap 1 — Fondasi** | M0 → M1 → M2 | Tanpa ledger stok, semua modul lain menghitung di atas angka yang tidak bisa dipercaya |
| **Tahap 2 — Fitur Utama** | M3 → M4 → M5 | Ini adalah 3 fitur utama Anda; menghasilkan siklus lengkap beli → resep → produksi |
| **Tahap 3 — Sirkulasi** | M6 → M7 | Menutup siklus sampai uang masuk; membuka data untuk analitik |
| **Tahap 4 — Kecerdasan** | M10 → M11 → M9 | Laba kotor lebih dahulu dari forecast, karena forecast butuh data penjualan yang sudah menumpuk |
| **Tahap 5 — Penyempurnaan** | M8 → M13 → M12 | Peningkatan kualitas operasional |

> **Catatan penting:** urutan M2 sebelum M3/M4/M5 tidak bisa ditukar. Ledger stok adalah fondasi tempat ketiga fitur utama berdiri.

## 2.6 Kontrak Antar Modul

Agar modul bisa dikerjakan terpisah tanpa saling merusak, definisikan kontrak sejak awal:

```ts
// Satu-satunya pintu masuk perubahan stok — dipakai M3, M5, M6, M7, M13
interface StockMovementRequest {
  itemId: string;
  itemType: 'INGREDIENT' | 'PRODUCT';
  quantity: number;          // selalu positif, arah ditentukan oleh direction
  direction: 'IN' | 'OUT';
  sourceType: 'PURCHASE' | 'PRODUCTION_CONSUME' | 'PRODUCTION_YIELD'
            | 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'WASTE';
  sourceId: string;          // id PO / batch / nota — untuk penelusuran
  unitCost?: number;         // wajib untuk arah IN, dipakai menghitung HPP
  note: string;
  operatorId: string;
  idempotencyKey: string;    // mencegah dobel potong stok
}
```

Setiap modul baru cukup memanggil `StockService.applyMovement()`. **Tidak ada modul yang boleh menulis kolom stok secara langsung.**

---

# BAGIAN 3 — ALGORITHMIC DESIGN

## 3.0 Konvensi Dasar

- Semua kuantitas internal dalam **satuan dasar**: `g`, `ml`, `pcs`. Konversi hanya saat menampilkan/menerima input.
- Semua nilai uang dalam **rupiah bulat** (integer), hindari `float` untuk uang.
- Semua operasi yang menyentuh stok berjalan dalam **transaksi database** dan bersifat **idempoten**.

## 3.1 Algoritma A1 — Ledger Stok (Sumber Kebenaran Tunggal)

**Prinsip:** stok bukan angka yang diedit, tetapi **hasil penjumlahan riwayat**. Ini memberi audit trail otomatis dan menghilangkan kelas bug "angka stok berubah tanpa jejak".

```
FUNGSI applyMovement(req):
  1. JIKA sudah ada ledger dengan idempotencyKey = req.idempotencyKey:
       KEMBALIKAN ledger tersebut          // idempoten, aman untuk retry
  2. MULAI TRANSAKSI
  3.   item ← KUNCI BARIS item (SELECT ... FOR UPDATE)   // cegah race condition
  4.   delta ← (req.direction = 'IN') ? +req.quantity : -req.quantity
  5.   stokBaru ← item.currentStock + delta
  6.   JIKA stokBaru < 0 DAN req.sourceType ≠ 'ADJUSTMENT':
         BATALKAN TRANSAKSI
         LEMPAR ErrorStokTidakCukup(item, tersedia=item.currentStock, diminta=req.quantity)
  7.   JIKA req.direction = 'IN':
         perbaruiHargaRataRata(item, req.quantity, req.unitCost)     // lihat A7
  8.   SISIPKAN baris ledger { ...req, saldoSebelum, saldoSesudah, waktu }
  9.   PERBARUI item.currentStock ← stokBaru
 10. COMMIT
 11. picuEvaluasiNotifikasi(item)          // lihat A2 & A10
```

**Titik kritis yang diperbaiki dari prototipe:** langkah 6. Prototipe saat ini memakai `Math.max(0, ...)` yang berarti produksi dengan bahan kurang tetap berhasil dan stok dipaksa jadi nol — kerugian tersembunyi. Algoritma ini **menolak** dan menjelaskan bahan mana yang kurang.

- Kompleksitas: `O(1)` per pergerakan.
- Rekonsiliasi berkala: `SUM(delta) FROM ledger WHERE itemId = X` harus sama dengan `item.currentStock`. Jalankan sebagai pemeriksaan malam hari.

## 3.2 Algoritma A2 — Klasifikasi Status Stok

Menghasilkan 4 status untuk monitoring persediaan (fitur utama #3).

```
FUNGSI klasifikasiStok(item):
  s   ← item.currentStock
  min ← item.minStock

  JIKA s <= 0            → 'HABIS'      (merah, prioritas 1)
  JIKA s < min * 0.5     → 'KRITIS'     (oranye, prioritas 2)
  JIKA s <= min          → 'MENIPIS'    (kuning, prioritas 3)
  JIKA s > min * 3       → 'BERLEBIH'   (biru, prioritas 5) // modal mengendap / risiko basi
  SELAIN ITU             → 'AMAN'       (hijau, prioritas 4)
```

**Peningkatan penting — ambang batas dinamis.** `minStock` statis cepat usang. Hitung ulang otomatis dari konsumsi nyata:

```
FUNGSI hitungMinStockDinamis(item):
  pemakaianHarian ← RATA2(konsumsi harian item selama 30 hari terakhir dari ledger OUT)
  stdDev          ← SIMPANGAN_BAKU(konsumsi harian tersebut)
  leadTime        ← RATA2(hari antara tanggal PO dan tanggal terima, per supplier)

  stokPengaman    ← 1.65 × stdDev × √leadTime      // tingkat layanan 95%
  titikPesanUlang ← (pemakaianHarian × leadTime) + stokPengaman

  KEMBALIKAN BULATKAN_KE_ATAS(titikPesanUlang)
```

Angka 1.65 adalah nilai-Z untuk service level 95% (boleh diatur per bahan: bahan kritis 99% → 2.33).

## 3.3 Algoritma A3 — Explode BOM & Cek Ketersediaan

Inti dari fitur utama #1. Menjawab: *"kalau saya mau produksi 200 roti, bahan apa saja yang dibutuhkan dan cukup atau tidak?"*

```
FUNGSI explodeBOM(resep, jumlahTarget):
  faktor ← jumlahTarget / resep.yieldQuantity

  kebutuhan ← []
  UNTUK SETIAP item DALAM resep.items:
    qtyDasar   ← item.quantity × faktor
    qtyDenganSusut ← qtyDasar × (1 + item.wastePercent / 100)   // susut adonan
    kebutuhan.TAMBAH({ ingredientId: item.ingredientId, butuh: qtyDenganSusut })

  KEMBALIKAN kebutuhan


FUNGSI cekKetersediaan(resep, jumlahTarget):
  kebutuhan ← explodeBOM(resep, jumlahTarget)
  kurang    ← []

  UNTUK SETIAP k DALAM kebutuhan:
    bahan ← ambilBahan(k.ingredientId)
    JIKA bahan.currentStock < k.butuh:
      kurang.TAMBAH({
        nama: bahan.name,
        butuh: k.butuh,
        tersedia: bahan.currentStock,
        selisih: k.butuh - bahan.currentStock
      })

  KEMBALIKAN { bisaProduksi: kurang.KOSONG(), kekurangan: kurang, kebutuhan }
```

**Turunan berguna — kapasitas produksi maksimum** (tampilkan di kartu resep):

```
FUNGSI maxProducible(resep):
  batas ← TAK_HINGGA
  UNTUK SETIAP item DALAM resep.items:
    bahan ← ambilBahan(item.ingredientId)
    perUnit ← (item.quantity × (1 + item.wastePercent/100)) / resep.yieldQuantity
    JIKA perUnit > 0:
      batas ← MIN(batas, PEMBULATAN_BAWAH(bahan.currentStock / perUnit))
  KEMBALIKAN batas       // "bahan pembatas" = item yang menghasilkan nilai MIN
```

- Kompleksitas: `O(n)` dengan n = jumlah item resep (khas: 5–12). Sangat murah.
- Untuk BOM multi-level (jika kelak "adonan dasar" jadi entitas), ganti dengan **DFS + memoisasi** dan **deteksi siklus** agar resep tidak saling memanggil tanpa henti.

## 3.4 Algoritma A4 — Eksekusi Produksi (Transaksional)

Inti tracking bahan mentah → barang jadi.

```
FUNGSI eksekusiProduksi(resepId, jumlah, operator, idemKey):
  MULAI TRANSAKSI
    resep ← ambilResep(resepId) DENGAN KUNCI
    cek   ← cekKetersediaan(resep, jumlah)

    JIKA BUKAN cek.bisaProduksi:
      BATALKAN
      KEMBALIKAN Gagal(cek.kekurangan)      // ← tampilkan daftar bahan yang kurang di UI

    batch ← BUAT ProductionBatch {
      resepId, targetQty: jumlah, status: 'BERJALAN',
      versiResep: resep.version,            // kunci versi resep saat ini
      operator, waktuMulai: sekarang
    }

    totalBiaya ← 0
    UNTUK SETIAP k DALAM cek.kebutuhan:
      // FEFO: ambil dari lot dengan kedaluwarsa terdekat (lihat A10)
      alokasi ← alokasiFEFO(k.ingredientId, k.butuh)
      UNTUK SETIAP lot DALAM alokasi:
        applyMovement({
          itemId: k.ingredientId, itemType: 'INGREDIENT',
          quantity: lot.qty, direction: 'OUT',
          sourceType: 'PRODUCTION_CONSUME', sourceId: batch.id,
          idempotencyKey: idemKey + ':' + k.ingredientId + ':' + lot.id,
          note: 'Produksi batch ' + batch.id
        })
        totalBiaya ← totalBiaya + (lot.qty × lot.unitCost)

    batch.biayaBahan ← totalBiaya
    batch.hppPerUnit ← totalBiaya / jumlah
    batch.status ← 'MENUNGGU_HASIL'
  COMMIT
  KEMBALIKAN batch


FUNGSI selesaikanProduksi(batchId, hasilBaik, hasilRusak, idemKey):
  MULAI TRANSAKSI
    batch ← ambilBatch(batchId) DENGAN KUNCI
    JIKA batch.status ≠ 'MENUNGGU_HASIL': BATALKAN, LEMPAR ErrorStatusTidakValid

    applyMovement({
      itemId: batch.productId, itemType: 'PRODUCT',
      quantity: hasilBaik, direction: 'IN',
      sourceType: 'PRODUCTION_YIELD', sourceId: batch.id,
      unitCost: batch.biayaBahan / MAX(hasilBaik, 1),   // biaya rusak dibebankan ke produk baik
      idempotencyKey: idemKey
    })

    batch.hasilBaik   ← hasilBaik
    batch.hasilRusak  ← hasilRusak
    batch.yieldRate   ← hasilBaik / batch.targetQty
    batch.status      ← 'SELESAI'
  COMMIT
```

**Mengapa dua langkah (mulai → selesai)?** Karena di dunia nyata, bahan sudah habis dipakai walaupun hasilnya kurang dari target (adonan gagal mengembang, roti gosong). Model satu langkah memaksa asumsi "target = hasil" yang tidak pernah benar. `yieldRate` yang terkumpul juga menjadi data untuk memperbaiki persentase susut di resep.

## 3.5 Algoritma A5 — Penerimaan Barang (PO Receive)

Inti fitur utama #2.

```
FUNGSI terimaPO(poId, daftarDiterima, operator, idemKey):
  MULAI TRANSAKSI
    po ← ambilPO(poId) DENGAN KUNCI
    JIKA po.status DALAM ['SELESAI','BATAL']: BATALKAN, LEMPAR ErrorStatusPO

    UNTUK SETIAP d DALAM daftarDiterima:
      itemPO ← po.items.CARI(d.poItemId)
      sisa   ← itemPO.qtyPesan - itemPO.qtyDiterima
      JIKA d.qty > sisa × 1.05:                 // toleransi kelebihan kirim 5%
        BATALKAN, LEMPAR ErrorKelebihanKirim

      applyMovement({
        itemId: itemPO.ingredientId, itemType: 'INGREDIENT',
        quantity: d.qty, direction: 'IN',
        sourceType: 'PURCHASE', sourceId: po.id,
        unitCost: d.hargaSatuan ?? itemPO.hargaSatuan,
        idempotencyKey: idemKey + ':' + itemPO.id
      })

      JIKA d.tanggalKedaluwarsa ADA:
        BUAT StockBatch { ingredientId, qty: d.qty, expiryDate: d.tanggalKedaluwarsa,
                          unitCost, poId }

      itemPO.qtyDiterima ← itemPO.qtyDiterima + d.qty
      catatRiwayatHarga(itemPO.ingredientId, po.supplierId, d.hargaSatuan, hariIni)

    po.status ← SEMUA item terpenuhi ? 'SELESAI' : 'DITERIMA_SEBAGIAN'
    perbaruiSkorSupplier(po.supplierId, po.tanggalJanji, hariIni)
  COMMIT
```

**Skor performa supplier:**

```
FUNGSI perbaruiSkorSupplier(supplierId, tanggalJanji, tanggalTerima):
  telat ← MAX(0, selisihHari(tanggalTerima, tanggalJanji))

  ketepatanWaktu  ← rataBergerak(riwayat: telat = 0 ? 100 : MAX(0, 100 - telat×15))
  kelengkapan     ← rataBergerak(qtyDiterima / qtyPesan × 100)
  kestabilanHarga ← 100 - (simpanganBaku(hargaRiwayat) / rataHarga × 100)

  skor ← 0.4×ketepatanWaktu + 0.35×kelengkapan + 0.25×kestabilanHarga
```

## 3.6 Algoritma A6 — Penjualan & Retur

```
FUNGSI catatPenjualan(keranjang, metodeBayar, kasir, idemKey):
  MULAI TRANSAKSI
    // Validasi seluruh keranjang DULU sebelum memotong apa pun
    UNTUK SETIAP baris DALAM keranjang:
      produk ← ambilProduk(baris.productId) DENGAN KUNCI
      JIKA produk.currentStock < baris.qty:
        BATALKAN, LEMPAR ErrorStokProdukKurang(produk, produk.currentStock)

    nota ← BUAT Sale { kasir, metodeBayar, waktu: sekarang }
    subtotal ← 0; totalHPP ← 0

    UNTUK SETIAP baris DALAM keranjang:
      applyMovement({ itemId: baris.productId, itemType:'PRODUCT', quantity: baris.qty,
                      direction:'OUT', sourceType:'SALE', sourceId: nota.id,
                      idempotencyKey: idemKey + ':' + baris.productId })

      hargaBaris ← baris.qty × baris.hargaSatuan × (1 - baris.diskon/100)
      subtotal   ← subtotal + hargaBaris
      totalHPP   ← totalHPP + (baris.qty × ambilHPPRataRata(baris.productId))

    nota.subtotal   ← subtotal
    nota.hpp        ← totalHPP
    nota.labaKotor  ← subtotal - totalHPP        // dibekukan saat transaksi
  COMMIT
```

**Penting:** `labaKotor` disimpan di nota, tidak dihitung ulang saat membuat laporan. Jika HPP dihitung ulang belakangan, laporan bulan lalu akan berubah setiap kali harga bahan naik — angka historis harus beku.

```
FUNGSI catatRetur(saleId, daftarRetur, alasan, operator, idemKey):
  MULAI TRANSAKSI
    nota ← ambilNota(saleId)
    JIKA selisihHari(sekarang, nota.waktu) > 7: LEMPAR ErrorLewatBatasRetur

    UNTUK SETIAP r DALAM daftarRetur:
      barisAsli ← nota.items.CARI(r.productId)
      JIKA r.qty > barisAsli.qty - barisAsli.qtyDikembalikan: LEMPAR ErrorQtyRetur

      JIKA r.kondisi = 'LAYAK_JUAL':
        applyMovement({ ...r, direction:'IN', sourceType:'RETURN' })   // stok kembali
      SELAIN ITU:
        catatKerugian(r.productId, r.qty, ambilHPPRataRata(r.productId), alasan)
        // stok TIDAK dikembalikan — barang rusak/basi

      barisAsli.qtyDikembalikan ← barisAsli.qtyDikembalikan + r.qty

    nota.totalRetur   ← nota.totalRetur + nilaiRetur
    nota.labaKotor    ← nota.labaKotor - labaKotorRetur
  COMMIT
```

## 3.7 Algoritma A7 — HPP Rata-rata Tertimbang (WAC)

Dipilih ketimbang FIFO karena jauh lebih sederhana untuk dipahami pemilik UMKM, dan cukup akurat untuk bahan yang harganya tidak ekstrem berfluktuasi.

```
FUNGSI perbaruiHargaRataRata(item, qtyMasuk, hargaSatuanBaru):
  nilaiLama ← item.currentStock × item.avgCost
  nilaiBaru ← qtyMasuk × hargaSatuanBaru
  qtyTotal  ← item.currentStock + qtyMasuk

  item.avgCost ← qtyTotal > 0 ? (nilaiLama + nilaiBaru) / qtyTotal : hargaSatuanBaru
```

**Contoh:** stok 10 kg terigu @ Rp12.000 = Rp120.000. Beli 20 kg @ Rp15.000 = Rp300.000.
→ avgCost baru = (120.000 + 300.000) / 30 = **Rp14.000/kg**.

**Laporan laba kotor per produk:**

```
FUNGSI laporanLabaKotor(tglMulai, tglAkhir):
  UNTUK SETIAP produk:
    qtyTerjual ← SUM(SaleItem.qty)         dalam rentang, dikurangi retur layak-jual
    pendapatan ← SUM(SaleItem.hargaBaris)  dalam rentang
    hpp        ← SUM(SaleItem.qty × SaleItem.hppSaatItu)   // HPP beku, bukan HPP hari ini

    labaKotor  ← pendapatan - hpp
    margin     ← pendapatan > 0 ? labaKotor / pendapatan × 100 : 0

  URUTKAN MENURUN berdasarkan labaKotor
  KEMBALIKAN { perProduk, totalPendapatan, totalHPP, totalLaba, marginRataRata }
```

**Nilai persediaan saat ini:** `SUM(currentStock × avgCost)` untuk semua bahan + semua produk jadi.

## 3.8 Algoritma A8 — Forecast Kebutuhan Produksi

Metode: **rata-rata bergerak tertimbang + faktor hari-dalam-minggu**. Dipilih karena penjualan roti punya pola mingguan sangat kuat (akhir pekan ramai), sementara ARIMA/ML berlebihan untuk data UMKM yang tipis.

```
FUNGSI forecastPenjualan(produkId, tanggalTarget):
  riwayat ← penjualanHarian(produkId, 56 hari terakhir)    // 8 minggu

  JIKA riwayat.jumlah < 14:
    KEMBALIKAN { nilai: RATA2(riwayat), keyakinan: 'RENDAH',
                 catatan: 'Data belum cukup, minimal 2 minggu' }

  // 1) Basis: rata-rata tertimbang — data terbaru lebih berpengaruh
  bobot ← [0.4, 0.3, 0.2, 0.1]                  // minggu ke-1 s.d. ke-4 terakhir
  basis ← 0
  UNTUK i DARI 0 SAMPAI 3:
    basis ← basis + bobot[i] × RATA2(penjualan minggu ke-(i+1) terakhir)

  // 2) Faktor musiman hari-dalam-minggu
  hari          ← namaHari(tanggalTarget)
  rataHariIni   ← RATA2(penjualan pada hari yang sama, 8 minggu terakhir)
  rataSemuaHari ← RATA2(seluruh riwayat)
  faktorHari    ← rataSemuaHari > 0 ? rataHariIni / rataSemuaHari : 1

  // 3) Faktor tren
  tren ← RATA2(4 minggu terakhir) / RATA2(4 minggu sebelumnya)
  tren ← BATASI(tren, 0.7, 1.3)                 // redam lonjakan ekstrem

  ramalan ← basis × faktorHari × tren

  // 4) Stok pengaman agar tidak kehabisan
  stdDev  ← SIMPANGAN_BAKU(riwayat)
  ramalan ← ramalan + 0.5 × stdDev

  KEMBALIKAN { nilai: BULATKAN_ATAS(ramalan), faktorHari, tren,
               keyakinan: riwayat.jumlah >= 42 ? 'TINGGI' : 'SEDANG' }


FUNGSI rekomendasiProduksi(tanggalTarget):
  rencana ← []
  UNTUK SETIAP produk aktif:
    ramalan   ← forecastPenjualan(produk.id, tanggalTarget)
    stokAda   ← produk.currentStock
    perluBuat ← MAX(0, ramalan.nilai - stokAda)

    JIKA perluBuat > 0:
      resep ← ambilResepAktif(produk.id)
      cek   ← cekKetersediaan(resep, perluBuat)
      rencana.TAMBAH({ produk, perluBuat, bisaProduksi: cek.bisaProduksi,
                       kekurangan: cek.kekurangan, keyakinan: ramalan.keyakinan })

  KEMBALIKAN rencana
```

**Jembatan ke pembelian** — ubah rencana produksi menjadi daftar belanja:

```
FUNGSI sarankanPO(horizonHari = 7):
  kebutuhanTotal ← peta kosong
  UNTUK SETIAP hari DALAM horizonHari ke depan:
    UNTUK SETIAP r DALAM rekomendasiProduksi(hari):
      UNTUK SETIAP k DALAM explodeBOM(resepAktif(r.produk), r.perluBuat):
        kebutuhanTotal[k.ingredientId] += k.butuh

  draftPO ← peta kosong (dikelompokkan per supplier)
  UNTUK SETIAP (bahanId, butuh) DALAM kebutuhanTotal:
    bahan     ← ambilBahan(bahanId)
    kekurangan ← butuh + hitungMinStockDinamis(bahan) - bahan.currentStock
    JIKA kekurangan > 0:
      qtyPesan ← BULATKAN_KE_KELIPATAN(kekurangan, bahan.satuanPembelian)
      draftPO[bahan.defaultSupplierId].TAMBAH({ bahan, qtyPesan })

  KEMBALIKAN draftPO       // siap dikonfirmasi menjadi PO sungguhan
```

Ini adalah fitur yang paling terasa "pintar" bagi pengguna: sistem otomatis menyusun daftar belanja mingguan lengkap dengan pengelompokan per supplier.

## 3.9 Algoritma A9 — Notifikasi Otomatis

```
FUNGSI evaluasiNotifikasi():
  peringatan ← []

  // Stok
  UNTUK SETIAP bahan:
    status ← klasifikasiStok(bahan)
    JIKA status DALAM ['HABIS','KRITIS','MENIPIS']:
      hariTersisa ← bahan.currentStock / MAX(pemakaianHarian(bahan), 0.001)
      peringatan.TAMBAH({ jenis:'STOK_'+status, item: bahan,
                          pesan: 'Cukup untuk ±' + BULATKAN(hariTersisa) + ' hari lagi',
                          aksi: 'Buat PO', prioritas: prioritasDari(status) })

  // Kedaluwarsa
  UNTUK SETIAP lot DENGAN expiryDate ≤ hariIni + 7 DAN sisaQty > 0:
    peringatan.TAMBAH({ jenis:'AKAN_KEDALUWARSA', item: lot,
                        pesan: 'Kedaluwarsa dalam ' + selisihHari + ' hari',
                        aksi: 'Prioritaskan pemakaian', prioritas: 2 })

  // Produksi
  UNTUK SETIAP r DALAM rekomendasiProduksi(besok):
    JIKA BUKAN r.bisaProduksi:
      peringatan.TAMBAH({ jenis:'PRODUKSI_TERANCAM', prioritas: 1,
                          pesan: r.produk.name + ' tidak bisa diproduksi besok' })

  // Peredaman: jangan kirim peringatan sama dalam 24 jam
  peringatan ← SARING(p → BUKAN sudahDikirim(p.kunci, dalam: 24 jam))

  KEMBALIKAN URUT_MENAIK(peringatan, berdasarkan: prioritas)
```

Peredaman (*debounce*) 24 jam itu penting — tanpanya pengguna akan dibanjiri notifikasi dan berhenti membacanya.

## 3.10 Algoritma A10 — FEFO & Monitoring Kedaluwarsa

FEFO (*First Expired, First Out*) lebih tepat daripada FIFO untuk bahan pangan: yang paling dekat kedaluwarsa dipakai lebih dulu, bukan yang paling lama masuk.

```
FUNGSI alokasiFEFO(bahanId, qtyDibutuhkan):
  lots ← AMBIL StockBatch
         WHERE ingredientId = bahanId AND sisaQty > 0
         URUT MENAIK expiryDate, lalu MENAIK tanggalTerima   // NULL expiry di paling akhir

  alokasi ← []; sisa ← qtyDibutuhkan
  UNTUK SETIAP lot DALAM lots:
    JIKA sisa <= 0: KELUAR
    ambil ← MIN(lot.sisaQty, sisa)
    alokasi.TAMBAH({ lotId: lot.id, qty: ambil, unitCost: lot.unitCost })
    lot.sisaQty ← lot.sisaQty - ambil
    sisa        ← sisa - ambil

  JIKA sisa > 0: LEMPAR ErrorStokLotTidakCukup(bahanId, kurang: sisa)
  KEMBALIKAN alokasi
```

Kompleksitas `O(k log k)` dengan k = jumlah lot aktif per bahan (biasanya < 10).

```
FUNGSI cekKedaluwarsaHarian():
  UNTUK SETIAP lot DENGAN sisaQty > 0:
    sisaHari ← selisihHari(lot.expiryDate, hariIni)

    JIKA sisaHari < 0:
      applyMovement({ itemId, quantity: lot.sisaQty, direction:'OUT',
                      sourceType:'WASTE', note:'Kedaluwarsa otomatis' })
      catatKerugian(itemId, lot.sisaQty, lot.unitCost, 'KEDALUWARSA')
    SELAIN ITU JIKA sisaHari <= 3: buatPeringatan('KRITIS_KEDALUWARSA', lot)
    SELAIN ITU JIKA sisaHari <= 7: buatPeringatan('AKAN_KEDALUWARSA', lot)
```

## 3.11 Ringkasan Kompleksitas

| Algoritma | Kompleksitas | Frekuensi | Catatan Kinerja |
|---|---|---|---|
| A1 Pergerakan stok | O(1) | Sangat sering | Butuh indeks pada `(itemId, waktu)` |
| A2 Klasifikasi stok | O(1) per item | Sangat sering | Hitung di query, jangan di loop aplikasi |
| A3 Explode BOM | O(n), n = item resep | Sering | n khas 5–12, sangat murah |
| A4 Eksekusi produksi | O(n log k) | Harian | Dominan oleh alokasi FEFO |
| A5 Terima PO | O(m), m = item PO | Harian | Satu transaksi DB |
| A7 Laporan laba | O(t), t = transaksi | Harian/on-demand | Pakai tabel agregat harian jika t > 100.000 |
| A8 Forecast | O(d × p) | Harian (job malam) | d=56 hari, p=produk; cache hasilnya |
| A10 FEFO | O(k log k) | Per produksi | k < 10 lot per bahan |

**Indeks database yang wajib ada:**
```sql
CREATE INDEX idx_ledger_item_time   ON stock_ledger(item_id, created_at DESC);
CREATE INDEX idx_ledger_source      ON stock_ledger(source_type, source_id);
CREATE UNIQUE INDEX idx_ledger_idem ON stock_ledger(idempotency_key);
CREATE INDEX idx_batch_expiry       ON stock_batch(ingredient_id, expiry_date)
                                       WHERE remaining_qty > 0;
CREATE INDEX idx_sale_time          ON sales(created_at DESC);
CREATE INDEX idx_saleitem_product   ON sale_items(product_id, created_at);
```

---

# BAGIAN 4 — SARAN TAMBAHAN

Di luar 10 fitur yang sudah Anda daftarkan, berikut saran yang menurut saya memberi dampak besar dengan usaha kecil.

## 4.1 Sangat Direkomendasikan

| # | Saran | Mengapa Penting |
|---|---|---|
| S1 | **Ledger stok append-only** (bukan kolom stok yang di-update) | Sudah dibahas di A1. Ini adalah satu keputusan arsitektur yang menghilangkan seluruh kelas bug "stok kok beda". Menjadi audit trail gratis. |
| S2 | **Stock opname / penyesuaian resmi** | Stok sistem *pasti* akan meleset dari fisik (tumpah, dicicipi, salah timbang). Tanpa mekanisme opname, pengguna akan mengedit stok diam-diam dan semua laporan jadi bohong. |
| S3 | **Kunci idempotensi di setiap transaksi** | Kasir menekan tombol dua kali karena internet lambat = stok terpotong dua kali. Ini bug produksi paling umum di sistem POS. |
| S4 | **Pencatatan waste/kerugian eksplisit** | Roti gosong, adonan gagal, bahan tumpah. UMKM sering rugi 5–15% di sini tanpa pernah tahu angkanya. |
| S5 | **Versi resep** | Ubah resep hari ini tidak boleh mengubah HPP produksi bulan lalu. Simpan `recipeVersion` di setiap batch. |
| S6 | **Pencatatan hasil aktual vs target produksi** | `yieldRate` mengungkap masalah kualitas dan memperbaiki angka susut resep secara otomatis. |

## 4.2 Direkomendasikan

| # | Saran | Manfaat |
|---|---|---|
| S7 | **Kalkulator harga jual** | Dari HPP + margin target → saran harga jual. Banyak UMKM menetapkan harga asal tebak dan rugi tanpa sadar. |
| S8 | **Riwayat harga bahan + grafik tren** | Deteksi supplier yang diam-diam menaikkan harga. |
| S9 | **Analisis ABC persediaan** | Golongkan bahan: A (20% bahan, 80% nilai) diawasi ketat, C longgar. Fokuskan perhatian. |
| S10 | **Peran & hak akses** | Kasir tidak boleh mengubah stok gudang. Cegah kesalahan sekaligus kecurangan. |
| S11 | **Ekspor Excel/PDF** | Pemilik UMKM tetap butuh cetak untuk pajak, bank, atau investor. |
| S12 | **Soft delete di semua master data** | Menghapus bahan yang punya riwayat transaksi akan merusak laporan historis. Tandai nonaktif, jangan hapus. |
| S13 | **Backup otomatis harian** | Kehilangan data = kehilangan usaha. Cukup dump DB terjadwal ke folder/cloud. |
| S14 | **Konversi satuan yang fleksibel** | Beli terigu per sak 25 kg, pakai per gram. Simpan faktor konversi di master bahan, jangan hardcode. |

## 4.3 Opsional / Tahap Lanjut

| # | Saran | Catatan |
|---|---|---|
| S15 | **PWA + mode offline** | Dapur dan gudang sering sinyal buruk. Antre transaksi di IndexedDB, sinkron saat online. Butuh `idempotencyKey` (S3) agar aman. |
| S16 | **Multi-cabang** | Siapkan kolom `locationId` di skema sejak awal walau belum dipakai — migrasi belakangan jauh lebih mahal. |
| S17 | **Notifikasi WhatsApp** | Pemilik UMKM lebih sering membuka WA daripada dashboard. |
| S18 | **Manajemen pesanan/pre-order** | Roti ulang tahun, pesanan hajatan — bisa jadi input langsung untuk rencana produksi. |
| S19 | **Kartu resep untuk dapur** | Tampilan besar berisi takaran hasil skala, bisa dicetak/ditempel di dapur. |
| S20 | **Perbandingan pemakaian teoretis vs aktual** | Selisih antara "menurut BOM harusnya 20 kg" dan "opname bilang terpakai 23 kg" adalah indikator pemborosan atau kebocoran. |

## 4.4 Matriks Prioritas

```
 Dampak
   ▲
 T │  S1 Ledger        S2 Opname       │  Forecast (M9)
 I │  S3 Idempotensi   S5 Versi resep  │  Barcode (M12)
 N │  S4 Waste         S7 Harga jual   │  Multi-cabang (S16)
 G │  S6 Yield rate                    │
 G ─┼───────────────────────────────────┼──────────────────
 I │  S12 Soft delete  S11 Ekspor      │  S17 WA notif
 R │  S13 Backup       S14 Satuan      │  S15 Offline/PWA
 E │  S10 Peran akses  S8 Riwayat harga│  S18 Pre-order
 N │                                   │  S9 Analisis ABC
 D │       KERJAKAN DULU               │    NANTI SAJA
 A └───────────────────────────────────┴──────────────────►
        Usaha Rendah                      Usaha Tinggi
```

## 4.5 Perbaikan yang Perlu Dilakukan pada Kode Saat Ini

| Lokasi | Masalah | Perbaikan |
|---|---|---|
| `App.tsx` — `handleExecuteProduction` | `Math.max(0, stok - butuh)` menyembunyikan stok minus; produksi tetap "berhasil" walau bahan kurang | Validasi dengan A3 lebih dulu, **tolak** produksi jika kurang |
| `App.tsx` — `const [, setProducts]` | Stok produk jadi ditulis tetapi tidak pernah dibaca/ditampilkan | Tampilkan di Dashboard; setelah M6 ini menjadi sumber stok POS |
| `App.tsx` — `tx_${Date.now()}` | ID bisa tabrakan dalam milidetik yang sama | Gunakan UUID, atau serahkan ke database |
| `App.tsx` — `handleQuickPO` pakai `alert()` | Tidak membuat PO sungguhan, hanya menampilkan teks | Ganti dengan pembuatan draft PO sesungguhnya (M3) |
| Seluruh `App.tsx` | Semua state dan logika bisnis menumpuk di satu komponen | Pindahkan ke backend service; frontend cukup memanggil API via TanStack Query |
| `types/index.ts` | Belum ada entitas `Sale`, `StockBatch`, `PurchaseOrder`, `User` | Perluas seiring modul dikerjakan |

---

# BAGIAN 5 — RENCANA EKSEKUSI PER MODUL

Anda ingin mengerjakan **per modul, bukan sekaligus**. Berikut kerangka kerja yang saya sarankan untuk setiap iterasi:

## 5.1 Siklus Kerja Tiap Modul

```
1. Sepakati kontrak  → skema data + daftar endpoint disetujui sebelum menulis kode
2. Skema database    → migrasi Prisma + seeder
3. Service           → logika bisnis murni, tanpa Express, mudah diuji
4. API               → controller + validasi Zod + hak akses
5. Frontend          → halaman + integrasi API, hapus mock data terkait
6. Verifikasi        → uji skenario nyata + skenario gagal
7. Tutup iterasi     → perbarui dokumen ini, tentukan modul berikutnya
```

## 5.2 Aturan Antar Modul

- **Setiap modul harus bisa dipakai sendiri.** Setelah M2 selesai, halaman Persediaan sudah berguna walau M3–M5 belum ada.
- **Tidak ada modul yang menulis stok langsung.** Semua lewat `StockService.applyMovement()`.
- **Mock data dihapus bertahap.** Data tiruan di `App.tsx` dicabut per bagian seiring modulnya tersambung ke API — jangan dihapus semua sekaligus.
- **Dokumen ini hidup.** Setiap modul selesai, perbarui statusnya di §5.3.

## 5.3 Papan Status Modul

| Modul | Status | Iterasi | Catatan |
|---|---|---|---|
| M0 Fondasi | ✅ Selesai | 1 | Laravel 12 + JWT + MySQL. Lihat [MODUL-1-AUTHENTICATION.md](MODUL-1-AUTHENTICATION.md) |
| M1 Autentikasi & Pengguna | ✅ Selesai | 1 | Login, peran, CRUD pengguna, profil — 22 skenario diuji |
| M2 Master Data ★ | ✅ Selesai | 2 | Kategori, supplier, bahan baku, produk, **resep/BOM** — 29 skenario diuji. Lihat [MODUL-2-MASTER-DATA.md](MODUL-2-MASTER-DATA.md) |
| M3 Pembelian & Supplier ★ | ✅ Selesai | 3 | PO, penerimaan bertahap, stok otomatis, dashboard — 14 skenario diuji. Lihat [MODUL-3-PEMBELIAN.md](MODUL-3-PEMBELIAN.md) |
| M4 Produksi (BOM) ★ | ✅ Selesai | 4 | Hitung kebutuhan, tolak per bahan, batch atomik, dashboard — 15 skenario diuji. Lihat [MODUL-4-PRODUKSI.md](MODUL-4-PRODUKSI.md) |
| M4b Tracking Produksi ★ | ✅ Selesai | 5 | Tujuh tahap berurutan, timeline ERP, progress bar — 15 skenario diuji. Lihat [MODUL-5-TRACKING-PRODUKSI.md](MODUL-5-TRACKING-PRODUKSI.md) |
| M5 Persediaan & Ledger ★ | ✅ Selesai | 6 | Monitoring stok, riwayat mutasi, penyesuaian manual, peringatan otomatis, export — 23 skenario diuji. Lihat [MODUL-6-INVENTORY.md](MODUL-6-INVENTORY.md) |
| M6 Penjualan (POS) ★ | ✅ Selesai | 7 | Kasir, keranjang, diskon, pajak, struk 58mm, pembatalan, ringkasan — 32 skenario diuji. Lihat [MODUL-7-PENJUALAN.md](MODUL-7-PENJUALAN.md) |
| M7 Retur | ⬜ Belum mulai | — | Jenis mutasi `return` sudah disiapkan; dibedakan dari pembatalan penjualan (`sale_void`) yang sudah ada di M6 |
| M8 Kedaluwarsa (FEFO) | ⬜ Belum mulai | — | |
| M9 Forecast | ⬜ Belum mulai | — | |
| M10 Laba Kotor | ⬜ Belum mulai | — | |
| M11 Dashboard & Notifikasi | ⬜ Belum mulai | — | Sebagian UI sudah ada |
| M12 Barcode / QR | ⬜ Belum mulai | — | |
| M13 Stock Opname | ⬜ Belum mulai | — | Penyesuaian per barang sudah ada di M5; tersisa opname seluruh gudang dalam satu sesi |

> **Catatan penomoran.** Urutan prompt pengerjaan tidak selalu sama dengan
> penomoran modul di dokumen ini:
>
> | Prompt | Modul di tabel ini |
> |---|---|
> | Prompt 5 — Tracking Produksi | **M4b** — kelanjutan langsung Modul Produksi |
> | Prompt 6 — Inventory Management | **M5** — Persediaan & Ledger |
> | Prompt 7 — Penjualan (POS) | **M6** — Penjualan (POS) |
>
> Nama berkas dokumentasi mengikuti nomor prompt
> (`MODUL-5-TRACKING-PRODUKSI.md`, `MODUL-6-INVENTORY.md`), sedangkan papan
> status ini mengikuti penomoran rancangan awal.

## 5.4 Modul Pertama — Sudah Dikerjakan

> **Terlaksana pada iterasi 1 (19 Juli 2026), dengan penyesuaian.**
> M0 dikerjakan bersama modul Authentication & User Management, bukan bersama
> Master Data. Alasannya: autentikasi dan peran adalah prasyarat bagi setiap
> endpoint modul berikutnya — tanpa itu, semua rute yang dibangun harus
> dibongkar ulang untuk dipasangi penjaga. Master Data bahan baku dan produk
> digeser ke iterasi M2 karena isinya menyatu dengan ledger stok.
> Dokumentasi lengkap: [MODUL-1-AUTHENTICATION.md](MODUL-1-AUTHENTICATION.md).

Rencana awal iterasi pertama:

Alasannya: keduanya kecil, dan menggabungkannya langsung memberi hasil yang bisa dilihat — bahan baku sudah tersimpan permanen di database dan tetap ada setelah browser di-refresh. Ini menghilangkan kelemahan terbesar prototipe saat ini dan membuka jalan bagi M2.

**Isi konkret iterasi pertama:**
1. Inisialisasi Node + Express + TypeScript di `Backend/`
2. Skema Prisma: `User`, `Ingredient`, `Product`, `Category`, `Supplier`, `StockLedger`
3. Migrasi + seeder yang mengambil data dari mock `App.tsx` (agar tampilan tidak berubah)
4. Auth JWT + middleware peran
5. Endpoint CRUD bahan baku dan produk
6. Sambungkan halaman Persediaan ke API sungguhan, cabut mock `initialIngredients`

**Hasil yang terlihat:** tambah bahan baku baru → refresh browser → bahan tetap ada.
