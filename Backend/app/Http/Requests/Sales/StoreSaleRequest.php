<?php

namespace App\Http\Requests\Sales;

use App\Enums\PaymentMethod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSaleRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', Rule::exists('products', 'id')->whereNull('deleted_at')],
            'items.*.quantity' => ['required', 'numeric', 'min:0.01', 'max:100000'],

            'discount_type' => ['nullable', Rule::in(['none', 'percent', 'amount'])],
            'discount_value' => ['nullable', 'numeric', 'min:0'],

            'payment_method' => ['required', Rule::in(PaymentMethod::values())],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],

            'customer_name' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:255'],

            // Melindungi dari tekan-Bayar-dua-kali saat jaringan lambat.
            'idempotency_key' => ['nullable', 'string', 'max:100'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'items.required' => 'Keranjang masih kosong. Tambahkan minimal satu produk.',
            'items.min' => 'Keranjang masih kosong. Tambahkan minimal satu produk.',
            'items.*.product_id.required' => 'Produk wajib dipilih.',
            'items.*.product_id.exists' => 'Salah satu produk di keranjang sudah tidak tersedia.',
            'items.*.quantity.required' => 'Jumlah setiap produk wajib diisi.',
            'items.*.quantity.min' => 'Jumlah produk harus lebih besar dari nol.',

            'payment_method.required' => 'Metode pembayaran wajib dipilih.',
            'payment_method.in' => 'Metode pembayaran tidak dikenali.',

            'discount_value.min' => 'Nilai diskon tidak boleh negatif.',
            'paid_amount.min' => 'Uang yang diterima tidak boleh negatif.',
        ];
    }
}
