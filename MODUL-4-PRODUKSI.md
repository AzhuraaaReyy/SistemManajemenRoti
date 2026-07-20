# Modul 4 — Produksi (Bill of Materials)

> **Hak akses sudah berubah.** Berkas ini menggambarkan pembagian peran
> saat modul dibangun, ketika sistem masih memakai `admin_produksi`. Sejak
> 20 Juli 2026 peran itu dipecah menjadi Admin Gudang dan Kepala Produksi —
> lihat [MIGRASI-PERAN.md](MIGRASI-PERAN.md) untuk pembagian yang berlaku.

Status: **Selesai** · 19 Juli 2026
Alur: Pilih Produk → Input Jumlah → Hitung Kebutuhan → Cek Stok → Potong Bahan + Buat Batch → Selesaikan → Stok Produk Bertambah

---

## 1. Pemenuhan Spesifikasi

| Yang diminta | Status | Keterangan |
|---|---|---|
| Pilih produk yang akan diproduksi | ✅ | Hanya produk aktif yang punya resep aktif |
| Input jumlah produksi | ✅ | Dengan pratinjau langsung |
| Sistem membaca resep (BOM) | ✅ | Lewat `RecipeService::resolveForProduction()` |
| Hitung kebutuhan = qty_per_unit × jumlah | ✅ | Termasuk persentase susut per bahan |
| Cek stok setiap bahan | ✅ | |
| Tolak + tampilkan bahan kurang & selisihnya | ✅ | Rincian per bahan, bukan pesan generik |
| Kurangi stok + catat di mutasi_stok | ✅ | `keluar` · sumber `production_consume` · ref nomor batch |
| Buat batch berstatus "Diproses" | ✅ | `in_progress` |
| Setelah selesai → tambah stok produk jadi | ✅ | `masuk` · sumber `production_yield` · ref nomor batch |
| DB transaction atomik | ✅ | Seluruh operasi dalam satu `DB::transaction` |
| REST API create / list / detail | ✅ | Plus preview, complete, cancel |
| Form Produksi dengan pratinjau | ✅ | Tabel kebutuhan + status stok sebelum submit |
| Dashboard Produksi (aktif + riwayat) | ✅ | Plus kapasitas produksi & bahan terpakai |
| **Pakai mutasi_stok yang sudah ada** | ✅ | `stock_ledger` dari Modul 2/3 — **tidak ada tabel mutasi baru** |

---

## 2. Skema Database

### 2.1 ERD

```
┌──────────────┐        ┌──────────────┐
│   products   │        │   recipes    │  (Modul 2)
└──────┬───────┘        └──────┬───────┘
       │ RESTRICT              │ RESTRICT
       ▼                       ▼
┌──────────────────────────────────────────┐
│          production_batches              │  ← "batch_produksi"
├──────────────────────────────────────────┤
│ PK id                                    │
│ UQ batch_number      PRO-2026-0001       │
│ UQ idempotency_key                       │ ← cegah batch ganda
│ FK product_id                            │
│ FK recipe_id                             │
│    recipe_version    (dibekukan)         │
│    target_quantity                       │
│    good_quantity     (diisi saat selesai)│
│    reject_quantity                       │
│    status  ENUM  in_progress|completed|  │
│                  cancelled               │
│    material_cost     (dibekukan)         │
│    cost_per_unit                         │
│    started_at / finished_at              │
│ FK operator_id / completed_by            │
│ FK cancelled_by · cancel_reason          │
└──────────────────┬───────────────────────┘
                   │ 1..N
                   ▼
┌──────────────────────────────────────────┐
│      production_batch_materials          │  ← "detail_produksi"
├──────────────────────────────────────────┤
│ PK id                                    │
│ FK production_batch_id                   │
│ FK ingredient_id           RESTRICT      │
│    qty_per_unit    (takaran resep beku)  │
│    qty_required                          │
│    qty_used                              │
│    waste_percent                         │
│    unit_cost       (harga beku)          │
│    line_cost                             │
│    stock_before    (untuk penelusuran)   │
│ UQ (batch_id, ingredient_id)             │
└──────────────────┬───────────────────────┘
                   │ memicu
                   ▼
┌──────────────────────────────────────────┐
│      stock_ledger  (Modul 2 — DIPAKAI    │  ← "mutasi_stok"
│                     ULANG, bukan baru)   │
├──────────────────────────────────────────┤
│  direction=out  source=production_consume│  bahan keluar
│  direction=in   source=production_yield  │  produk jadi masuk
│  direction=in   source=production_cancel │  bahan kembali (batal)
│  source_id = PRO-2026-0001               │  referensi nomor batch
└──────────────────────────────────────────┘
```

