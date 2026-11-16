/**
 * The message to show when a mutation fails.
 *
 * The server says exactly what went wrong — the driver is off shift, they are
 * already on a trip, somebody else took the request. A catch block that
 * discards the error and shows a fixed sentence sends the reader looking for
 * a problem that is not there.
 */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
