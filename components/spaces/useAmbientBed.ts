/**
 * useAmbientBed — ambient-loop playback for a Sound Spaces session.
 *
 * Uses the **two-player ping-pong** crossfade pattern (per audio
 * research, 2026-05-04): two `AudioPlayer` instances with the same
 * source. The "active" one plays; we poll its `currentTime`, and
 * CROSSFADE_MS before the end we start the standby from 0 with a
 * symmetric volume ramp — active fades 1→0, standby fades 0→1. When
 * the ramp completes, roles swap. The boundary is inaudible —
 * sidesteps the documented iOS click on `loop: true` (expo#18446).
 *
 * Other behavior:
 *  - Audio session configured ONCE per process (`sessionConfigured`)
 *    so other surfaces (voice agent, chat recording) aren't reset on
 *    every Sitting-screen mount.
 *  - Soft 600 ms fade on play / pause taps so the transport doesn't
 *    pop on softer beds.
 *  - `source === null` is a graceful no-op — visual session still
 *    works while bed URLs are being curated.
 *  - Audio keeps playing across tab blur (the timer pauses on blur,
 *    the audio does NOT — see SelfMindSoundSpaceSitting.tsx).
 *  - On Android, lock-screen background-playback requires a
 *    foreground service (not yet wired); see TODO at end of file.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
  setIsAudioActiveAsync,
  type AudioPlayer,
} from 'expo-audio';

/* ─── Audio session (process singleton) ───────────────────────────── */

/* Re-apply the contemplative audio session on every Sound Space
 * mount, not once per process. Two reasons:
 *  (1) The voice agent (`components/voice/VoiceAgentScreen.tsx`) calls
 *      expo-av's `setAudioModeAsync` with different settings — they
 *      share the same underlying iOS `AVAudioSession` / Android
 *      `AudioManager`, so its config silently overwrites ours. Without
 *      re-applying, the bed loses background-playback + lock-screen
 *      ownership for the rest of the process lifetime.
 *  (2) A flipped-too-early `sessionConfigured` latch on first failure
 *      would lock every subsequent space into silence with no recovery.
 *
 * Cost: a few ms of native bridging on each mount. Negligible. */
async function applyContemplativeSession(): Promise<void> {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,           // keep going under iOS silent switch
      allowsRecording: false,
      shouldPlayInBackground: true,      // iOS background + Android lock-screen
      // 'doNotMix' is REQUIRED for Android lock-screen MediaSession
      // binding. With 'duckOthers' the OS won't surface our session
      // and Android terminates playback at the ~3-min background cap.
      // Side-effect: tapping the voice agent pauses the bed (rather
      // than ducking under it) — same behavior as Tide / Calm and
      // what the design wants for a contemplative surface anyway.
      interruptionMode: 'doNotMix',
      shouldRouteThroughEarpiece: false,
    });
    await setIsAudioActiveAsync(true);
  } catch (err) {
    // Don't crash the screen on session failure — the visual bed still
    // looks fine; the user just won't hear anything. Log so we notice.
    console.warn('[useAmbientBed] audio session config failed', err);
  }
}

/* ─── Tunables ────────────────────────────────────────────────────── */

const FADE_IN_MS    = 600;   // taps play
const FADE_OUT_MS   = 600;   // taps pause
const CROSSFADE_MS  = 4000;  // loop boundary
const POLL_MS       = 200;   // currentTime polling cadence
const FADE_STEP_MS  = 50;    // 20 Hz volume updates — perceptually smooth

/* ─── Hook ────────────────────────────────────────────────────────── */

interface InternalState {
  active: 'A' | 'B';
  crossfading: boolean;
  pollId: ReturnType<typeof setInterval> | null;
  fadeIds: ReturnType<typeof setInterval>[];
}

export interface AmbientBedMeta {
  /** Track title shown on the iOS / Android lock screen. */
  title: string;
  /** Subtitle shown on the lock screen. Defaults to "SelfMind Spaces". */
  artist?: string;
  /** Optional album-art URL. Skipping is fine — the OS shows a default. */
  artwork?: string;
}

export interface AmbientBedHandle {
  /** Active audio file's total duration in seconds. 0 until loaded. */
  durationSec: number;
  /** Active audio file's current playback position in seconds. */
  positionSec: number;
  /** True once the active player has finished loading the source. */
  isLoaded: boolean;
  /** Seek the active audio to an absolute position in seconds. */
  seek: (seconds: number) => void;
}

