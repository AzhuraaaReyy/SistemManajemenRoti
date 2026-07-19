# Modul 1 — Authentication & User Management

Status: **Selesai** · 19 Juli 2026
Stack: React 19 + TypeScript + Tailwind · Laravel 12 + JWT · MySQL 8.4

---

## 1. Ruang Lingkup Modul

| Fitur | Status | Keterangan |
|---|---|---|
| Login | ✅ | Dengan pembatasan laju 5 percobaan / 15 menit |
| Logout | ✅ | Token dimasukkan daftar cekal, bukan sekadar dihapus di browser |
| Forgot Password | ✅ | Respons seragam agar daftar email tidak bocor |
| Reset Password | ✅ | Token sekali pakai, berlaku 60 menit |
| Manajemen User (CRUD) | ✅ | Khusus Owner, dengan soft delete |
| Role: Owner / Admin Produksi / Kasir | ✅ | Didefinisikan di satu enum, dipakai backend & frontend |
| Middleware Authorization | ✅ | `auth:api` → `active` → `role:...` |
| JWT Authentication | ✅ | tymon/jwt-auth 2.3, refresh otomatis |
| Remember Login | ✅ | 60 menit → 30 hari, dan localStorage vs sessionStorage |
| Halaman Profile | ✅ | Ubah data diri, foto, dan kata sandi |

---

## 2. Desain Database

### 2.1 ERD

```
┌──────────────────────────────┐
│           users              │
├──────────────────────────────┤
│ PK id               BIGINT   │
│    name             VARCHAR  │
│ UQ email            VARCHAR  │
│    email_verified_at TIMESTAMP│
│    password         VARCHAR  │  ← bcrypt, 12 rounds
│    role             ENUM     │  ← owner | admin_produksi | kasir
│    phone            VARCHAR  │
│    avatar           VARCHAR  │
│    is_active        BOOLEAN  │  ← nonaktif ≠ dihapus
│    last_login_at    TIMESTAMP│
│    last_login_ip    VARCHAR  │
│    remember_token   VARCHAR  │
│    deleted_at       TIMESTAMP│  ← soft delete
│    created_at       TIMESTAMP│
│    updated_at       TIMESTAMP│
└──────────────┬───────────────┘
               │ 1
               │
               │ N
┌──────────────┴───────────────┐      ┌──────────────────────────────┐
│       activity_logs          │      │    password_reset_tokens     │
├──────────────────────────────┤      ├──────────────────────────────┤
│ PK id               BIGINT   │      │ PK email            VARCHAR  │
│ FK user_id          BIGINT   │      │    token            VARCHAR  │
│    action           VARCHAR  │      │    created_at       TIMESTAMP│
│    description      VARCHAR  │      └──────────────────────────────┘
│    subject_type     VARCHAR  │  ┐
│    subject_id       BIGINT   │  ├─ penunjuk polimorfik
│    ip_address       VARCHAR  │  ┘   (dipakai ulang modul berikutnya)
│    user_agent       VARCHAR  │
│    created_at       TIMESTAMP│
│    updated_at       TIMESTAMP│
└──────────────────────────────┘

Relasi:
  users 1 ──── N activity_logs        (ON DELETE SET NULL)
  users 1 ──── 1 password_reset_tokens (lewat kolom email)
```

### 2.2 Keputusan Desain Penting

| Keputusan | Alasan |
|---|---|
| `is_active` **dan** `deleted_at`, bukan salah satu | Nonaktif = tidak bisa masuk tapi masih terlihat di daftar. Dihapus = hilang dari daftar tapi riwayat transaksinya tetap utuh. Keduanya kebutuhan berbeda. |
| Soft delete, bukan hard delete | Modul berikutnya menyimpan `operator_id` di setiap transaksi stok. Menghapus baris user akan membuat laporan lama menunjuk ke data yang tidak ada. Lihat §4.2 (S12) [DOKUMEN-PERANCANGAN.md](DOKUMEN-PERANCANGAN.md). |
| `role` sebagai ENUM, bukan tabel `roles` | UMKM roti punya 3 peran yang stabil. Tabel relasi menambah JOIN di setiap permintaan tanpa manfaat nyata pada skala ini. |
| `activity_logs` polimorfik sejak modul pertama | Tabel yang sama langsung dipakai ulang modul stok, produksi, dan penjualan — bukan membuat tabel log baru per modul. |
| `last_login_at` + `last_login_ip` | Pemilik bisa melihat kapan dan dari mana karyawan terakhir masuk. |

