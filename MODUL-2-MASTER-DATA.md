# Modul 2 — Master Data

> **Hak akses sudah berubah.** Berkas ini menggambarkan pembagian peran
> saat modul dibangun, ketika sistem masih memakai `admin_produksi`. Sejak
> 20 Juli 2026 peran itu dipecah menjadi Admin Gudang dan Kepala Produksi —
> lihat [MIGRASI-PERAN.md](MIGRASI-PERAN.md) untuk pembagian yang berlaku.

Status: **Selesai** · 19 Juli 2026 (revisi 2)
Cakupan: Kategori · Supplier · Bahan Baku · Produk · Resep (Bill of Materials)

---

## 0. Ringkasan Revisi 2

Tiga penyempurnaan atas permintaan pengguna, dikerjakan setelah versi pertama:

| # | Permintaan | Yang dikerjakan |
|---|---|---|
| 1 | Satuan disederhanakan agar cukup pakai kg | Form kini punya **satu** dropdown satuan. Tiga kolom teknis (satuan dasar, satuan tampilan, faktor konversi) diturunkan otomatis. Takaran resep bisa ditulis per baris dalam g atau kg. Penyimpanan tetap gram — lihat §7.1 untuk alasannya. |
| 2 | Data stok harus benar-benar stabil | Dibangun **ledger stok append-only** beserta `StockService` sebagai satu-satunya pintu perubahan. Termasuk kunci idempotensi, penguncian baris, penolakan stok minus, dan perintah `stock:reconcile` untuk membuktikan kebenarannya. |
| 3 | Versi resep harus aman terhadap modul lain | Versi yang sudah dipakai produksi **terkunci permanen**. Aturan versioning dipindah ke `RecipeService` agar Modul Produksi memakai logika yang sama, bukan menyalinnya. Ditambah perintah `data:check`. |

---

## 1. Ruang Lingkup Modul

| Fitur | Status | Keterangan |
|---|---|---|
| CRUD Kategori | ✅ | Satu tabel untuk kategori produk dan bahan baku, dibedakan kolom `type` |
| CRUD Supplier | ✅ | Termasuk lead time dan relasi bahan yang dipasok |
| CRUD Bahan Baku | ✅ | Dengan satuan dasar, satuan tampilan, dan faktor konversi |
| CRUD Produk | ✅ | Harga jual dibandingkan otomatis dengan HPP dari resep |
| CRUD Resep (BOM) | ✅ | Baris bahan dinamis, versioning, susut, simulasi produksi |
| Search | ✅ | Semua entitas, dengan jeda 400 ms |
| Pagination | ✅ | 5–100 baris per halaman |
| Sorting | ✅ | Klik header kolom |
| Filter | ✅ | Kategori, status, status stok, punya resep / belum |

---

## 2. Desain Database

### 2.1 ERD

