<?php

namespace App\Http\Requests\Purchase;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ReceiveGoodsRequest extends FormRequest
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
        $poId = $this->route('purchase_order')?->id;

        return [
            'receipt_date' => ['required', 'date', 'before_or_equal:today'],
            'delivery_note_number' => ['nullable', 'string', 'max:60'],
            'notes' => ['nullable', 'string', 'max:1000'],

            // Dikirim klien agar penerimaan yang sama tidak tercatat dua kali
            // ketika permintaan diulang karena jaringan lambat.
            'idempotency_key' => ['nullable', 'string', 'max:120'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.purchase_order_item_id' => [
                'required', 'integer',
                // Baris harus benar-benar milik pesanan ini — mencegah
                // penerimaan disusupkan ke baris pesanan lain.
                Rule::exists('purchase_order_items', 'id')->where('purchase_order_id', $poId),
            ],
            // Dalam satuan pesan (kg/L/pcs). Nol berarti barang ini belum datang.
            'items.*.quantity' => ['required', 'numeric', 'min:0', 'max:10000000'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0', 'max:1000000000'],
            'items.*.expiry_date' => ['nullable', 'date', 'after:today'],
            'items.*.batch_number' => ['nullable', 'string', 'max:60'],
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

            // Penerimaan tanpa satu pun barang berjumlah > 0 hanya akan
            // membuat dokumen kosong yang membingungkan riwayat.
            $adaIsi = collect($items)->contains(fn ($r) => (float) ($r['quantity'] ?? 0) > 0);

            if (! $adaIsi) {
                $v->errors()->add(
                    'items',
                    'Isi jumlah minimal satu barang. Bila belum ada yang datang, tutup saja dialog ini.'
                );
            }
        });
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'receipt_date' => 'tanggal terima',
            'delivery_note_number' => 'nomor surat jalan',
            'items' => 'daftar barang',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'receipt_date.before_or_equal' => 'Tanggal terima tidak boleh di masa depan.',
            'items.*.purchase_order_item_id.exists' => 'Baris barang tidak ditemukan pada pesanan ini.',
            'items.*.expiry_date.after' => 'Tanggal kedaluwarsa harus setelah hari ini. Bila barang sudah kedaluwarsa, jangan diterima.',
        ];
    }
}
