import { Readable } from 'stream';

/**
 * Storage seam for task image attachments.
 *
 * Implementations persist opaque `storageKey`-addressed blobs. The key is an
 * org/task-scoped path produced by the tasks service; adapters must treat it as
 * an opaque identifier and never derive trust from its contents beyond
 * preventing path traversal in filesystem-backed implementations.
 */
export interface AttachmentStorageAdapter {
  /** Persist the attachment bytes under `storageKey`, overwriting any existing object. */
  save(storageKey: string, buffer: Buffer): Promise<void>;

  /**
   * Open a readable stream for the stored attachment. Returns synchronously so
   * callers can hand the stream straight to Nest's `StreamableFile`; backends
   * that fetch asynchronously surface failures via the stream's `error` event.
   */
  createReadStream(storageKey: string): Readable;

  /** Delete the stored attachment. Missing objects are treated as already removed. */
  remove(storageKey: string): Promise<void>;
}
