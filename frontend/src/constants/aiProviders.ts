import { Bot, Sparkles, Gem, Zap, type LucideIcon } from 'lucide-react';
import { AiProvider } from '../types';

export const providerMeta: Record<AiProvider, { label: string; short: string; icon: LucideIcon; color: string }> = {
  OPENAI: { label: 'OpenAI (GPT)', short: 'GPT', icon: Bot, color: '#10A37F' },
  ANTHROPIC: { label: 'Anthropic (Claude)', short: 'Claude', icon: Sparkles, color: '#D97757' },
  GOOGLE: { label: 'Google (Gemini)', short: 'Gemini', icon: Gem, color: '#4285F4' },
  GROQ: { label: 'Groq', short: 'Groq', icon: Zap, color: '#F55036' },
};

export const PROVIDER_ORDER: AiProvider[] = ['OPENAI', 'ANTHROPIC', 'GOOGLE', 'GROQ'];
