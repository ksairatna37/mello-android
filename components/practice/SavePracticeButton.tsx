/**
 * SavePracticeButton — drop-in heart button for any practice screen.
 *
 * Visual:
 *   - 36×36 paper-bg circle button, line border (matches `iconBtn`).
 *   - Heart outline (ink2) when not saved.
 *   - Heart filled coral red when saved.
 *   - Pop animation on toggle.
 *
 * One-time hint:
 *   - First time the user lands on ANY practice screen with this
 *     button visible, a "Liked it? Save it." balloon bobs gently
 *     below the heart with a tail pointing up at it.
 *   - Hint is global (key `practice-save-global`) — learning the
 *     gesture once carries across every practice surface, so users
 *     don't get hinted repeatedly.
 *   - Hint vanishes the moment they tap the heart and never returns.
 *
 * Persistence: server-backed via `practice_liked` + `practice_ui_hints`
 * columns on `profiles`, mediated by `services/practice/practiceProfileSync.ts`.
 * Reads use `useSyncExternalStore` hooks so cross-device updates re-render
 * the heart without waiting for a focus event. NO AsyncStorage; the
 * cache is module-level in-memory state, not local persistence.
 *
 * Usage:
 *   <SavePracticeButton practiceId="grounding" />
 *
 * Place this in the top-right slot where the "spacer" used to be.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { Glyphs, BRAND as C } from '@/components/common/BrandGlyphs';
import {
  setPracticeLiked,
  markSaveHintSeen,
} from '@/services/practice/likedPractices';
import {
  useIsPracticeLiked,
  useHintSeen,
  useCacheSeeded,
} from '@/services/practice/practiceProfileSync';

const HINT_KEY = 'practice-save-global';

interface Props {
  practiceId: string;
  /** Lighter heart-outline tint when sitting on a tone-wash background
   *  (e.g. lavender, peach) where ink2 reads too dark. */
  outlineColor?: string;
}

