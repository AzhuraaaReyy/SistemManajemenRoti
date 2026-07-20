# Modul 3 — Pembelian Bahan Baku & Supplier

> **Hak akses sudah berubah.** Berkas ini menggambarkan pembagian peran
> saat modul dibangun, ketika sistem masih memakai `admin_produksi`. Sejak
> 20 Juli 2026 peran itu dipecah menjadi Admin Gudang dan Kepala Produksi —
> lihat [MIGRASI-PERAN.md](MIGRASI-PERAN.md) untuk pembagian yang berlaku.

Status: **Selesai** · 19 Juli 2026 (revisi 1)
Alur: Supplier → Input Pembelian → Barang Datang → Tambah Stok → Riwayat Pembelian

---

## 0. Pemetaan terhadap Spesifikasi

Modul ini memenuhi seluruh butir spesifikasi, dengan tiga penyimpangan yang
disepakati bersama. Bagian ini menjelaskan pemetaannya agar tidak ada
kebingungan saat membandingkan dokumen dengan kode.

### 0.1 Nama Tabel

Sistem memakai penamaan bahasa Inggris secara konsisten sejak Modul 1
(`users`, `ingredients`, `recipes`, `products`). Mencampurnya dengan nama
Indonesia hanya di modul pembelian akan membuat skema terlihat tambal sulam.

| Istilah spesifikasi | Nama tabel di sistem | Isi |
|---|---|---|
| `transaksi_pembelian` | `purchase_orders` | Kepala pesanan: supplier, tanggal, nomor, status, total |
| `detail_pembelian` | `purchase_order_items` | Baris barang: bahan, jumlah, harga satuan, subtotal |
| `mutasi_stok` | `stock_ledger` | Mutasi stok generik — dibangun di Modul 2, dipakai bersama |
| — | `purchase_receipts` | **Tambahan**: dokumen kedatangan barang |
| — | `purchase_receipt_items` | **Tambahan**: rincian per kedatangan |

Dua tabel terakhir adalah tambahan di luar spesifikasi. Alasannya di §3.2:
pengiriman sering terpecah, dan tanpa dokumen kedatangan tersendiri pertanyaan
"kapan barangnya datang?" tidak bisa dijawab.

### 0.2 Status Pesanan

Spesifikasi menyebut tiga status. Sistem memakai lima, karena tiga status tidak
punya tempat untuk keadaan "barang baru datang sebagian" — padahal itu kejadian
sehari-hari.

| Istilah spesifikasi | Status di sistem | Keterangan |
|---|---|---|
| `pending` | `draft` | Masih disusun, belum dikirim ke supplier |
| `pending` | `ordered` | Sudah dipesan, menunggu barang |
| `barang diterima` | `partial` | **Tambahan** — sebagian sudah datang, sisanya ditunggu |
| `selesai` | `completed` | Seluruh barang diterima, atau sisa ditutup |
| — | `cancelled` | **Tambahan** — pesanan batal, dengan alasan tercatat |

Dengan model tiga status, pesanan 200 butir telur yang baru datang 100 harus
ditandai "barang diterima" (padahal separuh masih ditunggu) atau tetap "pending"
(padahal stok sudah bertambah). Keduanya membuat data tidak jujur.

**Kompatibilitas:** endpoint ubah-status menerima istilah spesifikasi apa
adanya — lihat §0.3.

### 0.3 Endpoint Ubah Status

Spesifikasi meminta satu endpoint "update status". Sistem menyediakannya
sebagai jalan pintas, sekaligus mempertahankan endpoint aksi rinci untuk
kedatangan bertahap.

```
PATCH /api/v1/purchases/orders/{id}/status
{ "status": "barang_diterima" }
```

Istilah yang diterima (huruf besar-kecil dan spasi diabaikan):

| Tujuan | Alias yang dikenali |
|---|---|
| Dipesan | `pending`, `ordered`, `dipesan`, `menunggu` |
| Barang diterima | `received`, `barang_diterima`, `diterima`, `partial` |
| Selesai | `completed`, `selesai`, `done` |
| Dibatalkan | `cancelled`, `canceled`, `dibatalkan`, `batal` |

Perilakunya:

- **Draft → diterima** — pesanan dikonfirmasi otomatis lebih dulu, agar jejak
  "kapan dipesan" tetap terisi dan tidak ada lompatan status.
