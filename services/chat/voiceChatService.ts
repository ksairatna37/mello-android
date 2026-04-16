/**
 * Voice Chat Service
 *
 * Supabase operations for Hume AI EVI voice sessions.
 * Mirrors chatService.ts but for voice_sessions table.
 *
 * Schema: public.voice_sessions, voice_context, voice_user_profiles
 *
 * Session lifecycle:
 *   1. startVoiceSession()      — creates row, returns session ID
 *   2. updateVoiceTranscript()  — append message (called per turn)
 *   3. finalizeVoiceSession()   — sets end_time, duration, summary, top_emotions
 *                                  upserts voice_user_profiles (hume_chat_group_id, counters)
 *
 * On next call:
 *   getVoiceSessionContext()    — returns hume_chat_group_id for URL param resume
 */

import { supabase } from '@/lib/supabase';
import { generateChatTitle, generateChatSummary, extractVoiceContext } from './bedrockService';
import type { BedrockMessage, ExtractedVoiceContext } from './bedrockService';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface VoiceTranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number; // Unix ms
  emotions?: Array<{ name: string; score: number }>; // top3, user turns only
}

export interface VoiceSessionContext {
  hume_chat_group_id: string | null;
  quick_context: string | null;
  last_emotions: string | null;
  detected_name: string | null;
  /** Pre-built string ready to inject as Hume's user_context variable (≤300 chars) */
  user_context_text: string;
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

  const { data, error } = await supabase.rpc('get_voice_session_context', {
    p_user_id: userId,
  });

  if (error) {
    console.error('>>> getVoiceSessionContext error:', error);
    return { hume_chat_group_id: null, quick_context: null, last_emotions: null, detected_name: null, user_context_text: '' };
  }

  const row = data?.[0] ?? null;
  const quickContext: string | null = row?.quick_context ?? null;
  const detectedName: string | null = row?.detected_name ?? null;

  console.log(
    '>>> context loaded — chatGroupId:',
    row?.hume_chat_group_id ? row.hume_chat_group_id.substring(0, 20) + '...' : 'none',
    '— hasQuickContext:', !!quickContext,
  );

  // ── Build user_context_text for Hume session_settings variable ──
  let userContextText = '';

  if (quickContext) {
    // Returning user: mirror WhatsApp agent format
    const name = detectedName;
    userContextText = name
      ? `Returning user named ${name}. ${quickContext}`
      : `Returning user. ${quickContext}`;
  } else {
    // New user: pull onboarding data and build first-call context
    userContextText = await buildOnboardingContext(userId);
  }

  // Cap at 300 chars to stay under ~100 tokens (same as WhatsApp agent)
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

/** Fetch user_onboarding row and build a short context string for new users. */
async function buildOnboardingContext(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('user_onboarding')
    .select('first_name, age_range, selected_feelings, challenge, style, presence, insight')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return 'First-time user, no prior history. Be warm and welcoming.';
  }

  const parts: string[] = [];
  const name = data.first_name as string | null;

  if (name) {
    parts.push(`First-time user named ${name}.`);
  } else {
    parts.push('First-time user.');
  }

  if (data.age_range) parts.push(`Age range: ${data.age_range}.`);

  if (Array.isArray(data.selected_feelings) && data.selected_feelings.length > 0) {
    parts.push(`Currently feeling: ${(data.selected_feelings as string[]).join(', ')}.`);
  }

  if (data.challenge) parts.push(`Challenge: ${data.challenge}.`);
  if (data.style)     parts.push(`Prefers: ${data.style} support.`);
  if (data.presence)  parts.push(`Goal: ${data.presence}.`);
  if (data.insight)   parts.push(`Insight: ${data.insight}.`);

  const result = parts.join(' ');
  return result || 'First-time user. Be warm and welcoming.';
}

// ═══════════════════════════════════════════════════════════════════════════
// START SESSION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new voice session row when a call begins.
 * Call this immediately on call start (before Hume connects) so we
 * always have a row even if the call drops before metadata arrives.
 */
