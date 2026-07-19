import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Lock, Mail, Phone, Save, User as UserIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { errorValidasi, pesanError } from '../../lib/api';
import { userService, type UserFormData } from '../../services/userService';
import type { RoleOption, User } from '../../types/auth';

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  /** null berarti mode tambah, terisi berarti mode ubah. */
  user: User | null;
  roles: RoleOption[];
  onSaved: () => void;
}

interface FormValues {
  name: string;
  email: string;
  role: string;
  phone: string;
  password: string;
  password_confirmation: string;
  is_active: boolean;
}

const NILAI_AWAL: FormValues = {
  name: '',
  email: '',
  role: 'kasir',
  phone: '',
  password: '',
  password_confirmation: '',
  is_active: true,
};

export const UserFormModal: React.FC<UserFormModalProps> = ({
  open,
  onClose,
  user,
  roles,
  onSaved,
}) => {
  const toast = useToast();
  const isEdit = !!user;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: NILAI_AWAL });

  // Isi ulang formulir setiap kali modal dibuka, agar data pengguna sebelumnya
  // tidak tertinggal saat berpindah dari "ubah A" ke "tambah baru".
  useEffect(() => {
    if (!open) return;

    reset(
      user
        ? {
            ...NILAI_AWAL,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone ?? '',
            is_active: user.is_active,
          }
        : NILAI_AWAL,
    );
  }, [open, user, reset]);

  const password = watch('password') ?? '';

  const onSubmit = async (data: FormValues) => {
    const payload: UserFormData = {
      name: data.name,
      email: data.email,
      role: data.role,
      phone: data.phone || undefined,
      is_active: data.is_active,
    };

    // Saat mengubah, kata sandi hanya dikirim bila memang diisi — field kosong
    // berarti "biarkan kata sandi lama".
    if (data.password) {
      payload.password = data.password;
      payload.password_confirmation = data.password_confirmation;
    }

    try {
      const hasil = isEdit
        ? await userService.update(user.id, payload)
        : await userService.create(payload);

      toast.success(hasil.message);
      onSaved();
      onClose();
    } catch (error) {
      const validasi = errorValidasi(error);

      if (validasi) {
        Object.entries(validasi).forEach(([field, messages]) => {
          setError(field as keyof FormValues, { type: 'server', message: messages[0] });
        });
        toast.error('Periksa kembali data yang Anda isi.');
      } else {
        toast.error(pesanError(error));
      }
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={isEdit ? 'Ubah Data Pengguna' : 'Tambah Pengguna Baru'}
      description={
        isEdit
          ? 'Kosongkan kolom kata sandi jika tidak ingin menggantinya.'
          : 'Pengguna baru dapat langsung masuk menggunakan email dan kata sandi ini.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button
            type="submit"
            form="form-pengguna"
            icon={Save}
            loading={isSubmitting}
          >
            {isSubmitting ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Tambah Pengguna'}
          </Button>
        </>
      }
    >
      <form id="form-pengguna" onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <Input
          label="Nama Lengkap"
          icon={UserIcon}
          placeholder="Contoh: Budi Santoso"
          required
          error={errors.name?.message}
          {...register('name', {
            required: 'Nama wajib diisi.',
            minLength: { value: 3, message: 'Nama minimal 3 karakter.' },
            maxLength: { value: 100, message: 'Nama maksimal 100 karakter.' },
          })}
        />

        <Input
          label="Email"
          type="email"
          icon={Mail}
          placeholder="nama@usaharoti.com"
          autoComplete="off"
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

        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            label="Peran"
            required
            options={roles.map((r) => ({ value: r.value, label: r.label }))}
            error={errors.role?.message}
            hint={roles.find((r) => r.value === watch('role'))?.description}
            {...register('role', { required: 'Peran wajib dipilih.' })}
          />

          <Input
            label="Nomor Telepon"
            icon={Phone}
            placeholder="0812xxxxxxxx"
            error={errors.phone?.message}
            {...register('phone', {
              pattern: {
                value: /^[0-9+\-\s()]{8,20}$/,
                message: 'Format nomor telepon tidak valid.',
              },
            })}
          />
        </div>

        <hr className="border-stone-200" />

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label={isEdit ? 'Kata Sandi Baru' : 'Kata Sandi'}
            type="password"
            icon={Lock}
            placeholder="••••••••"
            autoComplete="new-password"
            required={!isEdit}
            hint={isEdit ? 'Kosongkan bila tidak diubah.' : 'Minimal 8 karakter, huruf dan angka.'}
            error={errors.password?.message}
            {...register('password', {
              required: isEdit ? false : 'Kata sandi wajib diisi.',
              validate: (value) => {
                if (!value) return true; // Mode ubah, kata sandi tidak diganti.
                if (value.length < 8) return 'Kata sandi minimal 8 karakter.';
                if (!/[a-zA-Z]/.test(value)) return 'Kata sandi harus mengandung huruf.';
                if (!/\d/.test(value)) return 'Kata sandi harus mengandung angka.';
                return true;
              },
            })}
          />

          <Input
            label="Konfirmasi Kata Sandi"
            type="password"
            icon={Lock}
            placeholder="••••••••"
            autoComplete="new-password"
            required={!isEdit}
            error={errors.password_confirmation?.message}
            {...register('password_confirmation', {
              validate: (value) => {
                if (!password) return true;
                if (!value) return 'Konfirmasi kata sandi wajib diisi.';
                return value === password || 'Konfirmasi kata sandi tidak cocok.';
              },
            })}
          />
        </div>

        <label className="flex cursor-pointer select-none items-start gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3.5">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-stone-300 text-yellow-600 focus:ring-2 focus:ring-yellow-500"
            {...register('is_active')}
          />
          <div>
            <p className="text-sm font-semibold text-stone-700">Akun Aktif</p>
            <p className="text-xs text-stone-500">
              Akun nonaktif tidak dapat masuk ke sistem, tetapi riwayat transaksinya tetap tersimpan.
            </p>
          </div>
        </label>
      </form>
    </Modal>
  );
};
