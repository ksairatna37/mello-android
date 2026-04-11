/**
 * Recordingbar.tsx — Claude-style waveform animation
 *
 * Changes from previous version:
 *   - Color: #CC6347 (terracotta) → #b9a6ff (accent lavender)
 *   - Timer font: monospace → Outfit-Regular (matches app font)
 *   - Confirm icon stroke color updated to match new pill color
 *
 * 3 smoothness techniques:
 *   1. Asymmetric lerp   — fast attack (0.4), slow release (0.12)
 *   2. Per-bar phase     — unique sine offsets so bars never move in lockstep
 *   3. requestAnimationFrame at 60fps via useEffect + cancelAnimationFrame
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { Audio } from 'expo-av';
import Ionicons from '@expo/vector-icons/Ionicons';

// ─────────────────────────────────────────────
// Theme
// ─────────────────────────────────────────────

const PILL_COLOR        = '#b9a6ff';
const BTN_CANCEL_BG     = 'rgba(0,0,0,0.18)';
const BTN_CONFIRM_BG    = '#ffffff';
const CONFIRM_ICON_COLOR = PILL_COLOR;
const BAR_COLOR         = 'rgba(255,255,255,0.90)';
const TIMER_COLOR       = 'rgba(255,255,255,0.92)';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const NUM_BARS     = 9;
const MAX_BAR_H    = 36;
const MIN_BAR_H    = 4;
const BAR_WIDTH    = 4;
const BAR_GAP      = 5;
const ATTACK_RATE  = 0.40;
const RELEASE_RATE = 0.12;

const BAR_PHASES = Array.from(
  { length: NUM_BARS },
  (_, i) => (i / NUM_BARS) * Math.PI * 2,
);

// ─────────────────────────────────────────────
// dB → 0–1 amplitude
// ─────────────────────────────────────────────

function dbToAmp(db: number | null | undefined): number {
  if (db == null || db <= -160) return 0.02;
  return Math.max(0, Math.min(1, (db + 60) / 60));
}

// ─────────────────────────────────────────────
// Single animated bar
// ─────────────────────────────────────────────

interface BarProps {
  heightValue: SharedValue<number>;
}

const WaveBar = React.memo(function WaveBar({ heightValue }: BarProps) {
  const animStyle = useAnimatedStyle(() => ({
    height: heightValue.value,
  }));
  return <Animated.View style={[styles.bar, animStyle]} />;
});

// Hook: exactly NUM_BARS shared values, always called in the same order
function useBarHeights(): SharedValue<number>[] {
  return [
    useSharedValue(MIN_BAR_H),
    useSharedValue(MIN_BAR_H),
    useSharedValue(MIN_BAR_H),
    useSharedValue(MIN_BAR_H),
    useSharedValue(MIN_BAR_H),
    useSharedValue(MIN_BAR_H),
    useSharedValue(MIN_BAR_H),
    useSharedValue(MIN_BAR_H),
    useSharedValue(MIN_BAR_H),
  ];
}

// ─────────────────────────────────────────────
// Waveform — owns the rAF loop
// ─────────────────────────────────────────────

function Waveform({ liveAmp }: { liveAmp: React.MutableRefObject<number> }) {
  const barHeights = useBarHeights();
  const smooth = useRef<number[]>(new Array(NUM_BARS).fill(0.1)).current;

  useEffect(() => {
    let rafId: number;
    let frameIndex = 0;

    function tick() {
      frameIndex++;
      const t = frameIndex * 0.045;
      const micAmp = liveAmp.current;

      // Multi-frequency speech envelope (Technique 2 — shared layer)
      const speechEnvelope =
        micAmp * 0.7 +
        0.18 * Math.sin(t * 1.8) * micAmp +
        0.10 * Math.sin(t * 4.1) * micAmp;

      for (let i = 0; i < NUM_BARS; i++) {
        const ph = BAR_PHASES[i];

        // Technique 2 — per-bar phase offsets
        const breathe = 0.15 * Math.sin(t * 0.4  + ph)        * micAmp;
        const flutter = 0.10 * Math.sin(t * 3.2  + ph * 1.6)  * micAmp;
        const micro   = 0.06 * Math.sin(t * 7.0  + ph * 2.3)  * micAmp;

        const target = Math.max(0.04, Math.min(1,
          speechEnvelope + breathe + flutter + micro,
        ));

        // Technique 1 — asymmetric lerp
        const rate = target > smooth[i] ? ATTACK_RATE : RELEASE_RATE;
        smooth[i] += (target - smooth[i]) * rate;

        barHeights[i].value = Math.max(MIN_BAR_H, Math.round(smooth[i] * MAX_BAR_H));
      }

      // Technique 3 — rAF at 60fps
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <View style={styles.waveform}>
      {barHeights.map((hv, i) => (
        <WaveBar key={i} heightValue={hv} />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────
// RecordingBar — public component
// ─────────────────────────────────────────────

export interface RecordingBarProps {
  elapsed: number;
  isSpeaking: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function RecordingBar({ elapsed, onCancel, onConfirm }: RecordingBarProps) {
  const liveAmp     = useRef<number>(0.05);
  const recordingRef = useRef<Audio.Recording | null>(null);

  // ── Mic metering ──────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function startMic() {
      try {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording } = await Audio.Recording.createAsync(
          {
            ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
            isMeteringEnabled: true,
          },
          (status) => {
            if (mounted && status.metering != null) {
              liveAmp.current = dbToAmp(status.metering);
            }
          },
          80,
        );

        if (mounted) recordingRef.current = recording;
      } catch (e) {
        // No mic / permission denied — bars idle at low amplitude
        console.warn('[RecordingBar] mic unavailable:', e);
      }
    }

    startMic();
    return () => {
      mounted = false;
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  // ── Timer ─────────────────────────────────────────────────────────────────
  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const secs = String(elapsed % 60).padStart(2, '0');

  // ── Button spring animations ──────────────────────────────────────────────
  const cancelScale  = useSharedValue(1);
  const confirmScale = useSharedValue(1);

  const tapScale = (sv: SharedValue<number>) => {
    sv.value = withTiming(0.88, { duration: 80, easing: Easing.out(Easing.quad) }, () => {
      sv.value = withSpring(1, { damping: 12, stiffness: 200 });
    });
  };

  const cancelStyle  = useAnimatedStyle(() => ({ transform: [{ scale: cancelScale.value  }] }));
  const confirmStyle = useAnimatedStyle(() => ({ transform: [{ scale: confirmScale.value }] }));

  const handleCancel = useCallback(() => {
    tapScale(cancelScale);
    setTimeout(onCancel, 120);
  }, [onCancel]);

  const handleConfirm = useCallback(() => {
    tapScale(confirmScale);
    setTimeout(onConfirm, 120);
  }, [onConfirm]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Cancel */}
      <Animated.View style={cancelStyle}>
        <Pressable style={styles.btnCancel} onPress={handleCancel} hitSlop={10}>
          <Ionicons name="close" size={20} color="#fff" />
        </Pressable>
      </Animated.View>

      {/* Waveform */}
      <Waveform liveAmp={liveAmp} />

      {/* Timer — Outfit font, matching app typography */}
      <Text style={styles.timer}>{mins}:{secs}</Text>

      {/* Confirm */}
      <Animated.View style={confirmStyle}>
        <Pressable style={styles.btnConfirm} onPress={handleConfirm} hitSlop={10}>
          <Ionicons name="checkmark" size={20} color={CONFIRM_ICON_COLOR} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: PILL_COLOR,
    borderRadius: 28,
    paddingHorizontal: 14,
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: BAR_GAP,
    height: MAX_BAR_H + 4,
    overflow: 'hidden',
  },

  bar: {
    width: BAR_WIDTH,
    backgroundColor: BAR_COLOR,
    borderRadius: BAR_WIDTH / 2,
  },

  // Outfit-Regular instead of monospace — matches app typography system
  timer: {
    fontFamily: 'Outfit-Regular',
    fontSize: 13,
    color: TIMER_COLOR,
    minWidth: 38,
    textAlign: 'right',
  },

  btnCancel: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BTN_CANCEL_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnConfirm: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BTN_CONFIRM_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
