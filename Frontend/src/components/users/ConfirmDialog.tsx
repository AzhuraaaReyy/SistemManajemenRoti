import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Ya, Lanjutkan',
  variant = 'danger',
  loading = false,
}) => (
  <Modal
    open={open}
    onClose={onClose}
    size="sm"
    title={title}
    footer={
      <>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Batal
        </Button>
        <Button variant={variant} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="flex gap-4">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
          variant === 'danger' ? 'bg-red-50' : 'bg-amber-50'
        }`}
      >
        <AlertTriangle
          className={`h-5 w-5 ${variant === 'danger' ? 'text-red-600' : 'text-amber-600'}`}
          aria-hidden="true"
        />
      </div>

      <div className="text-sm leading-relaxed text-stone-600">{message}</div>
    </div>
  </Modal>
);