### 2.3 Indeks

```sql
UNIQUE INDEX users_email_unique          ON users(email);
INDEX       users_role_is_active_index   ON users(role, is_active);
INDEX       activity_logs_user_created   ON activity_logs(user_id, created_at);
INDEX       activity_logs_action_created ON activity_logs(action, created_at);
INDEX       activity_logs_subject        ON activity_logs(subject_type, subject_id);
```

---

## 3. API Endpoint

Base URL: `http://127.0.0.1:8000/api/v1`

### 3.1 Autentikasi

| Method | Endpoint | Penjaga | Keterangan |
|---|---|---|---|
| POST | `/auth/login` | — | Masuk, mengembalikan JWT + data pengguna |
| POST | `/auth/forgot-password` | — | Kirim tautan reset |
| POST | `/auth/reset-password` | — | Simpan kata sandi baru |
| GET | `/auth/me` | `auth:api` `active` | Data pengguna yang sedang masuk |
| POST | `/auth/refresh` | `auth:api` `active` | Tukar token lama dengan yang baru |
| POST | `/auth/logout` | `auth:api` `active` | Keluar, token dicekal |
| GET | `/auth/roles` | `auth:api` `active` | Daftar peran untuk mengisi form |

### 3.2 Profil (semua peran)

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/profile` | Data profil sendiri |
| POST | `/profile` | Ubah nama, email, telepon, foto (multipart) |
| PUT | `/profile/password` | Ganti kata sandi, terbitkan token baru |
| DELETE | `/profile/avatar` | Hapus foto profil |
| GET | `/profile/activities` | Riwayat aktivitas sendiri |

### 3.3 Manajemen Pengguna (khusus Owner)

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/users` | Daftar berhalaman + filter + urutan |
| GET | `/users/statistics` | Ringkasan total / aktif / nonaktif / per peran |
| POST | `/users` | Tambah pengguna |
| GET | `/users/{id}` | Detail pengguna |
| PUT | `/users/{id}` | Ubah pengguna |
| PATCH | `/users/{id}/toggle-active` | Aktifkan / nonaktifkan |
| DELETE | `/users/{id}` | Hapus (soft delete) |

**Parameter query `/users`:**
`search`, `role`, `status` (`aktif`\|`nonaktif`), `sort_by`, `sort_dir`, `per_page` (5–100), `page`

### 3.4 Bentuk Respons

Semua endpoint memakai bentuk yang sama, sehingga frontend cukup satu penangan:

```json
// Berhasil
{ "success": true, "message": "…", "data": { } }

// Berhasil, berhalaman
{ "success": true, "message": "…", "data": [ ],
  "meta": { "current_page": 1, "last_page": 3, "per_page": 10,
            "total": 24, "from": 1, "to": 10 } }

// Gagal validasi (422)
{ "success": false, "message": "Data yang dikirim tidak valid.",
  "errors": { "email": ["Email ini sudah terdaftar pada pengguna lain."] } }

// Gagal lain (401 / 403 / 404 / 429 / 500)
{ "success": false, "message": "…" }
```

### 3.5 Kode Status

| Kode | Kapan Muncul |
|---|---|
| 200 | Permintaan berhasil |
| 201 | Pengguna baru dibuat |
| 401 | Token tidak ada, tidak sah, atau kredensial salah |
| 403 | Peran tidak berhak, atau akun dinonaktifkan |
| 404 | Data atau endpoint tidak ditemukan |
| 422 | Validasi gagal, atau melanggar aturan bisnis |
| 429 | Melebihi batas percobaan |

---

## 4. Aturan Bisnis yang Ditegakkan

| Aturan | Diuji |
|---|---|
| Owner aktif terakhir tidak boleh diturunkan perannya, dinonaktifkan, atau dihapus | ✅ |
| Pengguna tidak boleh menghapus atau menonaktifkan akunnya sendiri | ✅ |
| Akun nonaktif ditolak saat login, dan tokennya dicekal jika dinonaktifkan di tengah sesi | ✅ |
| Pesan login gagal tidak membedakan "email salah" dan "kata sandi salah" | ✅ |
| Forgot password menjawab sama untuk email terdaftar maupun tidak | ✅ |
| Token reset hanya sekali pakai | ✅ |
| Ganti kata sandi mewajibkan kata sandi lama, dan mematikan token lama | ✅ |
| Kata sandi minimal 8 karakter, mengandung huruf dan angka | ✅ |
| Email unik, mengabaikan baris yang sudah di-soft-delete | ✅ |

