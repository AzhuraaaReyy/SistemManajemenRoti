import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  PackageCheck,
  Play,
  RotateCcw,
  User,
} from 'lucide-react';
import { CompleteProductionModal } from '../../components/production/CompleteProductionModal';
import { StageActionModal, type StageAction } from '../../components/production/StageActionModal';
import { StageTimeline } from '../../components/production/StageTimeline';
import { Button } from '../../components/ui/Button';
import { Badge, LoadingScreen } from '../../components/ui/Feedback';
import { useToast } from '../../context/ToastContext';
import { pesanError } from '../../lib/api';
import { angka, durasi, rupiah, tanggalWaktu } from '../../lib/format';
import { trackingService } from '../../services/productionService';
import type { BatchTracking, ProductionStage } from '../../types/production';

const TONE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'info',
  neutral: 'neutral',
};

/**
 * Halaman tracking satu batch.
 *
 * Menjawab tiga pertanyaan sekaligus: batch ini sedang di tahap apa, sudah
 * berapa lama, dan apa yang bisa saya lakukan sekarang.
 */
export const ProductionTrackingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const batchId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();

  const [data, setData] = useState<BatchTracking | null>(null);
  const [loading, setLoading] = useState(true);

  const [aksi, setAksi] = useState<{ action: StageAction; stage: ProductionStage } | null>(null);
  const [packaging, setPackaging] = useState(false);

  const muat = useCallback(async () => {
    if (!Number.isFinite(batchId)) {
      navigate('/produksi/batch', { replace: true });
      return;
    }

    setLoading(true);

    try {
      setData(await trackingService.show(batchId));
    } catch (error) {
      toast.error(pesanError(error, 'Gagal memuat tracking batch.'));
      navigate('/produksi/batch', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [batchId, navigate, toast]);

  useEffect(() => {
    void muat();
  }, [muat]);

  /*
  | Setiap aksi tahap mengembalikan keadaan terbaru secara utuh, jadi state
  | cukup diganti. Tanpa ini halaman perlu memuat ulang dan timeline berkedip
  | setiap kali satu tombol ditekan.
  */
  const perbarui = (tracking: BatchTracking) => setData(tracking);

  if (loading) return <LoadingScreen label="Memuat tracking produksi…" />;
  if (!data) return null;

  const { batch, stages, history, summary } = data;

  const berjalan = batch.status === 'in_progress';
  const tahapSaatIni = stages.find((s) => s.stage === summary.current_stage) ?? null;

  // Tahap yang boleh diulang: yang terakhir selesai. Aturan ini ditegakkan
  // server; di sini hanya untuk menentukan tombol mana yang ditampilkan.
  const terakhirSelesai = [...stages].reverse().find((s) => s.status === 'completed') ?? null;

  const bukaAksi = (action: StageAction, stage: ProductionStage) => {
    if (action === 'finish' && stage.is_last) {
      setPackaging(true);
      return;
    }

    setAksi({ action, stage });
  };

  return (
    <div className="space-y-6">
      {/* Kepala halaman */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            to="/produksi/batch"
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition hover:text-stone-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke daftar batch
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-xl font-bold tracking-tight text-stone-900">
              {batch.batch_number}
            </h2>
            <Badge tone={TONE[batch.status_tone] ?? 'neutral'}>{batch.status_label}</Badge>
          </div>

          <p className="mt-1 text-sm text-stone-500">
            {batch.product_name} · target {angka(batch.target_quantity)} {batch.product_unit} · resep{' '}
            {batch.recipe_name} v{batch.recipe_version}
          </p>
        </div>

        <dl className="flex shrink-0 gap-6 rounded-xl border border-stone-200 bg-white px-5 py-3 shadow-sm">
          <div>
            <dt className="text-xs text-stone-500">Biaya Bahan</dt>
            <dd className="font-bold tabular-nums text-stone-900">{rupiah(batch.material_cost)}</dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Dimulai</dt>
            <dd className="text-sm font-semibold text-stone-800">{tanggalWaktu(batch.started_at)}</dd>
          </div>
        </dl>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h3 className="mb-5 text-base font-bold text-stone-900">Tahapan Produksi</h3>

        <StageTimeline
          stages={stages}
          summary={summary}
          isCompleted={batch.status === 'completed'}
          activeStage={summary.current_stage}
        />
      </div>

      {/* Kartu aksi — hanya untuk batch yang masih berjalan */}
      {berjalan && tahapSaatIni && (
        <div className="rounded-xl border border-yellow-300 bg-yellow-50/60 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-yellow-700">
                {summary.is_running ? 'Sedang dikerjakan' : 'Tahap berikutnya'}
              </p>
              <h3 className="mt-0.5 text-lg font-bold text-stone-900">
                {tahapSaatIni.stage_label}
                {tahapSaatIni.attempt > 1 && (
                  <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
                    percobaan #{tahapSaatIni.attempt}
                  </span>
                )}
              </h3>
              <p className="mt-0.5 text-sm text-stone-600">{tahapSaatIni.stage_description}</p>

              {summary.is_running && (
                <p
                  className={`mt-2 inline-flex items-center gap-1.5 text-sm ${
                    summary.is_overdue ? 'font-semibold text-red-600' : 'text-stone-600'
                  }`}
                >
                  {summary.is_overdue ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                  Berjalan {durasi(summary.running_minutes)}
                  {summary.is_overdue &&
                    ` — jauh melewati perkiraan ${durasi(tahapSaatIni.typical_minutes)}`}
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              {tahapSaatIni.status === 'pending' && (
                <Button icon={Play} onClick={() => bukaAksi('start', tahapSaatIni)}>
                  Mulai {tahapSaatIni.stage_label}
                </Button>
              )}

              {tahapSaatIni.status === 'in_progress' && (
                <Button
                  icon={tahapSaatIni.is_last ? PackageCheck : CheckCircle2}
                  onClick={() => bukaAksi('finish', tahapSaatIni)}
                >
                  {tahapSaatIni.is_last ? 'Selesaikan Packaging' : 'Selesaikan Tahap'}
                </Button>
              )}

              {/* Mengulang hanya ditawarkan pada tahap yang terakhir selesai —
                  mundur dua tahap membuat tahap di antaranya tidak konsisten. */}
              {terakhirSelesai && (
                <Button
                  variant="secondary"
                  icon={RotateCcw}
                  onClick={() => bukaAksi('repeat', terakhirSelesai)}
                >
                  Ulangi {terakhirSelesai.stage_label}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {batch.status === 'completed' && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
          <span className="inline-flex items-center gap-2 font-semibold">
            <PackageCheck className="h-5 w-5" />
            Produksi selesai
          </span>
          <span>
            Hasil layak jual{' '}
            <strong className="tabular-nums">
              {angka(batch.good_quantity)} {batch.product_unit}
            </strong>
            {batch.reject_quantity > 0 && (
              <> · gagal <strong className="tabular-nums">{angka(batch.reject_quantity)}</strong></>
            )}
          </span>
          <span>
            HPP <strong className="tabular-nums">{rupiah(batch.cost_per_unit)}</strong> per{' '}
            {batch.product_unit}
          </span>
          <span>Total {durasi(batch.duration_minutes)}</span>
        </div>
      )}

      {batch.status === 'cancelled' && batch.cancel_reason && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-semibold text-red-800">Batch dibatalkan</p>
          <p className="mt-0.5 text-sm text-red-700">{batch.cancel_reason}</p>
          <p className="mt-1 text-xs text-red-600">
            Oleh {batch.cancelled_by_name} · {tanggalWaktu(batch.cancelled_at)} — seluruh bahan
            telah dikembalikan ke stok.
          </p>
        </div>
      )}

      {/* Riwayat seluruh percobaan */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-bold text-stone-900">Riwayat Tahapan</h3>
        <p className="mb-4 mt-0.5 text-sm text-stone-500">
          Termasuk percobaan yang diulang — waktu percobaan lama tidak ditimpa.
        </p>

        <div className="overflow-x-auto rounded-lg border border-stone-200">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50">
              <tr>
                <th scope="col" className="px-3 py-2 text-xs font-bold uppercase text-stone-500">Tahap</th>
                <th scope="col" className="px-3 py-2 text-xs font-bold uppercase text-stone-500">Status</th>
                <th scope="col" className="px-3 py-2 text-xs font-bold uppercase text-stone-500">Mulai</th>
                <th scope="col" className="px-3 py-2 text-xs font-bold uppercase text-stone-500">Selesai</th>
                <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Durasi</th>
                <th scope="col" className="px-3 py-2 text-xs font-bold uppercase text-stone-500">Operator</th>
                <th scope="col" className="px-3 py-2 text-xs font-bold uppercase text-stone-500">Catatan</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-stone-100">
              {history.map((s) => (
                <tr key={s.id} className={s.status === 'pending' ? 'text-stone-400' : ''}>
                  <td className="px-3 py-2">
                    <span className="font-medium text-stone-800">
                      {s.sequence}. {s.stage_label}
                    </span>
                    {s.attempt > 1 && (
                      <span className="ml-2 rounded-full bg-orange-100 px-1.5 text-[10px] font-bold text-orange-700">
                        #{s.attempt}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={TONE[s.status_tone] ?? 'neutral'}>{s.status_label}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums">{tanggalWaktu(s.started_at)}</td>
                  <td className="px-3 py-2 text-xs tabular-nums">{tanggalWaktu(s.finished_at)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={s.is_overdue ? 'font-semibold text-red-600' : ''}>
                      {durasi(s.duration_minutes)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {s.operator_name ? (
                      <span className="inline-flex items-center gap-1 text-stone-600">
                        <User className="h-3 w-3" />
                        {s.operator_name}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-stone-500">{s.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pemakaian bahan — dipotong saat batch dibuat, bukan per tahap */}
      {batch.materials && batch.materials.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-stone-900">Pemakaian Bahan</h3>
          <p className="mb-4 mt-0.5 text-sm text-stone-500">
            Seluruh bahan dipotong sekaligus saat batch dibuat, dengan harga yang dibekukan saat itu.
          </p>

          <div className="overflow-x-auto rounded-lg border border-stone-200">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <th scope="col" className="px-3 py-2 text-xs font-bold uppercase text-stone-500">Bahan</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Dipakai</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Susut</th>
                  <th scope="col" className="px-3 py-2 text-right text-xs font-bold uppercase text-stone-500">Biaya</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-stone-100">
                {batch.materials.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-stone-800">{m.ingredient_name}</p>
                      <p className="font-mono text-xs text-stone-400">{m.ingredient_code}</p>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-stone-900">
                      {angka(m.qty_used_display, 3)} {m.unit}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-stone-500">
                      {m.waste_percent > 0 ? `${angka(m.waste_percent, 1)}%` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-stone-700">
                      {rupiah(m.line_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot className="border-t border-stone-200 bg-stone-50">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right text-sm font-bold text-stone-800">
                    Total
                  </td>
                  <td className="px-3 py-2 text-right text-base font-bold tabular-nums text-stone-900">
                    {rupiah(batch.material_cost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <StageActionModal
        open={!!aksi}
        action={aksi?.action ?? 'start'}
        batchId={batch.id}
        batchNumber={batch.batch_number}
        stage={aksi?.stage ?? null}
        onClose={() => setAksi(null)}
        onDone={perbarui}
      />

      <CompleteProductionModal
        open={packaging}
        batch={batch}
        onClose={() => setPackaging(false)}
        onCompleted={perbarui}
      />
    </div>
  );
};
