
import type { ChatButton, ChatMessage, Conversation, NewConversation, NewMessage } from '#lib';
import Dexie, { type Table } from 'dexie';



class ChatbotDatabase extends Dexie {
  conversations!: Table<Conversation, number, NewConversation>;
  messages!: Table<ChatMessage, number, NewMessage>;

  constructor() {
    super('milo');

    this.version(1).stores({
      conversations: '++id, username, title, createdAt, updatedAt',
      messages: '++id, conversationId, timestamp, sender'
    });
  }
}

export const db = new ChatbotDatabase();

/**
 * Create a conversation owned by a username.
 */
export async function createConversation({
  username,
  title = 'New conversation'
}: {
  username: string;
  title?: string;
}): Promise<number> {
  const normalizedUsername = normalizeUsername(username);
  const now = new Date().toISOString();

  return db.conversations.add({
    username: normalizedUsername,
    title,
    createdAt: now,
    updatedAt: now
  });
}

/**
 * Retrieve conversations belonging to a specific username,
 * newest activity first.
 */
export async function getConversations(
  username: string
): Promise<Conversation[]> {
  const normalizedUsername = normalizeUsername(username);

  const conversations = await db.conversations
    .where('username')
    .equals(normalizedUsername)
    .toArray();

  return conversations.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() -
      new Date(a.updatedAt).getTime()
  );
}

/**
 * Retrieve all messages belonging to a conversation,
 * oldest first.
 */
export async function getMessages(
  conversationId: number
): Promise<ChatMessage[]> {
  if (!Number.isSafeInteger(conversationId) || conversationId <= 0) {
    throw new TypeError('A valid conversation ID is required.');
  }

  const messages = await db.messages
    .where('conversationId')
    .equals(conversationId)
    .toArray();

  return messages.sort((a, b) => {
    const difference =
      new Date(a.timestamp).getTime() -
      new Date(b.timestamp).getTime();

    return difference || a.id - b.id;
  });
}

/**
 * Save a message and update its conversation's activity timestamp.
 * Automatically generates a title from the first user message.
 */
export async function saveMessage({
  conversationId,
  sender,
  message = '',
  context = {},
  timestamp = new Date().toISOString(),
  image = null,
  buttons = []
}: {
  conversationId: number;
  sender: ChatMessage['sender'];
  message?: string;
  context?: Record<string, unknown>;
  timestamp?: string;
  image?: string | null;
  buttons?: ChatButton[];
}): Promise<number> {
  if (!Number.isSafeInteger(conversationId) || conversationId <= 0) {
    throw new TypeError('A valid conversation ID is required.');
  }

  if (typeof message !== 'string') {
    throw new TypeError('Message content must be a string.');
  }

  if (!isValidTimestamp(timestamp)) {
    throw new TypeError('A valid message timestamp is required.');
  }

  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    throw new TypeError('Message context must be an object.');
  }

  if (!Array.isArray(buttons)) {
    throw new TypeError('Message buttons must be an array.');
  }

  return db.transaction(
    'rw',
    db.messages,
    db.conversations,
    async () => {
      const conversation = await db.conversations.get(conversationId);

      if (!conversation) {
        throw new Error(
          `Conversation ${conversationId} does not exist.`
        );
      }

      const id = await db.messages.add({
        conversationId,
        sender,
        message,
        context,
        timestamp,
        image,
        buttons
      });

      const updates: Partial<
        Pick<Conversation, 'title' | 'updatedAt'>
      > = {
        updatedAt: timestamp
      };

      if (
        sender === 'user' &&
        conversation.title === 'New conversation'
      ) {
        updates.title =
          message.trim().slice(0, 48) || 'New conversation';
      }

      await db.conversations.update(conversationId, updates);

      return id;
    }
  );
}

/**
 * Rename a conversation.
 */
export async function renameConversation(
  conversationId: number,
  title: string
): Promise<number> {
  if (!Number.isSafeInteger(conversationId) || conversationId <= 0) {
    throw new TypeError('A valid conversation ID is required.');
  }

  if (typeof title !== 'string' || !title.trim()) {
    throw new TypeError('A conversation title cannot be empty.');
  }

  const conversation = await db.conversations.get(conversationId);

  if (!conversation) {
    throw new Error(`Conversation ${conversationId} does not exist.`);
  }

  return db.conversations.update(conversationId, {
    title: title.trim(),
    updatedAt: new Date().toISOString()
  });
}

/**
 * Delete a conversation and all its messages atomically.
 */
export async function deleteConversation(
  conversationId: number
): Promise<void> {
  if (!Number.isSafeInteger(conversationId) || conversationId <= 0) {
    throw new TypeError('A valid conversation ID is required.');
  }

  await db.transaction(
    'rw',
    db.conversations,
    db.messages,
    async () => {
      await db.messages
        .where('conversationId')
        .equals(conversationId)
        .delete();

      await db.conversations.delete(conversationId);
    }
  );
}

/**
 * Validate and normalize the username used as the local profile key.
 */
function normalizeUsername(username: string): string {
  if (typeof username !== 'string' || !username.trim()) {
    throw new TypeError('A username is required.');
  }

  return username.trim();
}

function isValidTimestamp(timestamp: string): boolean {
  return (
    typeof timestamp === 'string' &&
    timestamp.trim().length > 0 &&
    Number.isFinite(Date.parse(timestamp))
  );
}