- **Diterima** — seluruh sisa pesanan dicatat diterima penuh sesuai jumlah dan
  harga pesanan, lalu stok bertambah lewat `StockService`.
- **Sebagian → selesai** — sisa yang tidak jadi dikirim ditutup; barang yang
  sudah diterima tetap tercatat.
- **Idempoten** — mengubah status ke "diterima" berulang kali dijawab
  **sukses tanpa efek**, bukan error:

  ```
  Panggilan 1 → stok 0,5 kg → 10,5 kg  · "Barang diterima lengkap."
  Panggilan 2 → stok tetap 10,5 kg     · "Sudah diterima sebelumnya. Stok tidak ditambah lagi."
  Panggilan 3 → stok tetap 10,5 kg     · idem
  ```

  Menjawabnya sebagai error akan membuat klien yang mengirim ulang permintaan
  (jaringan lambat, tombol tertekan dua kali) mengira ada yang salah — padahal
  stok justru sudah benar.

Untuk kedatangan bertahap, `POST /orders/{id}/receive` tetap dipakai karena
mampu menerima jumlah per baris, harga berbeda, tanggal kedaluwarsa, dan nomor
batch.

---

## 1. Ruang Lingkup

| Yang diminta | Status | Keterangan |
|---|---|---|
| Supplier | ✅ | Master supplier sudah ada sejak Modul 2; modul ini menambah performa & riwayat harga |
| Input Pembelian | ✅ | Form pesanan dengan baris barang dinamis |
| Barang Datang | ✅ | Dialog penerimaan tersendiri, mendukung kedatangan bertahap |
| Tambah Stok otomatis | ✅ | Lewat `StockService` — tercatat di ledger, harga rata-rata ikut diperbarui |
| Riwayat Pembelian | ✅ | Daftar pesanan + riwayat penerimaan lintas pesanan |
| Nomor Pembelian | ✅ | `PO-2026-0001`, bernomor per tahun, tidak pernah dipakai ulang |
| Tanggal · Daftar Barang · Jumlah · Harga · Total | ✅ | Termasuk diskon per baris, diskon pesanan, ongkir, dan pajak |
| Detail Pembelian | ✅ | Rincian barang, kemajuan penerimaan, dan jejak siapa-melakukan-apa |
| Dashboard Pembelian | ✅ | Tren belanja, pesanan tertunda, bahan & supplier teratas, daftar perlu-dibeli |

---

## 2. Alur Kerja

```
┌──────────┐   buat    ┌──────────┐  konfirmasi  ┌──────────┐
│ SUPPLIER │──────────►│  DRAFT   │─────────────►│ DIPESAN  │
└──────────┘           └────┬─────┘              └────┬─────┘
                            │                         │
                       bisa diubah              barang datang
                       bisa dihapus                   │
                       bisa dibatalkan                ▼
                                            ┌───────────────────┐
                                            │ DITERIMA SEBAGIAN │
                                            └────┬──────────┬───┘
                                                 │          │
                                        barang lengkap   tutup paksa
                                                 │          │
                                                 ▼          ▼
                                            ┌──────────────────┐
                                            │     SELESAI      │
                                            └──────────────────┘

Setiap kali barang datang:
   PurchaseService::receive()
      └─► StockService::applyMovement(direction: 'in', source: PURCHASE)
             ├─► baris ledger tercatat
             ├─► current_stock bertambah
             └─► avg_cost dihitung ulang (rata-rata tertimbang)
```

**Titik pentingnya:** modul ini **tidak pernah** menulis `current_stock` secara
langsung. Seluruh penambahan stok melewati `StockService` yang dibangun di
Modul 2, sehingga setiap kilogram tepung yang masuk gudang punya baris ledger,
kunci idempotensi, dan jejak siapa yang mencatatnya.

---

## 3. Desain Database

### 3.1 ERD

