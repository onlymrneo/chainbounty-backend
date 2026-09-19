/**
 * Required environment variables for ChainBounty backend.
 * Missing variables will prevent server startup with clear diagnostics.
 */
export const REQUIRED_ENV_VARS = ['DATABASE_URL', 'JWT_SECRET', 'GITHUB_WEBHOOK_SECRET'] as const;

export interface EnvValidationResult {
  isValid: boolean;
  missingVars: string[];
}

/**
 * Validates that all required environment variables are set and non-empty.
 */
export function validateEnv(
  env: Record<string, string | undefined> = process.env,
): EnvValidationResult {
  const missingVars: string[] = [];

  for (const varName of REQUIRED_ENV_VARS) {
    const value = env[varName];
    if (!value || value.trim() === '') {
      missingVars.push(varName);
    }
  }

  return {
    isValid: missingVars.length === 0,
    missingVars,
  };
}

/**
 * Asserts that the environment is properly configured.
 * Throws a descriptive Error listing all missing variables if validation fails.
 */
export function assertEnv(env: Record<string, string | undefined> = process.env): void {
  const result = validateEnv(env);

  if (!result.isValid) {
    const missingList = result.missingVars.map((v) => `  - ${v}`).join('\n');
    const errorMessage =
      `[Startup Error] Missing required environment variables:\n` +
      `${missingList}\n` +
      `Please ensure these variables are defined in your .env file or deployment environment.`;

    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}