export default function SavePracticeButton({ practiceId, outlineColor = C.ink2 }: Props) {
  /* Liked state is read directly from the practice cache via
   * useSyncExternalStore — flips synchronously on tap (cache is
   * mutated before the PATCH fires) and stays in sync if a
   * cross-device update reseeds the cache while the screen is open. */
  const liked = useIsPracticeLiked(practiceId);
  const seen = useHintSeen(HINT_KEY);
  /* Don't show the hint until the cache has actually loaded server
   * state at least once. Without this gate, cold mount reads
   * `seen=false` (empty cache) and schedules the hint; cache then
   * seeds with `seen=true` on slow networks AFTER the hint is
   * already visible — flashes once even though the user has dismissed
   * it before. */
  const cacheSeeded = useCacheSeeded();
  const [hintVisible, setHintVisible] = useState(false);

  const heartScale = useSharedValue(1);
  const bob = useSharedValue(0);
  const fade = useSharedValue(0);

  /* Hint appears after a short delay so the screen has time to settle
   * visually, then auto-dismisses after a random 5–8s window — long
   * enough to read, short enough not to linger. Tapping the heart
   * dismisses early and marks seen too. */
  useEffect(() => {
    /* Wait for the cache to have loaded server state at least once.
     * Otherwise we'd schedule the hint based on an empty cache. */
    if (!cacheSeeded) return;
    // Skip the hint entirely if the user has seen it OR already
    // saved this practice — the affordance is moot in either case.
    if (seen || liked) return;
    /* If the hint is already visible, don't re-arm the show timer.
     * Without this guard, a cache reseed mid-display flips `seen`
     * (or `liked`), the effect cleanup runs, then a re-run schedules
     * a fresh showTimer that immediately calls `setHintVisible(true)`
     * again — visible flicker + duplicate `markSaveHintSeen`. */
    if (hintVisible) return;

    let cancelled = false;
    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    // Show after a 600ms delay (lets the screen finish mounting and
    // gives the practice cache a moment to seed from the profile —
    // otherwise a user who has already seen the hint on another
    // device would briefly see it again here on a slow-network mount).
    showTimer = setTimeout(() => {
      if (cancelled) return;
      setHintVisible(true);

      // Auto-dismiss after random 5–8s. Mark seen so it never
      // reappears (the user had their chance to notice).
      const lifetime = 5000 + Math.floor(Math.random() * 3001); // [5000, 8000]
      hideTimer = setTimeout(() => {
        if (cancelled) return;
        setHintVisible(false);
        void markSaveHintSeen(HINT_KEY);
      }, lifetime);
    }, 600);

    return () => {
      cancelled = true;
      if (showTimer) clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [practiceId, seen, liked, hintVisible, cacheSeeded]);

  /* Bob + fade-in the hint when visible. */
  useEffect(() => {
    if (hintVisible) {
      fade.value = withTiming(1, { duration: 280 });
      bob.value = withRepeat(
        withSequence(
          withTiming(4, { duration: 800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      );
    } else {
      fade.value = withTiming(0, { duration: 200 });
    }
  }, [hintVisible, bob, fade]);

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));
  const hintStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: bob.value }],
  }));

  const dismissHint = useCallback(() => {
    if (!hintVisible) return;
    setHintVisible(false);
    void markSaveHintSeen(HINT_KEY);
  }, [hintVisible]);

  const handleTap = useCallback(() => {
    const next = !liked;
    /* `setPracticeLiked` updates the cache synchronously; the hook
     * (useIsPracticeLiked) flips on the next render. No local state
     * to keep in sync. The PATCH fires async via debounce.
     * `setPracticeLiked` returns a Promise<void> for legacy-API
     * compatibility, but the cache mutation is sync — no await
     * needed and no behaviour change without it. */
    heartScale.value = withSequence(
      withSpring(1.3, { damping: 6, stiffness: 240 }),
      withSpring(1,   { damping: 8, stiffness: 200 }),
    );
    dismissHint();
    void setPracticeLiked(practiceId, next);
    console.log('[SavePracticeButton] ' + practiceId + ' = ' + next);
  }, [liked, practiceId, heartScale, dismissHint]);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        onPress={handleTap}
        style={styles.btn}
        activeOpacity={0.85}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel={liked ? 'Saved — tap to unsave' : 'Save this practice'}
      >
        <Animated.View style={heartStyle}>
          {liked
            ? <Glyphs.HeartFilled size={18} color={C.coral} />
            : <Glyphs.Heart size={18} color={outlineColor} />}
        </Animated.View>
      </TouchableOpacity>

      {hintVisible && (
        <Animated.View style={[styles.hintLayer, hintStyle]} pointerEvents="none">
          <View style={styles.hintTail} />
          <View style={styles.hintBubble}>
            <Text style={styles.hintText}>
              Liked it? <Text style={styles.hintBold}>Save it.</Text>
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /* The wrap is the same 36×36 footprint as a regular `iconBtn` so it
   * slots into existing top-bar layouts without nudging anything.
   *
   * zIndex + elevation lift the wrap (and the absolute hint inside it)
   * above any sibling card / scroll content / wash that might draw
   * later. iOS uses zIndex; Android requires elevation to take effect.
   * Both set to a value high enough to win against typical UI layers. */
  wrap: {
    width: 36,
    height: 36,
    position: 'relative',
    zIndex: 50,
    elevation: 50,
  },
  btn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.paper,
    borderWidth: 1, borderColor: C.line,
    alignItems: 'center', justifyContent: 'center',
  },

  /* Hint sits BELOW the button with a tail pointing UP. Anchored
   * top-right so multi-line copy never overflows the screen edge.
   * zIndex/elevation must beat anything below the top bar — cards,
   * scroll content, footer, etc. — so the bubble draws on top. */
  hintLayer: {
    position: 'absolute',
    top: 40, // below 36px button + 4 gap
    right: 0,
    alignItems: 'flex-end',
    width: 180,
    zIndex: 999,
    elevation: 999,
  },
  hintTail: {
    width: 0, height: 0,
    marginRight: 13, // align with button center (36/2 - 6/2 - 1 border)
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: C.ink,
  },
  hintBubble: {
    backgroundColor: C.ink,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginTop: -1, // hide seam between tail and bubble
  },
  hintText: {
    fontFamily: 'Fraunces-Text',
    fontSize: 13,
    color: C.cream,
    letterSpacing: 0.1,
  },
  hintBold: { fontFamily: 'Fraunces-Medium' },
});
