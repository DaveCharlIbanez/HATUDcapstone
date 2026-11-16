import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { expect, test } from "vitest";

/**
 * The shipped Android build, against the server it talks to.
 *
 * An APK carries the web code as bundled assets, so the screens inside it are
 * frozen at build time and cannot be changed. What it *can* do is call the
 * server — and `fixoct38` made three of the calls it makes fail, which is
 * how the old build ended up unable to book a ride at all.
 *
 * This test reads the shipped artifact itself, lists every Convex function
 * it calls, and asserts that each one is still a public function on the
 * server. It is the check that would have caught the break before it shipped.
 *
 * The *shape* of the arguments is checked in `tests/convex/legacyClients.test.ts`,
 * which calls the real functions the way the old build does.
 */

/** The APK at the repository root. */
const APK_PATH = join(process.cwd(), "HATUD-v1.2-debug.apk");

/** The generated API map, which names every module the client can reach. */
const API_DECLARATION = join(process.cwd(), "convex", "_generated", "api.d.ts");

/**
 * A ZIP entry, located through the central directory.
 */
interface ZipEntry {
  compressionMethod: number;
  localHeaderOffset: number;
  name: string;
}

const EOCD_SIGNATURE = 0x06_05_4b_50;
const CENTRAL_SIGNATURE = 0x02_01_4b_50;
const LOCAL_SIGNATURE = 0x04_03_4b_50;

/**
 * Finds the end-of-central-directory record.
 *
 * It is at the end of the file, after the comment, so it is searched for
 * backwards. The comment is the only thing that can follow it.
 */
function findEndOfCentralDirectory(buffer: Buffer): number {
  const earliest = Math.max(0, buffer.length - 0xff_ff - 22);
  for (let offset = buffer.length - 22; offset >= earliest; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      return offset;
    }
  }
  throw new Error("The APK is not a readable zip archive");
}

/**
 * The entries of a zip archive, read through its central directory.
 */
function readZipEntries(buffer: Buffer): ZipEntry[] {
  const eocd = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  const entries: ZipEntry[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      throw new Error("The APK's central directory is malformed");
    }
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString("utf8");

    entries.push({ compressionMethod, localHeaderOffset, name });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/**
 * The contents of one zip entry.
 */
function readZipFile(buffer: Buffer, entry: ZipEntry): Buffer {
  const header = entry.localHeaderOffset;
  if (buffer.readUInt32LE(header) !== LOCAL_SIGNATURE) {
    throw new Error(`The local header for ${entry.name} is malformed`);
  }
  const nameLength = buffer.readUInt16LE(header + 26);
  const extraLength = buffer.readUInt16LE(header + 28);
  const start = header + 30 + nameLength + extraLength;
  const compressed = buffer.subarray(start);

  if (entry.compressionMethod === 0) {
    return compressed;
  }
  if (entry.compressionMethod !== 8) {
    throw new Error(
      `Unsupported compression method ${entry.compressionMethod} for ${entry.name}`
    );
  }
  return inflateRawSync(compressed);
}

/**
 * Every Convex function the shipped bundle calls.
 *
 * The bundle is minified, but the property accesses survive: `api.rides.create`
 * is in there verbatim.
 */
function apiCallsInApk(): Set<string> {
  const buffer = readFileSync(APK_PATH);
  const calls = new Set<string>();

  for (const entry of readZipEntries(buffer)) {
    if (!entry.name.startsWith("assets/public/_next/static/")) {
      continue;
    }
    if (!entry.name.endsWith(".js")) {
      continue;
    }
    const source = readZipFile(buffer, entry).toString("utf8");
    const pattern =
      /\bapi\.([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)/g;
    for (const match of source.matchAll(pattern)) {
      calls.add(`${match[1]}.${match[2]}`);
    }
  }
  return calls;
}

/**
 * The public functions of every module, read from the server's own source.
 */
function publicFunctions(): Map<string, Set<string>> {
  const declaration = readFileSync(API_DECLARATION, "utf8");

  // The generated map names the modules: `import type * as lib_fare from
  // "../lib/fare.js"` is the module "lib/fare".
  const modules = new Map<string, string>();
  const modulePattern = /import type \* as \w+ from "\.\.\/(.+)\.js";/g;
  for (const match of declaration.matchAll(modulePattern)) {
    const module = match[1];
    if (module) {
      modules.set(module, module);
    }
  }

  const functions = new Map<string, Set<string>>();
  for (const module of modules.keys()) {
    const file = join(process.cwd(), "convex", `${module}.ts`);
    if (!existsSync(file)) {
      continue;
    }
    const source = readFileSync(file, "utf8");
    const names = new Set<string>();
    const functionPattern = /export const (\w+) = (query|mutation|action)\(/g;
    for (const match of source.matchAll(functionPattern)) {
      const name = match[1];
      if (name) {
        names.add(name);
      }
    }
    functions.set(module, names);
  }
  return functions;
}

/**
 * The modules the client can reach, as the generated map declares them.
 */
function clientModules(): Set<string> {
  const declaration = readFileSync(API_DECLARATION, "utf8");
  const modules = new Set<string>();
  const modulePattern = /import type \* as \w+ from "\.\.\/(.+)\.js";/g;
  for (const match of declaration.matchAll(modulePattern)) {
    const module = match[1];
    if (module) {
      modules.add(module);
    }
  }
  return modules;
}

const apkExists = existsSync(APK_PATH);

test.skipIf(!apkExists)(
  "every Convex function the shipped Android build calls is still on the server",
  () => {
    const calls = apiCallsInApk();
    expect(calls.size).toBeGreaterThan(0);

    const modules = clientModules();
    const functions = publicFunctions();
    const missing: string[] = [];

    for (const call of calls) {
      const separator = call.indexOf(".");
      const module = call.slice(0, separator);
      const fn = call.slice(separator + 1);
      // A module the client cannot reach anyway is not a break.
      if (!modules.has(module)) {
        continue;
      }
      const available = functions.get(module);
      if (!available?.has(fn)) {
        missing.push(call);
      }
    }

    expect(missing).toEqual([]);
  }
);

test.skipIf(!apkExists)(
  "the shipped Android build calls the functions this fix depends on",
  () => {
    const calls = apiCallsInApk();

    // The three calls that `fixoct38` broke. Each one has to still be there
    // for the compatibility window to mean anything.
    expect(calls.has("rides.create")).toBe(true);
    expect(calls.has("rides.updateStatus")).toBe(true);
    expect(calls.has("rides.complete")).toBe(true);
    expect(calls.has("payments.charge")).toBe(true);

    // And the old build cannot send a payment method — which is the whole
    // reason `paymentMethod` is optional on the booking.
    expect(calls.has("paymentMethod")).toBe(false);
  }
);

test("the compatibility window is documented where it will be found", () => {
  const legacy = join(process.cwd(), "convex", "lib", "legacyClients.ts");
  expect(existsSync(legacy)).toBe(true);

  const source = readFileSync(legacy, "utf8");
  // The cutover is a checklist, not a comment somebody has to remember.
  expect(source).toContain("Cutover checklist");
  expect(source).toContain("TEMPORARY");
});
