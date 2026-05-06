/**
 * Voice Chat Service — REST migration.
 *
 * Per /docs (live backend, 31 endpoints), voice persistence is now
 * exposed as REST CRUD over three tables:
 *
 *   /rest/v1/voice_sessions       — per-call rows (status, transcript,
 *                                    summary, duration, top_emotions,
 *                                    hume_chat_id, hume_chat_group_id)
 *   /rest/v1/voice_user_profiles  — one row per user (hume_chat_group_id,
 *                                    quick_context, last_emotions,
 *                                    detected_name, total_sessions,
 *                                    total_minutes)  — POST upserts.
 *   /rest/v1/voice_context        — many rows per user, keyed by
 *                                    context_type (trigger, coping,
 *                                    preference, summary). Priority 1–10.
 *
 * Public function signatures here are PRESERVED 1:1 from the previous
 * Supabase-RPC version so VoiceAgentScreen and SelfMindVoicePre don't
 * break. Internals are the only thing that changed.
 *
 * Session lifecycle remains:
 *   1. startVoiceSession()       — POST /voice_sessions, returns id
 *   2. updateHumeIds()           — PATCH /voice_sessions?id=…
 *   3. updateVoiceTranscript()   — PATCH /voice_sessions?id=… (transcript)
 *   4. finalizeVoiceSession()    — PATCH /voice_sessions?id=… (status,
 *                                    ended_at, duration, summary,
 *                                    top_emotions) + POST /voice_user_profiles
 *                                    (upsert quick_context counters) +
 *                                    POST /update/chat (record voice
 *                                    chat in the unified chat blob)
 *
 * On the next call:
 *   getVoiceSessionContext()    — GET /voice_user_profiles for
 *                                  hume_chat_group_id + quick_context.
 *                                  Falls back to local onboarding
 *                                  storage for new-user context (no
 *                                  GET /user_onboarding endpoint exists).
 */

import { authPost, authGet, authPatch } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { getAccessToken } from '@/services/auth';
import { generateChatTitle, generateChatSummary, extractVoiceContext } from './bedrockService';
import type { BedrockMessage, ExtractedVoiceContext } from './bedrockService';
import { getOnboardingData } from '@/utils/onboardingStorage';
import { addVoiceChatToBlob } from './chatService';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES (unchanged — public surface preserved)
// ═══════════════════════════════════════════════════════════════════════════

export interface VoiceTranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  emotions?: Array<{ name: string; score: number }>;
}

export interface VoiceSessionContext {
  hume_chat_group_id: string | null;
  quick_context: string | null;
  last_emotions: string | null;
  detected_name: string | null;
  /** Pre-built string ready to inject as Hume's user_context variable (≤300 chars) */
  user_context_text: string;
}

interface VoiceUserProfileRow {
  user_id: string;
  hume_chat_group_id: string | null;
  quick_context: string | null;
  last_emotions: string | null;
  detected_name: string | null;
  total_sessions: number | null;
  total_minutes: number | null;
}

interface VoiceSessionRow {
  id: string;
  user_id: string;
  hume_chat_id: string | null;
  hume_chat_group_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  transcript: VoiceTranscriptEntry[] | null;
  summary: string | null;
  top_emotions: Array<{ name: string; score: number }> | null;
  status: 'active' | 'ended' | null;
}

interface VoiceContextRow {
  id: string;
  user_id: string;
  context_type: string;
  context_text: string;
  priority: number;
  is_active: boolean;
  expires_at: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH HELPER
// ═══════════════════════════════════════════════════════════════════════════

async function requireToken(): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) {
    console.error('[voiceChatService] no access token — request skipped');
    return null;
  }
  return token;
}

// ═══════════════════════════════════════════════════════════════════════════
// GET CONTEXT (call start)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch hume_chat_group_id + context for session resume.
 * Returns null fields on first-ever call (new user).
 */
