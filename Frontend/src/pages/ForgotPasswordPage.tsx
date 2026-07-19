import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, MailCheck, Send } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../context/ToastContext';
import { errorValidasi, pesanError } from '../lib/api';
import { authService } from '../services/authService';

interface ForgotForm {
  email: string;
}

export const ForgotPasswordPage: React.FC = () => {
  const toast = useToast();
  const [terkirim, setTerkirim] = useState(false);
  const [emailTujuan, setEmailTujuan] = useState('');
  const [devUrl, setDevUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({ defaultValues: { email: '' } });

  const onSubmit = async ({ email }: ForgotForm) => {
    try {
      const hasil = await authService.forgotPassword(email);
      setEmailTujuan(email);
      setDevUrl(hasil.devResetUrl ?? null);
      setTerkirim(true);
      toast.success('Permintaan terkirim.');
    } catch (error) {
      const validasi = errorValidasi(error);

      if (validasi?.email) {
        setError('email', { type: 'server', message: validasi.email[0] });
      } else {
        toast.error(pesanError(error));
      }
    }
  };

  if (terkirim) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <MailCheck className="h-8 w-8 text-emerald-600" aria-hidden="true" />
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-stone-900">Periksa Email Anda</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-stone-500">
          Jika <span className="font-semibold text-stone-700">{emailTujuan}</span> terdaftar dalam
          sistem, kami telah mengirimkan tautan untuk mengatur ulang kata sandi. Tautan berlaku
          selama 60 menit.
        </p>

        {/* Hanya muncul saat pengembangan: driver email masih 'log', jadi tautan
            ditampilkan langsung supaya alur bisa diuji tanpa server SMTP. */}
        {devUrl && (
          <div className="mt-6 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-left">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-700">
              Mode Pengembangan
            </p>
            <p className="mb-3 text-xs text-amber-800">
              Email belum benar-benar dikirim karena <code className="font-mono">MAIL_MAILER=log</code>.
              Gunakan tautan di bawah untuk melanjutkan.
            </p>
            <a
              href={devUrl}
              className="block break-all rounded-lg bg-white px-3 py-2 font-mono text-[11px] text-amber-900 underline decoration-amber-400 transition hover:bg-amber-100"
            >
              {devUrl}
            </a>
          </div>
        )}

        <div className="mt-8 space-y-3">
          <Button variant="secondary" fullWidth onClick={() => setTerkirim(false)}>
            Kirim ke email lain
          </Button>

          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-yellow-700 transition hover:text-yellow-800 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke halaman masuk
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-stone-900">Lupa Kata Sandi</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-500">
          Masukkan email akun Anda. Kami akan mengirimkan tautan untuk membuat kata sandi baru.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <Input
          label="Email"
          type="email"
          placeholder="nama@usaharoti.com"
          autoComplete="email"
          autoFocus
          required
          error={errors.email?.message}
          {...register('email', {
            required: 'Email wajib diisi.',
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: 'Format email tidak valid.',
            },
          })}
        />

        <Button type="submit" icon={Send} loading={isSubmitting} fullWidth size="lg">
          {isSubmitting ? 'Mengirim…' : 'Kirim Tautan Reset'}
        </Button>
      </form>

      <Link
        to="/login"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 transition hover:text-stone-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke halaman masuk
      </Link>
    </div>
  );
};
