{{--
    Satu templat PDF untuk KETUJUH laporan.

    Bentuk tabelnya seluruhnya diturunkan dari definisi kolom di ReportType,
    sama seperti tabel di layar dan berkas Excel — jadi tidak mungkin lagi
    sebuah kolom muncul di layar tetapi hilang saat dicetak.

    Catatan dompdf: mesin ini hanya memahami CSS lama. Flexbox dan grid tidak
    didukung sama sekali, jadi tata letaknya memakai tabel dan float — bukan
    karena kuno, melainkan karena itu satu-satunya yang benar-benar terender.
--}}
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>{{ $report['title'] }}</title>

    <style>
        @page {
            margin: 14mm 10mm 16mm 10mm;
        }

        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 8.5px;
            color: #1c1917;
            margin: 0;
        }

        /* --- Kepala --- */
        .kop {
            border-bottom: 1.5px solid #78716c;
            padding-bottom: 7px;
            margin-bottom: 10px;
        }

        .kop .toko {
            font-size: 13px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }

        .kop .alamat {
            font-size: 8px;
            color: #78716c;
            margin-top: 1px;
        }

        .kop .judul {
            font-size: 11px;
            font-weight: bold;
            margin-top: 7px;
        }

        .kop .periode {
            font-size: 8.5px;
            color: #57534e;
            margin-top: 1px;
        }

        /* --- Ringkasan --- */
        table.ringkasan {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
        }

        table.ringkasan td {
            border: 1px solid #e7e5e4;
            padding: 4px 6px;
            width: 25%;
        }

        table.ringkasan .label {
            font-size: 7px;
            color: #78716c;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }

        table.ringkasan .nilai {
            font-size: 10px;
            font-weight: bold;
            margin-top: 1px;
        }

        /* --- Tabel data --- */
        table.data {
            width: 100%;
            border-collapse: collapse;
        }

        table.data thead th {
            background: #78716c;
            color: #fff;
            font-size: 7.5px;
            font-weight: bold;
            text-align: left;
            padding: 5px 4px;
            text-transform: uppercase;
            letter-spacing: 0.2px;
        }

        table.data tbody td {
            border-bottom: 0.5px solid #e7e5e4;
            padding: 4px;
            vertical-align: top;
        }

        /* Baris berselang-seling — membantu mata mengikuti satu baris sampai
           ujung kanan pada laporan berkolom banyak. */
        table.data tbody tr:nth-child(even) td {
            background: #fafaf9;
        }

        table.data tfoot td {
            border-top: 1.2px solid #78716c;
            background: #f5f5f4;
            font-weight: bold;
            padding: 5px 4px;
        }

        .kanan { text-align: right; }
        .redup { color: #a8a29e; }

        .catatan {
            margin-top: 9px;
            padding: 6px 8px;
            background: #fafaf9;
            border-left: 2px solid #d6d3d1;
            font-size: 7.5px;
            color: #57534e;
        }

        .kosong {
            padding: 26px;
            text-align: center;
            color: #78716c;
            border: 1px dashed #d6d3d1;
        }

        /* Kaki halaman dengan nomor halaman otomatis dompdf. */
        .kaki {
            position: fixed;
            bottom: -10mm;
            left: 0;
            right: 0;
            font-size: 7px;
            color: #a8a29e;
            border-top: 0.5px solid #e7e5e4;
            padding-top: 3px;
        }

        .kaki .kiri { float: left; }
        .kaki .kanan-kaki { float: right; }
    </style>
</head>
<body>

<div class="kaki">
    <span class="kiri">{{ $toko['store_name'] }} · {{ $report['title'] }}</span>
    <span class="kanan-kaki">
        Dicetak {{ \Illuminate\Support\Carbon::parse($report['dibuat_pada'])->translatedFormat('d F Y H:i') }}
        oleh {{ $pencetak }}
    </span>
</div>

<div class="kop">
    <div class="toko">{{ $toko['store_name'] }}</div>
    <div class="alamat">
        {{ $toko['store_address'] }}
        @if ($toko['store_phone']) · {{ $toko['store_phone'] }} @endif
    </div>

    <div class="judul">{{ $report['title'] }}</div>
    <div class="periode">{{ $report['periode'] }} · {{ number_format($report['row_count'], 0, ',', '.') }} baris</div>
</div>

@if (count($report['summary']) > 0)
    <table class="ringkasan">
        @foreach (array_chunk($report['summary'], 4, true) as $kelompok)
            <tr>
                @foreach ($kelompok as $label => $nilai)
                    <td>
                        <div class="label">{{ $label }}</div>
                        <div class="nilai">
                            {{ is_numeric($nilai) ? number_format((float) $nilai, ((float) $nilai == (int) $nilai) ? 0 : 2, ',', '.') : $nilai }}
                        </div>
                    </td>
                @endforeach

                {{-- Sel kosong penambal supaya lebar kolom baris terakhir tidak
                     melar mengisi sisa tabel. --}}
                @for ($i = count($kelompok); $i < 4; $i++)
                    <td></td>
                @endfor
            </tr>
        @endforeach
    </table>
@endif

@if ($report['row_count'] === 0)
    <div class="kosong">
        Tidak ada data pada periode dan filter yang dipilih.
    </div>
@else
    <table class="data">
        <thead>
            <tr>
                @foreach ($report['columns'] as $kolom)
                    <th class="{{ ($kolom['align'] ?? 'left') === 'right' ? 'kanan' : '' }}">
                        {{ $kolom['label'] }}
                    </th>
                @endforeach
            </tr>
        </thead>

        <tbody>
            @foreach ($report['rows'] as $baris)
                <tr>
                    @foreach ($report['columns'] as $kolom)
                        <td class="{{ ($kolom['align'] ?? 'left') === 'right' ? 'kanan' : '' }}">
                            {!! $format($baris[$kolom['key']] ?? null, $kolom['format'] ?? 'text') !!}
                        </td>
                    @endforeach
                </tr>
            @endforeach
        </tbody>

        @if (! empty($report['total']))
            <tfoot>
                <tr>
                    @foreach ($report['columns'] as $i => $kolom)
                        <td class="{{ ($kolom['align'] ?? 'left') === 'right' ? 'kanan' : '' }}">
                            @if ($i === 0)
                                TOTAL
                            @elseif (isset($report['total'][$kolom['key']]))
                                {!! $format($report['total'][$kolom['key']], $kolom['format'] ?? 'text') !!}
                            @endif
                        </td>
                    @endforeach
                </tr>
            </tfoot>
        @endif
    </table>
@endif

@if ($report['catatan'])
    <div class="catatan">{{ $report['catatan'] }}</div>
@endif

</body>
</html>