```
┌──────────────────┐
│    categories    │
├──────────────────┤
│ PK id            │
│    type   ENUM   │◄── 'produk' | 'bahan_baku'
│    name          │
│    slug          │
│    is_active     │
│    deleted_at    │
└────┬────────┬────┘
     │        │
     │ 1..N   │ 1..N
     ▼        ▼
┌─────────────────────┐         ┌──────────────────────┐
│     ingredients     │         │      products        │
├─────────────────────┤         ├──────────────────────┤
│ PK id               │         │ PK id                │
│ UQ code    BB-0001  │         │ UQ code     PRD-0001 │
│    name             │         │    name              │
│ FK category_id      │         │ FK category_id       │
│ FK default_supplier │──┐      │    unit              │
│    base_unit  ENUM  │  │      │    selling_price     │
│    display_unit     │  │      │    current_stock     │
│    conversion_factor│  │      │    min_stock         │
│    current_stock    │  │      │    is_active         │
│    min_stock        │  │      │    deleted_at        │
│    avg_cost         │  │      └───────┬──────────────┘
│    shelf_life_days  │  │              │ 1..N
│    is_active        │  │              ▼
│    deleted_at       │  │      ┌──────────────────────┐
└──┬───────────────┬──┘  │      │       recipes        │
   │               │     │      ├──────────────────────┤
   │ N..N          │ 1..N│      │ PK id                │
   ▼               │     │      │ FK product_id        │
┌──────────────────┴──┐  │      │    version           │
│ ingredient_supplier │  │      │    name              │
├─────────────────────┤  │      │    yield_quantity    │
│ PK id               │  │      │    yield_unit        │
│ FK ingredient_id    │  │      │    is_active         │
│ FK supplier_id      │  │      │ UQ (product,version) │
│    supplier_sku     │  │      └───────┬──────────────┘
│    last_price       │  │              │ 1..N
│    last_purchased_at│  │              ▼
│ UQ (ingr, supplier) │  │      ┌──────────────────────┐
└──────────┬──────────┘  │      │    recipe_items      │
           │             │      ├──────────────────────┤
           ▼             │      │ PK id                │
┌─────────────────────┐  │      │ FK recipe_id         │
│      suppliers      │◄─┘      │ FK ingredient_id ────┼──► ingredients
├─────────────────────┤         │    quantity          │    (RESTRICT)
│ PK id               │         │    waste_percent     │
│ UQ code   SUP-0001  │         │    note              │
│    name             │         │    sort_order        │
│    contact_person   │         │ UQ (recipe, ingr)    │
│    phone / email    │         └──────────────────────┘
│    address          │
│    lead_time_days   │
│    is_active        │
│    deleted_at       │
└─────────────────────┘
```

### 2.2 Keputusan Desain Penting

| Keputusan | Alasan |
|---|---|
| **Satu tabel `categories` dengan kolom `type`** | Struktur kategori produk dan bahan baku identik. Dua tabel terpisah hanya menggandakan kode CRUD tanpa manfaat. Keunikan dijaga pada `(type, slug)`, sehingga "Cokelat" bisa jadi kategori produk sekaligus kategori bahan. |
| **Satuan dasar + satuan tampilan + faktor konversi** | Stok disimpan per gram/ml/pcs, tetapi ditampilkan per kg/L/sak. Tanpa satuan dasar seragam, penjumlahan stok lintas pembelian dan produksi akan salah diam-diam saat satu transaksi memakai kg dan lainnya gram. Lihat §3.0 [DOKUMEN-PERANCANGAN.md](DOKUMEN-PERANCANGAN.md). |
| **`current_stock` ada di master, tapi tidak bisa diedit dari sana** | Kolomnya perlu ada agar modul lain bisa membacanya, tetapi perubahannya hanya boleh lewat pergerakan stok yang tercatat sumbernya. Form master menolak `current_stock` pada update dengan HTTP 422. Stok awal hanya boleh ditetapkan sekali, saat data dibuat. |
| **Versioning resep, bukan menimpa** | Batch produksi merujuk ke versi resep tertentu. Mengubah takaran hari ini tidak boleh mengubah HPP produksi bulan lalu — §4.1 (S5) dokumen perancangan. Hanya satu versi aktif per produk. |
| **`waste_percent` per baris resep** | Adonan menempel di wadah, tepung tercecer. Tanpa kolom ini, stok sistem selalu terlihat lebih banyak daripada kenyataan, dan selisihnya baru ketahuan saat stock opname. |
| **`recipe_items.ingredient_id` pakai RESTRICT** | Menghapus bahan yang masih dipakai resep akan membuat resep menunjuk ke data yang tidak ada. Ditolak lebih dulu di controller dengan pesan jelas; RESTRICT jadi jaring pengaman terakhir. |
| **Kode otomatis (BB-0001, PRD-0002, SUP-0003)** | Nomor diambil dari kode tertinggi yang pernah ada — **termasuk baris yang sudah di-soft-delete** — agar kode tidak pernah dipakai ulang. Kode daur ulang membuat dokumen lama menunjuk ke barang yang berbeda. |
| **Soft delete di seluruh entitas** | Konsisten dengan §4.2 (S12) dokumen perancangan: data yang punya riwayat transaksi tidak boleh hilang. |

### 2.3 Indeks

