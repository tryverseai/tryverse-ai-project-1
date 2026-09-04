# TryVerse Widget Integration

The full, always-current integration guide (SDK, REST API, and the embeddable widget) lives in
the TryVerse product at **Dashboard → Developers**, behind sign-in. It is not published as a
static public document.

TryVerse is a B2B AI fashion infrastructure platform. The embeddable widget
(`tryverse-widget.js`) is one integration path — a lower-friction alternative to the TryVerse
SDK and the raw REST API — for adding AI virtual try-on to a brand's own storefront. It
authenticates with an API key plus a domain allowlist and calls the `/api/widget/*` endpoints.

Prerequisites: a TryVerse business account with an active plan, an API key, and your storefront
domain added under **Dashboard → Developers → Allowed domains**.

For access or help, contact `info@tryverseai.com` or open **Dashboard → Connect Store**.
