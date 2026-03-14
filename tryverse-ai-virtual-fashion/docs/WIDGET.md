# TryVerse Widget Integration Guide

Embed AI-powered virtual try-on on your e-commerce site in minutes.

## Prerequisites

- TryVerse account with an active plan
- API key (Dashboard → API Keys)
- Domain added to allowed list (Dashboard → Widget → add your domain)

## Quick Start

### 1. Add your domain

Before embedding, add your website domain in the Dashboard under **Widget** → **Allowed Domains**. Example: `yourshop.com` or `www.yourshop.com`.

### 2. Popup mode (button trigger)

Add a "Try It On" button to your product page:

```html
<script src="https://your-app-url.com/tryverse-widget.js"></script>
<button onclick="TryVerse.open({
  apiKey: 'YOUR_API_KEY',
  productImage: 'https://yoursite.com/product-image.jpg',
  category: 'clothing',
  backendUrl: 'https://api.your-backend.com'
})">
  Try It On
</button>
```

### 3. Embed mode (inline component)

Embed the try-on UI directly in your page:

```html
<div id="tryverse-embed"></div>
<script src="https://your-app-url.com/tryverse-widget.js"></script>
<script>
  TryVerse.embed({
    apiKey: 'YOUR_API_KEY',
    productImage: 'https://yoursite.com/product-image.jpg',
    category: 'clothing',
    container: 'tryverse-embed',
    backendUrl: 'https://api.your-backend.com'
  });
</script>
```

## Configuration

| Option | Required | Description |
|--------|----------|-------------|
| `apiKey` | Yes | Your TryVerse API key |
| `productImage` | Yes | URL of the product image, or storage path |
| `category` | No | `clothing`, `bags`, or `glasses` (default: `clothing`) |
| `backendUrl` | Yes | Your TryVerse API base URL (e.g. `https://api.tryverse.ai`) |
| `container` | Embed only | DOM element ID for inline display |
| `productDescription` | No | Optional text to help the AI (e.g. "blue denim jacket") |

## Dynamic product images

For product pages where the image changes, use a selector or data attribute:

```html
<img data-product-image src="https://yoursite.com/shirt.jpg" />
<button onclick="TryVerse.open({
  apiKey: 'YOUR_API_KEY',
  productImage: document.querySelector('[data-product-image]').src,
  category: 'clothing',
  backendUrl: 'https://api.your-backend.com'
})">
  Try It On
</button>
```

## Global config

Set defaults once to avoid repeating options:

```javascript
TryVerse.config({
  apiKey: 'YOUR_API_KEY',
  backendUrl: 'https://api.your-backend.com',
  category: 'clothing'
});

// Then call with minimal options
TryVerse.open({ productImage: 'https://...' });
```

## Supported categories

- **clothing** – Tops, dresses, jackets, outerwear
- **bags** – Handbags, backpacks, clutches
- **glasses** – Sunglasses, prescription glasses, eyewear

## CORS and domains

The API validates the request origin. Ensure your domain is in the allowed list. Contact support if you need `*` (all domains) for development.

## Troubleshooting

| Error | Solution |
|-------|----------|
| `Invalid signature` | Check API key and backend URL |
| `Domain not authorized` | Add your domain in Dashboard → Widget |
| `Insufficient credits` | Upgrade plan or wait for monthly reset |
| `Upload failed` | Ensure product image URL is accessible (no auth, CORS) |