```sql
UNIQUE  categories(type, slug)
INDEX   categories(type, is_active)
UNIQUE  suppliers(code)
INDEX   suppliers(is_active, name)
UNIQUE  ingredients(code)
INDEX   ingredients(is_active, name), ingredients(category_id)
UNIQUE  products(code)
INDEX   products(is_active, name), products(category_id)
UNIQUE  ingredient_supplier(ingredient_id, supplier_id)
UNIQUE  recipes(product_id, version)
INDEX   recipes(product_id, is_active)
UNIQUE  recipe_items(recipe_id, ingredient_id)
INDEX   recipe_items(ingredient_id)
```

---

## 3. API Endpoint

Base URL: `http://127.0.0.1:8000/api/v1/master`
Penjaga: `auth:api` → `active` → `role:owner,admin_produksi`

### 3.1 Kategori

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/categories` | Daftar + filter `type`, `status`, `search` |
| GET | `/categories/options` | Daftar ringkas untuk dropdown |
| POST | `/categories` | Tambah |
| GET | `/categories/{id}` | Detail |
| PUT | `/categories/{id}` | Ubah |
| DELETE | `/categories/{id}` | Hapus (ditolak bila masih dipakai) |

### 3.2 Supplier

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/suppliers` | Daftar + `search`, `status` |
| GET | `/suppliers/options` | Dropdown |
| POST · GET · PUT · DELETE | `/suppliers[/{id}]` | CRUD standar |

### 3.3 Bahan Baku

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/ingredients` | Filter `search`, `category_id`, `supplier_id`, `stock_status`, `status` |
| GET | `/ingredients/options` | Dropdown lengkap dengan satuan & stok, untuk form resep |
| GET | `/ingredients/units` | Satuan dasar + satuan tampilan lazim + faktor konversinya |
| GET | `/ingredients/statistics` | Total, per status stok, nilai persediaan |
| POST · GET · PUT · DELETE | `/ingredients[/{id}]` | CRUD standar |

### 3.4 Produk

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/products` | Filter `search`, `category_id`, `has_recipe`, `status` |
| GET | `/products/options` | Dropdown; `?without_recipe=1` untuk form resep baru |
| POST · GET · PUT · DELETE | `/products[/{id}]` | CRUD standar |

### 3.5 Resep (BOM)

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/recipes` | Filter `search`, `product_id`, `status` |
| POST | `/recipes` | Buat resep beserta seluruh barisnya |
| GET | `/recipes/{id}` | Detail + biaya + kapasitas produksi |
| PUT | `/recipes/{id}` | Ubah di tempat (baris ditulis ulang) |
| DELETE | `/recipes/{id}` | Hapus |
| POST | `/recipes/{id}/new-version` | Salin jadi versi baru yang langsung aktif |
| PATCH | `/recipes/{id}/activate` | Jadikan versi ini yang aktif |
| POST | `/recipes/{id}/simulate` | "Kalau produksi N buah, bahan cukup atau tidak?" |

**Contoh membuat resep** (persis contoh Roti Coklat pada permintaan):

```json
POST /api/v1/master/recipes
{
  "product_id": 4,
  "name": "Resep Roti Coklat",
  "yield_quantity": 1,
  "yield_unit": "pcs",
  "items": [
    { "ingredient_id": 1, "quantity": 250 },   // Tepung  250 g
    { "ingredient_id": 4, "quantity": 20  },   // Gula     20 g
    { "ingredient_id": 2, "quantity": 30  },   // Mentega  30 g
    { "ingredient_id": 6, "quantity": 15  }    // Cokelat  15 g
  ]
}
```

Respons menyertakan perhitungan turunan:

```json
{
  "cost_per_unit": 6585,
  "selling_price": 6000,
  "margin_percent": -9.75,
  "max_producible": 8,
  "limiting_ingredient": "Tepung Terigu Protein Tinggi"
}
```

---

## 4. Aturan Bisnis yang Ditegakkan

| Aturan | Alasan | Diuji |
|---|---|---|
| Stok tidak dapat diubah lewat master data | Setiap perubahan stok harus punya sumber yang tercatat | ✅ |
| Satuan dasar tidak dapat diubah bila bahan sudah berstok atau dipakai resep | Mengubah `g` jadi `pcs` mengubah 45 kg tepung menjadi 45.000 butir tanpa disadari | ✅ |
| Faktor konversi wajib 1 bila satuan tampilan = satuan dasar | Mencegah 1 gram terdefinisi sebagai 1.000 gram | ✅ |
| Kategori produk tidak boleh dipakai bahan baku, dan sebaliknya | Menjaga arti kategori tetap konsisten | ✅ |
| Jenis kategori tidak bisa diubah bila sudah dipakai | Produk akan bernaung di bawah kategori bahan baku | ✅ |
| Bahan yang dipakai resep tidak bisa dihapus | Resep akan menunjuk ke data yang tidak ada | ✅ |
| Bahan / produk berstok tidak bisa dihapus | Kerugian harus dicatat, bukan dihapus diam-diam | ✅ |
| Supplier utama suatu bahan tidak bisa dihapus | Bahan akan kehilangan rujukan supplier | ✅ |
| Kategori yang masih dipakai tidak bisa dihapus | Data akan menjadi yatim | ✅ |
| Resep wajib punya minimal satu bahan | Resep kosong tidak ada gunanya | ✅ |
| Bahan tidak boleh ganda dalam satu resep | Ubah takarannya, jangan tambah baris | ✅ |
| `yield_quantity` harus > 0 | Menjadi pembagi di seluruh perhitungan resep | ✅ |
| Hanya satu versi resep aktif per produk | Produksi harus tahu resep mana yang berlaku | ✅ |
| Resep aktif terakhir suatu produk tidak bisa dihapus | Produk jadi tidak bisa diproduksi sama sekali | ✅ |
| Produk pada resep tidak bisa dipindahkan | Buat resep baru untuk produk yang dituju | ✅ |

---

## 5. Algoritma yang Diimplementasikan

Modul ini merealisasikan **algoritma A3** dari §3.3 [DOKUMEN-PERANCANGAN.md](DOKUMEN-PERANCANGAN.md):

### 5.1 Explode BOM — `Recipe::explode()`

```
faktor = target / yield_quantity
untuk setiap item:
    kebutuhan = quantity × faktor × (1 + waste_percent/100)
