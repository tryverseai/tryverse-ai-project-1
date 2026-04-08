/**
 * Validates paths returned by POST /api/upload (Convex storage: `{owner}/{person|garment}/{storageId}.jpg`).
 * Owner may be `anonymous` or any Convex Auth subject / API-key user id (not only `[a-zA-Z0-9_-]`).
 * Ownership is enforced separately via `startsWith(\`\${userId}/\`)`.
 */
export const UPLOAD_RELATIVE_IMAGE_PATH_RE = /^[^/]+\/(person|garment)\/[^/]+\.jpg$/i;
