import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { LogIn, Lock, Mail } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errorValidasi, pesanError } from '../lib/api';
import { lastEmailStorage, tokenStorage } from '../lib/storage';

interface LoginForm {
  email: string;
  password: string;
  remember: boolean;
}

const AKUN_DEMO = [
  { label: 'Owner', email: 'owner@rotimanis.test' },
  { label: 'Admin Gudang', email: 'admin_gudang@rotimanis.test' },
  { label: 'Kepala Produksi', email: 'kepalaproduksi@rotimanis.test' },
  { label: 'Kasir', email: 'kasir@rotimanis.test' },
];

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [errorUmum, setErrorUmum] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    defaultValues: {
      email: lastEmailStorage.get(),
      password: '',
      remember: tokenStorage.isRemembered(),
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setErrorUmum(null);

    try {
      const user = await login(data);
      toast.success(`Selamat datang kembali, ${user.name}!`);

      // Kembalikan ke halaman yang tadi ingin dibuka sebelum diminta masuk.
      const tujuan = (location.state as { from?: string } | null)?.from ?? '/dashboard';
      navigate(tujuan, { replace: true });
    } catch (error) {
      const validasi = errorValidasi(error);

      if (validasi) {
        Object.entries(validasi).forEach(([field, messages]) => {
          setError(field as keyof LoginForm, { type: 'server', message: messages[0] });
        });
      } else {
        // Kredensial salah bukan error per-field — server sengaja tidak
        // memberi tahu bagian mana yang keliru, jadi ditampilkan sebagai
        // peringatan di atas formulir.
        setErrorUmum(pesanError(error));
      }
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-stone-900">Masuk ke Akun Anda</h2>
        <p className="mt-1.5 text-sm text-stone-500">
          Gunakan email dan kata sandi yang diberikan oleh Owner usaha Anda.
        </p>
      </div>

      {errorUmum && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {errorUmum}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <Input
          label="Email"
          type="email"
          icon={Mail}
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

        <Input
          label="Kata Sandi"
          type="password"
          icon={Lock}
          placeholder="••••••••"
          autoComplete="current-password"
          required
          error={errors.password?.message}
          {...register('password', {
            required: 'Kata sandi wajib diisi.',
            minLength: { value: 6, message: 'Kata sandi minimal 6 karakter.' },
          })}
        />

        <div className="flex items-center justify-between gap-3">
          <label className="flex cursor-pointer select-none items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-stone-300 text-yellow-600 focus:ring-2 focus:ring-yellow-500 focus:ring-offset-0"
              {...register('remember')}
            />
            <span className="text-sm font-medium text-stone-600">Ingat saya</span>
          </label>

          <Link
            to="/forgot-password"
            className="text-sm font-semibold text-yellow-700 transition hover:text-yellow-800 hover:underline"
          >
            Lupa kata sandi?
          </Link>
        </div>

        <Button type="submit" icon={LogIn} loading={isSubmitting} fullWidth size="lg">
          {isSubmitting ? 'Memproses…' : 'Masuk'}
        </Button>
      </form>

      {/* Pintasan akun demo — memudahkan peninjau mencoba tiap peran. */}
      <div className="mt-8 rounded-xl border border-stone-200 bg-white p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-stone-500">Akun Demo</p>

        <div className="flex flex-wrap gap-2">
          {AKUN_DEMO.map((akun) => (
            <button
              key={akun.email}
              type="button"
              onClick={() => {
                setValue('email', akun.email, { shouldValidate: true });
                setValue('password', 'password123', { shouldValidate: true });
              }}
              className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:border-yellow-300 hover:bg-yellow-50 hover:text-yellow-800"
            >
              {akun.label}
            </button>
          ))}
        </div>

        <p className="mt-3 text-[11px] text-stone-400">
          Klik salah satu untuk mengisi formulir. Kata sandi semua akun demo:{' '}
          <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-stone-600">password123</code>
        </p>
      </div>
    </div>
  );
};
