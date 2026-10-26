import { expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { detectImageType } from "../../convex/lib/imageType";
import { createTest, seedAccount } from "./helpers";

// The leading bytes of a real PNG, a real JPEG and a PDF that has been
// renamed to look like an image.
const PNG_BYTES: Uint8Array<ArrayBuffer> = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const JPEG_BYTES: Uint8Array<ArrayBuffer> = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);
const PDF_BYTES: Uint8Array<ArrayBuffer> = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xe2, 0xe3,
]);

async function storeFile(
  t: ReturnType<typeof createTest>,
  bytes: Uint8Array<ArrayBuffer>,
  type: string
): Promise<string> {
  return await t.run(async (ctx) => {
    const id = await ctx.storage.store(new Blob([bytes], { type }));
    return String(id);
  });
}

test("the image detector recognises PNG and JPEG and nothing else", () => {
  expect(detectImageType(PNG_BYTES)).toBe("image/png");
  expect(detectImageType(JPEG_BYTES)).toBe("image/jpeg");
  expect(detectImageType(PDF_BYTES)).toBeNull();
  expect(detectImageType(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull();
  expect(detectImageType(new Uint8Array([0x89]))).toBeNull();
});

test("a driver can register a document and read it back", async () => {
  const t = createTest();
  const driver = await seedAccount(t, {
    email: "docs-driver@example.com",
    name: "Docs Driver",
    phone: "+639000000501",
    role: "operator",
  });
  await t.run(async (ctx) => {
    await ctx.db.patch(driver.operatorId, { approvalStatus: "pending" });
  });

  const storageId = await storeFile(t, PNG_BYTES, "image/png");
  const registered = await t.action(api.documents.registerDocument, {
    sessionToken: driver.sessionToken,
    kind: "license",
    storageId,
  });
  expect(registered.contentType).toBe("image/png");

  const mine = await t.query(api.documents.listMyDocuments, {
    sessionToken: driver.sessionToken,
  });
  expect(mine.documents).toHaveLength(1);
  expect(mine.documents[0]?.kind).toBe("license");
  expect(mine.missing).toHaveLength(3);
  expect(mine.missing).not.toContain("license");
});

test("a renamed file is rejected because the bytes are not an image", async () => {
  const t = createTest();
  const driver = await seedAccount(t, {
    email: "liar-driver@example.com",
    name: "Liar Driver",
    phone: "+639000000502",
    role: "operator",
  });
  await t.run(async (ctx) => {
    await ctx.db.patch(driver.operatorId, { approvalStatus: "pending" });
  });

  // A PDF that claims to be a PNG.
  const storageId = await storeFile(t, PDF_BYTES, "image/png");
  await expect(
    t.action(api.documents.registerDocument, {
      sessionToken: driver.sessionToken,
      kind: "insurance",
      storageId,
    })
  ).rejects.toThrow("Only PNG and JPG");
});

test("a file over the size cap is rejected", async () => {
  const t = createTest();
  const driver = await seedAccount(t, {
    email: "big-driver@example.com",
    name: "Big Driver",
    phone: "+639000000503",
    role: "operator",
  });
  await t.run(async (ctx) => {
    await ctx.db.patch(driver.operatorId, { approvalStatus: "pending" });
  });

  const oversized: Uint8Array<ArrayBuffer> = new Uint8Array(
    2 * 1024 * 1024 + 1024
  );
  oversized.set(PNG_BYTES, 0);
  const storageId = await storeFile(t, oversized, "image/png");

  await expect(
    t.action(api.documents.registerDocument, {
      sessionToken: driver.sessionToken,
      kind: "license",
      storageId,
    })
  ).rejects.toThrow("too large");
});

test("uploading a second document for the same kind replaces the first", async () => {
  const t = createTest();
  const driver = await seedAccount(t, {
    email: "replace-driver@example.com",
    name: "Replace Driver",
    phone: "+639000000504",
    role: "operator",
  });
  await t.run(async (ctx) => {
    await ctx.db.patch(driver.operatorId, { approvalStatus: "pending" });
  });

  const first = await storeFile(t, PNG_BYTES, "image/png");
  await t.action(api.documents.registerDocument, {
    sessionToken: driver.sessionToken,
    kind: "registration",
    storageId: first,
  });

  const second = await storeFile(t, JPEG_BYTES, "image/jpeg");
  await t.action(api.documents.registerDocument, {
    sessionToken: driver.sessionToken,
    kind: "registration",
    storageId: second,
  });

  const mine = await t.query(api.documents.listMyDocuments, {
    sessionToken: driver.sessionToken,
  });
  expect(mine.documents).toHaveLength(1);
  expect(mine.documents[0]?.contentType).toBe("image/jpeg");

  // The replaced file is no longer in storage.
  const stillStored = await t.run(async (ctx) =>
    ctx.db.system.get("_storage", first as Id<"_storage">)
  );
  expect(stillStored).toBeNull();
});

test("a commuter cannot upload driver credentials", async () => {
  const t = createTest();
  const commuter = await seedAccount(t, {
    email: "nosy-commuter@example.com",
    name: "Nosy Commuter",
    phone: "+639000000505",
    role: "commuter",
  });

  await expect(
    t.mutation(api.documents.generateUploadUrl, {
      sessionToken: commuter.sessionToken,
    })
  ).rejects.toThrow("only drivers");
});

test("an approved driver cannot upload anything", async () => {
  const t = createTest();
  const driver = await seedAccount(t, {
    email: "approved-driver@example.com",
    name: "Approved Driver",
    phone: "+639000000506",
    role: "operator",
  });

  await expect(
    t.mutation(api.documents.generateUploadUrl, {
      sessionToken: driver.sessionToken,
    })
  ).rejects.toThrow("already approved");
});

test("only an admin can read another driver's documents", async () => {
  const t = createTest();
  const admin = await seedAccount(t, {
    email: "docs-admin@example.com",
    name: "Docs Admin",
    phone: "+639000000507",
    role: "admin",
  });
  const driver = await seedAccount(t, {
    email: "owner-driver@example.com",
    name: "Owner Driver",
    phone: "+639000000508",
    role: "operator",
  });
  const other = await seedAccount(t, {
    email: "other-driver@example.com",
    name: "Other Driver",
    phone: "+639000000509",
    role: "operator",
  });
  await t.run(async (ctx) => {
    await ctx.db.patch(driver.operatorId, { approvalStatus: "pending" });
  });

  const storageId = await storeFile(t, PNG_BYTES, "image/png");
  const registered = await t.action(api.documents.registerDocument, {
    sessionToken: driver.sessionToken,
    kind: "license",
    storageId,
  });

  const asAdmin = await t.query(api.documents.listForOperator, {
    sessionToken: admin.sessionToken,
    operatorId: driver.operatorId,
  });
  expect(asAdmin.documents).toHaveLength(1);
  expect(asAdmin.missing).toHaveLength(3);

  const url = await t.query(api.documents.getDocumentUrl, {
    sessionToken: admin.sessionToken,
    id: registered.documentId,
  });
  expect(url.url).toContain("http");

  await expect(
    t.query(api.documents.listForOperator, {
      sessionToken: other.sessionToken,
      operatorId: driver.operatorId,
    })
  ).rejects.toThrow("Forbidden");

  await expect(
    t.query(api.documents.getDocumentUrl, {
      sessionToken: other.sessionToken,
      id: registered.documentId,
    })
  ).rejects.toThrow("Forbidden");
});

test("a driver can delete their own document but not somebody else's", async () => {
  const t = createTest();
  const driver = await seedAccount(t, {
    email: "deleter-driver@example.com",
    name: "Deleter Driver",
    phone: "+639000000510",
    role: "operator",
  });
  const other = await seedAccount(t, {
    email: "keeper-driver@example.com",
    name: "Keeper Driver",
    phone: "+639000000511",
    role: "operator",
  });
  await t.run(async (ctx) => {
    await ctx.db.patch(driver.operatorId, { approvalStatus: "pending" });
    await ctx.db.patch(other.operatorId, { approvalStatus: "pending" });
  });

  const storageId = await storeFile(t, PNG_BYTES, "image/png");
  const registered = await t.action(api.documents.registerDocument, {
    sessionToken: driver.sessionToken,
    kind: "insurance",
    storageId,
  });

  await expect(
    t.mutation(api.documents.deleteMyDocument, {
      sessionToken: other.sessionToken,
      id: registered.documentId,
    })
  ).rejects.toThrow("another driver");

  await t.mutation(api.documents.deleteMyDocument, {
    sessionToken: driver.sessionToken,
    id: registered.documentId,
  });

  const mine = await t.query(api.documents.listMyDocuments, {
    sessionToken: driver.sessionToken,
  });
  expect(mine.documents).toHaveLength(0);
});

test("a rejected application can be resubmitted once all four documents are uploaded", async () => {
  const t = createTest();
  const driver = await seedAccount(t, {
    email: "resubmit-driver@example.com",
    name: "Resubmit Driver",
    phone: "+639000000512",
    role: "operator",
  });
  await t.run(async (ctx) => {
    await ctx.db.patch(driver.operatorId, {
      approvalStatus: "rejected",
      rejectionNote: "The insurance document is unreadable",
    });
  });

  await expect(
    t.mutation(api.documents.resubmitApplication, {
      sessionToken: driver.sessionToken,
    })
  ).rejects.toThrow("all four documents");

  for (const kind of [
    "license",
    "registration",
    "officialReceipt",
    "insurance",
  ] as const) {
    const storageId = await storeFile(t, PNG_BYTES, "image/png");
    await t.action(api.documents.registerDocument, {
      sessionToken: driver.sessionToken,
      kind,
      storageId,
    });
  }

  await t.mutation(api.documents.resubmitApplication, {
    sessionToken: driver.sessionToken,
  });

  const stored = await t.run(
    async (ctx) => await ctx.db.get(driver.operatorId)
  );
  expect(stored?.approvalStatus).toBe("pending");
  expect(stored?.rejectionNote).toBeUndefined();
});

test("a driver sees their own approval status and the note they were given", async () => {
  const t = createTest();
  const driver = await seedAccount(t, {
    email: "status-driver@example.com",
    name: "Status Driver",
    phone: "+639000000515",
    role: "operator",
  });
  const admin = await seedAccount(t, {
    email: "status-admin@example.com",
    name: "Status Admin",
    phone: "+639000000516",
    role: "admin",
  });

  const pending = await t.query(api.operators.getSelf, {
    sessionToken: driver.sessionToken,
  });
  expect(pending.approvalStatus).toBe("approved");

  await t.mutation(api.admins.setOperatorApproval, {
    sessionToken: admin.sessionToken,
    id: driver.operatorId,
    approvalStatus: "rejected",
    note: "The insurance document is unreadable",
  });

  const rejected = await t.query(api.operators.getSelf, {
    sessionToken: driver.sessionToken,
  });
  expect(rejected.approvalStatus).toBe("rejected");
  expect(rejected.rejectionNote).toBe("The insurance document is unreadable");

  await t.mutation(api.admins.setOperatorApproval, {
    sessionToken: admin.sessionToken,
    id: driver.operatorId,
    approvalStatus: "approved",
  });

  const approved = await t.query(api.operators.getSelf, {
    sessionToken: driver.sessionToken,
  });
  expect(approved.approvalStatus).toBe("approved");
  expect(approved.rejectionNote).toBeNull();
});
