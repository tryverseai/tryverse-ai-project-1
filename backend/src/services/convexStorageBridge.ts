import { env } from '../config/env';
import { logger } from '../config/logger';
import { anyApi, convexMutationTrusted, convexQueryTrusted } from '../config/convexHttp';

const secretArg = () => ({ secret: env.BACKEND_SHARED_SECRET });

/**
 * Convex file storage path: `{userId}/{person|garment|results|videos|_inference_scratch}/{storageId}.{ext}`
 * where `storageId` is the Convex `_storage` document id. `.jpg` for every existing image asset;
 * `.mp4` added for AI Video results (`storeResultVideo`) — every other extension stays rejected.
 */
export function storagePathToConvexId(filePath: string): string {
  const base = filePath.split('/').pop();
  const lower = base?.toLowerCase() ?? '';
  const knownExt = ['.jpg', '.mp4'].find((ext) => lower.endsWith(ext));
  if (!base || !knownExt) {
    throw new Error(`Invalid Convex storage path: ${filePath.slice(0, 80)}`);
  }
  return base.slice(0, -knownExt.length);
}

export async function convexUploadBuffer(buffer: Buffer, contentType: string): Promise<string> {
  const postUrl = await convexMutationTrusted(anyApi.trustedStorage.storageGenerateUploadUrl, {
    ...secretArg(),
  });
  if (typeof postUrl !== 'string' || !postUrl.startsWith('http')) {
    throw new Error('Convex upload URL missing');
  }
  const res = await fetch(postUrl, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: new Uint8Array(buffer),
  });
  if (!res.ok) {
    const t = await res.text();
    logger.error('Convex storage upload failed', { status: res.status, body: t.slice(0, 200) });
    throw new Error(`Convex storage upload failed: ${res.status}`);
  }
  const json = (await res.json()) as { storageId?: string };
  if (!json.storageId) throw new Error('Convex upload response missing storageId');
  return json.storageId;
}

export async function convexGetFileUrl(filePath: string): Promise<string> {
  const storageId = storagePathToConvexId(filePath);
  const url = await convexQueryTrusted<string>(anyApi.trustedStorage.storageGetUrl, {
    ...secretArg(),
    storageId,
  });
  if (!url) throw new Error('Convex getUrl returned empty');
  return url;
}

export async function convexDeleteStorageIds(storageIds: string[]): Promise<void> {
  for (const id of storageIds) {
    try {
      await convexMutationTrusted(anyApi.trustedStorage.storageDelete, {
        ...secretArg(),
        storageId: id,
      });
    } catch (e) {
      logger.warn('Convex storage delete failed', { id, error: String(e) });
    }
  }
}

export function pathsToStorageIds(paths: string[]): string[] {
  const ids: string[] = [];
  for (const p of paths) {
    try {
      ids.push(storagePathToConvexId(p));
    } catch {
      /* ignore */
    }
  }
  return ids;
}
