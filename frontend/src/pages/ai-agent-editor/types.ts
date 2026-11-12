import { AiProvider, AiMediaAttachment, AiAdditionalInstruction } from '../../types';

export type Tab = 'behavior' | 'knowledge' | 'routing' | 'config' | 'followup' | 'integration' | 'orchestration' | 'evaluation' | 'test';

export interface ImageDraft {
  file: File;
  preview: string;
}

export interface PendingKnowledge {
  title: string;
  content: string;
  images: ImageDraft[];
}

export type KbSource = 'text' | 'web' | 'file' | 'qa' | 'product';

export interface FormState {
  name: string;
  description: string;
  provider: AiProvider;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  welcomeMessage: string;
  communicationStyle: string;
  conversationFlow: string;
  communicationRules: string;
  additionalInstructions: AiAdditionalInstruction[];
  version: number;
  isActive: boolean;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  usedKnowledge?: string[];
  usedMedia?: string[];
  attachments?: AiMediaAttachment[];
}


