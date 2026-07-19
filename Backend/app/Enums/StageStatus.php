<?php

namespace App\Enums;

/**
 * Status satu tahap produksi.
 */
enum StageStatus: string
{
    case PENDING = 'pending';
    case IN_PROGRESS = 'in_progress';
    case COMPLETED = 'completed';

    public function label(): string
    {
        return match ($this) {
            self::PENDING => 'Belum Mulai',
            self::IN_PROGRESS => 'Sedang Berjalan',
            self::COMPLETED => 'Selesai',
        };
    }

    public function tone(): string
    {
        return match ($this) {
            self::PENDING => 'neutral',
            self::IN_PROGRESS => 'warning',
            self::COMPLETED => 'success',
        };
    }

    /**
     * @return array<int, array<string, string>>
     */
    public static function options(): array
    {
        return array_map(fn (self $s) => [
            'value' => $s->value,
            'label' => $s->label(),
            'tone' => $s->tone(),
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
