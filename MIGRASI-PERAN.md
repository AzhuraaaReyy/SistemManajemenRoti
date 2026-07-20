# Migrasi Peran — Admin Produksi Dipecah Menjadi Dua

> Berlaku 20 Juli 2026. Murni perubahan lapisan otorisasi: tidak ada satu pun
> baris `StockService`, `RecipeService`, atau algoritma bisnis lain yang diubah.
>
> Dokumen ini adalah acuan pembagian akses yang berlaku sekarang. Bagian
> "Hak Akses" di berkas MODUL-2 sampai MODUL-6 menggambarkan keadaan **saat
> modul itu dibangun**, ketika perannya masih tiga.

---

## 1. Alasan

Sistem berjalan dengan tiga peran: `owner`, `admin_produksi`, `kasir`.
Rancangan awal (`DOKUMEN-PERANCANGAN.md` §1.3) menyebut empat, dan lapangan
membenarkan rancangan itu: pada tim 4–8 orang, yang menerima barang dari
supplier dan yang memasak di dapur adalah **orang yang berbeda**.

Peran `admin_produksi` menggabungkan keduanya. Akibatnya:

- staf gudang bisa mengubah resep dapur
- staf dapur bisa mengubah data supplier

Keduanya bukan tanggung jawab mereka, dan karena keduanya memakai peran yang
sama, log aktivitas tidak bisa membedakan siapa yang seharusnya melakukannya.

Peran kini menjadi empat: **owner**, **admin_gudang**, **kepala_produksi**,
**kasir**.

---

## 2. Pembagian Akses

Singkatan: **O** = owner · **G** = admin_gudang · **P** = kepala_produksi ·
**K** = kasir

| Modul | O | G | P | K |
|---|:-:|:-:|:-:|:-:|
| Master — Kategori | ✅ | ✅ | ✅ | — |
| Master — Supplier | ✅ | ✅ | — | — |
| Master — Bahan Baku | ✅ | ✅ | 👁 baca | — |
| Master — Produk | ✅ | 👁 baca | ✅ | — |
| Master — Resep (BOM) | ✅ | — | ✅ | — |
| M3 Pembelian | ✅ | ✅ | — | — |
| M4 Produksi | ✅ | — | ✅ | — |
| M5 Tracking Produksi | ✅ | — | ✅ | — |
| M6 Persediaan (baca) | ✅ | ✅ | ✅ | — |
| M6 Penyesuaian stok | ✅ | ✅ | — | — |
| M7 Penjualan (POS) | ✅ | — | — | ✅ |
| M8 Dashboard Owner | ✅ | — | — | — |
| M9 Laporan | ✅ | — | — | — |
| Manajemen Pengguna | ✅ | — | — | — |
| Pengaturan | ✅ | — | — | — |

Diuji lewat API berjalan: **148 pemeriksaan, seluruhnya sesuai** (§6).

---

## 3. Tiga Tempat yang Tidak Bisa Dipilah Kaku

Pemilahan "bahan+supplier ke gudang, produk+resep ke dapur" terdengar rapi,
tetapi diterapkan apa adanya akan merusak sistem di tiga tempat. Ketiganya
ditemukan sebelum eksekusi, bukan sesudah.

### 3.1 Resep butuh membaca bahan baku

Kepala produksi menyusun resep **dari** bahan baku. Kalau `master/ingredients`
menjadi milik gudang sepenuhnya, pemilih bahan pada formulir resep menerima 403
dan resep tidak bisa dibuat sama sekali — modul yang justru menjadi inti
pekerjaan peran itu.

Karena itu bahan baku dipilah **baca vs tulis**, bukan dipilah utuh. Hal yang
sama berlaku terbalik untuk produk: gudang membacanya karena Persediaan memuat
stok produk jadi.

### 3.2 Kategori dipakai kedua belah pihak

Tabel `categories` memuat kategori bahan **dan** kategori produk, dibedakan
kolom `type`, dilayani satu apiResource. Memilahnya per peran berarti menyaring
baris berdasarkan `type` di dalam controller — aturan otorisasi yang tersembunyi
di lapisan query, tempat ia paling mudah menyimpang tanpa ketahuan.

Kategori dibagi bersama.

### 3.3 Persediaan dibuka untuk dapur

Kepala produksi yang tidak bisa melihat stok tepung tidak bisa merencanakan
batch. Ia hanya akan tahu bahannya kurang **setelah** pembuatan batch ditolak,
tanpa cara melihat mengapa.

