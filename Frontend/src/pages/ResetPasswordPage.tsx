import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { AlertTriangle, ArrowLeft, KeyRound, Lock } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../context/ToastContext';
import { errorValidasi, pesanError } from '../lib/api';
import { authService } from '../services/authService';

interface ResetForm {
  password: string;
  password_confirmation: string;
}

/** Indikator kekuatan kata sandi sederhana, mengikuti aturan validasi backend. */
const nilaiKekuatan = (password: string): { skor: number; label: string; warna: string } => {
  let skor = 0;
  if (password.length >= 8) skor++;
  if (password.length >= 12) skor++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) skor++;
  if (/\d/.test(password)) skor++;
  if (/[^A-Za-z0-9]/.test(password)) skor++;

  if (skor <= 2) return { skor, label: 'Lemah', warna: 'bg-red-500' };
  if (skor <= 3) return { skor, label: 'Cukup', warna: 'bg-amber-500' };
  if (skor <= 4) return { skor, label: 'Kuat', warna: 'bg-emerald-500' };
  return { skor, label: 'Sangat Kuat', warna: 'bg-emerald-600' };
};

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({ defaultValues: { password: '', password_confirmation: '' } });

  const password = watch('password') ?? '';
  const kekuatan = nilaiKekuatan(password);

  // Tautan tanpa token/email tidak akan pernah berhasil — hentikan lebih awal
  // daripada membiarkan pengguna mengisi formulir yang pasti ditolak server.
  if (!token || !email) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-8 w-8 text-red-500" aria-hidden="true" />
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-stone-900">Tautan Tidak Valid</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-stone-500">
          Tautan pengaturan ulang kata sandi tidak lengkap atau sudah kedaluwarsa. Silakan minta
          tautan baru.
        </p>

        <Link to="/forgot-password" className="mt-8 block">
          <Button fullWidth size="lg">
            Minta Tautan Baru
          </Button>
        </Link>
      </div>
    );
  }

  const onSubmit = async (data: ResetForm) => {
    try {
      const pesan = await authService.resetPassword({
        token,
        email,
        password: data.password,
        password_confirmation: data.password_confirmation,
      });

      toast.success(pesan);
      navigate('/login', { replace: true });
    } catch (error) {
      const validasi = errorValidasi(error);

      if (validasi) {
        Object.entries(validasi).forEach(([field, messages]) => {
          if (field === 'password' || field === 'password_confirmation') {
            setError(field, { type: 'server', message: messages[0] });
          } else {
            toast.error(messages[0]);
          }
        });
      } else {
        toast.error(pesanError(error));
      }
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-stone-900">Buat Kata Sandi Baru</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-500">
          Untuk akun <span className="font-semibold text-stone-700">{email}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div>
          <Input
            label="Kata Sandi Baru"
            type="password"
            icon={Lock}
            placeholder="••••••••"
            autoComplete="new-password"
            autoFocus
            required
            hint="Minimal 8 karakter, mengandung huruf dan angka."
            error={errors.password?.message}
            {...register('password', {
              required: 'Kata sandi baru wajib diisi.',
              minLength: { value: 8, message: 'Kata sandi minimal 8 karakter.' },
              validate: {
                adaHuruf: (v) => /[a-zA-Z]/.test(v) || 'Kata sandi harus mengandung huruf.',
                adaAngka: (v) => /\d/.test(v) || 'Kata sandi harus mengandung angka.',
              },
            })}
          />

          {password.length > 0 && (
            <div className="mt-2.5">
              <div className="flex items-center justify-between">
                <div className="flex flex-1 gap-1" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i <= kekuatan.skor ? kekuatan.warna : 'bg-stone-200'
                      }`}
                    />
                  ))}
                </div>
                <span className="ml-3 text-xs font-semibold text-stone-600">{kekuatan.label}</span>
              </div>
            </div>
          )}
        </div>

        <Input
          label="Konfirmasi Kata Sandi Baru"
          type="password"
          icon={Lock}
          placeholder="••••••••"
          autoComplete="new-password"
          required
          error={errors.password_confirmation?.message}
          {...register('password_confirmation', {
            required: 'Konfirmasi kata sandi wajib diisi.',
            validate: (value) => value === password || 'Konfirmasi kata sandi tidak cocok.',
          })}
        />

        <Button type="submit" icon={KeyRound} loading={isSubmitting} fullWidth size="lg">
          {isSubmitting ? 'Menyimpan…' : 'Simpan Kata Sandi Baru'}
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
