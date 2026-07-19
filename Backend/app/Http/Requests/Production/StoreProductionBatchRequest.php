<?php

namespace App\Http\Requests\Production;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProductionBatchRequest extends FormRequest
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
            'product_id' => [
                'required', 'integer',
                Rule::exists('products', 'id')->whereNull('deleted_at')->where('is_active', true),
            ],
            'quantity' => ['required', 'numeric', 'min:0.01', 'max:1000000'],
            'notes' => ['nullable', 'string', 'max:1000'],

            // Mencegah batch ganda bila permintaan terkirim dua kali.
            'idempotency_key' => ['nullable', 'string', 'max:120'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'product_id' => 'produk',
            'quantity' => 'jumlah produksi',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'product_id.required' => 'Produk yang akan diproduksi wajib dipilih.',
            'product_id.exists' => 'Produk tidak ditemukan atau sudah tidak aktif.',
            'quantity.required' => 'Jumlah produksi wajib diisi.',
            'quantity.min' => 'Jumlah produksi harus lebih besar dari nol.',
        ];
    }
}
