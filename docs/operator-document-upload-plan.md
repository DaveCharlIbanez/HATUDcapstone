# Operator Document Upload — Implementation Plan

## Overview

A driver who signs up today becomes a `pending` operator with a licence number
typed into a text field and nothing to prove. An admin can approve them, but
there is no evidence the person has a licence, a registered vehicle, a legal
receipt or insurance.

This plan adds a **four-document credential upload** to the operator sign-up,
built for a phone: each document is captured with the camera or selected from
the gallery/file explorer, downscaled on the device, stored in Convex file
storage, and routed to the admin panel for review. Until an admin approves the
application, the driver cannot go online or accept rides.

## Problem Statement

| Problem | Detail |
|---|---|
| No proof of credentials | `convex/auth.ts` signup records a `licenseNumber` string and a `vehicleInfo` object. Nothing verifies the driver is licensed. |
| Approval is unverifiable | The admin's "Driver Approvals" panel shows name, email, plate, licence number — and approves on trust. |
| Sign-up is a wall of text fields | Four vehicle text inputs on a phone keyboard. No camera. |
| A pending driver lands on a map they cannot use | `src/app/operator/map/page.tsx` loads, but `setAvailability` and `rides.accept` both reject them, so the screen is dead. |
| No rejection path | `admins.setOperatorApproval` sets `rejected` and the driver is stuck. No note, no way back. |
| Nothing checks file integrity | The client will send whatever bytes it has. |

## Decisions

| Decision | Choice |
|---|---|
| File sizing | Auto-downscale on the device, store as JPEG |
| Accepted input formats | `image/png` and `image/jpeg` only |
| Capture options | **Take a photo** (camera) and **Select file** (file explorer / local gallery) |
| Review granularity | The admin approves/rejects the **whole application**, with an optional note |
| After rejection | The operator can re-upload and resubmit |
| Pending driver experience | A dedicated **Application status** screen, not the map |
| Expiry dates | None — the admin reads them off the document |
| Storage | Convex file storage. No new dependency |

## Goals

1. Four documents required before an operator application can be submitted.
2. Capture on the phone is the primary path; the file picker is the fallback.
3. The admin sees the actual documents, not a filename.
4. A rejected driver can fix the problem and try again.
5. Nothing about the upload flow breaks the web build or the Android build.

### Non-goals

- OCR or automatic document validation. The admin reads them.
- Expiry tracking and expiry warnings.
- A general-purpose file system. Four fixed document kinds.
- Multi-file insurance policies. One file per kind, replaceable.

## Architecture

### Data model

A new table, not a field on `operators` — four rows per driver, each with its
own metadata, keeps the operator document small and lets a document be
replaced without rewriting the driver record.

```ts
operatorDocuments: defineTable({
  operatorId: v.id("operators"),
  kind: v.union(
    v.literal("license"),
    v.literal("registration"),
    v.literal("officialReceipt"),
    v.literal("insurance")
  ),
  storageId: v.string(),          // the _storage id
  contentType: v.string(),        // "image/png" | "image/jpeg"
  size: v.number(),               // bytes actually stored
  fileName: v.optional(v.string()),
  uploadedAt: v.number(),
  replacedCount: v.optional(v.number()),
}).index("by_operatorId", ["operatorId"])
    .index("by_operatorId_and_kind", ["operatorId", "kind"])
```

`operators` gains one optional field:

```ts
rejectionNote: v.optional(v.string()),   // why the last application failed
```

Optional, so it is a non-breaking change and needs no backfill.

| `kind` | Label shown to the driver | What the admin checks |
|---|---|---|
| `license` | Driver's License | The LTO licence matches the licence number and the name |
| `registration` | Certificate of Registration | The vehicle is registered to this plate |
| `officialReceipt` | LTO Official Receipt | The OR shows the same plate and is dated |
| `insurance` | Insurance | Compulsory third-party cover, valid today |

### The upload protocol

Convex file storage, three steps. No new dependency, and the file bytes never
pass through the Convex websocket — they go straight to storage.