---

## 5. Struktur Folder

### 5.1 Backend

```
Backend/
├── app/
│   ├── Enums/
│   │   └── UserRole.php                    ← peran, label, dan menu yang boleh diakses
│   ├── Http/
│   │   ├── Controllers/Api/V1/
│   │   │   ├── AuthController.php
│   │   │   ├── ProfileController.php
│   │   │   └── UserController.php
│   │   ├── Middleware/
│   │   │   ├── RoleMiddleware.php          ← 'role:owner,admin_produksi'
│   │   │   └── EnsureUserIsActive.php      ← tolak akun nonaktif di tengah sesi
│   │   ├── Requests/
│   │   │   ├── Auth/{Login,ForgotPassword,ResetPassword}Request.php
│   │   │   ├── User/{Store,Update}UserRequest.php
│   │   │   └── Profile/{UpdateProfile,ChangePassword}Request.php
│   │   └── Resources/
│   │       └── UserResource.php
│   ├── Models/
│   │   ├── User.php                        ← implements JWTSubject
│   │   └── ActivityLog.php
│   ├── Notifications/
│   │   └── ResetPasswordNotification.php   ← tautan mengarah ke React
│   └── Traits/
│       └── ApiResponse.php                 ← bentuk respons seragam
├── bootstrap/app.php                       ← alias middleware + penangan error JSON
├── config/{auth,jwt,cors,app}.php
├── database/
│   ├── migrations/
│   │   ├── 0001_01_01_000000_create_users_table.php
│   │   └── 2026_07_19_000100_create_activity_logs_table.php
│   ├── factories/UserFactory.php
│   └── seeders/{DatabaseSeeder,UserSeeder}.php
└── routes/api.php
```

### 5.2 Frontend

```
Frontend/src/
├── components/
│   ├── auth/RouteGuards.tsx        ← ProtectedRoute, GuestRoute, RoleRoute
│   ├── ui/
│   │   ├── Button.tsx              ← 4 varian, keadaan loading
│   │   ├── Input.tsx               ← label, ikon, error, toggle password
│   │   ├── Select.tsx
│   │   ├── Modal.tsx               ← Escape untuk menutup, scroll terkunci
│   │   └── Feedback.tsx            ← LoadingScreen, TableSkeleton, EmptyState, Badge
│   ├── users/
│   │   ├── UserFormModal.tsx       ← form tambah & ubah
│   │   └── ConfirmDialog.tsx
│   └── Sidebar.tsx                 ← menu mengikuti peran, laci geser di ponsel
├── context/
│   ├── AuthContext.tsx             ← sesi, login, logout, pemeriksaan peran
│   └── ToastContext.tsx            ← notifikasi 4 jenis
├── layouts/
│   ├── AuthLayout.tsx              ← dua kolom untuk halaman publik
│   └── DashboardLayout.tsx         ← sidebar + bilah atas
├── lib/
│   ├── api.ts                      ← axios + refresh token otomatis + antrean
│   └── storage.ts                  ← aturan localStorage vs sessionStorage
├── services/
│   ├── authService.ts
│   └── userService.ts
├── pages/
│   ├── LoginPage.tsx
│   ├── ForgotPasswordPage.tsx
│   ├── ResetPasswordPage.tsx
│   ├── UsersPage.tsx
│   ├── ProfilePage.tsx
│   ├── DashboardPage.tsx
│   └── ComingSoonPage.tsx
├── data/mockData.ts                ← data prototipe, dipakai modul M2–M5 nanti
├── types/auth.ts
└── App.tsx                         ← hanya routing
```

---

## 5.3 Hubungan dengan Prototipe Sebelumnya

Modul ini adalah lanjutan dari prototipe React yang sudah ada, bukan penulisan
ulang dari nol. Berikut yang terjadi pada tiap berkas lama:

