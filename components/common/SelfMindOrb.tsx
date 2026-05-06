/**
 * SelfMindOrb — exact 1:1 clone of the web orb.
 *
 * Renders the same SVG markup (feTurbulence + feDisplacementMap goo) inside
 * a transparent WebView. react-native-svg doesn't support those filter
 * primitives, so WebView is the only way to get pixel-identical output.
 *
 * Robustness: if the WebView native module isn't linked (e.g. after adding
 * the dep before a native rebuild) or anything else throws during mount,
 * we show a soft cream placeholder so the parent layout never collapses.
 */
import React, { Component, ReactNode, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

type Props = {
  size?: number;
  seed?: number;
};

function buildHtml(seed: number) {
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; width: 100%; height: 100%; }
  svg { display: block; width: 100%; height: 100%; }
</style>
</head><body>
<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="gp" cx="30%" cy="30%" r="70%">
      <stop offset="0%"   stop-color="#FFD4B8"/>
      <stop offset="40%"  stop-color="#FFB799"/>
      <stop offset="80%"  stop-color="#FF8A6B" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#FF8A6B" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="gl" cx="70%" cy="70%" r="60%">
      <stop offset="0%"   stop-color="#D8C6EC"/>
      <stop offset="60%"  stop-color="#9B85C1" stop-opacity="0.7"/>
      <stop offset="100%" stop-color="#9B85C1" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="gb" cx="80%" cy="30%" r="50%">
      <stop offset="0%"   stop-color="#F5D98A" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#F5D98A" stop-opacity="0"/>
    </radialGradient>
    <filter id="goo">
      <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="${seed}"/>
      <feDisplacementMap in="SourceGraphic" scale="18"/>
    </filter>
  </defs>
  <g id="grp" filter="url(#goo)">
    <circle id="c1" cx="200" cy="200" r="165" fill="url(#gp)"/>
    <circle id="c2" cx="240" cy="230" r="110" fill="url(#gl)" opacity="0.9"/>
    <circle id="c3" cx="170" cy="150" r="75"  fill="url(#gb)" opacity="0.85"/>
  </g>
</svg>
<script>
  const SEED = ${seed};
  const c1 = document.getElementById('c1');
  const c2 = document.getElementById('c2');
  const c3 = document.getElementById('c3');
  const t0 = performance.now();
  // Faster, more visible breathing than the web (0.6 × 6).
  const w = (phase, i) => Math.sin(phase * 0.9 + i + SEED) * 8;
  function tick() {
    const p = (performance.now() - t0) / 1000;
    c1.setAttribute('cx', 200 + w(p, 0));
    c1.setAttribute('cy', 200 + w(p, 1));
    c2.setAttribute('cx', 240 + w(p, 2));
    c2.setAttribute('cy', 230 + w(p, 3));
    c3.setAttribute('cx', 170 + w(p, 4));
    c3.setAttribute('cy', 150 + w(p, 5));
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
</script>
</body></html>`;
}

// Lazy-require so a missing native module doesn't crash module evaluation.
function tryRequireWebView() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-webview').WebView as React.ComponentType<any>;
  } catch {
    return null;
  }
}

class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(err: unknown) { console.warn('[SelfMindOrb] fell back:', err); }
  render() { return this.state.err ? this.props.fallback : this.props.children; }
}

export default function SelfMindOrb({ size = 200, seed = 3 }: Props) {
  const html = useMemo(() => buildHtml(seed), [seed]);
  const WebView = tryRequireWebView();

  const placeholder = (
    <View
      style={{
        width: size * 0.82,
        height: size * 0.82,
        borderRadius: (size * 0.82) / 2,
        backgroundColor: '#FFD4B8',
        opacity: 0.85,
      }}
    />
  );

  return (
    <View style={[styles.wrap, { width: size, height: size }]} pointerEvents="none">
      {WebView ? (
        <Boundary fallback={placeholder}>
          <WebView
            source={{ html }}
            style={[styles.webview, { width: size, height: size }]}
            containerStyle={styles.webviewContainer}
            scrollEnabled={false}
            bounces={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            javaScriptEnabled
            domStorageEnabled={false}
            originWhitelist={['*']}
            setSupportMultipleWindows={false}
            androidLayerType="hardware"
            // Android transparency — needs all three
            opaque={false}
            backgroundColor="transparent"
            overScrollMode="never"
            pointerEvents="none"
            onError={(e: unknown) => console.warn('[SelfMindOrb] webview error:', e)}
          />
        </Boundary>
      ) : (
        placeholder
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
