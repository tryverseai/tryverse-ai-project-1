// Run after `npm run build`:
//   TRYVERSE_API_KEY=tv_live_... node examples/node-usage.mjs
import { TryVerse } from "../dist/index.js";

const tryverse = new TryVerse(); // reads TRYVERSE_API_KEY from the environment

const result = await tryverse.tryOn({
  personImage: "https://yourstore.com/shopper-photo.jpg",
  productImage: "https://yourstore.com/products/denim-jacket.jpg",
  category: "clothing",
  onProgress: (status) => console.log("[progress]", status),
});

console.log("RESULT:", JSON.stringify(result));
