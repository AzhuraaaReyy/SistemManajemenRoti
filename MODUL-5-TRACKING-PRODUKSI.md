# Modul 5 — Tracking Produksi

> Lanjutan langsung dari [Modul 4 — Produksi (BOM)](MODUL-4-PRODUKSI.md).
> Modul 4 membuat batch berstatus "Diproses"; modul ini memecah status tunggal
> itu menjadi tujuh tahap berurutan dengan pencatatan waktu dan operator.

---

## 1. Pemenuhan Spesifikasi

| Permintaan | Terpenuhi | Keterangan |
|---|---|---|
| Tahapan berurutan, tidak boleh melompat | ✅ | Ditegakkan `ProductionTrackingService`, pesannya menyebut tahap mana yang harus dituntaskan dulu |
| Catat `waktu_mulai`, `waktu_selesai`, `operator`, `status` | ✅ | Kolom `started_at`, `finished_at`, `operator_id`, `status` |
| Packaging selesai → batch "Selesai" + stok produk bertambah | ✅ | Memanggil `ProductionService::complete()` yang sudah ada, bukan menulis ulang logika stok |
| Progress = (tahap selesai / total tahap) × 100 | ✅ | Rumus persis; tahap yang sedang berjalan belum dihitung |
| Skema `tracking_produksi` dengan relasi ke batch | ✅ | Tabelnya bernama `production_stages` — lihat §2.2 |
| API mulai tahap, selesaikan tahap, detail per batch | ✅ | Lihat §5 |
| Validasi tahap sebelumnya belum selesai | ✅ | Lihat §4 |
| Timeline visual horizontal + progress bar | ✅ | `StageTimeline.tsx` |
| Dashboard batch aktif dengan status & progress | ✅ | "PRO-2026-0002 — Sedang Fermentasi — 29%" |

**Tujuh tahap kerja:** Persiapan → Mixing → Fermentasi → Pembentukan →
Pemanggangan → Pendinginan → Packaging.

"Produk Jadi" pada spesifikasi tidak dijadikan tahap kedelapan. Ia bukan
pekerjaan yang dilakukan seseorang, melainkan keadaan setelah Packaging
selesai. Menjadikannya tahap akan membuat progress mentok di 87,5% (7/8) pada
batch yang sebetulnya sudah tuntas. Di timeline ia tetap tampil sebagai
penanda akhir yang menyala saat batch selesai — hanya saja tidak bisa diklik.

---

## 2. Skema Database

### 2.1 Tabel `production_stages`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | PK | |
| `production_batch_id` | FK → `production_batches` | cascade on delete |
| `stage` | enum 7 tahap | |
| `sequence` | tinyint 1–7 | urutan, memudahkan sortir dan validasi |
| `attempt` | tinyint, default 1 | naik saat tahap diulang |
| `status` | enum `pending` / `in_progress` / `completed` | |
| `started_at` | timestamp nullable | |
| `finished_at` | timestamp nullable | |
| `operator_id` | FK → `users` nullable | |
| `notes` | varchar(255) nullable | termasuk alasan pengulangan |

Indeks: `UNIQUE (batch_id, stage, attempt)` sebagai `pstage_batch_stage_attempt_uq`,
`INDEX (batch_id, sequence)`, `INDEX (status)`.

> Nama indeks ditulis eksplisit karena nama bawaan Laravel
> (`production_stages_production_batch_id_stage_attempt_unique`) melewati batas
> 64 karakter MySQL. Masalah yang sama sudah muncul di Modul 4.

### 2.2 Pemetaan ke Istilah Spesifikasi

| Spesifikasi | Implementasi |
|---|---|
| `tracking_produksi` | `production_stages` |
| `batch_id` | `production_batch_id` |
| `tahap` | `stage` + `sequence` |
| `waktu_mulai` / `waktu_selesai` | `started_at` / `finished_at` |
| `operator_id` | `operator_id` |
| `status` | `status` |

Nama Inggris dipertahankan agar konsisten dengan seluruh tabel sejak Modul 1
(`users`, `products`, `purchase_orders`). Mencampur dua bahasa dalam satu
skema membuat join sulit dibaca.

### 2.3 Keputusan Desain

**Baris dibuat di muka.** Saat batch dibuat, ketujuh baris langsung terbentuk
berstatus `pending`. Timeline karena itu bisa langsung dirender penuh, dan
validasi "tahap sebelumnya belum selesai" cukup membaca satu baris yang sudah
ada — tidak perlu menebak tahap mana yang seharusnya menyusul.

**Pengulangan membuat baris baru, tidak menimpa.** Percobaan lama tetap utuh:

