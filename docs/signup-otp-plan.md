# Sign-Up with Gmail, an 11-Digit Phone, and an Email OTP — Implementation Plan

**Log ID:** `fixoct34`
**Created:** 2026-10-28 13:40 PST (Wednesday)
**Status:** ✅ Executed — all five waves complete
**Result:** `tsc` 0 errors · `ultracite check` 0 errors · 171 tests passing · `next build` OK · `npm run mobile:build` OK
**Related log:** [`FIXOCT34.md`](../FIXOCT34.md) at the repository root
**Previous:** [`docs/own-router-plan.md`](own-router-plan.md) (`fixoct32`), [`FIXOCT33.md`](../FIXOCT33.md) (`fixoct33`)

---

## Overview

Three things are added to sign-up:

1. **The email must be a Gmail address.** `@gmail.com`, and it must be
   well-formed.
2. **The phone number must be eleven digits** — the Philippine mobile
   standard, `09XXXXXXXXX` — and it is stored as `+63XXXXXXXXX`, the same
   shape the existing accounts use.
3. **The account is only created once an email one-time code has been
   entered.** The code is generated on the server, sent by email, and verified
   before anything is written.

**The fifteen accounts that already exist are not affected.** They are the test
accounts — they were created directly by the seed, or before these rules
existed — and they keep working exactly as they do. The rules apply only to
accounts created through sign-up from now on.

---

## The existing accounts, and why they are exempt

The deployment was inspected before anything was changed:

```
total: 15      gmail: 0      notGmail: 15
phone digit counts: { 5: 1, 9: 1, 11: 2, 12: 11 }
```

**Not one of them is a Gmail address**, and eleven of them carry a
twelve-digit number. If the rules were applied to the existing accounts, every
test account in the app would be unusable.

So the rules live where **new** sign-ups go through — `auth.requestSignupCode` —
and the accounts that already exist never pass through it. They were inserted
directly by `convex/seed.ts`, or created before the rules existed, and they
are left alone.

| Account | How it exists | Affected? |
|---|---|---|
| The seeded `admin@hatud.com`, `commuter1@hatud.com`, `operator1@hatud.com` and the rest | Inserted by `convex/seed.ts` | **No** — never passes through sign-up |
| The accounts created through sign-up before this change | Created before the rules | **No** — already exist, and are not re-validated |
| Any new account | `auth.requestSignupCode` | **Yes** — Gmail, eleven digits, and a verified code |

A test asserts that the seed still produces accounts that do not meet the new
rules, so the exemption cannot be broken by accident.

---

## Problem Statement

| # | Problem | Detail |
|---|---|---|
| 1 | Any address can be used to sign up | `auth.signup` takes a string and checks only that it is not already taken |
| 2 | The phone number is unvalidated | `auth.signup` takes a string; the deployment holds a `12345` and a nine-digit number |
| 3 | An account is created with no proof of the address | The address is never verified, so it may not be the user's |
| 4 | `auth.signup` is public, so any check would be bypassable | A client-side gate is one line of `curl` away from being walked around |
| 5 | There is no email service to send a code with | The project has a payment provider seam and no mail seam |
| 6 | A code can be brute-forced | Six digits is a million combinations, and it needs an attempt limit and an expiry |
| 7 | The code must not be able to create an account by itself | The code and the account creation have to be one transaction |

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| The email rule | `@gmail.com`, well-formed, lower-cased | As asked. The allowed domain is a constant, so changing it is one line. |
| The phone rule | Exactly eleven digits, starting `09` | The Philippine mobile standard. |
| How the phone is stored | `+63` and the last ten digits | The same shape the seeded accounts use, so the uniqueness index catches a number that already exists in either form. |
| The code | Six digits, ten-minute expiry, five attempts | An expiry and an attempt limit make brute force pointless. |
| How the code is stored | Hashed, with a per-code salt | A stolen database must not hand over live codes. |
| The code is sent by | An **email provider seam**, exactly like the payment seam | `convex/lib/email.ts` — a console provider now, a real one later, without touching the flow. |
| How the flow is demonstrated | A **sandbox mailbox**, a public query that is off unless `SIGNUP_SANDBOX=1` | The code has to be visible without an email provider, and the query refuses to answer unless it is explicitly enabled. |
| Where the code is verified | In the same mutation that creates the account | A verified code and an account that exists are one transaction. |
| The public `auth.signup` | **Removed** | If it stayed public, it would be a way to create an account without a code. |
| The rules shared between client and server | One module, `convex/lib/signupRules.ts`, imported by both | The client checks as you type; the server is authoritative. One source, so they cannot disagree. |

