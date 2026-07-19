<?php

namespace App\Traits;

use Illuminate\Http\JsonResponse;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * Bentuk respons API yang seragam.
 *
 * Setiap respons selalu punya `success` dan `message`, sehingga frontend
 * cukup menulis satu penangan untuk semua endpoint.
 */
trait ApiResponse
{
    protected function success(mixed $data = null, string $message = 'Berhasil.', int $status = 200): JsonResponse
    {
        $payload = ['success' => true, 'message' => $message];

        if ($data !== null) {
            $payload['data'] = $data;
        }

        return response()->json($payload, $status);
    }

    protected function error(string $message = 'Permintaan gagal diproses.', int $status = 400, ?array $errors = null): JsonResponse
    {
        $payload = ['success' => false, 'message' => $message];

        if ($errors !== null) {
            $payload['errors'] = $errors;
        }

        return response()->json($payload, $status);
    }

    /**
     * Respons daftar berhalaman dengan metadata paginasi yang dipisah rapi.
     */
    protected function paginated(LengthAwarePaginator $paginator, mixed $items = null, string $message = 'Berhasil.'): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $items ?? $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
        ]);
    }
}
