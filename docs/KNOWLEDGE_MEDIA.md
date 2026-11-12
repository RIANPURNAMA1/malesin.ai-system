# Knowledge Base Media (Gambar) & Auto Media Response

Fitur ini memungkinkan admin mengunggah gambar ke Knowledge Base AI Agent,
menyimpannya sebagai URL publik, memakainya sebagai konteks RAG, lalu
mengirimkannya otomatis lewat WhatsApp ketika relevan dengan pertanyaan
pelanggan.

## 1. Perubahan Database

Migrasi: `backend/prisma/migrations/20260629000000_add_ai_knowledge_media/migration.sql`

Tabel baru `ai_knowledge_media`:

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| `id` | VARCHAR(191) PK | UUID |
| `companyId` | VARCHAR(191) FK | Relasi ke `companies`, cascade delete |
| `knowledgeId` | VARCHAR(191) FK | Relasi ke `ai_knowledge`, cascade delete |
| `filename` | VARCHAR(191) | Nama file asli (sudah disanitasi) |
| `mimeType` | VARCHAR(191) | `image/jpeg`, `image/png`, `image/webp` |
| `fileSize` | INTEGER | Ukuran byte |
| `storagePath` | TEXT | Path relatif terhadap folder `uploads/` |
| `publicUrl` | TEXT | URL absolut yang bisa diakses publik |
| `altText` | VARCHAR(191) | Teks alternatif/caption singkat |
| `description` | TEXT | Deskripsi tambahan untuk konteks AI |
| `createdAt` | DATETIME(3) | Waktu upload |

Relasi Prisma: `Company.aiKnowledgeMedia` dan `AiKnowledge.media`.

Terapkan migrasi:

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

## 2. Penyimpanan File

- File disimpan di `uploads/knowledge/<companyId>/` (storage yang sudah ada,
  bukan sistem upload baru).
- Nama file selalu unik: `<timestamp>-<uuid>.<ext>`; nama asli hanya disimpan
  sebagai metadata sehingga path traversal tidak mungkin.
- Maksimal **5 gambar** per request, **5MB** per gambar.
- Format: JPG, JPEG, PNG, WEBP. MIME dan ekstensi divalidasi, lalu isi file
  dicek lewat magic bytes (`assertImageSignature`).
- Static `/uploads` dilayani dengan `Cross-Origin-Resource-Policy: cross-origin`
  dan `X-Content-Type-Options: nosniff` agar bisa tampil di dashboard dan
  diambil gateway, tanpa bisa dieksekusi sebagai script.

### URL publik

`publicUrl` dibentuk dari `PUBLIC_BASE_URL` bila diset, atau dari host request:

```env
PUBLIC_BASE_URL=https://malesinai.mendunia.id
```

Untuk produksi di balik reverse proxy, set `PUBLIC_BASE_URL` ke domain publik
backend agar WhatsApp/provider AI bisa mengunduh gambar.

## 3. API Baru

Semua endpoint memakai autentikasi yang sama dan hanya untuk role
`OWNER`/`ADMIN` pada operasi tulis.

| Method | Endpoint | Body | Keterangan |
| --- | --- | --- | --- |
| `POST` | `/api/ai-agents/:agentId/knowledge/:knowledgeId/media` | `multipart/form-data`, field `files` (multiple), opsional `altTexts`/`descriptions` (JSON array string) | Upload 1–5 gambar |
| `PUT` | `/api/ai-agents/:agentId/knowledge/:knowledgeId/media/:mediaId` | `{ altText?, description? }` | Update metadata |
| `DELETE` | `/api/ai-agents/:agentId/knowledge/:knowledgeId/media/:mediaId` | — | Hapus DB + file disk |

`GET /api/ai-agents/:agentId/knowledge` sekarang menyertakan `media[]` pada
setiap knowledge (backward compatible: field baru, field lama tetap ada).

## 4. Alur RAG & Respons AI

1. Retrieval knowledge tetap berbasis keyword scoring (`retrieveDetailed`).
2. Hanya knowledge dengan **skor > 0** yang media-nya boleh dikirim; knowledge
   fallback (skor 0) hanya dipakai sebagai konteks teks.
3. Media dirujuk ke LLM lewat `media_id`, bukan URL. Prompt meminta penanda
   `[[media:<id>]]`, sehingga LLM tidak bisa mengarang URL.
4. Server memvalidasi setiap gambar pada output AI terhadap daftar media dari
   database (id atau URL harus cocok). Format JSON
   `{ "messages": [{ "type": "text" }, { "type": "image", "url": "..." }] }`
   juga didukung secara defensif.
5. Maksimal **2 gambar** per balasan. Media manual di tab Media tetap berjalan
   (keyword trigger) dan digabung dengan media knowledge.
6. Respons internal berbentuk `messages[]` (`text`/`image`), sementara field
   lama `reply`, `usedKnowledge`, `usedMedia`, dan `attachments` tetap diisi
   untuk kompatibilitas.

## 5. Pengiriman WhatsApp

`AiAutoReplyService` dipanggil untuk pesan teks masuk (bukan grup) dari:

