import { validateSecrets } from './validate-secrets';

const good = 'k'.repeat(16) + 'Z9x!' + 'q'.repeat(16);
const good2 = 'w'.repeat(16) + 'A1b@' + 'e'.repeat(16);

describe('validateSecrets', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('accepts two distinct strong secrets', () => {
    expect(() => validateSecrets({ NODE_ENV: 'production', JWT_SECRET: good, JWT_REFRESH_SECRET: good2 } as any)).not.toThrow();
  });

  it.each([
    ['missing', {}],
    ['too short', { JWT_SECRET: 'short', JWT_REFRESH_SECRET: good2 }],
    ['empty', { JWT_SECRET: '', JWT_REFRESH_SECRET: good2 }],
  ])('throws when JWT_SECRET is %s', (_n, env) => {
    expect(() => validateSecrets({ NODE_ENV: 'development', ...env } as any)).toThrow(/Insecure configuration/);
  });

  it('throws when both secrets are identical', () => {
    expect(() => validateSecrets({ JWT_SECRET: good, JWT_REFRESH_SECRET: good } as any)).toThrow(/must differ/);
  });

  it('refuses the shipped placeholder values in production', () => {
    const env = {
      NODE_ENV: 'production',
      JWT_SECRET: 'your-super-secret-jwt-key-change-this-in-production',
      JWT_REFRESH_SECRET: 'your-super-secret-refresh-key-change-this-in-production',
    };
    expect(() => validateSecrets(env as any)).toThrow(/placeholder/);
  });

  it('only warns about placeholders outside production so local dev keeps working', () => {
    const env = {
      NODE_ENV: 'development',
      JWT_SECRET: 'your-super-secret-jwt-key-change-this-in-production',
      JWT_REFRESH_SECRET: 'your-super-secret-refresh-key-change-this-in-production',
    };
    expect(() => validateSecrets(env as any)).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
