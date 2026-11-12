export type UserRole = 'OWNER' | 'ADMIN' | 'AGENT';
export type ChannelType = 'WHATSAPP' | 'WHATSAPP_UNOFFICIAL' | 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK';
export type ConversationStatus = 'OPEN' | 'PENDING' | 'CLOSED';
export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'REACTION' | 'TEMPLATE';
export type MessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
export type Direction = 'INBOUND' | 'OUTBOUND';

export interface Company {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  logoUrl?: string;
  isActive: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  company?: Company;
}

export interface Channel {
  id: string;
  companyId: string;
  type: ChannelType;
  name: string;
  isActive: boolean;
  wabaId?: string;
  phoneNumberId?: string;
  verifyToken?: string;
  metadata?: Record<string, any>;
  sessionData?: string;
  createdAt: string;
  _count?: { conversations: number };
}

export interface Label {
  id: string;
  companyId: string;
  name: string;
  color: string;
}

export interface Contact {
  id: string;
  companyId: string;
  name: string;
  phone?: string;
  email?: string;
  avatar?: string;
  sourceChannel?: string;
  firstContactDate: string;
  totalMessages: number;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface Assignment {
  id: string;
  userId: string;
  user: Pick<User, 'id' | 'name' | 'avatar'>;
  assignedAt: string;
}

export interface ConversationLabel {
  labelId: string;
  label: Label;
}

export interface Conversation {
  id: string;
  companyId: string;
  channelId: string;
  contactId: string;
  status: ConversationStatus;
  isRead: boolean;
  lastMessage?: string;
  lastMessageAt?: string;
  createdAt: string;
  contact: Contact;
  channel: Pick<Channel, 'id' | 'name' | 'type'>;
  labels: ConversationLabel[];
  assignments: Assignment[];
  _count?: { messages: number };
}

export interface Attachment {
  id: string;
  url: string;
  type: string;
  name?: string;
  size?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId?: string;
  direction: Direction;
  type: MessageType;
  content?: string;
  mediaUrl?: string;
  fileName?: string;
  wamid?: string;
  status: MessageStatus;
  isRead: boolean;
  reactionEmoji?: string;
  sentAt: string;
  deliveredAt?: string;
  readAt?: string;
  sender?: Pick<User, 'id' | 'name' | 'avatar'>;
  attachments: Attachment[];
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface AnalyticsOverview {
  total: number;
  open: number;
  closed: number;
  pending: number;
  today: number;
}

export type PostPlatform = 'INSTAGRAM' | 'TIKTOK';
export type PostStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED';

export interface Post {
  id: string;
  companyId: string;
  channelId?: string;
  platform: PostPlatform;
  mediaUrls: string[];
  caption?: string;
  scheduledAt?: string;
  publishedAt?: string;
  status: PostStatus;
  igContainerId?: string;
  igMediaId?: string;
  permalink?: string;
  createdAt: string;
}

export interface Notification {
  type: 'NEW_MESSAGE' | 'ASSIGNED' | 'CLOSED' | 'BROADCAST_PAUSED' | 'DEAL_SUGGESTION';
  title: string;
  body: string;
  conversationId?: string;
  /** Halaman tujuan saat diklik (default: chat percakapan). */
  link?: string;
}

export type AiProvider = 'OPENAI' | 'ANTHROPIC' | 'GOOGLE' | 'GROQ';

/** Instruksi tambahan untuk AI. Pipeline kosong = semua pelanggan. */
export interface AiAdditionalInstruction {
  id: string;
  content: string;
  pipeline?: string | null;
}

export interface AiAgent {
  id: string;
  companyId: string;
  name: string;
  description?: string | null;
  provider: AiProvider;
  model: string;
  systemPrompt?: string | null;
  welcomeMessage?: string | null;
  communicationStyle?: string | null;
  conversationFlow?: string | null;
  communicationRules?: string | null;
  additionalInstructions?: AiAdditionalInstruction[] | null;
  version?: number;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  hasApiKey: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { knowledge: number };
}

export interface AiKnowledgeMedia {
  id: string;
  companyId: string;
  knowledgeId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  publicUrl: string;
  altText?: string | null;
  description?: string | null;
  createdAt: string;
}

export interface AiKnowledge {
  id: string;
  companyId: string;
  aiAgentId: string;
  title: string;
  content: string;
  media?: AiKnowledgeMedia[];
  createdAt: string;
  updatedAt: string;
}

export type AiMediaTrigger = 'KEYWORD' | 'AI';

export interface AiMedia {
  id: string;
  companyId: string;
  aiAgentId: string;
  title: string;
  mediaUrl: string;
  caption?: string | null;
  description?: string | null;
  keywords?: string | null;
  trigger: AiMediaTrigger;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiMediaAttachment {
  id: string;
  title: string;
  mediaUrl: string;
  caption?: string | null;
  type: 'IMAGE';
}

export interface AiTestResponseResult {
  reply: string;
  usedKnowledge: string[];
  usedMedia: string[];
  attachments: AiMediaAttachment[];
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface AiProviderInfo {
  id: AiProvider;
  name: string;
  description: string;
  keyPlaceholder: string;
  models: string[];
}
