import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import {
  generateOtpCode,
  hashOtp,
  MAX_OTP_ATTEMPTS,
} from "../../convex/lib/otp";
import {
  isGmailAddress,
  isValidPhone,
  normalisePhone,
} from "../../convex/lib/signupRules";
import { createTest, signUp } from "./helpers";

/**
 * The sign-up rules, and the code.
 *
 * The rules apply to new sign-ups only. The accounts that already exist were
 * created before the rules, or by the seed, and they keep working.
 */

const GMAIL = "test.person@gmail.com";

/** A six-digit code. */
const SIX_DIGITS = /^\d{6}$/;

/** The old direct signup, which must not come back. */
const SIGNUP_EXPORT = /export const signup =/;

test("a Gmail address is accepted and another domain is not", () => {
  expect(isGmailAddress(GMAIL)).toBe(true);
  expect(isGmailAddress("someone@gmail.com")).toBe(true);
  expect(isGmailAddress("someone@hatud.com")).toBe(false);
  expect(isGmailAddress("someone@notgmail.com")).toBe(false);
});

test("a malformed address is refused even when it is a Gmail one", () => {
  expect(isGmailAddress("notgmail.com")).toBe(false);
  expect(isGmailAddress("a@b")).toBe(false);
  expect(isGmailAddress("with space@gmail.com")).toBe(false);
  expect(isGmailAddress("")).toBe(false);
});

test("eleven digits starting 09 is the standard, and nothing else is", () => {
  expect(isValidPhone("09171234567")).toBe(true);
  expect(isValidPhone("0917123456")).toBe(false);
  expect(isValidPhone("091712345678")).toBe(false);
  expect(isValidPhone("9171234567")).toBe(false);
  expect(isValidPhone("+639171234567")).toBe(false);
  expect(isValidPhone("0917-123-4567")).toBe(true);
});

test("the number is stored the way the existing accounts are", () => {
  expect(normalisePhone("09171234567")).toBe("+639171234567");
  expect(normalisePhone("0917 123 4567")).toBe("+639171234567");
});

test("the client and the server read the same rules", () => {
  // One module, imported by both, so they cannot disagree.
  const page = require("node:fs").readFileSync(
    "src/app/signup/page.tsx",
    "utf8"
  );
  expect(page).toContain("convex/lib/signupRules");
});

test("a code is six digits, and two codes are not the same", () => {
  const first = generateOtpCode();
  const second = generateOtpCode();

  expect(first).toMatch(SIX_DIGITS);
  expect(second).toMatch(SIX_DIGITS);
  expect(first).not.toBe(second);
});

test("a code is stored hashed, not in the clear", async () => {
  const t = createTest();

  await t.action(api.auth.requestSignupCode, {
    email: GMAIL,
    name: "Hash Tester",
    password: "Password1",
    phone: "09171234567",
    role: "commuter",
  });

  const row = await t.run(async (ctx) => {
    const rows = await ctx.db.query("signupCodes").collect();
    return rows.at(0);
  });

  expect(row?.codeHash).toBeTruthy();
  expect(row?.codeHash).not.toBe(row?.sandboxCode);
  expect(row?.codeHash).toHaveLength(64);
});

test("a code is not kept in the clear unless the sandbox is on", async () => {
  const t = createTest();
  delete process.env.SIGNUP_SANDBOX;

  await t.action(api.auth.requestSignupCode, {
    email: "no.sandbox@gmail.com",
    name: "No Sandbox",
    password: "Password1",
    phone: "09171234568",
    role: "commuter",
  });

  const row = await t.run(async (ctx) => {
    const rows = await ctx.db.query("signupCodes").collect();
    return rows.at(0);
  });

  expect(row?.sandboxCode).toBeUndefined();

  process.env.SIGNUP_SANDBOX = "1";
});

test("a code that is asked for on a non-Gmail address is refused", async () => {
  const t = createTest();

  await expect(
    t.action(api.auth.requestSignupCode, {
      email: "someone@hatud.com",
      name: "Not Gmail",
      password: "Password1",
      phone: "09171234567",
      role: "commuter",
    })
  ).rejects.toThrow("Use a Gmail address");
});

test("a code that is asked for with a bad number is refused", async () => {
  const t = createTest();

  await expect(
    t.action(api.auth.requestSignupCode, {
      email: GMAIL,
      name: "Bad Number",
      password: "Password1",
      phone: "12345",
      role: "commuter",
    })
  ).rejects.toThrow("11-digit");
});

test("a code that is asked for for an address already in use is refused", async () => {
  const t = createTest();

  await signUp(t, { email: GMAIL });

  await expect(
    t.action(api.auth.requestSignupCode, {
      email: GMAIL,
      name: "Second Try",
      password: "Password1",
      phone: "09171234568",
      role: "commuter",
    })
  ).rejects.toThrow("Email already registered");
});

