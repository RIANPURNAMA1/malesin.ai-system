import axios from 'axios';
import { AiAdapter, AiChatParams, AiChatResult } from './types';

const BASE = 'https://api.openai.com/v1';

export const openaiAdapter: AiAdapter = {
  id: 'OPENAI',

  async listModels(apiKey: string) {
    const res = await axios.get(`${BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 20000,
    });
    return (res.data?.data ?? [])
      .map((m: any) => m.id as string)
      .filter((id: string) => /^(gpt|o1|o3|o4|chatgpt)/i.test(id))
      .sort();
  },

  async chat(apiKey: string, params: AiChatParams): Promise<AiChatResult> {
    // Model reasoning (gpt-5*, o1/o3/o4) tidak menerima `max_tokens` & `temperature` custom,
    // dan token reasoning ikut dihitung dalam batas output — beri ruang minimal agar balasan tidak kosong.
    const isReasoning = /^(gpt-5|o\d)/i.test(params.model);
    const maxTokens = params.maxTokens ?? 1024;
    const body: Record<string, unknown> = {
      model: params.model,
      messages: params.messages.map(m => ({ role: m.role, content: m.content })),
      max_completion_tokens: isReasoning ? Math.max(maxTokens, 4096) : maxTokens,
    };
    if (!isReasoning) body.temperature = params.temperature ?? 0.7;

    const res = await axios.post(
      `${BASE}/chat/completions`,
      body,
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