### Non-goals

* A real email provider. The seam is there; wiring Resend or SMTP is a
  deployment task, not a code change.
* Re-verifying the fifteen existing accounts, or a "please confirm your email"
  screen for people who already signed up.
* Verifying the phone by SMS. Only the email is verified.
* Letting a code create an account on its own.

---

## Architecture

### 1. The rules — `convex/lib/signupRules.ts` (new)

A pure module with no imports, so the client can bundle it too.

```ts
export const GMAIL_DOMAIN = "gmail.com";
export const PHONE_DIGIT_COUNT = 11;

export function isGmailAddress(email: string): boolean;
export function isValidPhone(phone: string): boolean;
export function normaliseEmail(email: string): string;
export function normalisePhone(phone: string): string;   // "09171234567" → "+639171234567"
```

### 2. The code — `convex/lib/otp.ts` (new)

```ts
export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const MAX_OTP_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60 * 1000;

export function generateOtpCode(): string;             // crypto.getRandomValues, no modulo bias
export async function hashOtp(code: string, salt: string): Promise<string>;
export async function newOtpSalt(): Promise<string>;
```

### 3. The mail — `convex/lib/email.ts` (new)

The same shape as `convex/lib/payments.ts`: the app talks to a provider and
never to a gateway.

```ts
export interface EmailMessage { subject: string; text: string; to: string; }
export interface EmailProvider { name: string; send(message: EmailMessage): Promise<void>; }
export const consoleEmailProvider: EmailProvider;
export function emailProvider(): EmailProvider;
```

### 4. The pending sign-up — `convex/signupCodes.ts` (new) and the schema

```ts
signupCodes: defineTable({
  email: v.string(),
  phone: v.string(),
  name: v.string(),
  role: v.union(v.literal("commuter"), v.literal("operator")),
  passwordHash: v.string(),
  licenseNumber: v.optional(v.string()),
  vehicleInfo: v.optional(v.object({ … })),
  codeHash: v.string(),
  salt: v.string(),
  attempts: v.number(),
  expiresAt: v.number(),
  usedAt: v.optional(v.number()),
  createdAt: v.number(),
}).index("by_email", ["email"]);
```

`users` gains `emailVerifiedAt: v.optional(v.number())`.

The store holds the whole pending sign-up, so the account can be created from
it without the client having to send the details — or the password — a second
time.

### 5. The public surface — `convex/auth.ts`

| Function | Kind | What it does |
|---|---|---|
| `requestSignupCode` | **action** | Validates the rules, checks the email and phone are free, hashes the password, generates and stores the code, and **sends the email** |
| `verifySignupCode` | **mutation** | Verifies the code, then creates the account, the profile and the session — in one transaction |
| `signup` | — | **Removed.** A public way to create an account without a code is exactly what this change closes. |

Both are the only ways into the account table.

### 6. The account creation — `convex/lib/signupAccount.ts` (new)

The body of the old `signup` mutation, extracted into a plain helper so
`verifySignupCode` can call it without a self-reference in the type graph.

### 7. The client — `src/app/signup/page.tsx`

The machine gains a **code** step:

```
Passenger:  details → 📧 code → 📜 terms → [account] → 📍 location → submitted
Driver:     details → vehicle → 📧 code → 📜 terms → [account] → 📍 location → documents → submitted
```

The code step shows the address it went to, a six-box input, a resend button
with a cooldown, and the attempts remaining. The terms dialog still opens
**right before the account is created**.

---

## Work Breakdown

### Wave 1 — The rules and the pieces ✅

| # | Task | File |
|---|---|---|
| 1.1 | The Gmail and phone rules | `convex/lib/signupRules.ts` (new) |
| 1.2 | The code: generation, hashing, expiry, attempts | `convex/lib/otp.ts` (new) |
| 1.3 | The email provider seam | `convex/lib/email.ts` (new) |
| 1.4 | The pending sign-up table, and `users.emailVerifiedAt` | `convex/schema.ts` |
| 1.5 | The internal store, and the sandbox mailbox | `convex/signupCodes.ts` (new) |

