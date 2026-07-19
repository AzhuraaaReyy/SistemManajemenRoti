<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Produksi ditolak karena ada bahan yang stoknya tidak mencukupi.
 *
 * Pesannya WAJIB menyebut bahan mana saja yang kurang beserta selisihnya.
 * "Stok tidak cukup" tanpa rincian memaksa pengguna membuka halaman
 * persediaan dan membandingkan satu per satu dengan resep — pekerjaan yang
 * seharusnya dikerjakan sistem.
 */
class InsufficientMaterialsException extends \RuntimeException
{
    /**
     * @param  array<int, array<string, mixed>>  $shortages
     *         Tiap entri: ingredient_id, name, unit, required_display,
     *         available_display, shortage_display
     */
    public function __construct(
        public readonly array $shortages,
        public readonly string $productName = '',
        public readonly float $quantity = 0,
    ) {
        $jumlah = count($shortages);

        $ringkasan = collect($shortages)
            ->take(3)
            ->map(fn ($s) => sprintf(
                '%s kurang %s %s',
                $s['name'],
                self::rapikan($s['shortage_display']),
                $s['unit'],
            ))
            ->implode('; ');

        if ($jumlah > 3) {
            $ringkasan .= sprintf('; dan %d bahan lainnya', $jumlah - 3);
        }

        // Bagian judul dirangkai dari potongan yang mungkin kosong, lalu
        // digabung dengan satu spasi — menempelkan spasi di tiap potongan
        // menghasilkan spasi ganda ketika salah satunya tidak terisi.
        $judul = implode(' ', array_filter([
            'Produksi',
            $productName !== '' ? $productName : null,
            $quantity > 0 ? 'sebanyak '.self::rapikan($quantity).' unit' : null,
        ]));

        parent::__construct(sprintf(
            '%s tidak dapat dijalankan karena %d bahan tidak mencukupi: %s.',
            $judul,
            $jumlah,
            $ringkasan,
        ));
    }

    public function render(Request $request): ?JsonResponse
    {
        if (! $request->is('api/*')) {
            return null;
        }

        return response()->json([
            'success' => false,
            'message' => $this->getMessage(),
            'errors' => [
                // Daftar lengkap per bahan, supaya frontend bisa menandai
                // baris mana saja yang bermasalah di tabel pratinjau.
                'materials' => $this->shortages,
            ],
        ], 422);
    }

    private static function rapikan(float $nilai): string
    {
        return rtrim(rtrim(number_format($nilai, 2, ',', '.'), '0'), ',');
    }
}
