/**
 * VoiceMicButton.tsx  — definitive version with diagnostic logging
 *
 * HOW TO READ LOGS  (filter by tag "[Mello🎙]" in Metro / Logcat / Xcode):
 *
 *   [Mello🎙] ── MIC PRESS ──────────────────────
 *   [Mello🎙] startRecognition() called  isFreshSession=true
 *   [Mello🎙] permissions granted=true
 *   [Mello🎙] listeners removed (prev count: 0)
 *   [Mello🎙] ──── SESSION 1 START ────────────────────
 *   [Mello🎙] ExpoSpeechRecognition.start() called
 *   [Mello🎙] EVENT start  ✓ OS accepted session
 *   [Mello🎙] EVENT speechstart
 *   [Mello🎙] EVENT result  isFinal=false  transcript="hello"   ← interim
 *   [Mello🎙] EVENT result  isFinal=true   transcript="hello"   ← committed
 *   [Mello🎙] ✅ delivered → "hello "
 *   [Mello🎙] EVENT speechend
 *   [Mello🎙] EVENT end  isRecordingRef=true → restarting in 350ms
 *   [Mello🎙] ──── SESSION 1 RESTART ─────────────────
 *   ...
 *   [Mello🎙] ── CONFIRM pressed ──────────────────
 *   [Mello🎙] stopRecognition()  isRecordingRef=true → false
 *   [Mello🎙] EVENT end  isRecordingRef=false → clean shutdown ✓
 *
 * WHAT TO PASTE TO CLAUDE IF STILL BROKEN:
 *   Copy everything from "── MIC PRESS" to the next "── MIC PRESS" or
 *   "── CONFIRM/CANCEL pressed" and paste it — the logs will show exactly
 *   which event is missing or misfiring.
 *
 * COMMON ISSUES:
 *   • "EVENT result  isFinal=false" only, never true  → OS never commits
 *   • "EVENT end" immediately after start             → mic permission issue
 *   • "EVENT error  code=audio-capture"               → mic hardware blocked
 *   • "EVENT error  code=not-allowed"                 → permission denied
 *   • "EVENT error  code=network"                     → cloud STT unreachable
 *   • "⛔ dedup block" every time                     → deliveredRef not clearing
 *   • No events at all after start()                  → module not linked
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  memo,
} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND as C, Glyphs } from '@/components/common/BrandGlyphs';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export { RecordingBar } from './Recordingbar';

// ─────────────────────────────────────────────
// Logger
// ─────────────────────────────────────────────

const TAG  = '[Mello🎙]';
const log  = (...args: any[]) => console.log(TAG,  ...args);
const warn = (...args: any[]) => console.warn(TAG, ...args);

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const ONBOARDING_SEEN_KEY = '@mello/mic_onboarding_seen';
const RESTART_DELAY_MS    = 350;

// ─────────────────────────────────────────────
// Onboarding modal
// ─────────────────────────────────────────────

interface OnboardingModalProps {
  visible: boolean;
  onContinue: () => void;
  onClose: () => void;
}

function OnboardingModal({ visible, onContinue, onClose }: OnboardingModalProps) {
  const insets = useSafeAreaInsets();
  const [isVisible, setIsVisible] = React.useState(false);

  const translateY      = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  const hideModal = useCallback(() => {
    setIsVisible(false);
    onClose();
  }, [onClose]);

  // No spring physics — page-design.md § 9 forbids bounce/spring; tone is calm.
  // Entrance: 380ms ease-out; exit: 280ms ease-in.
  const ENTER_EASING = Easing.out(Easing.cubic);
  const EXIT_EASING  = Easing.in(Easing.cubic);

  useEffect(() => {
    if (visible) {
      setIsVisible(true);
      backdropOpacity.value = withTiming(1, { duration: 280, easing: ENTER_EASING });
      translateY.value      = withTiming(0, { duration: 380, easing: ENTER_EASING });
    } else if (isVisible) {
      backdropOpacity.value = withTiming(0, { duration: 240, easing: EXIT_EASING });
      translateY.value      = withTiming(SCREEN_HEIGHT, { duration: 280, easing: EXIT_EASING }, (finished) => {
        if (finished) runOnJS(hideModal)();
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle    = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleClose = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 240, easing: EXIT_EASING });
    translateY.value      = withTiming(SCREEN_HEIGHT, { duration: 280, easing: EXIT_EASING }, (finished) => {
      if (finished) runOnJS(hideModal)();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideModal]);

  if (!isVisible) return null;

  return (
    <Modal transparent visible={isVisible} animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <View style={styles.modalContainer}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
            { paddingBottom: Math.max(insets.bottom, 16) + 16 },
          ]}
        >
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Close button */}
          <Pressable style={styles.modalClose} onPress={handleClose} hitSlop={10}>
            <Glyphs.Close size={18} color={C.ink2} />
          </Pressable>

          {/* Coral mic disc — soft, contemplative; no WebView orb to avoid mount delay */}
          <View style={styles.iconWrap}>
            <View style={styles.iconRing}>
              <View style={styles.iconCircle}>
                <Glyphs.Mic size={32} color={C.cream} />
              </View>
            </View>
          </View>

          {/* Kicker */}
          <Text style={styles.kicker}>— a quieter way</Text>

          {/* Title */}
          <Text style={styles.title}>
            Speak to <Text style={styles.titleItalic}>mello</Text>,{'\n'}
            instead of <Text style={styles.titleItalic}>typing</Text>.
          </Text>

          {/* Feature list — small colored dots, brand-toned */}
          <View style={styles.featureList}>
            <FeatureRow swatch={C.sage}     glyph={<Glyphs.Wave size={14} color={C.ink} />}     text="Speak in any language" />
            <FeatureRow swatch={C.peach}    glyph={<Glyphs.Moon size={14} color={C.ink} />}     text="Take as long as you need" />
            <FeatureRow swatch={C.lavender} glyph={<Glyphs.Sparkle size={14} color={C.ink} />}  text="Talk naturally, not in scripts" />
          </View>

          {/* Language row — lavender chip-card */}
          <View style={styles.languageCard}>
            <Text style={styles.languageLabel}>SPEECH INPUT LANGUAGE</Text>
            <Text style={styles.languageValue}>English</Text>
          </View>

          {/* Pinned CTA — ink pill */}
          <Pressable style={styles.cta} onPress={onContinue}>
            <Text style={styles.ctaText}>Begin, gently</Text>
            <Glyphs.Arrow size={13} color={C.cream} />
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

