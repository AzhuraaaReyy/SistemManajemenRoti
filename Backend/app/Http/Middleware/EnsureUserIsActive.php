<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Tymon\JWTAuth\Facades\JWTAuth;

/**
 * Menolak pengguna yang akunnya dinonaktifkan setelah token diterbitkan.
 *
 * Tanpa ini, menonaktifkan seorang karyawan tidak berpengaruh apa pun sampai
 * tokennya kedaluwarsa — bisa berjam-jam kemudian. Pemeriksaan dilakukan pada
 * setiap permintaan, dan tokennya sekalian dibatalkan.
 */
class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->is_active) {
            try {
                JWTAuth::invalidate(JWTAuth::getToken());
            } catch (\Throwable) {
                // Token mungkin sudah tidak valid — abaikan, tujuan utamanya
                // tetap tercapai karena permintaan ini ditolak.
            }

            return response()->json([
                'success' => false,
                'message' => 'Akun Anda telah dinonaktifkan. Hubungi Owner untuk mengaktifkan kembali.',
            ], 403);
        }

        return $next($request);
    }
}
