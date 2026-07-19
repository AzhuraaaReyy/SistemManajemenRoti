<?php

namespace App\Http\Requests\Purchase;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class PurchaseOrderRequest extends FormRequest
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
            'supplier_id' => [
                'required', 'integer',
                Rule::exists('suppliers', 'id')->whereNull('deleted_at'),
            ],

            'order_date' => ['required', 'date', 'before_or_equal:today'],
            'expected_date' => ['nullable', 'date', 'after_or_equal:order_date'],

            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'shipping_cost' => ['nullable', 'numeric', 'min:0'],
            'tax_amount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:1000'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.ingredient_id' => [
                'required', 'integer',
                Rule::exists('ingredients', 'id')->whereNull('deleted_at'),
            ],
            // Diisi dalam satuan pesan (kg/L/pcs), bukan satuan dasar.
            'items.*.quantity' => ['required', 'numeric', 'min:0.0001', 'max:10000000'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0', 'max:1000000000'],
            'items.*.discount_amount' => ['nullable', 'numeric', 'min:0'],
            'items.*.note' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            $items = $this->input('items', []);

            if (! is_array($items)) {
                return;
            }

            // Bahan ganda melanggar unique(purchase_order_id, ingredient_id)
            // dan membuat penerimaan barang ambigu — baris mana yang diisi?
            $ids = array_column($items, 'ingredient_id');
            $duplikat = array_diff_assoc($ids, array_unique($ids));

            foreach (array_keys($duplikat) as $index) {
                $v->errors()->add(
                    "items.{$index}.ingredient_id",
                    'Bahan ini sudah ada di daftar. Ubah jumlahnya, jangan menambah baris baru.'
                );
            }

            // Diskon per baris tidak boleh melebihi nilai barisnya.
            foreach ($items as $i => $row) {
                $nilai = (float) ($row['quantity'] ?? 0) * (float) ($row['unit_price'] ?? 0);
                $diskon = (float) ($row['discount_amount'] ?? 0);

                if ($diskon > $nilai + 0.001) {
                    $v->errors()->add(
                        "items.{$i}.discount_amount",
                        'Diskon tidak boleh melebihi nilai barisnya.'
                    );
                }
            }
        });
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'supplier_id' => 'supplier',
            'order_date' => 'tanggal pesan',
            'expected_date' => 'perkiraan tiba',
            'discount_amount' => 'diskon',
            'shipping_cost' => 'ongkos kirim',
            'tax_amount' => 'pajak',
            'items' => 'daftar barang',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'order_date.before_or_equal' => 'Tanggal pesan tidak boleh di masa depan.',
            'expected_date.after_or_equal' => 'Perkiraan tiba tidak boleh sebelum tanggal pesan.',
            'items.required' => 'Pesanan harus memiliki minimal satu barang.',
            'items.min' => 'Pesanan harus memiliki minimal satu barang.',
            'items.*.ingredient_id.required' => 'Bahan baku wajib dipilih.',
            'items.*.quantity.required' => 'Jumlah wajib diisi.',
            'items.*.quantity.min' => 'Jumlah harus lebih besar dari nol.',
            'items.*.unit_price.required' => 'Harga wajib diisi.',
        ];
    }
}