### 2.2 Pemetaan ke Istilah Spesifikasi

| Istilah spesifikasi | Nama tabel di sistem |
|---|---|
| `batch_produksi` | `production_batches` |
| `detail_produksi` / `pemakaian_bahan` | `production_batch_materials` |
| `mutasi_stok` | `stock_ledger` — **dipakai ulang dari Modul 2** |

Penamaan bahasa Inggris konsisten dengan seluruh sistem sejak Modul 1.

### 2.3 Keputusan Desain Penting

| Keputusan | Alasan |
|---|---|
| **Harga bahan dibekukan** di `unit_cost` per baris | Kalau HPP dihitung ulang dari `avg_cost` terkini, biaya produksi bulan lalu ikut berubah setiap harga bahan naik. Laporan laba periode lampau harus tetap sama angkanya. |
| **`recipe_version` disimpan**, bukan hanya `recipe_id` | Agar laporan lama bisa menjelaskan "batch ini memakai resep versi berapa". Versi tersebut juga otomatis dikunci permanen begitu dipakai. |
| **`qty_required` dan `qty_used` dipisah** | Untuk sekarang selalu sama, tetapi memisahkannya membuat koreksi manual di kemudian hari terlihat sebagai selisih, bukan menimpa angka rencana. |
| **`stock_before` dicatat per bahan** | Menjawab "berapa stoknya sesaat sebelum batch ini jalan?" tanpa menelusuri ulang seluruh ledger. |
| **Bahan dikunci berurutan `ingredient_id` ASC** | Dua produksi bersamaan yang memakai bahan sama akan mengunci baris dalam urutan identik, sehingga tidak saling menunggu dan menimbulkan deadlock. |
| **Batal ≠ gagal produksi** | Dua keadaan berbeda dengan akibat berbeda — lihat §4. |

---

## 3. Algoritma Perhitungan

Implementasi algoritma **A3** dan **A4** dari §3.3–3.4 [DOKUMEN-PERANCANGAN.md](DOKUMEN-PERANCANGAN.md).

```
FUNGSI calculateRequirements(produk, jumlah):
    resep ← resep aktif produk        (gagal bila tidak ada / kosong)
    yield ← resep.yield_quantity

    untuk setiap item dalam resep:
        per_unit = item.takaran × (1 + susut%/100) / yield
        butuh    = per_unit × jumlah
        cukup    = stok_bahan >= butuh

    KEMBALIKAN { bisa_produksi, materials[], shortages[], biaya, hpp }
```

Contoh nyata dari pengujian — Roti Manis Cokelat, resep standar 50 pcs:

```
Produksi 20 pcs → faktor pengali 0,4×

  Tepung Terigu      butuh   2,040 kg   tersedia  48,940   ✓
  Gula Pasir         butuh   0,404 kg   tersedia  69,394   ✓
  Mentega Anchor     butuh   0,303 kg   tersedia   0,045   ✗ kurang 0,258 kg
  Ragi Instan        butuh   0,040 kg   tersedia   4,140   ✓
  Telur Ayam         butuh   4,200 pcs  tersedia 108,700   ✓
  Cokelat Meses      butuh   0,618 kg   tersedia   7,573   ✓

→ DITOLAK. Maksimal 3 pcs, dibatasi Mentega Anchor Premium.
```

### 3.1 Pesan Penolakan — Per Bahan, Bukan Generik

Spesifikasi menekankan hal ini, dan memang itulah bedanya sistem yang berguna
dengan yang menjengkelkan. Responsnya:

