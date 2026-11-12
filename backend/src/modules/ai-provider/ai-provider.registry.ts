import { AiAdapter, AiProviderId, ProviderConfig } from './adapters/types';
import { openaiAdapter } from './adapters/openai.adapter';
import { anthropicAdapter } from './adapters/anthropic.adapter';
import { googleAdapter } from './adapters/google.adapter';
import { groqAdapter } from './adapters/groq.adapter';

/**
 * Daftar provider yang didukung beserta model default (fallback).
 * Model default dipakai kalau user belum memasukkan API key,
 * atau sebagai cadangan saat endpoint live gagal diakses.
 */
export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'OPENAI',
    name: 'OpenAI (GPT)',
    description: 'Model GPT dari OpenAI',
    keyPlaceholder: 'sk-...',
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  {
    id: 'ANTHROPIC',
    name: 'Anthropic (Claude)',
    description: 'Model Claude dari Anthropic',
    keyPlaceholder: 'sk-ant-...',
    defaultModels: [
      'claude-3-5-sonnet-latest',
      'claude-3-5-haiku-latest',
      'claude-3-opus-latest',
      'claude-3-haiku-20240307',
    ],
  },
  {
    id: 'GOOGLE',
    name: 'Google (Gemini)',
    description: 'Model Gemini dari Google AI Studio',
    keyPlaceholder: 'AIza...',
    defaultModels: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash-8b'],
  },
  {
    id: 'GROQ',
    name: 'Groq',
    description: 'Inference cepat untuk model open-source',
    keyPlaceholder: 'gsk_...',
    defaultModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'],
  },
];

const ADAPTERS: Record<AiProviderId, AiAdapter> = {
  OPENAI: openaiAdapter,
  ANTHROPIC: anthropicAdapter,
  GOOGLE: googleAdapter,
  GROQ: groqAdapter,
};

export function getProvider(id: string): ProviderConfig | undefined {
  return PROVIDERS.find(p => p.id === id);
}

export function getAdapter(id: string): AiAdapter | undefined {
  return ADAPTERS[id as AiProviderId];
}
