//? Rasa Chatbot Types
export type RasaContext = Record<string, unknown>;

export interface RasaRequestOptions {
  timeout?: number;
}

export interface RasaMessage {
  text?: string;
  type?: string;
  image?: string;
  url?: string;
  buttons?: RasaButton[];
  [key: string]: unknown;
}

export interface RasaButton {
  title?: string;
  payload?: string;
  url?: string;
  type?: string;
  [key: string]: unknown;
}

export interface RasaResponse {
  messages: RasaMessage[];
  context: RasaContext;
  error?: string;
  actions?: unknown[];
  [key: string]: unknown;
}

interface AvailabilityResponse {
  status?: string;
}

interface HttpError extends Error {
  status?: number;
}

//? Database Types

export interface Conversation {
  id: number;
  username: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatButton {
  title?: string;
  payload?: string;
  url?: string;
  type?: string;
  [key: string]: unknown;
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  sender: 'user' | 'bot';
  message: string;
  context: Record<string, unknown>;
  timestamp: string;
  image: string | null;
  buttons: ChatButton[];
}

type NewConversation = Omit<Conversation, 'id'>;

type NewMessage = Omit<ChatMessage, 'id'>;

//? App-wide Types / Other types and such..
export type Profile = {
  username: string;
  avatar: string | null;
};