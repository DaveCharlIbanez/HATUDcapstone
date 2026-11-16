# Real Email Delivery for Sign-Up Codes — Implementation Plan

**Log ID:** `fixoct51`
**Created:** 2026-11-14
**Status:** ⬜ Planned — waiting on two decisions (see the end of this file)
**Previous:** [`FIXOCT50.md`](../FIXOCT50.md) (`fixoct50`), [`docs/signup-otp-plan.md`](signup-otp-plan.md) (`fixoct34`)

---

## Goal

- **Existing accounts keep working, unchanged.** No backfill, no re-verification.
- **Every new account needs an email address that really receives mail.** That is proven by a one-time code actually delivered to that inbox.
- **It has to work before the system is hosted.**

---

## What already exists (from `fixoct34`)

| Piece | Where | Status |
|---|---|---|
| Two-step sign-up: request a code, then verify and create the account in one transaction | `convex/auth.ts` (`requestSignupCode`, `verifySignupCode`) | ✅ |
| Hashed, salted, 6-digit code: 10-minute lifetime, 5 attempts, 60-second resend wait | `convex/lib/otp.ts`, `convex/signupCodes.ts` | ✅ |
| Gmail-only, well-formed address, checked on the server | `convex/lib/signupRules.ts` | ✅ |
| `users.emailVerifiedAt` is optional, and login never checks it | `convex/schema.ts`, `convex/auth.ts` | ✅ |
| A mail seam, so the provider can be swapped | `convex/lib/email.ts` (`EmailProvider`) | ✅ |
| Only sign-up and the seed create users, and the profile can't change the email | `convex/lib/signupAccount.ts`, `convex/seed.ts`, `convex/profile.ts` | ✅ |

---

## The gap

| # | Problem | Detail |
|---|---|---|
| 1 | No email is ever sent | `emailProvider()` always returns `consoleEmailProvider`, so the code only goes to the server log |
| 2 | The sandbox shows the code on screen | `SIGNUP_SANDBOX=1` is on in the dev deployment, so `signupCodes.sandboxCodeForEmail` gives the code to the sign-up page |
| 3 | So any made-up address passes | `fake123@gmail.com` can register, because the code never has to leave the server |

---

## Why "not hosted yet" doesn't block this

- The Convex backend already runs in Convex's cloud, and actions can call outside services. Sending email needs no hosted frontend.
- The real constraint is **having no domain of our own**. Resend, SendGrid and similar services only deliver to arbitrary people once you verify a domain you own.

### Provider choice

| Option | Domain needed | Free volume | Inbox placement | Runtime |
|---|---|---|---|---|
| **Gmail SMTP with an app password** (recommended) | No | ~500/day | Good: it's real Gmail mail | `"use node"` + `nodemailer` |
| Brevo, with a single verified sender | No | 300/day | Weaker: a `@gmail.com` sender sent through another service can be flagged | `fetch` (default runtime) |
| Resend / SendGrid | **Yes** | 3,000+/month | Best, once a domain is set up | `fetch` |

**Decision:** Gmail SMTP now. Move to Resend later if a domain is bought; the seam makes that a single change.

---

## Steps

### 1. Sending account (manual)
- Create or choose a dedicated Gmail account, e.g. `hatud.app@gmail.com`, not a personal one.
- Turn on 2-step verification, then generate an **app password** (Google Account → Security → App passwords).

### 2. Deployment secrets
```
npx convex env set EMAIL_PROVIDER gmail
npx convex env set GMAIL_USER hatud.app@gmail.com
npx convex env set GMAIL_APP_PASSWORD "<16-character app password>"
```
They live only on the deployment, never in the repo or the APK.

### 3. The Node sender — `convex/emailNode.ts` (new)
- `"use node"`, and one `internalAction` named `sendViaGmail({ to, subject, text })` that uses `nodemailer` (`smtp.gmail.com:465`, secure).
- A separate file because `auth.ts` holds mutations and can't use the Node runtime.
- Add `nodemailer` and `@types/nodemailer` to `package.json`.