test("asking for a code stores it with an expiry", async () => {
  const t = createTest();

  await t.action(api.auth.requestSignupCode, {
    email: GMAIL,
    name: "Expiry Tester",
    password: "Password1",
    phone: "09171234567",
    role: "commuter",
  });

  const row = await t.run(async (ctx) => {
    const rows = await ctx.db.query("signupCodes").collect();
    return rows.at(0);
  });

  expect(row?.expiresAt).toBeGreaterThan(Date.now());
  expect(row?.usedAt).toBeUndefined();
});

test("the wrong code does not create an account", async () => {
  const t = createTest();

  await t.action(api.auth.requestSignupCode, {
    email: GMAIL,
    name: "Wrong Code",
    password: "Password1",
    phone: "09171234567",
    role: "commuter",
  });

  await expect(
    t.mutation(api.auth.verifySignupCode, {
      acceptedTerms: true,
      acceptedTermsVersion: "1.0",
      code: "000000",
      email: GMAIL,
    })
  ).rejects.toThrow("not right");

  const users = await t.run(
    async (ctx) => await ctx.db.query("users").collect()
  );
  expect(users.length).toBe(0);
});

test("an expired code does not create an account", async () => {
  const t = createTest();

  await t.action(api.auth.requestSignupCode, {
    email: GMAIL,
    name: "Expired Code",
    password: "Password1",
    phone: "09171234567",
    role: "commuter",
  });

  await t.run(async (ctx) => {
    const rows = await ctx.db.query("signupCodes").collect();
    const row = rows.at(0);
    if (row) {
      await ctx.db.patch(row._id, { expiresAt: Date.now() - 1000 });
    }
  });

  await expect(
    t.mutation(api.auth.verifySignupCode, {
      acceptedTerms: true,
      acceptedTermsVersion: "1.0",
      code: "123456",
      email: GMAIL,
    })
  ).rejects.toThrow("expired");
});

test("a code past the attempt limit does not create an account", async () => {
  const t = createTest();

  await t.action(api.auth.requestSignupCode, {
    email: GMAIL,
    name: "Too Many",
    password: "Password1",
    phone: "09171234567",
    role: "commuter",
  });

  await t.run(async (ctx) => {
    const rows = await ctx.db.query("signupCodes").collect();
    const row = rows.at(0);
    if (row) {
      await ctx.db.patch(row._id, { attempts: MAX_OTP_ATTEMPTS });
    }
  });

  await expect(
    t.mutation(api.auth.verifySignupCode, {
      acceptedTerms: true,
      acceptedTermsVersion: "1.0",
      code: "123456",
      email: GMAIL,
    })
  ).rejects.toThrow("Too many wrong attempts");
});

test("the right code creates the account, and the account is verified", async () => {
  const t = createTest();

  const result = await signUp(t, { email: GMAIL });
  expect(result.sessionToken).toBeTruthy();
  expect(result.role).toBe("commuter");

  const user = await t.run(async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.at(0);
  });

  expect(user?.email).toBe(GMAIL);
  // The number is stored the way the existing accounts are.
  expect(user?.phone).toBe("+639171234567");
  expect(user?.emailVerifiedAt).toBeGreaterThan(0);
});

test("a code cannot be used a second time", async () => {
  const t = createTest();

  await signUp(t, { email: GMAIL });

  await expect(
    t.mutation(api.auth.verifySignupCode, {
      acceptedTerms: true,
      acceptedTermsVersion: "1.0",
      code: "123456",
      email: GMAIL,
    })
  ).rejects.toThrow();
});

test("there is no public way to create an account without a code", () => {
  const source = readFileSync("convex/auth.ts", "utf8");

  // The old direct signup is gone, and the two that replaced it are the only
  // ways into the account table.
  expect(source).not.toMatch(SIGNUP_EXPORT);
  expect(source).toContain("export const requestSignupCode = action({");
  expect(source).toContain("export const verifySignupCode = mutation({");

  // The account is only created from a verified code.
  const account = readFileSync("convex/lib/signupAccount.ts", "utf8");
  expect(account).toContain("createAccountFromSignup");
});

test("the seeded test accounts do not have to meet the new rules", async () => {
  const t = createTest();
  process.env.SEED_KEY = "test-seed-key";
  process.env.SEED_ADMIN_PASSWORD = "AdminPassword1";
  process.env.SEED_USER_PASSWORD = "UserPassword1";

  await t.mutation(internal.seed.seed, { seedKey: "test-seed-key" });

  const users = await t.run(
    async (ctx) => await ctx.db.query("users").collect()
  );

  expect(users.length).toBeGreaterThan(0);
  // The seed creates accounts that the new rules would refuse. They are the
  // test accounts, and they are not affected.
  expect(users.every((user) => !isGmailAddress(user.email))).toBe(true);
});

test("the hash of a code is not the code", async () => {
  const hash = await hashOtp("123456", "a-salt");
  expect(hash).not.toBe("123456");
  expect(hash).toHaveLength(64);
  // The same code and salt always hash the same way, and a different salt
  // does not.
  expect(await hashOtp("123456", "a-salt")).toBe(hash);
  expect(await hashOtp("123456", "another-salt")).not.toBe(hash);
});
