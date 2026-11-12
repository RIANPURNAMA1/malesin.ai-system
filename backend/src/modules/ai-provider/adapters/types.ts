export type AiProviderId = 'OPENAI' | 'ANTHROPIC' | 'GOOGLE' | 'GROQ';

export interface ProviderConfig {
  id: AiProviderId;
  name: string;
  description: string;
  keyPlaceholder: string;
  defaultModels: string[];
}

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiChatParams {
  model: string;
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface AiChatResult {
  text: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

/**
 * Kontrak adapter tiap provider. Modul AI Agent hanya bergantung pada interface
 * ini, sehingga menambah provider baru cukup membuat satu adapter baru.
 */
export interface AiAdapter {
  id: AiProviderId;
  /** Ambil daftar model aktual dari API provider memakai API key user. */
  listModels(apiKey: string): Promise<string[]>;
  /** Kirim percakapan ke provider dan kembalikan teks balasan. */
  chat(apiKey: string, params: AiChatParams): Promise<AiChatResult>;
}

export function splitSystemMessage(messages: AiChatMessage[]) {
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const conversation = messages.filter(m => m.role !== 'system');
  return { system, conversation };
}
