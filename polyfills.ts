/**
 * Polyfills for React Native compatibility.
 * Imported in app/_layout.tsx before other code.
 */

// Buffer polyfill (may be needed by some libraries)
import { Buffer } from 'buffer';
if (typeof global.Buffer === 'undefined') {
  (global as any).Buffer = Buffer;
}
