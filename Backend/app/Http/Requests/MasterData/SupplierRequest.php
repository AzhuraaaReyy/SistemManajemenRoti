<?php

namespace App\Http\Requests\MasterData;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SupplierRequest extends FormRequest
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
        $id = $this->route('supplier')?->id;

        return [
            'name' => [
                'required', 'string', 'min:3', 'max:150',
                Rule::unique('suppliers', 'name')->ignore($id)->whereNull('deleted_at'),
            ],
            'contact_person' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'regex:/^[0-9+\-\s()]{8,25}$/'],
            'email' => ['nullable', 'email', 'max:150'],
            'address' => ['nullable', 'string', 'max:500'],

            // Lead time nol berarti barang tersedia seketika — tidak realistis
            // untuk supplier, dan akan membuat titik pesan ulang jadi nol.
            'lead_time_days' => ['nullable', 'integer', 'min:1', 'max:365'],

            'notes' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],

            // Bahan baku yang dipasok, opsional saat membuat supplier.
            'ingredient_ids' => ['sometimes', 'array'],
            'ingredient_ids.*' => ['integer', 'exists:ingredients,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'name' => 'nama supplier',
            'contact_person' => 'nama kontak',
            'phone' => 'nomor telepon',
            'email' => 'email',
            'address' => 'alamat',
            'lead_time_days' => 'lama pengiriman',
            'notes' => 'catatan',
            'ingredient_ids' => 'bahan baku yang dipasok',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.unique' => 'Supplier dengan nama ini sudah terdaftar.',
            'phone.regex' => 'Format nomor telepon tidak valid.',
            'lead_time_days.min' => 'Lama pengiriman minimal 1 hari.',
            'ingredient_ids.*.exists' => 'Salah satu bahan baku yang dipilih tidak ditemukan.',
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('email')) {
            $email = trim((string) $this->input('email'));
            $this->merge(['email' => $email === '' ? null : mb_strtolower($email)]);
        }
    }
}
