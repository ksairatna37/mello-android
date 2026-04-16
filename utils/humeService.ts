/**
 * HumeEVIService — Direct WebSocket connection to Hume AI's EVI
 *
 * Uses React Native's built-in WebSocket (NOT the hume npm SDK)
 * to avoid Node.js/browser dependencies (ws, EventTarget, Web Audio API).
 *
 * Protocol:
 *   wss://api.hume.ai/v0/evi/chat?config_id=X&api_key=Y
 *   Send: { type: "audio_input", data: "base64..." }
 *   Send: { type: "session_settings", audio: { ... } }
 *   Recv: { type: "user_message", message: { content: "..." }, models: { prosody: { scores: {} } } }
 *   Recv: { type: "assistant_message", message: { content: "..." } }
 *   Recv: { type: "audio_output", data: "base64..." }
 *   Recv: { type: "user_interruption" }
 *   Recv: { type: "assistant_end" }
 *   Recv: { type: "chat_metadata", chat_id: "..." }
 *   Recv: { type: "error", message: "..." }
 */

import { Platform } from 'react-native';

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export interface EmotionScore {
  name: string;
  score: number;
}

export interface EmotionScores {
  top3: EmotionScore[];
  raw: Record<string, number>;
}

export interface HumeCallbacks {
  onUserMessage: (text: string, emotions: EmotionScores) => void;
  onAssistantMessage: (text: string) => void;
  onAudioOutput: (base64Audio: string) => void;
  onUserInterruption: () => void;
  onAssistantEnd: () => void;
  // chatId: per-call ID; chatGroupId: session-continuity group ID (for resume)
  onConnected: (chatId: string, chatGroupId: string) => void;
  onDisconnected: () => void;
  onError: (error: string) => void;
}

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

function extractTopEmotions(
  scores: Record<string, number> | undefined | null,
  n = 3,
): EmotionScore[] {
  if (!scores) return [];
  return Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([name, score]) => ({
      name,
      score: Math.round(score * 100) / 100,
    }));
}

// Default sample rates per platform
const DEFAULT_SAMPLE_RATE = Platform.OS === 'ios' ? 48000 : 44100;

// Hume EVI WebSocket endpoint
const HUME_WS_URL = 'wss://api.hume.ai/v0/evi/chat';

// ═══════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════

export class HumeEVIService {
  private apiKey: string;
  private configId: string;
  private sampleRate: number;
  private callbacks: HumeCallbacks;
  private socket: WebSocket | null = null;
  private _isConnected = false;
  // Pass this to resume the same Hume conversation thread across calls
  private resumedChatGroupId: string | null;
  // Variables sent in the very first session_settings (must include all
  // variables declared in the EVI config to avoid "no values specified" errors)
  private initialVariables: Record<string, string>;

