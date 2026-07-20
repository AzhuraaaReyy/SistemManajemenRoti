import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserRoundX,
  Users as UsersIcon,
  UserX,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge, EmptyState, TableSkeleton } from '../components/ui/Feedback';
import { ConfirmDialog } from '../components/users/ConfirmDialog';
import { UserFormModal } from '../components/users/UserFormModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { pesanError } from '../lib/api';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import type {
  PaginationMeta,
  RoleOption,
  User,
  UserFilters,
  UserRole,
  UserStatistics,
} from '../types/auth';

const WARNA_PERAN: Record<UserRole, 'info' | 'warning' | 'neutral'> = {
  owner: 'info',
  admin_gudang: 'warning',
  kepala_produksi: 'warning',
  kasir: 'neutral',
  // Peran usang — tampil netral supaya tidak terbaca sebagai peran aktif.
  admin_produksi: 'neutral',
};

const formatTanggal = (iso: string | null): string => {
  if (!iso) return 'Belum pernah';
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const UsersPage: React.FC = () => {
  const toast = useToast();
  const { user: pengguna } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [statistik, setStatistik] = useState<UserStatistics | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [memuat, setMemuat] = useState(true);

  const [filters, setFilters] = useState<UserFilters>({
    search: '',
    role: '',
    status: '',
    sort_by: 'created_at',
    sort_dir: 'desc',
    per_page: 10,
    page: 1,
  });

  const [modalForm, setModalForm] = useState<{ open: boolean; user: User | null }>({
    open: false,
    user: null,
  });
  const [konfirmasi, setKonfirmasi] = useState<{
    open: boolean;
    jenis: 'hapus' | 'toggle';
    target: User | null;
    memproses: boolean;
  }>({ open: false, jenis: 'hapus', target: null, memproses: false });

  /* ---------------------------------------------------------------------- */
  /* Pengambilan data                                                        */
  /* ---------------------------------------------------------------------- */

  const muatData = useCallback(async () => {
    setMemuat(true);

    try {
      const [daftar, stat] = await Promise.all([
        userService.list(filters),
        userService.statistics(),
      ]);

      setUsers(daftar.data);
      setMeta(daftar.meta);
      setStatistik(stat);
    } catch (error) {
      toast.error(pesanError(error, 'Gagal memuat daftar pengguna.'));
    } finally {
      setMemuat(false);
    }
  }, [filters, toast]);

  // Pencarian ditunda 400 ms agar tidak memanggil API pada setiap ketukan tombol.
  useEffect(() => {
    const timer = window.setTimeout(() => void muatData(), 400);
    return () => window.clearTimeout(timer);
  }, [muatData]);

  useEffect(() => {
    authService
      .roles()
      .then(setRoles)
      .catch(() => toast.error('Gagal memuat daftar peran.'));
  }, [toast]);

  const ubahFilter = (patch: Partial<UserFilters>) => {
    // Perubahan filter selalu mengembalikan ke halaman pertama, kecuali yang
    // diubah memang nomor halamannya.
    setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  };

  /* ---------------------------------------------------------------------- */
  /* Aksi                                                                    */
  /* ---------------------------------------------------------------------- */

  const jalankanKonfirmasi = async () => {
    const target = konfirmasi.target;
    if (!target) return;

    setKonfirmasi((k) => ({ ...k, memproses: true }));

    try {
      const pesan =
        konfirmasi.jenis === 'hapus'
          ? await userService.remove(target.id)
          : (await userService.toggleActive(target.id)).message;

      toast.success(pesan);
      setKonfirmasi({ open: false, jenis: 'hapus', target: null, memproses: false });
      await muatData();
    } catch (error) {
      toast.error(pesanError(error));
      setKonfirmasi((k) => ({ ...k, memproses: false }));
    }
  };

  const kartuStatistik = useMemo(
    () => [
      {
        label: 'Total Pengguna',
        nilai: statistik?.total ?? 0,
        icon: UsersIcon,
        warna: 'bg-stone-100 text-stone-600',
      },
      {
        label: 'Akun Aktif',
        nilai: statistik?.aktif ?? 0,
        icon: UserCheck,
        warna: 'bg-emerald-50 text-emerald-600',
      },
      {
        label: 'Akun Nonaktif',
        nilai: statistik?.nonaktif ?? 0,
        icon: UserX,
        warna: 'bg-red-50 text-red-600',
      },
    ],
    [statistik],
  );

  const adaFilterAktif = !!(filters.search || filters.role || filters.status);

  return (
    <div className="space-y-6">
      {/* Kepala halaman */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-stone-900">Manajemen Pengguna</h2>
          <p className="mt-1 text-sm text-stone-500">
            Kelola akun karyawan beserta peran dan hak aksesnya.
          </p>
        </div>

        <Button icon={Plus} onClick={() => setModalForm({ open: true, user: null })}>
          Tambah Pengguna
        </Button>
      </div>

      {/* Ringkasan */}
      <div className="grid gap-4 sm:grid-cols-3">
        {kartuStatistik.map(({ label, nilai, icon: Icon, warna }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
          >
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${warna}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p>
              <p className="text-2xl font-bold tabular-nums text-stone-900">{nilai}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabel */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        {/* Baris filter */}
        <div className="flex flex-col gap-3 border-b border-stone-200 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => ubahFilter({ search: e.target.value })}
              placeholder="Cari nama, email, atau nomor telepon…"
              aria-label="Cari pengguna"
              className="w-full rounded-lg border border-stone-300 py-2.5 pl-9 pr-3 text-sm shadow-sm transition placeholder:text-stone-400 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
            />
          </div>

          <div className="flex gap-3">
            <select
              value={filters.role}
              onChange={(e) => ubahFilter({ role: e.target.value as UserRole | '' })}
              aria-label="Saring berdasarkan peran"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm transition focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200 lg:flex-none"
            >
              <option value="">Semua Peran</option>
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            <select
              value={filters.status}
              onChange={(e) => ubahFilter({ status: e.target.value as 'aktif' | 'nonaktif' | '' })}
              aria-label="Saring berdasarkan status"
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2.5 text-sm shadow-sm transition focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200 lg:flex-none"
            >
              <option value="">Semua Status</option>
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </select>
          </div>
        </div>

        {memuat ? (
          <TableSkeleton rows={5} cols={5} />
        ) : users.length === 0 ? (
          <EmptyState
            icon={UserRoundX}
            title={adaFilterAktif ? 'Tidak ada hasil' : 'Belum ada pengguna'}
            description={
              adaFilterAktif
                ? 'Tidak ada pengguna yang cocok dengan filter Anda. Coba ubah kata kunci atau hapus filter.'
                : 'Tambahkan akun karyawan agar mereka dapat masuk dan menggunakan sistem.'
            }
            action={
              adaFilterAktif ? (
                <Button
                  variant="secondary"
                  onClick={() => ubahFilter({ search: '', role: '', status: '' })}
                >
                  Hapus Filter
                </Button>
              ) : (
                <Button icon={Plus} onClick={() => setModalForm({ open: true, user: null })}>
                  Tambah Pengguna
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-stone-500">
                    Pengguna
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-stone-500">
                    Peran
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-stone-500">
                    Kontak
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-stone-500">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-stone-500">
                    Terakhir Masuk
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-stone-500">
                    Aksi
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-stone-100">
                {users.map((u) => {
                  const diriSendiri = u.id === pengguna?.id;

                  return (
                    <tr key={u.id} className="transition hover:bg-stone-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-200 text-xs font-bold text-stone-600">
                              {u.initials}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-stone-900">
                              {u.name}
                              {diriSendiri && (
                                <span className="ml-2 text-[10px] font-bold uppercase text-yellow-700">
                                  Anda
                                </span>
                              )}
                            </p>
                            <p className="truncate text-xs text-stone-500">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <Badge tone={WARNA_PERAN[u.role]}>{u.role_label}</Badge>
                      </td>

                      <td className="px-4 py-3 text-stone-600">{u.phone ?? '—'}</td>

                      <td className="px-4 py-3">
                        <Badge tone={u.is_active ? 'success' : 'danger'}>
                          {u.is_active ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 text-xs text-stone-500">
                        {formatTanggal(u.last_login_at)}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setModalForm({ open: true, user: u })}
                            className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                            aria-label={`Ubah data ${u.name}`}
                            title="Ubah"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            disabled={diriSendiri}
                            onClick={() =>
                              setKonfirmasi({ open: true, jenis: 'toggle', target: u, memproses: false })
                            }
                            className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label={`${u.is_active ? 'Nonaktifkan' : 'Aktifkan'} ${u.name}`}
                            title={
                              diriSendiri
                                ? 'Tidak dapat mengubah status akun sendiri'
                                : u.is_active
                                  ? 'Nonaktifkan'
                                  : 'Aktifkan'
                            }
                          >
                            {u.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </button>

                          <button
                            type="button"
                            disabled={diriSendiri}
                            onClick={() =>
                              setKonfirmasi({ open: true, jenis: 'hapus', target: u, memproses: false })
                            }
                            className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label={`Hapus ${u.name}`}
                            title={diriSendiri ? 'Tidak dapat menghapus akun sendiri' : 'Hapus'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginasi */}
        {meta && meta.total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-stone-200 bg-stone-50 px-4 py-3 sm:flex-row">
            <p className="text-xs text-stone-500">
              Menampilkan <span className="font-semibold text-stone-700">{meta.from ?? 0}</span>–
              <span className="font-semibold text-stone-700">{meta.to ?? 0}</span> dari{' '}
              <span className="font-semibold text-stone-700">{meta.total}</span> pengguna
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={ChevronLeft}
                disabled={meta.current_page <= 1}
                onClick={() => ubahFilter({ page: meta.current_page - 1 })}
              >
                Sebelumnya
              </Button>

              <span className="px-2 text-xs font-semibold text-stone-600">
                {meta.current_page} / {meta.last_page}
              </span>

              <Button
                variant="secondary"
                size="sm"
                disabled={meta.current_page >= meta.last_page}
                onClick={() => ubahFilter({ page: meta.current_page + 1 })}
              >
                Berikutnya
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <UserFormModal
        open={modalForm.open}
        user={modalForm.user}
        roles={roles}
        onClose={() => setModalForm({ open: false, user: null })}
        onSaved={() => void muatData()}
      />

      <ConfirmDialog
        open={konfirmasi.open}
        loading={konfirmasi.memproses}
        onClose={() => setKonfirmasi({ open: false, jenis: 'hapus', target: null, memproses: false })}
        onConfirm={() => void jalankanKonfirmasi()}
        variant={konfirmasi.jenis === 'hapus' ? 'danger' : 'primary'}
        confirmLabel={
          konfirmasi.jenis === 'hapus'
            ? 'Ya, Hapus'
            : konfirmasi.target?.is_active
              ? 'Ya, Nonaktifkan'
              : 'Ya, Aktifkan'
        }
        title={
          konfirmasi.jenis === 'hapus'
            ? 'Hapus Pengguna?'
            : konfirmasi.target?.is_active
              ? 'Nonaktifkan Pengguna?'
              : 'Aktifkan Pengguna?'
        }
        message={
          konfirmasi.jenis === 'hapus' ? (
            <>
              Pengguna <strong className="text-stone-900">{konfirmasi.target?.name}</strong> tidak akan
              bisa masuk lagi. Riwayat transaksinya tetap tersimpan agar laporan lama tidak berubah.
            </>
          ) : konfirmasi.target?.is_active ? (
            <>
              <strong className="text-stone-900">{konfirmasi.target?.name}</strong> akan langsung
              dikeluarkan dari sistem dan tidak dapat masuk sampai diaktifkan kembali.
            </>
          ) : (
            <>
              <strong className="text-stone-900">{konfirmasi.target?.name}</strong> akan dapat masuk
              kembali menggunakan kata sandi lamanya.
            </>
          )
        }
      />
    </div>
  );
};