Yang tetap tertutup untuknya adalah **penyesuaian stok manual**. Menyesuaikan
stok berarti menyatakan bahwa hitungan fisik berbeda dari catatan sistem, dan
yang memegang barangnya adalah gudang. Membukanya untuk dua peran berarti dua
orang bisa mengoreksi angka yang sama tanpa siapa pun bertanggung jawab atasnya.

Tombol "Sesuaikan" beserta kolomnya **disembunyikan** dari Kepala Produksi di
`StockItemsPage`, bukan sekadar dinonaktifkan — tombol mati yang tidak pernah
bisa ditekan hanya membuat orang mengira haknya sedang bermasalah.

---

## 4. Peran Lama Dipertahankan sebagai Usang

`admin_produksi` **tetap ada** di kolom enum dan di `UserRole`, meski migrasi
sudah memindahkan seluruh barisnya ke `kepala_produksi`.

Alasannya: kolom `role` di-cast ke enum itu. Satu baris yang entah bagaimana
terlewat — hasil pemulihan cadangan lama, penyisipan manual, basis data staging
yang belum ikut dimigrasi — akan membuat cast melempar galat dan pengguna itu
**tidak bisa masuk sama sekali**. Kegagalan itu jauh lebih mahal daripada satu
nilai enum yang tidak terpakai.

Yang menutup pintunya bukan penghapusan, melainkan `UserRole::assignable()`:

| | |
|---|---|
| `values()` | seluruh nilai — dipakai untuk **membaca** (mis. filter daftar pengguna) |
| `assignableValues()` | tanpa yang usang — dipakai untuk **menulis** (validasi buat/ubah pengguna) |

Terbukti: `POST /users` dengan `role: admin_produksi` ditolak **422**, dan
`GET /auth/roles` hanya menawarkan empat peran.

Statistik pengguna menampilkan peran usang **hanya bila masih ada penghuninya**.
Menampilkannya selalu berarti baris "Admin Produksi: 0" menetap selamanya;
menyembunyikannya selalu berarti akun yang tertinggal tidak pernah terlihat.

---

## 5. Izin Menu Kini Berbutir Sub-Menu

Sebelumnya `allowedMenus()` mengembalikan kunci setingkat modul (`master`,
`persediaan`, …). Itu tidak lagi cukup: gudang dan dapur sama-sama memakai
Master Data, tetapi sub-menu yang berbeda. Dengan izin setingkat induk, keduanya
akan melihat kelima sub-menu — termasuk yang ujungnya 403.

Kuncinya kini `master.supplier`, `master.resep`, dan seterusnya. Kunci induk
tetap ikut dikirim tetapi **diturunkan otomatis** dari kunci anaknya
(`UserRole::denganInduk()`), sehingga pemeriksaan kasar yang sudah ada —
`canAccess('persediaan')` di `StockAlertBell`, `includes('pengguna')` di
`DashboardPage` — tetap berfungsi tanpa perlu didaftar dua kali dan tanpa bisa
berbeda pendapat dengan anaknya.

`Sidebar` menyaring dua tingkat: sub-menu lebih dulu, lalu induk yang kehabisan
anak ikut hilang. Urutannya penting — menyaring induk saja menampilkan tautan
yang ditolak server, menyaring anak saja menyisakan judul kelompok kosong.

Jumlah menu per peran: Owner 25 kunci · Gudang 13 · Dapur 12 · Kasir 5 ·
Admin Produksi (usang) 1.

---

## 6. Hasil Pengujian

**Matriks otorisasi** — 37 endpoint × 4 peran = **148 pemeriksaan, 0 meleset.**

Teknik yang dipakai: endpoint tulis diuji dengan badan permintaan kosong.
Balasan **422** berarti permintaan lolos penjagaan peran lalu ditolak validasi
(artinya **boleh**), **403** berarti ditolak middleware. Tanpa pembedaan itu,
sebuah endpoint yang diam-diam terbuka akan terbaca sama dengan yang tertutup.

| # | Skenario | Hasil |
|---|---|---|
| 1 | Migrasi dijalankan | ✅ 1 pengguna dipindah ke Kepala Produksi |
| 2 | Tidak ada akun ganda / yatim | ✅ 5 akun, ID 2 tetap milik Budi Santoso |
| 3 | Matriks 37 endpoint × 4 peran | ✅ 148/148 |
| 4 | Dapur menulis supplier / bahan / PO | ✅ 403 |
| 5 | Gudang menulis produk / resep / batch | ✅ 403 |
| 6 | Dapur membaca bahan baku (formulir resep) | ✅ 200 |
| 7 | Gudang & Dapur membaca persediaan | ✅ 200 keduanya |
| 8 | Dapur menyesuaikan stok | ✅ 403 |
| 9 | Kasir ke seluruh modul non-penjualan | ✅ 403 |
| 10 | `GET /auth/roles` | ✅ 4 peran, tanpa yang usang |
| 11 | `POST /users` berperan usang | ✅ 422 |
| 12 | `allowedMenus()` per peran | ✅ 25 / 13 / 12 / 5 / 1 |
| 13 | `stock:reconcile` | ✅ 11 barang, seluruh cache cocok |
| 14 | `data:check` | ✅ Bersih |
| 15 | `npm run lint` & `npm run build` | ✅ Lulus |

