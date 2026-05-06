import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

function required(key: string): string {
  const value = extra[key];
  if (!value) throw new Error(`[config] Missing required env var: ${key}`);
  return value as string;
}

export const ENV = {
  // Non-sensitive
  humeConfigId: required('humeConfigId'),
  livekitApiUrl: required('livekitApiUrl'),
  awsBedrockRegion: required('awsBedrockRegion'),
  awsBedrockModelArn: required('awsBedrockModelArn'),
  awsBedrockHaikuModelId: extra['awsBedrockHaikuModelId'] as string | undefined,

  // Sensitive — injected via EAS secrets at build time
  humeApiKey: required('humeApiKey'),
  awsAccessKeyId: required('awsAccessKeyId'),
  awsSecretAccessKey: required('awsSecretAccessKey'),
  awsBearerTokenBedrock: extra['awsBearerTokenBedrock'] as string | undefined,
} as const;