```

### 5.2 Kapasitas Produksi — `Recipe::maxProducible()`

```
untuk setiap item:
    per_unit = quantity × (1 + waste/100) / yield_quantity
    mampu    = floor(stok_bahan / per_unit)
batas = MIN(semua mampu)          ← bahan pembatas
```

Bahan yang menghasilkan nilai MIN ditampilkan sebagai `limiting_ingredient` —
inilah bahan yang perlu segera dibeli.

### 5.3 Biaya Resep — `Recipe::totalCost()` / `costPerUnit()`

```
total     = Σ (quantity × (1 + waste/100) × avg_cost bahan)
per_unit  = total / yield_quantity
margin_%  = (harga_jual - per_unit) / harga_jual × 100
```

Margin negatif ditampilkan merah di tabel produk, tabel resep, dan ringkasan
form — karena produk yang dijual di bawah biaya bahan adalah kerugian yang
paling sering luput dari perhatian pemilik UMKM.

---

## 6. Struktur Folder

### 6.1 Backend (tambahan Modul 2)

```
Backend/app/
├── Enums/
│   ├── CategoryType.php             ← produk | bahan_baku
│   └── BaseUnit.php                 ← g | ml | pcs + satuan tampilan lazim
├── Models/
│   ├── Category.php                 ← slug otomatis dari nama
│   ├── Supplier.php
│   ├── Ingredient.php               ← konversi satuan + klasifikasi status stok
│   ├── Product.php                  ← HPP & margin dari resep aktif
│   ├── Recipe.php                   ← explode, totalCost, maxProducible
│   └── RecipeItem.php
├── Traits/
│   └── GeneratesCode.php            ← BB-0001, PRD-0002, SUP-0003
├── Http/
│   ├── Controllers/Api/V1/MasterData/
│   │   ├── CategoryController.php
│   │   ├── SupplierController.php
│   │   ├── IngredientController.php
│   │   ├── ProductController.php
│   │   └── RecipeController.php
│   ├── Requests/MasterData/
│   │   ├── CategoryRequest.php
│   │   ├── SupplierRequest.php
│   │   ├── IngredientRequest.php
│   │   ├── ProductRequest.php
│   │   └── RecipeRequest.php
│   └── Resources/
│       ├── CategoryResource.php
│       ├── SupplierResource.php · SupplierBriefResource.php
│       ├── IngredientResource.php · IngredientBriefResource.php
│       ├── ProductResource.php
│       └── RecipeResource.php · RecipeItemResource.php
└── database/
    ├── migrations/2026_07_19_1001xx_*  ← 7 migration
    └── seeders/MasterDataSeeder.php     ← data dari prototipe React
