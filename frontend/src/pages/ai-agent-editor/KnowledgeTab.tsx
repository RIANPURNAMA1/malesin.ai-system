import { useState } from 'react';
import { BookOpen, Plus, Trash2, Image, Loader2, Upload, X, Paperclip, Save, Globe, FileText, HelpCircle, Package } from 'lucide-react';
import InsertMediaModal from './InsertMediaModal';
import { AiMediaTrigger } from '../../types';
import { RichTextEditor, Spinner } from '../../components/ui/index';
import { KB_SOURCES } from './constants';
import { knowledgeKind, KnowledgeKind } from './utils';
import { KbSource } from './types';
import type { AgentEditor } from './useAgentEditor';

type View = KbSource | 'media';
const TABS: { id: View; label: string }[] = [...KB_SOURCES, { id: 'media', label: 'Media' }];

const INPUT =
  'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20';

const KIND_META: Record<Exclude<KnowledgeKind, 'doc'>, { icon: typeof Globe; label: string; empty: string; prefix?: string }> = {
  web: { icon: Globe, label: 'Situs web', empty: 'Belum ada situs web yang ditambahkan.' },
  file: { icon: FileText, label: 'File', empty: 'Belum ada file yang ditambahkan.', prefix: '[File] ' },
  qa: { icon: HelpCircle, label: 'Q&A', empty: 'Belum ada Q&A yang ditambahkan.' },
  product: { icon: Package, label: 'Produk', empty: 'Belum ada produk yang ditambahkan.', prefix: '[Produk] ' },
  legacy: { icon: BookOpen, label: 'Knowledge lama (dengan gambar)', empty: '' },
};

