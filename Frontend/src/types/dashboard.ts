/**
 * Modul 8 — Dashboard Owner.
 *
 * Seluruh angka di sini agregasi dari tabel modul lain. Tidak ada tabel baru.
 */

import type { AttentionItem } from './inventory';

export interface DashboardPenjualan {
  transaksi_hari_ini: number;
  transaksi_bulan_ini: number;
  unit_hari_ini: number;
  unit_bulan_ini: number;
}

export interface DashboardProduksi {
  batch_selesai_hari_ini: number;
  batch_selesai_bulan_ini: number;
  unit_hari_ini: number;
  unit_bulan_ini: number;
  batch_aktif: number;
  biaya_bahan_bulan_ini: number;
}

export interface DashboardPendapatan {
  hari_ini: number;
  bulan_ini: number;
  laba_kotor_hari_ini: number;
  laba_kotor_bulan_ini: number;
  kemarin: number;
  /** Null bila kemarin tidak ada penjualan — pembagian nol dicegah di server. */
  perubahan_persen: number | null;
  rata2_transaksi: number;
  tunai_di_laci: number;
}

export interface TitikPenjualan {
  tanggal: string;
  label: string;
  label_penuh: string;
  transaksi: number;
  omzet: number;
  laba_kotor: number;
}

export interface TitikProduksi {
  tanggal: string;
  label: string;
  label_penuh: string;
  batch: number;
  unit: number;
  gagal: number;
}

export interface DashboardStok {
  habis: number;
  menipis: number;
  aman: number;
  total_item: number;
  rinci: Record<string, number>;
  nilai_persediaan: number;
  perlu_perhatian: AttentionItem[];
}

export interface BatchAktif {
  id: number;
  batch_number: string;
  product_name: string | null;
  target_quantity: number;
  unit: string;
  operator_name: string | null;
  started_at: string | null;
  progress_percent: number;
  completed_stages: number;
  total_stages: number;
  current_stage_label: string | null;
  current_stage_status: string | null;
  is_overdue: boolean;
}

export interface PenerimaanTerakhir {
  id: number;
  receipt_number: string;
  po_number: string | null;
  supplier_name: string;
  receipt_date: string | null;
  items_count: number;
  total_value: number;
  received_by: string | null;
}

export interface Aktivitas {
  jenis: 'penjualan' | 'produksi' | 'pembelian';
  label: string;
  judul: string;
  keterangan: string;
  nilai: number;
  oleh: string | null;
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  waktu: string | null;
  tautan: string;
}

export interface OwnerDashboard {
  penjualan: DashboardPenjualan;
  produksi: DashboardProduksi;
  pendapatan: DashboardPendapatan;
  produk_terlaris: {
    product_id: number | null;
    name: string;
    unit: string;
    total_qty: number;
    total_nilai: number;
    total_laba: number;
  }[];
  grafik_penjualan: TitikPenjualan[];
  grafik_produksi: TitikProduksi[];
  stok: DashboardStok;
  batch_aktif: BatchAktif[];
  supplier_terakhir: PenerimaanTerakhir[];
  aktivitas_terkini: Aktivitas[];
  periode: { hari: number; dari: string; sampai: string; bulan_label: string };
  diperbarui_pada: string;
}
