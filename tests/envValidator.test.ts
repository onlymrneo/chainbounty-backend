import {
  validateEnv,
  enforceEnvValidation,
  REQUIRED_ENV_VARS,
} from '../src/config/envValidator';

describe('Environment Variable Validator (Issue #29)', () => {
  const completeEnv: Record<string, string> = {
    NODE_ENV: 'test',
    PORT: '4000',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/test',
    GITHUB_WEBHOOK_SECRET: 'test-secret',
    STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
    SOROBAN_CONTRACT_ADDRESS: 'CDMZIAKZX77777777777777777777777777777777777777777777777',
    STELLAR_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
    INDEXER_POLL_INTERVAL_MS: '10000',
    JWT_SECRET: 'supersecretjwtkeyfortestenvironment12345678',
    JWT_EXPIRES_IN: '1d',
    PLATFORM_FEE_PERCENTAGE: '3.0',
  };

  it('should validate successfully when all required environment variables are present', () => {
    const result = validateEnv(completeEnv);
    expect(result.isValid).toBe(true);
    expect(result.missingVars).toHaveLength(0);
    expect(result.config).toBeDefined();
    expect(result.config?.PORT).toBe(4000);
    expect(result.config?.PLATFORM_FEE_PERCENTAGE).toBe(3.0);
    expect(result.config?.INDEXER_POLL_INTERVAL_MS).toBe(10000);
  });

  it('should identify missing required variables', () => {
    const partialEnv = { ...completeEnv };
    delete partialEnv.DATABASE_URL;
    delete partialEnv.JWT_SECRET;

    const result = validateEnv(partialEnv);
    expect(result.isValid).toBe(false);
    expect(result.missingVars).toContain('DATABASE_URL');
    expect(result.missingVars).toContain('JWT_SECRET');
    expect(result.config).toBeUndefined();
  });

  it('should treat empty or whitespace strings as missing', () => {
    const emptyEnv = { ...completeEnv, GITHUB_WEBHOOK_SECRET: '   ' };
    const result = validateEnv(emptyEnv);
    expect(result.isValid).toBe(false);
    expect(result.missingVars).toContain('GITHUB_WEBHOOK_SECRET');
  });

  it('should apply fallback default values for optional variables', () => {
    const minimalRequiredEnv: Record<string, string> = {
      DATABASE_URL: 'postgresql://localhost:5432/test',
      GITHUB_WEBHOOK_SECRET: 'webhook-secret',
      STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
      SOROBAN_CONTRACT_ADDRESS: 'CDMZIAKZX77777777777777777777777777777777777777777777777',
      STELLAR_NETWORK_PASSPHRASE: 'Test SDF Network',
      JWT_SECRET: 'secret',
    };

    const result = validateEnv(minimalRequiredEnv);
    expect(result.isValid).toBe(true);
    expect(result.config?.PORT).toBe(3000);
    expect(result.config?.NODE_ENV).toBe('development');
    expect(result.config?.INDEXER_POLL_INTERVAL_MS).toBe(15000);
    expect(result.config?.JWT_EXPIRES_IN).toBe('7d');
    expect(result.config?.PLATFORM_FEE_PERCENTAGE).toBe(2.5);
  });

  it('should throw clear error in enforceEnvValidation when required variables are missing', () => {
    const invalidEnv = {};
    expect(() => enforceEnvValidation(invalidEnv)).toThrow(
      /Missing required environment variables/,
    );
  });

  it('should return parsed config in enforceEnvValidation when valid', () => {
    const config = enforceEnvValidation(completeEnv);
    expect(config.DATABASE_URL).toBe(completeEnv.DATABASE_URL);
    expect(config.JWT_SECRET).toBe(completeEnv.JWT_SECRET);
  });

  it('should verify all required variables are tracked in REQUIRED_ENV_VARS list', () => {
    expect(REQUIRED_ENV_VARS).toContain('DATABASE_URL');
    expect(REQUIRED_ENV_VARS).toContain('JWT_SECRET');
    expect(REQUIRED_ENV_VARS).toContain('GITHUB_WEBHOOK_SECRET');
    expect(REQUIRED_ENV_VARS).toContain('STELLAR_HORIZON_URL');
    expect(REQUIRED_ENV_VARS).toContain('SOROBAN_CONTRACT_ADDRESS');
    expect(REQUIRED_ENV_VARS).toContain('STELLAR_NETWORK_PASSPHRASE');
  });
});
