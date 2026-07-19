<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Profile\ChangePasswordRequest;
use App\Http\Requests\Profile\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Models\ActivityLog;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class ProfileController extends Controller
{
    use ApiResponse;

    /**
     * GET /api/v1/profile
     */
    public function show(Request $request): JsonResponse
    {
        return $this->success(
            ['user' => new UserResource($request->user())],
            'Profil berhasil diambil.'
        );
    }

    /**
     * POST /api/v1/profile
     *
     * Memakai POST (bukan PUT) karena membawa unggahan berkas multipart.
     */
    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->safe()->except('avatar');

        if ($request->hasFile('avatar')) {
            // Hapus foto lama supaya folder penyimpanan tidak menumpuk berkas
            // yang tidak lagi dirujuk siapa pun.
            if ($user->avatar) {
                Storage::disk('public')->delete($user->avatar);
            }

            $data['avatar'] = $request->file('avatar')->store('avatars', 'public');
        }

        $user->update($data);

        ActivityLog::record('profil_diperbarui', 'Memperbarui data profil', $user, $user, $request);

        return $this->success(
            ['user' => new UserResource($user->fresh())],
            'Profil berhasil diperbarui.'
        );
    }

    /**
     * PUT /api/v1/profile/password
     */
    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $user = $request->user();

        $user->update(['password' => $request->input('password')]);

        ActivityLog::record('ganti_password', 'Mengubah kata sandi sendiri', $user, $user, $request);

        // Token lama dimatikan agar sesi lain yang mungkin dibajak ikut tertutup.
        // Frontend langsung memakai token baru ini tanpa perlu login ulang.
        $tokenBaru = Auth::guard('api')->login($user);

        return $this->success([
            'access_token' => $tokenBaru,
            'token_type' => 'bearer',
            'expires_in' => (int) config('jwt.ttl', 60) * 60,
        ], 'Kata sandi berhasil diubah.');
    }

    /**
     * DELETE /api/v1/profile/avatar
     */
    public function deleteAvatar(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->avatar) {
            Storage::disk('public')->delete($user->avatar);
            $user->update(['avatar' => null]);
        }

        return $this->success(
            ['user' => new UserResource($user->fresh())],
            'Foto profil berhasil dihapus.'
        );
    }

    /**
     * GET /api/v1/profile/activities
     *
     * Riwayat aktivitas milik pengguna sendiri — berguna untuk melihat
     * "apakah ada yang masuk ke akun saya?".
     */
    public function activities(Request $request): JsonResponse
    {
        $logs = $request->user()
            ->activityLogs()
            ->latest()
            ->paginate(15);

        return $this->paginated(
            $logs,
            collect($logs->items())->map(fn ($log) => [
                'id' => $log->id,
                'action' => $log->action,
                'description' => $log->description,
                'ip_address' => $log->ip_address,
                'created_at' => $log->created_at->toIso8601String(),
            ]),
            'Riwayat aktivitas berhasil diambil.'
        );
    }
}
