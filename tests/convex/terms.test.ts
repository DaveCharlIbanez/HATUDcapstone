import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { createTest, signUp } from "./helpers";

/**
 * The terms, on the server.
 *
 * The tick box on the client is a courtesy. This is the control: an account
 * is only created once the acceptance has been recorded.
 */

test("a signup without the acceptance is refused", async () => {
  const t = createTest();

  await expect(signUp(t, { acceptedTerms: false })).rejects.toThrow(
    "You must accept the Terms and Conditions"
  );

  // Nothing was created.
  const users = await t.run(
    async (ctx) => await ctx.db.query("users").collect()
  );
  expect(users.length).toBe(0);
});

test("a signup with the acceptance records it and the version", async () => {
  const t = createTest();

  const result = await signUp(t);
  expect(result.sessionToken).toBeTruthy();

  const user = await t.run(async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.at(0);
  });

  expect(user?.acceptedTermsAt).toBeGreaterThan(0);
  expect(user?.acceptedTermsVersion).toBe("1.0");
  // The address was verified with a code, so the account knows it.
  expect(user?.emailVerifiedAt).toBeGreaterThan(0);
});

test("a driver has to accept the terms too", async () => {
  const t = createTest();

  await expect(
    signUp(t, {
      acceptedTerms: false,
      email: "driver.terms@gmail.com",
      phone: "09171234568",
      role: "operator",
    })
  ).rejects.toThrow("You must accept the Terms and Conditions");
});

test("an acceptance cannot be recorded without saying which version", async () => {
  const t = createTest();

  await expect(
    t.mutation(api.auth.verifySignupCode, {
      acceptedTerms: true,
      acceptedTermsVersion: undefined,
      code: "123456",
      email: "no.version@gmail.com",
    } as unknown as {
      acceptedTerms: boolean;
      acceptedTermsVersion: string;
      code: string;
      email: string;
    })
  ).rejects.toThrow();
});
