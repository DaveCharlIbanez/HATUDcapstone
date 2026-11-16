/**
 * The mail seam.
 *
 * The app talks to an `EmailProvider` and never to a mail service directly,
 * so a real provider can replace the console one without touching the
 * sign-up flow. The payment side works the same way, in `lib/payments.ts`.
 */

export interface EmailMessage {
  subject: string;
  text: string;
  to: string;
}

export interface EmailProvider {
  name: string;
  send(message: EmailMessage): Promise<void>;
}

/**
 * The provider used when no real one is configured.
 *
 * The code is written to the server log, which is where it is read from when
 * the sandbox mailbox is off.
 */
export const consoleEmailProvider: EmailProvider = {
  name: "console",
  send(message) {
    console.log(`[email:${message.to}] ${message.subject}\n${message.text}`);
    return Promise.resolve();
  },
};

/**
 * The provider to use.
 *
 * A real provider is selected by an environment variable, exactly like the
 * payment provider. Until one is configured, the code goes to the log.
 */
export function emailProvider(): EmailProvider {
  return consoleEmailProvider;
}

/**
 * The message that carries a sign-up code.
 */
export function otpEmailMessage(input: {
  code: string;
  name: string;
  to: string;
  validMinutes: number;
}): EmailMessage {
  return {
    subject: "Your HATUD verification code",
    text: [
      `Hello ${input.name},`,
      "",
      "Here is your HATUD verification code:",
      "",
      `    ${input.code}`,
      "",
      `It is good for ${input.validMinutes} minutes. If you did not ask to create a HATUD account, you can ignore this message.`,
      "",
      "HATUD: A Kinaray-a Ride-Booking Hub",
    ].join("\n"),
    to: input.to,
  };
}
