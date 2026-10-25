import { REFRESH_COOKIE, clearRefreshCookie, durationToMs, setRefreshCookie } from './refresh-cookie';

describe('durationToMs', () => {
  it.each([
    ['7d', 7 * 86_400_000],
    ['15m', 900_000],
    ['2h', 7_200_000],
    ['30s', 30_000],
    ['3600', 3_600_000],
  ])('parses %s', (input, ms) => expect(durationToMs(input)).toBe(ms));

  it('falls back on garbage or missing input', () => {
    expect(durationToMs(undefined)).toBe(7 * 86_400_000);
    expect(durationToMs('soon')).toBe(7 * 86_400_000);
    expect(durationToMs('x', 123)).toBe(123);
  });
});

describe('refresh cookie flags', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  const fakeRes = () => ({ cookie: jest.fn(), clearCookie: jest.fn() });

  it('is httpOnly, strict, and scoped to the auth path', () => {
    delete process.env.COOKIE_SAMESITE;
    process.env.NODE_ENV = 'development';
    process.env.JWT_REFRESH_EXPIRATION = '7d';
    const res = fakeRes();
    setRefreshCookie(res as any, 'tok');

    const [name, value, opts] = res.cookie.mock.calls[0];
    expect(name).toBe(REFRESH_COOKIE);
    expect(value).toBe('tok');
    expect(opts).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: 7 * 86_400_000,
    });
  });

  it('is Secure in production', () => {
    process.env.NODE_ENV = 'production';
    const res = fakeRes();
    setRefreshCookie(res as any, 'tok');
    expect(res.cookie.mock.calls[0][2].secure).toBe(true);
  });

  it('honours API_PREFIX and COOKIE_SAMESITE overrides', () => {
    process.env.API_PREFIX = 'v9';
    process.env.COOKIE_SAMESITE = 'none';
    const res = fakeRes();
    setRefreshCookie(res as any, 'tok');
    expect(res.cookie.mock.calls[0][2]).toMatchObject({ path: '/v9/auth', sameSite: 'none' });
  });

  it('clears with the same path/flags so the browser actually removes it', () => {
    process.env.NODE_ENV = 'production';
    const res = fakeRes();
    clearRefreshCookie(res as any);
    const [name, opts] = res.clearCookie.mock.calls[0];
    expect(name).toBe(REFRESH_COOKIE);
    expect(opts).toMatchObject({ httpOnly: true, secure: true, sameSite: 'strict', path: '/api/v1/auth' });
    expect(opts.maxAge).toBeUndefined();
  });
});
