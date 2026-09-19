/**
 * Environment Variable Validator
 * Validates presence and types of critical environment variables on startup.
 * Addresses Issue #29 on Chainbounty/chainbounty-backend.
 */

export interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  GITHUB_WEBHOOK_SECRET: string;
  STELLAR_HORIZON_URL: string;
  SOROBAN_CONTRACT_ADDRESS: string;
  STELLAR_NETWORK_PASSPHRASE: string;
  INDEXER_POLL_INTERVAL_MS: number;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  NOTIFICATION_WEBHOOK_URL?: string;
  PLATFORM_FEE_PERCENTAGE: number;
}

export const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'GITHUB_WEBHOOK_SECRET',
  'STELLAR_HORIZON_URL',
  'SOROBAN_CONTRACT_ADDRESS',
  'STELLAR_NETWORK_PASSPHRASE',
] as const;

export interface ValidationResult {
  isValid: boolean;
  missingVars: string[];
  config?: EnvConfig;
}

/**
 * Validates an environment variable dictionary against required parameters.
 * Does not throw, returns structured result for flexible consumption.
 */
export function validateEnv(
  env: Record<string, string | undefined> = process.env,
): ValidationResult {
  const missingVars: string[] = [];

  for (const varName of REQUIRED_ENV_VARS) {
    const val = env[varName];
    if (val === undefined || val.trim() === '') {
      missingVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    return {
      isValid: false,
      missingVars,
    };
  }

  const port = parseInt(env.PORT ?? '3000', 10);
  const indexerInterval = parseInt(
    env.INDEXER_POLL_INTERVAL_MS ?? '15000',
    10,
  );
  const feePercentage = parseFloat(env.PLATFORM_FEE_PERCENTAGE ?? '2.5');

  const config: EnvConfig = {
    NODE_ENV: env.NODE_ENV ?? 'development',
    PORT: isNaN(port) ? 3000 : port,
    DATABASE_URL: env.DATABASE_URL!,
    GITHUB_WEBHOOK_SECRET: env.GITHUB_WEBHOOK_SECRET!,
    STELLAR_HORIZON_URL: env.STELLAR_HORIZON_URL!,
    SOROBAN_CONTRACT_ADDRESS: env.SOROBAN_CONTRACT_ADDRESS!,
    STELLAR_NETWORK_PASSPHRASE: env.STELLAR_NETWORK_PASSPHRASE!,
    INDEXER_POLL_INTERVAL_MS: isNaN(indexerInterval) ? 15000 : indexerInterval,
    JWT_SECRET: env.JWT_SECRET!,
    JWT_EXPIRES_IN: env.JWT_EXPIRES_IN ?? '7d',
    NOTIFICATION_WEBHOOK_URL: env.NOTIFICATION_WEBHOOK_URL,
    PLATFORM_FEE_PERCENTAGE: isNaN(feePercentage) ? 2.5 : feePercentage,
  };

  return {
    isValid: true,
    missingVars: [],
    config,
  };
}

/**
 * Enforces validation on startup. Logs helpful error and throws if required vars are missing.
 */
export function enforceEnvValidation(
  env: Record<string, string | undefined> = process.env,
): EnvConfig {
  const result = validateEnv(env);
  if (!result.isValid) {
    const errorMsg = `[Startup Configuration Error] Missing required environment variables:\n  - ${result.missingVars.join(
      '\n  - ',
    )}\nPlease configure them in your .env file or deployment environment.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  return result.config!;
}
