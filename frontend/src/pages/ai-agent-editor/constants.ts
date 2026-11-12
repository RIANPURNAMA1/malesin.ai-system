import { MessageSquare, Brain, GitBranch } from 'lucide-react';
import { KbSource, FormState } from './types';

/** Batas mengikuti validasi backend. */
export const MAX_KB_IMAGES = 5;

export const MAX_KB_IMAGE_BYTES = 5 * 1024 * 1024;

export const KB_IMAGE_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/** Batas karakter instruksi tambahan (validasi backend juga memotong di 100). */
export const MAX_INSTRUCTION_CHARS = 100;

/** Judul knowledge yang menampung isi editor "Teks" (satu dokumen per agent). */
export const KB_TEXT_TITLE = 'Pengetahuan Teks';

export const KB_SOURCES: { id: KbSource; label: string }[] = [
  { id: 'text', label: 'Teks' },
  { id: 'web', label: 'Situs web' },
  { id: 'file', label: 'File' },
  { id: 'qa', label: 'Q&A' },
  { id: 'product', label: 'Produk' },
];

export const EMPTY_KB_FIELDS = { url: '', answer: '', price: '' };

export const PDFJS_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/';

export const BEHAVIOR_SECTIONS = [
  { key: 'welcome', icon: MessageSquare, title: 'Pesan sambutan', hint: 'Sapaan satu kali pada interaksi pertama' },
  { key: 'core', icon: Brain, title: 'Komunikasi inti AI', hint: 'Menentukan perilaku AI melalui gaya, alur, dan aturan' },
  { key: 'extra', icon: GitBranch, title: 'Instruksi tambahan', hint: 'Panduan AI tambahan untuk semua situasi pelanggan' },
];

export const TEXTAREA_CLS =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20 resize-y';

export const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  provider: 'OPENAI',
  apiKey: '',
  model: '',
  temperature: 0.7,
  maxTokens: 1024,
  systemPrompt: '',
  welcomeMessage: '',
  communicationStyle: '',
  conversationFlow: '',
  communicationRules: '',
  additionalInstructions: [],
  version: 1,
  isActive: true,
};