```
1. Client picks a file.
2. Client validates + downsamples (see below).
3. documents:generateUploadUrl   → { uploadUrl }
4. POST uploadUrl, body = blob    → { storageId }
5. documents:saveDocument        → row written, old file for that kind deleted
```

**The server verifies the file, not the client.** `saveDocument` reads the
real metadata out of the `_storage` system table
(`ctx.db.system.get("_storage", storageId)` → `{ size, contentType }`) and
rejects anything that is not PNG or JPEG or is over the cap. A client that
lies about its own upload is caught.

`ctx.storage.getMetadata` is deprecated in Convex 1.47, so the system table
is the route.

### Device-side processing

| Step | Rule |
|---|---|
| Accept | `image/png` and `image/jpeg` only. Anything else is refused before the upload starts. |
| Raw cap | 20MB, the Convex storage limit. Anything larger is refused with a clear message. |
| Downscale | Longest edge → 1600px, on a canvas. |
| Encode | JPEG, quality 0.85. A downscaled 1600px JPEG of a document is ~200-400KB. |
| Server cap | 2MB of stored bytes. The client should never get near it; the server is the backstop. |

Downscaling is done with `createImageBitmap` + `OffscreenCanvas` where
available, falling back to a regular `<canvas>`.

### Backend surface

New module `convex/documents.ts`:

| Function | Who | What |
|---|---|---|
| `generateUploadUrl` | operator | A short-lived storage URL for one upload |
| `saveDocument` | operator | Validates the stored file, writes the row, deletes the file it replaced |
| `listMyDocuments` | operator | The caller's own four documents |
| `deleteMyDocument` | operator | Removes one of the caller's documents (before submitting) |
| `listForOperator` | admin | Metadata for one applicant's four documents |
| `getDocumentUrl` | admin | A fresh signed URL for one document, for the viewer |
| `reviewApplication` | admin | Approve or reject the operator, with an optional note |

Rules enforced server-side:

- Only the operator's **own** documents can be written or deleted.
- Only an operator whose `approvalStatus` is `pending` or `rejected` can
  upload. An approved driver has no reason to upload anything.
- A commuter or admin cannot upload driver credentials.
- Only an admin can read another operator's documents. A signed URL is only
  ever handed to an admin or to the owning driver.
- Exactly one document per `kind` per operator. Uploading a new one for a
  kind deletes the previous file from storage, so a rejected-and-replaced
  document does not leak storage.

### The capture sheet

Two hidden file inputs per document tile, plus a third action to remove an
uploaded document. The sheet is a bottom sheet, not a centred modal.

```
┌──────────────────────────────────┐
│           ┈┈┈┈                   │  drag handle
│                                  │
│   📷   Take a photo              │
│                                  │
│   📁   Select file               │
│                                  │
│   ────────────────────────────   │
│   🗑   Remove document           │  muted red, only once uploaded
│                                  │
│        Cancel                    │
└──────────────────────────────────┘
```

| Target | Input | `accept` | `capture` | Result |
|---|---|---|---|---|
| **Take a photo** | camera | `image/*` | `environment` | Opens the camera directly on Android (`ACTION_IMAGE_CAPTURE`, produces a JPEG) |
| **Select file** | picker | `image/png,image/jpeg` | *(none)* | Opens the system picker: local gallery **and** the file explorer / Downloads, pre-filtered to PNG and JPG |
| **Remove document** | — | — | — | Deletes the uploaded file and its row |

#### Why the two accept attributes differ

Capacitor's Android bridge only routes to the camera when the `accept`
attribute literally contains `image/*`:

```java
// node_modules/@capacitor/android/.../BridgeWebChromeClient.java
boolean captureEnabled = fileChooserParams.isCaptureEnabled();
boolean capturePhoto  = captureEnabled && acceptTypes.contains("image/*");
if (capturePhoto || captureVideo) { /* camera */ } else { /* file picker */ }
```

Writing `accept="image/png,image/jpeg" capture="environment"` on the camera
input would have made Capacitor ignore `capture` and open the file picker
instead. The camera input therefore uses `image/*`, and the "png and jpg
only" rule is enforced by the `accept` filter on the **picker** input plus
client-side and server-side type validation on **both** paths. A camera
capture on Android is always a JPEG, so it passes.