### 4. Choosing the sender — `convex/lib/email.ts`
- `emailProvider()` reads `EMAIL_PROVIDER`:
  - `gmail`, with `GMAIL_USER` and `GMAIL_APP_PASSWORD` set → the Gmail provider (it calls `internal.emailNode.sendViaGmail` through the action context).
  - unset → `consoleEmailProvider`, as now. Tests and offline work are unchanged.
  - `gmail` with a missing credential → a clear configuration error, not a silent fallback to the console.
- The provider takes the action `ctx`, because only an action can call another action.

### 5. Fail loudly — `convex/auth.ts` (`requestSignupCode`)
- Wrap the send. If it throws, spend the pending code (`signupCodes.markUsed`) and throw **"We couldn't send the code. Try again in a minute."**
- Never leave someone waiting for a code that wasn't sent.
- Decide whether a failed send should reset the 60-second resend wait. (Proposed: yes, so they can retry straight away.)

### 6. Close the shortcut — `convex/signupCodes.ts`
- `sandboxEnabled()` returns `false` whenever a real provider is configured, even if `SIGNUP_SANDBOX=1`. Then `sandboxCode` is never stored and `sandboxCodeForEmail` returns `null`.
- After real delivery is confirmed: `npx convex env remove SIGNUP_SANDBOX`.

### 7. Protect the existing accounts
- No migration, no backfill, and no `emailVerifiedAt` check at login. A missing `emailVerifiedAt` **is** the grandfather marker.
- New test: a user without `emailVerifiedAt` logs in successfully. Together with the existing seed-exemption test, this locks the guarantee in.

### 8. Tests — `tests/convex/`
| Test | Asserts |
|---|---|
| Choosing the sender | unset → console; `gmail` + credentials → Gmail; `gmail` with a missing credential → error |
| Send failure | a failed send spends the code and returns the friendly error, and no account can be verified from it |
| No sandbox with a real sender | with a real sender on and `SIGNUP_SANDBOX=1`, `sandboxCodeForEmail` returns `null` and no plaintext code is stored |
| Existing-account login | an account without `emailVerifiedAt` logs in |
| Existing behaviour | the current OTP tests still pass |

The Gmail action itself is mocked in tests; no real email is sent during `vitest`.

### 9. Rollout
1. `tsc`, `ultracite check`, `vitest`, `next build`.
2. `npx convex dev --once` to push to dev.
3. Sign up with a real Gmail address; confirm the code arrives and the account is created.
4. Confirm a made-up address now cannot finish sign-up.
5. Log in with a seeded account (e.g. `commuter1@hatud.com`) to confirm the exemption.
6. Remove `SIGNUP_SANDBOX`.
7. **APK:** no rebuild expected. The change is server-only, and the sign-up screen already hides the sandbox panel when it gets `null`. Check this on the phone.

### 10. When the system is hosted
- Set the same three secrets on the **production** deployment.
- If a domain is bought: add a `resendProvider` (plain `fetch`, no Node) and switch `EMAIL_PROVIDER=resend`.

---

## Files touched

| File | Change |
|---|---|
| `convex/emailNode.ts` (new) | Gmail SMTP sender (`"use node"`) |
| `convex/lib/email.ts` | Choose the provider from the environment; the provider takes the action context |
| `convex/auth.ts` | Send failure spends the code and returns a friendly error |
| `convex/signupCodes.ts` | The sandbox is refused while a real sender is configured |
| `package.json` | `nodemailer`, `@types/nodemailer` |
| `tests/convex/*` | The tests listed in step 8 |
| `docs/tech-stack-and-architecture.md` | §3.5: the email seam now has a Gmail implementation |

---

## Open decisions

1. **Keep Gmail-only?** With real delivery, any address that receives mail proves itself. Relaxing to any domain (school, Yahoo, Outlook) would mean swapping `isGmailAddress` for a plain format check. Recommendation: relax it.
2. **Which Gmail account sends the codes?** Recommendation: a dedicated project account.
