<?php

namespace App\Http\Requests\Profile;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class ChangePasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // 'current_password' memverifikasi lawan kata sandi pengguna yang
            // sedang masuk — mencegah pengambilalihan sesi yang ditinggal terbuka.
            'current_password' => ['required', 'string', 'current_password:api'],
            'password' => [
                'required', 'string', 'confirmed', 'different:current_password',
                Password::min(8)->letters()->numbers(),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'current_password' => 'kata sandi saat ini',
            'password' => 'kata sandi baru',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'current_password.current_password' => 'Kata sandi saat ini salah.',
            'password.different' => 'Kata sandi baru harus berbeda dari kata sandi lama.',
            'password.confirmed' => 'Konfirmasi kata sandi tidak cocok.',
        ];
    }
}
