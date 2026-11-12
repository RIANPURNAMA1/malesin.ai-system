import axios from 'axios';
import { AiAdapter, AiChatParams, AiChatResult } from './types';

const BASE = 'https://api.groq.com/openai/v1';

/**
 * Sebagian model Groq ber-ID dengan prefix vendor (mis. `openai/gpt-oss-120b`).
 * Kalau user mengetik tanpa prefix (`gpt-oss-120b`), cocokkan ke ID lengkapnya.
 * Hasil dicache per model supaya tidak memanggil /models setiap chat.
 */
const modelAliasCache = new Map<string, string>();
async function resolveModel(apiKey: string, model: string): Promise<string> {
  if (model.includes('/')) return model;
  const cached = modelAliasCache.get(model);
  if (cached) return cached;
  try {
    const ids: string[] = await groqAdapter.listModels(apiKey);
    const resolved = ids.includes(model) ? model : ids.find(id => id.endsWith(`/${model}`)) ?? model;
    modelAliasCache.set(model, resolved);
    return resolved;
  } catch {
    return model;
  }
}

export const groqAdapter: AiAdapter = {
  id: 'GROQ',

  async listModels(apiKey: string) {
    const res = await axios.get(`${BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 20000,
    });
    return (res.data?.data ?? []).map((m: any) => m.id as string).sort();
  },

  async chat(apiKey: string, params: AiChatParams): Promise<AiChatResult> {
    const res = await axios.post(
      `${BASE}/chat/completions`,
      {
        model: await resolveModel(apiKey, params.model),
        messages: params.messages.map(m => ({ role: m.role, content: m.content })),
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? 1024,
      },
      { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 60000 }
    );
    return {
      text: res.data?.choices?.[0]?.message?.content ?? '',
      usage: {
        inputTokens: res.data?.usage?.prompt_tokens,
        outputTokens: res.data?.usage?.completion_tokens,
      },
    };
  },
};