```json
{
  "success": false,
  "message": "Produksi Roti Manis Cokelat sebanyak 500 unit tidak dapat dijalankan
              karena 3 bahan tidak mencukupi: Tepung Terigu kurang 2,06 kg;
              Mentega Anchor kurang 7,53 kg; Cokelat Meses kurang 7,88 kg.",
  "errors": {
    "materials": [
      {
        "ingredient_id": 1,
        "name": "Tepung Terigu Protein Tinggi",
        "unit": "kg",
        "required_display": 51.00,
        "available_display": 48.94,
        "shortage_display": 2.06
      }
    ]
  }
}
```

Frontend memakai `errors.materials` untuk menandai baris merah di tabel
pratinjau, jadi pengguna langsung melihat bahan mana yang bermasalah.

---

## 4. Aturan Bisnis yang Ditegakkan

| Aturan | Alasan | Diuji |
|---|---|---|
| Produk tanpa resep aktif tidak bisa diproduksi | Tidak ada dasar menghitung kebutuhan | ✅ |
| Resep aktif tanpa bahan ditolak | Produksi tanpa potong stok = data bohong | ✅ |
| Stok kurang → ditolak dengan rincian per bahan | Pengguna harus tahu harus beli apa | ✅ |
| Seluruh operasi atomik | Gagal di tengah tidak boleh menyisakan batch tanpa potongan stok | ✅ |
| Idempoten di tingkat **batch**, bukan hanya ledger | Lihat §6.2 | ✅ |
| Batch selesai tidak bisa diselesaikan lagi | Stok produk akan bertambah dua kali | ✅ |
| Hasil > 120% target ditolak | Kemungkinan besar salah ketik | ✅ |
| Batch selesai/batal tidak bisa dibatalkan | Stok sudah bergerak | ✅ |
| Pembatalan wajib beralasan, min. 5 karakter | Agar riwayat bisa ditelusuri | ✅ |
| Versi resep terkunci begitu dipakai produksi | Mencegah HPP historis berubah | ✅ |

### 4.1 Batal vs Gagal Produksi

Perbedaan yang sengaja dibuat tegas, karena menyamakannya akan menyembunyikan
kerugian:

| | **Batalkan** | **Selesaikan dengan hasil 0** |
|---|---|---|
| Artinya | Produksi **tidak jadi dikerjakan** | Adonan dibuat tetapi **gagal** |
| Contoh | Salah input jumlah, pesanan batal | Bantat, gosong, oven mati |
| Stok bahan | **Dikembalikan** ke gudang | **Tetap keluar** |
| Biaya | Rp0 | Tercatat penuh sebagai kerugian |
| Status akhir | `cancelled` | `completed` dengan `good_quantity = 0` |

Terverifikasi: pembatalan mengembalikan stok terigu persis ke angka semula
(48,6340 → 48,4300 → 48,6340 kg).

### 4.2 Biaya Produk Gagal Dibebankan ke Produk Berhasil

```
Batch: target 20 pcs, biaya bahan Rp96.333
Hasil: 19 layak jual, 1 gosong

HPP per pcs = 96.333 / 19 = Rp5.070   ← bukan 96.333/20 = Rp4.817
```

Bahan untuk roti yang gosong tetap keluar uang. Membaginya dengan 20 akan
membuat HPP terlihat lebih murah dari kenyataan, dan margin terlihat lebih
sehat dari yang sebenarnya.

---

## 5. API Endpoint

Base URL: `/api/v1/production` · Penjaga: `auth:api` → `active` → `role:owner,admin_produksi`

| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/preview` | **Hitung kebutuhan tanpa mengubah apa pun** |
| GET | `/batches` | Daftar batch + filter & paginasi |
| POST | `/batches` | **Jalankan produksi** — potong bahan, buat batch |
| GET | `/batches/{id}` | Detail + rincian pemakaian bahan |
| POST | `/batches/{id}/complete` | Selesaikan — tambah stok produk jadi |
| POST | `/batches/{id}/cancel` | Batalkan — kembalikan stok bahan |
| GET | `/dashboard` | Ringkasan, batch aktif, tren, kapasitas |
| GET | `/statuses` | Daftar status untuk filter |

**Filter `/batches`:** `search`, `status`, `product_id`, `date_from`, `date_to`,
`sort_by`, `sort_dir`, `per_page`

---

## 6. Dua Bug yang Ditemukan Saat Pengujian

### 6.1 Kolom `avg_cost` Tidak Ada pada Produk

`StockService` memperbarui harga rata-rata setiap barang masuk. Sampai Modul 3,
satu-satunya barang yang stoknya bertambah adalah **bahan baku** — dan hanya
`ingredients` yang punya kolom `avg_cost`.

Modul Produksi adalah yang pertama menambah stok **produk**, dan seketika gagal:

```
SQLSTATE[42S22]: Unknown column 'avg_cost' in 'field list'
```

**Diperbaiki dua lapis:**
1. Kolom `avg_cost` ditambahkan ke `products` — bukan sekadar penambal, tetapi
   memang dibutuhkan. Ia menyimpan HPP **nyata** hasil rata-rata tertimbang
   produksi yang benar-benar terjadi, berbeda dari `Product::unitCost()` yang
   menghitung HPP **teoretis** dari harga bahan hari ini. Selisih keduanya
   menjadi dasar laporan laba kotor di Modul 10.
2. `StockService` kini memeriksa keberadaan kolom lebih dulu, sehingga model
   bertok yang tidak melacak harga tidak membuat seluruh pergerakan stok gagal.

### 6.2 Batch Hantu

Kunci idempotensi awalnya hanya melindungi baris ledger. Permintaan yang
terkirim dua kali menghasilkan:

```
PRO-2026-0005  status=in_progress  biaya=Rp4.832  barisLedger=6   ✓ normal
PRO-2026-0006  status=in_progress  biaya=Rp4.832  barisLedger=0   ✗ HANTU
```

Batch kedua terbuat lengkap dengan rincian pemakaian bahan dan nilai biayanya,
tetapi **tanpa satu pun baris ledger** — karena `StockService` benar menolak
memotong stok untuk kedua kalinya.

Yang berbahaya: **`stock:reconcile` tidak menangkapnya.** Cache stok dan ledger
tetap cocok. Batch itu bisa bertahan lama tanpa disadari, membuat laporan biaya
produksi menghitung bahan yang sebenarnya tidak pernah keluar gudang.

**Diperbaiki:** kolom `idempotency_key` ditambahkan ke `production_batches`
dengan unique constraint, dan `ProductionService::execute()` memeriksanya
sebelum membuat batch. Terverifikasi: tiga kirim identik → satu batch, enam
baris ledger, nol batch hantu.

---

## 7. Struktur Folder

### 7.1 Backend

```
Backend/app/
├── Enums/
│   ├── ProductionStatus.php          ← in_progress | completed | cancelled
│   └── StockMovementType.php         ← +production_cancel
├── Exceptions/
│   └── InsufficientMaterialsException.php  ← rincian per bahan
├── Models/
│   ├── ProductionBatch.php           ← penomoran, rasio hasil, biaya gagal
│   └── ProductionBatchMaterial.php
├── Services/
│   └── ProductionService.php         ← calculateRequirements, execute,
│                                        complete, cancel
├── Http/
│   ├── Controllers/Api/V1/Production/
│   │   ├── ProductionBatchController.php
│   │   └── ProductionDashboardController.php
│   ├── Requests/Production/
│   │   ├── StoreProductionBatchRequest.php
│   │   └── CompleteProductionRequest.php
│   └── Resources/ProductionBatchResource.php
└── database/
    ├── migrations/2026_07_19_1300xx_*  ← 4 migration
    └── seeders/ProductionSeeder.php
