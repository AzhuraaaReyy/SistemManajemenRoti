<?php

namespace App\Http\Requests\Production;

use Illuminate\Foundation\Http\FormRequest;

class CompleteProductionRequest extends FormRequest
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
            // Hasil layak jual — inilah yang menambah stok produk.
            'good_quantity' => ['required', 'numeric', 'min:0', 'max:1000000'],

            // Produk gagal: gosong, bantat, bentuknya rusak. Tidak menambah
            // stok, tetapi biayanya tetap tercatat sebagai kerugian.
            'reject_quantity' => ['nullable', 'numeric', 'min:0', 'max:1000000'],

            'notes' => ['nullable', 'string', 'max:1000'],
            'idempotency_key' => ['nullable', 'string', 'max:120'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'good_quantity' => 'jumlah hasil layak jual',
            'reject_quantity' => 'jumlah produk gagal',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'good_quantity.required' => 'Jumlah hasil layak jual wajib diisi. Isi 0 bila seluruh produksi gagal.',
            'good_quantity.min' => 'Jumlah hasil tidak boleh negatif.',
        ];
    }
}
