/**
 * SelfMindBrainDump — quick capture of looping thoughts.
 *
 * 1:1 spirit of MBBrainDump in mobile-screens-c.jsx. Cream canvas.
 * Composer at the top (mic icon — TODO when STT is wired). Filter
 * chips (all / urgent / later / decide). Items list with a colored
 * bucket dot, the thought itself, and bucket label on the right.
 *
 * Local-only state for now — items live in component state. Future
 * enhancement: persist into journal_entries with source='braindump'
 * so dumps round-trip across devices.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Glyphs, BRAND as C, RADIUS } from '@/components/common/BrandGlyphs';
import { FadingScrollWrapper } from '@/components/get-rolling/ScrollFadeEdges';
import SavePracticeButton from './SavePracticeButton';
import BrainDumpInfoSheet from './BrainDumpInfoSheet';
import { classifyBrainDumpThought } from '@/services/chat/bedrockService';
import { incrementStat as incrementPracticeStat } from '@/services/practice/practiceProfileSync';

/* Bucket taxonomy — therapeutically tuned (CBT + ACT framing):
 *   soon = "do soon"  — concrete near-term action, no panic.
 *   park = "park it"  — real to-do, but it can wait; permission to defer.
 *   sit  = "sit with" — questions / doubts / inner debate; defusion,
 *                       no resolution demanded. Default for ambiguous.
 *
 * Names deliberately avoid "Urgent" (validates threat appraisal during
 * spirals) and "Decide" (frames rumination as solvable). See the
 * design rationale doc — change these only with explicit clinical
 * review. */
type Bucket = 'soon' | 'park' | 'sit';
type FilterId = 'all' | Bucket;

interface BrainItem {
  id: string;
  text: string;
  bucket: Bucket;
}

const BUCKET_COLOR: Record<Bucket, string> = {
  soon: C.coral,
  park: C.lavender,
  sit: C.butter,
};

/** Human label for each bucket (lowercase, app voice). */
const BUCKET_LABEL: Record<Bucket, string> = {
  soon: 'do soon',
  park: 'park it',
  sit: 'sit with',
};

/** Heuristic auto-bucketing — looks for hint words. Falls back to
 *  'sit' for anything ambiguous so rumination-shaped thoughts don't
 *  get mis-flagged as actions. */
function autoBucket(text: string): Bucket {
  const t = text.toLowerCase();
  if (/\b(reply|email|message|asap|today|tonight)\b/.test(t)) return 'soon';
  if (/\b(do i|maybe|should i|am i|wondering|figure out)\b/.test(t)) return 'sit';
  if (/\b(week|month|later|eventually|some(?:day|time))\b/.test(t)) return 'park';
  return 'sit';
}

