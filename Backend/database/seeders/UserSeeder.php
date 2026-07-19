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
            [
                'name' => 'Budi Santoso',
                'email' => 'produksi@rotimanis.test',
                'password' => 'password123',
                'role' => UserRole::ADMIN_PRODUKSI->value,
                'phone' => '081234567891',
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