### Wave 2 — The server ✅

| # | Task | File |
|---|---|---|
| 2.1 | `requestSignupCode` — validate, store, send | `convex/auth.ts` |
| 2.2 | `verifySignupCode` — verify, create the account | `convex/auth.ts` |
| 2.3 | The account creation, extracted | `convex/lib/signupAccount.ts` (new) |
| 2.4 | The public `signup` removed | `convex/auth.ts` |

### Wave 3 — The client ✅

| # | Task | File |
|---|---|---|
| 3.1 | The code step: the input, the resend, the errors | `src/app/signup/page.tsx` |
| 3.2 | The client wrapper: request, then verify | `src/lib/authContext.tsx` |
| 3.3 | The rules checked as the user types | `src/app/signup/page.tsx` |

### Wave 4 — Verification ✅

| # | Task | File |
|---|---|---|
| 4.1 | The rules, the code, and the flow | `tests/signupOtp.test.ts` (new) |
| 4.2 | The server refuses a signup without a code | `tests/convex/signupOtp.test.ts` (new) |
| 4.3 | The seeded test accounts are unaffected | `tests/convex/signupOtp.test.ts` |

### Wave 5 — Release ✅

| # | Task | File |
|---|---|---|
| 5.1 | The verification run | — |
| 5.2 | The Android app is rebuilt and synced | `npm run mobile:build` |

---

## Test Plan

| # | Assertion |
|---|---|
| T1 | A Gmail address is accepted and another domain is not. |
| T2 | A malformed address is not accepted, even a Gmail one. |
| T3 | Eleven digits starting `09` is accepted; ten, twelve and a different prefix are not. |
| T4 | The phone is stored as `+63` and the last ten digits. |
| T5 | The client and the server agree on the rules. |
| T6 | A code is six digits and two codes are not the same. |
| T7 | A code is not stored in the clear. |
| T8 | A request for a code is refused for a non-Gmail address. |
| T9 | A request for a code is refused for a bad phone number. |
| T10 | A request for a code is refused when the email is already taken. |
| T11 | A request for a code stores a hashed code with an expiry. |
| T12 | The wrong code does not create an account. |
| T13 | An expired code does not create an account. |
| T14 | A code past the attempt limit does not create an account. |
| T15 | The right code creates the account, and the account is marked verified. |
| T16 | A code cannot be used twice. |
| T17 | There is no public way to create an account without a code. |
| T18 | The seeded test accounts are created without meeting the new rules. |

---

## Verification

```bash
npm run typecheck        # tsc --noEmit
npm run check            # ultracite check
npm test                 # vitest run
npm run build            # next build
npm run mobile:build     # next build && cap sync
```

**Before:** `tsc` 0 errors · `ultracite check` 0 errors · 158 tests passing.
**After:** `tsc` 0 errors · `ultracite check` 0 errors · **171** tests passing ·
`next build` OK · `npm run mobile:build` OK.

### On a device

1. Sign up with a non-Gmail address → *"Use a Gmail address (you@gmail.com)."*
2. Sign up with a ten-digit number → *"Enter your 11-digit mobile number."*
3. Sign up with a Gmail address and an eleven-digit number → the code is sent
   and the code step appears.
4. Enter the wrong code → *"That code is not right. 5 attempts left."*
5. Enter the right code → the terms dialog opens → accept → the account is
   created → the location step.

---

## Risk

| Risk | Mitigation |
|---|---|
| The existing test accounts are locked out | The rules live in the sign-up path only. A test asserts the seed still produces accounts that do not meet them. |
| A code is guessed | Six digits, hashed, a ten-minute expiry, five attempts, and a resend cooldown. |
| A code creates an account on its own | The verification and the creation are one mutation. |
| The public `auth.signup` is still a way in | It is removed, and a test asserts there is no public way to create an account without a code. |
| The email never arrives | The code is in the server log, and the sandbox mailbox shows it in the app when `SIGNUP_SANDBOX=1`. |
| The code is read out of the database | It is stored hashed, with a per-code salt. |
| A resend flood | A sixty-second cooldown per email, and the old codes are invalidated. |
| The rules drift between the client and the server | One module, imported by both. |