```
┌──────────────┐
│  suppliers   │ (Modul 2)
└──────┬───────┘
       │ 1..N          RESTRICT — supplier dengan pesanan tak bisa dihapus
       ▼
┌────────────────────────────┐
│      purchase_orders       │
├────────────────────────────┤
│ PK id                      │
│ UQ po_number  PO-2026-0001 │
│ FK supplier_id             │
│    order_date              │
│    expected_date           │
│    completed_date          │
│    status         ENUM     │ draft|ordered|partial|completed|cancelled
│    subtotal                │
│    discount_amount         │
│    shipping_cost           │
│    tax_amount              │
│    total                   │
│ FK created_by / ordered_by │
│ FK cancelled_by            │
│    cancel_reason           │
│    deleted_at              │
└──────┬─────────────────┬───┘
       │ 1..N            │ 1..N
       ▼                 ▼
┌───────────────────────┐  ┌──────────────────────────┐
│ purchase_order_items  │  │   purchase_receipts      │
├───────────────────────┤  ├──────────────────────────┤
│ PK id                 │  │ PK id                    │
│ FK purchase_order_id  │  │ UQ receipt_number        │ TRM-2026-0001
│ FK ingredient_id      │  │ FK purchase_order_id     │
│    order_unit         │◄─┤    receipt_date          │
│    unit_factor        │  │    delivery_note_number  │
│    qty_ordered        │  │ FK received_by           │
│    qty_received       │  └────────────┬─────────────┘
│    unit_price         │               │ 1..N
│    discount_amount    │               ▼
│    line_total         │  ┌──────────────────────────┐
│ UQ (po_id, ingr_id)   │  │ purchase_receipt_items   │
└───────────┬───────────┘  ├──────────────────────────┤
            │              │ PK id                    │
            └──────────────┤ FK purchase_receipt_id   │
                     1..N  │ FK purchase_order_item_id│
                           │ FK ingredient_id         │
                           │    quantity              │
                           │    unit_price            │ ← harga saat DITERIMA
                           │    expiry_date           │ ← untuk Modul 8 (FEFO)
                           │    batch_number          │
                           └──────────────────────────┘
                                        │
                                        │ memicu
                                        ▼
                           ┌──────────────────────────┐
                           │  stock_ledger (Modul 2)  │
                           │  source_type = 'purchase'│
                           │  source_id = PO-2026-0001│
                           └──────────────────────────┘
```

### 3.2 Keputusan Desain Penting

| Keputusan | Alasan |
|---|---|
| **Tabel penerimaan terpisah**, bukan sekadar kolom `qty_received` | Pengiriman sering terpecah: pesan 25 sak, datang 15 sak tanggal 12, sisanya tanggal 15. Tanpa tabel ini kedua kejadian melebur jadi satu angka dan pertanyaan "kapan barang datang?" tak bisa dijawab. |
| **`order_unit` dan `unit_factor` dibekukan di baris pesanan** | Bila satuan tampilan tepung diubah dari kg ke sak bulan depan, dokumen pembelian bulan lalu harus tetap terbaca "20 kg" seperti saat disetujui — bukan berubah jadi "0,8 sak". |
| **Harga penerimaan boleh beda dari harga pesanan** | Supplier kadang menaikkan harga sepihak atau memberi potongan mendadak. Yang dipakai menghitung harga rata-rata persediaan adalah harga yang **benar-benar dibayar**, bukan harga di atas kertas. |
| **Nilai uang disimpan sebagai angka jadi** (`subtotal`, `total`) | Dokumen keuangan harus menunjukkan angka yang sama persis dengan saat disetujui, meskipun harga bahan di master berubah setelahnya. |
| **`unit_price` disimpan per satuan dasar** | Konsisten dengan seluruh sistem. Harga per satuan pesan = `unit_price × unit_factor`, dihitung saat ditampilkan. |
| **`UNIQUE(purchase_order_id, ingredient_id)`** | Bahan ganda dalam satu pesanan membuat penerimaan ambigu — baris mana yang diisi? Ubah jumlahnya, jangan tambah baris. |
| **Supplier pakai `RESTRICT`, bukan cascade** | Menghapus supplier yang punya riwayat pembelian akan membuat dokumen historis kehilangan rujukan. |

---

## 4. API Endpoint

