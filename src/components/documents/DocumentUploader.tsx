"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { useAuth } from "@/lib/authContext";
import { type DocumentKind, validateDocumentFile } from "@/lib/documentImage";
import { uploadDocument } from "@/lib/documentUpload";
import { api } from "../../../convex/_generated/api";
import { CaptureSheet } from "./CaptureSheet";
import { DocumentTile, type DocumentUploadState } from "./DocumentTile";

interface DocumentUploaderProps {
  /** Called after every successful upload, so a parent can react. */
  onUploaded?: () => void;
}

const DOCUMENT_LABELS: Record<DocumentKind, string> = {
  insurance: "Insurance",
  license: "Driver's License",
  officialReceipt: "LTO Official Receipt",
  registration: "Certificate of Registration",
};

const DOCUMENT_HINTS: Record<DocumentKind, string> = {
  insurance: "Compulsory third-party cover",
  license: "Your LTO driver's licence",
  officialReceipt: "The receipt for your registration",
  registration: "Proof the vehicle is registered",
};

const DOCUMENT_ORDER: DocumentKind[] = [
  "license",
  "registration",
  "officialReceipt",
  "insurance",
];

/**
 * The four credential documents a driver has to upload.
 *
 * The list of what is already uploaded comes from the server, so a driver who
 * leaves and comes back picks up where they left off.
 */
export function DocumentUploader({ onUploaded }: DocumentUploaderProps) {
  const { sessionToken } = useAuth();
  const [activeKind, setActiveKind] = useState<DocumentKind | null>(null);
  const [states, setStates] = useState<
    Record<DocumentKind, DocumentUploadState>
  >({
    insurance: { status: "empty" },
    license: { status: "empty" },
    officialReceipt: { status: "empty" },
    registration: { status: "empty" },
  });

  const mine = useQuery(
    api.documents.listMyDocuments,
    sessionToken ? { sessionToken } : "skip"
  );
  const deleteDocument = useMutation(api.documents.deleteMyDocument);

  const uploadedKinds = new Set(
    (mine?.documents ?? []).map((document) => document.kind)
  );

  const setState = useCallback(
    (kind: DocumentKind, state: DocumentUploadState) => {
      setStates((previous) => ({ ...previous, [kind]: state }));
    },
    []
  );

  const handlePick = useCallback(
    async (kind: DocumentKind, file: File) => {
      if (!sessionToken) {
        return;
      }
      setActiveKind(null);

      const validation = validateDocumentFile(file);
      if (!validation.ok) {
        setState(kind, { error: validation.error, status: "error" });
        return;
      }

      setState(kind, { percent: 0, status: "uploading" });

      try {
        await uploadDocument({
          file,
          kind,
          onProgress: (percent) =>
            setState(kind, { percent, status: "uploading" }),
          sessionToken,
        });
        setState(kind, { status: "uploaded" });
        onUploaded?.();
      } catch (error) {
        setState(kind, {
          error: error instanceof Error ? error.message : "The upload failed",
          status: "error",
        });
      }
    },
    [onUploaded, sessionToken, setState]
  );

  const handleRemove = useCallback(
    async (kind: DocumentKind) => {
      if (!sessionToken) {
        return;
      }
      setActiveKind(null);
      const document = mine?.documents.find((entry) => entry.kind === kind);
      if (document) {
        try {
          await deleteDocument({ sessionToken, id: document._id });
        } catch {
          // The tile goes back to empty either way.
        }
      }
      setState(kind, { status: "empty" });
    },
    [deleteDocument, mine, sessionToken, setState]
  );

  const activeDocument = activeKind
    ? mine?.documents.find((entry) => entry.kind === activeKind)
    : undefined;

  return (
    <div>
      <div className="space-y-3">
        {DOCUMENT_ORDER.map((kind) => {
          const uploaded = uploadedKinds.has(kind);
          const local = states[kind] ?? { status: "empty" };
          // A failed replacement has to stay visible, otherwise the tile
          // would go on showing the old document as uploaded and the driver
          // would never know the new one did not make it.
          const state: DocumentUploadState = (() => {
            if (local.status === "error") {
              return local;
            }
            if (uploaded) {
              return { status: "uploaded" };
            }
            return local;
          })();
          return (
            <DocumentTile
              hint={DOCUMENT_HINTS[kind]}
              key={kind}
              kind={kind}
              label={DOCUMENT_LABELS[kind]}
              onPress={() => setActiveKind(kind)}
              state={state}
            />
          );
        })}
      </div>

      <CaptureSheet
        canRemove={Boolean(activeDocument)}
        isOpen={activeKind !== null}
        onClose={() => setActiveKind(null)}
        onPick={(_source, file) => {
          if (activeKind) {
            handlePick(activeKind, file).catch(() => undefined);
          }
        }}
        onRemove={() => {
          if (activeKind) {
            handleRemove(activeKind).catch(() => undefined);
          }
        }}
        title={activeKind ? DOCUMENT_LABELS[activeKind] : "Add document"}
      />
    </div>
  );
}