```
fermentasi  attempt 1  10:00–11:30  completed   "Diulang: adonan kurang mengembang"
fermentasi  attempt 2  11:30–…      in_progress "Pengulangan: adonan kurang mengembang"
```

Sebuah tahap dianggap selesai bila **percobaan terakhirnya** berstatus
`completed`. Itulah yang dihitung progress.

**Migration backfill.** Batch yang sudah ada sebelum modul ini dibuatkan
tahapannya: batch `completed` mendapat tujuh baris `completed` dengan waktu
diambil dari `started_at`/`finished_at` batch, batch lain mendapat tujuh baris
`pending`.

---

## 3. Alur

```
Batch dibuat (Modul 4)
   └─> ProductionService::execute()
        └─> ProductionTrackingService::createStagesFor()   7 baris pending

Untuk tiap tahap, berurutan:
   POST .../stages/{stage}/start     → in_progress + started_at + operator
   POST .../stages/{stage}/finish    → completed  + finished_at

Tahap ke-7 (Packaging) selesai:
   └─> ProductionService::complete(batch, good_quantity, reject_quantity)
        ├─ stok produk jadi bertambah lewat StockService
        ├─ HPP dihitung dan dibekukan
        └─ batch → status Selesai
```

Modul ini **tidak menulis stok sama sekali**. Ia hanya memanggil fungsi Modul 4
yang sudah teruji, lengkap dengan perhitungan HPP dan pencatatan ledger.

### 3.1 Ketergantungan Melingkar dan Cara Memutusnya

`ProductionService` membutuhkan `ProductionTrackingService` untuk membuat
tahapan setiap batch dibuat. `ProductionTrackingService` membutuhkan
`ProductionService::complete()` saat tahap terakhir selesai. Menyuntikkan
keduanya lewat konstruktor membuat container Laravel berputar tanpa henti.

Lingkaran diputus di titik yang **paling jarang dipanggil**:

```php
private function production(): ProductionService
{
    return app(ProductionService::class);
}
```

`complete()` terjadi sekali di ujung batch, sedangkan `createStagesFor()`
terjadi pada setiap pembuatan batch. Menunda resolusi di sisi yang jarang
dipakai membuat biaya lookup container hampir nol.

---

## 4. Aturan yang Ditegakkan

| Aturan | Pesan yang muncul |
|---|---|
| Tahap tidak boleh dimulai bila tahap sebelumnya belum selesai | "Tahap Pemanggangan belum bisa dimulai karena tahap Pembentukan belum dimulai. Tuntaskan Pembentukan terlebih dahulu." |
| Tahap yang sudah berjalan tidak bisa dimulai lagi | "Tahap Mixing memang sudah berjalan sejak 09:14." |
| Tahap yang belum dimulai tidak bisa diselesaikan | "Tahap Fermentasi belum dimulai, jadi belum bisa diselesaikan." |
| Hanya batch `in_progress` yang tahapannya bisa diubah | "Batch PRO-2026-0002 berstatus Selesai, tahapannya tidak dapat diubah lagi." |
| Hanya tahap terakhir yang selesai yang boleh diulang | Menyebut tahap mana yang sebetulnya boleh diulang |
| Alasan pengulangan wajib, minimal 5 karakter | |
| Menyelesaikan Packaging wajib mengisi hasil layak jual | "Isi 0 bila seluruhnya gagal." |

Seluruh operasi berjalan dalam `DB::transaction` dengan `lockForUpdate`,
mengikuti pola `PurchaseService` dan `ProductionService`.

### 4.1 Bug yang Ditemukan Saat Pengujian Integrasi — Dua Tahap Berjalan Sekaligus

Aturan "hanya tahap terakhir yang selesai yang boleh diulang" ternyata masih
menyisakan satu lubang. Urutan yang memicunya:

```
Persiapan ✓  Mixing ✓  Fermentasi ✓  Pembentukan (baru dimulai)
   → operator sadar adonan kurang mengembang, mengulang Fermentasi
```

Fermentasi memang tahap terakhir yang selesai, jadi pengulangannya sah menurut
aturan. Tetapi Pembentukan sudah berjalan. Hasilnya:

```
3. fermentasi   attempt 2  in_progress
4. pembentukan  attempt 1  in_progress   ← dua tahap berjalan bersamaan
```

Ini bukan sekadar tampilan yang aneh. Adonan yang sedang dibentuk itu justru
adonan yang sedang difermentasi ulang — dua kenyataan yang tidak mungkin
terjadi berbarengan. `currentStage()` pun ikut berbohong: ia mengembalikan
tahap berjalan dengan urutan terkecil, sehingga dashboard menampilkan
"Sedang Fermentasi" sementara Pembentukan diam-diam juga berstatus berjalan.

