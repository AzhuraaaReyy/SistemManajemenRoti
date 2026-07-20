<?php

namespace App\Exports;

use Illuminate\Support\Carbon;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Satu eksportir Excel untuk KETUJUH laporan.
 *
 * Tidak ada kelas ekspor per jenis laporan. Bentuk berkasnya seluruhnya
 * diturunkan dari definisi kolom di ReportType — jadi menambah kolom pada
 * sebuah laporan otomatis ikut ke Excel-nya, tanpa menyentuh berkas ini.
 *
 * Yang membuatnya benar-benar berguna dibanding CSV:
 *   - angka tersimpan sebagai ANGKA, bukan teks, jadi bisa dijumlah di Excel
 *   - rupiah berformat mata uang Indonesia
 *   - kepala tabel dibekukan, jadi tetap terlihat saat digulir
 *   - baris total tebal di bawah
 */
class ReportExport implements FromArray, WithColumnFormatting, WithColumnWidths, WithEvents, WithTitle
{
    /** Baris tempat kepala tabel berada — di bawah blok judul dan ringkasan. */
    private int $barisHeader = 1;

    /** @param array<string, mixed> $report */
    public function __construct(private array $report)
    {
        /*
        | `total` dikirim ReportService sebagai objek agar bentuk JSON-nya
        | seragam. Di sini ia dikembalikan menjadi array biasa, karena
        | `empty()` atas objek kosong bernilai FALSE — tanpa langkah ini,
        | laporan yang memang tidak punya kolom penjumlah (Mutasi Stok) akan
        | mendapat baris TOTAL kosong yang menyesatkan.
        */
        $this->report['total'] = (array) ($report['total'] ?? []);
    }

    public function title(): string
    {
        // Nama sheet Excel maksimal 31 karakter dan tidak boleh memuat
        // beberapa tanda baca; dipangkas supaya berkasnya tidak gagal dibuka.
        return mb_substr(str_replace(['/', '\\', '?', '*', ':', '[', ']'], '', $this->report['title']), 0, 31);
    }

    /**
     * @return array<int, array<int, mixed>>
     */
    public function array(): array
    {
        $kolom = $this->report['columns'];
        $baris = [];

        // --- Kepala laporan ---
        $baris[] = [$this->report['title']];
        $baris[] = [$this->report['periode']];
        $baris[] = ['Dibuat '.Carbon::parse($this->report['dibuat_pada'])->translatedFormat('d F Y H:i')];

        /*
        | Baris pemisah ditulis [''], BUKAN [].
        |
        | PhpSpreadsheet membuang baris yang benar-benar kosong, sehingga
        | seluruh baris di bawahnya naik. Akibatnya nomor baris yang dihitung
        | di sini meleset dari nomor baris sebenarnya — gaya kepala tabel
        | mendarat di baris data, kepala tabel yang asli tampil polos, dan
        | pembekuan panel berhenti di tempat yang salah.
        |
        | Satu sel berisi teks kosong sudah cukup membuat barisnya nyata.
        */
        $baris[] = [''];

        // --- Ringkasan ---
        foreach ($this->report['summary'] as $label => $nilai) {
            $baris[] = [$label, is_numeric($nilai) ? (float) $nilai : $nilai];
        }

        $baris[] = [''];

        // --- Kepala tabel ---
        $this->barisHeader = count($baris) + 1;
        $baris[] = array_column($kolom, 'label');

        // --- Isi ---
        foreach ($this->report['rows'] as $r) {
            $baris[] = array_map(fn ($k) => $this->nilaiSel($r[$k['key']] ?? null, $k['format'] ?? 'text'), $kolom);
        }

        // --- Baris total ---
        if (! empty($this->report['total'])) {
            $total = ['TOTAL'];

            foreach (array_slice($kolom, 1) as $k) {
                $total[] = $this->report['total'][$k['key']] ?? null;
            }

            $baris[] = $total;
        }

        return $baris;
    }

    /**
     * Nilai apa adanya untuk sel.
     *
     * Angka dikembalikan sebagai float — inilah bedanya dengan CSV: kolom yang
     * berisi angka sungguhan bisa langsung dijumlah dan disortir di Excel,
     * bukan sekadar teks yang kebetulan berbentuk angka.
     */
    private function nilaiSel(mixed $nilai, string $format): mixed
    {
        if ($nilai === null) {
            return '—';
        }

        return match ($format) {
            'money', 'number', 'percent' => is_numeric($nilai) ? (float) $nilai : $nilai,
            'date' => $nilai ? Carbon::parse($nilai)->format('d/m/Y') : '—',
            'datetime' => $nilai ? Carbon::parse($nilai)->format('d/m/Y H:i') : '—',
            default => (string) $nilai,
        };
    }

