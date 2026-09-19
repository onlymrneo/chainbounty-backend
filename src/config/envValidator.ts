export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  errors: string[];
  warnings: string[];
}

export const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
] as const;

export const RECOMMENDED_PROD_VARS = [
  'GITHUB_WEBHOOK_SECRET',
  'SOROBAN_CONTRACT_ADDRESS',
] as const;

/**
 * Validates presence and format of required environment variables.
 */
export function validateEnv(env: NodeJS.ProcessEnv = process.env): EnvValidationResult {
  const missing: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const varName of REQUIRED_ENV_VARS) {
    const val = env[varName];
    if (!val || val.trim() === '') {
      missing.push(varName);
    }
  }

  // Check PORT format if specified
  if (env.PORT) {
    const parsedPort = parseInt(env.PORT, 10);
    if (isNaN(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
      errors.push(`PORT must be a valid integer between 1 and 65535, received "${env.PORT}"`);
    }
  }

  // Check PLATFORM_FEE_PERCENTAGE format if specified
  if (env.PLATFORM_FEE_PERCENTAGE) {
    const fee = parseFloat(env.PLATFORM_FEE_PERCENTAGE);
    if (isNaN(fee) || fee < 0 || fee > 100) {
      errors.push(`PLATFORM_FEE_PERCENTAGE must be a valid percentage between 0 and 100, received "${env.PLATFORM_FEE_PERCENTAGE}"`);
    }
  }

  // Check INDEXER_POLL_INTERVAL_MS format if specified
  if (env.INDEXER_POLL_INTERVAL_MS) {
    const interval = parseInt(env.INDEXER_POLL_INTERVAL_MS, 10);
    if (isNaN(interval) || interval <= 0) {
      errors.push(`INDEXER_POLL_INTERVAL_MS must be a positive integer in milliseconds, received "${env.INDEXER_POLL_INTERVAL_MS}"`);
    }
  }

  // Warnings in production environment
  const isProd = env.NODE_ENV === 'production';
  if (isProd) {
    for (const varName of RECOMMENDED_PROD_VARS) {
      const val = env[varName];
      if (!val || val.trim() === '') {
        warnings.push(`Recommended production variable "${varName}" is not set`);
      }
    }
    if (env.JWT_SECRET === 'dev-secret-change-in-production' || env.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production') {
      warnings.push('JWT_SECRET appears to be using a default development value in production');
    }
  }

  const valid = missing.length === 0 && errors.length === 0;
  return { valid, missing, errors, warnings };
}

/**
 * Validates configuration and terminates process with clear diagnostics if required variables are missing.
 */
export function assertEnvOrExit(env: NodeJS.ProcessEnv = process.env): void {
  const result = validateEnv(env);

  if (!result.valid) {
    console.error('❌ FATAL: Environment variable validation failed on startup');
    if (result.missing.length > 0) {
      console.error('Missing required environment variables:');
      for (const m of result.missing) {
        console.error(`  - ${m}`);
      }
    }
    if (result.errors.length > 0) {
      console.error('Invalid environment variable configurations:');
      for (const err of result.errors) {
        console.error(`  - ${err}`);
      }
    }
    console.error('\nPlease copy .env.example to .env and configure all required variables before starting.\n');
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️ Configuration warnings:');
    for (const w of result.warnings) {
      console.warn(`  - ${w}`);
    }
  }
}
