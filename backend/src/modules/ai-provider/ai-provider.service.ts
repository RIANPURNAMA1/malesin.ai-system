import { createError } from '../../middlewares/error.middleware';
import { getAdapter, getProvider, PROVIDERS } from './ai-provider.registry';
import { AiChatParams, AiChatResult } from './adapters/types';

function mapProviderError(err: any, fallback: string): never {
  const status = err?.response?.status;
  const providerMsg =
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    err?.response?.data?.error;

  if (status === 401 || status === 403) throw createError('API key tidak valid atau tidak memiliki akses', 400);
  if (status === 404) throw createError('Model atau endpoint tidak ditemukan untuk provider ini', 400);
  if (status === 429) throw createError('Rate limit provider tercapai, coba lagi nanti', 429);
  if (status && providerMsg) throw createError(`${fallback}: ${String(providerMsg).slice(0, 300)}`, 502);
  if (err?.code === 'ECONNABORTED') throw createError('Koneksi ke provider timeout', 504);
  throw createError(fallback, 502);
}

export class AiProviderService {
  listProviders() {
    return PROVIDERS.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      keyPlaceholder: p.keyPlaceholder,
      models: p.defaultModels,
    }));
  }

  /** Ambil model aktual dari provider; fallback ke daftar default bila tanpa API key. */
  async listModels(provider: string, apiKey?: string) {
    const config = getProvider(provider);
    if (!config) throw createError('Provider tidak dikenal', 400);
    if (!apiKey?.trim()) return config.defaultModels;

    const adapter = getAdapter(provider)!;
    try {
      const models = await adapter.listModels(apiKey.trim());
      return models.length ? models : config.defaultModels;
    } catch (err) {
      mapProviderError(err, 'Gagal mengambil daftar model dari provider');
    }
  }

  /** Validasi API key dengan memanggil endpoint daftar model provider. */
  async testConnection(provider: string, apiKey: string) {
    if (!apiKey?.trim()) throw createError('API key wajib diisi', 400);
    const adapter = getAdapter(provider);
    if (!adapter) throw createError('Provider tidak dikenal', 400);
    try {
      const models = await adapter.listModels(apiKey.trim());
      return { ok: true, modelCount: models.length, models: models.slice(0, 10) };
    } catch (err) {
      mapProviderError(err, 'Gagal terhubung ke provider');
    }
  }

  async chat(provider: string, apiKey: string, params: AiChatParams): Promise<AiChatResult> {
    const adapter = getAdapter(provider);
    if (!adapter) throw createError('Provider tidak dikenal', 400);
    if (!apiKey?.trim()) throw createError('API key belum dikonfigurasi untuk agent ini', 400);
    if (!params.model?.trim()) throw createError('Model belum dipilih', 400);
    try {
      return await adapter.chat(apiKey.trim(), params);
    } catch (err) {
      mapProviderError(err, 'Gagal memproses permintaan ke provider');
    }
  }
}

export const aiProviderService = new AiProviderService();
