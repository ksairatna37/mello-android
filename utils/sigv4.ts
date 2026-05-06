/**
 * Minimal AWS SigV4 request signer
 * Uses expo-crypto so it works in Expo/Hermes without WebCrypto subtle.
 */

import * as Crypto from 'expo-crypto';

const enc = new TextEncoder();
const SHA256_BLOCK_SIZE = 64;

function buf2hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toBytes(data: string): Uint8Array {
  return enc.encode(data);
}

function toByteView(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function arrayBufferToBytes(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer);
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, array) => sum + array.length, 0);
  const output = new Uint8Array(totalLength);

  let offset = 0;
  for (const array of arrays) {
    output.set(array, offset);
    offset += array.length;
  }

  return output;
}

function awsEncodeUriComponent(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function awsCanonicalUri(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => awsEncodeUriComponent(segment))
    .join('/');
}

async function sha256(data: Uint8Array | ArrayBuffer): Promise<ArrayBuffer> {
  const bytes =
    data instanceof Uint8Array
      ? toByteView(data)
      : arrayBufferToBytes(data as ArrayBuffer);

  return Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes as unknown as BufferSource);
}

async function sha256hex(data: string): Promise<string> {
  const digest = await sha256(toBytes(data));
  return buf2hex(digest);
}

async function hmacSha256(key: Uint8Array | ArrayBuffer, data: string): Promise<ArrayBuffer> {
  let normalizedKey = key instanceof Uint8Array ? toByteView(key) : new Uint8Array(key);

  if (normalizedKey.length > SHA256_BLOCK_SIZE) {
    normalizedKey = new Uint8Array(await sha256(normalizedKey));
  }

  if (normalizedKey.length < SHA256_BLOCK_SIZE) {
    const paddedKey = new Uint8Array(SHA256_BLOCK_SIZE);
    paddedKey.set(normalizedKey);
    normalizedKey = paddedKey;
  }

  const oKeyPad = new Uint8Array(SHA256_BLOCK_SIZE);
  const iKeyPad = new Uint8Array(SHA256_BLOCK_SIZE);

  for (let i = 0; i < SHA256_BLOCK_SIZE; i += 1) {
    oKeyPad[i] = normalizedKey[i] ^ 0x5c;
    iKeyPad[i] = normalizedKey[i] ^ 0x36;
  }

  const innerHash = new Uint8Array(await sha256(concatBytes(iKeyPad, toBytes(data))));
  return sha256(concatBytes(oKeyPad, innerHash));
}

async function deriveSigningKey(
  secretKey: string,
  date: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(toBytes(`AWS4${secretKey}`), date);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

export interface SignedHeaders {
  [header: string]: string | undefined;
  Authorization: string;
  'x-amz-date': string;
  'x-amz-content-sha256': string;
  'Content-Type': string;
  'x-amz-security-token'?: string;
}

export async function signRequest(opts: {
  method: string;
  url: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  body: string;
  contentType?: string;
}): Promise<SignedHeaders> {
  const {
    method,
    url,
    region,
    service,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    body,
    contentType = 'application/json',
  } = opts;

  const parsed = new URL(url);
  const host = parsed.host;
  const path = awsCanonicalUri(parsed.pathname);
  const queryString = parsed.search.slice(1);

  const now = new Date();
  const amzDate = `${now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15)}Z`;
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = await sha256hex(body);

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    (sessionToken ? `x-amz-security-token:${sessionToken}\n` : '') +
    `x-amz-date:${amzDate}\n`;

  const signedHeadersList = sessionToken
    ? 'content-type;host;x-amz-content-sha256;x-amz-date;x-amz-security-token'
    : 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    method.toUpperCase(),
    path,
    queryString,
    canonicalHeaders,
    signedHeadersList,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256hex(canonicalRequest),
  ].join('\n');

  const signingKey = await deriveSigningKey(secretAccessKey, dateStamp, region, service);
  const signature = buf2hex(await hmacSha256(signingKey, stringToSign));

  const authHeader =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeadersList}, ` +
    `Signature=${signature}`;

  const headers: SignedHeaders = {
    Authorization: authHeader,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    'Content-Type': contentType,
  };

  if (sessionToken) {
    headers['x-amz-security-token'] = sessionToken;
  }

  return headers;
}
