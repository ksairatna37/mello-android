/**
 * SelfMindOrbV2 — port of the website's `OrbV2`
 * (mello-mind-journey/src/components/selfmind/Shared.tsx).
 *
 * Renders the brand orb (assets/orb-v2.png) inside a transparent WebView
 * with the same SVG morph filter and synced scale + rotate animation.
 *
 * react-native-svg can't do feTurbulence / feDisplacementMap, so WebView is
 * the only way to get pixel-identical output (mirrors SelfMindOrb v1).
 *
 * Robustness: if the WebView native module isn't linked or anything throws
 * during mount, we fall back to a plain <Image> of orb-v2.png so the
 * parent layout never collapses.
 *
 * `warmOnly`: render the WebView with NO animation loop (no rAF), used by
 * the app-root warmer to keep the WebView native module + JS context warm
 * without burning CPU/GPU forever on a hidden surface.
 */
import React, { Component, ReactNode, useCallback } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';

const ORB_ASSET = require('../../assets/orb-v2.png');

// Resolve once at module load — same URI for every instance.
const ORB_URI = Image.resolveAssetSource(ORB_ASSET).uri;

type Props = {
  size?: number;
  /** Skip the rAF animation loop. For the app-root warmer only. */
  warmOnly?: boolean;
  /**
   * Fires once the WebView has painted (onLoadEnd). Use this to drive a
   * sibling content fade in the parent screen.
   */
  onReady?: () => void;
  /**
   * Skip the orb's built-in entry fade. Use this when the parent screen
   * owns the fade timing (e.g. welcome wraps the orb inside its own
   * Animated.View so orb + content fade as one on every focus).
   */
  disableInternalFade?: boolean;
};

function buildHtml(orbUri: string, animate: boolean) {
  const tickScript = animate
    ? `
  const turb  = document.getElementById('orbv2-turb');
  const pulse = document.getElementById('orbv2-pulse');

  // Single time source → scale and rotation tick on the same clock.
  // Periods are harmonic: BREATHE_SEC × 15 = ROTATE_SEC.
  const BREATHE_SEC = 6;
  const ROTATE_SEC  = 90;
  const SCALE_AMP   = 0.025;
  const TWO_PI = Math.PI * 2;
  const t0 = performance.now();

  function tick() {
    const t = (performance.now() - t0) / 1000;

    const base  = 0.006 + Math.sin(t * 0.4) * 0.0015;
    const freqX = base + Math.sin(t * 0.7) * 0.002;
    const freqY = base + Math.cos(t * 0.55) * 0.002;
    turb.setAttribute('baseFrequency', freqX.toFixed(5) + ' ' + freqY.toFixed(5));

    const scale = 1 + Math.sin((t / BREATHE_SEC) * TWO_PI) * SCALE_AMP;
    const angle = (t / ROTATE_SEC) * 360;
    pulse.style.transform = 'rotate(' + angle.toFixed(3) + 'deg) scale(' + scale.toFixed(4) + ')';

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);`
    : '';

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; width: 100%; height: 100%; }
  .stage { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
  .pulse   { width: 100%; height: 100%; transform-origin: center; will-change: transform; }
  .orb     { width: 100%; height: 100%; object-fit: contain; filter: url(#orbv2-morph); -webkit-filter: url(#orbv2-morph); display: block; }
</style>
</head><body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <filter id="orbv2-morph">
      <feTurbulence id="orbv2-turb" type="fractalNoise" baseFrequency="0.008 0.008" numOctaves="2" seed="3"/>
      <feDisplacementMap in="SourceGraphic" scale="14"/>
    </filter>
  </defs>
</svg>
<div class="stage">
  <div class="pulse" id="orbv2-pulse">
    <img class="orb" src="${orbUri}" alt="" />
  </div>
</div>
<script>${tickScript}</script>
</body></html>`;
}

// Hoist require + html-build to module load — both are identical for every
// instance, so doing this per-render is wasted work.
let WebViewModule: React.ComponentType<any> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WebViewModule = require('react-native-webview').WebView;
} catch {
  WebViewModule = null;
}

const ANIMATED_SOURCE = { html: buildHtml(ORB_URI, true) };
const WARM_SOURCE     = { html: buildHtml(ORB_URI, false) };

class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(err: unknown) { console.warn('[SelfMindOrbV2] fell back:', err); }
  render() { return this.state.err ? this.props.fallback : this.props.children; }
}

export default function SelfMindOrbV2({
  size = 200,
  warmOnly = false,
  onReady,
  disableInternalFade = false,
}: Props) {
  // Fade the orb in on first paint to hide the WebView mount snap. Only on
  // visible (non-warmer) instances. Starts at 0, animates to 1 once the
  // WebView fires onLoadEnd. No exit fade — this is entry-only.
  // When disableInternalFade is set, the parent owns timing (e.g. welcome
  // re-fades on every focus) so the orb just renders at full opacity.
  const skipFade = warmOnly || disableInternalFade;
  const opacity = useSharedValue(skipFade ? 1 : 0);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const handleLoadEnd = useCallback(() => {
    if (!skipFade) {
      opacity.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    }
    onReady?.();
  }, [opacity, skipFade, onReady]);

  const fallback = (
    <Image
      source={ORB_ASSET}
      style={{ width: size, height: size }}
      resizeMode="contain"
      fadeDuration={0}
    />
  );

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      pointerEvents="none"
      // Don't announce the warmer (or any non-interactive orb) to TalkBack.
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {WebViewModule ? (
        <Boundary fallback={fallback}>
          <Animated.View style={[{ width: size, height: size }, fadeStyle]}>
            <WebViewModule
              source={warmOnly ? WARM_SOURCE : ANIMATED_SOURCE}
              style={[styles.webview, { width: size, height: size }]}
              containerStyle={styles.webviewContainer}
              scrollEnabled={false}
              bounces={false}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              javaScriptEnabled
              domStorageEnabled={false}
              // Image is loaded via file:// (release) or http://localhost (dev)
              // from the inline HTML's about:blank origin, so we still need the
              // file-access flags. Origin whitelist stays narrow because nothing
              // here triggers navigation.
              originWhitelist={['about:blank', 'file://*', 'http://localhost*']}
              allowFileAccess
              allowFileAccessFromFileURLs
              allowUniversalAccessFromFileURLs
              setSupportMultipleWindows={false}
              androidLayerType="hardware"
              opaque={false}
              backgroundColor="transparent"
              overScrollMode="never"
              pointerEvents="none"
              onLoadEnd={handleLoadEnd}
              onError={(e: unknown) => console.warn('[SelfMindOrbV2] webview error:', e)}
            />
          </Animated.View>
        </Boundary>
      ) : (
        fallback
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  webview: { backgroundColor: 'transparent' },
  webviewContainer: { backgroundColor: 'transparent' },
});
