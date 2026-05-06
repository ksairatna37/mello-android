// Bedrock AI service
export { sendToBedrock, generateChatTitle, generateChatSummary } from './bedrockService';
export type { BedrockMessage } from './bedrockService';

// Chat service (REST-backed via /load/chat + /update/chat)
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
  starChat,
  updateChatFeedback,
  addVoiceChatToBlob,
  toBedrockFormat,
  formatRelativeTime,
} from './chatService';
export type { Chat, ChatMessage, ChatListItem, ChatFeedback } from './chatService';

// Voice chat service (REST-backed via /voice_sessions, /voice_user_profiles, /voice_context)
export {
  getVoiceSessionContext,
  startVoiceSession,
  updateHumeIds,
  updateVoiceTranscript,
  finalizeVoiceSession,
  getVoiceSessions,
} from './voiceChatService';
export type { VoiceTranscriptEntry, VoiceSessionContext } from './voiceChatService';

// Local session history cache (AsyncStorage-backed; unrelated to backend chats).
export { getSessions, upsertSession, deleteSession, formatSessionTime } from './sessionHistory';
export type { ChatSession } from './sessionHistory';
