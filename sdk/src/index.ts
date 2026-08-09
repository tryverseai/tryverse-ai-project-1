import { TryVerseClient } from "./client";
import type { TryOnOptions, TryOnResult, TryVerseClientOptions } from "./types";

export { TryVerseError } from "./errors";
export type {
  ImageInput,
  TryOnCategory,
  TryOnOptions,
  TryOnResult,
  TryVerseClientOptions,
} from "./types";

/**
 * The official TryVerse SDK.
 *
 * ```ts
 * import { TryVerse } from "@tryverseai/sdk";
 *
 * const tryverse = new TryVerse(); // reads TRYVERSE_API_KEY from the environment
 *
 * const { resultUrl } = await tryverse.tryOn({
 *   personImage: shopperPhotoFile,
 *   productImage: "https://yourstore.com/products/denim-jacket.jpg",
 *   category: "clothing",
 * });
 * ```
 *
 * That single call uploads both images, starts generation, and waits for the result —
 * authentication, retries, and status polling all happen inside the SDK.
 */
export class TryVerse {
  private readonly client: TryVerseClient;

  constructor(options: TryVerseClientOptions = {}) {
    this.client = new TryVerseClient(options);
  }

  /** Runs a complete virtual try-on and resolves once the image is ready. */
  tryOn(options: TryOnOptions): Promise<TryOnResult> {
    return this.client.tryOn(options);
  }

  /**
   * Uploads a single image and returns its TryVerse storage path. Most integrations don't need
   * this directly — `tryOn()` calls it internally — but it's here for advanced/custom flows.
   */
  upload(image: TryOnOptions["personImage"], kind: "person" | "product"): Promise<string> {
    return this.client.upload(image, kind);
  }
}

export default TryVerse;
