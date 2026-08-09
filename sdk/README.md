# @tryverseai/sdk

The official TryVerse SDK — AI virtual try-on for fashion brands. Install it, add your API key, and generate try-ons in one call.

## Install

```bash
npm install @tryverseai/sdk
```

## Quick start

```bash
# .env
TRYVERSE_API_KEY=tv_live_your_key_here
```

```ts
import { TryVerse } from "@tryverseai/sdk";

const tryverse = new TryVerse(); // reads TRYVERSE_API_KEY automatically

const { resultUrl } = await tryverse.tryOn({
  personImage: shopperPhoto,                                   // File, Buffer, or URL
  productImage: "https://yourstore.com/products/denim-jacket.jpg",
  category: "clothing",                                        // clothing | tops | bottoms | dresses | one-pieces
});

console.log(resultUrl); // the generated image
```

That's it. Uploading both images, starting generation, and polling until the result is ready all happen inside `tryOn()`.

## Configuration

| Option | Default | Description |
|---|---|---|
| `apiKey` | `process.env.TRYVERSE_API_KEY` | Your TryVerse API key. |
| `baseUrl` | `process.env.TRYVERSE_BASE_URL` (or `TRYVERSE_API_URL`), else `https://api.tryverseai.com` | Override for local development or self-hosted deployments. |
| `maxPollAttempts` | `60` | How many times to check a queued generation before giving up. |
| `pollIntervalMs` | `2000` | Delay between status checks. |

No source changes needed to point the SDK at a different environment — set env vars instead:

```bash
# .env (local development)
TRYVERSE_API_KEY=tv_live_...
TRYVERSE_BASE_URL=http://localhost:3001
```

```ts
const tryverse = new TryVerse({
  apiKey: "tv_live_...",   // explicit key instead of the env var
  baseUrl: "http://localhost:3001", // local dev only
});
```

## Tracking progress

```ts
await tryverse.tryOn({
  personImage,
  productImage,
  onProgress: (status) => console.log(status), // "queued" -> "processing" -> "completed"
});
```

## Image inputs

`personImage` and `productImage` accept whatever's natural for your runtime:

- a public URL (`string`)
- a `Buffer` or `Uint8Array` (Node.js)
- a `Blob` or `File` (browsers, edge runtimes)

## Error handling

Failures throw `TryVerseError`, with `status` and `code` populated when the API returned them (e.g. `code: "CREDITS_EXHAUSTED"`).

```ts
import { TryVerse, TryVerseError } from "@tryverseai/sdk";

try {
  await tryverse.tryOn({ personImage, productImage });
} catch (err) {
  if (err instanceof TryVerseError) {
    console.error(err.status, err.code, err.message);
  }
}
```

## Advanced: REST API

The SDK is the recommended integration path, but the underlying REST API remains fully supported for advanced use cases. See the **Advanced REST API Reference** in your TryVerse dashboard (Developers tab) for raw endpoint documentation, request/response shapes, and a Postman collection.
