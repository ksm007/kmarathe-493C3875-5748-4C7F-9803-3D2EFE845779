import { get as httpsGet } from 'https';
import { PassThrough, Readable } from 'stream';
import { AttachmentStorageAdapter } from './attachment-storage.adapter';

/**
 * Writable returned by the Cloudinary upload helper. Narrowed to the surface
 * this adapter uses so the SDK can be mocked precisely in tests.
 */
export interface CloudinaryUploadStream {
  on(event: 'error', listener: (error: Error) => void): unknown;
  end(buffer: Buffer): void;
}

/** Result shape of a Cloudinary destroy call. */
export interface CloudinaryDestroyResult {
  result?: string;
}

/**
 * Minimal port over the Cloudinary v2 SDK. The adapter depends on this narrow
 * interface rather than the full SDK so it stays testable and decoupled.
 */
export interface CloudinaryPort {
  uploader: {
    upload_stream(
      options: Record<string, unknown>,
      callback: (error: Error | undefined, result: unknown) => void,
    ): CloudinaryUploadStream;
    destroy(
      publicId: string,
      options?: Record<string, unknown>,
    ): Promise<CloudinaryDestroyResult>;
  };
  url(publicId: string, options?: Record<string, unknown>): string;
}

/** Stream and upstream byte length returned by a fetch. */
export interface FetchResult {
  stream: Readable;
  byteLength: number | null;
}

/** Opens a readable byte stream for a (signed) delivery URL, alongside its byte length. */
export type FetchStream = (url: string) => Promise<FetchResult>;

export interface CloudinaryAdapterOptions {
  /** Cloudinary resource type for stored attachments (images only here). */
  resourceType?: string;
  /** Cloudinary delivery type; 'authenticated' keeps assets private at the CDN. */
  deliveryType?: string;
  /** Override the byte fetcher (used in tests to avoid real network calls). */
  fetchStream?: FetchStream;
}

/**
 * Cloudinary-backed attachment storage. Uploads keep the seam's opaque
 * `storageKey` as the Cloudinary public id, and reads proxy the bytes back
 * through this process so the existing authenticated serving endpoint keeps
 * streaming content behind its permission check (assets are stored as
 * `authenticated`, so they are never publicly addressable either).
 */
export class CloudinaryAttachmentStorageAdapter
  implements AttachmentStorageAdapter
{
  private readonly resourceType: string;
  private readonly deliveryType: string;
  private readonly fetchStream: FetchStream;

  constructor(
    private readonly cloudinary: CloudinaryPort,
    options: CloudinaryAdapterOptions = {},
  ) {
    this.resourceType = options.resourceType ?? 'image';
    this.deliveryType = options.deliveryType ?? 'authenticated';
    this.fetchStream = options.fetchStream ?? defaultFetchStream;
  }

  save(storageKey: string, buffer: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const upload = this.cloudinary.uploader.upload_stream(
        {
          public_id: this.publicIdFor(storageKey),
          resource_type: this.resourceType,
          type: this.deliveryType,
          overwrite: true,
        },
        (error) => (error ? reject(error) : resolve()),
      );
      upload.on('error', reject);
      upload.end(buffer);
    });
  }

  createReadStream(storageKey: string): Readable {
    const passthrough = new PassThrough();
    this.openReadStream(storageKey)
      .then(({ stream }) => {
        stream.on('error', (error) => passthrough.destroy(error));
        stream.pipe(passthrough);
      })
      .catch((error) => passthrough.destroy(error as Error));
    return passthrough;
  }

  async openReadStream(storageKey: string): Promise<{ stream: Readable; byteLength: number | null }> {
    const url = this.cloudinary.url(this.publicIdFor(storageKey), {
      resource_type: this.resourceType,
      type: this.deliveryType,
      secure: true,
      sign_url: true,
    });
    const { stream: source, byteLength } = await this.fetchStream(url);
    const passthrough = new PassThrough();
    source.on('error', (error) => passthrough.destroy(error));
    source.pipe(passthrough);
    return { stream: passthrough, byteLength };
  }

  async remove(storageKey: string): Promise<void> {
    const { result } = await this.cloudinary.uploader.destroy(
      this.publicIdFor(storageKey),
      {
        resource_type: this.resourceType,
        type: this.deliveryType,
        invalidate: true,
      },
    );
    // 'ok' is success; 'not found' means already gone - both are fine, matching
    // the local-disk adapter's idempotent ENOENT handling. Anything else fails.
    if (result && result !== 'ok' && result !== 'not found') {
      throw new Error(
        `Cloudinary delete failed for ${storageKey}: ${result}`,
      );
    }
  }

  /**
   * Cloudinary derives the file format from the asset, so the public id is the
   * storage key without its trailing file extension.
   */
  private publicIdFor(storageKey: string): string {
    return storageKey.replace(/\.[a-z0-9]+$/i, '');
  }
}

function defaultFetchStream(url: string): Promise<FetchResult> {
  return new Promise((resolve, reject) => {
    httpsGet(url, (response) => {
      const status = response.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        response.resume();
        reject(
          new Error(`Cloudinary fetch failed with status ${status}`),
        );
        return;
      }
      const rawLength = response.headers['content-length'];
      const byteLength = rawLength ? parseInt(rawLength, 10) : null;
      resolve({ stream: response, byteLength });
    }).on('error', reject);
  });
}
