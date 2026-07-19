import React, { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Camera, KeyRound, Lock, Mail, Phone, Save, Trash2, User as UserIcon } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Feedback';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errorValidasi, pesanError } from '../lib/api';
import { tokenStorage } from '../lib/storage';
import { profileService } from '../services/userService';

interface ProfilForm {
  name: string;
  email: string;
  phone: string;
}

interface PasswordForm {
  current_password: string;
  password: string;
  password_confirmation: string;
}

const UKURAN_MAKS_AVATAR = 2 * 1024 * 1024; // 2 MB, sama dengan aturan backend.

export const ProfilePage: React.FC = () => {
  const { user, setUser } = useAuth();
  const toast = useToast();

  const inputBerkasRef = useRef<HTMLInputElement>(null);
  const [avatarBaru, setAvatarBaru] = useState<File | null>(null);
  const [pratinjau, setPratinjau] = useState<string | null>(null);

  const formProfil = useForm<ProfilForm>({
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
    },
  });

  const formPassword = useForm<PasswordForm>({
    defaultValues: { current_password: '', password: '', password_confirmation: '' },
  });

  const passwordBaru = formPassword.watch('password') ?? '';

  /* ---------------------------------------------------------------------- */
  /* Avatar                                                                  */
  /* ---------------------------------------------------------------------- */

  const pilihBerkas = (e: React.ChangeEvent<HTMLInputElement>) => {
    const berkas = e.target.files?.[0];
    if (!berkas) return;

    if (berkas.size > UKURAN_MAKS_AVATAR) {
      toast.error('Ukuran foto maksimal 2 MB.');
      e.target.value = '';
      return;
    }

    if (!berkas.type.startsWith('image/')) {
      toast.error('Berkas harus berupa gambar (JPG, PNG, atau WebP).');
      e.target.value = '';
      return;
    }

    setAvatarBaru(berkas);
    setPratinjau(URL.createObjectURL(berkas));
  };

  const hapusAvatar = async () => {
    try {
      const hasil = await profileService.deleteAvatar();
      setUser(hasil.user);
      setAvatarBaru(null);
      setPratinjau(null);
      toast.success(hasil.message);
    } catch (error) {
      toast.error(pesanError(error));
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Simpan                                                                  */
  /* ---------------------------------------------------------------------- */

  const simpanProfil = async (data: ProfilForm) => {
    try {
      const hasil = await profileService.update({ ...data, avatar: avatarBaru });

      setUser(hasil.user);
      setAvatarBaru(null);
      setPratinjau(null);
      if (inputBerkasRef.current) inputBerkasRef.current.value = '';

      toast.success(hasil.message);
    } catch (error) {
      const validasi = errorValidasi(error);

      if (validasi) {
        Object.entries(validasi).forEach(([field, messages]) => {
          formProfil.setError(field as keyof ProfilForm, { type: 'server', message: messages[0] });
        });
      } else {
        toast.error(pesanError(error));
      }
    }
  };

  const gantiPassword = async (data: PasswordForm) => {
    try {
      const hasil = await profileService.changePassword(data);

      // Server menerbitkan token baru dan mematikan yang lama, jadi token di
      // sisi klien harus ikut diganti — kalau tidak, permintaan berikutnya
      // akan ditolak dan pengguna terlempar ke halaman masuk.
      tokenStorage.replace(hasil.access_token);
      formPassword.reset();

      toast.success(hasil.message);
    } catch (error) {
      const validasi = errorValidasi(error);

      if (validasi) {
        Object.entries(validasi).forEach(([field, messages]) => {
          formPassword.setError(field as keyof PasswordForm, { type: 'server', message: messages[0] });
        });
      } else {
        toast.error(pesanError(error));
      }
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Kartu identitas */}
      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <div className="relative shrink-0">
            {pratinjau ?? user.avatar_url ? (
              <img
                src={pratinjau ?? user.avatar_url!}
                alt="Foto profil"
                className="h-24 w-24 rounded-full object-cover ring-4 ring-stone-100"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-yellow-600 text-2xl font-bold text-white ring-4 ring-stone-100">
                {user.initials}
              </div>
            )}

            <button
              type="button"
              onClick={() => inputBerkasRef.current?.click()}
              className="absolute bottom-0 right-0 rounded-full border-2 border-white bg-stone-800 p-2 text-white shadow-lg transition hover:bg-stone-700"
              aria-label="Ganti foto profil"
              title="Ganti foto profil"
            >
              <Camera className="h-4 w-4" />
            </button>

            <input
              ref={inputBerkasRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={pilihBerkas}
              className="hidden"
            />
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h2 className="text-xl font-bold text-stone-900">{user.name}</h2>
            <p className="mt-0.5 text-sm text-stone-500">{user.email}</p>

            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Badge tone="info">{user.role_label}</Badge>
              <Badge tone={user.is_active ? 'success' : 'danger'}>
                {user.is_active ? 'Aktif' : 'Nonaktif'}
              </Badge>
            </div>

            {(avatarBaru || user.avatar_url) && (
              <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                {avatarBaru && (
                  <p className="text-xs font-medium text-amber-700">
                    Foto baru dipilih — klik “Simpan Perubahan” untuk menerapkannya.
                  </p>
                )}
                {user.avatar_url && !avatarBaru && (
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={() => void hapusAvatar()}>
                    Hapus Foto
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Data diri */}
      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-stone-900">Data Diri</h3>
        <p className="mt-1 text-sm text-stone-500">
          Perubahan email akan dipakai untuk masuk pada sesi berikutnya.
        </p>

        <form onSubmit={formProfil.handleSubmit(simpanProfil)} className="mt-5 space-y-5" noValidate>
          <Input
            label="Nama Lengkap"
            icon={UserIcon}
            required
            error={formProfil.formState.errors.name?.message}
            {...formProfil.register('name', {
              required: 'Nama wajib diisi.',
              minLength: { value: 3, message: 'Nama minimal 3 karakter.' },
            })}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Email"
              type="email"
              icon={Mail}
              required
              error={formProfil.formState.errors.email?.message}
              {...formProfil.register('email', {
                required: 'Email wajib diisi.',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Format email tidak valid.',
                },
              })}
            />

            <Input
              label="Nomor Telepon"
              icon={Phone}
              placeholder="0812xxxxxxxx"
              error={formProfil.formState.errors.phone?.message}
              {...formProfil.register('phone', {
                pattern: {
                  value: /^[0-9+\-\s()]{8,20}$/,
                  message: 'Format nomor telepon tidak valid.',
                },
              })}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" icon={Save} loading={formProfil.formState.isSubmitting}>
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </div>

      {/* Ganti kata sandi */}
      <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-stone-900">Ganti Kata Sandi</h3>
        <p className="mt-1 text-sm text-stone-500">
          Demi keamanan, sesi lain yang memakai kata sandi lama akan berakhir.
        </p>

        <form
          onSubmit={formPassword.handleSubmit(gantiPassword)}
          className="mt-5 space-y-5"
          noValidate
        >
          <Input
            label="Kata Sandi Saat Ini"
            type="password"
            icon={Lock}
            autoComplete="current-password"
            required
            error={formPassword.formState.errors.current_password?.message}
            {...formPassword.register('current_password', {
              required: 'Kata sandi saat ini wajib diisi.',
            })}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Kata Sandi Baru"
              type="password"
              icon={KeyRound}
              autoComplete="new-password"
              required
              hint="Minimal 8 karakter, huruf dan angka."
              error={formPassword.formState.errors.password?.message}
              {...formPassword.register('password', {
                required: 'Kata sandi baru wajib diisi.',
                minLength: { value: 8, message: 'Kata sandi minimal 8 karakter.' },
                validate: {
                  adaHuruf: (v) => /[a-zA-Z]/.test(v) || 'Kata sandi harus mengandung huruf.',
                  adaAngka: (v) => /\d/.test(v) || 'Kata sandi harus mengandung angka.',
                },
              })}
            />

            <Input
              label="Konfirmasi Kata Sandi Baru"
              type="password"
              icon={KeyRound}
              autoComplete="new-password"
              required
              error={formPassword.formState.errors.password_confirmation?.message}
              {...formPassword.register('password_confirmation', {
                required: 'Konfirmasi kata sandi wajib diisi.',
                validate: (v) => v === passwordBaru || 'Konfirmasi kata sandi tidak cocok.',
              })}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" icon={KeyRound} loading={formPassword.formState.isSubmitting}>
              Ganti Kata Sandi
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
