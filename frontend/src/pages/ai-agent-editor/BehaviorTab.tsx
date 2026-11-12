import { Plus, Trash2, MessageSquare, Brain, GitBranch, ChevronDown } from 'lucide-react';
import { MAX_INSTRUCTION_CHARS, BEHAVIOR_SECTIONS, TEXTAREA_CLS } from './constants';
import { SectionCard, FieldBox } from './ui';
import type { AgentEditor } from './useAgentEditor';

export default function BehaviorTab({ ed }: { ed: AgentEditor }) {
  const { id, form, collapsed, activeSection, toggleSection, goToSection, chat, set, addInstruction, updateInstruction, removeInstruction } = ed;
  return (
    <div className="flex items-start gap-6">
      {/* Panel kiri */}
      <aside className="sticky top-0 hidden w-[340px] flex-shrink-0 rounded-xl border border-gray-200 bg-white p-4 lg:block">
        <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-base font-semibold text-gray-900">
          <span className={`h-2 w-2 rounded-full ${form.isActive ? 'bg-success' : 'bg-gray-300'}`} />
          Versi {form.version}
          <ChevronDown className="h-4 w-4" />
        </div>
        <nav className="mt-4 space-y-1">
          {BEHAVIOR_SECTIONS.map(s => {
            const Icon = s.icon;
            const active = activeSection === s.key;
            return (
              <button
                key={s.key}
                onClick={() => goToSection(s.key)}
                className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${
                  active ? 'bg-primary/5' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <span className="min-w-0">
                  <span className={`block text-sm font-semibold ${active ? 'text-primary' : 'text-gray-900'}`}>{s.title}</span>
                  <span className="block text-xs text-gray-500">{s.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Konten kanan */}
      <div className="min-w-0 flex-1 space-y-4">
        <SectionCard
          id="welcome"
          icon={MessageSquare}
          title="Pesan sambutan"
          description="Sapaan satu kali yang dikirim saat pelanggan pertama kali memulai chat"
          open={!collapsed.welcome}
          onToggle={() => toggleSection('welcome')}
        >
          <textarea
            value={form.welcomeMessage}
            onChange={e => set('welcomeMessage', e.target.value)}
            rows={3}
            placeholder="Contoh: Halo! 👋 Selamat datang di [Business Name]. Saya siap membantu. Anda bisa bertanya soal harga, layanan, atau apa pun yang Anda butuhkan."
            className={TEXTAREA_CLS}
          />
          <p className="mt-2 text-xs text-gray-400">
            Hanya dikirim jika percakapan belum memiliki pesan keluar sama sekali.
          </p>
        </SectionCard>

        <SectionCard
          id="core"
          icon={Brain}
          title="Komunikasi inti AI"
          description="Mengatur cara AI berkomunikasi: nada bicara, alur percakapan, dan aturan yang diikuti"
          open={!collapsed.core}
          onToggle={() => toggleSection('core')}
        >
          <div className="space-y-4">
            <FieldBox title="Gaya komunikasi">
              <textarea
                value={form.communicationStyle}
                onChange={e => set('communicationStyle', e.target.value)}
                rows={3}
                placeholder="Contoh: Bersikaplah tenang dan empatik saat pelanggan kesal. Akui keluhan mereka dan bantu mereka menemukan solusi."
                className={TEXTAREA_CLS}
              />
            </FieldBox>
            <FieldBox title="Alur percakapan">
              <textarea
                value={form.conversationFlow}
                onChange={e => set('conversationFlow', e.target.value)}
                rows={3}
                placeholder="Contoh: jawab dengan jelas, arahkan pelanggan ke langkah berikutnya, dan eskalasikan bila perlu."
                className={TEXTAREA_CLS}
              />
            </FieldBox>
            <FieldBox title="Aturan & batasan">
              <textarea
                value={form.communicationRules}
                onChange={e => set('communicationRules', e.target.value)}
                rows={3}
                placeholder="Contoh: Tetap tenang dan sopan, bahkan saat pelanggan kesal. Arahkan percakapan kembali ke upaya membantu mereka dengan baik."
                className={TEXTAREA_CLS}
              />
            </FieldBox>
          </div>
        </SectionCard>

        <SectionCard
          id="extra"
          icon={GitBranch}
          title="Instruksi tambahan"
          description={`Panduan AI tambahan untuk semua situasi pelanggan (maks. ${MAX_INSTRUCTION_CHARS} karakter per instruksi)`}
          open={!collapsed.extra}
          onToggle={() => toggleSection('extra')}
        >
          <div className="space-y-3">
            {form.additionalInstructions.length === 0 && (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/60 px-4 py-6 text-center">
                <p className="text-sm text-gray-500">Belum ada instruksi tambahan.</p>
                <p className="mt-1 text-xs text-gray-400">
                  Buat instruksi terarah, lalu kosongkan pipeline agar berlaku untuk semua pelanggan.
                </p>
              </div>
            )}

            {form.additionalInstructions.map((instruction, index) => (
              <FieldBox key={instruction.id} title={`Instruksi ${index + 1}`}>
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeInstruction(instruction.id)}
                    className="text-gray-300 transition hover:text-danger"
                    title="Hapus instruksi"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <textarea
                  value={instruction.content}
                  onChange={e => updateInstruction(instruction.id, { content: e.target.value.slice(0, MAX_INSTRUCTION_CHARS) })}
                  rows={2}
                  maxLength={MAX_INSTRUCTION_CHARS}
                  placeholder="Contoh: Selalu tawarkan bantuan tambahan sebelum menutup percakapan."
                  className={`${TEXTAREA_CLS} resize-none`}
                />
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="flex flex-1 flex-col gap-1">
                    <label className="text-xs font-medium text-gray-600">Pipeline</label>
                    <input
                      value={instruction.pipeline ?? ''}
                      onChange={e => updateInstruction(instruction.id, { pipeline: e.target.value })}
                      placeholder="Kosongkan untuk semua pelanggan"
                      className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                  </div>
                  <span className={`text-[11px] ${instruction.content.length >= MAX_INSTRUCTION_CHARS ? 'text-danger' : 'text-gray-400'}`}>
                    {instruction.content.length}/{MAX_INSTRUCTION_CHARS}
                  </span>
                </div>
              </FieldBox>
            ))}

            <button
              type="button"
              onClick={addInstruction}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3.5 py-2 text-sm font-medium text-primary transition hover:bg-primary/10"
            >
              <Plus className="h-4 w-4" /> Tambah instruksi
            </button>
            <p className="text-xs text-gray-400">
              Pipeline kosong berarti instruksi berlaku untuk semua pelanggan. Isi nama pipeline untuk membatasi ke channel tertentu.
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

