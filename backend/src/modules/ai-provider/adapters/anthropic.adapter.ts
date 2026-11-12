import axios from 'axios';
import { AiAdapter, AiChatParams, AiChatResult, splitSystemMessage } from './types';

const BASE = 'https://api.anthropic.com/v1';
const VERSION = '2023-06-01';

export const anthropicAdapter: AiAdapter = {
  id: 'ANTHROPIC',

  async listModels(apiKey: string) {
    const res = await axios.get(`${BASE}/models`, {
      headers: { 'x-api-key': apiKey, 'anthropic-version': VERSION },
      timeout: 20000,
    });
    return (res.data?.data ?? []).map((m: any) => m.id as string).sort();
  },

  async chat(apiKey: string, params: AiChatParams): Promise<AiChatResult> {
    const { system, conversation } = splitSystemMessage(params.messages);
    const res = await axios.post(
      `${BASE}/messages`,
      {
        model: params.model,
        max_tokens: params.maxTokens ?? 1024,
        temperature: params.temperature ?? 0.7,
        ...(system ? { system } : {}),
        messages: conversation.map(m => ({ role: m.role, content: m.content })),
      },
      {
        headers: { 'x-api-key': apiKey, 'anthropic-version': VERSION, 'Content-Type': 'application/json' },
        timeout: 60000,
      }
    );
    const text = (res.data?.content ?? [])
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('');
    return {
      text,
      usage: {
        inputTokens: res.data?.usage?.input_tokens,
        outputTokens: res.data?.usage?.output_tokens,
      },
    };
  },
};