The manifest change is not optional — see Risks.

## Design Language

- Cards `rounded-3xl border border-[var(--border)] bg-[var(--surface)]`
- Primary text `text-[var(--foreground)]`, never a hard-coded `text-white`
- Secondary text `text-[var(--text-muted)]`
- Accent `text-sky-500 dark:text-sky-400`
- Destructive `bg-rose-600 text-white`
- No fixed widths, no horizontal scrolling

## Mobile-First Rules

1. **The capture sheet is a bottom sheet**, `rounded-t-3xl`, sliding up from
   the bottom with a drag handle.
2. **Large targets**: "Take a photo" and "Select file" at least 56px tall.
   "Remove document" is muted red and sits apart at the bottom.
3. **Two hidden file inputs per tile**, so the tile decides which to click.
4. **44px+ tap targets** everywhere, including the sheet buttons and tiles.
5. **One sheet at a time.** Opening a second closes the first.
6. **Per-tile progress.** Each tile shows its own state: empty, uploading
   (with a percentage), uploaded (thumbnail + check), failed (with Retry).
   A failed tile never blocks the others.
7. **The sign-up becomes a wizard** — Details → Vehicle → Documents →
   Submitted — one step per screen, with a persistent step indicator.
8. **The camera path is the default.** "Take a photo" is listed first.
9. **The picker pre-filters** to `image/png,image/jpeg`, so the user cannot
   pick a GIF or a PDF from the file explorer.

## The Waves

Each wave is independently shippable and testable on its own.

### Wave 1 — Storage and backend plumbing

No UI. The whole upload path exists and is proven by tests.

| # | Task | File |
|---|---|---|
| 1.1 | Add the `operatorDocuments` table | `convex/schema.ts` |
| 1.2 | Add `rejectionNote` to `operators` | `convex/schema.ts` |
| 1.3 | `generateUploadUrl`, `saveDocument`, `listMyDocuments`, `deleteMyDocument` | `convex/documents.ts` (new) |
| 1.4 | `listForOperator`, `getDocumentUrl`, `reviewApplication` | `convex/documents.ts` |
| 1.5 | Extend the dashboard snapshot with document counts | `convex/adminQueries.ts` |
| 1.6 | Tests: upload URL scoping, PNG/JPEG enforcement, size cap, one-per-kind replacement, old file deleted, non-operator blocked, wrong-role blocked, admin-only reads, reject-with-note | `tests/convex/documents.test.ts` (new) |

**Done when** a test can push a fake file through `generateUploadUrl` →
`saveDocument` and read it back as an admin, and every rejection path is
covered.

### Wave 2 — The driver's capture and upload experience

| # | Task | File |
|---|---|---|
| 2.0 | **The Android camera permission** — pulled forward from wave 4 so the camera path is testable on a device early | `android/app/src/main/AndroidManifest.xml` |
| 2.1 | Validate + downscale + upload helper | `src/lib/documentUpload.ts` (new) |
| 2.2 | The bottom sheet: camera / select file / remove | `src/components/documents/CaptureSheet.tsx` (new) |
| 2.3 | The document tile: empty / uploading / uploaded / failed | `src/components/documents/DocumentTile.tsx` (new) |
| 2.4 | The four-tile grid | `src/components/documents/DocumentUploader.tsx` (new) |
| 2.5 | Split sign-up into Details → Vehicle → Documents → Submitted | `src/app/signup/page.tsx` |
| 2.6 | Block "Submit for review" until all four are uploaded | `src/app/signup/page.tsx` |
| 2.7 | Tests for the pure helper (validation + downscale maths) | `tests/documentUpload.test.ts` (new) |

**Done when** a driver can sign up on a phone, photograph or select four
documents, watch them upload, and land on a confirmation screen.

### Wave 3 — The admin review experience

