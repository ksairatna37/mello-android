/**
 * AWS Bedrock Service
 * Calls Llama 3 8B via Bedrock Runtime Converse API
 * Auth: AWS SigV4 (IAM credentials)
 */

import { signRequest } from '@/utils/sigv4';
import { ENV } from '@/config/env';

// CONFIG

const REGION = ENV.awsBedrockRegion;
const MODEL_ARN = ENV.awsBedrockModelArn;
const AWS_ACCESS_KEY_ID = ENV.awsAccessKeyId;
const AWS_SECRET_ACCESS_KEY = ENV.awsSecretAccessKey;
const AWS_SESSION_TOKEN = undefined; // use EAS secret AWS_SESSION_TOKEN if needed

const BEDROCK_URL = `https://bedrock-runtime.${REGION}.amazonaws.com/model/${MODEL_ARN}/converse`;

const TIMEOUT_MS = 30000;

function summarizeHeaders(headers: Record<string, string | undefined>) {
  return {
    ...headers,
    Authorization: headers.Authorization ? '[REDACTED]' : undefined,
    'x-amz-security-token': headers['x-amz-security-token'] ? '[REDACTED]' : undefined,
  };
}

async function bedrockPost<TResponse>(
  payload: Record<string, unknown>,
  signal: AbortSignal
): Promise<TResponse> {
  const body = JSON.stringify(payload);
  const headers = await signRequest({
    method: 'POST',
    url: BEDROCK_URL,
    region: REGION,
    service: 'bedrock',
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    sessionToken: AWS_SESSION_TOKEN,
    body,
  });

  console.log('[Bedrock] Request URL:', BEDROCK_URL);
  console.log('[Bedrock] Request Headers:', JSON.stringify(summarizeHeaders(headers)));
  console.log('[Bedrock] Request Body:', body);

  const response = await fetch(BEDROCK_URL, {
    method: 'POST',
    headers: headers as Record<string, string>,
    body,
    signal,
  });

  const responseText = await response.text().catch(() => '');

  console.log('[Bedrock] Response Status:', response.status);
  console.log('[Bedrock] Response Body:', responseText);

  if (!response.ok) {
    throw new Error(`Bedrock error ${response.status}: ${responseText}`);
  }

  return JSON.parse(responseText) as TResponse;
}

// SYSTEM PROMPT

const MELLO_SYSTEM_PROMPT = `You are Mello, a warm mental health companion for Gen-Z users.

CRITICAL: Keep ALL responses to 2-3 sentences MAX. Never use bullet points or lists. Be concise.

Style:
- Speak like a caring friend, warm and empathetic
- Simple language, no clinical jargon
- Match the user's energy

Boundaries:
- Never diagnose or prescribe
- Never minimize feelings
- For crisis/self-harm: show compassion, then mention iCall: 9152987821

Goal: Help users feel heard. Short, warm responses only.`;

// TYPES

export interface BedrockMessage {
  role: 'user' | 'assistant';
  content: [{ text: string }];
}

interface BedrockConverseResponse {
  output?: {
    message?: {
      content?: Array<{ text?: string }>;
    };
  };
}

// SEND MESSAGE

/**
 * Send a conversation to Bedrock and get Mello's reply.
 * Pass the full message history (oldest first) for context.
 */
export async function sendToBedrock(messages: BedrockMessage[]): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const data = await bedrockPost<BedrockConverseResponse>(
      {
        system: [{ text: MELLO_SYSTEM_PROMPT }],
        messages,
        inferenceConfig: {
          maxTokens: 150,
          stopSequences: [],
        },
      },
      controller.signal
    );

    const text = data?.output?.message?.content?.[0]?.text;

    if (!text) {
      throw new Error('Empty response from Bedrock');
    }

    return text;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Response timed out. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// GENERATE CHAT TITLE

/**
 * Ask the model to generate a short descriptive title for the conversation.
 * Fired as a background call after the first AI reply and never blocks the chat.
 *
 * Returns null if the call fails.
 */