**Perbaikan:** saat sebuah tahap diulang, tahap sesudahnya yang terlanjur
berjalan dikembalikan ke `pending`, dan jejaknya dicatat di kolom `notes`:

```
Dibatalkan (mulai 19/07 13:10) karena tahap Fermentasi diulang: Adonan kurang mengembang
```

Yang hilang hanya waktu mulai tahap tersebut — tahap sesudahnya dipastikan
belum pernah selesai, karena yang boleh diulang hanya tahap terakhir yang
selesai. Invarian "paling banyak satu tahap berjalan" kini terjaga.

---

## 5. API Endpoint

Prefix `/api/v1/production` · penjaga `role:owner,admin_produksi`

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/stages` | Daftar tujuh tahap beserta urutan dan durasi wajarnya |
| GET | `/batches/{batch}/stages` | Detail tracking: keadaan tiap tahap, riwayat percobaan, ringkasan progress |
| POST | `/batches/{batch}/stages/{stage}/start` | Mulai tahap |
| POST | `/batches/{batch}/stages/{stage}/finish` | Selesaikan tahap. Pada `packaging` wajib `good_quantity` |
| POST | `/batches/{batch}/stages/{stage}/repeat` | Ulangi tahap, wajib `reason` |

Ketiga endpoint aksi mengembalikan payload yang sama — `stage`, `batch`,
`stages`, `history`, `summary` — sehingga halaman cukup mengganti state tanpa
memuat ulang dan timeline tidak berkedip setiap tombol ditekan.

### 5.1 Endpoint yang Dihapus

`POST /batches/{batch}/complete` **dihapus**, beserta `CompleteProductionRequest`
dan method `complete()` di controller. Logika penambahan stoknya tetap di
`ProductionService::complete()` — hanya jalur masuknya yang ditutup.

Alasannya: menyediakan jalan pintas akan menghasilkan batch berstatus "Selesai"
dengan timeline kosong. Laporan durasi per tahap jadi bolong tanpa ada yang
menyadarinya, dan justru laporan itulah alasan modul ini dibuat.

Konsekuensinya `can_complete` juga hilang dari `ProductionBatchResource`, dan
tombol "Selesaikan" di halaman daftar batch ikut dicabut.

---

## 6. Frontend

### 6.1 Berkas Baru

| Berkas | Isi |
|---|---|
| `components/production/StageTimeline.tsx` | Timeline horizontal + progress bar |
| `components/production/StageActionModal.tsx` | Dialog mulai / selesaikan / ulangi |
| `pages/production/ProductionTrackingPage.tsx` | Halaman `/produksi/batch/:id` |

### 6.2 Berkas yang Diubah

| Berkas | Perubahan |
|---|---|
| `types/production.ts` | `StageName`, `StageStatus`, `ProductionStage`, `StageSummary`, `BatchTracking`; `can_complete` dan `CompleteProductionPayload` dihapus |
| `services/productionService.ts` | `trackingService` baru; `complete()` dihapus |
| `components/production/CompleteProductionModal.tsx` | Dialihfungsikan menjadi "Selesaikan Packaging" |
| `pages/production/ProductionBatchesPage.tsx` | Tombol Selesaikan dicabut, kolom progress + tautan tracking ditambahkan |
| `pages/production/ProductionDashboardPage.tsx` | Kartu batch aktif menampilkan tahap + progress, seluruh kartu jadi tautan |
| `lib/format.ts` | `durasi()` — "8 mnt", "1j 35m" |
| `App.tsx`, `layouts/DashboardLayout.tsx` | Rute dan judul halaman baru |

### 6.3 Timeline

```
 ✓━━━━━━✓━━━━━━◐──────○──────○──────○──────○     ⬦
Persiapan Mixing Fermen. Bentuk Panggang Dingin Packing  Produk Jadi
 12 mnt   25 mnt  ⏱ 8mnt  ±30 mnt                        (menyala saat selesai)

████████░░░░░░░░░░░░░░░░░░░░░░  Sedang Fermentasi   28,57%  ·  2 dari 7 tahap
```

- **Hijau ✓** selesai — menampilkan durasi sebenarnya
- **Kuning ◐** berjalan — menampilkan waktu berjalan, merah bila melewati 1,5×
  durasi wajar
- **Abu ○** belum mulai — menampilkan perkiraan durasi
- Tahap dengan `attempt > 1` diberi label `percobaan #2`

Timeline digulir mendatar di layar kecil, tidak dipatahkan ke bawah — urutan
proses lebih mudah ditangkap saat tetap satu baris.

### 6.4 Nilai `undefined` vs `0`

