import { validateEnv, assertEnvOrExit, REQUIRED_ENV_VARS } from '../src/config/envValidator';

describe('Environment Variable Validation (Issue #29)', () => {
  const validEnv: NodeJS.ProcessEnv = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/chainbounty?schema=public',
    JWT_SECRET: 'test-secret-key-1234567890',
    PORT: '3000',
    NODE_ENV: 'test',
    PLATFORM_FEE_PERCENTAGE: '2.5',
    INDEXER_POLL_INTERVAL_MS: '15000',
  };

  it('should pass validation when all required variables are present', () => {
    const result = validateEnv(validEnv);
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail validation when DATABASE_URL is missing', () => {
    const env = { ...validEnv, DATABASE_URL: '' };
    const result = validateEnv(env);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('DATABASE_URL');
  });

  it('should fail validation when JWT_SECRET is missing', () => {
    const env = { ...validEnv, JWT_SECRET: '' };
    const result = validateEnv(env);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('JWT_SECRET');
  });

  it('should list all missing required variables when multiple are absent', () => {
    const env: NodeJS.ProcessEnv = {};
    const result = validateEnv(env);
    expect(result.valid).toBe(false);
    for (const req of REQUIRED_ENV_VARS) {
      expect(result.missing).toContain(req);
    }
  });

  it('should report an error for invalid PORT values', () => {
    const env = { ...validEnv, PORT: 'invalid-port' };
    const result = validateEnv(env);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('PORT'))).toBe(true);
  });

  it('should report an error for negative or out-of-range PORT values', () => {
    const env = { ...validEnv, PORT: '70000' };
    const result = validateEnv(env);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('PORT'))).toBe(true);
  });

  it('should report an error for invalid PLATFORM_FEE_PERCENTAGE', () => {
    const env = { ...validEnv, PLATFORM_FEE_PERCENTAGE: '150' };
    const result = validateEnv(env);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('PLATFORM_FEE_PERCENTAGE'))).toBe(true);
  });

  it('should report an error for invalid INDEXER_POLL_INTERVAL_MS', () => {
    const env = { ...validEnv, INDEXER_POLL_INTERVAL_MS: '-500' };
    const result = validateEnv(env);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('INDEXER_POLL_INTERVAL_MS'))).toBe(true);
  });

  it('should report warnings for missing recommended variables in production mode', () => {
    const prodEnv: NodeJS.ProcessEnv = {
      DATABASE_URL: 'postgresql://...',
      JWT_SECRET: 'super-secure-production-secret',
      NODE_ENV: 'production',
    };
    const result = validateEnv(prodEnv);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes('GITHUB_WEBHOOK_SECRET'))).toBe(true);
  });

  it('should call process.exit(1) on failure when assertEnvOrExit is invoked', () => {
    const exitMock = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as any);
    const consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => assertEnvOrExit({})).toThrow('process.exit called');
    expect(exitMock).toHaveBeenCalledWith(1);

    exitMock.mockRestore();
    consoleErrorMock.mockRestore();
  });
});