export async function generateChatTitle(
  messages: BedrockMessage[]
): Promise<string | null> {
  console.log('=== GENERATE CHAT TITLE ===');
  console.log('>>> messages count:', messages.length);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const summary = messages
      .slice(0, 4)
      .map((m) => `${m.role === 'user' ? 'User' : 'Mello'}: ${m.content[0].text}`)
      .join('\n');

    console.log('>>> summary for title:', `${summary.substring(0, 200)}...`);

    const data = await bedrockPost<BedrockConverseResponse>(
      {
        messages: [
          {
            role: 'user',
            content: [
              {
                text: `Here is the start of a chat conversation:\n\n${summary}\n\nGenerate a short title (3 to 6 words) that captures what this conversation is about. Output ONLY the title, no quotes, no punctuation at the end, no explanation.`,
              },
            ],
          },
        ],
        inferenceConfig: {
          maxTokens: 20,
        },
      },
      controller.signal
    );

    console.log('>>> generateChatTitle data:', JSON.stringify(data, null, 2));

    const raw: string = data?.output?.message?.content?.[0]?.text ?? '';
    const title = raw.trim().replace(/^["']|["']$/g, '');

    console.log('>>> generated title:', title);
    return title.length > 0 ? title : null;
  } catch (err) {
    console.error('>>> generateChatTitle exception:', err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// GENERATE CHAT SUMMARY

/**
 * Generate a brief summary of the conversation.
 * Called when chat ends to populate the summary field.
 *
 * Returns null if the call fails.
 */
export async function generateChatSummary(
  messages: BedrockMessage[]
): Promise<string | null> {
  console.log('=== GENERATE CHAT SUMMARY ===');
  console.log('>>> messages count:', messages.length);

  if (messages.length < 2) {
    console.log('>>> Too few messages for summary');
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const conversationText = messages
      .slice(0, 20)
      .map((m) => `${m.role === 'user' ? 'User' : 'Mello'}: ${m.content[0].text}`)
      .join('\n');

    const data = await bedrockPost<BedrockConverseResponse>(
      {
        messages: [
          {
            role: 'user',
            content: [
              {
                text: `Here is a mental health support conversation:\n\n${conversationText}\n\nWrite a brief 1-2 sentence summary capturing the main topic and emotional tone. Be concise and empathetic. Output ONLY the summary.`,
              },
            ],
          },
        ],
        inferenceConfig: {
          maxTokens: 100,
          stopSequences: [],
        },
      },
      controller.signal
    );

    const summary: string = data?.output?.message?.content?.[0]?.text ?? '';

    console.log('>>> generated summary:', summary);
    return summary.trim() || null;
  } catch (err) {
    console.error('>>> generateChatSummary exception:', err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// GENERATE EMOTIONAL PROFILE

export interface EmotionalProfile {
  calm: number;
  clarity: number;
  focus: number;
  confidence: number;
  positivity: number;
  interpretation: string;
}

const EMOTIONAL_PROFILE_SYSTEM = `You are Mello's emotional analysis engine. Your ONLY job is to read a user's onboarding answers and return a precise JSON object - nothing else.

You will receive a user's answers in this format:
  Q: <question text>
  A: <their answer>

Your task: Score the user on 5 dimensions (0-100 each) based on what their answers reveal about their current inner state. Then write one empathetic interpretation sentence.

SCORING GUIDE:

calm (0-100): How settled, peaceful, and free from anxiety do they feel right now?
  - 80-100: Low anxiety, steady inner world, genuinely at ease
  - 50-79: Some undercurrents, mostly holding it together
  - 20-49: Unsettled, inner noise, pulled in different directions
  - 0-19: Actively distressed, stormy, overwhelmed

clarity (0-100): How clear-headed, self-aware, and focused in their thinking are they?
  - 80-100: Sharp sense of self, knows what they need, thinks clearly
  - 50-79: Some fog or confusion but mostly oriented
  - 20-49: Foggy, unclear, struggling to make sense of things
  - 0-19: Deeply confused, mentally scattered, can't see the path

focus (0-100): How driven, motivated, and able to take action do they feel?
  - 80-100: Clear goals, energised, getting things done
  - 50-79: Some momentum but inconsistent drive
  - 20-49: Struggling to start or follow through
  - 0-19: Paralysed, everything feels pointless or too hard

confidence (0-100): How assured, self-trusting, and grounded in self-worth do they feel?
  - 80-100: Grounded in self-worth, trusts their own judgement
  - 50-79: Some self-doubt but generally okay
  - 20-49: Frequently second-guessing, needs a lot of reassurance
  - 0-19: Deep self-doubt, shame, or feeling fundamentally broken

positivity (0-100): How much hope, warmth, or optimism comes through?
  - High: "You're going to be okay", growth mindset, sunny mood
  - Low: Stormy, void, heavy, ache, replaying old wounds

RULES:
- No value should be exactly 50 unless it's genuinely neutral
- Use the FULL range - don't cluster everything between 40-70
- Vary the scores based on the actual answers (don't make them all similar)
- interpretation: 1-2 sentences, warm and specific to their answers, no generic platitudes

OUTPUT: Respond with ONLY valid JSON - no markdown, no explanation, no extra text:
{"calm":72,"clarity":55,"focus":64,"confidence":58,"positivity":61,"interpretation":"Your mind carries some heaviness right now, but there's a real clarity in how you're showing up for yourself."}`;

/**
 * Analyze onboarding answers and generate an emotional profile for the radar chart.
 * Returns scores (0-100) for Productivity, Confidence, Calmness, Conflict, Positivity.
 */
export async function generateEmotionalProfile(
  answers: Array<{ question: string; answer: string }>
): Promise<EmotionalProfile | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const answersText = answers
      .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
      .join('\n\n');

    const userPrompt =
      `Here are my onboarding answers:\n\n${answersText}\n\n` +
      'Analyze these answers and return my emotional profile as JSON.';

    const data = await bedrockPost<BedrockConverseResponse>(
      {
        system: [{ text: EMOTIONAL_PROFILE_SYSTEM }],
        messages: [{ role: 'user', content: [{ text: userPrompt }] }],
        inferenceConfig: {
          maxTokens: 200,
          temperature: 0.3,
        },
      },
      controller.signal
    );

    let raw: string = data?.output?.message?.content?.[0]?.text ?? '';

    if (raw.includes('```json')) {
      raw = raw.split('```json')[1].split('```')[0];
    } else if (raw.includes('```')) {
      raw = raw.split('```')[1].split('```')[0];
    }

    const parsed = JSON.parse(raw.trim());
    const clamp = (value: unknown, fallback: number) => {
      const numericValue = typeof value === 'number' ? value : fallback;
      return Math.max(0, Math.min(100, Math.round(numericValue)));
    };

    return {
      calm: clamp(parsed.calm, 50),
      clarity: clamp(parsed.clarity, 50),
      focus: clamp(parsed.focus, 50),
      confidence: clamp(parsed.confidence, 50),
      positivity: clamp(parsed.positivity, 50),
      interpretation:
        typeof parsed.interpretation === 'string'
          ? parsed.interpretation.trim().slice(0, 300)
          : '',
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error('[EmotionalProfile] Request timed out');
    } else if (err instanceof Error) {
      console.error('[EmotionalProfile] Exception:', err.message);
    } else {
      console.error('[EmotionalProfile] Exception:', err);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// EXTRACT VOICE CONTEXT

export interface ExtractedVoiceContext {
  triggers: string[];
  coping: string[];
  preferences: string[];
  summary: string;
}

/**
 * Extract structured context from a voice session transcript.
 * Fired fire-and-forget after session finalize and never blocks the call end flow.
 */
export async function extractVoiceContext(
  messages: BedrockMessage[],
  topEmotions: Array<{ name: string; score: number }>
): Promise<ExtractedVoiceContext | null> {
  console.log('=== EXTRACT VOICE CONTEXT ===');
  console.log('>>> messages count:', messages.length);

  if (messages.length < 4) {
    console.log('>>> Conversation too short for context extraction, skipping');
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const conversationText = messages
      .slice(-20)
      .map((m) => `${m.role === 'user' ? 'User' : 'Mello'}: ${m.content[0].text.slice(0, 200)}`)
      .join('\n');

    const emotionsText = topEmotions
      .slice(0, 5)
      .map((emotion) => `${emotion.name}: ${emotion.score.toFixed(2)}`)
      .join(', ');

    const extractionPrompt =
      `Conversation transcript:\n${conversationText}\n\n` +
      `User's top emotions during call: ${emotionsText || 'none'}\n\n` +
      'Extract the key context in JSON format. ' +
      'Respond ONLY with a JSON object, no markdown, no explanation:\n' +
      '{"triggers":["item1","item2"],"coping":["item1","item2"],"preferences":["item1"],"summary":"One sentence summary"}';

    const extractionSystem =
      `You are analyzing a mental health support conversation to extract KEY context for future sessions.\n\n` +
      'Extract ONLY the most critical information:\n' +
      '1. TRIGGERS: What causes distress? (max 2 items, 2-5 words each)\n' +
      '2. COPING: What helps them feel better? (max 2 items, 2-5 words each)\n' +
      '3. PREFERENCES: Communication preferences? (max 1 item, 2-5 words)\n' +
      '4. SUMMARY: One sentence summary of main topic.\n\n' +
      'If not enough information, use empty arrays. Be concise.';

    const data = await bedrockPost<BedrockConverseResponse>(
      {
        system: [{ text: extractionSystem }],
        messages: [{ role: 'user', content: [{ text: extractionPrompt }] }],
        inferenceConfig: {
          maxTokens: 300,
          temperature: 0.2,
        },
      },
      controller.signal
    );

    let raw: string = data?.output?.message?.content?.[0]?.text ?? '';

    if (raw.includes('```json')) {
      raw = raw.split('```json')[1].split('```')[0];
    } else if (raw.includes('```')) {
      raw = raw.split('```')[1].split('```')[0];
    }

    const parsed = JSON.parse(raw.trim());
    const result: ExtractedVoiceContext = {
      triggers: (parsed.triggers ?? []).slice(0, 2),
      coping: (parsed.coping ?? []).slice(0, 2),
      preferences: (parsed.preferences ?? []).slice(0, 1),
      summary: (parsed.summary ?? '').slice(0, 200),
    };

    console.log('>>> extracted context:', JSON.stringify(result));
    return result;
  } catch (err) {
    console.error('>>> extractVoiceContext exception:', err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
