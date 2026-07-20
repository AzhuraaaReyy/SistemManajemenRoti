<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\User\StoreUserRequest;
use App\Http\Requests\User\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\ActivityLog;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    use ApiResponse;

    /**
     * GET /api/v1/users
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', Rule::in(UserRole::values())],
            'status' => ['nullable', Rule::in(['aktif', 'nonaktif'])],
            'sort_by' => ['nullable', Rule::in(['name', 'email', 'role', 'created_at', 'last_login_at'])],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $users = User::query()
            ->search($validated['search'] ?? null)
            ->when($validated['role'] ?? null, fn ($q, $role) => $q->where('role', $role))
            ->when(
                isset($validated['status']),
                fn ($q) => $q->where('is_active', $validated['status'] === 'aktif')
            )
            ->orderBy($validated['sort_by'] ?? 'created_at', $validated['sort_dir'] ?? 'desc')
            ->paginate($validated['per_page'] ?? 10)
            ->withQueryString();

        return $this->paginated(
            $users,
            UserResource::collection($users->items()),
            'Daftar pengguna berhasil diambil.'
        );
    }

    /**
     * GET /api/v1/users/statistics
     */
    public function statistics(): JsonResponse
    {
        $perRole = User::query()
            ->selectRaw('role, COUNT(*) as jumlah')
            ->groupBy('role')
            ->pluck('jumlah', 'role');

        return $this->success([
            'total' => User::count(),
            'aktif' => User::where('is_active', true)->count(),
            'nonaktif' => User::where('is_active', false)->count(),
            /*
            | Peran usang hanya ditampilkan bila MASIH ada penghuninya.
            |
            | Menampilkannya selalu berarti sebuah baris "Admin Produksi: 0"
            | menetap di layar statistik selamanya; menyembunyikannya selalu
            | berarti akun yang tertinggal di peran itu tidak pernah terlihat.
            | Yang benar adalah muncul tepat ketika ada yang perlu dibereskan.
            */
            'per_peran' => collect(UserRole::cases())
                ->filter(fn (UserRole $role) => $role->isAssignable() || ($perRole[$role->value] ?? 0) > 0)
                ->map(fn (UserRole $role) => [
                    'role' => $role->value,
                    'label' => $role->label(),
                    'jumlah' => (int) ($perRole[$role->value] ?? 0),
                ])->values(),
        ], 'Statistik pengguna berhasil diambil.');
    }

    /**
     * POST /api/v1/users
     */
    public function store(StoreUserRequest $request): JsonResponse
    {
        $user = User::create([
            ...$request->safe()->except('password_confirmation'),
            'is_active' => $request->boolean('is_active', true),
        ]);

        ActivityLog::record(
            'user_dibuat',
            "Membuat pengguna baru: {$user->name} ({$user->role->label()})",
            $request->user(), $user, $request
        );

        return $this->success(
            ['user' => new UserResource($user)],
            "Pengguna {$user->name} berhasil ditambahkan.",
            201
        );
    }

    /**
     * GET /api/v1/users/{user}
     */
    public function show(User $user): JsonResponse
    {
        return $this->success(
            ['user' => new UserResource($user)],
            'Detail pengguna berhasil diambil.'
        );
    }

    /**
     * PUT /api/v1/users/{user}
     */
    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        // Owner terakhir tidak boleh diturunkan perannya — kalau terjadi, tidak
        // ada seorang pun yang bisa mengelola pengguna lagi dan sistem terkunci.
        if ($this->akanMenghapusOwnerTerakhir($user, $request->input('role'), $request->boolean('is_active', $user->is_active))) {
            return $this->error(
                'Tindakan ini akan menyisakan sistem tanpa Owner aktif. Tunjuk Owner lain terlebih dahulu.',
                422
            );
        }

        $data = $request->safe()->except(['password', 'password_confirmation']);

        if ($request->filled('password')) {
            $data['password'] = $request->input('password');
        }

        $user->update($data);

        ActivityLog::record(
            'user_diperbarui',
            "Memperbarui data pengguna: {$user->name}",
            $request->user(), $user, $request
        );

        return $this->success(
            ['user' => new UserResource($user->fresh())],
            "Data pengguna {$user->name} berhasil diperbarui."
        );
    }

    /**
     * PATCH /api/v1/users/{user}/toggle-active
     */
    public function toggleActive(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return $this->error('Anda tidak dapat menonaktifkan akun Anda sendiri.', 422);
        }

        if ($this->akanMenghapusOwnerTerakhir($user, $user->role->value, ! $user->is_active)) {
            return $this->error(
                'Tindakan ini akan menyisakan sistem tanpa Owner aktif. Tunjuk Owner lain terlebih dahulu.',
                422
            );
        }

        $user->update(['is_active' => ! $user->is_active]);

        $status = $user->is_active ? 'diaktifkan' : 'dinonaktifkan';

        ActivityLog::record(
            'user_status_diubah',
            "Pengguna {$user->name} {$status}",
            $request->user(), $user, $request
        );

        return $this->success(
            ['user' => new UserResource($user)],
            "Pengguna {$user->name} berhasil {$status}."
        );
    }

    /**
     * DELETE /api/v1/users/{user}
     *
     * Soft delete: baris tetap ada agar riwayat transaksi yang menunjuk ke
     * pengguna ini tidak menjadi yatim. Lihat §4.2 (S12) dokumen perancangan.
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return $this->error('Anda tidak dapat menghapus akun Anda sendiri.', 422);
        }

        if ($this->akanMenghapusOwnerTerakhir($user, null, false)) {
            return $this->error(
                'Owner aktif terakhir tidak dapat dihapus. Tunjuk Owner lain terlebih dahulu.',
                422
            );
        }

        $nama = $user->name;

        ActivityLog::record(
            'user_dihapus',
            "Menghapus pengguna: {$nama}",
            $request->user(), $user, $request
        );

        $user->delete();

        return $this->success(null, "Pengguna {$nama} berhasil dihapus.");
    }

    /**
     * Apakah perubahan ini menyisakan sistem tanpa satu pun Owner aktif?
     *
     * @param  string|null  $peranBaru  null berarti pengguna akan dihapus
     */
    private function akanMenghapusOwnerTerakhir(User $user, ?string $peranBaru, bool $tetapAktif): bool
    {
        if (! $user->isOwner() || ! $user->is_active) {
            return false;
        }

        $masihOwnerAktif = $peranBaru === UserRole::OWNER->value && $tetapAktif;

        if ($masihOwnerAktif) {
            return false;
        }

        $ownerAktifLain = User::where('role', UserRole::OWNER->value)
            ->where('is_active', true)
            ->where('id', '!=', $user->id)
            ->exists();

        return ! $ownerAktifLain;
    }
}