- webhook WhatsApp resmi (`webhook.handler.ts`), dan
- WhatsApp unofficial/Baileys (`whatsapp-unofficial.service.ts`).

Urutan pengiriman mengikuti output AI: teks lebih dulu, lalu gambar.
Kegagalan gambar dicatat (`logger.error`, pesan `FAILED`) dan **tidak**
membatalkan teks atau gambar lain. URL gambar tidak pernah dikirim sebagai teks
biasa bila channel mendukung gambar native.

Agent dipilih dari `channel.metadata.aiAgentId`. Bila tidak diset, dipakai AI
Agent aktif pertama milik company. Channel dapat mematikan bagian tertentu:

```json
{ "aiAgentId": "<id>", "aiUseKnowledge": true, "aiUseMedia": true }
```

### Kirim gambar Baileys

`sendImageMessage` menerima URL `http(s)`, data URL, atau base64 mentah. URL
diunduh ke buffer (timeout 20 detik, maks. 10MB) sebelum dikirim, sehingga
kompatibel dengan pemakaian lama yang mengirim base64.

## 6. UI Admin

Pada tab **Knowledge Base → Tambah Knowledge**, di bawah editor teks terdapat
area **Gambar pendukung**:

- pilih beberapa gambar sekaligus, preview sebelum disimpan, hapus preview;
- mode Create: gambar disimpan bersama knowledge saat agent dibuat;
- mode Edit: gambar langsung diupload ke knowledge yang sudah tersimpan;
- setiap gambar tersimpan punya tombol hapus (ganti gambar = hapus lalu upload
  ulang).

## 7. Catatan Keamanan

- Validasi akses: semua query dibatasi `companyId`; agent dan knowledge
  diverifikasi kepemilikannya sebelum upload/update/delete.
- Validasi MIME + ekstensi + magic bytes; nama file unik; ukuran dibatasi.
- Penghapusan file memakai guard path agar tidak bisa keluar dari `uploads/`.
- File statis tidak dieksekusi dan diberi `nosniff`.

## 8. Perilaku AI (Behavior Editor)

Migrasi: `backend/prisma/migrations/20261112000000_add_ai_agent_behavior/migration.sql`

Kolom baru pada `ai_agents`:

| Kolom | Tipe | Keterangan |
| --- | --- | --- |
| `welcomeMessage` | TEXT NULL | Pesan sambutan sekali di awal percakapan |
| `communicationStyle` | TEXT NULL | Gaya/nada komunikasi AI |
| `conversationFlow` | TEXT NULL | Alur percakapan yang diikuti AI |
| `communicationRules` | TEXT NULL | Aturan & batasan AI |
| `additionalInstructions` | JSON NULL | Array `{ id, content, pipeline }` |
| `version` | INTEGER default 1 | Naik otomatis setiap update agent |

### API perilaku

`POST /api/ai-agents` dan `PUT /api/ai-agents/:id` menerima field perilaku di
atas. `additionalInstructions` dinormalisasi backend:

- `content` dipotong maksimal **100 karakter** dan item kosong dibuang;
- `pipeline` kosong/`null` berarti instruksi berlaku untuk **semua pelanggan**;
- bila diisi, instruksi hanya dipakai saat nama/tipe channel cocok dengan
  pipeline (pencocokan teks case-insensitive);
- update dengan array kosong menghapus semua instruksi (`JSON NULL`).

`version` selalu bertambah satu pada setiap `PUT`, sehingga UI bisa menampilkan
badge **Versi N**.

`POST /api/ai-agents/test-response` juga menerima field perilaku yang sama.
Pratinjau menampilkan **semua** instruksi (tanpa filter pipeline).

### Perilaku saat auto-reply

1. `welcomeMessage` dikirim sebagai teks sebelum balasan AI, tetapi hanya jika
   percakapan belum punya pesan `OUTBOUND` sama sekali (sekali per percakapan).
2. `communicationStyle`, `conversationFlow`, `communicationRules`, dan
   instruksi tambahan yang cocok digabung ke system prompt sebelum konteks
   knowledge dan katalog media.
3. Kegagalan mengirim pesan sambutan dicatat dan tidak membatalkan balasan AI.

### Struktur editor AI Agent

Sidebar editor mengikuti urutan:

1. **Perilaku AI** — pesan sambutan, komunikasi inti (gaya, alur, aturan), dan
   instruksi tambahan (maks. 100 karakter, pipeline opsional).
2. **Basis pengetahuan** — sub-tab Knowledge dan Media (knowledge media + media
   manual tetap terpisah).
3. **Aksi AI & routing**, **Follow-up**, **Integrasi**, **Orkestrasi**,
   **Evaluasi** — panel informasi/scaffold (belum fungsional).
4. **Konfigurasi AI** — informasi dasar, provider/model, system prompt, status.
5. **Pratinjau** — test connection dan test response memakai semua konfigurasi,
   termasuk perilaku dan knowledge yang belum disimpan.
6. Badge **Versi N** ditampilkan di header dan sidebar.