export default function SelfMindBrainDump() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [items, setItems] = useState<BrainItem[]>([]);
  const [filter, setFilter] = useState<FilterId>('all');
  const [draft, setDraft] = useState('');
  /* Item being re-categorised via the popup. null = popup closed. */
  const [editingItem, setEditingItem] = useState<BrainItem | null>(null);
  /* "What do these mean?" info bottom sheet. */
  const [infoOpen, setInfoOpen] = useState(false);
  /* Voice-to-text capture state. While listening, the mic button
   * pulses and tapping it stops the session. */
  const [listening, setListening] = useState(false);
  /* Stash the recognized-text base so interim results don't keep
   * appending the same prefix. We replace the tail of the draft with
   * the latest transcript on every interim event. */
  const sttBaseRef = useRef('');

  /* Reset filter to "all" every time this screen regains focus, so a
   * stale chip from a previous visit doesn't hide newly-added thoughts.
   * State is otherwise preserved across focus changes (items survive). */
  useFocusEffect(
    useCallback(() => {
      setFilter('all');
    }, []),
  );

  const counts = useMemo(() => ({
    all: items.length,
    soon: items.filter((i) => i.bucket === 'soon').length,
    park: items.filter((i) => i.bucket === 'park').length,
    sit: items.filter((i) => i.bucket === 'sit').length,
  }), [items]);

  const visible = useMemo(() => (
    filter === 'all' ? items : items.filter((i) => i.bucket === filter)
  ), [items, filter]);

  /* Two-stage bucket assignment:
   *   1. Local heuristic decides immediately so the chip lands in
   *      the list with zero latency (typing → enter → it's there).
   *   2. Bedrock classifier runs in the background for a more
   *      accurate read on phrasing the regex can't catch. If it
   *      returns a different bucket within a few seconds, we update
   *      the chip in place. If the call fails, the heuristic stays.
   * Net effect: instant feedback + AI quality, with no spinner UI. */
  const handleAdd = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    const id = `b_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const heuristicBucket = autoBucket(text);
    const item: BrainItem = { id, text, bucket: heuristicBucket };
    console.log('[BrainDump] add bucket(heuristic)=' + heuristicBucket + ' text=' + text.slice(0, 40));
    setItems((prev) => [item, ...prev]);
    setDraft('');

    /* Bump the persistent thoughts-added counter — server-backed via
     * practiceProfileSync. The thought TEXT stays local (per the
     * "let it go" therapeutic frame), but the count is profile data
     * that should follow the user across devices. */
    incrementPracticeStat('brain-dump', 'thoughtsAdded', 1);

    /* Background AI classify — replace the bucket on this item if the
     * model disagrees. We match by id so re-orderings don't break it. */
    void classifyBrainDumpThought(text).then((aiBucket) => {
      if (!aiBucket || aiBucket === heuristicBucket) return;
      console.log('[BrainDump] AI reclassified ' + id + ' → ' + aiBucket);
      setItems((prev) =>
        prev.map((b) => (b.id === id ? { ...b, bucket: aiBucket } : b)),
      );
    });
  }, [draft]);

  /* Voice-to-text — toggle listening on the mic button. Reuses
   * `expo-speech-recognition` (already wired for journal). Interim
   * results stream into `draft` so the user sees text grow as they
   * speak; tapping mic again stops the session. */
  const handleMicPress = useCallback(async () => {
    let ExpoSpeechRecognition: any;
    try {
      ExpoSpeechRecognition = require('expo-speech-recognition');
    } catch {
      Alert.alert('Voice input', 'Speech recognition isn’t available on this device. Type instead.');
      return;
    }

    if (listening) {
      try { ExpoSpeechRecognition.stop(); } catch { /* ignore */ }
      setListening(false);
      return;
    }

    try {
      const { status } = await ExpoSpeechRecognition.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Microphone', 'Enable microphone access in Settings to dictate your thought.');
        return;
      }
      sttBaseRef.current = draft.endsWith(' ') || draft.length === 0 ? draft : draft + ' ';
      ExpoSpeechRecognition.start({ lang: 'en-US', interimResults: true, maxAlternatives: 1 });
      setListening(true);
      ExpoSpeechRecognition.addListener('result', (event: any) => {
        const last = event?.results?.[event.results.length - 1];
        const transcript: string | undefined = last?.[0]?.transcript;
        if (!transcript) return;
        setDraft(sttBaseRef.current + transcript);
      });
      ExpoSpeechRecognition.addListener('end', () => {
        setListening(false);
      });
      ExpoSpeechRecognition.addListener('error', (e: any) => {
        console.warn('[BrainDump] STT error', e?.error ?? e);
        setListening(false);
      });
    } catch (err) {
      console.warn('[BrainDump] mic start failed', err);
      setListening(false);
    }
  }, [listening, draft]);

  /* Stop listening if the screen unmounts mid-session. */
  useEffect(() => {
    return () => {
      if (listening) {
        try { require('expo-speech-recognition').stop(); } catch { /* ignore */ }
      }
    };
  }, [listening]);

  /* Manual reassignment — user taps an item, picks a new bucket from
   * the popup. Overrides the AI's call. Closes the popup on pick. */
  const handleReassign = useCallback((id: string, next: Bucket) => {
    console.log('[BrainDump] manual reassign ' + id + ' → ' + next);
    setItems((prev) => prev.map((b) => (b.id === id ? { ...b, bucket: next } : b)));
    setEditingItem(null);
  }, []);

  const filters: ReadonlyArray<{ id: FilterId; label: string; n: number }> = [
    { id: 'all',  label: 'all',           n: counts.all },
    { id: 'soon', label: BUCKET_LABEL.soon, n: counts.soon },
    { id: 'park', label: BUCKET_LABEL.park, n: counts.park },
    { id: 'sit',  label: BUCKET_LABEL.sit,  n: counts.sit },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={() => router.replace('/practice' as any)}
            style={styles.iconBtn}
            activeOpacity={0.85}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Glyphs.Back size={18} color={C.ink} />
          </TouchableOpacity>
          <Text style={styles.title}>Brain dump</Text>
          <View style={styles.topBarRight}>
            <TouchableOpacity
              onPress={() => setInfoOpen(true)}
              style={styles.iconBtn}
              activeOpacity={0.85}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="What do these categories mean?"
            >
              <Glyphs.Info size={18} color={C.ink2} />
            </TouchableOpacity>
            <SavePracticeButton practiceId="brain-dump" />
          </View>
        </View>

        <FadingScrollWrapper topFadeHeight={20} bottomFadeHeight={64}>
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              /* Reserve room for the pinned "one physical step" card
               * (≈140px tall incl. its own padding) so the last item
               * isn't hidden behind it when there are items. */
              { paddingBottom: (items.length > 0 ? 180 : 80) + insets.bottom },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.kicker}>EVERY TAB IN YOUR HEAD · 3 MIN</Text>
            <Text style={styles.headline}>
              Put it <Text style={styles.headlineItalic}>down</Text>. We{'’'}ll sort it.
            </Text>

            {/* Composer — input + adaptive trailing button.
             *   Empty draft  → Mic glyph (placeholder for future
             *                  voice-to-text; currently a hint).
             *   Has text     → Arrow send glyph; tap submits the
             *                  thought to the list. */}
            <View style={styles.composerCard}>
              <TextInput
                style={styles.composerInput}
                value={draft}
                onChangeText={setDraft}
                placeholder="say or type the next thing…"
                placeholderTextColor={C.ink3}
                /* Multiline so the input grows downward as the user
                 * keeps typing instead of scrolling horizontally on a
                 * single line. `submitBehavior="blurAndSubmit"` keeps
                 * the Return key acting as send. */
                multiline
                textAlignVertical="top"
                scrollEnabled
                blurOnSubmit
                onSubmitEditing={handleAdd}
                returnKeyType="send"
              />
              {draft.trim().length > 0 ? (
                <TouchableOpacity
                  style={styles.composerSend}
                  onPress={handleAdd}
                  activeOpacity={0.85}
                  hitSlop={8}
                  accessibilityLabel="Add this thought"
                >
                  <Glyphs.Arrow size={16} color={C.cream} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.composerMic, listening && styles.composerMicActive]}
                  onPress={handleMicPress}
                  activeOpacity={0.85}
                  hitSlop={8}
                  accessibilityLabel={listening ? 'Stop dictating' : 'Dictate a thought'}
                >
                  <Glyphs.Mic size={14} color={C.cream} />
                </TouchableOpacity>
              )}
            </View>

            {/* Filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {filters.map((f) => {
                const on = filter === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    onPress={() => setFilter(f.id)}
                    activeOpacity={0.85}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {f.label.toUpperCase()} · {f.n}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Items — or soft empty state when nothing's been typed
             * yet. Filter mismatches (e.g., 'urgent' selected but no
             * urgent items) get the same "nothing kept" pattern as the
             * Journal index. */}
            {visible.length > 0 ? (
              <View style={styles.itemList}>
                {visible.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.itemRow}
                    activeOpacity={0.85}
                    onPress={() => setEditingItem(item)}
                    accessibilityLabel={`Reassign category for ${item.text}`}
                  >
                    <View
                      style={[
                        styles.itemDot,
                        { backgroundColor: BUCKET_COLOR[item.bucket] },
                      ]}
                    />
                    <Text style={styles.itemText}>{item.text}</Text>
                    <Text style={styles.itemBucket}>{BUCKET_LABEL[item.bucket]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyKicker}>
                  {items.length === 0 ? 'NOTHING HERE — YET' : 'NOTHING UNDER THIS FILTER'}
                </Text>
                <Text style={styles.emptyTitle}>
                  {items.length === 0 ? (
                    <>Your head is <Text style={styles.emptyTitleItalic}>quiet</Text> here for now.</>
                  ) : (
                    <>No <Text style={styles.emptyTitleItalic}>{BUCKET_LABEL[filter as Bucket]}</Text> thoughts.</>
                  )}
                </Text>
                <Text style={styles.emptyBody}>
                  {items.length === 0
                    ? 'Type whatever’s rattling around — every tab in your head, in any order. We’ll help sort them.'
                    : 'Tap “all” above, or add a thought below.'}
                </Text>
              </View>
            )}

          </ScrollView>
        </FadingScrollWrapper>

        {/* "One physical step" — pinned at the bottom so the items list
         * scrolls above it. Sibling of the scroll wrapper, not a child
         * of the ScrollView, matching the pinned-footer pattern. */}
        {items.length > 0 && (
          <View style={[styles.physicalFooter, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.physicalCard}>
              <View style={styles.physicalKickerRow}>
                <Glyphs.Sparkle size={14} color={C.coral} />
                <Text style={styles.physicalKicker}>ONE PHYSICAL STEP FOR TODAY</Text>
              </View>
              <Text style={styles.physicalText}>
                Open the next thing on your <Text style={styles.physicalTextItalic}>do soon</Text> list. Don{'’'}t finish it. Just open it.
              </Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Per-item category popup — opens on tap, closes on backdrop
       * tap or category pick. Three options shown, current bucket has
       * a coral check on its right; tap any option to reassign. */}
      <Modal
        visible={!!editingItem}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingItem(null)}
      >
        <Pressable style={styles.popupBackdrop} onPress={() => setEditingItem(null)}>
          <Pressable style={styles.popupCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.popupKicker}>SORT THIS THOUGHT</Text>
            <Text style={styles.popupQuote}>
              {editingItem?.text ?? ''}
            </Text>
            <View style={styles.popupDivider} />

            {(['soon', 'park', 'sit'] as ReadonlyArray<Bucket>).map((b, i, arr) => {
              const isCurrent = editingItem?.bucket === b;
              return (
                <React.Fragment key={b}>
                  <TouchableOpacity
                    style={styles.popupRow}
                    onPress={() => editingItem && handleReassign(editingItem.id, b)}
                    activeOpacity={0.85}
                  >
                    <View
                      style={[styles.popupBucketDot, { backgroundColor: BUCKET_COLOR[b] }]}
                    />
                    <Text style={[styles.popupRowLabel, isCurrent && styles.popupRowLabelCurrent]}>
                      {BUCKET_LABEL[b]}
                    </Text>
                    {isCurrent ? (
                      <View style={styles.popupCheck}>
                        <Glyphs.Check size={14} color={C.coral} />
                      </View>
                    ) : (
                      <View style={styles.popupCheckEmpty} />
                    )}
                  </TouchableOpacity>
                  {i < arr.length - 1 && <View style={styles.popupRowDivider} />}
                </React.Fragment>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* "What do these mean?" bottom sheet — explains the three
       * buckets in plain language. Cloned from DeleteChatSheet's
       * animation/layout. */}
      <BrainDumpInfoSheet visible={infoOpen} onClose={() => setInfoOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  flex: { flex: 1 },

  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10, elevation: 10,
  },
  headerRightCluster: {
    width: 36, height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  /* Two-icon cluster (info + heart) on the top bar's right side. */
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 17,
    color: C.ink,
    letterSpacing: -0.1,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  kicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.ink3,
  },
  headline: {
    marginTop: 10,
    fontFamily: 'Fraunces-Medium',
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.3,
    color: C.ink,
  },
  headlineItalic: { fontFamily: 'Fraunces-MediumItalic' },

  /* Composer */
  composerCard: {
    marginTop: 20,
    flexDirection: 'row',
    /* `flex-end` so the trailing send/mic stays pinned to the bottom
     * of the (now multiline, growing) input instead of jumping with
     * the input's vertical centre as it expands. */
    alignItems: 'flex-end',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: C.paper,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  composerInput: {
    flex: 1,
    fontFamily: 'Fraunces-Italic',
    fontSize: 15,
    lineHeight: 22,
    color: C.ink,
    padding: 0,
    /* Match the trailing mic/send button height (38) when empty so
     * the placeholder/cursor sit on the same baseline as the button
     * instead of being pinned to the bottom by `flex-end`. As text
     * grows, multiline lets the input expand downward up to ~6 lines. */
    minHeight: 38,
    maxHeight: 132,
    paddingTop: 8,
    includeFontPadding: false,
  },
  composerMic: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.ink3,
    alignItems: 'center', justifyContent: 'center',
  },
  composerMicActive: {
    backgroundColor: C.coral,
  },
  composerSend: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.ink,
    alignItems: 'center', justifyContent: 'center',
  },

  /* Filter chips */
  chipsRow: {
    paddingTop: 18,
    paddingBottom: 4,
    gap: 6,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line2,
    backgroundColor: C.paper,
  },
  chipOn: {
    backgroundColor: C.ink,
    borderColor: 'transparent',
  },
  chipText: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 11,
    letterSpacing: 1.2,
    color: C.ink2,
  },
  chipTextOn: { color: C.cream },

  /* Items */
  itemList: {
    marginTop: 14,
    gap: 8,
  },
  itemRow: {
    backgroundColor: C.paper,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemDot: {
    width: 10, height: 10, borderRadius: 5,
    flexShrink: 0,
  },
  itemText: {
    flex: 1,
    fontFamily: 'Fraunces-Medium',
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.05,
    color: C.ink,
  },
  itemBucket: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 9,
    letterSpacing: 0.8,
    color: C.ink3,
  },

  /* Physical step ink card */
  /* Reassign popup — same visual family as the rename/delete sheets:
   * paper card, JetBrainsMono kicker, Fraunces quote, ink labels,
   * coral check on the active row. */
  popupBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(26,31,54,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  popupCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: C.paper,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.line,
    paddingVertical: 14,
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  popupKicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 2,
    color: C.ink3,
    textTransform: 'uppercase',
  },
  popupQuote: {
    marginTop: 8,
    fontFamily: 'Fraunces-Medium',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.1,
    color: C.ink,
  },
  popupDivider: {
    marginTop: 14,
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.line,
    marginHorizontal: -4,
  },
  popupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  popupRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.line,
  },
  popupBucketDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  popupRowLabel: {
    flex: 1,
    fontFamily: 'Fraunces-Medium',
    fontSize: 16,
    color: C.ink,
    letterSpacing: -0.1,
    textTransform: 'capitalize',
  },
  popupRowLabelCurrent: {
    color: C.coral,
  },
  popupCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(244,169,136,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  popupCheckEmpty: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1, borderColor: C.line2,
  },

  /* Empty state — matches the Journal index pattern (kicker, soft
   * Fraunces line with italic emphasis, quiet body). */
  emptyWrap: {
    marginTop: 28,
    paddingHorizontal: 4,
  },
  emptyKicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 2,
    color: C.ink3,
  },
  emptyTitle: {
    marginTop: 10,
    fontFamily: 'Fraunces-Medium',
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.3,
    color: C.ink,
  },
  emptyTitleItalic: { fontFamily: 'Fraunces-MediumItalic' },
  emptyBody: {
    marginTop: 10,
    fontFamily: 'Fraunces-Text',
    fontSize: 13.5,
    lineHeight: 20,
    color: C.ink2,
    letterSpacing: 0.1,
  },

  physicalFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: C.cream,
  },
  physicalCard: {
    backgroundColor: C.ink,
    borderRadius: RADIUS.card,
    padding: 18,
  },
  physicalKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  physicalKicker: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 10,
    letterSpacing: 2,
    color: 'rgba(251,245,238,0.6)',
  },
  physicalText: {
    marginTop: 10,
    fontFamily: 'Fraunces-Medium',
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.1,
    color: C.cream,
    includeFontPadding: false,
  },
  physicalTextItalic: { fontFamily: 'Fraunces-MediumItalic' },
});
