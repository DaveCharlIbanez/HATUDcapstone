import { api } from "../../convex/_generated/api";
import { convexClient } from "./convexClient";
import {
  type DocumentKind,
  prepareImage,
  uploadBlob,
  validateDocumentFile,
} from "./documentImage";

/**
 * Uploads one credential document to Convex storage.
 *
 * The bytes go straight to storage through a short-lived upload URL, so they
 * never travel through the Convex protocol. The server then checks the
 * stored file itself — its type and its size — before it accepts it.
 */
export async function uploadDocument({
  file,
  kind,
  onProgress,
  sessionToken,
}: {
  file: File;
  kind: DocumentKind;
  onProgress?: (percent: number) => void;
  sessionToken: string;
}): Promise<{ documentId: string }> {
  const validation = validateDocumentFile(file);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  onProgress?.(5);
  const prepared = await prepareImage(file);
  onProgress?.(25);

  const uploadUrl = await convexClient.mutation(
    api.documents.generateUploadUrl,
    { sessionToken }
  );

  const { storageId } = await uploadBlob(
    uploadUrl,
    prepared.blob,
    (percent) => {
      onProgress?.(25 + Math.round(percent * 0.5));
    }
  );

  onProgress?.(80);

  const result = await convexClient.action(api.documents.registerDocument, {
    sessionToken,
    kind,
    storageId,
    fileName: prepared.fileName,
  });

  onProgress?.(100);
  return { documentId: result.documentId };
}
