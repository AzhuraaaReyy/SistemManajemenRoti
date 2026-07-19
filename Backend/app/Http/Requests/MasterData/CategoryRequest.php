<?php

namespace App\Http\Requests\MasterData;

use App\Enums\CategoryType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;

class CategoryRequest extends FormRequest
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
        $id = $this->route('category')?->id;
        $type = $this->input('type');

        return [
            'type' => ['required', Rule::in(CategoryType::values())],

            // Keunikan diperiksa pada slug, bukan nama mentah, supaya
            // "Roti Manis" dan "roti  manis" dianggap sama.
            'name' => [
                'required', 'string', 'min:2', 'max:80',
                Rule::unique('categories', 'slug')
                    ->where(fn ($q) => $q->where('type', $type))
                    ->ignore($id)
                    ->whereNull('deleted_at'),
            ],

            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'type' => 'jenis kategori',
            'name' => 'nama kategori',
            'description' => 'deskripsi',
            'is_active' => 'status aktif',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.unique' => 'Kategori dengan nama ini sudah ada.',
            'type.in' => 'Jenis kategori tidak dikenali.',
        ];
    }

    protected function prepareForValidation(): void
    {
        // Slug ikut dikirim agar aturan unique di atas punya nilai pembanding
        // yang sama persis dengan yang nanti disimpan model.
        if ($this->has('name')) {
            $this->merge([
                'name' => trim((string) $this->input('name')),
                'slug' => Str::slug((string) $this->input('name')),
            ]);
        }
    }
}
