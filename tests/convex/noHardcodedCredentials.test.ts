// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const CONVEX_DIR = join(process.cwd(), "convex");
const SKIP_DIRS = new Set(["_generated", "node_modules"]);

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectFiles(full));
    } else if (full.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

test("no committed source file carries a default password", () => {
  // Matched as quoted literals so a phone number such as "+639123456789"
  // does not trip the check.
  const forbidden = [
    '"123456789"',
    "'123456789'",
    '"password123"',
    "'password123'",
  ];
  const offenders: string[] = [];

  for (const file of collectFiles(CONVEX_DIR)) {
    const contents = readFileSync(file, "utf8");
    for (const secret of forbidden) {
      if (contents.includes(secret)) {
        offenders.push(`${file}: ${secret}`);
      }
    }
  }

  expect(offenders).toEqual([]);
});

test("the seed module requires a deployment-provided key and password", () => {
  const seed = readFileSync(join(CONVEX_DIR, "seed.ts"), "utf8");
  expect(seed).toContain("process.env.SEED_KEY");
  expect(seed).toContain("process.env.SEED_ADMIN_PASSWORD");
  expect(seed).toContain("process.env.SEED_USER_PASSWORD");
  expect(seed).toContain("internalMutation");
});
