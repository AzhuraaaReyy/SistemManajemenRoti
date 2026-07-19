import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const UKURAN = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}) => {
  // Tutup dengan Escape, dan kunci scroll halaman di belakang modal.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    const overflowAsli = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflowAsli;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-stone-900/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`animate-modal-in relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${UKURAN[size]}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 p-5">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-lg font-bold text-stone-900">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-stone-500">{description}</p>}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-stone-200 bg-stone-50 p-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
