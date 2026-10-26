/**
 * Client-side handling of driver credential images.
 *
 * A phone camera produces a 3-12MB file. That is far more than a credential
 * scan needs, and on mobile data it is a real cost, so the image is
 * downsampled and re-encoded on the device before it is uploaded.
 *
 * Nothing in this module talks to the server, so it can be unit tested
 * without a Convex connection.
 */

/** The largest raw file the client will even try to send. */
export const MAX_RAW_BYTES = 20 * 1024 * 1024;

/** The longest edge a stored document is scaled to. */
export const MAX_EDGE = 1600;

/** The quality the downscaled image is encoded at. */
export const JPEG_QUALITY = 0.85;

/** The only formats the app accepts. */
export const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg"];

/** What a document is stored as, whatever the source format was. */
export const TARGET_MIME_TYPE = "image/jpeg";

export type DocumentKind =
  | "insurance"
  | "license"
  | "officialReceipt"
  | "registration";

export type FileValidation = { error: string; ok: false } | { ok: true };

export interface PreparedImage {
  blob: Blob;
  fileName: string;
  height: number;
  originalBytes: number;
  width: number;
}

/**
 * Checks a picked file before any bytes are sent.
 */
export function validateDocumentFile(file: {
  size: number;
  type: string;
}): FileValidation {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { error: "Only PNG and JPG images are accepted", ok: false };
  }
  if (file.size === 0) {
    return { error: "That file is empty", ok: false };
  }
  if (file.size > MAX_RAW_BYTES) {
    return {
      error: "That image is too large — please try a smaller one",
      ok: false,
    };
  }
  return { ok: true };
}

/**
 * The size an image is scaled to.
 *
 * Pure, so it can be checked without a canvas.
 */
export function scaledDimensions(
  width: number,
  height: number,
  maxEdge: number = MAX_EDGE
): { height: number; width: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { height, width };
  }
  const scale = maxEdge / longest;
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

interface DecodedImage {
  close: () => void;
  draw: (
    context: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => void;
  height: number;
  width: number;
}

/**
 * Decodes an image file, preferring `createImageBitmap` and falling back to
 * an `<img>` element for browsers that do not have it.
 */
async function decodeImage(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      close: () => bitmap.close(),
      draw: (context, width, height) => {
        context.drawImage(bitmap, 0, 0, width, height);
      },
      height: bitmap.height,
      width: bitmap.width,
    };
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not read that image"));
    image.src = url;
  });

  return {
    close: () => URL.revokeObjectURL(url),
    draw: (context, width, height) => {
      context.drawImage(image, 0, 0, width, height);
    },
    height: image.naturalHeight,
    width: image.naturalWidth,
  };
}

/**
 * Downsamples an image and re-encodes it as a JPEG.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  let decoded: DecodedImage;
  try {
    decoded = await decodeImage(file);
  } catch {
    throw new Error(
      "That file could not be read as an image — please use a PNG or JPG"
    );
  }
  const { width, height } = scaledDimensions(decoded.width, decoded.height);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    decoded.close();
    throw new Error("Could not prepare that image");
  }

  decoded.draw(context, width, height);
  decoded.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, TARGET_MIME_TYPE, JPEG_QUALITY);
  });
  if (!blob) {
    throw new Error("Could not prepare that image");
  }

  return {
    blob,
    fileName: file.name || "document",
    height,
    originalBytes: file.size,
    width,
  };
}

/**
 * Posts a blob to an upload URL, reporting progress as it goes, and returns
 * the storage id the server allocated for it.
 *
 * `fetch` cannot report upload progress, so this uses an XMLHttpRequest.
 */
export function uploadBlob(
  url: string,
  blob: Blob,
  onProgress?: (percent: number) => void
): Promise<{ storageId: string }> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.setRequestHeader("Content-Type", blob.type);

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener("load", () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error("The upload failed — please try again"));
        return;
      }
      try {
        const body = JSON.parse(request.responseText) as { storageId?: string };
        if (!body.storageId) {
          reject(new Error("The upload failed — please try again"));
          return;
        }
        resolve({ storageId: body.storageId });
      } catch {
        reject(new Error("The upload failed — please try again"));
      }
    });
    request.addEventListener("error", () => {
      reject(new Error("The upload failed — check your connection"));
    });
    request.addEventListener("abort", () => {
      reject(new Error("The upload was cancelled"));
    });

    request.send(blob);
  });
}