```

### 7.2 Frontend

```
Frontend/src/
├── components/production/
│   ├── ProductionFormModal.tsx     ← pratinjau kebutuhan sebelum submit
│   ├── CompleteProductionModal.tsx ← hasil layak jual vs gagal
│   └── ProductionDetailModal.tsx   ← rincian pemakaian bahan
├── pages/production/
│   ├── ProductionDashboardPage.tsx
│   └── ProductionBatchesPage.tsx
├── services/productionService.ts
└── types/production.ts
```

---

## 8. Catatan Implementasi

### 8.1 Pratinjau Sebelum Submit

Form memanggil `/preview` setiap kali produk atau jumlah berubah, ditunda
350 ms setelah pengetikan berhenti. Permintaan dinomori agar respons yang datang
terlambat tidak menimpa hasil yang lebih baru.

Tombol "Jalankan Produksi" **dinonaktifkan** bila pratinjau menyatakan ada bahan
kurang — pengguna tidak dibiarkan menekan tombol yang pasti ditolak.

### 8.2 Kapasitas Produksi di Dashboard

Menjawab pertanyaan pertama Admin Produksi setiap pagi: *"hari ini saya masih
bisa bikin apa?"* Bahan pembatas ikut disebut supaya langsung terlihat apa yang
perlu dibeli:

```
Roti Manis Cokelat        bisa    3 pcs   pembatas: Mentega Anchor Premium
Roti Tawar Gandum         bisa    2 pcs   pembatas: Mentega Anchor Premium
Croissant Butter Premium  bisa    0 pcs   pembatas: Mentega Anchor Premium
```

Ketiganya dibatasi bahan yang sama — sinyal jelas bahwa mentega harus segera
dibeli, dan itu juga muncul di daftar "Perlu Segera Dibeli" pada dashboard
pembelian.

### 8.3 Rasio Hasil sebagai Umpan Balik Resep

`yield_rate` yang konsisten di bawah 100% menandakan persentase susut di resep
kurang besar. Angka ini ditampilkan per batch dan dirata-rata di dashboard,
sehingga pemilik usaha punya dasar untuk memperbaiki resep — bukan sekadar
menebak.

---

## 9. Hasil Pengujian

**15 skenario** diuji langsung terhadap API berjalan:

| Kelompok | Cakupan |
|---|---|
| **Hak akses** | Kasir ditolak (403) · Owner & Admin Produksi diizinkan |
| **Pratinjau** | Stok cukup · stok kurang dengan rincian per bahan · kapasitas maksimal |
| **Penolakan** | 3 bahan kurang → `errors.materials` berisi ketiganya |
| **Atomisitas** | Setelah penolakan, jumlah batch tetap — tidak ada sisa |
| **Eksekusi** | Stok terpotong tepat, ledger tercatat dengan ref nomor batch |
| **Penyelesaian** | Stok produk bertambah, HPP dibebankan ke hasil layak jual |
| **Guard** | Selesaikan dua kali · hasil >120% target · batalkan yang sudah selesai |
| **Pembatalan** | Bahan kembali persis ke angka semula |
| **Idempotensi** | 3 kirim identik → 1 batch, 6 baris ledger, 0 batch hantu |
| **Dashboard** | Ringkasan, kapasitas, bahan terpakai, tren |
| **Konsistensi** | `stock:reconcile` & `data:check` bersih setelah semua operasi |

**Frontend** — `npm run build` lulus · `npm run lint` bersih (satu warning dari
`Production.tsx`, berkas prototipe lama yang kini digantikan `/produksi/*`).

---

## 10. Yang Sengaja Belum Dikerjakan

| Hal | Alasan |
|---|---|
| Tahapan produksi (mixing → proofing → baking → QC) | Spesifikasi menyebutnya sebagai **modul Tracking Produksi berikutnya**. Modul ini menyediakan `complete()` dasar agar stok produk benar-benar bertambah dan modul bisa diuji utuh. |
| Penjadwalan produksi harian | Butuh forecast penjualan (Modul 9) untuk bermakna |
| Koreksi pemakaian bahan setelah batch jalan | Kolom `qty_used` sudah dipisah dari `qty_required` untuk menampungnya kelak |
| Biaya tenaga kerja & overhead | Saat ini HPP hanya biaya bahan, sesuai §1.4 dokumen perancangan |

---

## 11. Modul Berikutnya

**M5 — Tracking Produksi**, melanjutkan dari titik yang spesifikasi ini
tinggalkan: memecah status `in_progress` menjadi tahapan nyata dan mencatat
waktu di tiap tahap.

Fondasi yang sudah siap: `production_batches` dengan `started_at`/`finished_at`,
`ProductionService::complete()` yang tinggal dipanggil di ujung alur, dan
`RecipeService::markAsUsedInProduction()` yang sudah mengunci versi resep.

Alternatif lain yang juga siap dikerjakan adalah **M6 — Persediaan**, karena
`stock_ledger` kini punya empat sumber nyata: `opening`, `purchase`,
`production_consume`, dan `production_yield`.
