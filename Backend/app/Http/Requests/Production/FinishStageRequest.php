<?php

namespace App\Http\Requests\Production;

use App\Enums\ProductionStage;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validasi penyelesaian satu tahap.
 *
 * Tahap terakhir (Packaging) diperlakukan berbeda: menyelesaikannya berarti
 * menutup batch dan menambah stok produk jadi, jadi jumlah hasil wajib diisi.
 */
class FinishStageRequest extends FormRequest
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
        $tahapTerakhir = $this->stageIsLast();

        return [
            'notes' => ['nullable', 'string', 'max:255'],
            'idempotency_key' => ['nullable', 'string', 'max:120'],

            // Wajib hanya pada tahap Packaging.
            'good_quantity' => [$tahapTerakhir ? 'required' : 'nullable', 'numeric', 'min:0', 'max:1000000'],
            'reject_quantity' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
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
            'good_quantity.required' => 'Menyelesaikan tahap Packaging berarti produksi selesai, '
                .'jadi jumlah hasil layak jual wajib diisi. Isi 0 bila seluruhnya gagal.',
            'good_quantity.min' => 'Jumlah hasil tidak boleh negatif.',
        ];
    }

    private function stageIsLast(): bool
    {
        $stage = ProductionStage::tryFrom((string) $this->route('stage'));

        return $stage?->isLast() ?? false;
    }
}