| Berkas Lama | Perlakuan | Keterangan |
|---|---|---|
| `types/index.ts` | **Tidak diubah** | `Ingredient`, `Recipe`, `ProductionBatch`, dll tetap utuh. Tipe autentikasi ditaruh terpisah di `types/auth.ts`. |
| `components/Dashboard.tsx` | **Tidak diubah**, belum dipasang | Akan disambungkan ke API ledger stok pada **M2** |
| `components/Purchasing.tsx` | **Tidak diubah**, belum dipasang | Akan disambungkan ke API purchase order pada **M3** |
| `components/BOM.tsx` | **Tidak diubah**, belum dipasang | Akan disambungkan ke API resep pada **M4** |
| `components/Production.tsx` | **Tidak diubah**, belum dipasang | Akan disambungkan ke API batch produksi pada **M5** |
| Data contoh di `App.tsx` | **Dipindahkan** | Utuh tanpa perubahan ke `data/mockData.ts` |
| `App.tsx` | **Ditulis ulang** | Dari wadah state menjadi router murni. Logika stok pindah ke backend sesuai aturan lapisan di §2.2 [DOKUMEN-PERANCANGAN.md](DOKUMEN-PERANCANGAN.md). |
| `Sidebar.tsx` | **Ditulis ulang** | Menu kini mengikuti peran dan memakai `NavLink`; props berubah dari `activeTab/setActiveTab` menjadi `open/onClose`. Gaya visualnya dipertahankan. |
| `App.css` | Tidak terpakai | Sudah tidak di-import bahkan sebelum modul ini dikerjakan |

### Mengapa keempat komponen belum dipasang

Keputusan sadar pada iterasi 1: **setiap komponen disentuh sekali saja.**

Memasangnya sekarang berarti perlu membangun wadah state sementara berisi
salinan logika lama (`handleExecuteProduction`, `handleReceivePO`, dan
kawan-kawan), lalu membongkarnya lagi beberapa minggu kemudian saat API
sungguhan siap. Pekerjaan ganda, dan sementara itu aplikasi menampilkan angka
palsu di balik login sungguhan — berisiko disalahpahami saat didemokan.

Selama menunggu, menu tersebut mengarah ke `ComingSoonPage` yang menyebutkan
modul dan cakupannya secara jujur. Peta jalannya juga terdokumentasi sebagai
komentar di [App.tsx](Frontend/src/App.tsx).

> **Catatan:** kode di `components/` masih ikut dikompilasi TypeScript, jadi
> perubahan tipe yang merusak akan tetap ketahuan saat `npm run build` —
> komponen tersebut tidak akan diam-diam membusuk selama menunggu.

---

## 6. Catatan Implementasi

### 6.1 Remember Login

Bukan sekadar mencentang kotak. Dua hal berubah bersamaan:

| | Tanpa Ingat Saya | Dengan Ingat Saya |
|---|---|---|
| Masa berlaku token | 60 menit | 30 hari |
| Tempat penyimpanan | `sessionStorage` | `localStorage` |
| Efek menutup browser | Sesi berakhir | Sesi bertahan |

Diatur di [AuthController.php](Backend/app/Http/Controllers/Api/V1/AuthController.php) via `setTTL()` dan [storage.ts](Frontend/src/lib/storage.ts).

### 6.2 Refresh Token Otomatis

Ketika token kedaluwarsa di tengah pemakaian, interceptor axios menukarnya dengan token baru lalu **mengulang permintaan yang tadi gagal** — pengguna tidak merasakan apa pun. Permintaan lain yang gagal bersamaan diantrekan supaya tidak ada beberapa panggilan refresh sekaligus yang saling membatalkan token. Lihat [api.ts](Frontend/src/lib/api.ts).

### 6.3 Menu Berbasis Peran

Daftar menu tidak ditulis dua kali. Backend mengirim `allowed_menus` di dalam `UserResource`, bersumber dari satu tempat: `UserRole::allowedMenus()`. Sidebar hanya menyaring berdasarkan daftar itu.

Menyembunyikan menu **bukan pengamanan** — setiap endpoint tetap dijaga middleware `role`. Yang disembunyikan hanyalah tampilannya.

### 6.4 Mengapa Sesi Tidak Disimpan di localStorage

Hanya token yang disimpan; data pengguna diambil ulang lewat `/auth/me` setiap aplikasi dibuka. Kalau data pengguna ikut disimpan, mengubah peran seseorang tidak akan berpengaruh sampai ia membersihkan browsernya — menu lama tetap muncul. Server harus menjadi satu-satunya sumber kebenaran.

