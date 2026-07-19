<?php

namespace App\Http\Requests\MasterData;

use App\Enums\CategoryType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductRequest extends FormRequest
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
        $id = $this->route('product')?->id;
        $isUpdate = $this->isMethod('PUT') || $this->isMethod('PATCH');

        return [
            'name' => [
                'required', 'string', 'min:3', 'max:150',
                Rule::unique('products', 'name')->ignore($id)->whereNull('deleted_at'),
            ],

            'category_id' => [
                'nullable', 'integer',
                Rule::exists('categories', 'id')
                    ->where('type', CategoryType::PRODUK->value)
                    ->whereNull('deleted_at'),
            ],

            'unit' => ['nullable', 'string', 'max:20'],
            'selling_price' => ['required', 'numeric', 'min:0', 'max:100000000'],

            // Sama seperti bahan baku: stok hanya boleh ditetapkan saat dibuat,
            // dan pencatatannya lewat ledger, bukan langsung ke kolom.
            'opening_stock' => [$isUpdate ? 'prohibited' : 'nullable', 'numeric', 'min:0'],
            'current_stock' => ['prohibited'],

            'min_stock' => ['nullable', 'numeric', 'min:0'],
            'description' => ['nullable', 'string', 'max:1000'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'name' => 'nama produk',
            'category_id' => 'kategori',
            'unit' => 'satuan',
            'selling_price' => 'harga jual',
            'opening_stock' => 'stok awal',
            'min_stock' => 'stok minimum',
            'description' => 'deskripsi',
            'image' => 'foto produk',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.unique' => 'Produk dengan nama ini sudah terdaftar.',
            'category_id.exists' => 'Kategori yang dipilih bukan kategori produk.',
            'opening_stock.prohibited' => 'Stok tidak dapat diubah dari sini. Stok produk jadi bertambah melalui modul Produksi.',
            'current_stock.prohibited' => 'Stok tidak dapat diubah dari sini. Stok produk jadi bertambah melalui modul Produksi.',
            'image.max' => 'Ukuran foto produk maksimal 2 MB.',
        ];
    }
}
