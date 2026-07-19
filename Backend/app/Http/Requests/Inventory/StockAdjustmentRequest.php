<?php

namespace App\Http\Requests\Inventory;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Penyesuaian stok manual.
 *
 * Catatan wajib diisi dan tidak boleh sekadar satu-dua huruf. Ini bukan
 * kerewelan: seluruh rancangan ledger bertumpu pada aturan bahwa stok tidak
 * pernah berubah tanpa alasan yang bisa dibaca orang lain enam bulan kemudian.
 * Penyesuaian adalah satu-satunya jalur di mana manusia mengetik angka stok
 * secara langsung, jadi justru di sinilah alasannya paling dibutuhkan.
 */
class StockAdjustmentRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'kind' => ['required', Rule::in(['ingredient', 'product'])],
            'item_id' => ['required', 'integer', 'min:1'],

            // Hasil hitungan fisik, dalam satuan tampilan yang dilihat pengguna.
            // Konversi ke satuan dasar dilakukan controller, karena hanya di
            // sana faktor konversi barangnya diketahui.
            'physical_count' => ['required', 'numeric', 'min:0', 'max:99999999'],

            'note' => ['required', 'string', 'min:10', 'max:255'],
            'idempotency_key' => ['nullable', 'string', 'max:100'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'kind.required' => 'Jenis barang wajib dipilih.',
            'kind.in' => 'Jenis barang harus bahan baku atau produk jadi.',
            'item_id.required' => 'Barang yang disesuaikan wajib dipilih.',

            'physical_count.required' => 'Jumlah hasil hitungan fisik wajib diisi.',
            'physical_count.numeric' => 'Jumlah hasil hitungan harus berupa angka.',
            'physical_count.min' => 'Jumlah hasil hitungan tidak boleh negatif.',

            'note.required' => 'Alasan penyesuaian wajib diisi.',
            'note.min' => 'Alasan penyesuaian terlalu singkat. Tuliskan penyebabnya '
                .'agar bisa ditelusuri kemudian, misalnya "Hasil opname 19 Juli, '
                .'selisih karena tumpah saat penimbangan".',
        ];
    }
}
