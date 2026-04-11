/**
 * AWS Bedrock Service
 * Calls Claude Opus 4.5 via Bedrock Runtime Converse API
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

const MELLO_SYSTEM_PROMPT = `You are Mello, a warm and trauma-informed mental health companion designed for Gen-Z users. Your role is to listen actively, validate emotions without judgment, and gently guide users toward self-understanding and resilience.

Tone & Style:
- Speak conversationally and warmly, like a caring friend who happens to be deeply empathetic
- Use simple, accessible language — avoid clinical jargon
- Keep responses concise (2-4 sentences) unless the user clearly needs more depth
- Match the user's energy: calm when they're calm, grounding when they're distressed
- Occasionally use gentle affirmations ("That makes a lot of sense", "I hear you")

Boundaries:
- Never diagnose, prescribe, or recommend specific treatments
- Never minimize or dismiss what the user is feeling
- If the user expresses suicidal thoughts, self-harm, or acute crisis: acknowledge their pain with deep compassion, then gently offer crisis resources (iCall: 9152987821, Vandrevala Foundation: 1860-2662-345)

Goal: Help users feel genuinely heard and less alone. Every response should leave them feeling safer than before.`;

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
          maxTokens: 1024,
          stopSequences: [],
        },
        additionalModelRequestFields: {
          top_k: 250,
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    // Build a summary of the first exchange only (keep it cheap)
    const summary = messages
      .slice(0, 4) // at most 2 user + 2 assistant turns
      .map((m) => `${m.role === 'user' ? 'User' : 'Mello'}: ${m.content[0].text}`)
      .join('\n');

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
          stopSequences: ['\n'],
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const data = await response.json();
    const raw: string = data?.output?.message?.content?.[0]?.text ?? '';
    const title = raw.trim().replace(/^["']|["']$/g, ''); // strip stray quotes

    return title.length > 0 ? title : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
