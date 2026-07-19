<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Resources\UserResource;
use App\Models\ActivityLog;
use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Tymon\JWTAuth\Exceptions\JWTException;
use Tymon\JWTAuth\Facades\JWTAuth;

class AuthController extends Controller
{
    use ApiResponse;

    /**
     * POST /api/v1/auth/login
     */
    public function login(LoginRequest $request): JsonResponse
    {
        // Pembatasan laju berbasis email + IP. Tanpa ini, endpoint login adalah
        // undangan terbuka untuk menebak kata sandi secara otomatis.
        $throttleKey = Str::transliterate($request->input('email').'|'.$request->ip());

        if (RateLimiter::tooManyAttempts($throttleKey, maxAttempts: 5)) {
            $detik = RateLimiter::availableIn($throttleKey);

            return $this->error(
                "Terlalu banyak percobaan masuk. Silakan coba lagi dalam {$detik} detik.",
                429
            );
        }

        // "Ingat Saya" memperpanjang masa berlaku token, bukan menyimpan
        // kata sandi. Sesi biasa 60 menit, dengan ingat saya 30 hari.
        $ttl = $request->remembers()
            ? (int) config('jwt.remember_ttl', 43200)
            : (int) config('jwt.ttl', 60);

        try {
            $token = Auth::guard('api')->setTTL($ttl)->attempt($request->credentials());
        } catch (JWTException $e) {
            return $this->error('Gagal membuat token. Silakan coba lagi.', 500);
        }

        if (! $token) {
            RateLimiter::hit($throttleKey, decaySeconds: 900);

            ActivityLog::record(
                action: 'login_gagal',
                description: 'Percobaan masuk gagal untuk email '.$request->input('email'),
                request: $request,
            );

            // Pesan sengaja dibuat kabur — tidak menyebut apakah emailnya ada
            // atau kata sandinya yang salah, agar akun tidak bisa dipetakan.
            return $this->error('Email atau kata sandi salah.', 401);
        }

        /** @var User $user */
        $user = Auth::guard('api')->user();

        if (! $user->is_active) {
            Auth::guard('api')->logout();

            return $this->error(
                'Akun Anda telah dinonaktifkan. Hubungi Owner untuk mengaktifkan kembali.',
                403
            );
        }

        RateLimiter::clear($throttleKey);

        $user->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $request->ip(),
        ])->save();

        ActivityLog::record('login', 'Berhasil masuk ke sistem', $user, $user, $request);

        return $this->success(
            $this->tokenPayload($token, $user, $ttl),
            'Selamat datang kembali, '.$user->name.'!'
        );
    }

    /**
     * GET /api/v1/auth/me
     */
    public function me(): JsonResponse
    {
        return $this->success(
            ['user' => new UserResource(Auth::guard('api')->user())],
            'Data pengguna berhasil diambil.'
        );
    }

    /**
     * POST /api/v1/auth/refresh
     *
     * Menukar token yang hampir kedaluwarsa dengan token baru, sehingga
     * pengguna tidak tiba-tiba terlempar keluar di tengah pekerjaan.
     */
    public function refresh(): JsonResponse
    {
        try {
            $token = Auth::guard('api')->refresh();
            $user = Auth::guard('api')->setToken($token)->user();
        } catch (JWTException $e) {
            return $this->error('Sesi telah berakhir. Silakan masuk kembali.', 401);
        }

        return $this->success(
            $this->tokenPayload($token, $user, (int) config('jwt.ttl', 60)),
            'Sesi berhasil diperbarui.'
        );
    }

    /**
     * POST /api/v1/auth/logout
     */
    public function logout(Request $request): JsonResponse
    {
        $user = Auth::guard('api')->user();

        try {
            // Token dimasukkan ke daftar cekal agar benar-benar mati, bukan
            // sekadar dihapus dari sisi browser.
            Auth::guard('api')->logout(forceForever: false);
        } catch (JWTException) {
            // Token sudah tidak valid — tujuan pengguna tetap tercapai.
        }

        if ($user) {
            ActivityLog::record('logout', 'Keluar dari sistem', $user, $user, $request);
        }

        return $this->success(null, 'Anda telah keluar dari sistem.');
    }

    /**
     * POST /api/v1/auth/forgot-password
     */
    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $throttleKey = 'forgot|'.Str::transliterate($request->input('email').'|'.$request->ip());

        if (RateLimiter::tooManyAttempts($throttleKey, maxAttempts: 3)) {
            $detik = RateLimiter::availableIn($throttleKey);

            return $this->error("Terlalu banyak permintaan. Coba lagi dalam {$detik} detik.", 429);
        }

        RateLimiter::hit($throttleKey, decaySeconds: 900);

        $status = Password::sendResetLink($request->only('email'));

        // Jawaban selalu sama, ada atau tidak ada emailnya di database.
        // Membedakan keduanya akan membocorkan daftar email yang terdaftar.
        $pesan = 'Jika email tersebut terdaftar, tautan pengaturan ulang kata sandi telah kami kirim.';

        $data = null;

        // Bantuan untuk pengembangan: driver mail masih 'log', jadi tautan
        // ditampilkan langsung agar alur bisa diuji tanpa server SMTP.
        if (app()->environment('local') && $status === Password::RESET_LINK_SENT) {
            $user = User::where('email', $request->input('email'))->first();

            if ($user) {
                $data = [
                    'dev_note' => 'Hanya muncul di environment local. Email asli tercatat di storage/logs/laravel.log.',
                    'dev_reset_url' => ResetPasswordNotification::resetUrl(
                        Password::createToken($user),
                        $user->email
                    ),
                ];
            }
        }

        return $this->success($data, $pesan);
    }

    /**
     * POST /api/v1/auth/reset-password
     */
    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) use ($request) {
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                ])->save();

                ActivityLog::record(
                    'reset_password',
                    'Kata sandi diatur ulang melalui tautan email',
                    $user, $user, $request
                );
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            return $this->error(
                match ($status) {
                    Password::INVALID_TOKEN => 'Tautan tidak valid atau sudah kedaluwarsa. Silakan minta tautan baru.',
                    Password::INVALID_USER => 'Email tidak terdaftar dalam sistem.',
                    Password::RESET_THROTTLED => 'Terlalu sering meminta pengaturan ulang. Coba lagi beberapa saat lagi.',
                    default => 'Kata sandi gagal diatur ulang.',
                },
                422
            );
        }

        return $this->success(null, 'Kata sandi berhasil diperbarui. Silakan masuk dengan kata sandi baru.');
    }

    /**
     * GET /api/v1/auth/roles
     *
     * Dipakai form User Management untuk mengisi pilihan peran, supaya daftar
     * peran hanya didefinisikan di satu tempat (enum UserRole).
     */
    public function roles(): JsonResponse
    {
        return $this->success(UserRole::options(), 'Daftar peran berhasil diambil.');
    }

    /**
     * @return array<string, mixed>
     */
    private function tokenPayload(string $token, User $user, int $ttlMinutes): array
    {
        return [
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => $ttlMinutes * 60,
            'expires_at' => now()->addMinutes($ttlMinutes)->toIso8601String(),
            'user' => new UserResource($user),
        ];
    }
}
