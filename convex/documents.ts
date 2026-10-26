import type { GenericId } from "convex/values";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { approvalStatusOf } from "./lib/approval";
import { detectImageType, IMAGE_SIGNATURE_LENGTH } from "./lib/imageType";
import { requireRole, resolveActor } from "./lib/withAuth";

/**
 * Driver credential documents.
 *
 * A driver uploads four images — licence, registration, official receipt and
 * insurance — and an admin reviews them. The files live in Convex file
 * storage; this module owns the rows that point at them and the rules about
 * who may read and write them.
 *
 * The file bytes never pass through the Convex protocol. The client asks for
 * a short-lived upload URL, posts the bytes straight to storage, and then
 * registers the resulting storage id here.
 */

export type DocumentKind =
  | "insurance"
  | "license"
  | "officialReceipt"
  | "registration";

export const DOCUMENT_KINDS: DocumentKind[] = [
  "license",
  "registration",
  "officialReceipt",
  "insurance",
];

/**
 * The largest file the server will accept, in bytes. The client downsamples
 * to a fraction of this, so the cap is a backstop rather than the rule.
 */
export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;

export interface DocumentSummary {
  _id: Doc<"operatorDocuments">["_id"];
  contentType: string;
  fileName: string | null;
  kind: DocumentKind;
  size: number;
  uploadedAt: number;
}

export interface DocumentWithUrl extends DocumentSummary {
  url: string | null;
}

export interface DocumentList {
  documents: DocumentSummary[];
  missing: DocumentKind[];
}

function summarize(document: Doc<"operatorDocuments">): DocumentSummary {
  return {
    _id: document._id,
    contentType: document.contentType,
    fileName: document.fileName ?? null,
    kind: document.kind,
    size: document.size,
    uploadedAt: document.uploadedAt,
  };
}

/**
 * Turns a stored id string into a real storage id, or null when the file is
 * no longer in storage.
 */
function resolveStorageId(
  ctx: MutationCtx | QueryCtx,
  storageId: string
): GenericId<"_storage"> | null {
  return ctx.db.system.normalizeId("_storage", storageId);
}

/**
 * The driver's own documents, plus the kinds still missing. Used by the
 * sign-up wizard and the application status screen.
 */
export const listMyDocuments = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);
    const { operatorId } = actor;
    if (!operatorId) {
      throw new Error("Forbidden: only drivers have credential documents");
    }

    const rows = await ctx.db
      .query("operatorDocuments")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", operatorId))
      .collect();

    const documents = rows.map(summarize);
    const present = new Set(documents.map((document) => document.kind));

    return {
      documents,
      missing: DOCUMENT_KINDS.filter((kind) => !present.has(kind)),
    } satisfies DocumentList;
  },
});

/**
 * A short-lived URL for uploading one file into storage.
 *
 * The caller posts the bytes to the returned URL; the response body is
 * `{ storageId }`, which is then handed to `registerDocument`.
 *
 * This is also the authorisation gate for an upload: the session has to be a
 * driver's, and an approved driver has no reason to upload anything.
 */
export const generateUploadUrl = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);
    if (!actor.operatorId) {
      throw new Error("Forbidden: only drivers can upload credentials");
    }

    const operator = await ctx.db.get(actor.operatorId);
    if (!operator) {
      throw new Error("Operator profile not found");
    }
    if (approvalStatusOf(operator) === "approved") {
      throw new Error("Forbidden: your account is already approved");
    }

    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Checks that the caller may register a document, and that the uploaded file
 * exists and is within the size cap.
 *
 * Internal: reachable only from `registerDocument`, so a client cannot write
 * a document row without going through the byte check.
 */
