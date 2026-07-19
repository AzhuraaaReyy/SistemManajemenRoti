import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Play, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { errorValidasi, pesanError } from '../../lib/api';
import { durasi, tanggalWaktu } from '../../lib/format';
import { trackingService } from '../../services/productionService';
import type { BatchTracking, ProductionStage } from '../../types/production';

export type StageAction = 'start' | 'finish' | 'repeat';

interface Props {
  open: boolean;
  action: StageAction;
  batchId: number;
  batchNumber: string;
  stage: ProductionStage | null;
  onClose: () => void;
  onDone: (tracking: BatchTracking) => void;
}

/*
| Dialog satu tahap: mulai, selesaikan, atau ulangi.
|
| Tahap Packaging TIDAK ditangani di sini — menyelesaikannya berarti menutup
| batch dan menambah stok produk jadi, jadi ia punya dialognya sendiri
| (CompleteProductionModal) yang menanyakan hasil layak jual dan produk gagal.
*/
export const StageActionModal: React.FC<Props> = ({
  open,
  action,
  batchId,
  batchNumber,
  stage,
  onClose,
  onDone,
}) => {
  const toast = useToast();

  const [catatan, setCatatan] = useState('');
  const [alasan, setAlasan] = useState('');
  const [proses, setProses] = useState(false);

  useEffect(() => {
    if (!open) return;

    setCatatan('');
    setAlasan('');
  }, [open, stage?.id, action]);

  if (!stage) return null;

  const jalankan = async () => {
    if (action === 'repeat' && alasan.trim().length < 5) {
      toast.warning('Isi alasan pengulangan minimal 5 karakter.');
      return;
    }

    setProses(true);

    try {
      const hasil =
        action === 'start'
          ? await trackingService.start(batchId, stage.stage)
          : action === 'finish'
            ? await trackingService.finish(batchId, stage.stage, { notes: catatan.trim() || null })
            : await trackingService.repeat(batchId, stage.stage, alasan.trim());

      toast.success(hasil.message);
      onDone(hasil);
      onClose();
    } catch (error) {
      // Pesan validasi dari state machine ("Tuntaskan Fermentasi terlebih
      // dahulu") jauh lebih berguna daripada pesan HTTP umum.
      const validasi = errorValidasi(error);
      toast.error(validasi ? Object.values(validasi)[0][0] : pesanError(error));
    } finally {
      setProses(false);
    }
  };

  const judul = {
    start: `Mulai Tahap ${stage.stage_label}`,
    finish: `Selesaikan Tahap ${stage.stage_label}`,
    repeat: `Ulangi Tahap ${stage.stage_label}`,
  }[action];

  const ikon = { start: Play, finish: CheckCircle2, repeat: RotateCcw }[action];
  const varian = action === 'repeat' ? ('danger' as const) : ('primary' as const);
  const tombol = { start: 'Mulai Sekarang', finish: 'Tandai Selesai', repeat: 'Ya, Ulangi' }[action];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={judul}
      description={`${batchNumber} · ${stage.stage_description}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={proses}>
            Batal
          </Button>
          <Button variant={varian} icon={ikon} onClick={() => void jalankan()} loading={proses}>
            {tombol}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {action === 'start' && (
          <>
            <p className="text-sm text-stone-600">
              Waktu mulai dicatat sekarang dan Anda tercatat sebagai operatornya.
            </p>
            <p className="rounded-lg bg-stone-50 p-3 text-xs text-stone-600">
              Perkiraan durasi wajar tahap ini{' '}
              <strong className="text-stone-800">{durasi(stage.typical_minutes)}</strong>. Bila
              terlampaui jauh, timeline akan menandainya agar bisa ditelusuri.
            </p>
          </>
        )}

        {action === 'finish' && (
          <>
            <p className="text-sm text-stone-600">
              Sudah berjalan{' '}
              <strong className="text-stone-900">{durasi(stage.duration_minutes)}</strong> sejak{' '}
              {tanggalWaktu(stage.started_at)}.
            </p>

            {stage.is_overdue && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Tahap ini berjalan jauh lebih lama dari biasanya ({durasi(stage.typical_minutes)}).
                Bila ada kendalanya, tulis di catatan supaya bisa ditelusuri nanti.
              </p>
            )}

            <div>
              <label htmlFor="tahap-catatan" className="mb-1.5 block text-sm font-semibold text-stone-700">
                Catatan Tahap <span className="font-normal text-stone-400">(opsional)</span>
              </label>
              <textarea
                id="tahap-catatan"
                rows={2}
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Contoh: suhu ruang 31°C, adonan mengembang lebih cepat"
                className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm transition placeholder:text-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
              />
            </div>
          </>
        )}

        {action === 'repeat' && (
          <>
            <p className="text-sm text-stone-600">
              Percobaan baru dibuat sebagai{' '}
              <strong className="text-stone-900">percobaan #{stage.attempt + 1}</strong>. Catatan
              waktu percobaan sebelumnya tetap tersimpan sebagai riwayat.
            </p>

            <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Progress akan mundur satu tahap karena tahap ini kembali dianggap belum selesai.
              Bahan yang sudah dipotong <strong>tidak</strong> ditambah ulang — pengulangan
              memakai adonan yang sama.
            </p>

            <Input
              label="Alasan Pengulangan"
              placeholder="Contoh: Bentuk tidak rata, perlu dibentuk ulang"
              required
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              hint="Minimal 5 karakter. Tersimpan pada riwayat kedua percobaan."
            />
          </>
        )}
      </div>
    </Modal>
  );
};
