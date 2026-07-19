<?php

namespace App\Http\Requests\User;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UpdateUserRequest extends FormRequest
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
        $userId = $this->route('user')?->id;

        return [
            'name' => ['sometimes', 'required', 'string', 'min:3', 'max:100'],
            'email' => [
                'sometimes', 'required', 'string', 'email', 'max:255',
                Rule::unique('users', 'email')->ignore($userId)->whereNull('deleted_at'),
            ],
            // Kata sandi hanya diproses bila diisi — form edit boleh dikosongkan.
            'password' => ['nullable', 'string', 'confirmed', Password::min(8)->letters()->numbers()],
            'role' => ['sometimes', 'required', Rule::in(UserRole::values())],
            'phone' => ['nullable', 'string', 'regex:/^[0-9+\-\s()]{8,20}$/'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'name' => 'nama',
            'email' => 'email',
            'password' => 'kata sandi',
            'role' => 'peran',
            'phone' => 'nomor telepon',
            'is_active' => 'status aktif',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.unique' => 'Email ini sudah terdaftar pada pengguna lain.',
            'phone.regex' => 'Format nomor telepon tidak valid.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('email')) {
            $this->merge(['email' => mb_strtolower(trim((string) $this->input('email')))]);
        }
    }
}
