/**
 * The rules a new sign-up has to meet.
 *
 * A pure module with no imports, so the client can bundle it as well as the
 * server. The client checks as the user types; the server is the authority.
 * One module, so the two cannot disagree.
 */

/**
 * The only mail domain a new sign-up may use.
 *
 * A constant, so changing it is one line. The accounts that already exist
 * were created before this rule and are not affected by it.
 */
export const GMAIL_DOMAIN = "gmail.com";

/** The Philippine mobile number is eleven digits: 09XXXXXXXXX. */
export const PHONE_DIGIT_COUNT = 11;

/** The prefix a Philippine mobile number is written with. */
export const PHONE_PREFIX = "09";

/** The country code the number is stored with. */
export const PHONE_COUNTRY_CODE = "+63";

/** A well-formed address: something, an at sign, a domain, a dot, a suffix. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Only the digits, with the spaces and dashes a person might type. */
const DIGITS_ONLY = /\D/g;

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Whether the address is a Gmail address.
 *
 * The address has to be well-formed as well as on the right domain, so that
 * `notgmail.com` and `a@b` are both refused.
 */
export function isGmailAddress(email: string): boolean {
  const normalised = normaliseEmail(email);
  if (!EMAIL_PATTERN.test(normalised)) {
    return false;
  }
  return normalised.endsWith(`@${GMAIL_DOMAIN}`);
}

/**
 * Whether the number is eleven digits written the Philippine way.
 *
 * A number in any other shape — ten digits, twelve, the international form —
 * is refused, so that the same person cannot be counted twice by writing
 * their number two different ways.
 */
export function isValidPhone(phone: string): boolean {
  const digits = phone.trim().replace(DIGITS_ONLY, "");
  if (digits.length !== PHONE_DIGIT_COUNT) {
    return false;
  }
  return digits.startsWith(PHONE_PREFIX);
}

/**
 * The number as it is stored.
 *
 * `09171234567` becomes `+639171234567` — the shape the seeded accounts
 * already use, so the uniqueness index catches a number that is already
 * registered however it was written.
 */
export function normalisePhone(phone: string): string {
  const digits = phone.trim().replace(DIGITS_ONLY, "");
  if (digits.length === PHONE_DIGIT_COUNT) {
    // The leading zero of 09XXXXXXXXX is dropped, and the country code put
    // in its place: 09171234567 becomes +639171234567, which is the shape the
    // existing accounts use.
    return `${PHONE_COUNTRY_CODE}${digits.slice(1)}`;
  }
  return phone.trim();
}
