import { validateEnv, assertEnv, REQUIRED_ENV_VARS } from '../src/config/env';

describe('Environment Variable Validation (Issue #29)', () => {
  const validEnv: Record<string, string> = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_SECRET: 'test-jwt-secret-key-at-least-32-chars',
    GITHUB_WEBHOOK_SECRET: 'test-github-webhook-secret',
  };

  describe('validateEnv', () => {
    it('should return isValid: true when all required environment variables are present', () => {
      const result = validateEnv(validEnv);
      expect(result.isValid).toBe(true);
      expect(result.missingVars).toEqual([]);
    });

    it('should return isValid: false and list missing variables when any are missing', () => {
      const incompleteEnv = {
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      };

      const result = validateEnv(incompleteEnv);
      expect(result.isValid).toBe(false);
      expect(result.missingVars).toContain('JWT_SECRET');
      expect(result.missingVars).toContain('GITHUB_WEBHOOK_SECRET');
      expect(result.missingVars).not.toContain('DATABASE_URL');
    });

    it('should treat empty or whitespace-only variables as missing', () => {
      const blankEnv = {
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        JWT_SECRET: '   ',
        GITHUB_WEBHOOK_SECRET: '',
      };

      const result = validateEnv(blankEnv);
      expect(result.isValid).toBe(false);
      expect(result.missingVars).toEqual(['JWT_SECRET', 'GITHUB_WEBHOOK_SECRET']);
    });
  });

  describe('assertEnv', () => {
    it('should not throw when environment is valid', () => {
      expect(() => assertEnv(validEnv)).not.toThrow();
    });

    it('should throw an Error with missing variable names when invalid', () => {
      const emptyEnv = {};
      expect(() => assertEnv(emptyEnv)).toThrow(/Missing required environment variables/);
      expect(() => assertEnv(emptyEnv)).toThrow(/DATABASE_URL/);
      expect(() => assertEnv(emptyEnv)).toThrow(/JWT_SECRET/);
      expect(() => assertEnv(emptyEnv)).toThrow(/GITHUB_WEBHOOK_SECRET/);
    });
  });

  describe('REQUIRED_ENV_VARS', () => {
    it('should include critical system configuration variables', () => {
      expect(REQUIRED_ENV_VARS).toContain('DATABASE_URL');
      expect(REQUIRED_ENV_VARS).toContain('JWT_SECRET');
      expect(REQUIRED_ENV_VARS).toContain('GITHUB_WEBHOOK_SECRET');
    });
  });
});
