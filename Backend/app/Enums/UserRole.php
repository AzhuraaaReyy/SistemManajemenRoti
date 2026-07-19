<?php

namespace App\Enums;

/**
 * Peran pengguna sistem.
 *
 * Nilai enum disimpan apa adanya di kolom `users.role`. Label dan izin
 * didefinisikan di sini agar frontend dan backend tidak pernah berbeda
 * pendapat soal arti sebuah peran.
 */
enum UserRole: string
{
    case OWNER = 'owner';
    case ADMIN_PRODUKSI = 'admin_produksi';
    case KASIR = 'kasir';

    public function label(): string
    {
        return match ($this) {
            self::OWNER => 'Owner',
            self::ADMIN_PRODUKSI => 'Admin Produksi',
            self::KASIR => 'Kasir',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::OWNER => 'Akses penuh ke seluruh modul, laporan, dan manajemen pengguna.',
            self::ADMIN_PRODUKSI => 'Mengelola bahan baku, resep, produksi, dan pembelian.',
            self::KASIR => 'Mencatat penjualan dan retur produk jadi.',
        };
    }

    /**
     * Menu yang boleh dibuka oleh peran ini.
     *
     * Dipakai frontend untuk menyusun sidebar. Ini hanya untuk tampilan —
     * penegakan hak akses yang sesungguhnya tetap di middleware `role`.
     *
     * @return array<int, string>
     */
    public function allowedMenus(): array
    {
        return match ($this) {
            self::OWNER => [
                'dashboard', 'master', 'persediaan', 'produksi',
                'pembelian', 'penjualan', 'laporan', 'pengguna', 'pengaturan',
            ],
            self::ADMIN_PRODUKSI => [
                'dashboard', 'master', 'persediaan', 'produksi', 'pembelian',
            ],
            self::KASIR => [
                'dashboard', 'penjualan',
            ],
        };
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function options(): array
    {
        return array_map(fn (self $role) => [
            'value' => $role->value,
            'label' => $role->label(),
            'description' => $role->description(),
        ], self::cases());
    }

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
