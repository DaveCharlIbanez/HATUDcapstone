/**
 * Image type detection from the raw bytes of a file.
 *
 * The MIME type a browser reports can be wrong — a renamed file is the
 * classic case. The magic number at the start of the file is what the
 * decoder actually sees, so that is what is checked.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

/** The number of leading bytes needed to tell PNG and JPEG apart. */
export const IMAGE_SIGNATURE_LENGTH = 8;

export type ImageType = "image/jpeg" | "image/png";

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) {
    return false;
  }
  return signature.every((byte, index) => bytes[index] === byte);
}

/**
 * Returns the image type of the given leading bytes, or null when the file
 * is not a PNG or a JPEG.
 */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (startsWith(bytes, PNG_SIGNATURE)) {
    return "image/png";
  }
  if (startsWith(bytes, JPEG_SIGNATURE)) {
    return "image/jpeg";
  }
  return null;
}
