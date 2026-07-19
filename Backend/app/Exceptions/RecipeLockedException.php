<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Versi resep sudah terkunci dan tidak dapat diubah.
 *
 * Pesannya menyebut alasan penguncian sekaligus jalan keluarnya, supaya
 * pengguna tidak buntu di layar yang cuma bilang "tidak bisa diubah".
 */
class RecipeLockedException extends \RuntimeException
{
    public function __construct(
        public readonly string $recipeName,
        public readonly int $version,
        public readonly string $reason,
    ) {
        parent::__construct(sprintf(
            'Resep "%s" versi %d tidak dapat diubah karena %s. '
            .'Gunakan tombol "Buat Versi Baru" agar perubahan Anda tersimpan '
            .'tanpa mengubah perhitungan HPP produksi yang sudah berjalan.',
            $recipeName,
            $version,
            $reason,
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
                'recipe' => [
                    'locked' => true,
                    'reason' => $this->reason,
                    'suggested_action' => 'new_version',
                ],
            ],
        ], 422);
    }
}
