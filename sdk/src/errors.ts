/** Thrown for any failed TryVerse operation — network, auth, validation, or generation failure. */
export class TryVerseError extends Error {
  /** HTTP status code, when the failure came from an API response. */
  status?: number;
  /** Machine-readable error code from the API (e.g. "CREDITS_EXHAUSTED"), when present. */
  code?: string;

  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message);
    this.name = "TryVerseError";
    this.status = options?.status;
    this.code = options?.code;
  }
}