Base URL: `/api/v1/purchases`
Penjaga: `auth:api` → `active` → `role:owner,admin_produksi`

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/dashboard` | Ringkasan, tren, tertunda, teratas, perlu-dibeli |
| GET | `/suppliers/{id}/performance` | Ketepatan waktu, kelengkapan, skor |
| GET | `/statuses` | Daftar status untuk filter |
| GET | `/receipts` | Riwayat penerimaan lintas pesanan |
| GET | `/orders` | Daftar pesanan + filter & paginasi |
| POST | `/orders` | Buat pesanan (status draft) |
| GET | `/orders/{id}` | Detail lengkap + riwayat penerimaan |
| PUT | `/orders/{id}` | Ubah (**hanya draft**) |
| DELETE | `/orders/{id}` | Hapus (**hanya draft**) |
| PATCH | `/orders/{id}/status` | **Ubah status** — jalan pintas, idempoten (§0.3) |
| POST | `/orders/{id}/confirm` | Draft → Dipesan |
| POST | `/orders/{id}/receive` | **Barang datang → stok bertambah** (per baris) |
| POST | `/orders/{id}/cancel` | Batalkan (wajib alasan) |
| POST | `/orders/{id}/close` | Tutup sisa yang tidak jadi dikirim |

**Filter `/orders`:** `search`, `status`, `supplier_id`, `date_from`, `date_to`,
`outstanding`, `sort_by`, `sort_dir`, `per_page`

**Contoh mencatat barang datang:**

```json
POST /api/v1/purchases/orders/5/receive
{
  "receipt_date": "2026-07-19",
  "delivery_note_number": "SJ/SM/1207",
  "idempotency_key": "receive-5-1721...",
  "items": [
    {
      "purchase_order_item_id": 9,
      "quantity": 20,                    // dalam satuan pesan (kg)
      "unit_price": 8500,                // per kg, boleh beda dari pesanan
      "expiry_date": "2028-07-18"
    }
  ]
}
```

---

## 5. Aturan Bisnis yang Ditegakkan

| Aturan | Alasan | Diuji |
|---|---|---|
| Hanya draft yang bisa diubah atau dihapus | Pesanan terkonfirmasi adalah dokumen yang mungkin sudah dikirim ke supplier | ✅ |
| Pesanan yang sudah menerima barang tidak bisa dibatalkan | Stok terlanjur bertambah; membatalkannya menyisakan stok tanpa dokumen | ✅ |
| Penerimaan maksimal 105% dari sisa pesanan | Sak tepung tidak pernah persis 25.000 g. Menolak selisih 200 g memaksa petugas memalsukan angka. Di atas 5% bukan lagi selisih timbangan. | ✅ |
| Penerimaan bersifat idempoten | Tombol tertekan dua kali tidak boleh menambah stok dua kali | ✅ |
| Bahan tidak boleh ganda dalam satu pesanan | Penerimaan jadi ambigu | ✅ |
| Tanggal pesan tidak boleh di masa depan | Dokumen mundur, bukan maju | ✅ |
| Perkiraan tiba tidak boleh sebelum tanggal pesan | Mustahil secara logika | ✅ |
| Diskon baris tidak boleh melebihi nilai barisnya | Menghasilkan subtotal negatif | ✅ |
| Tanggal kedaluwarsa harus setelah hari ini | Barang kedaluwarsa jangan diterima | ✅ |
| Baris penerimaan harus milik pesanan yang bersangkutan | Mencegah penerimaan disusupkan ke pesanan lain | ✅ |
| Alasan pembatalan wajib, minimal 5 karakter | Agar riwayat bisa ditelusuri | ✅ |
| Pesanan tanpa barang tidak bisa dikonfirmasi | Dokumen kosong tidak ada gunanya | ✅ |

---

## 6. Catatan Implementasi

### 6.1 Bug yang Ditemukan dan Diperbaiki Saat Pengujian

Versi pertama menghitung persentase penerimaan dengan menjumlahkan kuantitas
mentah lintas satuan. Hasilnya menyesatkan:

```
PO-2026-0002:  25 kg gula (25.000 g)  +  200 butir telur
Diterima    :  25 kg gula lengkap     +  100 butir telur

