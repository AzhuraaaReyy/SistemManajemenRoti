import React from 'react';
import { AlertTriangle, Check, Loader2, PackageCheck } from 'lucide-react';
import { durasi } from '../../lib/format';
import type { ProductionStage, StageSummary } from '../../types/production';

interface Props {
  stages: ProductionStage[];
  summary: StageSummary;
  /** Batch sudah selesai — penanda "Produk Jadi" di ujung ikut menyala. */
  isCompleted: boolean;
  /** Tahap yang sedang disorot, dipakai halaman untuk menandai kartu aksi. */
  activeStage?: string | null;
  onSelectStage?: (stage: ProductionStage) => void;
}

/*
| Timeline horizontal gaya Manufacturing ERP.
|
| Tujuh tahap berjajar dengan garis penghubung, digulir mendatar di layar
| kecil alih-alih dipatahkan ke bawah — urutan proses jauh lebih mudah
| ditangkap saat tetap satu baris.
|
|   ✓━━━━━✓━━━━━◐─────○─────○─────○─────○     ⬦ Produk Jadi
|  Persiapan Mixing Fermentasi ...            (menyala saat batch selesai)
*/

const LINGKARAN: Record<string, string> = {
  completed: 'bg-emerald-600 text-white ring-emerald-100',
  in_progress: 'bg-amber-500 text-white ring-amber-100',
  pending: 'bg-white text-stone-300 ring-stone-100 border-2 border-stone-200',
};

const GARIS: Record<string, string> = {
  completed: 'bg-emerald-500',
  in_progress: 'bg-gradient-to-r from-emerald-500 to-stone-200',
  pending: 'bg-stone-200',
};

export const StageTimeline: React.FC<Props> = ({
  stages,
  summary,
  isCompleted,
  activeStage,
  onSelectStage,
}) => (
  <div className="space-y-5">
    <div className="overflow-x-auto pb-2">
      <ol className="flex min-w-[760px] items-start">
        {stages.map((s, i) => {
          const dipilih = activeStage === s.stage;
          const bisaDiklik = !!onSelectStage;

          return (
            <li key={s.id} className="flex flex-1 items-start">
              {/* Kolom tahap */}
              <div className="flex w-full min-w-0 flex-col items-center">
                <button
                  type="button"
                  disabled={!bisaDiklik}
                  onClick={() => onSelectStage?.(s)}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4 transition
                    ${LINGKARAN[s.status]}
                    ${dipilih ? 'scale-110 ring-yellow-200' : ''}
                    ${bisaDiklik ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
                  aria-label={`${s.stage_label} — ${s.status_label}`}
                  title={s.stage_description}
                >
                  {s.status === 'completed' ? (
                    <Check className="h-5 w-5" strokeWidth={3} />
                  ) : s.status === 'in_progress' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <span className="text-xs font-bold text-stone-400">{s.sequence}</span>
                  )}
                </button>

                <div className="mt-2 w-full px-1 text-center">
                  <p
                    className={`truncate text-xs font-semibold ${
                      s.status === 'pending' ? 'text-stone-400' : 'text-stone-800'
                    }`}
                  >
                    {s.stage_label}
                  </p>

                  {/* Percobaan kedua dan seterusnya perlu terlihat jelas —
                      tanpa penanda ini, timeline berbohong soal sekali jadi. */}
                  {s.attempt > 1 && (
                    <span className="mt-0.5 inline-block rounded-full bg-orange-100 px-1.5 text-[10px] font-bold text-orange-700">
                      percobaan #{s.attempt}
                    </span>
                  )}

                  <p className="mt-0.5 text-[11px] tabular-nums text-stone-500">
                    {s.status === 'pending' ? (
                      <span className="text-stone-300">± {durasi(s.typical_minutes)}</span>
                    ) : s.status === 'in_progress' ? (
                      <span className={s.is_overdue ? 'font-semibold text-red-600' : 'text-amber-600'}>
                        {s.is_overdue && <AlertTriangle className="mr-0.5 inline h-3 w-3" />}
                        berjalan {durasi(s.duration_minutes)}
                      </span>
                    ) : (
                      <span className="text-emerald-600">{durasi(s.duration_minutes)}</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Garis penghubung ke tahap berikutnya */}
              {i < stages.length - 1 && (
                <div className={`mt-5 h-1 flex-1 shrink-0 rounded-full ${GARIS[s.status]}`} />
              )}
            </li>
          );
        })}

        {/* Penanda akhir — bukan tahap yang dikerjakan, melainkan keadaan
            setelah Packaging selesai. Karena itu tidak bisa diklik. */}
        <li className="flex items-start">
          <div className={`mt-5 h-1 w-8 shrink-0 rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-stone-200'}`} />

          <div className="flex w-20 flex-col items-center">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ring-4 ${
                isCompleted
                  ? 'bg-emerald-600 text-white ring-emerald-100'
                  : 'border-2 border-dashed border-stone-200 bg-white text-stone-300 ring-stone-50'
              }`}
            >
              <PackageCheck className="h-5 w-5" />
            </div>

            <p
              className={`mt-2 text-center text-xs font-semibold ${
                isCompleted ? 'text-emerald-700' : 'text-stone-400'
              }`}
            >
              Produk Jadi
            </p>
          </div>
        </li>
      </ol>
    </div>

    {/* Progress = (tahap selesai / total tahap) × 100 */}
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-stone-700">
          {summary.current_stage_label
            ? summary.is_running
              ? `Sedang ${summary.current_stage_label}`
              : `Berikutnya: ${summary.current_stage_label}`
            : 'Seluruh tahap selesai'}
        </span>

        <span className="text-sm font-bold tabular-nums text-stone-900">
          {summary.progress_percent}%
          <span className="ml-2 text-xs font-medium text-stone-500">
            {summary.completed_stages} dari {summary.total_stages} tahap
          </span>
        </span>
      </div>

      <div
        className="h-2.5 overflow-hidden rounded-full bg-stone-100"
        role="progressbar"
        aria-valuenow={summary.progress_percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress batch produksi"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            summary.progress_percent === 100 ? 'bg-emerald-500' : 'bg-yellow-600'
          }`}
          style={{ width: `${Math.max(1.5, summary.progress_percent)}%` }}
        />
      </div>
    </div>
  </div>
);
