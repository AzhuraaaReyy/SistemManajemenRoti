<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $users = [
            [
                'name' => 'Lilik Sari',
                'email' => 'owner@rotimanis.test',
                'password' => 'password123',
                'role' => UserRole::OWNER->value,
                'phone' => '081234567890',
            ],
            /*
            | Budi memegang akun yang dulu bernama produksi@rotimanis.test.
            |
            | Migrasi 2026_07_20_100100 mengganti nama email pada baris yang
            | SAMA, bukan membuat akun baru — sehingga seluruh batch produksi
            | dan penerimaan PO yang tercatat atas namanya tetap tersambung.
            */
            [
                'name' => 'Budi Santoso',
                'email' => 'kepalaproduksi@rotimanis.test',
                'password' => 'password123',
                'role' => UserRole::KEPALA_PRODUKSI->value,
                'phone' => '081234567891',
            ],
            [
                'name' => 'Sri Wahyuni',
                'email' => 'admin_gudang@rotimanis.test',
                'password' => 'password123',
                'role' => UserRole::ADMIN_GUDANG->value,
                'phone' => '081234567894',
            ],
            [
                'name' => 'Dewi Anggraini',
                'email' => 'kasir@rotimanis.test',
                'password' => 'password123',
                'role' => UserRole::KASIR->value,
                'phone' => '081234567892',
            ],
            [
                'name' => 'Rahmat Hidayat',
                'email' => 'kasir2@rotimanis.test',
                'password' => 'password123',
                'role' => UserRole::KASIR->value,
                'phone' => '081234567893',
                'is_active' => false,
            ],
        ];

        foreach ($users as $data) {
            // updateOrCreate agar seeder aman dijalankan berulang kali.
            User::updateOrCreate(
                ['email' => $data['email']],
                [...$data, 'is_active' => $data['is_active'] ?? true, 'email_verified_at' => now()],
            );
        }

        $this->command->newLine();
        $this->command->info('Akun demo berhasil dibuat (kata sandi semua: password123)');
        $this->command->table(
            ['Peran', 'Email', 'Status'],
            collect($users)->map(fn ($u) => [
                UserRole::from($u['role'])->label(),
                $u['email'],
                ($u['is_active'] ?? true) ? 'Aktif' : 'Nonaktif',
            ])->all()
        );
    }
}