export function useAmbientBed(
  source: string | null,
  playing: boolean,
  meta?: AmbientBedMeta,
): AmbientBedHandle {
  const playerA = useAudioPlayer(source);
  const playerB = useAudioPlayer(source);

  /* Both player statuses are polled (the hooks must be called every
   * render in stable order). The consumer-visible `status` is whichever
   * player is currently active — switched in state so a swap during
   * crossfade triggers a re-render of the timeline UI. */
  const statusA = useAudioPlayerStatus(playerA);
  const statusB = useAudioPlayerStatus(playerB);
  const [activeKey, setActiveKey] = useState<'A' | 'B'>('A');
  const status = activeKey === 'A' ? statusA : statusB;

  // All transport state lives in one ref so the effect can read/write
  // without re-binding. React tree only re-renders when consumers
  // change state (e.g. `playing` prop) — the engine is invisible.
  const stateRef = useRef<InternalState>({
    active: 'A',
    crossfading: false,
    pollId: null,
    fadeIds: [],
  });

  // Re-apply the contemplative session on every mount. The voice agent
  // can stomp it; the latch-once pattern would mask permanent failures.
  useEffect(() => {
    void applyContemplativeSession();
  }, []);

  /* Helpers — written as closures over `playerA`/`playerB`; they're
   * declared inside the play/pause effect so the closure captures the
   * latest player references after a source change. */

  // Reset both players when the source changes. Without this, refs
  // stale-point at the old space's transport state.
  useEffect(() => {
    if (!source) return;
    try {
      playerA.volume = 0;
      playerB.volume = 0;
      playerA.loop = false;   // we own the loop; don't let native loop too
      playerB.loop = false;
    } catch {
      /* not yet ready — first transport tick handles it */
    }
    stateRef.current.active = 'A';
    stateRef.current.crossfading = false;
    setActiveKey('A');
  }, [playerA, playerB, source]);

  // Main transport: drive play / pause and the ping-pong crossfade.
  useEffect(() => {
    if (!source) return;
    const s = stateRef.current;

    const get = (which: 'A' | 'B'): AudioPlayer => (which === 'A' ? playerA : playerB);
    const getActive = (): AudioPlayer => get(s.active);
    const getStandby = (): AudioPlayer => get(s.active === 'A' ? 'B' : 'A');

    const cancelAllFades = () => {
      s.fadeIds.forEach((id) => clearInterval(id));
      s.fadeIds = [];
    };

    const cancelPoll = () => {
      if (s.pollId != null) {
        clearInterval(s.pollId);
        s.pollId = null;
      }
    };

    const fade = (
      player: AudioPlayer,
      from: number,
      to: number,
      durationMs: number,
      onDone?: () => void,
    ) => {
      const steps = Math.max(2, Math.round(durationMs / FADE_STEP_MS));
      const interval = durationMs / steps;
      const delta = (to - from) / steps;
      let i = 0;
      const id = setInterval(() => {
        i += 1;
        const v = i >= steps ? to : from + delta * i;
        try { player.volume = Math.max(0, Math.min(1, v)); } catch { /* not ready */ }
        if (i >= steps) {
          clearInterval(id);
          s.fadeIds = s.fadeIds.filter((x) => x !== id);
          onDone?.();
        }
      }, interval);
      s.fadeIds.push(id);
    };

    if (playing) {
      // Resume / start. Force the active player's volume to 0 BEFORE
      // play() so the fade-in always starts from a known baseline —
      // never read `active.volume` here. Reading it picks up stale
      // values during a `replace()` source-swap (the property setter
      // silently no-ops if the player is mid-load), which would mean
      // the new bed comes in at full volume with no fade — an audible
      // jolt every time the user switches spaces mid-play.
      const active = getActive();
      try { active.volume = 0; } catch { /* not ready — fade will retry */ }
      try { active.play(); } catch { /* not ready */ }

      // Bind the active player to the OS lock-screen / now-playing
      // session. This is what actually starts the Android foreground
      // service — without this call Android terminates playback at the
      // ~3-min background cap regardless of `shouldPlayInBackground`.
      // (Audio research, expo issue #38317.)
      if (meta) {
        try {
          active.setActiveForLockScreen(true, {
            title: meta.title,
            artist: meta.artist ?? 'SelfMind Spaces',
            ...(meta.artwork ? { artwork: meta.artwork } : {}),
          });
        } catch { /* method missing in older versions; ignore */ }
      }

      cancelAllFades();
      fade(active, 0, 1, FADE_IN_MS);

      // Ping-pong poll: detect approach-to-end, kick off crossfade.
      cancelPoll();
      s.pollId = setInterval(() => {
        if (s.crossfading) return;
        const a = getActive();
        const dur = a.duration;
        const ct = a.currentTime;
        // `Number.isFinite` rejects NaN AND ±Infinity. iOS yields
        // currentTime=NaN during initial buffering; without this
        // guard, `dur - NaN` propagates and crossfade kicks on the
        // first poll tick — silent first 4 s, audible never.
        if (!Number.isFinite(dur) || dur <= 0) return;
        if (!Number.isFinite(ct)) return;
        // Guard against tracks shorter than (or barely longer than)
        // the crossfade window. If the loop is 3 s and we crossfade
        // for 4 s, the math collapses — both players fade at once and
        // the room goes silent. Skip ping-pong on short tracks; the
        // tap-to-replay affordance covers them.
        if (dur * 1000 < CROSSFADE_MS * 2) return;
        const remainingMs = (dur - ct) * 1000;
        if (remainingMs > CROSSFADE_MS) return;

        // Boundary reached — start the standby from 0 with the same
        // source. They must both be loaded; useAudioPlayer hydrates
        // the second instance asynchronously, so on a fresh source
        // the first crossfade may briefly fall back to silence.
        // Acceptable: bed length minus 4s on first loop only.
        s.crossfading = true;
        const standby = getStandby();
        try {
          void standby.seekTo(0);
          standby.volume = 0;
          standby.play();
        } catch { /* not ready */ }

        fade(a, a.volume ?? 1, 0, CROSSFADE_MS, () => {
          try {
            a.pause();
            void a.seekTo(0);
          } catch { /* not ready */ }
        });
        fade(standby, 0, 1, CROSSFADE_MS, () => {
          // Swap roles. Next poll iteration treats `standby` as active.
          // Hand off the lock-screen session to the new active player —
          // only one player can own it at a time, and the old one is
          // about to be silenced + paused. Without this, the Android
          // now-playing card stays bound to the muted player and
          // controls go dead.
          if (meta) {
            try { a.setActiveForLockScreen(false); } catch { /* ignore */ }
            try {
              standby.setActiveForLockScreen(true, {
                title: meta.title,
                artist: meta.artist ?? 'SelfMind Spaces',
                ...(meta.artwork ? { artwork: meta.artwork } : {}),
              });
            } catch { /* ignore */ }
          }
          s.active = s.active === 'A' ? 'B' : 'A';
          setActiveKey(s.active);
          s.crossfading = false;
        });
      }, POLL_MS);
    } else {
      // Pause. Stop the loop poll, kill any crossfade fades, ramp
      // BOTH players to 0 (we may be mid-crossfade with both audible),
      // then pause both.
      cancelPoll();
      cancelAllFades();

      // Mid-crossfade pause handoff: the OUTGOING player is at
      // end-of-track and would loop awkwardly on resume. Promote the
      // INCOMING (standby) to active NOW so the next play() resumes
      // from the start of the next loop iteration — what the user
      // was about to hear.
      if (s.crossfading) {
        s.active = s.active === 'A' ? 'B' : 'A';
        setActiveKey(s.active);
        // Hand off lock-screen ownership too — the new active is who
        // the now-playing card should bind to on resume.
        if (meta) {
          const oldA = s.active === 'A' ? playerB : playerA;
          const newA = getActive();
          try { oldA.setActiveForLockScreen(false); } catch { /* ignore */ }
          try {
            newA.setActiveForLockScreen(true, {
              title: meta.title,
              artist: meta.artist ?? 'SelfMind Spaces',
              ...(meta.artwork ? { artwork: meta.artwork } : {}),
            });
          } catch { /* ignore */ }
        }
      }
      s.crossfading = false;

      const a = getActive();
      const b = getStandby();
      const aFrom = a.volume ?? 0;
      const bFrom = b.volume ?? 0;

      fade(a, aFrom, 0, FADE_OUT_MS, () => {
        try { a.pause(); } catch { /* not ready */ }
      });
      if (bFrom > 0.001) {
        fade(b, bFrom, 0, FADE_OUT_MS, () => {
          try { b.pause(); } catch { /* not ready */ }
        });
      } else {
        try { b.pause(); } catch { /* not ready */ }
      }
    }

    return () => {
      cancelPoll();
      cancelAllFades();
    };
  }, [playerA, playerB, source, playing, meta]);

  /* No explicit unmount cleanup. `useAudioPlayer`'s own teardown
   * releases each AudioPlayer (and its lock-screen session) when the
   * hook unmounts or the source changes. Calling pause /
   * clearLockScreenControls / volume here would race that release —
   * the JS-side ref still points at the player but its native shared
   * object has already been deallocated, producing
   * `NativeSharedObjectNotFoundException` warnings on every source
   * swap. Trust the library. */

  /* Public seek — drives the active player's playback head. Clamps
   * to [0, duration] so a scrub past the end doesn't wrap. The
   * standby player is intentionally untouched: when the next
   * crossfade fires it'll seek itself to 0 and start from there. */
  const seek = useCallback((seconds: number) => {
    const player = activeKey === 'A' ? playerA : playerB;
    const dur = player.duration;
    const clamped = Number.isFinite(dur) && dur > 0
      ? Math.max(0, Math.min(seconds, dur))
      : Math.max(0, seconds);
    try { void player.seekTo(clamped); } catch { /* not ready */ }
  }, [playerA, playerB, activeKey]);

  const durationSec = Number.isFinite(status.duration) ? status.duration : 0;
  const positionSec = Number.isFinite(status.currentTime) ? status.currentTime : 0;
  const isLoaded = Boolean(status.isLoaded);

  return { durationSec, positionSec, isLoaded, seek };
}
