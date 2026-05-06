/**
 * Stub for expo-constants under Jest. The pure-function tests don't
 * touch ENV; we only need to keep the module load from blowing up.
 * `extra` is populated with placeholder strings so the `required()`
 * checks in config/env.ts don't throw at import time.
 */

const extra: Record<string, string> = {
  humeConfigId: 'test',
  livekitApiUrl: 'test',
  awsBedrockRegion: 'us-east-1',
  awsBedrockModelArn: 'test',
  humeApiKey: 'test',
  awsAccessKeyId: 'test',
  awsSecretAccessKey: 'test',
};

export default {
  expoConfig: { extra },
};