Perhitungan lama : (25.000 + 100) / (25.000 + 200) = 99,6% ❌
Perhitungan baru : berbasis nilai rupiah            = 70,3% ✅
```

100 butir telur yang belum datang tenggelam di antara 25.000 gram gula.
Sekarang persentase dihitung **berbasis nilai**, dengan fallback ke rata-rata
kelengkapan per baris bila seluruh harga nol.

### 6.2 Idempotensi Penerimaan

Kunci dibuat sekali per pembukaan dialog di frontend:

```ts
idempotencyKey.current = `receive-${order.id}-${Date.now()}-${acak}`;
```

Diteruskan ke `StockService` sebagai `"{kunci}:item:{id}"` per baris. Tiga
permintaan identik terverifikasi hanya menambah stok satu kali.

### 6.3 Harga Rata-Rata Tertimbang

Terverifikasi cocok dengan hitungan manual:

```
Stok awal : 0,5 kg mentega @ Rp85.000
Pembelian : 10  kg mentega @ Rp86.000

(0,5 × 85.000 + 10 × 86.000) / 10,5 = Rp85.952/kg
Sistem melaporkan                    = Rp85.952/kg ✓
```

### 6.4 Kemampuan Aksi Ditentukan Server

`PurchaseOrderResource` mengirim `can_edit`, `can_confirm`, `can_receive`,
`can_cancel`, `can_close`. Frontend hanya menampilkan tombol sesuai nilai itu,
tidak menebak dari status.

Kalau frontend menebak sendiri, aturan akan tertulis di dua tempat dan
pelan-pelan berbeda — tombol muncul padahal server menolak, atau sebaliknya.

### 6.5 Pemecahan Kode per Rute

Bundel menembus 507 KB pada modul ketiga. Seluruh halaman kini dimuat saat
rutenya dibuka:

| | Sebelum | Sesudah |
|---|---|---|
| Bundel awal | 507 KB (147 KB gzip) | **293 KB (95 KB gzip)** |
| Peringatan ukuran | Ada | Hilang |

Halaman login tetap dimuat langsung karena itulah yang pertama dilihat.

### 6.6 Saran Pembelian Otomatis

Dashboard menampilkan bahan yang stoknya di bawah minimum **dan belum ada
pesanan berjalan** — bahan yang sudah dipesan tidak perlu diingatkan lagi.

Saran jumlah = `(stok minimum × 2) − stok saat ini`, agar tidak langsung
menipis lagi minggu depan.

---

## 7. Struktur Folder

### 7.1 Backend

```
Backend/app/
├── Enums/PurchaseOrderStatus.php        ← 5 status + aturan transisinya
├── Models/
│   ├── PurchaseOrder.php                ← penomoran, persentase berbasis nilai
│   ├── PurchaseOrderItem.php            ← konversi ke satuan pesan
│   ├── PurchaseReceipt.php
│   └── PurchaseReceiptItem.php
├── Services/PurchaseService.php         ← seluruh aturan alur kerja
├── Http/
│   ├── Controllers/Api/V1/Purchase/
│   │   ├── PurchaseOrderController.php
│   │   └── PurchaseDashboardController.php
│   ├── Requests/Purchase/
│   │   ├── PurchaseOrderRequest.php
│   │   └── ReceiveGoodsRequest.php
│   └── Resources/
│       ├── PurchaseOrderResource.php
│       ├── PurchaseOrderItemResource.php
│       └── PurchaseReceiptResource.php
└── database/
    ├── migrations/2026_07_19_1204xx_*   ← 4 migration
    └── seeders/PurchaseSeeder.php       ← 4 contoh PO mencakup semua status