**Yang belum diverifikasi:** tampilan sidebar keempat peran di browser. Yang
terbukti adalah `allowedMenus()` mengembalikan kunci yang benar dan penyaringan
dua tingkat sudah terpasang — bukan bahwa hasilnya terlihat rapi di layar.
Silakan masuk sebagai Admin Gudang dan Kepala Produksi lalu bandingkan menunya.

---

## 7. Akun Demo

Kata sandi seluruhnya `password123`.

| Peran | Email | Catatan |
|---|---|---|
| Owner | `owner@rotimanis.test` | |
| Admin Gudang | `admin_gudang@rotimanis.test` | Sri Wahyuni — akun baru |
| Kepala Produksi | `kepalaproduksi@rotimanis.test` | Budi Santoso — **akun lama**, email diganti |
| Kasir | `kasir@rotimanis.test` | |
| Kasir | `kasir2@rotimanis.test` | nonaktif |

`produksi@rotimanis.test` **sudah tidak ada**. Migrasi mengganti nama email pada
baris yang sama, bukan membuat akun baru — sehingga seluruh batch produksi dan
penerimaan PO yang tercatat atas nama Budi tetap tersambung ke akunnya. Membuat
akun baru akan menghasilkan dua Budi: satu memegang seluruh riwayat, satu lagi
kosong tapi bernama benar.

---

## 8. Berkas yang Diubah

### Backend

```
app/Enums/UserRole.php                       ← 2 case baru + assignable() + denganInduk()
app/Http/Middleware/RoleMiddleware.php        (komentar contoh saja)
app/Http/Requests/User/StoreUserRequest.php  ← assignableValues()
app/Http/Requests/User/UpdateUserRequest.php ← assignableValues()
app/Http/Controllers/Api/V1/UserController.php ← statistik menyembunyikan peran usang kosong
routes/api.php                               ← 4 blok middleware dipilah
database/migrations/2026_07_20_100100_split_admin_produksi_role.php   (baru)
database/seeders/UserSeeder.php              ← akun gudang + email dapur
database/seeders/PurchaseSeeder.php          ← PO contoh atas nama gudang
database/seeders/ProductionSeeder.php        ← operator memakai email baru
database/factories/UserFactory.php           ← state adminGudang() & kepalaProduksi()
```

Tidak ada tabel baru. Tidak ada service yang disentuh.

### Frontend

```
src/types/auth.ts                            ← tipe UserRole
src/App.tsx                                  ← penjaga rute dipilah
src/components/auth/RouteGuards.tsx          ← MasterIndexRedirect
src/components/Sidebar.tsx                   ← kunci sub-menu + saring dua tingkat
src/pages/UsersPage.tsx                      ← warna lencana peran
src/pages/inventory/StockItemsPage.tsx       ← kolom Aksi disembunyikan dari dapur
```

`MasterIndexRedirect` menangani hal kecil yang mudah terlewat: `/master` tidak
punya halaman sendiri dan dulu selalu dialihkan ke `/master/bahan-baku` —
tujuan yang kini menghasilkan "Akses Ditolak" bagi Kepala Produksi. Sekarang
dapur diarahkan ke Resep.

---

## 9. Yang Sengaja Belum Dikerjakan

- **Izin per aksi (permission), bukan per peran.** Sistem sekarang memilah pada
  tingkat peran. Untuk UMKM 4–8 orang itu memadai; kalau nanti ada kebutuhan
  "kasir A boleh membatalkan transaksi, kasir B tidak", modelnya perlu berubah
  menjadi peran + izin.
- **Membersihkan `admin_produksi` sepenuhnya.** Baru aman dilakukan setelah
  yakin tidak ada basis data lain (staging, cadangan) yang masih memakainya.
- **Menyesuaikan bagian "Hak Akses" di MODUL-2 sampai MODUL-6.** Dokumen itu
  merekam keadaan saat modulnya dibangun; dokumen ini yang berlaku sekarang.