    /**
     * @return array<string, string>
     */
    public function columnFormats(): array
    {
        $format = [];

        foreach ($this->report['columns'] as $i => $k) {
            $huruf = $this->huruf($i);

            $format[$huruf] = match ($k['format'] ?? 'text') {
                'money' => '"Rp"#,##0',
                'number' => '#,##0.##',
                'percent' => '0.0"%"',
                default => NumberFormat::FORMAT_TEXT,
            };
        }

        return $format;
    }

    /**
     * @return array<string, int>
     */
    public function columnWidths(): array
    {
        $lebar = [];

        foreach ($this->report['columns'] as $i => $k) {
            $lebar[$this->huruf($i)] = match ($k['format'] ?? 'text') {
                'money' => 16,
                'number', 'percent' => 12,
                'datetime' => 18,
                'date' => 13,
                // Kolom teks diberi lebar menurut panjang judulnya, dibatasi
                // 34 supaya kolom catatan yang panjang tidak mendorong seluruh
                // tabel keluar dari halaman.
                default => min(max(mb_strlen($k['label']) + 4, 14), 34),
            };
        }

        return $lebar;
    }

    /**
     * @return array<string, callable>
     */
    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();

                $jumlahKolom = count($this->report['columns']);
                $kolomAkhir = $this->huruf($jumlahKolom - 1);
                $barisAkhir = $this->barisHeader + count($this->report['rows']);

                $this->gayaJudul($sheet, $kolomAkhir);
                $this->gayaHeader($sheet, $kolomAkhir);
                $this->gayaIsi($sheet, $kolomAkhir, $barisAkhir);
                $this->gayaTotal($sheet, $kolomAkhir, $barisAkhir);

                // Kepala tabel dibekukan supaya judul kolom tetap terlihat
                // ketika laporan seribu baris digulir ke bawah.
                $sheet->freezePane('A'.($this->barisHeader + 1));
            },
        ];
    }

    private function gayaJudul(Worksheet $sheet, string $kolomAkhir): void
    {
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(15);
        $sheet->getStyle('A2:A3')->getFont()->setSize(10)->getColor()->setRGB('6B7280');

        $barisRingkasan = 5;
        $jumlah = count($this->report['summary']);

        if ($jumlah > 0) {
            $sheet->getStyle('A'.$barisRingkasan.':A'.($barisRingkasan + $jumlah - 1))
                ->getFont()->setBold(true);
            $sheet->getStyle('B'.$barisRingkasan.':B'.($barisRingkasan + $jumlah - 1))
                ->getNumberFormat()->setFormatCode('#,##0.##');
        }
    }

    private function gayaHeader(Worksheet $sheet, string $kolomAkhir): void
    {
        $rentang = 'A'.$this->barisHeader.':'.$kolomAkhir.$this->barisHeader;

        $sheet->getStyle($rentang)->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => '78716C'],
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
                'wrapText' => true,
            ],
        ]);

        $sheet->getRowDimension($this->barisHeader)->setRowHeight(26);
    }

    private function gayaIsi(Worksheet $sheet, string $kolomAkhir, int $barisAkhir): void
    {
        if ($barisAkhir <= $this->barisHeader) {
            return;
        }

        $rentang = 'A'.($this->barisHeader + 1).':'.$kolomAkhir.$barisAkhir;

        $sheet->getStyle($rentang)->applyFromArray([
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => 'E7E5E4'],
                ],
            ],
        ]);

        // Perataan mengikuti definisi kolom, sama dengan tabel di layar.
        foreach ($this->report['columns'] as $i => $k) {
            if (($k['align'] ?? 'left') !== 'right') {
                continue;
            }

            $huruf = $this->huruf($i);

            $sheet->getStyle($huruf.($this->barisHeader + 1).':'.$huruf.$barisAkhir)
                ->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        }
    }

    private function gayaTotal(Worksheet $sheet, string $kolomAkhir, int $barisAkhir): void
    {
        if (empty($this->report['total'])) {
            return;
        }

        $baris = $barisAkhir + 1;

        $sheet->getStyle('A'.$baris.':'.$kolomAkhir.$baris)->applyFromArray([
            'font' => ['bold' => true],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'F5F5F4'],
            ],
            'borders' => [
                'top' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => '78716C']],
            ],
        ]);
    }

    /** Indeks kolom (0-based) → huruf Excel: 0 → A, 26 → AA. */
    private function huruf(int $index): string
    {
        $huruf = '';

        for ($i = $index; $i >= 0; $i = intdiv($i, 26) - 1) {
            $huruf = chr(65 + ($i % 26)).$huruf;
        }

        return $huruf;
    }
}
