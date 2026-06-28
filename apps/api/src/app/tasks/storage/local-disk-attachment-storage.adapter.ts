import { createReadStream } from 'fs';
import { mkdir, stat, unlink, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { Readable } from 'stream';
import { AttachmentStorageAdapter } from './attachment-storage.adapter';

/**
 * Filesystem-backed attachment storage. Intended for local development only;
 * production must use object storage per ADR 0024.
 */
export class LocalDiskAttachmentStorageAdapter implements AttachmentStorageAdapter {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = resolve(rootDir);
  }

  async save(storageKey: string, buffer: Buffer): Promise<void> {
    const path = this.pathFor(storageKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
  }

  createReadStream(storageKey: string): Readable {
    return createReadStream(this.pathFor(storageKey));
  }

  async openReadStream(storageKey: string): Promise<{ stream: Readable; byteLength: number | null }> {
    const path = this.pathFor(storageKey);
    const { size } = await stat(path);
    return { stream: createReadStream(path), byteLength: size };
  }

  async remove(storageKey: string): Promise<void> {
    try {
      await unlink(this.pathFor(storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private pathFor(storageKey: string) {
    const path = resolve(this.rootDir, storageKey);
    if (!path.startsWith(this.rootDir)) {
      throw new Error('Invalid attachment storage key');
    }
    return path;
  }
}
