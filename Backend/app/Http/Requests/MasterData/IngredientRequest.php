<?php

namespace App\Http\Requests\MasterData;

use App\Enums\CategoryType;
use App\Enums\UnitPreset;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class IngredientRequest extends FormRequest
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
        $id = $this->route('ingredient')?->id;
        $isUpdate = $this->isMethod('PUT') || $this->isMethod('PATCH');

        return [
            'name' => [
                'required', 'string', 'min:3', 'max:150',
                Rule::unique('ingredients', 'name')->ignore($id)->whereNull('deleted_at'),
            ],

            'category_id' => [
                'nullable', 'integer',
                // Kategori bahan baku tidak boleh diisi kategori produk.
                Rule::exists('categories', 'id')
                    ->where('type', CategoryType::BAHAN_BAKU->value)
                    ->whereNull('deleted_at'),
            ],

            'default_supplier_id' => [
                'nullable', 'integer',
                Rule::exists('suppliers', 'id')->whereNull('deleted_at'),
            ],

            // Satu pilihan satuan saja. base_unit, display_unit, dan
            // conversion_factor diturunkan dari sini di controller.
            'unit' => ['required', Rule::in(UnitPreset::values())],

            // Angka di bawah ditulis dalam satuan yang dipilih di atas
            // (misal kilogram), bukan satuan dasar.
            'min_stock' => ['nullable', 'numeric', 'min:0', 'max:100000000'],
            'avg_cost' => ['nullable', 'numeric', 'min:0', 'max:1000000000'],

            // Stok awal hanya boleh diisi saat membuat. Setelah bahan ada,
            // perubahan stok wajib lewat modul Persediaan agar tercatat
            // sumbernya — lihat §2.6 DOKUMEN-PERANCANGAN.md.
            'opening_stock' => [$isUpdate ? 'prohibited' : 'nullable', 'numeric', 'min:0', 'max:100000000'],

            'shelf_life_days' => ['nullable', 'integer', 'min:1', 'max:3650'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],

            'supplier_ids' => ['sometimes', 'array'],
            'supplier_ids.*' => ['integer', 'exists:suppliers,id'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            // Supplier utama sebaiknya termasuk dalam daftar pemasok.
            $utama = $this->input('default_supplier_id');
            $daftar = $this->input('supplier_ids');

            if ($utama && is_array($daftar) && $daftar !== [] && ! in_array((int) $utama, array_map('intval', $daftar), true)) {
                $v->errors()->add(
                    'default_supplier_id',
                    'Supplier utama harus termasuk dalam daftar supplier yang dipilih.'
                );
            }
        });
    }

    /** Preset satuan yang dipilih pengguna. */
    public function unitPreset(): UnitPreset
    {
        return UnitPreset::from($this->input('unit'));
    }

    /**
     * Angka dalam satuan pilihan pengguna → satuan dasar untuk disimpan.
     */
    public function toBase(string $field, float $default = 0): float
    {
        return (float) ($this->input($field) ?? $default) * $this->unitPreset()->factor();
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'name' => 'nama bahan baku',
            'category_id' => 'kategori',
            'default_supplier_id' => 'supplier utama',
            'unit' => 'satuan',
            'opening_stock' => 'stok awal',
            'min_stock' => 'stok minimum',
            'avg_cost' => 'harga rata-rata',
            'shelf_life_days' => 'umur simpan',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.unique' => 'Bahan baku dengan nama ini sudah terdaftar.',
            'category_id.exists' => 'Kategori yang dipilih bukan kategori bahan baku.',
            'unit.in' => 'Satuan yang dipilih tidak dikenali.',
            'opening_stock.prohibited' => 'Stok tidak dapat diubah dari sini. Gunakan modul Persediaan agar setiap perubahan tercatat sumbernya.',
        ];
    }
}
