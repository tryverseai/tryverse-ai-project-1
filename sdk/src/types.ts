/** Product categories the AI try-on pipeline supports. */
export type TryOnCategory = "clothing" | "tops" | "bottoms" | "dresses" | "one-pieces";

/**
 * An image input to the SDK. Accepts whatever's natural for the runtime you're in:
 * - a public URL (string) — TryVerse fetches it directly
 * - a Buffer / Uint8Array (Node.js — e.g. a file you've already read)
 * - a Blob / File (browsers, edge runtimes)
 */
export type ImageInput = string | Buffer | Uint8Array | Blob;

export interface TryOnOptions {
  /** A photo of the person — the shopper, or a model. */
  personImage: ImageInput;
  /** A photo of the garment/product to try on. */
  productImage: ImageInput;
  /** Defaults to "clothing" if omitted. */
  category?: TryOnCategory;
  /** Optional free-text hint ("floor-length silk gown") that helps the AI match cut and fabric. */
  productDescription?: string;
  /** Called as the generation progresses — e.g. "queued", "processing", "completed". */
  onProgress?: (status: string) => void;
}

export interface TryOnResult {
  id: string;
  status: "completed";
  /** Signed URL of the generated image. */
  resultUrl: string;
  category: TryOnCategory;
}

export interface TryVerseClientOptions {
  /** Your TryVerse API key (tv_live_...). Falls back to the TRYVERSE_API_KEY env var when omitted. */
  apiKey?: string;
  /** Override the API origin — only needed for local development or self-hosted deployments. */
  baseUrl?: string;
  /** Max attempts while polling for a queued generation's result. Defaults to 60 (~2 minutes). */
  maxPollAttempts?: number;
  /** Delay between poll attempts, in ms. Defaults to 2000. */
  pollIntervalMs?: number;
}
