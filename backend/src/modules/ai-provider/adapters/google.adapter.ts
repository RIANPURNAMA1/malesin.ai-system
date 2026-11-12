import axios from 'axios';
import { AiAdapter, AiChatParams, AiChatResult, splitSystemMessage } from './types';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const googleAdapter: AiAdapter = {
  id: 'GOOGLE',

  async listModels(apiKey: string) {
    const res = await axios.get(`${BASE}/models`, { params: { key: apiKey }, timeout: 20000 });
    return (res.data?.models ?? [])
      .filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map((m: any) => String(m.name).replace(/^models\//, ''))
      .sort();
  },

  async chat(apiKey: string, params: AiChatParams): Promise<AiChatResult> {
    const { system, conversation } = splitSystemMessage(params.messages);
    const res = await axios.post(
      `${BASE}/models/${params.model}:generateContent`,
      {
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: conversation.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          temperature: params.temperature ?? 0.7,
          maxOutputTokens: params.maxTokens ?? 1024,
        },
      },
      { params: { key: apiKey }, headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
    );
    const text = (res.data?.candidates?.[0]?.content?.parts ?? [])
      .map((p: any) => p.text)
      .filter(Boolean)
      .join('');
    return {
      text,
      usage: {
        inputTokens: res.data?.usageMetadata?.promptTokenCount,
        outputTokens: res.data?.usageMetadata?.candidatesTokenCount,
      },
    };
  },
};
