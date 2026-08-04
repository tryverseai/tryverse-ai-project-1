import { TryVerseError } from "./errors";
import type { ImageInput, TryOnCategory, TryOnOptions, TryOnResult, TryVerseClientOptions } from "./types";

const DEFAULT_BASE_URL = "https://api.tryverseai.com";

/** Same local/private-host detection the reference widget uses — the API can't fetch these itself. */
function isLocalOrPrivateUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    const h = hostname.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1") return true;
    if (/^10\./.test(h) || /^192\.168\./.test(h)) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(h)) return true;
    return false;
  } catch {
    return false;
  }
}

function detectEnvApiKey(): string | undefined {
  // Guarded for browser/edge runtimes where `process` doesn't exist.
  if (typeof process !== "undefined" && process.env) {
    return process.env.TRYVERSE_API_KEY;
  }
  return undefined;
}

/** Mirrors detectEnvApiKey — lets self-hosted/local deployments override the API origin without
 *  a code change (`baseUrl` in the constructor still wins if both are provided). */
function detectEnvBaseUrl(): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    return process.env.TRYVERSE_BASE_URL || process.env.TRYVERSE_API_URL;
  }
  return undefined;
}

async function toBlob(input: Buffer | Uint8Array | Blob): Promise<Blob> {
  if (typeof Blob !== "undefined" && input instanceof Blob) return input;
  // Buffer / Uint8Array — wrap directly; Blob accepts BlobPart[] including typed arrays.
  return new Blob([input as Uint8Array]);
}

async function parseErrorBody(res: Response, fallback: string): Promise<TryVerseError> {
  try {
    const body = await res.json();
    return new TryVerseError(typeof body?.error === "string" ? body.error : fallback, {
      status: res.status,
      code: typeof body?.code === "string" ? body.code : undefined,
    });
  } catch {
    return new TryVerseError(fallback, { status: res.status });
  }
}

/**
 * Low-level HTTP client. Most consumers should use the top-level `TryVerse` class instead —
 * this exists so advanced use cases (custom retry/backoff, request tracing) can drop down a
 * level without losing the SDK's auth/error handling.
 */
export class TryVerseClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly maxPollAttempts: number;
  private readonly pollIntervalMs: number;

  constructor(options: TryVerseClientOptions = {}) {
    const apiKey = options.apiKey ?? detectEnvApiKey();
    if (!apiKey) {
      throw new TryVerseError(
        "Missing API key. Pass { apiKey } to new TryVerse(...) or set the TRYVERSE_API_KEY environment variable.",
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? detectEnvBaseUrl() ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.maxPollAttempts = options.maxPollAttempts ?? 60;
    this.pollIntervalMs = options.pollIntervalMs ?? 2000;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return { "x-api-key": this.apiKey, ...extra };
  }

  private async uploadBytes(blob: Blob, type: "person" | "product", filename: string): Promise<string> {
    const formData = new FormData();
    formData.append("image", blob, filename);
    formData.append("type", type);
    const res = await fetch(`${this.baseUrl}/api/upload`, {
      method: "POST",
      headers: this.headers(),
      body: formData,
    });
    if (!res.ok) throw await parseErrorBody(res, "Image upload failed");
    const data = await res.json();
    return data.filePath as string;
  }

  private async uploadFromUrl(url: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/upload/from-url`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw await parseErrorBody(res, "Could not load image from URL");
    const data = await res.json();
    return data.filePath as string;
  }

  /**
   * Resolves any supported image input to a TryVerse storage path. `kind` matters for string
   * URLs: the API's URL-fetch endpoint only accepts product photos, so a person-image URL (or
   * any local/private URL) is fetched here in the SDK and uploaded as bytes instead.
   */
  private async resolveImage(input: ImageInput, kind: "person" | "product"): Promise<string> {
    if (typeof input === "string") {
      if (kind === "product" && !isLocalOrPrivateUrl(input)) {
        return this.uploadFromUrl(input);
      }
      const fetched = await fetch(input);
      if (!fetched.ok) throw new TryVerseError(`Could not fetch ${kind} image from ${input}`);
      const blob = await fetched.blob();
      return this.uploadBytes(blob, kind, `${kind}.jpg`);
    }
    const blob = await toBlob(input);
    return this.uploadBytes(blob, kind, `${kind}.jpg`);
  }

  /** Uploads a person or product photo directly and returns its TryVerse storage path. */
  async upload(image: ImageInput, kind: "person" | "product"): Promise<string> {
    return this.resolveImage(image, kind);
  }

  /**
   * Runs a full virtual try-on: uploads both images, starts generation, and waits for the
   * result. This is the one method most integrations need.
   */
  async tryOn(options: TryOnOptions): Promise<TryOnResult> {
    const category: TryOnCategory = options.category ?? "clothing";

    const [personImagePath, productImagePath] = await Promise.all([
      this.resolveImage(options.personImage, "person"),
      this.resolveImage(options.productImage, "product"),
    ]);

    const startRes = await fetch(`${this.baseUrl}/api/widget/request`, {
      method: "POST",
      headers: this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        personImagePath,
        productImagePath,
        category,
        productDescription: options.productDescription,
      }),
    });
    if (!startRes.ok) throw await parseErrorBody(startRes, "Try-on request failed");
    const started = await startRes.json();

    if (started.status === "queued") {
      options.onProgress?.("queued");
      return this.pollForResult(started.tryonId, category, options.onProgress);
    }
    if (started.resultUrl) {
      options.onProgress?.("completed");
      return { id: started.tryonId, status: "completed", resultUrl: started.resultUrl, category };
    }
    throw new TryVerseError(started.error ?? "No result returned", { code: started.code });
  }

  /** Polls a queued try-on until it completes or fails. Exposed for advanced/custom flows. */
  async pollForResult(
    tryonId: string,
    category: TryOnCategory = "clothing",
    onProgress?: (status: string) => void,
  ): Promise<TryOnResult> {
    for (let attempt = 0; attempt < this.maxPollAttempts; attempt++) {
      const res = await fetch(`${this.baseUrl}/api/widget/status/${tryonId}`, {
        headers: this.headers(),
      });
      if (!res.ok) throw await parseErrorBody(res, "Could not check try-on status");
      const data = await res.json();
      onProgress?.(data.status);
      if (data.status === "completed" && data.resultUrl) {
        return { id: tryonId, status: "completed", resultUrl: data.resultUrl, category: data.category ?? category };
      }
      if (data.status === "failed") {
        throw new TryVerseError(data.error ?? "Try-on failed");
      }
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
    throw new TryVerseError("Timed out waiting for the try-on result");
  }
}