| # | Task | File |
|---|---|---|
| 3.1 | Document checklist in the approvals panel | `src/components/admin/AdminPanels.tsx` |
| 3.2 | The full-screen document viewer with zoom | `src/components/admin/DocumentViewer.tsx` (new) |
| 3.3 | Approve / Reject with an optional note, wired to `reviewApplication` | `src/components/admin/DocumentViewer.tsx` |
| 3.4 | The rejected state is visible in the approvals panel with the note | `src/components/admin/AdminPanels.tsx` |

**Done when** an admin can open an applicant, look at all four documents,
approve or reject with a reason, and the driver sees the outcome.

### Wave 4 — Driver status, re-submission and Android hardening

| # | Task | File |
|---|---|---|
| 4.1 | `approvalStatus` + `rejectionNote` in the operator's own profile view | `convex/lib/projections.ts`, `convex/operators.ts` |
| 4.2 | The Application status screen: per-document state, the note, re-upload | `src/app/operator/application/page.tsx` (new) |
| 4.3 | Route pending and rejected operators to the status screen | `src/app/login/page.tsx`, `src/components/RouteGuard.tsx` |
| 4.4 | Rejected → re-upload → resubmit returns the driver to `pending` | `src/app/operator/application/page.tsx` |
| 4.5 | Tests + README + the plan document's verification section | `tests/`, `README.md` |

**Done when** a rejected driver can fix the flagged document and be approved
on the second attempt.

## Acceptance Criteria

1. An operator cannot submit an application with fewer than four documents.
2. The capture sheet offers "Take a photo" and "Select file" as two separate,
   large targets, and "Select file" opens a picker that reaches both the
   local gallery and the file explorer.
3. A file that is not PNG or JPEG is refused before any bytes are sent.
4. A stored document is never larger than 2MB.
5. The server rejects a file whose actual stored type is not PNG or JPEG,
   even if the client claims otherwise.
6. Only an admin or the owning driver can obtain a document URL.
7. A pending driver cannot go online or accept a ride. (Already true.)
8. A pending driver lands on the Application status screen, not the map.
9. The admin sees the four documents, not filenames.
10. A rejected driver sees the note, can replace the document and resubmit.
11. Uploading a replacement deletes the file it replaced from storage.
12. No horizontal scroll at 360px. Every tap target at least 44px.
13. The web build and the Android build both succeed.

## Risks And Mitigations

| Risk | Mitigation |
|---|---|
| **The camera silently opens the file picker instead** | Capacitor only honours `capture` when `accept` contains `image/*`. The camera input therefore uses `accept="image/*" capture="environment"`, and the png/jpg-only rule is enforced by validation on both paths. Verified against the Capacitor 8 source, not assumed. |
| **The camera permission is missing on Android** | Capacitor's `onShowFileChooser` requests `CAMERA` at runtime, but an undeclared permission is denied silently and the picker returns null. The manifest change in wave 2.0 is **not optional**. |
| Convex storage cost grows with every rejected application | The old file is deleted on replace. Rejected applications keep their files as an audit trail — if that becomes a problem, a cron can purge rejected applications after N days. Worth revisiting after the demo. |
| A phone photo of a document is unreadable after downscaling | 1600px is above what is legible on a phone screen when zoomed. If the admin complains, raise the cap. |
| The 1600px / JPEG-q85 downscale discards the original | Deliberate and irreversible. The 20MB raw rejection and the 2MB server cap mean nothing is lost to *accidental* size, but a re-encode cannot be undone. Raising the cap to keep originals is a one-line change if that becomes a requirement. |
| An admin approves without looking | The panel shows which documents are uploaded and which are missing, and Approve is disabled until all four are present. |

## Verification

Backend waves are covered by `convex-test` unit tests. The UI waves are
verified in a real headless Chromium against the dev deployment at 360px and
1280px, in both themes, with the camera and picker paths faked by scripted
file selection — the same approach used for the location-sharing and
admin-panel work. The Android camera path is verified on a device, since a
headless browser cannot exercise `ACTION_IMAGE_CAPTURE`.

## Open Items I Will Resolve While Building

- Whether `replacedCount` on the document row earns its place, or whether a
  simple overwrite is enough.
- Whether the status screen needs to show a *rejected* document side by side
  with its replacement.

## What Was Actually Built