---

## 7. Cara Menjalankan

### 7.1 Prasyarat

- PHP 8.2+, Composer, Node.js 18+
- MySQL 8 aktif di `127.0.0.1:3306` (Laragon / XAMPP)

### 7.2 Backend

```bash
cd Backend
composer install
cp .env.example .env
php artisan key:generate
php artisan jwt:secret

# Buat database terlebih dahulu:
#   CREATE DATABASE db_manajemen_roti CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

php artisan migrate --seed
php artisan storage:link
php artisan serve --host=127.0.0.1 --port=8000
```

### 7.3 Frontend

```bash
cd Frontend
npm install
cp .env.example .env
npm run dev          # http://localhost:5180
```

> **Port 5180 dikunci** (`strictPort: true`). Backend hanya mengizinkan origin ini di `config/cors.php` dan memakainya untuk membangun tautan reset password. Jika Vite pindah port diam-diam, semua panggilan API akan diblokir browser.

### 7.4 Akun Demo

| Peran | Email | Kata Sandi | Status |
|---|---|---|---|
| Owner | `owner@rotimanis.test` | `password123` | Aktif |
| Admin Produksi | `produksi@rotimanis.test` | `password123` | Aktif |
| Kasir | `kasir@rotimanis.test` | `password123` | Aktif |
| Kasir | `kasir2@rotimanis.test` | `password123` | **Nonaktif** — untuk menguji penolakan login |

Halaman login menyediakan tombol pintasan untuk mengisi ketiga akun aktif.

### 7.5 Menguji Reset Password Tanpa SMTP

`MAIL_MAILER=log`, jadi email tidak benar-benar terkirim. Di environment `local`, endpoint forgot-password mengembalikan `dev_reset_url` dan halaman "Periksa Email Anda" menampilkannya langsung. Email lengkapnya juga tercatat di `storage/logs/laravel.log`.

Bantuan ini otomatis hilang di luar environment `local`.

---

## 8. Hasil Pengujian

22 skenario diuji langsung terhadap API yang berjalan:

**Autentikasi** — login benar · kata sandi salah · akun nonaktif · tanpa token · token setelah logout
**Otorisasi** — Kasir menembus `/users` (403) · Owner mengakses statistik (200)
**CRUD** — buat · email duplikat · kata sandi lemah · ubah · toggle status · hapus
**Aturan bisnis** — Owner terakhir diturunkan (ditolak) · hapus diri sendiri (ditolak)
**Reset password** — kirim tautan · reset berhasil · login dengan kata sandi baru · token dipakai ulang (ditolak)
**Ganti kata sandi** — kata sandi lama salah (ditolak) · kata sandi lama benar (berhasil)

**Frontend** — `npm run build` lulus (tsc + vite) · `npm run lint` bersih · preflight CORS terverifikasi.

---

## 9. Yang Sengaja Belum Dikerjakan

| Hal | Alasan |
|---|---|
| Verifikasi email pengguna baru | Akun dibuat Owner, bukan pendaftaran mandiri — verifikasi tidak menambah keamanan di sini |
| Two-factor authentication | Berlebihan untuk 3–10 karyawan UMKM; bisa ditambahkan bila skala bertambah |
| Halaman riwayat aktivitas (UI) | API `/profile/activities` sudah siap, tampilannya menyusul bersama modul audit |
| Pengujian otomatis (PHPUnit / Vitest) | Diuji manual pada modul ini; suite otomatis dibangun saat modul stok yang aturannya jauh lebih rumit |

---

## 10. Modul Berikutnya

**M2 — Persediaan & Ledger Stok.** Fondasinya sudah siap: `activity_logs` bisa langsung dipakai ulang, `ApiResponse` dan penangan error sudah seragam, dan `RoleMiddleware` tinggal dipasang di rute baru.

Yang perlu dibangun: tabel `stock_ledger` append-only, `StockService::applyMovement()` sebagai satu-satunya pintu perubahan stok, dan klasifikasi 4 status (Aman / Menipis / Kritis / Habis). Rinciannya ada di §3.1 dan §3.2 [DOKUMEN-PERANCANGAN.md](DOKUMEN-PERANCANGAN.md).
