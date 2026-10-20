/**
 * Password hashing shared by `auth.ts` and `seed.ts`.
 *
 * The active algorithm is PBKDF2-SHA256 with 200k iterations. Hashes written
 * by the pre-2024 implementation used a single unsalted-in-practice SHA-256
 * pass; those are still verified so legacy accounts keep working, and the
 * caller is told to re-hash them.
 */

const PBKDF2_ITERATIONS = 200_000;
const MIN_PBKDF2_ITERATIONS = 100_000;
const LEGACY_SALT = "hatud_salt_2024";

export interface PasswordVerification {
  /** True when the stored hash uses a legacy format and should be upgraded. */
  needsRehash: boolean;
  /** True when the supplied password matches the stored hash. */
  valid: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const saltB64 = btoa(String.fromCharCode(...saltBytes));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    256
  );
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(bits)));
  return `pbkdf2:${PBKDF2_ITERATIONS}:${saltB64}:${hashB64}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<PasswordVerification> {
  const parts = stored.split(":");

  if (parts.length === 4 && parts[0] === "pbkdf2") {
    const [, iterStr, saltB64, expectedB64] = parts;
    if (saltB64 === undefined || expectedB64 === undefined) {
      return { valid: false, needsRehash: false };
    }

    // Guard against a tampered iteration count in the stored hash.
    const iterations = Number(iterStr);
    if (!Number.isInteger(iterations) || iterations < MIN_PBKDF2_ITERATIONS) {
      return { valid: false, needsRehash: false };
    }

    const saltBytes = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations },
      keyMaterial,
      256
    );
    const hashB64 = btoa(String.fromCharCode(...new Uint8Array(bits)));
    return { valid: hashB64 === expectedB64, needsRehash: false };
  }

  // Legacy single-pass SHA-256. Verified for compatibility, then upgraded.
  const legacyHash = await hashLegacyPassword(password);
  return { valid: legacyHash === stored, needsRehash: legacyHash === stored };
}

async function hashLegacyPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`${password}${LEGACY_SALT}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
