<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Membatasi rute berdasarkan peran pengguna.
 *
 * Pemakaian: ->middleware('role:owner') atau ->middleware('role:owner,admin_gudang')
 */
class RoleMiddleware
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Anda belum masuk atau sesi telah berakhir.',
            ], 401);
        }

        if (! $user->hasRole(...$roles)) {
            return response()->json([
                'success' => false,
                'message' => 'Peran Anda ('.$user->role->label().') tidak memiliki akses ke fitur ini.',
            ], 403);
        }

        return $next($request);
    }
}
