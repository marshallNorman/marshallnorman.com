import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';

// The password lives in a Vercel env var (the repo is public). Runtime
// `process.env` first, like src/pages/api/now-playing.json.ts.
const COOKIE = 'showcase_auth';
const MAX_AGE = 60 * 60 * 24 * 30;

// Dynamic key so Vite doesn't inline secrets into the bundle; the
// import.meta.env fallback covers `astro dev` reading .env/.env.local.
export function serverEnv(key: string): string | undefined {
  return process.env[key] ?? (import.meta.env as Record<string, string | undefined>)[key];
}

function getPassword(): string | undefined {
  return serverEnv('SHOWCASE_PASSWORD');
}

// Keyed with the password, so the cookie can't be forged and rotating
// the password signs everyone out.
function authToken(password: string): string {
  return createHmac('sha256', password).update('marshallnorman.com/showcase').digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function isConfigured(): boolean {
  return !!getPassword();
}

export function checkPassword(input: string): boolean {
  const password = getPassword();
  return !!password && safeEqual(input, password);
}

export function isAuthed(cookies: AstroCookies): boolean {
  const password = getPassword();
  const value = cookies.get(COOKIE)?.value;
  return !!password && !!value && safeEqual(value, authToken(password));
}

export function setAuthCookie(cookies: AstroCookies): void {
  cookies.set(COOKIE, authToken(getPassword()!), {
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    path: '/showcase',
    maxAge: MAX_AGE,
  });
}