```

### 6.2 Frontend (tambahan Modul 2)

```
Frontend/src/
├── components/
│   ├── data/
│   │   ├── DataTable.tsx            ← tabel generik: sort, paginasi, aksi baris
│   │   ├── FilterBar.tsx            ← pencarian + dropdown penyaring
│   │   └── PageHeader.tsx           ← judul halaman + kartu statistik
│   └── master/
│       ├── RecipeFormModal.tsx      ← form BOM, baris dinamis (useFieldArray)
│       └── RecipeDetailModal.tsx    ← rincian + simulasi produksi
├── hooks/
│   └── useResourceList.ts           ← filter, jeda ketik, paginasi, anti balapan
├── lib/
│   └── format.ts                    ← rupiah, angka, kuantitas, warna status
├── pages/master/
│   ├── CategoriesPage.tsx
│   ├── SuppliersPage.tsx
│   ├── IngredientsPage.tsx
│   ├── ProductsPage.tsx
│   └── RecipesPage.tsx
├── services/masterService.ts        ← CRUD generik untuk kelima entitas
└── types/master.ts
```

---

## 7. Catatan Implementasi

### 7.1 Satuan: Satu Pilihan, Penyimpanan Tetap Gram

**Yang dilihat pengguna** — satu dropdown berisi enam pilihan siap pakai:

```
Kilogram (kg) · Gram (g) · Liter (L) · Mililiter (ml) · Butir/Pcs · Sak 25 kg
```

Istilah "satuan dasar" dan "faktor konversi" tidak pernah muncul di layar.
Seluruh angka lain di form — stok awal, stok minimum, harga — ditulis dalam
satuan yang dipilih itu. Backend yang mengonversi; frontend tidak pernah
mengalikan faktor sendiri, agar tidak ada dua tempat yang bisa berbeda hasilnya.

**Yang terjadi di database** — tetap gram, mililiter, atau butir.

Ini keputusan sadar, bukan sisa rancangan lama. Resep roti memakai takaran
kecil: cokelat 15 g, ragi 2 g, garam 3 g. Bila disimpan sebagai kilogram,
angkanya menjadi 0,015 / 0,002 / 0,003 — dan dua masalah muncul:

1. **Salah ketik jadi fatal.** 0,015 dan 0,15 hanya beda satu karakter, tetapi
   sepuluh kali lipat jumlahnya. Dalam gram, 15 dan 150 jauh lebih sulit tertukar.
2. **Galat pembulatan menumpuk.** 0,015 × 847 batch menghasilkan sisa desimal
   yang merambat ke perhitungan HPP dan nilai persediaan.

Bilangan bulat dalam gram menghilangkan seluruh kelas masalah itu, sementara
pengguna tetap melihat dan mengetik dalam kilogram.

**Takaran resep punya satuan per baris.** Tepung boleh ditulis "5 kg", cokelat
"15 g", telur "1 butir" — semuanya dalam satu resep yang sama. Pilihan satuan
tiap baris menyesuaikan jenis bahannya; telur tidak akan pernah menawarkan
pilihan gram.

**Ganti satuan pada bahan yang sudah ada:**

| Perubahan | Diizinkan? | Alasan |
|---|---|---|
| kg → gram | ✅ Ya | Satuan dasar sama; hanya cara menampilkan yang berubah, angka tersimpan tidak bergeser |
| liter → ml | ✅ Ya | Idem |
| kg → butir | ❌ Tidak (bila sudah berstok atau dipakai resep) | Satuan dasar berbeda — 45.000 gram tepung akan berubah arti menjadi 45.000 butir |

### 7.1a Ledger Stok — Menjawab "Bagaimana Agar Data Stok Stabil"

Sebelum revisi ini, `current_stock` adalah angka yang ditulis sekali lalu
dipercaya. Sekarang ia adalah **cache dari penjumlahan tabel `stock_ledger`**,
dan kebenarannya bisa dibuktikan kapan saja.

Empat lapis perlindungan:

| Lapis | Mekanisme | Mencegah |
|---|---|---|
| **Model** | `current_stock` dihapus dari `$fillable` | Mass assignment tak sengaja dari request mana pun |
| **Service** | Hanya `StockService::applyMovement()` yang menulis, memakai `saveQuietly()` | Perubahan stok yang tidak tercatat di ledger |
| **Database** | `lockForUpdate()` di dalam transaksi + `UNIQUE(idempotency_key)` | Balapan antar permintaan bersamaan, dan pencatatan ganda |
| **Verifikasi** | `php artisan stock:reconcile` | Ketidakcocokan yang lolos ketiga lapis di atas |

Ledger bersifat **append-only**. Model `StockLedger` melempar exception bila ada
kode yang mencoba menyunting atau menghapus barisnya — koreksi dilakukan dengan
menambah baris penyesuaian, bukan menyunting riwayat.

**Bahkan stok awal pun punya asal-usul.** Membuat bahan dengan stok 30 kg
menghasilkan satu baris ledger bertipe `opening`, lengkap dengan siapa yang
membuatnya dan kapan. Data hasil seeding pun ikut aturan ini — `stock:reconcile`
harus bersih sejak database baru dibuat.

**Idempotensi.** Tiga permintaan identik dengan kunci yang sama hanya
menghasilkan satu baris ledger dan menaikkan stok satu kali. Ini yang mencegah
kasir menekan tombol dua kali karena internet lambat lalu stok terpotong ganda —
bug POS paling umum. Terverifikasi pada pengujian.

**Penolakan stok minus.** Mencoba mengambil 999.999 g dari stok 50.000 g ditolak
dengan pesan yang menyebut angkanya:

```
Stok Gula Pasir Rose Brand tidak mencukupi.
Tersedia 50.000 g, dibutuhkan 999.999 g — kurang 949.999 g.
```

Pengecualian hanya untuk `adjustment` (stock opname), karena hitungan fisik
adalah kebenaran terakhir.

### 7.1b Penguncian Versi Resep — Menjawab "Agar Tidak Fatal"

Skenario yang dicegah:

> Batch produksi #B091 mencatat "memakai Resep Roti Coklat versi 1" dengan HPP
> Rp4.798. Bila isi versi 1 kemudian diubah, laporan laba bulan lalu ikut
> berubah **tanpa ada satu pun transaksi baru**. Angka yang sudah dilaporkan ke
> pemilik usaha bergeser sendiri.

Aturan yang kini ditegakkan:

| Keadaan Resep | Boleh Diubah? | Boleh Dihapus? |
|---|---|---|
| Aktif, belum pernah diproduksi | ✅ | ✅ (kecuali satu-satunya resep produk) |
| Aktif, **sudah diproduksi** | ❌ Terkunci permanen | ❌ |
| Diarsipkan (versi lama) | ❌ Catatan sejarah | ✅ (bila belum pernah diproduksi) |

Penolakannya tidak buntu — pesannya menyarankan jalan keluar:

```
Resep "Resep Standar Roti Manis Cokelat" versi 1 tidak dapat diubah karena
sudah dipakai dalam 1 batch produksi. Gunakan tombol "Buat Versi Baru" agar
perubahan Anda tersimpan tanpa mengubah perhitungan HPP produksi yang sudah
berjalan.
```

Di antarmuka, versi terkunci ditandai ikon gembok beserta jumlah batch yang
memakainya, dan tombol Ubah/Hapus dinonaktifkan — bukan disembunyikan, supaya
pengguna tahu opsi itu ada tetapi tidak berlaku.

### 7.1c Integrasi dengan Modul Berikutnya

`RecipeService` menyediakan dua method yang akan dipakai Modul Produksi:

```php
$recipe = $recipes->resolveForProduction($productId);
//  → melempar bila produk belum punya resep aktif, atau resepnya kosong