function FeatureRow({
  swatch,
  glyph,
  text,
}: {
  swatch: string;
  glyph: React.ReactNode;
  text: string;
}) {
  return (
    <View style={styles.featureRow}>
      <View style={[styles.featureSwatch, { backgroundColor: swatch }]}>
        {glyph}
      </View>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────
// useVoiceMic — all bugs fixed + full logging
// ─────────────────────────────────────────────

export function useVoiceMic(onTranscript: (text: string) => void) {
  const [isRecording,    setIsRecording]    = useState(false);
  const [isSpeaking,     setIsSpeaking]     = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [elapsed,        setElapsed]        = useState(0);

  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const listenerRefs    = useRef<any[]>([]);

  // isRecordingRef mirrors state — readable inside async callbacks
  // without stale closures. This is the root fix for "won't start again".
  const isRecordingRef  = useRef(false);

  // Dedup set keyed on normalised lowercase transcript
  // Cleared only at fresh session start, NOT on auto-restart
  const deliveredRef    = useRef(new Set<string>());
  const latestInterimRef = useRef('');

  // Stable ref so the result listener never captures a stale onTranscript
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);

  const sessionRef      = useRef(0);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const removeListeners = useCallback(() => {
    const count = listenerRefs.current.length;
    listenerRefs.current.forEach((sub) => {
      try { sub.remove(); } catch {}
    });
    listenerRefs.current = [];
    log(`listeners removed (prev count: ${count})`);
  }, []);

  const extractTranscript = useCallback((segment: any) => {
    let best = '';
    if (Array.isArray(segment)) {
      // Shape A: array of alternatives
      best = segment[0]?.transcript ?? segment[0]?.text ?? '';
    } else if (typeof segment === 'string') {
      // Shape B: plain string
      best = segment;
    } else if (segment && typeof segment === 'object') {
      // Shape C: object with transcript / text / nested alternatives
      best =
        segment.transcript ??
        segment.text ??
        segment?.[0]?.transcript ??
        segment?.alternatives?.[0]?.transcript ??
        '';
    }

    return String(best).trim();
  }, []);

  const deliverTranscript = useCallback((text: string, reason: 'final' | 'confirm' | 'error') => {
    const best = text.trim();
    if (!best) return false;

    const key = best.toLowerCase().replace(/\s+/g, ' ');
    if (deliveredRef.current.has(key)) {
      log(`⛔ dedup block (${reason})  key="${key}"`);
      return false;
    }

    deliveredRef.current.add(key);
    const combined = `${best} `;
    log(`✅ delivered (${reason}) → "${combined}"`);
    onTranscriptRef.current(combined);
    return true;
  }, []);

  const flushLatestInterim = useCallback((reason: 'confirm' | 'error') => {
    const latestInterim = latestInterimRef.current.trim();
    if (!latestInterim) {
      log(`no interim transcript to flush (${reason})`);
      return false;
    }

    const delivered = deliverTranscript(latestInterim, reason);
    if (delivered) latestInterimRef.current = '';
    return delivered;
  }, [deliverTranscript]);

  // ── stopRecognition ───────────────────────────────────────────────────────

  const stopRecognition = useCallback(() => {
    log(`stopRecognition()  isRecordingRef=${isRecordingRef.current} → false`);

    // Set false BEFORE calling .stop() so the 'end' event sees it and does
    // NOT trigger a restart
    isRecordingRef.current = false;
    clearRestartTimer();

    try {
      const { ExpoSpeechRecognitionModule } = require('expo-speech-recognition');
      ExpoSpeechRecognitionModule.stop();
    } catch (e) {
      warn('stop() threw:', e);
    }

    removeListeners();
    clearTimer();
    setElapsed(0);
    setIsRecording(false);
    setIsSpeaking(false);
  }, [clearTimer, clearRestartTimer, removeListeners]);

  // ── startRecognition ──────────────────────────────────────────────────────
  // isFreshSession=true  → new user press: clear dedup set, start timer
  // isFreshSession=false → auto-restart after 'end': keep timer, keep dedup

  const startRecognition = useCallback(async (isFreshSession = false) => {
    log(`startRecognition()  isFreshSession=${isFreshSession}  isRecordingRef=${isRecordingRef.current}`);

    try {
      const { ExpoSpeechRecognitionModule } = require('expo-speech-recognition');

      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      log(`permissions granted=${granted}`);
      if (!granted) {
        warn('mic permission denied — aborting');
        return;
      }

      // Remove any stale listeners FIRST — the #2 source of transcription bugs
      // (duplicate listeners fire duplicate results, some cancelled by dedup)
      removeListeners();

      if (isFreshSession) {
        sessionRef.current += 1;
        deliveredRef.current.clear();
        latestInterimRef.current = '';
        log(`──── SESSION ${sessionRef.current} START ────────────────────`);
      } else {
        log(`──── SESSION ${sessionRef.current} RESTART ─────────────────`);
      }

      // ── result listener ────────────────────────────────────────────────
      const resultSub = ExpoSpeechRecognitionModule.addListener(
        'result',
        (event: any) => {
          const isFinal    = !!event?.isFinal;
          const rawResults = Array.isArray(event?.results) ? event.results : [];

          // Full event dump so you can see exactly what the OS sends
          log(
            `EVENT result  isFinal=${isFinal}  segmentCount=${rawResults.length}` +
            `  rawEvent=${JSON.stringify(event).slice(0, 400)}`,
          );

          const extractedResults = rawResults
            .map((segment: any) => extractTranscript(segment));

          // Keep the best latest partial result so confirm can send it if
          // the OS has not emitted a final result yet.
          if (!isFinal) {
            const interim = extractedResults.filter(Boolean).join(' ').trim();
            if (interim) {
              latestInterimRef.current = interim;
              log(`  latest interim="${interim}"`);
            }
            return;
          }

          const toDeliver: string[] = [];

          for (let si = 0; si < rawResults.length; si++) {
            const best = extractedResults[si] ?? '';
            log(`  segment[${si}]  extracted="${best}"`);

            if (!best) {
              log(`  segment[${si}]  ⚠️  empty — skipped`);
              continue;
            }

            const key = best.toLowerCase().replace(/\s+/g, ' ');
            if (deliveredRef.current.has(key)) {
              log(`  segment[${si}]  ⛔ dedup block  key="${key}"`);
              continue;
            }

            deliveredRef.current.add(key);
            toDeliver.push(best);
          }

          if (toDeliver.length === 0) {
            log('  nothing new to deliver after dedup');
            return;
          }

          const combined = toDeliver.join(' ') + ' ';
          latestInterimRef.current = '';
          log(`✅ delivered → "${combined}"`);
          onTranscriptRef.current(combined);
        },
      );

      // ── start event ────────────────────────────────────────────────────
      const startEventSub = ExpoSpeechRecognitionModule.addListener('start', () => {
        log('EVENT start  ✓ OS accepted the session');
      });

      // ── speechstart / speechend ────────────────────────────────────────
      const speechStartSub = ExpoSpeechRecognitionModule.addListener('speechstart', () => {
        log('EVENT speechstart');
        setIsSpeaking(true);
      });

      const speechEndSub = ExpoSpeechRecognitionModule.addListener('speechend', () => {
        log('EVENT speechend');
        setIsSpeaking(false);
      });

      // ── end ────────────────────────────────────────────────────────────
      // THE MAIN FIX: 'end' fires after every utterance segment in continuous
      // mode. If isRecordingRef is still true → restart. If false → shut down.
      const endSub = ExpoSpeechRecognitionModule.addListener('end', () => {
        log(`EVENT end  isRecordingRef=${isRecordingRef.current}`);

        if (!isRecordingRef.current) {
          log('EVENT end  → clean shutdown ✓');
          removeListeners();
          clearTimer();
          setElapsed(0);
          setIsRecording(false);
          setIsSpeaking(false);
          return;
        }

        log(`EVENT end  → scheduling restart in ${RESTART_DELAY_MS}ms`);
        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => {
          if (isRecordingRef.current) {
            startRecognition(false); // auto-restart, not a fresh session
          }
        }, RESTART_DELAY_MS);
      });

      // ── error ──────────────────────────────────────────────────────────
      const errorSub = ExpoSpeechRecognitionModule.addListener('error', (err: any) => {
        const code    = err?.error ?? err?.code ?? 'unknown';
        const message = err?.message ?? '';
        log(`EVENT error  code="${code}"  message="${message}"  full=${JSON.stringify(err)}`);

        if (code === 'no-speech' && isRecordingRef.current) {
          log('EVENT error  no-speech (benign silence timeout) → restarting');
          clearRestartTimer();
          restartTimerRef.current = setTimeout(() => {
            if (isRecordingRef.current) startRecognition(false);
          }, RESTART_DELAY_MS);
          return;
        }

        if (code === 'aborted') {
          log('EVENT error  aborted by us — ignoring');
          return;
        }

        warn(`EVENT error  FATAL code="${code}" → stopping`);
        flushLatestInterim('error');
        stopRecognition();
      });

      listenerRefs.current = [
        resultSub,
        startEventSub,
        speechStartSub,
        speechEndSub,
        endSub,
        errorSub,
      ];

      log('ExpoSpeechRecognition.start() called');
      ExpoSpeechRecognitionModule.start({
        lang:                        'en-US',
        interimResults:              true,  // keeps OS session alive between pauses
        maxAlternatives:             1,
        continuous:                  true,
        requiresOnDeviceRecognition: false,
      });

      if (isFreshSession) {
        isRecordingRef.current = true;
        setIsRecording(true);
        setElapsed(0);
        timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
        log('timer started');
      }
    } catch (e: any) {
      warn('startRecognition() threw:', e?.message ?? e);
      isRecordingRef.current = false;
      setIsRecording(false);
      clearTimer();
    }
  // startRecognition references itself recursively for restarts — safe because
  // useCallback identity is stable; deps listed explicitly to satisfy lint
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removeListeners, clearTimer, clearRestartTimer, extractTranscript, flushLatestInterim, stopRecognition]);

  // ── Public API ────────────────────────────────────────────────────────────

  const handleMicPress = useCallback(async () => {
    log('── MIC PRESS ──────────────────────────────────');
    if (isRecordingRef.current) {
      log('isRecording=true → stopping');
      stopRecognition();
      return;
    }
    const seen = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
    if (!seen) {
      log('showing onboarding modal');
      setShowOnboarding(true);
    } else {
      startRecognition(true);
    }
  }, [startRecognition, stopRecognition]);

  const handleOnboardingContinue = useCallback(async () => {
    log('onboarding continue');
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
    setShowOnboarding(false);
    startRecognition(true);
  }, [startRecognition]);

  const handleOnboardingClose = useCallback(() => {
    log('onboarding closed');
    setShowOnboarding(false);
  }, []);

  const handleCancel = useCallback(() => {
    log('── CANCEL pressed ─────────────────────────────');
    stopRecognition();
  }, [stopRecognition]);

  const handleConfirm = useCallback(() => {
    log('── CONFIRM pressed ────────────────────────────');
    flushLatestInterim('confirm');
    stopRecognition();
  }, [flushLatestInterim, stopRecognition]);

  useEffect(() => () => {
    log('hook unmounting → stopRecognition');
    stopRecognition();
  }, [stopRecognition]);

  return {
    isRecording,
    isSpeaking,
    elapsed,
    showOnboarding,
    handleMicPress,
    handleOnboardingContinue,
    handleOnboardingClose,
    handleCancel,
    handleConfirm,
  };
}

