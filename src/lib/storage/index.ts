/**
 * Private storage adapter for paid digital assets.
 *
 * Implementation: Vercel Blob with `access: 'private'`. Private blobs are not
 * reachable by URL without the store token, so the download route streams
 * the bytes through our server after checking entitlements: no permanent
 * public URL ever reaches the browser.
 */

export interface StoredObject {
  stream: ReadableStream<Uint8Array>;
  contentType: string | null;
  size: number | null;
}

export interface StorageAdapter {
  readonly name: string;
  isConfigured(): boolean;
  put(key: string, body: Uint8Array | Blob, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("Storage not configured. Set BLOB_READ_WRITE_TOKEN.");
    this.name = "StorageNotConfiguredError";
  }
}

export const vercelBlobPrivateStorage: StorageAdapter = {
  name: "vercel-blob-private",
  isConfigured() {
    return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  },
  async put(key, body, contentType) {
    if (!this.isConfigured()) throw new StorageNotConfiguredError();
    const { put } = await import("@vercel/blob");
    await put(key, body instanceof Uint8Array ? Buffer.from(body) : body, {
      access: "private",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  },
  async get(key) {
    if (!this.isConfigured()) throw new StorageNotConfiguredError();
    const { get } = await import("@vercel/blob");
    const res = await get(key, { access: "private", useCache: false });
    if (!res || !res.stream) return null;
    return {
      stream: res.stream,
      contentType: res.blob.contentType ?? null,
      size: res.blob.size ?? null,
    };
  },
};

export function getStorage(): StorageAdapter {
  return vercelBlobPrivateStorage;
}