Every wave shipped. Two things came out differently from the plan, both
because the platform forced a better answer.

### The byte check had to move to an action

The plan said the server would verify the file rather than trust the client.
Reading the bytes of a stored file is only possible from an action —
`ctx.storage.get()` does not exist in a mutation. So the registration is
split:

```
documents:generateUploadUrl   (mutation)  → the upload URL, and the
                                             authorisation gate
client POSTs the bytes        → { storageId }
documents:registerDocument     (action)    → sniffs the magic number,
                                             then writes the row through
                                             internal.documents.writeDocument
```

`internal.documents.authorizeUpload` and `internal.documents.writeDocument`
are internal, so a client cannot write a document row without going through
the byte check. The magic-number test is `convex/lib/imageType.ts`.

### The plan's `accept` attributes had to change

Capacitor only routes to the camera when the `accept` attribute contains
`image/*` — the plan worked this out from the Capacitor source. The camera
input therefore uses `accept="image/*" capture="environment"`, and the
picker input uses `accept="image/png,image/jpeg"`. The png-and-jpg-only rule
is enforced by the picker filter plus validation on both paths.

## Verification

### Backend

`tests/convex/documents.test.ts` — 12 tests:

- the image detector recognises PNG and JPEG and nothing else
- a driver can register a document and read it back
- a renamed file is rejected because the bytes are not an image
- a file over the size cap is rejected
- uploading a second document for the same kind replaces the first, and the
  replaced file is gone from storage
- a commuter cannot upload driver credentials
- an approved driver cannot upload anything
- only an admin can read another driver's documents
- a driver can delete their own document but not somebody else's
- a rejected application can be resubmitted once all four documents are
  uploaded
- the admin dashboard reports which documents each driver uploaded
- a driver sees their own approval status and the note they were given

`tests/documentImage.test.ts` — 8 tests for the client-side maths: the
accepted formats, the size caps, and the downscale.

### Browser

Driven in a headless Chromium at 390×844 against the dev deployment, with
the camera and picker paths faked by scripted file selection:

```
UPLOAD documents uploaded: 4/4
UPLOAD submit enabled after four documents: true
UPLOAD submitted screen: true
PENDING driver url after /operator/map: /operator/application
ADMIN approvals panel shows the applicant: true
ADMIN viewer open: true
ADMIN viewer images rendered: 4
ADMIN rejection note shown: true
DRIVER sees the note: true
DRIVER sees the rejected title: true
DRIVER resubmit enabled with all four documents: true
DRIVER back in review: true
PAGE_ERRORS=none
```

The capture sheet, from the same run:

```
"Driver's License Take a photo Use the camera now Select file From your
 gallery or files Cancel"
camera accept=image/* capture=environment
file accept=image/png,image/jpeg
```

And a file that is not an image at all:

```
UPLOAD renamed pdf tile text: "Driver's License That file could not be read
 as an image — please use a PNG or JPG Failed — tap to retry"
```

## Bugs Found While Building

| Bug | Where | Fix |
|---|---|---|
| The file bytes were uploaded twice | `documentUpload.ts` | The upload helper now returns the storage id from the same POST instead of posting again |
| A failed replacement upload was invisible | `DocumentUploader.tsx` | A local error now takes precedence over the server's "uploaded" state |
| The admin's action bar was pushed off screen by the document images | `DocumentViewer.tsx` | The scroll area needed `min-h-0` so the flex column could shrink it |
| The image type could not be checked in a mutation | `documents.ts` | The check moved into an action, where the bytes can be read |

## Notes For The Next Person

- The Android camera permission is declared in
  `android/app/src/main/AndroidManifest.xml`. Removing it makes the camera
  button fail silently on a device.
- The camera input must keep `accept="image/*"`. Narrowing it to
  `image/png,image/jpeg` makes Capacitor ignore `capture` and open the file
  picker instead.
- `internal.seed.removeDriver` clears a throwaway driver and its uploaded
  documents. It needs the seed key, so it is safe to leave in.
- A document file is deleted from storage when it is replaced, so a driver
  who corrects a mistake does not leave the old file behind.