export const authorizeUpload = internalQuery({
  args: {
    sessionToken: v.string(),
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);
    if (!actor.operatorId) {
      throw new Error("Forbidden: only drivers can upload credentials");
    }
    const operatorId = actor.operatorId;

    const operator = await ctx.db.get(operatorId);
    if (!operator) {
      throw new Error("Operator profile not found");
    }
    if (approvalStatusOf(operator) === "approved") {
      throw new Error("Forbidden: your account is already approved");
    }

    const storageId = resolveStorageId(ctx, args.storageId);
    if (!storageId) {
      throw new Error("Upload not found — it may have expired, please retry");
    }

    const metadata = await ctx.db.system.get("_storage", storageId);
    if (!metadata) {
      throw new Error("Upload not found — it may have expired, please retry");
    }
    if (metadata.size <= 0 || metadata.size > MAX_DOCUMENT_BYTES) {
      throw new Error("That image is too large — please try a smaller one");
    }

    return { operatorId, size: metadata.size, storageId };
  },
});

/**
 * Writes the document row and removes the file it replaced.
 *
 * Internal: reachable only from `registerDocument`.
 */
export const writeDocument = internalMutation({
  args: {
    operatorId: v.id("operators"),
    kind: v.union(
      v.literal("license"),
      v.literal("registration"),
      v.literal("officialReceipt"),
      v.literal("insurance")
    ),
    storageId: v.string(),
    contentType: v.string(),
    size: v.number(),
    fileName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("operatorDocuments")
      .withIndex("by_operatorId_and_kind", (q) =>
        q.eq("operatorId", args.operatorId).eq("kind", args.kind)
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        contentType: args.contentType,
        fileName: args.fileName,
        size: args.size,
        storageId: args.storageId,
        uploadedAt: now,
        replacedCount: (existing.replacedCount ?? 0) + 1,
      });
      // The replaced file is no longer referenced by anything.
      const replaced = resolveStorageId(ctx, existing.storageId);
      if (replaced) {
        await ctx.storage.delete(replaced);
      }
      return existing._id;
    }

    return await ctx.db.insert("operatorDocuments", {
      operatorId: args.operatorId,
      kind: args.kind,
      storageId: args.storageId,
      contentType: args.contentType,
      size: args.size,
      fileName: args.fileName,
      uploadedAt: now,
      replacedCount: 0,
    });
  },
});

/**
 * Registers an uploaded file against one of the driver's document kinds.
 *
 * The file is verified from its own bytes rather than from what the client
 * claims, so a renamed file is rejected. This has to be an action: the bytes
 * of a stored file can only be read from an action, never from a mutation.
 */
export const registerDocument = action({
  args: {
    sessionToken: v.string(),
    kind: v.union(
      v.literal("license"),
      v.literal("registration"),
      v.literal("officialReceipt"),
      v.literal("insurance")
    ),
    storageId: v.string(),
    fileName: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    contentType: string;
    documentId: Doc<"operatorDocuments">["_id"];
    size: number;
  }> => {
    const authorized: {
      operatorId: Doc<"operators">["_id"];
      size: number;
      storageId: GenericId<"_storage">;
    } = await ctx.runQuery(internal.documents.authorizeUpload, {
      sessionToken: args.sessionToken,
      storageId: args.storageId,
    });

    const blob = await ctx.storage.get(authorized.storageId);
    if (!blob) {
      throw new Error("Upload not found — it may have expired, please retry");
    }

    const header = new Uint8Array(
      await blob.slice(0, IMAGE_SIGNATURE_LENGTH).arrayBuffer()
    );
    const detected = detectImageType(header);
    if (!detected) {
      // Not a PNG or a JPEG. The file is worthless, so it is not kept.
      await ctx.storage.delete(authorized.storageId);
      throw new Error("Only PNG and JPG images are accepted");
    }

    const documentId: Doc<"operatorDocuments">["_id"] = await ctx.runMutation(
      internal.documents.writeDocument,
      {
        operatorId: authorized.operatorId,
        kind: args.kind,
        storageId: args.storageId,
        contentType: detected,
        size: authorized.size,
        fileName: args.fileName,
      }
    );

    return { documentId, contentType: detected, size: authorized.size };
  },
});

/**
 * Removes one of the driver's own documents.
 */
