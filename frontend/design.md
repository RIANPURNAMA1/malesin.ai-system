# Spesifikasi Desain Antarmuka (UI/UX) - Platform Chat AI

## 1. Ikhtisar
Dokumen ini menguraikan struktur dan komponen desain dari antarmuka dashboard platform komunikasi terintegrasi AI. Desain ini mengusung pendekatan *clean*, *minimalist*, dan profesional, sangat ideal untuk diimplementasikan ke dalam komponen berbasis React dengan penataan gaya menggunakan Tailwind CSS.

## 2. Struktur Layout Utama
Aplikasi menggunakan tata letak layar penuh (100vh) yang dibagi menjadi empat area grid atau flexbox utama:

- **App Sidebar (Kiri Jauh):** Kolom navigasi vertikal yang sangat ramping untuk berpindah antar modul utama.
- **Top Navigation Bar (Atas):** Bilah navigasi horizontal untuk sub-modul dan manajemen akun pengguna.
- **Inbox Panel / Daftar Pesan (Kolom Kiri):** Panel daftar obrolan aktif yang posisinya tetap di sebelah kiri.
- **Main Content Area (Area Tengah-Kanan):** Ruang kerja utama yang bersifat dinamis (pada tampilan ini menunjukkan layar orientasi/onboarding).

---

## 3. Spesifikasi Komponen

### 3.1 App Sidebar (Modul Utama)
- **Dimensi:** Lebar tetap (sekitar `w-16`).
- **Visual:** Background putih dengan border kanan tipis (`border-r border-slate-200`).
- **Elemen:**
  - Logo/Ikon platform di bagian paling atas.
  - Tumpukan ikon vertikal (Dashboard, Chat, Kontak, Analytics, dsb.).
  - Ikon Pengaturan (Gear) diposisikan di bagian bawah (`mt-auto`).
- **Interaksi:** State aktif pada ikon ditandai dengan perubahan warna aksen atau latar belakang.

### 3.2 Top Navigation Bar
- **Dimensi:** Tinggi tetap (sekitar `h-14` atau `h-16`).
- **Visual:** Background putih, border bawah (`border-b border-slate-200`).
- **Sisi Kiri (Menu Horizontal):**
  - Tab teks: *Chat, Orders, CRM, Marketing, Automation*.
  - Tab aktif ("Chat") memiliki indikator garis bawah (border-bottom) tebal berwarna biru.
- **Sisi Kanan (Utilitas & Profil):**
  - Tombol aksi: "Manage plans" (gaya tombol *outline*).
  - Ikon fungsional: Papan klip, Agen Bot AI, Bantuan, Notifikasi Lonceng.
  - Dropdown Profil: Avatar pengguna beserta nama.

### 3.3 Inbox Panel (Daftar Obrolan)
- **Header Panel:**
  - Terdapat dropdown "All Agents" dan deretan ikon utilitas kecil (Search, Filter, Tambah, List).
  - Tab Navigasi: "Assigned" (dengan badge *count*) dan "Unassigned".
- **Daftar Item Obrolan (Chat Cards):**
  - Tata letak menggunakan flexbox baris.
  - **Identitas & Pesan:** Nama pengguna/nomor telepon (teks tebal), diikuti cuplikan pesan di bawahnya (teks terpotong/truncate).
  - **Meta Data:** Waktu pesan terakhir di sudut kanan atas (misal: "Yesterday 13:25").
  - **Status & Platform:** Label/badge "Assigned" (latar biru sangat pudar), ikon WhatsApp hijau menandakan sumber jalur, dan teks penanda (seperti "RTCK").
  - **Notifikasi:** Indikator jumlah pesan belum terbaca berupa *badge* sirkular solid (biru/merah).
  - **Interaksi:** Item yang disorot/dipilih menggunakan latar belakang sedikit gelap (`bg-slate-50`).

### 3.4 Main Content Area (Layar Onboarding)
- **Visual Dasar:** Area luas berwarna putih polos.
- **Posisi:** Konten dipusatkan di tengah layar.
- **Header Konten:** Teks sambutan besar "Welcome back to Cekat.AI!" (font-weight *medium* atau *semibold*, warna teks dominan gelap `text-slate-800`).
- **Daftar Langkah (Onboarding Cards):**
  - Terdiri dari 4 kartu yang tersusun vertikal dengan jarak (*gap*) konsisten.
  - **Gaya Kartu:** Sudut membulat (`rounded-lg`), border tipis (`border border-slate-200`), *padding* memadai, dan efek bayangan interaktif (*hover shadow*).
  - **Tata Letak Kartu:** - **Kiri:** Ilustrasi grafis atau ikon 3D (Amplop email, Robot/AI Bot, Petugas Layanan Pelanggan, Ikon Tautan/Link).
    - **Kanan:** - Judul langkah (misal: "1. Connect platforms") dengan *font-weight* tebal.
      - Deskripsi instruksional singkat (`text-sm text-slate-500`).
- **Elemen Pendukung:** Tautan bantuan tekstual berwarna biru di bawah kartu ("Need more help? Watch our YouTube tutorials").
- **Floating Action Button (FAB):** Tombol aksi melayang di sudut kanan bawah dengan ikon dokumen/pena.

---

## 4. Panduan Desain Global (Sistem UI)

- **Tipografi:** Menggunakan keluarga font Sans-Serif yang modern dan bersih (seperti Inter atau Roboto). 
- **Palet Warna Utama:**
  - **Background:** Putih murni `#FFFFFF` dan abu-abu sangat muda `#F8FAFC`.
  - **Aksen Primer:** Biru (digunakan untuk link, tab aktif, dan tombol penanda).
  - **Teks Utama:** Abu-abu sangat gelap (`slate-800` atau `slate-900`) untuk tingkat keterbacaan tinggi.
  - **Teks Sekunder:** Abu-abu medium (`slate-500`) untuk deskripsi dan *timestamp*.
  - **Warna Fungsional:** Hijau untuk ikon WhatsApp/kesuksesan, biru solid untuk *unread badges*.
- **Konsep Tampilan:** Bersih, pemisahan elemen menggunakan garis *border* tipis (1px solid abu-abu terang) daripada bayangan (*shadow*) berat, agar fokus tetap pada efisiensi manajerial data obrolan otomatisasi.