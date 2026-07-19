<?php

namespace App\Http\Requests\MasterData;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class RecipeRequest extends FormRequest
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
                Rule::exists('products', 'id')->whereNull('deleted_at'),
            ],

            'name' => ['required', 'string', 'min:3', 'max:150'],

            // Yield adalah pembagi di seluruh perhitungan resep — nol akan
            // menghasilkan pembagian dengan nol pada explode() dan costPerUnit().
            'yield_quantity' => ['required', 'numeric', 'min:0.01', 'max:100000'],
            'yield_unit' => ['nullable', 'string', 'max:20'],

            'description' => ['nullable', 'string', 'max:1000'],
            'instructions' => ['nullable', 'string', 'max:5000'],
            'is_active' => ['sometimes', 'boolean'],

            // Resep tanpa bahan tidak ada gunanya, jadi minimal satu baris.
            'items' => ['required', 'array', 'min:1'],
            'items.*.ingredient_id' => [
                'required', 'integer',
                Rule::exists('ingredients', 'id')->whereNull('deleted_at'),
            ],
            'items.*.quantity' => ['required', 'numeric', 'min:0.0001', 'max:10000000'],
            'items.*.waste_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
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

            // Bahan ganda dalam satu resep akan melanggar unique(recipe_id,
            // ingredient_id) di database. Ditangkap di sini supaya pesannya
            // menyebut bahan mana yang bermasalah, bukan error SQL mentah.
            $ids = array_column($items, 'ingredient_id');
            $duplikat = array_diff_assoc($ids, array_unique($ids));

            if ($duplikat !== []) {
                foreach (array_keys($duplikat) as $index) {
                    $v->errors()->add(
                        "items.{$index}.ingredient_id",
                        'Bahan ini sudah ada di daftar. Ubah takarannya, jangan menambah baris baru.'
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
            'product_id' => 'produk',
            'name' => 'nama resep',
            'yield_quantity' => 'hasil produksi',
            'yield_unit' => 'satuan hasil',
            'items' => 'daftar bahan',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'items.required' => 'Resep harus memiliki minimal satu bahan baku.',
            'items.min' => 'Resep harus memiliki minimal satu bahan baku.',
            'items.*.ingredient_id.required' => 'Bahan baku wajib dipilih.',
            'items.*.ingredient_id.exists' => 'Bahan baku yang dipilih tidak ditemukan.',
            'items.*.quantity.required' => 'Takaran wajib diisi.',
            'items.*.quantity.min' => 'Takaran harus lebih besar dari nol.',
            'items.*.waste_percent.max' => 'Persentase susut tidak masuk akal jika 100% atau lebih.',
            'yield_quantity.min' => 'Hasil produksi harus lebih besar dari nol.',
        ];
    }
}