```

### 7.2 Frontend

```
Frontend/src/
├── components/purchase/
│   ├── PurchaseFormModal.tsx      ← input pesanan, baris dinamis, ringkasan hidup
│   ├── ReceiveGoodsModal.tsx      ← barang datang, kunci idempotensi
│   └── PurchaseDetailModal.tsx    ← rincian + riwayat penerimaan
├── pages/purchase/
│   ├── PurchaseDashboardPage.tsx
│   ├── PurchaseOrdersPage.tsx
│   └── ReceiptHistoryPage.tsx
├── services/purchaseService.ts
└── types/purchase.ts
```

---

### 6.7 Filter Tanggal (perbaikan revisi 1)

Backend sejak awal mendukung `date_from` dan `date_to`, tetapi **antarmukanya
belum dipasang** — kelalaian yang ketahuan saat membandingkan ulang dengan
spesifikasi.

`FilterBar` kini mendukung rentang tanggal opsional, dipakai di halaman Pesanan
(menyaring tanggal pesan) dan Penerimaan (menyaring tanggal terima). Komponennya
dibuat generik supaya modul penjualan dan laporan nanti tinggal memakainya.

---

## 8. Hasil Pengujian

### 8.1 Pengujian Revisi 1

| # | Skenario | Hasil |
|---|---|---|
| 1 | `PATCH /status` dengan istilah `barang_diterima` → stok naik 10 kg | ✅ |
| 2 | Panggilan kedua → sukses tanpa efek, stok tetap | ✅ |
| 3 | Panggilan ketiga → idem | ✅ |
| 4 | Draft langsung ke `received` → dikonfirmasi otomatis, jejak terisi | ✅ |
| 5 | Sebagian → `selesai` → sisa ditutup, barang diterima tetap tercatat | ✅ |
| 6 | Pesanan selesai → `received` → idempoten, bukan error | ✅ |
| 7 | Pesanan yang sudah terima barang → `batal` → ditolak | ✅ |
| 8 | Status tidak dikenali → pesan menyebutkan alias yang valid | ✅ |
| 9 | Filter tanggal pesanan & penerimaan | ✅ |

### 8.2 Pengujian Awal

**14 skenario** diuji langsung terhadap API berjalan:

| Kelompok | Cakupan |
|---|---|
| **Hak akses** | Kasir ditolak (403) · Owner & Admin Produksi diizinkan |
| **Alur lengkap** | Buat → konfirmasi → terima → stok bertambah → riwayat |
| **Penerimaan parsial** | Gula lengkap, telur separuh → status Diterima Sebagian |
| **Harga rata-rata** | Terverifikasi cocok dengan hitungan manual |
| **Idempotensi** | 3× kirim dengan kunci sama → stok naik satu kali |
| **Toleransi kirim** | 150 dari sisa 100 ditolak · 104 dari sisa 100 diterima |
| **Proteksi ubah** | Pesanan selesai tidak bisa diubah/dihapus/dibatalkan |
| **Validasi** | Bahan ganda · tanggal masa depan · diskon berlebih |
| **Pembatalan** | Draft dikonfirmasi lalu dibatalkan dengan alasan |
| **Dashboard** | Tren, per status, bahan teratas, perlu-dibeli |
| **Konsistensi** | `stock:reconcile` dan `data:check` bersih setelah semua operasi |

**Frontend** — `npm run build` lulus · `npm run lint` bersih (satu warning
tersisa dari `Production.tsx`, berkas prototipe lama).

---

## 9. Yang Sengaja Belum Dikerjakan

| Hal | Alasan |
|---|---|
| Cetak PO ke PDF | Berguna, tetapi bukan prasyarat modul berikutnya. Data lengkapnya sudah tersedia di endpoint detail. |
| Retur pembelian ke supplier | Barang rusak dikembalikan. Perlu alur tersendiri; untuk sekarang bisa dicatat lewat penyesuaian stok. |
| Pembayaran & utang supplier | Domain keuangan, di luar cakupan §1.4 dokumen perancangan. |
| Perbandingan harga antar supplier (UI) | Data `ingredient_supplier.last_price` sudah terisi otomatis setiap penerimaan; halamannya menyusul. |
| Batch/lot FEFO | Kolom `expiry_date` dan `batch_number` sudah terisi saat penerimaan, menunggu Modul 8 memakainya. |

---

## 10. Modul Berikutnya

**M4 — Persediaan.** Setelah modul ini, ledger stok sudah punya dua sumber
nyata: `opening` dari master data dan `purchase` dari pembelian. Yang tersisa
untuk M4 adalah antarmuka pemantauannya:

| Sisa pekerjaan M4 | Sudah tersedia |
|---|---|
| Halaman monitoring stok masuk/keluar/menipis/habis | `Ingredient::stockStatus()` + endpoint statistik |
| Riwayat pergerakan per bahan | `GET /master/ingredients/{id}/ledger` |
| Penyesuaian stok manual | `StockService::adjustToCount()` |
| Stock opname + laporan selisih | Ledger `adjustment` + `stock:reconcile` |
| Notifikasi stok menipis | `averageDailyUsage()` untuk "cukup berapa hari lagi" |

Setelah itu [Dashboard.tsx](Frontend/src/components/Dashboard.tsx) dari
prototipe disambungkan ke `/persediaan` dengan data sungguhan.
