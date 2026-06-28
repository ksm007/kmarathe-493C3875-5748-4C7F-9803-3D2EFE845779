import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { AttachmentStorageAdapter } from './storage/attachment-storage.adapter';
import { createAttachmentStorageAdapter } from './storage/attachment-storage.factory';

/**
 * Storage seam for task attachments. Selects a concrete adapter (local disk in
 * development, Cloudinary in production) from env config and delegates every
 * read/write/delete to it, so callers stay backend-agnostic.
 */
@Injectable()
export class AttachmentStorageService implements AttachmentStorageAdapter {
  private readonly adapter: AttachmentStorageAdapter;

  constructor(configService: ConfigService) {
    this.adapter = createAttachmentStorageAdapter(configService);
  }

  save(storageKey: string, buffer: Buffer): Promise<void> {
    return this.adapter.save(storageKey, buffer);
  }

  createReadStream(storageKey: string): Readable {
    return this.adapter.createReadStream(storageKey);
  }

  openReadStream(storageKey: string): Promise<{ stream: Readable; byteLength: number | null }> {
    return this.adapter.openReadStream(storageKey);
  }

  remove(storageKey: string): Promise<void> {
    return this.adapter.remove(storageKey);
  }
}
