<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;

/**
 * Pembacaan dan penyimpanan pengaturan aplikasi.
 *
 * Dibaca hampir setiap transaksi penjualan (untuk tarif pajak dan identitas
 * toko), jadi hasilnya disimpan sementara di cache. Cache dibuang setiap kali
 * ada pengaturan yang berubah — bukan diberi masa berlaku — supaya perubahan
 * tarif pajak langsung berlaku pada transaksi berikutnya, bukan lima menit
 * kemudian.
 */
class SettingService
{
    private const CACHE_KEY = 'app_settings';

    /**
     * Pengaturan bawaan.
     *
     * Menjadi acuan seeder DAN jaring pengaman: bila sebuah baris terhapus dari
     * basis data, get() tetap mengembalikan nilai yang masuk akal alih-alih
     * membuat kasir gagal menutup transaksi.
     *
     * @return array<string, array<string, mixed>>
     */
    public static function defaults(): array
    {
        return [
            // --- Identitas toko, tampil di kepala struk ---
            'store_name' => [
                'value' => 'Roti Manis Bakery',
                'type' => 'string',
                'group' => 'toko',
                'label' => 'Nama Toko',
                'description' => 'Tampil di baris paling atas struk.',
            ],
            'store_address' => [
                'value' => 'Jl. Merdeka No. 12, Bandung',
                'type' => 'string',
                'group' => 'toko',
                'label' => 'Alamat',
                'description' => null,
            ],
            'store_phone' => [
                'value' => '0812-3456-7890',
                'type' => 'string',
                'group' => 'toko',
                'label' => 'Telepon',
                'description' => null,
            ],

            // --- Penjualan ---
            'tax_enabled' => [
                'value' => '0',
                'type' => 'boolean',
                'group' => 'penjualan',
                'label' => 'Kenakan Pajak',
                'description' => 'Sebagian besar UMKM roti belum wajib memungut PPN, '
                    .'jadi bawaannya dimatikan.',
            ],
            'tax_percent' => [
                'value' => '11',
                'type' => 'decimal',
                'group' => 'penjualan',
                'label' => 'Persentase Pajak (%)',
                'description' => 'Dipakai hanya bila pajak diaktifkan. Tarif dibekukan '
                    .'pada tiap transaksi, jadi mengubahnya tidak mengganggu struk lama.',
            ],
            'max_discount_percent' => [
                'value' => '20',
                'type' => 'decimal',
                'group' => 'penjualan',
                'label' => 'Batas Diskon Kasir (%)',
                'description' => 'Diskon melebihi batas ini ditolak — pagar agar salah '
                    .'ketik tidak menghapus seluruh nilai transaksi.',
            ],

            // --- Struk ---
            'receipt_footer' => [
                'value' => 'Terima kasih atas kunjungan Anda!',
                'type' => 'string',
                'group' => 'struk',
                'label' => 'Catatan Kaki Struk',
                'description' => null,
            ],
        ];
    }

    /**
     * Seluruh pengaturan sebagai array kunci-nilai yang sudah berbentuk asli.
     *
     * @return array<string, mixed>
     */
    public function all(): array
    {
        return Cache::rememberForever(self::CACHE_KEY, function () {
            $tersimpan = Setting::all()->mapWithKeys(
                fn (Setting $s) => [$s->key => $s->typedValue()]
            )->all();

            // Bawaan diletakkan lebih dulu agar nilai tersimpan menimpanya,
            // sekaligus menutup kunci yang barisnya belum ada.
            $bawaan = array_map(
                fn (array $d) => $this->ubahBentuk($d['value'], $d['type']),
                self::defaults(),
            );

            return array_merge($bawaan, $tersimpan);
        });
    }

    public function get(string $key, mixed $fallback = null): mixed
    {
        return $this->all()[$key] ?? $fallback;
    }

    /**
     * Menyimpan beberapa pengaturan sekaligus.
     *
     * @param  array<string, mixed>  $values
     */
    public function setMany(array $values, ?int $userId = null): void
    {
        $bawaan = self::defaults();

        foreach ($values as $key => $value) {
            if (! isset($bawaan[$key])) {
                continue;
            }

            Setting::updateOrCreate(
                ['key' => $key],
                [
                    'value' => is_bool($value) ? ($value ? '1' : '0') : (string) $value,
                    'type' => $bawaan[$key]['type'],
                    'group' => $bawaan[$key]['group'],
                    'label' => $bawaan[$key]['label'],
                    'description' => $bawaan[$key]['description'],
                    'updated_by' => $userId,
                ]
            );
        }

        $this->lupakan();
    }

    /** Menyusun baris bawaan yang belum ada. Dipanggil seeder. */
    public function sync(): int
    {
        $dibuat = 0;

        foreach (self::defaults() as $key => $d) {
            $baris = Setting::firstOrCreate(['key' => $key], [
                'value' => $d['value'],
                'type' => $d['type'],
                'group' => $d['group'],
                'label' => $d['label'],
                'description' => $d['description'],
            ]);

            if ($baris->wasRecentlyCreated) {
                $dibuat++;
            }
        }

        $this->lupakan();

        return $dibuat;
    }

    /**
     * Pengaturan yang boleh dibaca kasir.
     *
     * Kasir butuh tarif pajak dan identitas toko untuk menyusun struk, tetapi
     * tidak perlu — dan tidak boleh — mengubahnya.
     *
     * @return array<string, mixed>
     */
    public function forPos(): array
    {
        $semua = $this->all();

        return [
            'store_name' => $semua['store_name'],
            'store_address' => $semua['store_address'],
            'store_phone' => $semua['store_phone'],
            'tax_enabled' => (bool) $semua['tax_enabled'],
            'tax_percent' => (float) $semua['tax_percent'],
            'max_discount_percent' => (float) $semua['max_discount_percent'],
            'receipt_footer' => $semua['receipt_footer'],
        ];
    }

    /**
     * Dikelompokkan untuk halaman pengaturan.
     *
     * @return array<string, array<int, array<string, mixed>>>
     */
    public function grouped(): array
    {
        $nilai = $this->all();
        $hasil = [];

        foreach (self::defaults() as $key => $d) {
            $hasil[$d['group']][] = [
                'key' => $key,
                'value' => $nilai[$key] ?? null,
                'type' => $d['type'],
                'label' => $d['label'],
                'description' => $d['description'],
            ];
        }

        return $hasil;
    }

    public function lupakan(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    private function ubahBentuk(?string $value, string $type): string|int|float|bool|null
    {
        if ($value === null) {
            return null;
        }

        return match ($type) {
            'integer' => (int) $value,
            'decimal' => (float) $value,
            'boolean' => filter_var($value, FILTER_VALIDATE_BOOLEAN),
            default => $value,
        };
    }
}
