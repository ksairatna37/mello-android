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
  onConnected: (chatId: string) => void;
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

  constructor(
    apiKey: string,
    configId: string,
    callbacks: HumeCallbacks,
    sampleRate?: number,
  ) {
    this.apiKey = apiKey;
    this.configId = configId;
    this.sampleRate = sampleRate ?? DEFAULT_SAMPLE_RATE;
    this.callbacks = callbacks;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Build WebSocket URL with auth params
        const url = `${HUME_WS_URL}?config_id=${this.configId}&api_key=${this.apiKey}`;
        const ws = new WebSocket(url);

        ws.onopen = () => {
          this._isConnected = true;
          this.socket = ws;

          // Send session settings for linear PCM audio
          this.sendJSON({
            type: 'session_settings',
            audio: {
              encoding: 'linear16',
              sample_rate: this.sampleRate,
              channels: 1,
            },
          });

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

        ws.onclose = () => {
          this._isConnected = false;
          this.socket = null;
          this.callbacks.onDisconnected();
        };

        ws.onerror = (err: Event) => {
          const errorMsg = (err as any)?.message || 'WebSocket error';
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

  sendAudio(base64Data: string): void {
    if (!this.socket || !this._isConnected) return;
    this.sendJSON({
      type: 'audio_input',
      data: base64Data,
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

    switch (msg.type) {
      case 'chat_metadata': {
        const chatId = msg.chat_id || '';
        this.callbacks.onConnected(chatId);
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