export const deleteMyDocument = mutation({
  args: {
    sessionToken: v.string(),
    id: v.id("operatorDocuments"),
  },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);
    if (!actor.operatorId) {
      throw new Error("Forbidden: only drivers have credential documents");
    }

    const document = await ctx.db.get(args.id);
    if (!document) {
      throw new Error("Document not found");
    }
    if (document.operatorId !== actor.operatorId) {
      throw new Error("Forbidden: this document belongs to another driver");
    }

    await ctx.db.delete(args.id);
    const storageId = resolveStorageId(ctx, document.storageId);
    if (storageId) {
      await ctx.storage.delete(storageId);
    }
  },
});

/**
 * The documents one applicant uploaded, with a fresh signed URL for each.
 * Admin only.
 *
 * The URLs are signed and expire, so they are generated on demand rather
 * than stored. Re-running this query refreshes them.
 */
export const listForOperator = query({
  args: {
    sessionToken: v.string(),
    operatorId: v.id("operators"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, "admin");

    const rows = await ctx.db
      .query("operatorDocuments")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", args.operatorId))
      .collect();

    const documents: DocumentWithUrl[] = await Promise.all(
      rows.map(async (document) => {
        const storageId = resolveStorageId(ctx, document.storageId);
        const url = storageId ? await ctx.storage.getUrl(storageId) : null;
        return { ...summarize(document), url };
      })
    );
    const present = new Set(documents.map((document) => document.kind));

    return {
      documents,
      missing: DOCUMENT_KINDS.filter((kind) => !present.has(kind)),
    } satisfies { documents: DocumentWithUrl[]; missing: DocumentKind[] };
  },
});

/**
 * A fresh signed URL for one document, for the admin viewer.
 *
 * The URL is generated on demand rather than stored, so it never expires in
 * the middle of a review.
 */
export const getDocumentUrl = query({
  args: {
    sessionToken: v.string(),
    id: v.id("operatorDocuments"),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.sessionToken, "admin");

    const document = await ctx.db.get(args.id);
    if (!document) {
      throw new Error("Document not found");
    }

    const storageId = resolveStorageId(ctx, document.storageId);
    const url = storageId ? await ctx.storage.getUrl(storageId) : null;
    if (!url) {
      throw new Error("The file for this document is no longer stored");
    }

    return {
      contentType: document.contentType,
      kind: document.kind,
      url,
    };
  },
});

/**
 * The driver's own document, for the owner to see. Anyone else is refused.
 */
export const getMyDocumentUrl = query({
  args: {
    sessionToken: v.string(),
    id: v.id("operatorDocuments"),
  },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);

    const document = await ctx.db.get(args.id);
    if (!document) {
      throw new Error("Document not found");
    }

    const isOwner =
      actor.role === "admin" ||
      (actor.operatorId !== undefined &&
        document.operatorId === actor.operatorId);
    if (!isOwner) {
      throw new Error("Forbidden: this document belongs to another driver");
    }

    const storageId = resolveStorageId(ctx, document.storageId);
    const url = storageId ? await ctx.storage.getUrl(storageId) : null;
    if (!url) {
      throw new Error("The file for this document is no longer stored");
    }

    return {
      contentType: document.contentType,
      kind: document.kind,
      url,
    };
  },
});

/**
 * Puts a rejected application back in the queue once the driver has fixed
 * the problem and resubmitted.
 */
export const resubmitApplication = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const actor = await resolveActor(ctx, args.sessionToken);
    const { operatorId } = actor;
    if (!operatorId) {
      throw new Error("Forbidden: only drivers have an application");
    }

    const operator = await ctx.db.get(operatorId);
    if (!operator) {
      throw new Error("Operator profile not found");
    }
    if (approvalStatusOf(operator) !== "rejected") {
      throw new Error(
        "Forbidden: only a rejected application can be resubmitted"
      );
    }

    const rows = await ctx.db
      .query("operatorDocuments")
      .withIndex("by_operatorId", (q) => q.eq("operatorId", operatorId))
      .collect();
    const present = new Set(rows.map((document) => document.kind));
    const missing = DOCUMENT_KINDS.filter((kind) => !present.has(kind));
    if (missing.length > 0) {
      throw new Error("Please upload all four documents before resubmitting");
    }

    await ctx.db.patch(operatorId, {
      approvalStatus: "pending",
      rejectionNote: undefined,
      updatedAt: Date.now(),
    });
  },
});