// ─────────────────────────────────────────────
// MicButton
// ─────────────────────────────────────────────

export const MicButton = memo(function MicButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.micBtn} onPress={onPress} hitSlop={8}>
      <Glyphs.Mic size={26} color={C.ink} />
    </Pressable>
  );
});

export { OnboardingModal };

// ─────────────────────────────────────────────
// Styles (identical to original)
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  micBtn: {
    width: 48,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Bottom sheet (SelfMind tokens) ────────────────────────────────────
  modalContainer: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,31,54,0.42)', // C.ink @ 42%
    zIndex: 998,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: C.cream,
    paddingHorizontal: 24,
    // Subtle ink shadow — page-design § 4 cards-and-sheets
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 18,
  },

  handleBar: {
    width: 44,
    height: 4,
    backgroundColor: C.line,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
  },

  modalClose: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Coral mic disc — quiet brand persona stand-in.
  iconWrap: {
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 18,
  },
  iconRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: C.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Kicker — em-dash + space prefix per page-design § 4.
  kicker: {
    fontFamily: 'JetBrainsMono',
    fontSize: 11,
    letterSpacing: 2.2,
    color: C.ink3,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Title — Fraunces, lineHeight = fontSize+8 per android-text-cropping rule.
  title: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.2,
    color: C.ink,
    textAlign: 'center',
    marginBottom: 24,
  },
  titleItalic: { fontFamily: 'Fraunces-MediumItalic' },

  // ── Feature rows ──────────────────────────────────────────────────────
  featureList: {
    gap: 12,
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureSwatch: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureText: {
    flex: 1,
    fontFamily: 'Fraunces-Text',
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0.15,
    color: C.ink,
  },

  // ── Language card ─────────────────────────────────────────────────────
  languageCard: {
    backgroundColor: C.lavender,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  languageLabel: {
    fontFamily: 'JetBrainsMono-Medium',
    fontSize: 9,
    letterSpacing: 1.6,
    color: C.lavenderDeep,
    marginBottom: 4,
  },
  languageValue: {
    fontFamily: 'Fraunces-Medium',
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.05,
    color: C.ink,
  },

  // ── CTA — pinned ink pill ─────────────────────────────────────────────
  cta: {
    backgroundColor: C.ink,
    borderRadius: 999,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ctaText: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    color: C.cream,
    letterSpacing: 0.2,
  },
});
