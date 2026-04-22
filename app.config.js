// app.config.js — extends app.json and injects all env vars at build time.
// Non-EXPO_PUBLIC_ vars are available here (Node context) but NOT in the bundle
// unless explicitly injected into `extra` below.
// At runtime, access via: Constants.expoConfig.extra.<key>

export default ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,

    // ─── Non-sensitive: safe to embed in client bundle ───────────────────────
    humeConfigId: process.env.HUME_CONFIG_ID,
    livekitApiUrl: process.env.LIVEKIT_API_URL,
    awsBedrockRegion: process.env.AWS_BEDROCK_REGION,
    awsBedrockModelArn: process.env.AWS_BEDROCK_MODEL_ARN,

    // ─── SENSITIVE: embedded in bundle — see security note below ─────────────
    // These should ideally be moved to a server-side proxy. Until then, they
    // are injected via EAS secrets (never hardcoded in eas.json / .env in VCS).
    humeApiKey: process.env.HUME_API_KEY,
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    awsBearerTokenBedrock: process.env.AWS_BEARER_TOKEN_BEDROCK,
  },
});
