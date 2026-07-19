<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Stok tidak mencukupi untuk pergerakan yang diminta.
 *
 * Pesannya sengaja menyebutkan angka: berapa yang tersedia, berapa yang
 * diminta, dan berapa kurangnya. "Stok tidak cukup" saja memaksa pengguna
 * membuka halaman lain hanya untuk tahu harus beli berapa.
 */
class InsufficientStockException extends \RuntimeException
{
    public function __construct(
        public readonly string $itemName,
        public readonly float $available,
        public readonly float $requested,
        public readonly string $unit = '',
    ) {
        $kurang = $requested - $available;

        parent::__construct(sprintf(
            'Stok %s tidak mencukupi. Tersedia %s %s, dibutuhkan %s %s — kurang %s %s.',
            $itemName,
            $this->rapikan($available),
            $unit,
            $this->rapikan($requested),
            $unit,
            $this->rapikan($kurang),
            $unit,
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
                'stock' => [
                    'item' => $this->itemName,
                    'available' => round($this->available, 4),
                    'requested' => round($this->requested, 4),
                    'shortage' => round($this->requested - $this->available, 4),
                    'unit' => $this->unit,
                ],
            ],
        ], 422);
    }

    private function rapikan(float $nilai): string
    {
        return rtrim(rtrim(number_format($nilai, 4, ',', '.'), '0'), ',');
    }
}
