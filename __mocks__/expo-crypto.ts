/**
 * Stub for expo-crypto under Jest. Real native crypto isn't available
 * (and isn't needed) for the pure-function tests we run here.
 * Jest only loads this when a test pulls in something that imports
 * `expo-crypto` — typically the SigV4 path via bedrockService.
 */

export const CryptoDigestAlgorithm = { SHA256: 'SHA-256' };

export async function digest(): Promise<ArrayBuffer> {
  throw new Error('expo-crypto.digest is not implemented in test env');
}