$recipes->markAsUsedInProduction($recipe, 'B091');
//  → menaikkan production_count dan mengunci versi tersebut selamanya
```

Aturan versioning tidak ditulis ulang di modul produksi, sehingga tidak ada dua
salinan logika yang bisa berbeda pelan-pelan.

### 7.1d Perintah Pemeriksa

```bash
php artisan stock:reconcile        # cache stok vs ledger
php artisan stock:reconcile --fix  # samakan cache mengikuti ledger
php artisan data:check             # konsistensi antar modul
php artisan data:check --strict    # peringatan pun dianggap gagal
```

`data:check` memeriksa sembilan hal yang seharusnya mustahil terjadi: resep
aktif ganda pada satu produk, resep aktif tanpa bahan, baris resep yatim, stok
negatif, faktor konversi tidak valid, resep terkunci tanpa riwayat produksi,
produk aktif tanpa resep, dan produk yang dijual di bawah HPP.

Keduanya layak dijadwalkan harian. Selama `stock:reconcile` bersih, tidak ada
satu pun perubahan stok yang terjadi di luar `StockService`.

### 7.2 Penanganan Error Validasi

Error validasi dari server dipetakan kembali ke field yang benar-benar dilihat
pengguna. Pada form resep, error `items.2.quantity` diarahkan ke
`items.2.quantity_display` — kalau tidak, pesannya muncul di field yang tidak
ada di layar.

### 7.2 Ringkasan Biaya Langsung

Form resep menghitung total biaya, HPP per unit, dan margin **sambil pengguna
mengetik**, memakai `avg_cost` yang sudah ikut terkirim di endpoint options.
Dampak setiap takaran terhadap HPP langsung terlihat, bukan baru ketahuan
setelah disimpan.

### 7.3 Perlindungan Balapan Permintaan

`useResourceList` menomori setiap permintaan dan mengabaikan respons yang datang
terlambat. Tanpa ini, mengetik cepat di kotak pencarian bisa membuat hasil
pencarian lama menimpa hasil yang lebih baru.

### 7.4 Konsistensi Filter dan Statistik

Ambang batas status stok didefinisikan dua kali — di `Ingredient::stockStatus()`
(untuk lencana per baris) dan `scopeStockStatus()` (untuk filter SQL). Keduanya
**harus** identik.

Saat pengujian, filter `aman` sempat mengembalikan 3 baris sementara statistik
menyebut 2 aman + 1 berlebih, karena scope belum menyertakan batas atas
`stok <= min × 3`. Sudah diperbaiki dan diverifikasi: jumlah kelima filter kini
persis sama dengan 8 bahan yang ada.

---

## 8. Hasil Pengujian

### 8.1 Pengujian Revisi 2

| # | Skenario | Hasil |
|---|---|---|
| 1 | Daftar satuan siap pakai (6 pilihan) | ✅ |
| 2 | Buat bahan dengan satu field `unit=kg`, stok 30 kg → tersimpan 30.000 g | ✅ |
| 3 | Stok awal otomatis tercatat sebagai baris ledger `opening` | ✅ |
| 4 | Ubah stok lewat master data → ditolak 422 | ✅ |
| 5 | Ganti satuan kg → gram (dasar sama) → diizinkan, stok tidak bergeser | ✅ |
| 6 | Ganti satuan gram → butir (dasar beda) → ditolak dengan penjelasan | ✅ |
| 7 | Kunci resep lewat `markAsUsedInProduction()` | ✅ |
| 8 | Ubah resep terkunci → ditolak, `suggested_action: new_version` | ✅ |
| 9 | Hapus resep terkunci → ditolak | ✅ |
| 10 | Buat versi baru dari resep terkunci → berhasil, v2 aktif, 6 bahan tersalin | ✅ |
| 11 | Ubah versi arsip → ditolak | ✅ |
| 12 | Idempotensi: 3× kirim @5.000 g dengan kunci sama → stok naik 5.000 g, 1 baris ledger | ✅ |
| 13 | Stok kurang → ditolak dengan angka tersedia/dibutuhkan/kurang | ✅ |
| 14 | Sunting baris ledger → exception | ✅ |
| 15 | Resep campur satuan (250 g + 5 kg + 1 butir) → tersimpan 250 g / 5.000 g / 1 pcs | ✅ |
| 16 | `stock:reconcile` setelah seluruh operasi | ✅ bersih |
| 17 | `data:check` setelah seluruh operasi | ✅ bersih |

### 8.2 Pengujian Versi Pertama

**29 skenario** diuji langsung terhadap API yang berjalan:

| Kelompok | Cakupan |
|---|---|
| **Hak akses** | Kasir ditolak (403) · Admin Produksi diizinkan · Owner diizinkan |
| **Kode otomatis** | BB-0001 s.d. BB-0008 berurutan tanpa lompat |
| **Filter stok** | habis / kritis / menipis / aman / berlebih — total cocok dengan statistik |
| **Pencarian & paginasi** | `?search=tepung` → 1 hasil · `?per_page=5&page=2` → halaman 2 dari 2 |
| **Perhitungan resep** | HPP, margin, kapasitas produksi, bahan pembatas |
| **Simulasi** | 200 pcs → 3 bahan kurang, dengan rincian angkanya · 10 pcs → cukup |
| **Validasi** | Bahan ganda · resep kosong · yield nol · faktor konversi salah · kategori salah jenis |
| **Proteksi hapus** | Bahan dipakai resep · kategori dipakai · supplier utama · produk berstok |
| **Proteksi ubah** | Stok lewat master data · satuan dasar bahan berstok |
| **Versioning** | Buat versi 2 → v1 nonaktif otomatis · aktifkan v1 → v2 nonaktif |
| **Alur lengkap** | Kategori → Produk → Resep Roti Coklat sesuai contoh permintaan |

**Frontend** — `npm run build` lulus (tsc + vite, 1.873 modul) · `npm run lint` bersih.

---

## 9. Yang Sengaja Belum Dikerjakan

| Hal | Alasan |
|---|---|
| Unggah foto produk (UI) | Backend sudah menerima `image`; form belum menampilkannya agar modul tidak melebar. Ditambahkan bersama katalog penjualan di M6. |
| Kelola daftar supplier per bahan (UI) | Tabel pivot dan API-nya sudah siap; halaman pengelolaannya lebih tepat berada di modul Pembelian yang memang membandingkan harga antar supplier. |
| BOM bertingkat (adonan dasar sebagai bahan) | Struktur saat ini satu tingkat, sesuai asumsi §1.4 dokumen perancangan. Bila nanti dibutuhkan, ganti `explode()` dengan DFS + memoisasi dan deteksi siklus. |
| Impor massal dari Excel | Berguna untuk migrasi awal, tetapi bukan prasyarat modul berikutnya. |
| Pengujian otomatis | Diuji manual 29 skenario. Suite otomatis dibangun bersama modul stok, yang aturannya jauh lebih rumit dan lebih berisiko regresi. |

---

## 10. Modul Berikutnya

**M3 — Persediaan.** Mesinnya sudah jadi pada revisi ini: tabel `stock_ledger`,
`StockService::applyMovement()`, idempotensi, penolakan stok minus, dan
rekonsiliasi semuanya sudah berjalan dan teruji. Yang tersisa untuk M3 adalah
**antarmuka dan alur kerjanya**, bukan fondasinya lagi:

| Sisa pekerjaan M3 | Sudah tersedia |
|---|---|
| Halaman monitoring stok (masuk/keluar/menipis/habis) | Endpoint statistik + filter status stok |
| Halaman riwayat pergerakan per bahan | `GET /master/ingredients/{id}/ledger` |
| Form penyesuaian stok manual | `StockService::adjustToCount()` |
| Sesi stock opname + laporan selisih | Ledger `adjustment` + `stock:reconcile` |
| Notifikasi stok menipis | `Ingredient::stockStatus()` + `averageDailyUsage()` |

Setelah itu [Dashboard.tsx](Frontend/src/components/Dashboard.tsx) dari prototipe
disambungkan ke `/persediaan` dengan data sungguhan.

Rinciannya ada di §3.1 dan §3.2 [DOKUMEN-PERANCANGAN.md](DOKUMEN-PERANCANGAN.md).
