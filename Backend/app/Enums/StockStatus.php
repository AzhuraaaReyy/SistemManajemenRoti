<?php

namespace App\Enums;

/**
 * Status stok sebuah barang.
 *
 * DIHITUNG, TIDAK DISIMPAN. Tidak ada kolom `status` di tabel mana pun —
 * nilainya selalu diturunkan dari `current_stock` dibanding `min_stock` saat
 * dibutuhkan. Menyimpannya sebagai kolom berarti setiap pergerakan stok harus
 * ingat memperbaruinya, dan satu saja yang lupa membuat seluruh laporan
 * berbohong tanpa ketahuan.
 *
 * ------------------------------------------------------------------------
 * Tiga status pokok (sesuai spesifikasi Modul 6):
 *
 *   stok = 0            → HABIS    (merah)
 *   stok <= minimum     → MENIPIS  (kuning)
 *   stok >  minimum     → AMAN     (hijau)
 *
 * Lima status rinci yang dipakai sistem adalah PERINCIAN dari ketiganya,
 * bukan aturan yang berbeda:
 *
 *   HABIS   ├─ habis      stok = 0
 *   MENIPIS ├─ kritis     stok < setengah minimum   ← beli hari ini juga
 *           └─ menipis    setengah minimum … minimum
 *   AMAN    ├─ aman       minimum … 3× minimum
 *           └─ berlebih   > 3× minimum              ← modal menganggur
 *
 * Perincian ini penting saat memutuskan: bahan yang tinggal 5% dari minimum
 * dan bahan yang pas di batas minimum sama-sama "menipis", tetapi hanya yang
 * pertama yang bisa menghentikan produksi besok pagi.
 *
 * headline() mengembalikan ketiga status pokok untuk kartu ringkasan.
 */
enum StockStatus: string
{
    case HABIS = 'habis';
    case KRITIS = 'kritis';
    case MENIPIS = 'menipis';
    case AMAN = 'aman';
    case BERLEBIH = 'berlebih';

    /**
     * Menentukan status dari angka stok dan batas minimumnya.
     *
     * Inilah satu-satunya tempat aturan ini ditulis. Sebelumnya rumus yang
     * sama ada di Ingredient dan Product — dan keduanya sudah sempat berbeda:
     * Product tidak mengenal "berlebih", sehingga barang yang sama bisa
     * berstatus lain hanya karena tabelnya berbeda.
     */
    public static function classify(float $stock, float $minStock): self
    {
        return match (true) {
            $stock <= 0 => self::HABIS,
            $minStock <= 0 => self::AMAN,
            $stock < $minStock * 0.5 => self::KRITIS,
            $stock <= $minStock => self::MENIPIS,
            $stock > $minStock * 3 => self::BERLEBIH,
            default => self::AMAN,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::HABIS => 'Habis',
            self::KRITIS => 'Kritis',
            self::MENIPIS => 'Menipis',
            self::AMAN => 'Aman',
            self::BERLEBIH => 'Berlebih',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::HABIS => 'Stok kosong. Produksi yang memakainya tidak bisa jalan.',
            self::KRITIS => 'Di bawah setengah batas minimum. Perlu dibeli hari ini.',
            self::MENIPIS => 'Sudah menyentuh batas minimum. Siapkan pembelian.',
            self::AMAN => 'Stok mencukupi.',
            self::BERLEBIH => 'Lebih dari tiga kali batas minimum. Modal menganggur dan berisiko kedaluwarsa.',
        };
    }

    /** Warna lencana, seragam dengan komponen Badge di frontend. */
    public function tone(): string
    {
        return match ($this) {
            self::HABIS, self::KRITIS => 'danger',
            self::MENIPIS => 'warning',
            self::AMAN => 'success',
            self::BERLEBIH => 'info',
        };
    }

    /**
     * Status pokok untuk kartu ringkasan — habis, menipis, atau aman.
     *
     * Kritis digulung ke MENIPIS dan berlebih ke AMAN, sehingga jumlah pada
     * ketiga kartu selalu berjumlah total barang tanpa ada yang tercecer.
     */
    public function headline(): self
    {
        return match ($this) {
            self::KRITIS => self::MENIPIS,
            self::BERLEBIH => self::AMAN,
            default => $this,
        };
    }

    /**
     * Perlukah status ini memunculkan peringatan?
     *
     * Hanya arah yang memburuk. "Berlebih" memang layak diperhatikan, tetapi
     * bukan sesuatu yang harus mengganggu orang di tengah pekerjaannya.
     */
    public function isAlert(): bool
    {
        return in_array($this, [self::HABIS, self::KRITIS, self::MENIPIS], true);
    }

    /** Urutan kegentingan — dipakai mengurutkan daftar peringatan. */
    public function severity(): int
    {
        return match ($this) {
            self::HABIS => 4,
            self::KRITIS => 3,
            self::MENIPIS => 2,
            self::AMAN => 1,
            self::BERLEBIH => 0,
        };
    }

    /** Ketiga status pokok, untuk kartu ringkasan. */
    public static function headlines(): array
    {
        return [self::HABIS, self::MENIPIS, self::AMAN];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function options(): array
    {
        return array_map(fn (self $s) => [
            'value' => $s->value,
            'label' => $s->label(),
            'description' => $s->description(),
            'tone' => $s->tone(),
            'headline' => $s->headline()->value,
            'is_alert' => $s->isAlert(),
        ], self::cases());
    }

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