`progress_percent` hanya dikirim bila relasi `stages` dimuat di server. Saat
belum dimuat ia `undefined`, bukan `0`, supaya UI bisa membedakan "datanya
belum diambil" dari "benar-benar belum ada tahap yang selesai". Halaman daftar
menampilkan "—" untuk kasus pertama dan progress bar kosong untuk kasus kedua.

---

## 7. Struktur Folder

### 7.1 Backend

```
app/
  Enums/
    ProductionStage.php          7 case + label, sequence, typicalMinutes, next, isLast
    StageStatus.php              pending / in_progress / completed
  Models/
    ProductionStage.php          durationMinutes(), isOverdue(), scopeLatestAttempt()
  Services/
    ProductionTrackingService.php   ← inti modul
  Http/
    Requests/Production/FinishStageRequest.php
    Resources/ProductionStageResource.php
    Controllers/Api/V1/Production/ProductionTrackingController.php
database/migrations/
  2026_07_19_140100_create_production_stages_table.php
  2026_07_19_140200_backfill_production_stages.php
```

### 7.2 Frontend

```
src/
  components/production/
    StageTimeline.tsx
    StageActionModal.tsx
    CompleteProductionModal.tsx   (dialihfungsikan)
  pages/production/
    ProductionTrackingPage.tsx
```

---

## 8. Hasil Pengujian

Diuji lewat API berjalan dengan akun `produksi@rotimanis.test` dan
`kasir@rotimanis.test`.

| # | Skenario | Hasil |
|---|---|---|
| 1 | Batch baru dibuat | ✅ 7 baris tahap `pending` terbentuk otomatis |
| 2 | Kontrak halaman daftar batch | ✅ `progress_percent`, `completed_stages`, `current_stage_label` terkirim; `can_complete` sudah tidak ada |
| 3 | Kontrak kartu dashboard | ✅ "PRO-2026-0002 — Sedang Fermentasi — 29%" |
| 4 | Kontrak halaman tracking | ✅ 7 stages, 7 history, 6 bahan, summary lengkap |
| 5 | Selesaikan Fermentasi | ✅ progress 28,57% → 42,86% |
| 6 | Mulai Pemanggangan melompati Pembentukan | ✅ Ditolak, menyebut Pembentukan |
| 7 | Ulangi Fermentasi saat Pembentukan berjalan | ✅ Hanya 1 tahap berjalan; Pembentukan kembali `pending` dengan catatan jejak |
| 8 | Selesaikan Packaging tanpa isi hasil | ✅ Ditolak |
| 9 | Tuntaskan seluruh tahap | ✅ 42,86 → 57,14 → 71,43 → 85,71 → 100% |
| 10 | Packaging selesai dengan 9 baik / 1 gagal | ✅ Batch Selesai, stok produk bertambah, HPP Rp5.351,80 |
| 11 | Ubah tahap pada batch yang sudah selesai | ✅ Ditolak |
| 12 | Rute lama `POST /complete` | ✅ 404 |
| 13 | Kasir mengakses tracking | ✅ 403 |
| 14 | `php artisan stock:reconcile` | ✅ 11 barang, seluruh cache cocok dengan ledger |
| 15 | `php artisan data:check` | ✅ Tidak ada masalah integritas |

Frontend: `npm run lint` dan `npm run build` lulus. Bundel awal tetap 294 KB —
halaman tracking masuk sebagai chunk terpisah 23 KB berkat pemecahan kode per
rute.

---

## 9. Yang Sengaja Belum Dikerjakan

- **Durasi wajar per produk.** `typicalMinutes()` masih konstanta per tahap,
  sama untuk semua roti. Fermentasi roti manis dan roti tawar jelas berbeda.
  Idealnya kolom ini pindah ke resep — tetapi itu menyentuh Modul 2 dan lebih
  tepat dikerjakan saat ada data historis yang cukup untuk menentukan angkanya.
- **Notifikasi tahap kelamaan.** Tanda `is_overdue` sudah dihitung dan tampil
  di layar, tetapi belum ada pemberitahuan aktif. Masuk ke M11.
- **Laporan durasi rata-rata per tahap.** Datanya sudah lengkap tersimpan;
  laporannya menunggu modul laporan (M10).
- **Membatalkan tahap yang sedang berjalan.** Belum ada. Sementara ini jalan
  keluarnya adalah menyelesaikan lalu mengulang.

---

## 10. Modul Berikutnya

Modul 6 — Penjualan (POS). Stok produk jadi kini bertambah lewat jalur yang
terlacak penuh, jadi pengurangannya di kasir bisa dipertanggungjawabkan sampai
ke batch asalnya.