  constructor(
    apiKey: string,
    configId: string,
    callbacks: HumeCallbacks,
    sampleRate?: number,
    resumedChatGroupId?: string | null,
    initialVariables?: Record<string, string>,
  ) {
    this.apiKey = apiKey;
    this.configId = configId;
    this.sampleRate = sampleRate ?? DEFAULT_SAMPLE_RATE;
    this.callbacks = callbacks;
    this.resumedChatGroupId = resumedChatGroupId ?? null;
    this.initialVariables = initialVariables ?? {};
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Build WebSocket URL with auth params
        // Append resumed_chat_group_id to continue the same Hume memory thread
        const resumeParam = this.resumedChatGroupId
          ? `&resumed_chat_group_id=${encodeURIComponent(this.resumedChatGroupId)}`
          : '';
        const url = `${HUME_WS_URL}?config_id=${this.configId}&api_key=${this.apiKey}${resumeParam}`;
        if (this.resumedChatGroupId) {
          console.log('[HumeService] Resuming chat group:', this.resumedChatGroupId.substring(0, 20) + '...');
        }
        console.log('[HumeService] Connecting to:', HUME_WS_URL, 'configId:', this.configId);
        const ws = new WebSocket(url);

        ws.onopen = () => {
          console.log('[HumeService] WebSocket OPEN');
          this._isConnected = true;
          this.socket = ws;

          // Send ONE combined session_settings containing both audio format AND
          // all config variables.  Splitting into two messages causes Hume to fire
          // "no values specified" on the first message before the second arrives.
          const settings: Record<string, any> = {
            type: 'session_settings',
            audio: {
              encoding: 'linear16',
              sample_rate: this.sampleRate,
              channels: 1,
            },
          };
          if (Object.keys(this.initialVariables).length > 0) {
            settings.variables = this.initialVariables;
          }
          console.log('[HumeService] Sending session_settings:', JSON.stringify(settings));
          this.sendJSON(settings);

          resolve();
        };

        ws.onmessage = (event: WebSocketMessageEvent) => {
          try {
            const msg = JSON.parse(event.data as string);
            this.handleMessage(msg);
          } catch {
            // Non-JSON message, ignore
          }
        };

        ws.onclose = (event: any) => {
          console.log('[HumeService] WebSocket CLOSED, code:', event?.code, 'reason:', event?.reason);
          this._isConnected = false;
          this.socket = null;
          this.callbacks.onDisconnected();
        };

        ws.onerror = (err: Event) => {
          const errorMsg = (err as any)?.message || 'WebSocket error';
          console.error('[HumeService] WebSocket ERROR:', errorMsg);
          this.callbacks.onError(errorMsg);
          if (!this._isConnected) {
            reject(new Error(errorMsg));
          }
        };
      } catch (err: any) {
        reject(err);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // Already closed
      }
      this.socket = null;
    }
    this._isConnected = false;
  }

  private audioSendCount = 0;

  sendAudio(base64Data: string): void {
    if (!this.socket || !this._isConnected) return;
    this.audioSendCount++;
    if (this.audioSendCount % 100 === 1) {
      console.log(`[HumeService] >> audio_input #${this.audioSendCount} (${base64Data.length} chars)`);
    }
    this.sendJSON({
      type: 'audio_input',
      data: base64Data,
    });
  }

  /**
   * Send session settings with variables (e.g., intervention_guidance)
   * Used to inject dynamic guidance into the conversation
   */
  sendSessionSettings(variables: Record<string, string>): void {
    if (!this.socket || !this._isConnected) return;
    this.sendJSON({
      type: 'session_settings',
      variables,
    });
  }

  private sendJSON(data: Record<string, any>): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    try {
      this.socket.send(JSON.stringify(data));
    } catch {
      // Socket may have closed between check and send
    }
  }

  // ═══════════════════════════════════════════════════
  // MESSAGE ROUTING
  // ═══════════════════════════════════════════════════

  private handleMessage(msg: any): void {
    if (!msg || !msg.type) return;
    console.log('[HumeService] <<', msg.type, msg.type === 'audio_output' ? `(${msg.data?.length || 0} chars)` : '');

    switch (msg.type) {
      case 'chat_metadata': {
        const chatId = msg.chat_id || '';
        const chatGroupId = msg.chat_group_id || '';
        console.log('[HumeService] chat_metadata — chatId:', chatId.substring(0, 20), 'chatGroupId:', chatGroupId.substring(0, 20));
        this.callbacks.onConnected(chatId, chatGroupId);
        break;
      }

      case 'user_message': {
        const text = msg.message?.content || '';
        const rawScores = msg.models?.prosody?.scores || {};
        const emotions: EmotionScores = {
          top3: extractTopEmotions(rawScores),
          raw: rawScores,
        };
        this.callbacks.onUserMessage(text, emotions);
        break;
      }

      case 'assistant_message': {
        const text = msg.message?.content || '';
        this.callbacks.onAssistantMessage(text);
        break;
      }

      case 'audio_output': {
        if (msg.data) {
          this.callbacks.onAudioOutput(msg.data);
        }
        break;
      }

      case 'user_interruption': {
        this.callbacks.onUserInterruption();
        break;
      }

      case 'assistant_end': {
        this.callbacks.onAssistantEnd();
        break;
      }

      case 'error': {
        const errorMsg = msg.message || msg.slug || 'Unknown Hume error';
        this.callbacks.onError(errorMsg);
        break;
      }

      default:
        // tool_call, tool_error, assistant_prosody, etc.
        break;
    }
  }
}
