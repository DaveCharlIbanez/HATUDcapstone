/**
 * The one-time code.
 *
 * Six digits is a million combinations, so the code is short-lived, limited
 * in its attempts, and stored hashed. A stolen database must not hand over a
 * live code.
 */

/** How many digits the code has. */
export const OTP_LENGTH = 6;

/** How long a code is good for. */
export const OTP_TTL_MS = 10 * 60 * 1000;

/** How many wrong guesses a code tolerates before it is spent. */
export const MAX_OTP_ATTEMPTS = 5;

/** How long before another code can be sent for the same address. */
export const RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * A fresh six-digit code.
 *
 * The digits are taken from the random source and the values that would be
 * favoured by a modulo are rejected, so every code is equally likely.
 */
export function generateOtpCode(): string {
  const limit = 10 ** OTP_LENGTH;
  const ceiling = Math.floor(0xff_ff_ff_ff / limit) * limit;
  const values = new Uint32Array(1);

  let code = 0;
  do {
    crypto.getRandomValues(values);
    code = values[0] ?? 0;
  } while (code >= ceiling);

  return String(code % limit).padStart(OTP_LENGTH, "0");
}

/** A fresh salt, so two codes for the same address never hash the same. */
export function newOtpSalt(): string {
  return crypto.randomUUID();
}

async function digest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * The hash of a code, salted.
 *
 * The salt is stored alongside the hash, so the code itself never is.
 */
export async function hashOtp(code: string, salt: string): Promise<string> {
  return await digest(`${salt}:${code}`);
}

/** Whether a code is the one that was stored. */
export async function matchesOtp(
  code: string,
  salt: string,
  storedHash: string
): Promise<boolean> {
  const attempt = await hashOtp(code, salt);
  return attempt === storedHash;
}
