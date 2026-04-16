/**
 * AWS Bedrock Service
 * Calls Llama 3 8B via Bedrock Runtime Converse API
 * Auth: Bearer token (AWS Bedrock API Key)
 */

// ═══════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════

const REGION = process.env.EXPO_PUBLIC_AWS_BEDROCK_REGION!;
const MODEL_ARN = process.env.EXPO_PUBLIC_AWS_BEDROCK_MODEL_ARN!;
const BEARER_TOKEN = process.env.EXPO_PUBLIC_AWS_BEARER_TOKEN_BEDROCK!;

// URL-encode the model ARN for use in the path
const ENCODED_MODEL_ARN = encodeURIComponent(MODEL_ARN);
const BEDROCK_URL = `https://bedrock-runtime.${REGION}.amazonaws.com/model/${ENCODED_MODEL_ARN}/converse`;

const TIMEOUT_MS = 30000;

// ═══════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export interface BedrockMessage {
  role: 'user' | 'assistant';
  content: [{ text: string }];
}

// ═══════════════════════════════════════════════════
// SEND MESSAGE
// ═══════════════════════════════════════════════════

/**
 * Send a conversation to Bedrock and get Mello's reply.
 * Pass the full message history (oldest first) for context.
 */
export async function sendToBedrock(messages: BedrockMessage[]): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(BEDROCK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BEARER_TOKEN}`,
      },
      body: JSON.stringify({
        system: [{ text: MELLO_SYSTEM_PROMPT }],
        messages,
        inferenceConfig: {
          maxTokens: 150, // Keep responses short (2-3 sentences)
          stopSequences: [],
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Bedrock error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
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

// ═══════════════════════════════════════════════════
// GENERATE CHAT TITLE
// ═══════════════════════════════════════════════════

/**
 * Ask the model to generate a short descriptive title for the conversation.
 * Fired as a background call after the first AI reply — never blocks the chat.
 *
 * Same approach as Claude app: a separate low-token call with a tight prompt
 * that asks for a 3-6 word title capturing the topic, not the literal first message.
 *
 * Returns null if the call fails (caller keeps the previous title).
 */
export async function generateChatTitle(
  messages: BedrockMessage[]
): Promise<string | null> {
  console.log('=== GENERATE CHAT TITLE ===');
  console.log('>>> messages count:', messages.length);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    // Build a summary of the first exchange only (keep it cheap)
    const summary = messages
      .slice(0, 4) // at most 2 user + 2 assistant turns
      .map((m) => `${m.role === 'user' ? 'User' : 'Mello'}: ${m.content[0].text}`)
      .join('\n');

    console.log('>>> summary for title:', summary.substring(0, 200) + '...');

    const response = await fetch(BEDROCK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BEARER_TOKEN}`,
      },
      body: JSON.stringify({
        // No system prompt — this is a pure utility call, not a persona call
        messages: [
          {
            role: 'user',
            content: [
              {
                text: `Here is the start of a chat conversation:\n\n${summary}\n\nGenerate a short title (3 to 6 words) that captures what this conversation is about. Output ONLY the title — no quotes, no punctuation at the end, no explanation.`,
              },
            ],
          },
        ],
        inferenceConfig: {
          maxTokens: 20, // Titles are short — hard cap prevents rambling
          // No stopSequences — Llama 3 rejects empty/whitespace values
        },
      }),
      signal: controller.signal,
    });

    console.log('>>> generateChatTitle response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('>>> generateChatTitle error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log('>>> generateChatTitle data:', JSON.stringify(data, null, 2));

    const raw: string = data?.output?.message?.content?.[0]?.text ?? '';
    const title = raw.trim().replace(/^["']|["']$/g, ''); // strip stray quotes

    console.log('>>> generated title:', title);
    return title.length > 0 ? title : null;
  } catch (err) {
    console.error('>>> generateChatTitle exception:', err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ═══════════════════════════════════════════════════
// GENERATE CHAT SUMMARY
// ═══════════════════════════════════════════════════

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
    // Build conversation text (limit to avoid token explosion)
    const conversationText = messages
      .slice(0, 20) // Max 20 messages for summary
      .map((m) => `${m.role === 'user' ? 'User' : 'Mello'}: ${m.content[0].text}`)
      .join('\n');

    const response = await fetch(BEDROCK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BEARER_TOKEN}`,
      },
      body: JSON.stringify({
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
      }),
      signal: controller.signal,
    });

    console.log('>>> generateChatSummary response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('>>> generateChatSummary error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
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

// ═══════════════════════════════════════════════════
// EXTRACT VOICE CONTEXT
// ═══════════════════════════════════════════════════

export interface ExtractedVoiceContext {
  triggers: string[];    // What causes distress (max 2 short phrases)
  coping: string[];      // What helps them feel better (max 2 short phrases)
  preferences: string[]; // Communication preferences (max 1 short phrase)
  summary: string;       // One-sentence summary of the session topic
}

/**
 * Extract structured context from a voice session transcript.
 * Mirrors the WhatsApp agent's extract_context_with_ai().
 *
 * Used to populate voice_context + rebuild voice_user_profiles.quick_context
 * so the NEXT call starts with personalised context injected via user_context.
 *
 * Fired fire-and-forget after session finalize — never blocks the call end flow.
 */
export async function extractVoiceContext(
  messages: BedrockMessage[],
  topEmotions: Array<{ name: string; score: number }>,
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
    // Build conversation text (last 20 turns max — mirrors Python agent)
    const conversationText = messages
      .slice(-20)
      .map((m) => `${m.role === 'user' ? 'User' : 'Mello'}: ${m.content[0].text.slice(0, 200)}`)
      .join('\n');

    const emotionsText = topEmotions
      .slice(0, 5)
      .map((e) => `${e.name}: ${e.score.toFixed(2)}`)
      .join(', ');

    const extractionPrompt =
      `Conversation transcript:\n${conversationText}\n\n` +
      `User's top emotions during call: ${emotionsText || 'none'}\n\n` +
      `Extract the key context in JSON format. ` +
      `Respond ONLY with a JSON object, no markdown, no explanation:\n` +
      `{"triggers":["item1","item2"],"coping":["item1","item2"],"preferences":["item1"],"summary":"One sentence summary"}`;

    const extractionSystem =
      `You are analyzing a mental health support conversation to extract KEY context for future sessions.\n\n` +
      `Extract ONLY the most critical information:\n` +
      `1. TRIGGERS: What causes distress? (max 2 items, 2-5 words each)\n` +
      `2. COPING: What helps them feel better? (max 2 items, 2-5 words each)\n` +
      `3. PREFERENCES: Communication preferences? (max 1 item, 2-5 words)\n` +
      `4. SUMMARY: One sentence summary of main topic.\n\n` +
      `If not enough information, use empty arrays. Be concise.`;

    const response = await fetch(BEDROCK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BEARER_TOKEN}`,
      },
      body: JSON.stringify({
        system: [{ text: extractionSystem }],
        messages: [
          { role: 'user', content: [{ text: extractionPrompt }] },
        ],
        inferenceConfig: {
          maxTokens: 300,
          temperature: 0.2,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('>>> extractVoiceContext error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    let raw: string = data?.output?.message?.content?.[0]?.text ?? '';

    // Strip markdown code fences if model wraps response
    if (raw.includes('```json')) raw = raw.split('```json')[1].split('```')[0];
    else if (raw.includes('```')) raw = raw.split('```')[1].split('```')[0];

    const parsed = JSON.parse(raw.trim());
    const result: ExtractedVoiceContext = {
      triggers:    (parsed.triggers    ?? []).slice(0, 2),
      coping:      (parsed.coping      ?? []).slice(0, 2),
      preferences: (parsed.preferences ?? []).slice(0, 1),
      summary:     (parsed.summary     ?? '').slice(0, 200),
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
