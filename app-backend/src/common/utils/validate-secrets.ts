const MIN_SECRET_LENGTH = 32;
const PLACEHOLDER_PATTERN = /change[-_ ]this|your[-_ ]super[-_ ]secret|changeme|secret$/i;

/**
 * Fails fast on missing/short JWT secrets. Placeholder values are fatal in
 * production and a loud warning elsewhere so local dev keeps working.
 */
export function validateSecrets(env: NodeJS.ProcessEnv = process.env): void {
  const isProd = env.NODE_ENV === 'production';
  const problems: string[] = [];

  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const value = env[key];
    if (!value || value.length < MIN_SECRET_LENGTH) {
      problems.push(`${key} is missing or shorter than ${MIN_SECRET_LENGTH} chars`);
    } else if (PLACEHOLDER_PATTERN.test(value)) {
      if (isProd) {
        problems.push(`${key} still uses a placeholder value`);
      } else {
        console.warn(`⚠️  ${key} uses a placeholder value. Generate a random one before deploying.`);
      }
    }
  }

  if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) {
    problems.push('JWT_SECRET and JWT_REFRESH_SECRET must differ');
  }

  if (problems.length) {
    throw new Error(`Insecure configuration:\n - ${problems.join('\n - ')}`);
  }
}