export async function startVoiceSession(userId: string): Promise<string | null> {
  console.log('=== START VOICE SESSION ===');

  const { data, error } = await supabase
    .from('voice_sessions')
    .insert({
      user_id: userId,
      status: 'active',
      transcript: [],
    })
    .select('id')
    .single();

  if (error) {
    console.error('>>> startVoiceSession error:', error);
    return null;
  }

  console.log('>>> Voice session created:', data.id);
  return data.id as string;
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE HUME IDs (after chat_metadata received)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Store Hume's chat_id and chat_group_id once we receive chat_metadata.
 * These come from the onConnected callback.
 */
export async function updateHumeIds(
  sessionId: string,
  humeChatId: string,
  humeChatGroupId: string,
): Promise<void> {
  console.log('=== UPDATE HUME IDS ===', humeChatId.substring(0, 20), humeChatGroupId.substring(0, 20));

  const { error } = await supabase
    .from('voice_sessions')
    .update({
      hume_chat_id: humeChatId,
      hume_chat_group_id: humeChatGroupId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) console.error('>>> updateHumeIds error:', error);
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE TRANSCRIPT (per turn)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Append a transcript entry. Called after each user/assistant turn.
 * We pass the full array (same pattern as chatService.addMessage) to avoid
 * JSONB append race conditions.
 */
export async function updateVoiceTranscript(
  sessionId: string,
  transcript: VoiceTranscriptEntry[],
): Promise<void> {
  const { error } = await supabase
    .from('voice_sessions')
    .update({
      transcript,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) console.error('>>> updateVoiceTranscript error:', error);
}

// ═══════════════════════════════════════════════════════════════════════════
// FINALIZE SESSION (call end)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Finalize the session via RPC.
 * The RPC atomically:
 *   - Sets ended_at, duration_seconds, summary, top_emotions, status='ended'
 *   - Upserts voice_user_profiles (hume_chat_group_id, counters)
 *
 * Summary is generated here (same as endChat in chatService).
 * Fired as fire-and-forget from the call end handler.
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

  // Aggregate top emotions from all user turns
  const topEmotions = aggregateEmotions(transcript);

  // Generate summary in background (non-blocking)
  generateSummaryAndFinalize(
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
  // Convert to Bedrock format for title + summary
  const bedrockMessages: BedrockMessage[] = transcript.map((t) => ({
    role: t.role,
    content: [{ text: t.text }],
  }));

  // Generate title + summary in parallel (same pattern as text chat)
  const [title, summary] = transcript.length >= 2
    ? await Promise.all([
        generateChatTitle(bedrockMessages),
        generateChatSummary(bedrockMessages),
      ])
    : [null, null];

  // ── Update voice_sessions via RPC ──
  // Pass raw objects — NOT JSON.stringify (that double-encodes and breaks jsonb_array_elements)
  const { error } = await supabase.rpc('finalize_voice_session', {
    p_session_id: sessionId,
    p_user_id: userId,
    p_hume_chat_group_id: humeChatGroupId,
    p_ended_at: new Date(endedAt).toISOString(),
    p_duration_seconds: durationSeconds,
    p_top_emotions: topEmotions,
    p_summary: summary ?? '',
    p_transcript: transcript,
  });

  if (error) {
    console.error('>>> finalizeVoiceSession RPC error:', error);
  } else {
    console.log('>>> Voice session finalized. Duration:', durationSeconds + 's, Title:', title);
  }

  // ── Create a chats row so this session appears in sidebar recents ──
  // Merge consecutive assistant entries (Hume streams each sentence separately)
  // before storing, so the chat view renders one bubble per turn.
  const chatConversation = mergeConsecutiveAssistant(transcript);

  const chatTitle = title ?? 'Voice chat';

  const { error: chatError } = await supabase
    .from('chats')
    .insert({
      user_id: userId,
      title: chatTitle,
      type: 'voicechat',
      start_time: startedAt,
      end_time: endedAt,
      duration: durationSeconds,
      summary: summary ?? null,
      conversation: chatConversation,
      updated_at: new Date(endedAt).toISOString(),
    });

  if (chatError) {
    console.error('>>> createVoiceChatRow error:', chatError);
  } else {
    console.log('>>> Voice chat row created:', chatTitle);
  }

  // ── Context extraction pipeline (fire-and-forget) ──
  // Mirrors the WhatsApp agent's post-call context extraction.
  // Populates voice_context + rebuilds voice_user_profiles.quick_context
  // so the NEXT call starts with personalised context injected via user_context.
  extractAndSaveVoiceContext(userId, bedrockMessages, topEmotions);
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT EXTRACTION PIPELINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fire-and-forget post-call pipeline:
 *   1. Call Bedrock to extract triggers / coping / preferences / summary
 *   2. Upsert each item into voice_context (one row per context_type)
 *   3. Rebuild quick_context string
 *   4. Update voice_user_profiles.quick_context + last_emotions
 *
 * On the NEXT call, getVoiceSessionContext() reads quick_context and injects
 * it as the Hume user_context variable — closing the personalisation loop.
 */
async function extractAndSaveVoiceContext(
  userId: string,
  bedrockMessages: BedrockMessage[],
  topEmotions: Array<{ name: string; score: number }>,
): Promise<void> {
  console.log('=== EXTRACT AND SAVE VOICE CONTEXT ===');

  const extracted = await extractVoiceContext(bedrockMessages, topEmotions);
  if (!extracted) {
    console.log('>>> Context extraction returned null, skipping save');
    return;
  }

  await saveExtractedVoiceContext(userId, extracted, topEmotions);
}

/**
 * Save individual context items to voice_context table.
 * Uses delete-then-insert per context_type to keep one authoritative row.
 * Also rebuilds quick_context in voice_user_profiles.
 */
async function saveExtractedVoiceContext(
  userId: string,
  extracted: ExtractedVoiceContext,
  topEmotions: Array<{ name: string; score: number }>,
): Promise<void> {
  console.log('=== SAVE EXTRACTED VOICE CONTEXT ===');

  // Define what to save: { type, text, priority }
  const items: Array<{ context_type: string; context_text: string; priority: number }> = [];

  if (extracted.triggers.length > 0) {
    items.push({
      context_type: 'trigger',
      context_text: extracted.triggers.join(', '),
      priority: 9,
    });
  }
  if (extracted.coping.length > 0) {
    items.push({
      context_type: 'coping',
      context_text: extracted.coping.join(', '),
      priority: 8,
    });
  }
  if (extracted.preferences.length > 0) {
    items.push({
      context_type: 'preference',
      context_text: extracted.preferences[0],
      priority: 6,
    });
  }
  if (extracted.summary) {
    items.push({
      context_type: 'summary',
      context_text: extracted.summary.slice(0, 200),
      priority: 5,
    });
  }

  // Upsert each type: delete old row then insert fresh
  for (const item of items) {
    await supabase
      .from('voice_context')
      .delete()
      .eq('user_id', userId)
      .eq('context_type', item.context_type);

    const { error } = await supabase
      .from('voice_context')
      .insert({
        user_id: userId,
        context_type: item.context_type,
        context_text: item.context_text,
        priority: item.priority,
        is_active: true,
      });

    if (error) {
      console.error(`>>> saveExtractedVoiceContext insert error (${item.context_type}):`, error);
    } else {
      console.log(`>>> Saved ${item.context_type}: ${item.context_text.slice(0, 60)}`);
    }
  }

  // Build quick_context string and update voice_user_profiles
  const quickContext = buildVoiceQuickContext(extracted, topEmotions);
  console.log('>>> Built quick_context:', quickContext.slice(0, 100));

  if (quickContext) {
    const emotionsStr = topEmotions
      .slice(0, 3)
      .map((e) => `${e.name}: ${e.score.toFixed(2)}`)
      .join(', ');

    const { error } = await supabase
      .from('voice_user_profiles')
      .update({
        quick_context: quickContext.slice(0, 400),
        last_emotions: emotionsStr || null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      console.error('>>> updateQuickContext error:', error);
    } else {
      console.log('>>> voice_user_profiles.quick_context updated ✓');
    }
  }
}

/**
 * Build the pre-computed context string that gets injected into Hume as user_context.
 * Mirrors the Python agent's build_quick_context() exactly.
 * Target: ~40-60 tokens, fits comfortably in 300 char cap.
 *
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
      ? extracted.summary.slice(0, 60).replace(/\s\S*$/, '') // trim at word boundary
      : extracted.summary;
    parts.push(`Last session: ${short}`);
  }

  return parts.join(' | ');
}

/**
 * Merge consecutive same-role assistant entries into a single bubble.
 *
 * Hume EVI sends each sentence as a separate assistant_message event, but
 * they belong to the same conversational turn.  Two consecutive assistant
 * entries are joined with "  " (two spaces — renders like a natural pause).
 * User entries are never merged (each speech segment is already one turn).
 */
function mergeConsecutiveAssistant(
  transcript: VoiceTranscriptEntry[],
): Array<{ role: string; content: string; timestamp: number }> {
  const result: Array<{ role: string; content: string; timestamp: number }> = [];

  for (const entry of transcript) {
    const last = result[result.length - 1];
    if (last && last.role === 'assistant' && entry.role === 'assistant') {
      // Append sentence with a space separator
      last.content = `${last.content}  ${entry.text}`;
    } else {
      result.push({ role: entry.role, content: entry.text, timestamp: entry.timestamp });
    }
  }

  return result;
}

/**
 * Aggregate emotion scores across all user turns.
 * Returns top 5 emotions by average score.
 */
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

/**
 * Get recent voice sessions for display (e.g. in sidebar or profile)
 */
export async function getVoiceSessions(
  userId: string,
  limit = 20,
): Promise<Array<{ id: string; started_at: string; duration_seconds: number | null; summary: string | null }>> {
  const { data, error } = await supabase
    .from('voice_sessions')
    .select('id, started_at, duration_seconds, summary')
    .eq('user_id', userId)
    .eq('status', 'ended')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('>>> getVoiceSessions error:', error);
    return [];
  }

  return data ?? [];
}