export async function getVoiceSessionContext(
  userId: string,
): Promise<VoiceSessionContext> {
  console.log('=== GET VOICE SESSION CONTEXT ===');

  const token = await requireToken();
  if (!token) {
    return { hume_chat_group_id: null, quick_context: null, last_emotions: null, detected_name: null, user_context_text: '' };
  }

  const { data, error } = await authGet<VoiceUserProfileRow | { message: string; code: string }>(
    `${ENDPOINTS.VOICE_USER_PROFILES}?user_id=${encodeURIComponent(userId)}`,
    token,
  );

  // 404 (no profile yet) is the new-user path. Surface as a null row.
  const isNotFound = !!error && (error.code === 'not_found' || /not found/i.test(error.message));
  let row: VoiceUserProfileRow | null = null;
  if (data && (data as VoiceUserProfileRow).user_id) {
    row = data as VoiceUserProfileRow;
  } else if (error && !isNotFound) {
    console.error('>>> getVoiceSessionContext error:', error);
  }

  const quickContext = row?.quick_context ?? null;
  const detectedName = row?.detected_name ?? null;

  console.log(
    '>>> context loaded — chatGroupId:',
    row?.hume_chat_group_id ? row.hume_chat_group_id.substring(0, 20) + '…' : 'none',
    '— hasQuickContext:', !!quickContext,
  );

  // ── Build user_context_text for Hume session_settings variable ──
  let userContextText = '';
  if (quickContext) {
    userContextText = detectedName
      ? `Returning user named ${detectedName}. ${quickContext}`
      : `Returning user. ${quickContext}`;
  } else {
    userContextText = await buildOnboardingContextLocal();
  }
  userContextText = userContextText.slice(0, 300);
  console.log('>>> user_context_text:', userContextText.substring(0, 80) || '(empty)');

  return {
    hume_chat_group_id: row?.hume_chat_group_id ?? null,
    quick_context: quickContext,
    last_emotions: row?.last_emotions ?? null,
    detected_name: detectedName,
    user_context_text: userContextText,
  };
}

/**
 * Build first-call context from LOCAL onboarding storage.
 *
 * Previously read from `user_onboarding` via Supabase. The live REST
 * backend exposes POST /rest/v1/user_onboarding but no GET, so we fall
 * back to AsyncStorage (which has the user's answers from this session
 * anyway). Acceptable for first-call context — if storage is empty
 * (cold-installed device, signed-in elsewhere), we ship a generic
 * welcoming string.
 */
