import { Route, Repeat, Plug, Network, BarChart3 } from 'lucide-react';
import { Tab } from './types';
import { ScaffoldSection } from './ui';

/** Tab yang belum punya konfigurasi fungsional. */
export default function PlaceholderTabs({ tab }: { tab: Tab }) {
  return (
    <>
    {/* Aksi AI & routing */}
    {tab === 'routing' && (
      <ScaffoldSection
        icon={Route}
        title="Aksi AI & routing"
        description="Tentukan aksi yang boleh dilakukan AI dan bagaimana percakapan diarahkan ke tim atau pipeline yang tepat."
        items={[
          'Aksi terarah: kirim katalog, buat pesanan, cek status, atau eskalasi ke manusia.',
          'Aturan routing berdasarkan topik, kata kunci, atau niat pelanggan.',
          'Batas wewenang AI dan kondisi kapan harus berhenti membalas.',
        ]}
      />
    )}

    {/* Follow-up */}
    {tab === 'followup' && (
      <ScaffoldSection
        icon={Repeat}
        title="Follow-up"
        description="Kirim pesan susulan otomatis ketika pelanggan belum merespons atau percakapan perlu diingatkan kembali."
        items={[
          'Jadwal follow-up: 1 jam, 1 hari, atau 3 hari setelah pesan terakhir.',
          'Templat pesan susulan yang bisa disesuaikan per pipeline.',
          'Berhenti otomatis saat pelanggan sudah membalas.',
        ]}
      />
    )}

    {/* Integrasi */}
    {tab === 'integration' && (
      <ScaffoldSection
        icon={Plug}
        title="Integrasi"
        description="Hubungkan agent dengan channel WhatsApp, CRM, dan tools lain agar konteks pelanggan selalu lengkap."
        items={[
          'Pilih channel aktif dan atur agent mana yang melayani tiap channel.',
          'Sinkronisasi kontak dan riwayat percakapan ke CRM.',
          'Akses tools eksternal seperti cek ongkir, stok, atau pembayaran.',
        ]}
      />
    )}

    {/* Orkestrasi */}
    {tab === 'orchestration' && (
      <ScaffoldSection
        icon={Network}
        title="Orkestrasi"
        description="Atur bagaimana beberapa agent atau tim berkoordinasi menangani satu percakapan."
        items={[
          'Pembagian tugas antar agent berdasarkan topik atau pipeline.',
          'Serah terima percakapan ke agent lain tanpa kehilangan konteks.',
          'Prioritas dan antrean saat volume pesan meningkat.',
        ]}
      />
    )}

    {/* Evaluasi */}
    {tab === 'evaluation' && (
      <ScaffoldSection
        icon={BarChart3}
        title="Evaluasi"
        description="Pantau kualitas jawaban AI dan kepuasan pelanggan dari waktu ke waktu."
        items={[
          'Skor relevansi jawaban dan tingkat penggunaan knowledge.',
          'Deteksi jawaban yang perlu diperbaiki atau dieskalasi.',
          'Riwayat perubahan perilaku AI per versi agent.',
        ]}
      />
    )}
    </>
  );
}