export default function KnowledgeTab({ ed }: { ed: AgentEditor }) {
  const [insertOpen, setInsertOpen] = useState(false);
  const {
    isEdit, knowledgeView, setKnowledgeView, kbSource, setKbSource,
    kbTitle, setKbTitle, kbContent, setKbContent, kbEditorKey, setKbEditorKey,
    kbFields, setKbFields, kbFiles, setKbFiles, kbBusy, kbDrag, setKbDrag, addKbFiles, handleAddKnowledge,
    kbDoc, updateKbDoc, kbDocKey, setKbDocKey, kbDocDirty, saveDocMutation,
    loadingKnowledge, displayKnowledge, handleDeleteKnowledge,
    mbTitle, setMbTitle, mbUrl, setMbUrl, mbCaption, setMbCaption, mbDesc, setMbDesc,
    mbKeywords, setMbKeywords, mbTrigger, setMbTrigger, loadingMedia, displayMedia,
    addMediaMutation, handleAddMedia, handleDeleteMedia,
  } = ed;

  const view: View = knowledgeView === 'media' ? 'media' : kbSource;
  const selectView = (v: View) => {
    if (v === 'media') { setKnowledgeView('media'); return; }
    setKnowledgeView('knowledge');
    setKbSource(v);
  };

  const entries = displayKnowledge.map((k, index) => ({ ...k, index, kind: knowledgeKind(k) }));
  const ofKind = (kind: KnowledgeKind) => entries.filter(e => e.kind === kind);
  const legacyWithMedia = entries.filter(e => e.kind === 'legacy' && e.media.length > 0);

  const appendLines = (base: string, urls: string[]) =>
    base.trimEnd() ? `${base.trimEnd()}\n${urls.join('\n')}` : urls.join('\n');

  /** Daftar knowledge per jenis (Situs web, File, Q&A, Produk). */
  const EntryList = ({ kind }: { kind: Exclude<KnowledgeKind, 'doc'> }) => {
    const meta = KIND_META[kind];
    const items = kind === 'legacy' ? legacyWithMedia : ofKind(kind);
    if (kind === 'legacy' && !items.length) return null;
    const Icon = meta.icon;
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          {meta.label} {items.length > 0 && <span className="font-normal text-gray-400">({items.length})</span>}
        </h3>
        {isEdit && loadingKnowledge ? (
          <div className="flex justify-center py-6"><Spinner className="h-5 w-5 text-primary" /></div>
        ) : items.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">{meta.empty}</p>
        ) : (
          <ul className="space-y-2">
            {items.map(k => (
              <li key={k.id ?? `pending-${k.index}`} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {meta.prefix ? k.title.replace(meta.prefix, '') : k.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-gray-500">{k.content}</p>
                  {k.media.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {k.media.map(m => (
                        <img key={m.id} src={m.publicUrl} alt={m.altText || m.filename} className="h-12 w-12 rounded border border-gray-200 object-cover" />
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteKnowledge(k.id, k.index, k.title)}
                  className="flex-shrink-0 text-gray-300 transition hover:text-danger"
                  title="Hapus"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-4">
      {/* Sub-tab */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => selectView(t.id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              view === t.id ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Teks: satu editor untuk seluruh pengetahuan */}
      {view === 'text' && (
        <>
          <section className="rounded-xl border border-gray-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500">
                Tulis semua pengetahuan bisnis di sini. Tempel URL gambar agar AI bisa mengirim gambarnya ke chat.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInsertOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Paperclip className="h-3.5 w-3.5" /> Sisipkan media dan file
                </button>
                {isEdit && (
                  <button
                    type="button"
                    onClick={() => saveDocMutation.mutate()}
                    disabled={!kbDocDirty || saveDocMutation.isPending}
                    className="gradient-btn px-4 py-2 text-sm disabled:opacity-50"
                  >
                    {saveDocMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Simpan
                  </button>
                )}
              </div>
            </div>
            <div className="p-4">
              <RichTextEditor
                key={kbDocKey}
                value={kbDoc}
                onChange={updateKbDoc}
                placeholder="Contoh: Jam operasional kami Senin–Jumat 09.00–17.00. Persyaratan pendaftaran: ..."
                className="[&_.tiptap-content]:min-h-[420px]"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                <span>
                  {!isEdit
                    ? 'Akan disimpan bersama agent saat klik Buat Agent.'
                    : kbDocDirty ? 'Ada perubahan yang belum disimpan.' : 'Semua perubahan tersimpan.'}
                </span>
                <span>{kbDoc.length.toLocaleString('id-ID')} karakter</span>
              </div>
            </div>
          </section>
          <EntryList kind="legacy" />
        </>
      )}

      {/* Situs web / File / Q&A / Produk */}
      {(view === 'web' || view === 'file' || view === 'qa' || view === 'product') && (
        <>
          <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
            {view !== 'file' && (
              <input
                value={kbTitle}
                onChange={e => setKbTitle(e.target.value)}
                placeholder={{ web: 'Judul (opsional, default: URL)', qa: 'Pertanyaan (mis. Berapa lama pengiriman?)', product: 'Nama produk' }[view]}
                className={INPUT}
              />
            )}

            {view === 'web' && (
              <input
                value={kbFields.url}
                onChange={e => setKbFields(f => ({ ...f, url: e.target.value }))}
                placeholder="https://contoh.com/halaman"
                className={INPUT}
              />
            )}

            {view === 'qa' && (
              <textarea
                value={kbFields.answer}
                onChange={e => setKbFields(f => ({ ...f, answer: e.target.value }))}
                placeholder="Jawaban"
                rows={4}
                className={INPUT}
              />
            )}

            {view === 'product' && (
              <>
                <input
                  value={kbFields.price}
                  onChange={e => setKbFields(f => ({ ...f, price: e.target.value }))}
                  placeholder="Harga (mis. Rp150.000)"
                  className={INPUT}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setInsertOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Paperclip className="h-3.5 w-3.5" /> Sisipkan media dan file
                  </button>
                </div>
                <RichTextEditor key={kbEditorKey} value={kbContent} onChange={setKbContent} placeholder="Deskripsi produk..." />
              </>
            )}

            {view === 'file' && (
              <div className="space-y-2">
                <label
                  onDragOver={e => { e.preventDefault(); setKbDrag(true); }}
                  onDragLeave={() => setKbDrag(false)}
                  onDrop={e => { e.preventDefault(); setKbDrag(false); addKbFiles(e.dataTransfer.files); }}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${
                    kbDrag ? 'border-primary bg-primary/5' : 'border-gray-300 bg-gray-50/60 hover:bg-gray-50'
                  }`}
                >
                  <Upload className="h-6 w-6 text-gray-400" />
                  <span className="text-sm text-gray-600">Seret &amp; lepas file Anda di sini atau klik untuk memilih file</span>
                  <input type="file" accept=".pdf,application/pdf" multiple className="hidden"
                    onChange={e => { addKbFiles(e.target.files); e.target.value = ''; }} />
                </label>
                <p className="text-xs text-gray-500">Jenis file yang didukung: .pdf</p>
                <p className="text-xs text-gray-500">Jika Anda mengunggah PDF, pastikan teksnya dapat di-highlight</p>
                <div className="text-xs text-gray-700">
                  <span className="font-medium">Akan ditambahkan:</span>{' '}
                  {kbFiles.length === 0 ? '-' : (
                    <span className="inline-flex flex-wrap gap-1.5 align-middle">
                      {kbFiles.map((f, i) => (
                        <span key={f.name + i} className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5">
                          {f.name}
                          <button type="button" onClick={() => setKbFiles(p => p.filter((_, idx) => idx !== i))}>
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-gray-400">
                {isEdit ? '' : 'Akan disimpan bersama agent saat klik Buat Agent.'}
              </p>
              <button onClick={handleAddKnowledge} disabled={kbBusy} className="gradient-btn px-4 py-2.5 text-sm disabled:opacity-50">
                {kbBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Tambah
              </button>
            </div>
          </section>
          <EntryList kind={view} />
        </>
      )}

      {/* Media: gambar dengan trigger kata kunci / AI */}
      {view === 'media' && (
        <>
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-1 flex items-center gap-2">
              <Image className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-gray-900">Tambah Media / Gambar</h2>
            </div>
            <p className="mb-4 text-xs text-gray-500">
              Pilih trigger <b>KEYWORD</b> agar gambar dikirim otomatis saat kata kunci muncul di pesan, atau <b>AI</b> agar AI memutuskan sendiri kapan mengirimnya.
            </p>
            <div className="space-y-3">
              <input value={mbTitle} onChange={e => setMbTitle(e.target.value)} placeholder="Judul (mis. Voucher Diskon 50%)" className={INPUT} />
              <input value={mbUrl} onChange={e => setMbUrl(e.target.value)} placeholder="URL gambar (mis. https://contoh.com/voucher.jpg)" className={`${INPUT} font-mono`} />
              <input value={mbCaption} onChange={e => setMbCaption(e.target.value)} placeholder="Caption (opsional)" className={INPUT} />
              <input value={mbDesc} onChange={e => setMbDesc(e.target.value)} placeholder="Deskripsi untuk AI (dipakai saat trigger = AI)" className={INPUT} />
              <input value={mbKeywords} onChange={e => setMbKeywords(e.target.value)} placeholder="Kata kunci (pisahkan koma, hanya trigger KEYWORD)" className={INPUT} />
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Trigger</label>
                <select value={mbTrigger} onChange={e => setMbTrigger(e.target.value as AiMediaTrigger)} className={`${INPUT} w-auto`}>
                  <option value="KEYWORD">KEYWORD — otomatis saat kata kunci cocok</option>
                  <option value="AI">AI — AI memutuskan sendiri</option>
                </select>
              </div>
              <button onClick={handleAddMedia} disabled={addMediaMutation.isPending} className="gradient-btn px-4 py-2.5 text-sm disabled:opacity-50">
                {addMediaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Tambah media
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Media {displayMedia.length > 0 && <span className="font-normal text-gray-400">({displayMedia.length})</span>}
            </h3>
            {isEdit && loadingMedia ? (
              <div className="flex justify-center py-6"><Spinner className="h-5 w-5 text-primary" /></div>
            ) : displayMedia.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">Belum ada media untuk agent ini.</p>
            ) : (
              <ul className="space-y-2">
                {displayMedia.map((m, index) => (
                  <li key={m.id ?? `pending-${index}`} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                    <img src={m.mediaUrl} alt={m.title} className="h-14 w-14 flex-shrink-0 rounded-lg border border-gray-200 object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{m.title}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{m.mediaUrl}</p>
                      {m.caption && <p className="mt-0.5 text-xs text-gray-500">{m.caption}</p>}
                      <span className={`mt-1 inline-block rounded border px-2 py-0.5 text-[10px] ${m.trigger === 'AI' ? 'border-primary/20 bg-primary/5 text-primary' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
                        {m.trigger}
                      </span>
                    </div>
                    <button onClick={() => handleDeleteMedia(m.id, index, m.title)} className="flex-shrink-0 text-gray-300 transition hover:text-danger" title="Hapus">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {insertOpen && (
        <InsertMediaModal
          onClose={() => setInsertOpen(false)}
          onInsert={urls => {
            // Editor menyimpan teks polos: sisipkan URL di baris baru lalu render ulang editornya.
            if (view === 'product') {
              setKbContent(appendLines(kbContent, urls));
              setKbEditorKey(k => k + 1);
            } else {
              updateKbDoc(appendLines(kbDoc, urls));
              setKbDocKey(k => k + 1);
            }
          }}
        />
      )}
    </div>
  );
}