async function buildOnboardingContextLocal(): Promise<string> {
  try {
    const data = await getOnboardingData();
    const parts: string[] = [];

    const name = data.firstName ? data.firstName.trim() : null;
    parts.push(name ? `First-time user named ${name}.` : 'First-time user.');

    if (Array.isArray(data.personalizeTopics) && data.personalizeTopics.length > 0) {
      parts.push(`Currently noticing: ${data.personalizeTopics.slice(0, 3).join(', ')}.`);
    }
    if (data.personalizeTone) {
      parts.push(`Prefers: ${data.personalizeTone} tone.`);
    }
    if (data.qHeadWeather) parts.push(`Head-weather check-in: ${data.qHeadWeather}.`);

    return parts.join(' ') || 'First-time user. Be warm and welcoming.';
  } catch {
    return 'First-time user. Be warm and welcoming.';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// START SESSION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /voice_sessions — create row with status='active'.
 * Returns the new session id, or null on auth/network failure.
 */
export async function startVoiceSession(userId: string): Promise<string | null> {
  console.log('=== START VOICE SESSION ===');

  const token = await requireToken();
  if (!token) return null;

  const { data, error } = await authPost<
    VoiceSessionRow,
    { user_id: string; status: string; transcript: VoiceTranscriptEntry[] }
  >(
    ENDPOINTS.VOICE_SESSIONS,
    { user_id: userId, status: 'active', transcript: [] },
    token,
  );

  if (error || !data?.id) {
    console.error('>>> startVoiceSession error:', error);
    return null;
  }

  console.log('>>> Voice session created:', data.id);
  return data.id;
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE HUME IDs (after chat_metadata received)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Store Hume's chat_id and chat_group_id once we receive chat_metadata.
 * Idempotent — calling with the same values does no harm.
 */
export async function updateHumeIds(
  sessionId: string,
  humeChatId: string,
  humeChatGroupId: string,
): Promise<void> {
  console.log('=== UPDATE HUME IDS ===', humeChatId.slice(0, 20), humeChatGroupId.slice(0, 20));

  const token = await requireToken();
  if (!token) return;

  const { error } = await authPatch<
    VoiceSessionRow,
    { hume_chat_id: string; hume_chat_group_id: string }
  >(
    `${ENDPOINTS.VOICE_SESSIONS}?id=${encodeURIComponent(sessionId)}`,
    { hume_chat_id: humeChatId, hume_chat_group_id: humeChatGroupId },
    token,
  );
  if (error) console.error('>>> updateHumeIds error:', error);
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE TRANSCRIPT (per turn)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Append a transcript entry. Caller passes the full array (avoids
 * JSONB append race conditions). PATCH overwrites the column.
 */
export async function updateVoiceTranscript(
  sessionId: string,
  transcript: VoiceTranscriptEntry[],
): Promise<void> {
  const token = await requireToken();
  if (!token) return;

  const { error } = await authPatch<
    VoiceSessionRow,
    { transcript: VoiceTranscriptEntry[] }
  >(
    `${ENDPOINTS.VOICE_SESSIONS}?id=${encodeURIComponent(sessionId)}`,
    { transcript },
    token,
  );
  if (error) console.error('>>> updateVoiceTranscript error:', error);
}

// ═══════════════════════════════════════════════════════════════════════════
// FINALIZE SESSION (call end)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Finalize the session. Replaces the previous Supabase RPC with a
 * choreography of REST calls:
 *
 *   1. PATCH /voice_sessions?id=…   — status=ended, ended_at, duration,
 *                                      transcript, summary, top_emotions
 *   2. POST /voice_user_profiles    — upsert (hume_chat_group_id,
 *                                      counter increments)
 *   3. POST /update/chat            — append voice chat to the user's
 *                                      chat blob so it shows up in the
 *                                      sidebar / chat home recents
 *   4. fire-and-forget Bedrock      — extract triggers/coping/preferences/
 *                                      summary, save into voice_context,
 *                                      rebuild quick_context for next call
 *
 * Same fire-and-forget semantics as before — caller doesn't await any
 * of this except the initial trigger.
 */
export async function finalizeVoiceSession(
  sessionId: string,
  userId: string,
  humeChatGroupId: string,
  startedAt: number, // Unix ms
  transcript: VoiceTranscriptEntry[],
): Promise<void> {
  console.log('=== FINALIZE VOICE SESSION ===', sessionId, 'turns:', transcript.length);

  if (transcript.length === 0) {
    console.log('>>> Empty transcript, skipping finalize');
    return;
  }

  const endedAt = Date.now();
  const durationSeconds = startedAt > 0 ? Math.round((endedAt - startedAt) / 1000) : 0;
  const topEmotions = aggregateEmotions(transcript);

  // Background — does not block the caller.
  void generateSummaryAndFinalize(
    sessionId,
    userId,
    humeChatGroupId,
    startedAt,
    endedAt,
    durationSeconds,
    topEmotions,
    transcript,
  );
}

async function generateSummaryAndFinalize(
  sessionId: string,
  userId: string,
  humeChatGroupId: string,
  startedAt: number,
  endedAt: number,
  durationSeconds: number,
  topEmotions: Array<{ name: string; score: number }>,
  transcript: VoiceTranscriptEntry[],
): Promise<void> {
  const token = await requireToken();
  if (!token) return;

  const bedrockMessages: BedrockMessage[] = transcript.map((t) => ({
    role: t.role,
    content: [{ text: t.text }],
  }));

  const [title, summary] = transcript.length >= 2
    ? await Promise.all([
        generateChatTitle(bedrockMessages),
        generateChatSummary(bedrockMessages),
      ])
    : [null, null];

  // 1. PATCH voice_sessions — write end metrics
  const { error: patchError } = await authPatch<
    VoiceSessionRow,
    {
      status: 'ended';
      ended_at: string;
      duration_seconds: number;
      transcript: VoiceTranscriptEntry[];
      summary: string;
      top_emotions: Array<{ name: string; score: number }>;
      hume_chat_group_id: string;
    }
  >(
    `${ENDPOINTS.VOICE_SESSIONS}?id=${encodeURIComponent(sessionId)}`,
    {
      status: 'ended',
      ended_at: new Date(endedAt).toISOString(),
      duration_seconds: durationSeconds,
      transcript,
      summary: summary ?? '',
      top_emotions: topEmotions,
      hume_chat_group_id: humeChatGroupId,
    },
    token,
  );
  if (patchError) {
    console.error('>>> finalizeVoiceSession PATCH error:', patchError);
  }

  // 2. POST voice_user_profiles — upsert (counters increment requires
  //    read-modify-write since the API doesn't expose increment).
  const { data: prevProfile } = await authGet<VoiceUserProfileRow>(
    `${ENDPOINTS.VOICE_USER_PROFILES}?user_id=${encodeURIComponent(userId)}`,
    token,
  );
  const totalSessionsBefore = prevProfile?.total_sessions ?? 0;
  const totalMinutesBefore = prevProfile?.total_minutes ?? 0;

  const { error: profileError } = await authPost<
    VoiceUserProfileRow,
    {
      user_id: string;
      hume_chat_group_id: string;
      total_sessions: number;
      total_minutes: number;
    }
  >(
    ENDPOINTS.VOICE_USER_PROFILES,
    {
      user_id: userId,
      hume_chat_group_id: humeChatGroupId,
      total_sessions: totalSessionsBefore + 1,
      total_minutes: totalMinutesBefore + Math.round(durationSeconds / 60),
    },
    token,
  );
  if (profileError) {
    console.error('>>> finalizeVoiceSession upsert profile error:', profileError);
  }

  console.log('>>> Voice session finalized. Duration:', durationSeconds + 's, Title:', title);

  // 3. Append a chats entry to the unified chat blob so this voice
  //    session appears alongside text chats in the sidebar/recents.
  const chatConversation = mergeConsecutiveAssistant(transcript);
  await addVoiceChatToBlob({
    title: title ?? 'Voice chat',
    summary: summary ?? null,
    conversation: chatConversation,
    startTime: startedAt,
    endTime: endedAt,
    duration: durationSeconds,
  }).catch((err) => console.error('>>> addVoiceChatToBlob error:', err));

  // 4. Background: extract context for the next call.
  void extractAndSaveVoiceContext(userId, bedrockMessages, topEmotions, token);
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT EXTRACTION PIPELINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Post-call pipeline:
 *   1. Bedrock extracts triggers / coping / preferences / summary
 *   2. Upsert each into voice_context (delete-then-insert per type)
 *   3. Rebuild quick_context, write into voice_user_profiles
 */
async function extractAndSaveVoiceContext(
  userId: string,
  bedrockMessages: BedrockMessage[],
  topEmotions: Array<{ name: string; score: number }>,
  token: string,
): Promise<void> {
  console.log('=== EXTRACT AND SAVE VOICE CONTEXT ===');

  const extracted = await extractVoiceContext(bedrockMessages, topEmotions);
  if (!extracted) {
    console.log('>>> Context extraction returned null, skipping save');
    return;
  }

  await saveExtractedVoiceContext(userId, extracted, topEmotions, token);
}

async function saveExtractedVoiceContext(
  userId: string,
  extracted: ExtractedVoiceContext,
  topEmotions: Array<{ name: string; score: number }>,
  token: string,
): Promise<void> {
  console.log('=== SAVE EXTRACTED VOICE CONTEXT ===');

  const items: Array<{ context_type: string; context_text: string; priority: number }> = [];
  if (extracted.triggers.length > 0) {
    items.push({ context_type: 'trigger', context_text: extracted.triggers.join(', '), priority: 9 });
  }
  if (extracted.coping.length > 0) {
    items.push({ context_type: 'coping', context_text: extracted.coping.join(', '), priority: 8 });
  }
  if (extracted.preferences.length > 0) {
    items.push({ context_type: 'preference', context_text: extracted.preferences[0], priority: 6 });
  }
  if (extracted.summary) {
    items.push({ context_type: 'summary', context_text: extracted.summary.slice(0, 200), priority: 5 });
  }

  // Read existing rows once so we can find the previous id per type and
  // PATCH it (otherwise we'd insert duplicates — there's no upsert by
  // (user_id, context_type) on the REST surface).
  const { data: existingRows } = await authGet<VoiceContextRow[]>(
    `${ENDPOINTS.VOICE_CONTEXT}?user_id=${encodeURIComponent(userId)}`,
    token,
  );
  const existingByType = new Map<string, VoiceContextRow>();
  if (Array.isArray(existingRows)) {
    for (const row of existingRows) existingByType.set(row.context_type, row);
  }

  for (const item of items) {
    const prev = existingByType.get(item.context_type);
    if (prev) {
      const { error } = await authPatch<
        VoiceContextRow,
        { context_text: string; priority: number; is_active: boolean }
      >(
        `${ENDPOINTS.VOICE_CONTEXT}?id=${encodeURIComponent(prev.id)}`,
        { context_text: item.context_text, priority: item.priority, is_active: true },
        token,
      );
      if (error) {
        console.error(`>>> saveExtractedVoiceContext PATCH error (${item.context_type}):`, error);
      } else {
        console.log(`>>> Updated ${item.context_type}: ${item.context_text.slice(0, 60)}`);
      }
    } else {
      const { error } = await authPost<
        VoiceContextRow,
        {
          user_id: string;
          context_type: string;
          context_text: string;
          priority: number;
          is_active: boolean;
        }
      >(
        ENDPOINTS.VOICE_CONTEXT,
        {
          user_id: userId,
          context_type: item.context_type,
          context_text: item.context_text,
          priority: item.priority,
          is_active: true,
        },
        token,
      );
      if (error) {
        console.error(`>>> saveExtractedVoiceContext insert error (${item.context_type}):`, error);
      } else {
        console.log(`>>> Saved ${item.context_type}: ${item.context_text.slice(0, 60)}`);
      }
    }
  }

  // Rebuild quick_context and update voice_user_profiles
  const quickContext = buildVoiceQuickContext(extracted, topEmotions);
  console.log('>>> Built quick_context:', quickContext.slice(0, 100));

  if (quickContext) {
    const emotionsStr = topEmotions
      .slice(0, 3)
      .map((e) => `${e.name}: ${e.score.toFixed(2)}`)
      .join(', ');

    const { error } = await authPatch<
      VoiceUserProfileRow,
      { quick_context: string; last_emotions: string | null }
    >(
      `${ENDPOINTS.VOICE_USER_PROFILES}?user_id=${encodeURIComponent(userId)}`,
      { quick_context: quickContext.slice(0, 400), last_emotions: emotionsStr || null },
      token,
    );
    if (error) {
      console.error('>>> updateQuickContext error:', error);
    } else {
      console.log('>>> voice_user_profiles.quick_context updated ✓');
    }
  }
}

/**
 * Build the pre-computed context string injected into Hume as user_context.
 * Format: "Struggles with: X | Finds comfort in: Y | Feeling: Z | Last session: W"
 */
function buildVoiceQuickContext(
  extracted: ExtractedVoiceContext,
  topEmotions: Array<{ name: string; score: number }>,
): string {
  const parts: string[] = [];
  if (extracted.triggers.length > 0) {
    parts.push(`Struggles with: ${extracted.triggers.slice(0, 2).join(', ')}`);
  }
  if (extracted.coping.length > 0) {
    parts.push(`Finds comfort in: ${extracted.coping.slice(0, 2).join(', ')}`);
  }
  if (topEmotions.length > 0) {
    const topTwo = topEmotions.slice(0, 2).map((e) => e.name.toLowerCase());
    parts.push(`Feeling: ${topTwo.join(', ')}`);
  }
  if (extracted.summary) {
    const short = extracted.summary.length > 60
      ? extracted.summary.slice(0, 60).replace(/\s\S*$/, '')
      : extracted.summary;
    parts.push(`Last session: ${short}`);
  }
  return parts.join(' | ');
}

/**
 * Merge consecutive same-role assistant entries into one bubble.
 * Hume EVI streams each sentence as a separate event but they belong
 * to the same conversational turn.
 */
function mergeConsecutiveAssistant(
  transcript: VoiceTranscriptEntry[],
): Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }> {
  const result: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }> = [];
  for (const entry of transcript) {
    const last = result[result.length - 1];
    if (last && last.role === 'assistant' && entry.role === 'assistant') {
      last.content = `${last.content}  ${entry.text}`;
    } else {
      result.push({ role: entry.role, content: entry.text, timestamp: entry.timestamp });
    }
  }
  return result;
}

/** Aggregate emotion scores across user turns; returns top 5 by avg. */
function aggregateEmotions(
  transcript: VoiceTranscriptEntry[],
): Array<{ name: string; score: number }> {
  const totals: Record<string, { sum: number; count: number }> = {};
  for (const entry of transcript) {
    if (entry.role !== 'user' || !entry.emotions) continue;
    for (const e of entry.emotions) {
      if (!totals[e.name]) totals[e.name] = { sum: 0, count: 0 };
      totals[e.name].sum += e.score;
      totals[e.name].count += 1;
    }
  }
  return Object.entries(totals)
    .map(([name, { sum, count }]) => ({ name, score: sum / count }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// ═══════════════════════════════════════════════════════════════════════════
// LIST RECENT VOICE SESSIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get recent ended voice sessions (e.g. for sidebar / profile).
 * Returns lightweight fields; the full transcript is per-session GET.
 */
export async function getVoiceSessions(
  userId: string,
  limit = 20,
): Promise<Array<{ id: string; started_at: string; duration_seconds: number | null; summary: string | null }>> {
  const token = await requireToken();
  if (!token) return [];

  const { data, error } = await authGet<VoiceSessionRow[]>(
    `${ENDPOINTS.VOICE_SESSIONS}?user_id=${encodeURIComponent(userId)}&status=ended`,
    token,
  );

  if (error || !Array.isArray(data)) {
    console.error('>>> getVoiceSessions error:', error);
    return [];
  }

  return data.slice(0, limit).map((s) => ({
    id: s.id,
    started_at: s.started_at ?? '',
    duration_seconds: s.duration_seconds,
    summary: s.summary,
  }));
}
