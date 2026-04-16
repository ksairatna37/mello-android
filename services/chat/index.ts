// Bedrock AI service
export { sendToBedrock, generateChatTitle, generateChatSummary } from './bedrockService';
export type { BedrockMessage } from './bedrockService';

// Chat service (Supabase-backed)
export {
  createChat,
  getChats,
  getChat,
  addMessage,
  updateTitle,
  generateAndSetTitle,
  endChat,
  generateAndSetSummary,
  deleteChat,
  toBedrockFormat,
  formatRelativeTime,
} from './chatService';
export type { Chat, ChatMessage, ChatListItem } from './chatService';

// Legacy API (deprecated - kept for backward compatibility)
export { loadChat, saveChat, toStoredMessages, fromStoredMessages } from './chatApi';
export type { StoredMessage } from './chatApi';
export { getSessions, upsertSession, deleteSession, formatSessionTime } from './sessionHistory';
export type { ChatSession } from './sessionHistory';
